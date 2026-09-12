/**
 * 01 HELP HOME, plus the shell the other two help screens are rendered inside.
 *
 * Route: /{client}-dashboard/help, and /{client}-dashboard/help/requests[/REQ-nnnn].
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
 * ── LIGHT MODE, AND WHY THE TOKENS ARE STILL USED ───────────────────────────
 * The approved design is light. Rather than pin the page to light and have it fight a
 * client whose dashboard is already dark, every colour is a semantic token, and every pair
 * was MEASURED in both themes rather than eyeballed: the tokens are resolved out of the
 * built stylesheet and converted oklch -> sRGB -> relative luminance.
 *
 * Every shipped text pair clears WCAG AA's 4.5:1. The floor is the Completed chip at
 * 4.72:1 in light and the active filter chip's label at 5.31:1 in dark; body text sits at
 * 7.47:1 and headings at 17.16:1 or better.
 *
 * Two pairs were CHANGED after measuring rather than argued around, and both are worth
 * knowing about before softening anything here:
 *   - text-quaternary is ruled out everywhere. It does not fail (4.53:1 on the page
 *     ground, 4.73:1 on a card) but clearing by 0.03 on the smallest type on the page is
 *     not a margin worth having.
 *   - white/80 on bg-brand-solid resolves to rgb(204 224 248) and measures 3.94:1, which
 *     DOES fail. The filter-chip counts are solid white for that reason.
 */
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowNarrowLeft, CheckCircle, Image01, XClose } from "@untitledui-pro/icons/line";
import { Link, useParams } from "react-router";
import { SignInBackdrop } from "@/components/application/sign-in-backdrop";
import { useSuppressFloatingThemeToggle } from "@/providers/theme-provider";
import {
    type CallerProof,
    HelpApiError,
    type HelpClientRow,
    MAX_DETAIL,
    MAX_IMAGES,
    MAX_PROPERTY,
    MAX_TITLE,
    type TicketImage,
    createTicket,
    fetchClientRow,
    fetchTickets,
    fetchTopics,
    fullDashboardSlug,
    prepareImages,
    currentCaller,
    useDifferentAccount,
    type RefusalReason,
    type Viewer,
} from "@/pages/client/help/help-api";
import {
    LIFECYCLE,
    type RequestFilter,
    type Ticket,
    type TicketCounts,
    type TicketTopic,
    completedThisMonth,
    countsFor,
    formatStampShort,
    todayIsoDay,
    topicTurnaroundLabel,
} from "@/pages/client/help/help-model";
import { HelpRequestDetail } from "@/pages/client/help/help-request-detail";
import {
    ErrorNote,
    Eyebrow,
    FOCUS,
    HelpRequestsScreen,
    HelpSpinner,
    MonoRef,
    Panel,
    PrimaryButton,
    SecondaryButton,
    T,
    TextLink,
} from "@/pages/client/help/help-requests-screen";
import { cx } from "@/utils/cx";

/* ── Shared field styling ────────────────────────────────────────────────── */

/**
 * text-md, not text-sm, on every field a client TYPES into.
 *
 * 16px is the threshold below which iOS Safari zooms the viewport on focus, which on a
 * 390px frame throws the client out of the layout mid-sentence and does not zoom back. The
 * labels around them stay at 14px; only the fields themselves are bumped.
 *
 * The file picker is deliberately NOT on this rule and an audit that flags it as an input
 * under 16px is reading the tag, not the behaviour: tapping a file input opens the system
 * picker rather than focusing a text caret, so it never triggers the zoom this exists to
 * prevent. Its 14px label is text-tertiary, measured at 7.80:1, so it is a size choice and
 * not a legibility one.
 */
/**
 * A field, per the Figma's Field/Select and Field/Textarea components: 48 tall, body/input
 * (16px, so iOS does not zoom), bg/primary, a hairline in border/primary (the 4.74:1 one,
 * because a control standing alone on the page needs it - build notes), radius/lg, and the
 * focus ring in border/brand. An invalid field swaps the hairline for border/error.
 */
const fieldClass = (invalid?: boolean) =>
    cx(
        "w-full rounded-lg bg-primary px-3.5 py-3 text-primary ring-1 outline-none placeholder:text-tertiary focus:ring-2 focus:ring-brand motion-reduce:transition-none",
        T.body,
        invalid ? "ring-error" : "ring-primary",
    );

