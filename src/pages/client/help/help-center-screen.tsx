/**
 * 01 HELP HOME, plus the shell the other help screens are rendered inside.
 *
 * Routes: /{client}-dashboard/help (the home, and with ?raise=<topic> the composer),
 * /help/requests[/REQ-nnnn] (the list and the detail, help-requests-screen.tsx and
 * help-request-detail.tsx) and /help/guides/<slug> (help-center-guides.tsx).
 *
 * ── THE FIGMA FRAMES ────────────────────────────────────────────────────────
 * The home is built node for node from "Desktop · Light / 1 Help home" (1440) and
 * "Mobile · Light / 390 Help home" in the file "Reporting System", on the atoms in
 * help-atoms.tsx and the tokens in help-centre.css, and an automated proof holds the
 * rendered page against both frames. Copy is the frames', verbatim; the numbers on the
 * position card are the client's own tickets (help-model.ts, "home screen").
 *
 * ── WHY THE SHELL WRAPS RATHER THAN GETS IMPORTED ───────────────────────────
 * HelpCenterScreen owns the gate, the one fetch of topics and tickets, and the page chrome,
 * then renders whichever view the route asked for INSIDE it. The views never import the
 * shell. That keeps the import graph one-way (help-requests-screen -> help-request-detail ->
 * here) and means the list and the counts are fetched once for the whole section rather
 * than once per screen the client clicks through.
 *
 * ── NO ASSISTANT, ANYWHERE ──────────────────────────────────────────────────
 * There is deliberately no chat box, no "ask Jarvis", and no message composer aimed at us
 * on any of these screens. Jarvis never messages a client and a client never messages
 * Jarvis; the only channel here is a request, which becomes a ticket with a named owner.
 * If a box for typing at an assistant ever appears on this page, it is a bug.
 *
 * ── BOTH THEMES ─────────────────────────────────────────────────────────────
 * Every colour on the home is a --hc-* token, so the page flips with the portal's
 * .dark-mode to the file's Dark values with no code of its own. The gate and the refused
 * panel, which sit outside the help frame, use the portal's semantic tokens as before.
 *
 * House style: no em or en dashes anywhere.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowNarrowLeft } from "@untitledui-pro/icons/line";
import { Link, Navigate, useParams, useSearchParams } from "react-router";
import { SignInBackdrop } from "@/components/application/sign-in-backdrop";
import { Button, Card, Chevron, Eyebrow, HelpFrame, Marker, TopBar, initialOf } from "@/pages/client/help/help-atoms";
import { HELP_GUIDES, HelpGuidePage, findHelpGuide } from "@/pages/client/help/help-center-guides";
import { RequestForm, RequestSent } from "@/pages/client/help/help-form";
import { useSuppressFloatingThemeToggle } from "@/providers/theme-provider";
import {
    type CallerProof,
    HelpApiError,
    type HelpClientRow,
    createTicket,
    fetchClientRow,
    fetchTickets,
    fetchTopics,
    fullDashboardSlug,
    currentCaller,
    useDifferentAccount,
    signOutHere,
    type RefusalReason,
    type Viewer,
} from "@/pages/client/help/help-api";
import {
    type RequestFilter,
    type Ticket,
    type TicketCounts,
    type TicketTopic,
    averageDaysLabel,
    completedThisMonthTickets,
    countsFor,
    nextDueLabel,
    ticketsWithOwner,
} from "@/pages/client/help/help-model";
import { HelpRequestDetail } from "@/pages/client/help/help-request-detail";
import { ErrorNote, HelpRequestsScreen, HelpSpinner } from "@/pages/client/help/help-requests-screen";
import { cx } from "@/utils/cx";

/* ── The gate ────────────────────────────────────────────────────────────── */

/**
 * Proves who is calling, by making a real call.
 *
 * Nothing is compared in the browser. The dashboard's own gate does compare the password
 * client-side, against a row readable with the public anon key, and its source calls itself
 * "UI-level, not a security boundary" for exactly that reason. This asks the server instead:
 * the pair is either accepted by ticket-list, which re-checks it against the live row, or it
 * is not. There is no client-side rule here to get wrong or to bypass.
 *
 * ticket-list specifically, and not ticket-topics, because only the endpoints that TOUCH a
 * ticket are specified to carry and verify the caller proof. Proving a password against an
 * endpoint that may not check it would be a gate that opens for anyone.
 *
 * The email is pre-filled from the dashboard unlock when there is one, so a client who came
 * from their dashboard is asked for one field rather than two.
 */