/** The label row: label/field on the left, "Required" or "Optional" in caption/meta on the right. */
const FieldLabel = ({ htmlFor, children, optional }: { htmlFor: string; children: React.ReactNode; optional?: boolean }) => (
    <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className={cx(T.label, "text-secondary")}>
            {children}
        </label>
        <span className={cx(T.caption, "text-tertiary")}>{optional ? "Optional" : "Required"}</span>
    </div>
);

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
                    Sign in with the Google account your HiddenGem team added to this dashboard.
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
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-solid px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-solid_hover disabled:opacity-60"
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
 * which slugs exist. "Your HiddenGem team has not added that address" holds
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
                    You are signed in as <span className="font-medium text-secondary">{email}</span>. Your HiddenGem team has not added
                    that address to {whose}, so there is nothing we can show you here.
                </p>

                <button
                    type="button"
                    onClick={switchAccount}
                    disabled={busy}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-solid px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-solid_hover disabled:opacity-60"
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
 * A HiddenGem employee reading a client's request history on a call, on a
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
    <div className="mb-6 rounded-xl bg-brand-primary px-4 py-3 ring-1 ring-brand sm:mb-10 sm:px-5 sm:py-4" role="status">
        <p className={cx(T.label, "text-primary")}>You are viewing {viewer.clientName || slug.replace(/-dashboard$/, "")}'s requests as HiddenGem staff.</p>
        <p className={cx(T.helper, "mt-1 text-pretty text-secondary")}>You can read everything here. Raising or withdrawing a request has to come from the client.</p>
        {viewer.accessListEmpty && (
            <p className={cx(T.helper, "mt-2 text-pretty text-secondary")}>
                Nobody at {viewer.clientName || "this client"} is on this dashboard's access list yet, so they cannot open this help centre. Add them in the
                dashboard's Access panel.
            </p>
        )}
    </div>
);

/* ── The shell chrome ────────────────────────────────────────────────────── */

/**
 * The Figma's TopBar component, as the page header.
 *
 * 64 tall, bg/page with a hairline below in border/secondary, 24 of padding. Left: the gem
 * mark in brand gold, "HiddenGem Media" in label/field, a "/" in text/tertiary, and the app
 * name in the brand colour. Right: "{client} · {person}" in body/helper (hidden on a phone,
 * as the mobile frame has it) and a 32px avatar with the initial on a brand tint. On a
 * phone the brand reads "HiddenGem".
 *
 * The mark is a link back to the dashboard, because the old chrome's one job was that
 * link and it should not be lost; the avatar is named "Account, {person}" (build notes).
 */
const GemMark = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 4h10l4 5-9 11L3 9l4-5Z" stroke="#f5c518" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M3 9h18M12 20 8 9l2-5M12 20l4-11-2-5" stroke="#f5c518" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
);

const TopBar = ({ slug, clientName, email, name }: { slug: string; clientName: string; email: string; name?: string }) => {
    const person = (name ?? "").trim() || email.split("@")[0];
    const initial = (person[0] ?? "?").toUpperCase();
    return (
        <header className="border-b border-secondary bg-primary">
            <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
                <Link to={`/${slug}`} className={cx("inline-flex h-11 items-center gap-2.5 rounded", FOCUS)} aria-label="Back to the dashboard">
                    <GemMark />
                    <span className={cx(T.label, "text-primary")}>
                        <span className="sm:hidden">HiddenGem</span>
                        <span className="hidden sm:inline">HiddenGem Media</span>
                    </span>
                    <span className={cx(T.label, "text-tertiary")} aria-hidden="true">
                        /
                    </span>
                    <span className={cx(T.label, "text-fg-brand-primary")}>Help Center</span>
                </Link>
                <div className="flex items-center gap-2.5">
                    <span className={cx(T.helper, "hidden text-secondary sm:inline")}>
                        {clientName ? `${clientName}  ·  ` : ""}
                        {person}
                    </span>
                    <span
                        role="img"
                        aria-label={`Account, ${email}`}
                        className={cx("flex size-8 items-center justify-center rounded-full bg-brand-primary ring-1 ring-brand", T.caption, "text-primary")}
                    >
                        {initial}
                    </span>
                </div>
            </div>
        </header>
    );
};

/**
 * The page. A 1040 column (the Figma's 1440 minus 200 gutters), body top 56 and a 40
 * rhythm on desktop; 16 gutters, top 24 and a 24 rhythm on a phone. header / main / footer
 * landmarks with a skip link first in the tab order, per the build notes.
 */
const HelpShell = ({ slug, clientName, email, name, children }: { slug: string; clientName: string; email: string; name?: string; children: React.ReactNode }) => (
    <div className="min-h-dvh bg-primary">
        <a
            href="#help-main"
            className={cx(
                "sr-only rounded-lg bg-brand-solid px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50",
                T.label,
                FOCUS,
            )}
        >
            Skip to content
        </a>
        <TopBar slug={slug} clientName={clientName} email={email} name={name} />
        <main id="help-main" tabIndex={-1} className="mx-auto w-full max-w-[1040px] px-4 pt-6 pb-10 outline-none sm:px-6 sm:pt-14 sm:pb-16 lg:px-0">
            {children}
        </main>
        <footer className="mx-auto w-full max-w-[1040px] px-4 pb-8 sm:px-6 lg:px-0">
            <p className={cx(T.helper, "text-tertiary")}>HiddenGem Media</p>
        </footer>
    </div>
);

/* ── 01 HELP HOME ────────────────────────────────────────────────────────── */

/**
 * "What do you need?" - the topic tiles, from the Figma's Card/Raise a request.
 *
 * Each tile: bg/secondary, a hairline in border/secondary, radius/lg, 14 by 16 padding, an
 * 8px brand dot (decorative, aria-hidden - the build notes), the label in label/field and
 * the description in body/helper. Two to a row on desktop, stacked on a phone. Each topic
 * is a control, not a heading. The topics themselves come from the database: today that is
 * Website and Other, and the tiles follow whatever is seeded.
 */
const TopicTiles = ({ topics, onPick }: { topics: TicketTopic[]; onPick: (t: TicketTopic) => void }) => (
    <ul className="grid gap-2 sm:grid-cols-2">
        {topics.map((topic) => {
            // Rendered only when the topic row actually carries a turnaround. Today both
            // seeded topics have turnaround_days NULL, so nothing appears here at all.
            const turnaround = topicTurnaroundLabel(topic);
            return (
                <li key={topic.key}>
                    <button
                        type="button"
                        onClick={() => onPick(topic)}
                        className={cx(
                            "flex h-full min-h-14 w-full items-center gap-3 rounded-[10px] bg-secondary px-4 py-3.5 text-left ring-1 ring-secondary transition duration-100 ease-linear hover:bg-tertiary hover:ring-brand motion-reduce:transition-none",
                            FOCUS,
                        )}
                    >
                        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-brand-solid" />
                        <span className="min-w-0 flex-1">
                            <span className={cx("block text-primary", T.label)}>{topic.label}</span>
                            {topic.description && <span className={cx("mt-0.5 block text-pretty text-tertiary", T.helper)}>{topic.description}</span>}
                            {turnaround && <span className={cx("mt-1 block text-fg-brand-primary", T.helper)}>Turnaround: {turnaround}</span>}
                        </span>
                    </button>
                </li>
            );
        })}
    </ul>
);

/**
 * One stat row inside "Where things stand": a 32px count badge on a tint, the label in
 * label/field, the second line in body/helper. Warning tint for what is in progress,
 * success tint for what finished this month. Nothing on the second line is invented: it
 * says the next promised date only when one exists, and otherwise says that plainly.
 */
const StatRow = ({ count, label, detail, tone }: { count: number; label: string; detail: string; tone: "warning" | "success" }) => (
    <li className="flex items-center gap-3 rounded-[10px] bg-secondary p-3">
        <span
            aria-hidden="true"
            className={cx(
                "flex size-8 shrink-0 items-center justify-center rounded-lg tabular-nums",
                T.label,
                tone === "warning" ? "bg-yellow-50 text-yellow-800" : "bg-green-50 text-green-800",
            )}
        >
            {count}
        </span>
        <span className="min-w-0 flex-1">
            <span className={cx("block text-primary", T.label)}>
                <span className="sr-only">{count} </span>
                {label}
            </span>
            <span className={cx("mt-0.5 block text-pretty text-tertiary", T.helper)}>{detail}</span>
        </span>
    </li>
);