const HelpGate = ({
    clientRow,
    notice,
}: {
    clientRow: HelpClientRow | null;
    /** Set when a session that was working stopped working mid-visit. */
    notice?: string;
}) => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    /**
     * Google, not a shared password.
     *
     * This panel used to ask for the email and the dashboard's share password.
     * That password is published: the public anon key returns every
     * dashboard_pages row and seven of them carry it in plaintext, so it
     * established nothing about who was asking. A request history needs an
     * identity nobody can read off a table, and the portal already signs
     * clients in with Google for this very dashboard.
     *
     * redirectTo is the current URL so the client lands back on the help centre
     * they were trying to open, which is what the owner guide screen does too.
     */
    const signIn = async () => {
        setBusy(true);
        setError("");
        const { error: authError } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: window.location.href, queryParams: { prompt: "select_account" } },
        });
        if (authError) {
            setBusy(false);
            setError("We could not start sign-in just then. Try again in a moment.");
        }
    };

    return (
        <SignInBackdrop backgroundUrl={clientRow?.backgroundUrl || undefined}>
            <div className="w-full max-w-sm rounded-2xl bg-primary p-8 shadow-2xl ring-1 ring-secondary">
                <img src="/hgm logo/Favicon ON LIGHT.svg" alt="HiddenGem Media" className="mx-auto size-11" draggable={false} />
                <h1 className="mt-5 text-center text-lg font-semibold text-primary">Your requests are private</h1>
                <p className="mt-2 text-center text-sm text-pretty text-tertiary">
                    Sign in with the Google account your HiddenGem Media team added to this dashboard.
                </p>

                {notice && (
                    <p className="mt-4 rounded-lg bg-secondary px-3 py-2 text-center text-sm text-pretty text-secondary" role="status">
                        {notice}
                    </p>
                )}

                <button
                    type="button"
                    onClick={signIn}
                    disabled={busy}
                    className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-solid px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-solid_hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {busy ? "Opening Google..." : "Sign in with Google"}
                </button>

                {error && (
                    <p className="mt-3 text-center text-sm text-error-primary" role="alert">
                        {error}
                    </p>
                )}

                <p className="mt-5 text-center text-xs text-pretty text-quaternary">
                    Not sure which address? Ask your account manager which one they added.
                </p>
            </div>
        </SignInBackdrop>
    );
};

/* ── Refused: a terminal state that owns the page ───────────────────────── */

/** Where a refused client sends the request to be added. The same address the
 *  dashboard itself points people at; the screen does not know their account
 *  manager. */
const SUPPORT_EMAIL = "anhtuan@hiddengem.media";

/**
 * A 403 is not a glitch and must not be painted as one.
 *
 * Before this panel existed, a refusal set an error string and the component
 * fell through to the normal render: a red banner, then a fully working-looking
 * help centre with an empty topic list, a "Current position" that said "You
 * have not raised anything yet" (an affirmative claim about the client's own
 * history, made at the exact moment the call that would have told us was
 * refused), and a Try again button that repainted the same refusal forever. A
 * client's reasonable read was "the site is broken today", which is the wrong
 * conclusion and the wrong next action.
 *
 * So a refusal renders THIS and nothing else. No retry: the 403 is
 * deterministic. Two actions, which are the only two the reader can take:
 * switch to the Google account their account manager added, or ask to have
 * this one added.
 *
 * THE WORDS ARE TRUE IN ALL THREE CASES. The server answers "not_listed" for an
 * unlisted address, an empty list and a dashboard that does not exist, and does
 * not say which - telling them apart would let anyone with a session learn
 * which slugs exist. "Your HiddenGem Media team has not added that address" holds
 * whichever it was.
 */