/** The next promised date across open requests, or null when none carries one. */
const nextPromised = (tickets: Ticket[]): string | null => {
    const dates = tickets
        .filter((t) => (t.status === "received" || t.status === "assigned" || t.status === "in_progress") && t.promised_date)
        .map((t) => t.promised_date as string)
        .sort();
    return dates[0] ? formatStampShort(dates[0]) : null;
};

/**
 * "Where things stand" - the Figma's Card/Open right now, 344 wide on desktop and the
 * first thing after the heading on a phone (where the primary button comes first of all).
 *
 * Its two counts are what is open and what finished this month. The primary action sits
 * under them with the trust line "You will see the date before you send it." - which is
 * only true once topics carry a turnaround, so until then the line says what IS true: that
 * a person will own it. Then the link to everything.
 */
const WhereThingsStand = ({
    tickets,
    counts,
    slug,
    clientName,
    readOnly,
    onRaise,
}: {
    tickets: Ticket[];
    counts: TicketCounts;
    slug: string;
    clientName?: string;
    readOnly: boolean;
    onRaise: () => void;
}) => {
    const open = tickets.filter((t) => t.status === "received" || t.status === "assigned" || t.status === "in_progress").length;
    const done = completedThisMonth(tickets);
    const next = nextPromised(tickets);
    const whose = readOnly ? clientName || "This client" : "You";
    return (
        <Panel className="flex flex-col gap-4 p-4 sm:p-6">
            <h2 className={cx(T.section, "text-primary")}>Where things stand</h2>
            {counts.total === 0 ? (
                <p className={cx(T.helper, "text-pretty text-tertiary")}>
                    {whose} {readOnly ? "has" : "have"} not raised anything yet. When {readOnly ? "they" : "you"} do, it appears here with the name of the person who
                    owns it.
                </p>
            ) : (
                <ul className="flex flex-col gap-3">
                    <StatRow count={open} label={open === 1 ? "Open request" : "Open requests"} detail={next ? `Next due ${next}` : "No completion dates set yet"} tone="warning" />
                    <StatRow count={done} label="Completed this month" detail={done === 0 ? "Nothing closed yet this month" : "Finished and on your record"} tone="success" />
                </ul>
            )}
            {!readOnly && (
                <div className="hidden flex-col gap-2 sm:flex">
                    <PrimaryButton onClick={onRaise} className="w-full">
                        Raise a request
                    </PrimaryButton>
                    <p className={cx(T.helper, "text-pretty text-tertiary")}>One named person will own it, and you can follow it here.</p>
                </div>
            )}
            {counts.total > 0 && (
                <TextLink to={`/${slug}/help/requests`} className="min-h-0">
                    Or see everything {readOnly ? "they have" : "you have"} asked for
                </TextLink>
            )}
        </Panel>
    );
};

const HelpHome = ({
    tickets,
    counts,
    topics,
    slug,
    onPickTopic,
    readOnly,
    clientName,
}: {
    tickets: Ticket[];
    counts: TicketCounts;
    topics: TicketTopic[];
    slug: string;
    onPickTopic: (t: TicketTopic) => void;
    /** Staff. The composer is not shown, because the server would refuse it. */
    readOnly: boolean;
    clientName?: string;
}) => {
    // "Raise a request" on the side card scrolls to and opens the first topic when there
    // is only one, and otherwise brings the tiles into view: the tiles ARE the form's first
    // step, so the button must not bypass them.
    const tilesRef = useRef<HTMLDivElement>(null);
    const raise = () => {
        if (topics.length === 1) {
            onPickTopic(topics[0]);
            return;
        }
        tilesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        tilesRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    };

    return (
        <div className="flex flex-col gap-6 sm:gap-10">
            {/* Heading: eyebrow, the hero title, a lede at most 680 wide. */}
            <header className="flex flex-col gap-2">
                <Eyebrow>Help Center</Eyebrow>
                <h1 className={cx("text-primary", T.title, "sm:text-[40px] sm:leading-[44px] sm:tracking-[-1px]")}>
                    {readOnly ? `${clientName || "This client"}'s requests` : "Ask for anything, and leave with a date."}
                </h1>
                <p className={cx("max-w-[680px] text-pretty text-secondary", T.body, "sm:text-[13px] sm:leading-[18px]")}>
                    {readOnly
                        ? "What this client has asked for, who owns each request, and where it is."
                        : "Every request is given an owner within a minute of you sending it, and you can watch it move without asking anyone."}
                </p>
            </header>

            {/* Two columns on desktop: the topics card fills, the side card is 344 wide. On a
                phone the side card comes first, because its button is the primary action
                and the mobile frame puts it first. */}
            {!readOnly && (
                <PrimaryButton onClick={raise} className="w-full sm:hidden">
                    Raise a request
                </PrimaryButton>
            )}

            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <div className="order-2 min-w-0 flex-1 sm:order-1" ref={tilesRef}>
                    {!readOnly && (
                        <Panel className="flex flex-col gap-4 p-4 sm:p-6">
                            <div className="flex flex-col gap-1">
                                <h2 className={cx(T.section, "text-primary")}>What do you need?</h2>
                                <p className={cx(T.helper, "text-pretty text-tertiary")}>Pick what it is about. Each one goes straight to the team that does it.</p>
                            </div>
                            <TopicTiles topics={topics} onPick={onPickTopic} />
                        </Panel>
                    )}
                    {readOnly && <ReferenceList />}
                </div>
                <div className="order-1 w-full sm:order-2 sm:w-[344px] sm:shrink-0">
                    <WhereThingsStand tickets={tickets} counts={counts} slug={slug} clientName={clientName} readOnly={readOnly} onRaise={raise} />
                </div>
            </div>

            {!readOnly && <ReferenceList />}
        </div>
    );
};

/**
 * The reference list, restyled to the Figma's timeline rows: a 24px numbered dot in
 * bg/tertiary with a hairline, label/field, body/helper. The note underneath is the honest
 * half of the page: no completion date is published to clients yet, and a page that
 * implied one would be doing exactly what this feature exists to stop.
 */
const ReferenceList = () => (
    <section className="flex flex-col gap-4">
        <h2 className={cx(T.section, "text-primary")}>How a request moves</h2>
        <Panel className="p-4 sm:p-6">
            <ol className="flex flex-col gap-4">
                {LIFECYCLE.map((step, i) => (
                    <li key={step.status} className="flex gap-3">
                        <span
                            aria-hidden="true"
                            className={cx("flex size-6 shrink-0 items-center justify-center rounded-full bg-tertiary text-tertiary ring-1 ring-secondary tabular-nums", T.caption)}
                        >
                            {i + 1}
                        </span>
                        <div className="min-w-0">
                            <p className={cx(T.label, "text-primary")}>{step.label}</p>
                            <p className={cx(T.helper, "mt-0.5 text-pretty text-tertiary")}>{step.detail}</p>
                        </div>
                    </li>
                ))}
            </ol>
        </Panel>
        <p className={cx(T.helper, "max-w-[68ch] text-pretty text-tertiary")}>
            About completion dates: we are not publishing them yet, so you will see who owns your request but no date beside it. We would rather show you
            nothing than a date we guessed. When we start setting them, the date will appear on every request here on its own.
        </p>
    </section>
);

/* ── The composer ────────────────────────────────────────────────────────── */

/**
 * Raising a request.
 *
 * Everything we already know is stated rather than asked for: the client the request is
 * for comes from the dashboard row, and the address it is raised under comes from the proof
 * that opened this page. A client retyping either is a chance for the two to disagree, and
 * the server would ignore what they typed anyway - it reads both from the verified caller.
 */