const RefusedPanel = ({ email, clientName, slug, backgroundUrl }: { email: string; clientName: string; slug: string; backgroundUrl?: string }) => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const whose = clientName ? `${clientName}'s help centre` : "this help centre";

    const switchAccount = async () => {
        setBusy(true);
        setError("");
        try {
            await useDifferentAccount();
        } catch {
            setBusy(false);
            setError("We could not start sign-in just then. Try again in a moment.");
        }
    };

    const mailto =
        `mailto:${SUPPORT_EMAIL}` +
        `?subject=${encodeURIComponent(`Add me to ${clientName || slug}'s help centre`)}` +
        `&body=${encodeURIComponent(`Please add ${email} to the access list for ${slug}.`)}`;

    return (
        <SignInBackdrop backgroundUrl={backgroundUrl}>
            <div className="w-full max-w-sm rounded-2xl bg-primary p-8 shadow-2xl ring-1 ring-secondary" role="region" aria-labelledby="refused-heading">
                <img src="/hgm logo/Favicon ON LIGHT.svg" alt="HiddenGem Media" className="mx-auto size-11" draggable={false} />
                <h1 id="refused-heading" className="mt-5 text-center text-lg font-semibold text-primary">
                    This address is not on the list
                </h1>
                <p className="mt-2 text-center text-sm text-pretty text-tertiary">
                    You are signed in as <span className="font-medium text-secondary">{email}</span>. Your HiddenGem Media team has not added
                    that address to {whose}, so there is nothing we can show you here.
                </p>

                <button
                    type="button"
                    onClick={switchAccount}
                    disabled={busy}
                    className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-solid px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-solid_hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {busy ? "Opening Google..." : "Use a different Google account"}
                </button>
                <p className="mt-2 text-center text-xs text-pretty text-quaternary">Choose the account your account manager added.</p>

                <a
                    href={mailto}
                    className="mt-4 flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-center text-sm font-medium text-secondary ring-1 ring-secondary transition hover:bg-secondary"
                >
                    Ask my account manager to add this address
                </a>

                {error && (
                    <p className="mt-3 text-center text-sm text-error-primary" role="alert">
                        {error}
                    </p>
                )}
            </div>
        </SignInBackdrop>
    );
};

/* ── Staff: say so, on every screen ─────────────────────────────────────── */

/**
 * A staff view announces itself, persistently, above everything.
 *
 * A HiddenGem Media employee reading a client's request history on a call, on a
 * screen-share, or with the client beside them needs the page to say whose it
 * is and what they are looking at, or the first time anyone finds out is when
 * it is already on the wrong screen. It also says what they cannot do, so the
 * absence of the composer and the withdraw control reads as a rule rather
 * than a bug.
 *
 * On a dashboard with nobody listed it says the one thing that matters: no
 * client can use this until somebody is, and where that is done. 48 of 54
 * dashboards were in that state when this was written.
 */
const StaffBanner = ({ viewer, slug }: { viewer: Viewer; slug: string }) => (
    <div className="mb-6 rounded-(--hc-radius-xl) border border-(--hc-border-brand) bg-(--hc-bg-brand-primary) px-[15px] py-[11px] sm:mb-10 sm:px-[19px] sm:py-[15px]" role="status">
        <p className="hc-t-label-field text-(--hc-text-primary)">You are viewing {viewer.clientName || slug.replace(/-dashboard$/, "")}'s requests as HiddenGem Media staff.</p>
        <p className="hc-t-body-helper mt-1 text-pretty text-(--hc-text-secondary)">
            A request you raise here is recorded as raised by you, for the client, and they will see it in their list. You can withdraw the ones you raised.
        </p>
        {viewer.accessListEmpty && (
            <p className="hc-t-body-helper mt-2 text-pretty text-(--hc-text-secondary)">
                Nobody at {viewer.clientName || "this client"} is on this dashboard's access list yet, so they cannot open this help centre. Add them in the
                dashboard's Access panel.
            </p>
        )}
    </div>
);

/* ── The shell chrome ────────────────────────────────────────────────────── */

/**
 * The page: HelpFrame (the `hc` token scope, bg/page, the skip link, header and main)
 * around the file's TopBar with "Help Center" as the app name.
 *
 * The right-hand text is ONE node, "{client}  ·  {person}", two spaces either side of
 * the dot as the frame has it; the avatar is named "Account, {person}" (build notes).
 * The person is the name the server holds for them, falling back to the mailbox name.
 * The brand still reads "HiddenGem Media" at 390 by the owner's instruction (12 Sep
 * 2026), though the frame shortens it there.
 *
 * The screens own the column inside main: a 1040 column (the file's 1440 minus 200
 * gutters), body top 56 and a 40 rhythm on desktop; 16 gutters, top 24 and a 24 rhythm
 * on a phone.
 */
const HelpShell = ({ slug, clientName, email, name, children }: { slug: string; clientName: string; email: string; name?: string; children: React.ReactNode }) => {
    const person = (name ?? "").trim() || email.split("@")[0];
    return (
        <HelpFrame
            topBar={
                <TopBar
                    app="Help Center"
                    brandTo={`/${slug}`}
                    right={clientName ? `${clientName}  ·  ${person}` : person}
                    initial={initialOf(person)}
                    accountName={person}
                    menu={{
                        email,
                        links: [
                            { label: "Your requests", to: `/${slug}/help/requests` },
                            { label: "Help home", to: `/${slug}/help` },
                            // The Reference guides are listed on the home from 640px up only;
                            // on a phone this is the way in.
                            { label: "Guides", to: `/${slug}/help/guides/${HELP_GUIDES[0].slug}` },
                        ],
                        onSignOut: () => void signOutHere(),
                    }}
                />
            }
        >
            {/* The gutters stay until xl: below it a 1040 column would run to the edge
                between 1024 and 1087 (the old lg:px-0 did). Tailwind orders an arbitrary
                min-[] variant before sm:, so sm:px-6 would win over it; xl: sorts after. */}
            <div className="mx-auto w-full max-w-[1040px] px-4 pt-6 pb-10 sm:px-6 sm:pt-14 sm:pb-16 xl:px-0">{children}</div>
        </HelpFrame>
    );
};

/* ── 01 HELP HOME ────────────────────────────────────────────────────────── */

/**
 * The topic tiles inside Card/Raise a request, from the file: each Topic is
 * bg/secondary with a 1px border/secondary, radius/lg, padding 14 by 16 (13 by 15 plus
 * the border), gap 12: the 8px Marker, the Words (label/field over body/helper, gap 2)
 * and the "›" glyph in heading/section. 70 tall. Gap 8 between tiles.
 *
 * Each tile is a LINK (build notes: "each topic is a link, not a heading") to the help
 * home with ?raise=<topic>, which opens the composer with that category preselected. A
 * real URL, so the back button closes the composer and a tile can be sent to someone.
 * The topics come from ticket-topics in sort_order; nothing here is a fixed list.
 */
const TopicTiles = ({ topics, slug }: { topics: TicketTopic[]; slug: string }) => (
    <ul className="flex w-full flex-col gap-2">
        {topics.map((topic) => (
            <li key={topic.key}>
                <Link
                    to={raiseHref(slug, topic.key)}
                    className="hc-hover flex w-full items-center gap-3 rounded-(--hc-radius-lg) border border-(--hc-border-secondary) bg-(--hc-bg-secondary) px-[15px] py-[13px] hover:bg-(--hc-bg-primary_hover) hover:border-(--hc-border-brand)"
                >
                    <Marker />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="hc-t-label-field text-(--hc-text-primary)">{topic.label}</span>
                        {topic.description && <span className="hc-t-body-helper text-(--hc-text-tertiary)">{topic.description}</span>}
                    </span>
                    <Chevron />
                </Link>
            </li>
        ))}
    </ul>
);

/** /{slug}/help?raise=website, or ?raise=any for the button (the composer then shows the category selector). */
const raiseHref = (slug: string, topicKey: string | "any"): string => `/${slug}/help?raise=${encodeURIComponent(topicKey)}`;

/**
 * One Stat row inside Card/Open right now: bg/secondary, radius/lg, padding 12, gap 12.
 * The Count is a 32px square (36 at 390) on the utility tint with the number in
 * label/field in the utility foreground; the Words are label/field over body/helper.
 *
 * The count is read once: it is inside the row's text, so the row announces "2 In
 * progress, Next due 12 September" with nothing repeated and nothing hidden.
 */
const StatRow = ({ count, label, detail, tone, to }: { count: number; label: string; detail: string; tone: "warning" | "success"; to: string }) => (
    // The row is a link to the list it summarises. The 390 frame draws no "View all
    // requests" and no navigation, so without this a phone would have no way from the
    // home to the list; the row looks exactly as drawn either way.
    <li>
    <Link to={to} className="hc-hover flex w-full cursor-pointer items-center gap-3 rounded-(--hc-radius-lg) bg-(--hc-bg-secondary) p-3 hover:bg-(--hc-bg-tertiary)">
        <span
            className={cx(
                "hc-t-label-field flex size-9 shrink-0 items-center justify-center rounded-(--hc-radius-md) tabular-nums sm:size-8",
                tone === "warning" ? "bg-(--hc-utility-warning-bg) text-(--hc-utility-warning-fg)" : "bg-(--hc-utility-success-bg) text-(--hc-utility-success-fg)",
            )}
        >
            {count}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="hc-t-label-field text-(--hc-text-primary)">{label}</span>
            <span className="hc-t-body-helper text-(--hc-text-tertiary)">{detail}</span>
        </span>
    </Link>
    </li>
);

/**
 * Card/Open right now, titled "Current position": 344 wide on desktop, padding 24,
 * gap 16; full width at 390, padding 16, gap 12. Two Stat rows, then on desktop only
 * the primary Button (FILL), the helper line and "View all requests"; the 390 frame
 * draws the card with the two stats alone (the button sits under the heading there).
 *
 * The numbers are the client's own: "In progress" is what an owner has, "Next due" the
 * earliest promised date among those, "Completed this month" this calendar month's
 * completions and the mean days from raised to done over them (help-model.ts, under
 * "home screen").
 */