const Composer = ({
    topic,
    proof,
    clientName,
    onCancel,
    onCreated,
}: {
    topic: TicketTopic;
    proof: CallerProof;
    clientName: string;
    onCancel: () => void;
    onCreated: (reference: string) => void;
}) => {
    const [title, setTitle] = useState("");
    const [detail, setDetail] = useState("");
    const [property, setProperty] = useState("");
    const [neededBy, setNeededBy] = useState("");
    const [images, setImages] = useState<TicketImage[]>([]);
    const [imageNotes, setImageNotes] = useState<string[]>([]);
    const [preparing, setPreparing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [touched, setTouched] = useState(false);

    const titleRef = useRef<HTMLInputElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // Opening the composer moves focus into it. Without this a keyboard or screen-reader
    // user is left at the topic button that has just been replaced, with no announcement
    // that the page changed under them.
    useEffect(() => {
        titleRef.current?.focus();
    }, []);

    const titleError = touched && title.trim().length < 3 ? "Give your request a short title." : "";
    const detailError = touched && detail.trim().length < 10 ? "Tell us a little more so the right person can pick this up." : "";
    const canSubmit = title.trim().length >= 3 && detail.trim().length >= 10 && !busy && !preparing;

    const onPickFiles = async (files: FileList | null) => {
        if (!files?.length) return;
        setPreparing(true);
        const { images: ready, rejected } = await prepareImages([...files]);
        setImages((prev) => [...prev, ...ready].slice(0, MAX_IMAGES));
        setImageNotes(rejected);
        setPreparing(false);
        if (fileRef.current) fileRef.current.value = "";
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setTouched(true);
        if (!canSubmit) return;
        setBusy(true);
        setError("");
        try {
            const res = await createTicket(proof, {
                topic: topic.key,
                title: title.trim(),
                detail: detail.trim(),
                property,
                needed_by: neededBy || undefined,
                images,
            });
            onCreated(res.ticket.reference);
        } catch (err) {
            setError(err instanceof HelpApiError ? err.message : "We could not send that just then. Nothing was lost - try again.");
            setBusy(false);
        }
    };

    return (
        // The Figma's form column: 560 wide, centred, 24 between blocks; on a phone it is
        // the full width with 16 gutters. The heading has an eyebrow (the topic), the title
        // in display/title and a lede in body/input.
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
            <button
                type="button"
                onClick={onCancel}
                className={cx("-ml-1 inline-flex min-h-11 w-max items-center gap-1.5 rounded px-1 text-fg-brand-primary hover:underline", T.body, "sm:text-[13px] sm:leading-[18px]", FOCUS)}
            >
                <ArrowNarrowLeft className="size-4" aria-hidden="true" />
                Back to the help centre
            </button>

            <header className="flex flex-col gap-2">
                <Eyebrow>{topic.label}</Eyebrow>
                <h1 className={cx(T.title, "text-primary")}>Tell us what you need</h1>
                <p className={cx(T.body, "text-pretty text-secondary")}>
                    Raised for {clientName || "your account"} by {proof.email}. One named person will pick this up.
                </p>
            </header>

            <form onSubmit={submit} noValidate className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <FieldLabel htmlFor="hc-title">What do you need?</FieldLabel>
                    <input
                        id="hc-title"
                        ref={titleRef}
                        value={title}
                        onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
                        placeholder="Change the hero photo on the home page"
                        aria-invalid={!!titleError}
                        aria-describedby={titleError ? "hc-title-error" : "hc-title-hint"}
                        className={fieldClass(!!titleError)}
                    />
                    {titleError ? (
                        <p id="hc-title-error" className={cx(T.helper, "text-red-700")} role="alert">
                            {titleError}
                        </p>
                    ) : (
                        <p id="hc-title-hint" className={cx(T.helper, "text-tertiary")}>
                            One line that says what is wrong or what you want. It becomes the title the team sees.
                        </p>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <FieldLabel htmlFor="hc-detail">The detail</FieldLabel>
                    <textarea
                        id="hc-detail"
                        value={detail}
                        onChange={(e) => setDetail(e.target.value.slice(0, MAX_DETAIL))}
                        rows={6}
                        placeholder="Anything that helps us get it right first time: which page, which photo, what it should say."
                        aria-invalid={!!detailError}
                        aria-describedby={detailError ? "hc-detail-error" : "hc-detail-hint"}
                        className={cx(fieldClass(!!detailError), "resize-y")}
                    />
                    {detailError ? (
                        <p id="hc-detail-error" className={cx(T.helper, "text-red-700")} role="alert">
                            {detailError}
                        </p>
                    ) : (
                        <p id="hc-detail-hint" className={cx(T.helper, "text-tertiary")}>
                            Your words go to the person doing the work exactly as you write them.
                        </p>
                    )}
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                        <FieldLabel htmlFor="hc-property" optional>
                            Which property?
                        </FieldLabel>
                        <input
                            id="hc-property"
                            value={property}
                            onChange={(e) => setProperty(e.target.value.slice(0, MAX_PROPERTY))}
                            placeholder="Leave blank if it covers all of them"
                            className={fieldClass()}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <FieldLabel htmlFor="hc-needed" optional>
                            Needed by
                        </FieldLabel>
                        <input
                            id="hc-needed"
                            type="date"
                            value={neededBy}
                            min={todayIsoDay()}
                            onChange={(e) => setNeededBy(e.target.value)}
                            aria-describedby="hc-needed-hint"
                            className={fieldClass()}
                        />
                        {/* Said out loud, because the difference between what a client asks
                            for and what we commit to is the whole subject of this page. */}
                        <p id="hc-needed-hint" className={cx(T.helper, "text-tertiary")}>
                            A date you need it by. We will tell you what we can commit to.
                        </p>
                    </div>
                </div>

                {/* Screenshots, per the Figma's Field/Upload: a dashed drop zone in bg/secondary
                    with the file input as the whole target, and thumbnails as chips beneath. */}
                <div className="flex flex-col gap-2">
                    <FieldLabel htmlFor="hc-images" optional>
                        Screenshots or photos
                    </FieldLabel>
                    <label
                        htmlFor="hc-images"
                        className={cx(
                            "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-primary bg-secondary px-4 py-5 text-center transition duration-100 ease-linear hover:bg-tertiary motion-reduce:transition-none",
                        )}
                    >
                        <span className={cx(T.label, "text-primary")}>{images.length ? "Add another screenshot" : "Add screenshots"}</span>
                        <span className={cx(T.helper, "text-tertiary")}>
                            Up to {MAX_IMAGES} images. They are shrunk in your browser before they are sent, so a phone photo is fine.
                        </span>
                    </label>
                    <input
                        id="hc-images"
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => void onPickFiles(e.target.files)}
                        className="sr-only"
                    />

                    {preparing && (
                        <p className={cx(T.helper, "text-tertiary")} role="status">
                            Preparing images...
                        </p>
                    )}

                    {images.length > 0 && (
                        <ul className="flex flex-wrap gap-2">
                            {images.map((img, i) => (
                                <li key={`${img.name}-${i}`} className={cx("inline-flex items-center gap-1.5 rounded-lg bg-secondary py-1 pr-1 pl-2.5 text-secondary ring-1 ring-secondary", T.helper)}>
                                    <Image01 className="size-3.5 shrink-0 text-tertiary" aria-hidden="true" />
                                    <span className="max-w-[18ch] truncate">{img.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                                        aria-label={`Remove ${img.name}`}
                                        className={cx("flex size-6 items-center justify-center rounded-md text-tertiary transition duration-100 ease-linear hover:bg-primary_hover hover:text-primary motion-reduce:transition-none", FOCUS)}
                                    >
                                        <XClose className="size-3.5" aria-hidden="true" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    {imageNotes.length > 0 && (
                        <ul className="flex flex-col gap-1" role="status">
                            {imageNotes.map((note) => (
                                <li key={note} className={cx(T.helper, "text-red-700")}>
                                    {note}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {error && <ErrorNote message={error} />}

                {/* Actions right-aligned, the quieter one first, the trust line under them
                    right-aligned too - the Figma's "Actions" block. On a phone the primary
                    goes full width. */}
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <SecondaryButton onClick={onCancel} disabled={busy} className="w-full sm:w-auto">
                            Cancel
                        </SecondaryButton>
                        <PrimaryButton type="submit" disabled={!canSubmit} className="w-full sm:w-auto sm:min-w-44">
                            {busy ? "Sending..." : "Send request"}
                        </PrimaryButton>
                    </div>
                    <p className={cx(T.helper, "text-pretty text-tertiary sm:text-right")}>
                        You will get a reference here straight away, and a named person picks it up from there.
                    </p>
                </div>
            </form>
        </div>
    );
};

/** What a client sees the moment a request lands. The reference is the thing to remember. */
const CreatedNote = ({ reference, slug, onRaiseAnother }: { reference: string; slug: string; onRaiseAnother: () => void }) => {
    const headingRef = useRef<HTMLHeadingElement>(null);
    // Focus moves to the confirmation so the outcome is announced. Submitting a form and
    // being left silently at the top of a replaced page is the commonest way a screen
    // reader user is left unsure whether anything happened.
    useEffect(() => {
        headingRef.current?.focus();
    }, []);

    return (
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
            <Panel className="p-6 text-center sm:p-8">
                <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-green-50 text-green-800">
                    <CheckCircle className="size-6" aria-hidden="true" />
                </span>
                <h1 ref={headingRef} tabIndex={-1} className={cx(T.title, "mt-4 text-primary outline-none")}>
                    Request received
                </h1>
                <p className={cx(T.body, "mx-auto mt-2 max-w-[46ch] text-pretty text-secondary")}>
                    Your reference is <MonoRef className="text-[16px] leading-6 text-primary">{reference}</MonoRef>. We are assigning an owner now, and you can
                    follow it here at any time.
                </p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                    <PrimaryButton as="link" to={`/${slug}/help/requests/${reference}`}>
                        Follow this request
                    </PrimaryButton>
                    <SecondaryButton onClick={onRaiseAnother}>Raise another</SecondaryButton>
                </div>
            </Panel>
        </div>
    );
};

/* ── The route component ─────────────────────────────────────────────────── */

export type HelpView = "home" | "list" | "detail";

export const HelpCenterScreen = ({ view }: { view: HelpView }) => {
    const { clientSlug = "", reference = "" } = useParams<{ clientSlug: string; reference: string }>();
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
    const [filter, setFilter] = useState<RequestFilter>("all");
    const [composing, setComposing] = useState<TicketTopic | null>(null);
    const [created, setCreated] = useState("");

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
                setProof(caller);
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
    }, [slug]);

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
     * All three help routes render THIS component, and react-router builds each match with
     * `createElement(RenderedRoute, { match, routeContext, children })` and no `key` (see
     * RenderedRoute in react-router's chunk-4ZMWKKQ3.mjs). Same type, same position, no key,
     * so React keeps the instance and only swaps the `view` prop - moving between the three
     * screens does not remount anything. That is the point: the list and the topics are
     * fetched once for the section, not once per screen. The cost is that anything meant to
     * be momentary survives a navigation too. Without this, a client who raises a request,
     * opens it, then presses back lands on the help home and is told "Request received
     * REQ-nnnn" for a request they raised several screens ago, which reads as a second one
     * having been sent.
     *
     * `composing` is deliberately NOT cleared here. A half-typed request surviving a look at
     * the list is a draft being kept, not a stale message.
     */
    useEffect(() => {
        if (view !== "home") setCreated("");
    }, [view]);

    if (!callerResolved) return null;
    if (!proof) {
        return (
            <HelpGate
                clientRow={clientRow}
                notice={gateNotice}
            />
        );
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
    const counts = tickets.length > 0 || serverCounts === null ? countsFor(tickets) : serverCounts;

    const body = () => {
        if (loading && tickets.length === 0 && topics.length === 0) return <HelpSpinner label="Loading your requests" />;

        if (view === "detail") {
            return (
                <HelpRequestDetail proof={proof} reference={reference} slug={slug} topics={topics} onTicketChanged={() => void load(proof)} />
            );
        }

        if (view === "list") {
            return <HelpRequestsScreen tickets={tickets} counts={counts} topics={topics} slug={slug} filter={filter} onFilterChange={setFilter} readOnly={isStaff} />;
        }

        if (created) {
            return (
                <CreatedNote
                    reference={created}
                    slug={slug}
                    onRaiseAnother={() => {
                        setCreated("");
                        setComposing(null);
                    }}
                />
            );
        }

        if (composing && !isStaff) {
            return (
                <Composer
                    topic={composing}
                    proof={proof}
                    clientName={clientName}
                    onCancel={() => setComposing(null)}
                    onCreated={(ref) => {
                        setCreated(ref);
                        setComposing(null);
                        void load(proof);
                    }}
                />
            );
        }

        return (
            <HelpHome
                tickets={tickets}
                counts={counts}
                topics={topics}
                slug={slug}
                onPickTopic={setComposing}
                readOnly={isStaff}
                clientName={viewer?.clientName || clientName}
            />
        );
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