const CurrentPosition = ({ tickets, slug }: { tickets: Ticket[]; slug: string }) => (
    <Card as="section" className="flex w-full flex-col gap-3 sm:w-[344px] sm:shrink-0 sm:gap-4">
        <h2 id="hc-position" className="hc-t-heading-section text-(--hc-text-primary)">
            Current position
        </h2>
        <ul className="flex w-full flex-col gap-3 sm:gap-4">
            <StatRow count={ticketsWithOwner(tickets).length} label="In progress" detail={nextDueLabel(tickets)} tone="warning" to={`/${slug}/help/requests?filter=open`} />
            <StatRow count={completedThisMonthTickets(tickets).length} label="Completed this month" detail={averageDaysLabel(tickets)} tone="success" to={`/${slug}/help/requests?filter=completed`} />
        </ul>
        <div className="hidden sm:contents">
            <Button to={raiseHref(slug, "any")} fill>
                Raise a request
            </Button>
            <p className="hc-t-body-helper text-(--hc-text-tertiary)">The date is shown before submission.</p>
            {/* body/helper at 20 tall as the frame draws it; the 44px target the build
                notes ask for is the pseudo-element, which moves nothing. */}
            <Link
                to={`/${slug}/help/requests`}
                className="hc-t-body-helper relative w-full rounded-(--hc-radius-sm) text-(--hc-text-brand-secondary) after:absolute after:inset-x-0 after:-inset-y-3 after:content-[''] hover:underline"
            >
                View all requests
            </Link>
        </div>
    </Card>
);

/**
 * The Guides row under the columns, desktop only (the 390 frame has none): "Reference"
 * in caption/meta, then the four guide links in body/helper, underlined, text/brand-
 * secondary, 24 apart and vertically centred. The heading is the row's own label, so
 * the landmark reads "Reference" and the four links are its contents.
 */
const GuidesRow = ({ slug }: { slug: string }) => (
    <nav aria-labelledby="hc-reference" className="hidden w-full items-center gap-6 sm:flex">
        <h2 id="hc-reference" className="hc-t-caption-meta text-(--hc-text-tertiary)">
            Reference
        </h2>
        <ul className="flex items-center gap-6">
            {HELP_GUIDES.map((g) => (
                <li key={g.slug} className="flex">
                    <Link
                        to={`/${slug}/help/guides/${g.slug}`}
                        className="hc-t-body-helper relative rounded-(--hc-radius-sm) text-(--hc-text-brand-secondary) underline after:absolute after:inset-x-0 after:-inset-y-3 after:content-['']"
                    >
                        {g.title}
                    </Link>
                </li>
            ))}
        </ul>
    </nav>
);

/**
 * The home, node for node from "Desktop · Light / 1 Help home" and "Mobile · Light /
 * 390 Help home":
 *
 *   Heading    eyebrow "HELP CENTER" (caption/meta), the hero in display/hero on
 *              desktop and display/title at 390, the lede in body/helper at most 680
 *              wide on desktop and body/input at 390. The two ledes differ by a
 *              sentence, so each is its own node shown at its own width.
 *   390 only   the primary Button "New request", full width, straight under the heading
 *   Columns    Card/Raise a request (fills; heading, the lede on desktop only, the
 *              tiles) and Card/Open right now (344). At 390 the position card comes
 *              first and the two stack 24 apart.
 *   Guides     the Reference row, desktop only.
 *
 * Section gap 40 on desktop, 24 at 390. Heading order: h1 the hero, h2 the two cards,
 * h2 Reference. The topics are links, not headings.
 */
const HelpHome = ({ tickets, topics, slug }: { tickets: Ticket[]; topics: TicketTopic[]; slug: string }) => (
    <div className="flex flex-col gap-6 sm:gap-10">
        <header className="flex flex-col gap-2">
            <Eyebrow>HELP CENTER</Eyebrow>
            <h1 className="hc-t-display-title sm:hc-t-display-hero w-full text-(--hc-text-primary)">Every request has an owner and a date.</h1>
            <p className="hc-t-body-input text-(--hc-text-secondary) sm:hidden">Raised here, assigned within the minute, and visible until it closes.</p>
            <p className="hc-t-body-helper hidden max-w-[680px] text-(--hc-text-secondary) sm:block">
                Raised here, assigned within the minute, and visible until it closes. No follow-up required.
            </p>
        </header>

        <Button to={raiseHref(slug, "any")} fill className="sm:hidden">
            New request
        </Button>

        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <Card as="section" className="order-2 flex min-w-0 flex-1 flex-col gap-2 sm:order-1 sm:gap-4">
                <h2 id="hc-raise" className="hc-t-heading-section text-(--hc-text-primary)">
                    Raise a request
                </h2>
                <p className="hc-t-body-helper hidden text-(--hc-text-tertiary) sm:block">Select a category. Each routes directly to the team accountable for it.</p>
                <TopicTiles topics={topics} slug={slug} />
            </Card>
            <div className="order-1 flex w-full sm:order-2 sm:w-auto">
                <CurrentPosition tickets={tickets} slug={slug} />
            </div>
        </div>

        <GuidesRow slug={slug} />
    </div>
);

/* ── The composer ────────────────────────────────────────────────────────── */

/**
 * Raising a request: the shared RequestForm (help-form.tsx), which is the Figma's form
 * for the client and the team alike, in its 560 column. This wrapper owns the API call
 * (the server decides who may submit) and the way back. The category comes from the
 * URL (?raise=<topic>), so a tile, the button and a guide all open the same thing.
 */
const Composer = ({
    topic,
    topics,
    proof,
    clientName,
    isStaff,
    focusFirstField,
    onCancel,
    onCreated,
}: {
    topic: TicketTopic | null;
    topics: TicketTopic[];
    focusFirstField?: boolean;
    proof: CallerProof;
    clientName: string;
    /** Staff raise through the same form; the difference is on the server and in the lede. */
    isStaff: boolean;
    onCancel: () => void;
    onCreated: (reference: string, title: string) => void;
}) => (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
        <button
            type="button"
            onClick={onCancel}
            className="hc-t-body-helper -ml-1 inline-flex min-h-11 w-max cursor-pointer items-center gap-1.5 rounded-(--hc-radius-sm) px-1 text-(--hc-text-brand-secondary) hover:underline"
        >
            <ArrowNarrowLeft className="size-4" aria-hidden="true" />
            Back to the help centre
        </button>
        <RequestForm
            mode="client"
            focusFirstField={focusFirstField}
            slug={proof.slug}
            // Every category, so the select can change it; the tile's own category is
            // the preselection, not the only option.
            topics={topics}
            fixedTopic={topic ?? undefined}
            clientName={clientName}
            email={isStaff ? `${proof.email} (HiddenGem Media)` : proof.email}
            onSubmit={async (input) => {
                const res = await createTicket(proof, input);
                return { reference: res.ticket.reference };
            }}
            onCreated={(reference, _slug, sent) => onCreated(reference, sent.title)}
        />
    </div>
);

/**
 * What a client sees the moment a request lands: the frame's success card. "Back to
 * portal" returns to the help home; "Report another ticket" reopens the composer.
 */
const CreatedNote = ({ sent, clientName, onBack, onRaiseAnother }: { sent: { reference: string; title: string }; clientName: string; onBack: () => void; onRaiseAnother: () => void }) => {
    const headingRef = useRef<HTMLDivElement>(null);
    // Focus moves to the confirmation so the outcome is announced. Submitting a form and
    // being dropped back at its top with no announcement is the classic silent success.
    useEffect(() => {
        headingRef.current?.focus();
    }, []);
    return (
        <div ref={headingRef} tabIndex={-1} className="outline-none">
            <RequestSent
                reference={sent.reference}
                title={sent.title}
                clientName={clientName}
                priority={null}
                team={false}
                primary={{ label: "Raise another request", onClick: onRaiseAnother }}
                secondary={{ label: "Back to help centre", onClick: onBack }}
            />
        </div>
    );
};

/* ── The route component ─────────────────────────────────────────────────── */

export type HelpView = "home" | "list" | "detail" | "guide";

export const HelpCenterScreen = ({ view }: { view: HelpView }) => {
    const { clientSlug = "", reference = "", guide = "" } = useParams<{ clientSlug: string; reference: string; guide: string }>();
    // The dashboard answers on both /paradise-pointe-dashboard and the short /paradise-pointe,
    // so the help centre has to as well. Normalised once here; everything downstream, the
    // session keys included, sees the full slug.
    const slug = useMemo(() => fullDashboardSlug(clientSlug), [clientSlug]);

    // This page is a focused client surface with its own chrome, and the global floating
    // theme toggle would land on top of it. Its route is dynamic, so it cannot be listed in
    // main.tsx's static PAGES_WITHOUT_FLOATING_CHROME array - this hook is the sanctioned
    // way for such a page to opt out.
    useSuppressFloatingThemeToggle();

    const [proof, setProof] = useState<CallerProof | null>(null);
    const [callerResolved, setCallerResolved] = useState(false);
    const [gateNotice, setGateNotice] = useState("");
    const [clientRow, setClientRow] = useState<HelpClientRow | null>(null);
    const [topics, setTopics] = useState<TicketTopic[]>([]);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [serverCounts, setServerCounts] = useState<TicketCounts | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    /** A 403 with a reason. Terminal: it owns the page until the session changes. */
    const [refusal, setRefusal] = useState<{ reason: RefusalReason; message: string } | null>(null);
    /** Who the server said is looking. Null until the first successful read. */
    const [viewer, setViewer] = useState<Viewer | null>(null);
    // The list's filter, seeded from ?filter= so a stat row on the home can open the
    // list already narrowed ("In progress" -> open, "Completed this month" -> completed).
    // The list's filter IS the URL (?filter=open), read on every render: the four help
    // routes share this one mounted screen, so a state seeded once at mount would ignore
    // a stat row's link taken after the home had loaded. A chip writes it back.
    const [filterParams, setFilterParams] = useSearchParams();
    const wantedFilter = filterParams.get("filter");
    const filter: RequestFilter = wantedFilter === "open" || wantedFilter === "completed" || wantedFilter === "withdrawn" ? wantedFilter : "all";
    const setFilter = (next: RequestFilter) => setFilterParams(next === "all" ? {} : { filter: next }, { replace: true });
    // After "Raise another request" the fresh composer puts focus on its first field.
    const [raiseAgain, setRaiseAgain] = useState(false);
    const [created, setCreated] = useState<{ reference: string; title: string } | null>(null);

    /**
     * The composer is a URL, not a flag: /help?raise=website opens it with that category,
     * ?raise=any with the selector, and no parameter is the home. A tile is therefore a
     * real link, the back button closes the form, and a guide can open the composer
     * under its own category with nothing more than an href. A key that matches no
     * topic (a stale link) falls back to the selector rather than a blank form.
     */
    const [params, setParams] = useSearchParams();
    const raise = params.get("raise");
    const composing: TicketTopic | "any" | null = raise === null ? null : (topics.find((t) => t.key === raise) ?? "any");
    const openComposer = (topicKey: string | "any") => setParams({ raise: topicKey });
    const closeComposer = (replace = false) => setParams({}, { replace });

    /* The client's own name and their AM's chosen backdrop. Read straight from
       dashboard_pages with the public anon key, exactly as the dashboard does. Nothing here
       decides access - the server does that on every call - so it is only ever a heading. */
    useEffect(() => {
        let live = true;
        void fetchClientRow(slug).then((row) => {
            if (live) setClientRow(row);
        });
        return () => {
            live = false;
        };
    }, [slug]);

    /* WHO IS ASKING. Read from the Supabase session rather than from storage, so a
       client who signed in on their dashboard is already through, and one returning
       from the Google redirect is picked up on the next render. onAuthStateChange
       covers the redirect landing, where getSession alone can resolve before the URL
       fragment has been exchanged for a session. */
    useEffect(() => {
        let live = true;
        const resolve = () => {
            void currentCaller(slug).then((caller) => {
                if (!live) return;
                // The same person is the same proof: a token refresh must not refetch
                // the list and reset a detail page (and its withdraw card) under a client.
                setProof((prev) => (prev && caller && prev.slug === caller.slug && prev.email === caller.email ? prev : caller));
                setCallerResolved(true);
            });
        };
        resolve();
        const { data: sub } = supabase.auth.onAuthStateChange(() => resolve());
        return () => {
            live = false;
            sub.subscription.unsubscribe();
        };
    }, [slug]);

    /** A rejected proof stops being used immediately and the gate comes back saying why. */
    const handleAuthLoss = useCallback(() => {
        setProof(null);
        setTickets([]);
        setTopics([]);
        setServerCounts(null);
        setRefusal(null);
        setViewer(null);
        setGateNotice("Your session expired. Sign in again to see your requests.");
    }, []);

    const load = useCallback(
        async (p: CallerProof) => {
            setLoading(true);
            setError("");
            try {
                // Fetched together: the list is what every screen in this section counts from,
                // and the topics are what the chooser is built from. One round trip, one state.
                const [list, topicRes] = await Promise.all([fetchTickets(p), fetchTopics(p)]);
                setRefusal(null);
                setViewer(list.viewer ?? topicRes.viewer ?? null);
                setTickets(list.tickets ?? []);
                setServerCounts(list.counts ?? null);
                setTopics(topicRes.topics ?? []);
            } catch (e) {
                if (e instanceof HelpApiError && e.unauthorised) {
                    handleAuthLoss();
                } else if (e instanceof HelpApiError && e.status === 403 && e.reason) {
                    // Terminal. Not an error banner over a working page: the
                    // page IS the refusal, and nothing under it may claim to
                    // know anything about this client's requests.
                    setTickets([]);
                    setTopics([]);
                    setServerCounts(null);
                    setViewer(null);
                    setRefusal({ reason: e.reason, message: e.message });
                } else {
                    setError(e instanceof HelpApiError ? e.message : "We could not load your requests just then.");
                }
            }
            setLoading(false);
        },
        [handleAuthLoss],
    );

    useEffect(() => {
        if (proof) void load(proof);
    }, [proof, load]);

    /**
     * The confirmation belongs to one moment, not to the section.
     *
     * All four help routes render THIS component, and react-router builds each match with
     * `createElement(RenderedRoute, { match, routeContext, children })` and no `key` (see
     * RenderedRoute in react-router's chunk-4ZMWKKQ3.mjs). Same type, same position, no key,
     * so React keeps the instance and only swaps the `view` prop - moving between the
     * screens does not remount anything. That is the point: the list and the topics are
     * fetched once for the section, not once per screen. The cost is that anything meant to
     * be momentary survives a navigation too. Without this, a client who raises a request,
     * opens it, then presses back lands on the help home and is told "Request received
     * REQ-nnnn" for a request they raised several screens ago, which reads as a second one
     * having been sent.
     */
    useEffect(() => {
        if (view !== "home") setCreated(null);
    }, [view]);

    if (!callerResolved) return null;
    if (!proof) {
        return <HelpGate clientRow={clientRow} notice={gateNotice} />;
    }

    const clientName = clientRow?.clientName ?? "";

    // Before the shell, before the counts, before body(): a refused caller sees
    // one panel and nothing that could be read as a fact about their requests.
    if (refusal?.reason === "not_listed") {
        return <RefusedPanel email={proof.email} clientName={clientName} slug={slug} backgroundUrl={clientRow?.backgroundUrl || undefined} />;
    }

    const isStaff = viewer?.via === "staff";

    // Counted from the rows on screen rather than trusting the server's totals, so a
    // withdrawal cannot leave "7 requests. 2 open." disagreeing with the list under it while
    // a refetch is in flight. The server's own counts are kept for the first paint.
    // The list is capped at 200 rows; past that the server's counts are the truth and
    // the rows are a page. Under the cap the rows are complete and can be counted here,
    // which also keeps the summary right while a withdrawal is in flight.
    const counts = serverCounts !== null && tickets.length >= 200 ? serverCounts : countsFor(tickets);

    const body = () => {
        if (loading && tickets.length === 0 && topics.length === 0) return <HelpSpinner label="Loading your requests" />;

        if (view === "detail") {
            return <HelpRequestDetail proof={proof} reference={reference} slug={slug} topics={topics} onTicketChanged={() => void load(proof)} />;
        }

        if (view === "list") {
            return <HelpRequestsScreen tickets={tickets} counts={counts} topics={topics} slug={slug} filter={filter} onFilterChange={setFilter} />;
        }

        if (view === "guide") {
            const found = findHelpGuide(guide);
            // A guide that does not exist is not a page: back to the home, where the four that do are listed.
            return found ? <HelpGuidePage guide={found} slug={slug} /> : <Navigate to={`/${slug}/help`} replace />;
        }

        if (created) {
            return (
                <CreatedNote
                    sent={created}
                    clientName={viewer?.clientName || clientName}
                    onBack={() => setCreated(null)}
                    onRaiseAnother={() => {
                        setCreated(null);
                        setRaiseAgain(true);
                        openComposer("any");
                    }}
                />
            );
        }

        if (composing) {
            return (
                <Composer
                    topic={composing === "any" ? null : composing}
                    topics={topics}
                    focusFirstField={raiseAgain}
                    proof={proof}
                    clientName={viewer?.clientName || clientName}
                    isStaff={isStaff}
                    onCancel={() => closeComposer()}
                    onCreated={(ref, sentTitle) => {
                        setCreated({ reference: ref, title: sentTitle });
                        // Replace, so the back button from the confirmation does not land
                        // on the emptied form as though nothing had been sent.
                        closeComposer(true);
                        void load(proof);
                    }}
                />
            );
        }

        return <HelpHome tickets={tickets} topics={topics} slug={slug} />;
    };

    return (
        <HelpShell slug={slug} clientName={viewer?.clientName || clientName} email={proof.email} name={viewer?.name}>
            {isStaff && viewer && <StaffBanner viewer={viewer} slug={slug} />}
            {error && (
                <div className="mb-6">
                    {/* Retry is offered for the errors that CAN change on a retry: the
                        network, and our own 5xx. A refusal never reaches here. */}
                    <ErrorNote message={error} onRetry={() => void load(proof)} />
                </div>
            )}
            {body()}
        </HelpShell>
    );
};
