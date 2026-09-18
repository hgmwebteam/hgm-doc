/**
 * The Website Setup Guide section body.
 *
 * Two cards. The first asks every client for a Netlify account — required, because Netlify
 * is where we host whatever we build for them. The second offers the AI-built direct booking
 * website: a short pitch and a yes/no. A yes swaps the pitch for the list of accounts the
 * site needs them to own (Supabase, Resend, Stripe, PMS, registrar, Cloudflare) plus the
 * web address and notes; a no folds it down to one line they can reopen.
 *
 * Who can type: the client always (their answers save through the website-setup function),
 * the team only in edit mode (saved with the ordinary Save button). A team member viewing a
 * locked dashboard sees the client's answers as read-only prose, like every other section.
 *
 * Passwords and API keys are not asked for here, with one exception: the Netlify login
 * (email + password), which the team wanted collected on the dashboard during the onboarding
 * call. The row is readable with the public anon key, so every other login goes through the
 * client's own password-gated owner guide instead.
 */
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen01, CheckCircle, Edit05, Eye, EyeOff, LinkExternal01, Lock01, XClose } from "@untitledui-pro/icons/line";
import { Badge, BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { ProgressBar } from "@/components/base/progress-indicators/progress-indicators";
import { readSopPage } from "@/lib/db-sync";
import { editInput } from "@/pages/client/dashboard/dashboard-chrome";
import { filled } from "@/pages/client/dashboard/dashboard-model";
import {
    NETLIFY_SIGNUP_URL,
    OWNER_GUIDE_TEMPLATE_URL,
    SETUP_ACCOUNTS,
    type WebsiteSetup,
    type WebsiteSetupAccountId,
    accountState,
    netlifyDone,
    websiteSetupProgress,
} from "@/pages/client/dashboard/website-setup";
import { ImageMagnifier } from "@/pages/client/owner-guide-screen";
import { cx } from "@/utils/cx";

export type WebsiteSetupSaveState = "idle" | "saving" | "saved" | "error";

/** A labelled value: an input when the viewer may type, prose when they may not. */
const Field = ({
    label,
    hint,
    value,
    placeholder,
    rows,
    editable,
    onChange,
    className,
}: {
    label: string;
    hint?: string;
    value: string;
    placeholder?: string;
    rows?: number;
    editable: boolean;
    onChange: (v: string) => void;
    className?: string;
}) => (
    <div className={className}>
        <p className="text-sm font-medium text-secondary">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-quaternary">{hint}</p>}
        {!editable ? (
            <p className={cx("mt-1 text-md whitespace-pre-wrap", filled(value) ? "text-tertiary" : "text-quaternary italic")}>
                {filled(value) ? value : "Not filled in"}
            </p>
        ) : rows ? (
            <textarea
                rows={rows}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={cx(editInput(), "mt-1.5 resize-y")}
            />
        ) : (
            <input type="text" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className={cx(editInput(), "mt-1.5")} />
        )}
    </div>
);

const Card = ({ title, badge, children }: { title: string; badge: ReactNode; children: ReactNode }) => (
    <section className="rounded-2xl bg-primary p-5 shadow-xs ring-1 ring-secondary md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <h3 className="text-lg font-semibold text-primary">{title}</h3>
            {badge}
        </div>
        {children}
    </section>
);

const DoneBadge = ({ done, todo = "To do" }: { done: boolean; todo?: string }) =>
    done ? (
        <BadgeWithDot color="success" size="sm" type="pill-color">
            Done
        </BadgeWithDot>
    ) : (
        <BadgeWithDot color="brand" size="sm" type="pill-color">
            {todo}
        </BadgeWithDot>
    );

/* ── The Netlify step-by-step pop-up ──
   The owner guide's "Netlify Hosting" step, read live from the master template row so the
   team keeps editing it in one place, shown read-only with the same screenshots and magnifier.
   Fetched once per page load, on first open (the row carries every step's images). */
type GuideInstruction = { id?: string; text: string; image?: string; lensPos?: { x: number; y: number } };
type GuideStep = { title?: string; description?: string; benefits?: string[]; instructions?: (GuideInstruction | string)[] };

let netlifyStepCache: Promise<GuideStep | null> | undefined;
const loadNetlifyStep = () =>
    (netlifyStepCache ??= readSopPage("owner-guide-content")
        .then((row) => {
            const steps = Array.isArray(row?.data) ? (row.data as GuideStep[]) : [];
            return steps.find((s) => /netlify/i.test(s.title ?? "")) ?? null;
        })
        .catch((err) => {
            netlifyStepCache = undefined; // let the next open retry
            throw err;
        }));

const NetlifyGuideModal = ({
    onClose,
    setup,
    editable,
    onChange,
}: {
    onClose: () => void;
    setup: WebsiteSetup;
    editable: boolean;
    onChange: (patch: Partial<WebsiteSetup>) => void;
}) => {
    // undefined = loading, null = failed or no such step
    const [step, setStep] = useState<GuideStep | null | undefined>(undefined);
    useEffect(() => {
        let cancelled = false;
        loadNetlifyStep()
            .then((s) => !cancelled && setStep(s))
            .catch(() => !cancelled && setStep(null));
        return () => {
            cancelled = true;
        };
    }, []);
    const instructions = (step?.instructions ?? []).map((i) => (typeof i === "string" ? { text: i } : i));

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70 p-4 backdrop-blur-[6px] duration-300 ease-out animate-in fade-in sm:p-8"
            // mousedown, not click: the opening press resolves before the native click lands, so a
            // click handler here would catch that same click on the fresh backdrop and close at once.
            onMouseDown={(e) => e.target === e.currentTarget && onClose()}
            role="dialog"
            aria-modal="true"
            aria-label="Netlify step-by-step guide"
        >
            <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-primary shadow-2xl ring-1 ring-secondary">
                <div className="flex shrink-0 items-center justify-between gap-4 border-b border-secondary px-5 py-4">
                    <div className="min-w-0">
                        <h2 className="text-md font-semibold text-primary">Setting up your Netlify account</h2>
                        <p className="mt-0.5 text-sm text-tertiary">Follow along — each screenshot shows where to click.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-secondary hover:text-fg-secondary"
                    >
                        <XClose className="size-5" aria-hidden="true" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                    {step === undefined ? (
                        <p className="text-sm text-tertiary" role="status">
                            Loading the guide…
                        </p>
                    ) : step === null ? (
                        <p className="text-sm text-tertiary" role="status">
                            Couldn't load the guide right now. Open Netlify and follow the three steps on the card — they cover it.
                        </p>
                    ) : (
                        <>
                            {filled(step.description) && <p className="text-md leading-relaxed text-secondary">{step.description}</p>}
                            {!!step.benefits?.length && (
                                <ul className="mt-4 grid list-none gap-2 p-0">
                                    {step.benefits.map((b) => (
                                        <li key={b} className="flex items-start gap-2 text-sm font-medium text-primary">
                                            <CheckCircle className="mt-0.5 size-4 shrink-0 text-fg-success-secondary" aria-hidden="true" />
                                            {b}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {instructions.length > 0 && (
                                <>
                                    <h3 className="mt-6 mb-3 text-[11px] font-semibold tracking-[0.1em] text-quaternary uppercase">
                                        Step-by-step instructions
                                    </h3>
                                    <ol className="grid list-none gap-3 p-0">
                                        {instructions.map((ins, i) => (
                                            <li key={ins.id ?? i} className="rounded-xl border border-secondary bg-primary px-4 py-3.5">
                                                <div className="flex items-start gap-3.5">
                                                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-secondary text-sm font-bold text-brand-secondary tabular-nums">
                                                        {i + 1}
                                                    </span>
                                                    <p className="flex-1 pt-1 text-md leading-relaxed text-secondary">{ins.text}</p>
                                                </div>
                                                {ins.image && (
                                                    <div className="mt-3">
                                                        <ImageMagnifier src={ins.image} editing={false} lensPos={ins.lensPos} />
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ol>
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* Done? The same two answers as the card, so the client can fill them in without leaving the guide. */}
                <div className="shrink-0 border-t border-secondary bg-secondary px-5 py-4">
                    <p className="mb-3 text-sm font-semibold text-primary">All set? Save the login you just created.</p>
                    <NetlifyLogin setup={setup} editable={editable} onChange={onChange} />
                </div>
            </div>
        </div>,
        document.body,
    );
};

/**
 * The Netlify login, saved as a pair. A draft is typed and committed with Save Login (which
 * autosaves for a client, or goes with the dashboard's Save for the team); once saved the
 * pair reads back as prose with an Edit button, and Clear empties both. Same idiom as the
 * owner guide's credential form, so a client who has seen one recognises the other.
 */
const NetlifyLogin = ({ setup, editable, onChange }: { setup: WebsiteSetup; editable: boolean; onChange: (patch: Partial<WebsiteSetup>) => void }) => {
    const saved = netlifyDone(setup);
    const [editing, setEditing] = useState(!saved);
    const [email, setEmail] = useState(setup.netlify_email);
    const [password, setPassword] = useState(setup.netlify_password);
    const [show, setShow] = useState(false);
    // Another view of the same pair (card ↔ pop-up) saved or cleared: follow it.
    useEffect(() => {
        setEmail(setup.netlify_email);
        setPassword(setup.netlify_password);
        setEditing(!netlifyDone(setup));
    }, [setup.netlify_email, setup.netlify_password]);

    const label = "text-sm font-medium text-secondary";

    if (!editable || !editing) {
        return (
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                <div>
                    <p className={label}>Netlify login email</p>
                    <p className={cx("mt-1 text-md", filled(setup.netlify_email) ? "text-tertiary" : "text-quaternary italic")}>
                        {filled(setup.netlify_email) ? setup.netlify_email : "Not filled in"}
                    </p>
                </div>
                <div>
                    <p className={label}>Netlify password</p>
                    <p className={cx("mt-1 text-md", filled(setup.netlify_password) ? "text-tertiary" : "text-quaternary italic")}>
                        {filled(setup.netlify_password) ? "••••••••" : "Not filled in"}
                    </p>
                </div>
                {editable && (
                    <Button size="sm" color="secondary" iconLeading={Edit05} onClick={() => setEditing(true)}>
                        Edit
                    </Button>
                )}
            </div>
        );
    }

    const canSave = filled(email) && filled(password);
    return (
        <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
                <div>
                    <p className={label}>Netlify login email</p>
                    <input
                        type="email"
                        autoComplete="off"
                        placeholder="you@yourbusiness.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={cx(editInput(), "mt-1.5")}
                    />
                </div>
                <div>
                    <p className={label}>Netlify password</p>
                    <div className="relative mt-1.5">
                        <input
                            type={show ? "text" : "password"}
                            autoComplete="new-password"
                            placeholder="The password you chose"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={cx(editInput(), "pr-11")}
                        />
                        <button
                            type="button"
                            onClick={() => setShow((v) => !v)}
                            aria-label={show ? "Hide password" : "Show password"}
                            aria-pressed={show}
                            className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-fg-quaternary transition duration-100 ease-linear hover:bg-secondary hover:text-fg-secondary"
                        >
                            {show ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                        </button>
                    </div>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    size="sm"
                    isDisabled={!canSave}
                    onClick={() => {
                        onChange({ netlify_email: email.trim(), netlify_password: password });
                        setEditing(false);
                        setShow(false);
                    }}
                >
                    Save login
                </Button>
                <Button
                    size="sm"
                    color="secondary-destructive"
                    isDisabled={!filled(email) && !filled(password)}
                    onClick={() => {
                        setEmail("");
                        setPassword("");
                        if (saved) onChange({ netlify_email: "", netlify_password: "" });
                    }}
                >
                    Clear
                </Button>
                {saved && (
                    <Button size="sm" color="link-gray" onClick={() => setEditing(false)}>
                        Cancel
                    </Button>
                )}
            </div>
        </div>
    );
};

export const WebsiteSetupSection = ({
    setup,
    onChange,
    editable,
    isTeam,
    ownerGuideSlug,
    saveState,
    saveError,
}: {
    setup: WebsiteSetup;
    onChange: (patch: Partial<WebsiteSetup>) => void;
    /** The viewer may type: a client always, the team only in edit mode. */
    editable: boolean;
    isTeam: boolean;
    /** This client's own owner guide, once the team has created it. Empty ⇒ not yet. */
    ownerGuideSlug: string;
    /** The client's save-through-the-function state. Ignored for the team. */
    saveState: WebsiteSetupSaveState;
    saveError?: string;
}) => {
    const progress = websiteSetupProgress(setup);
    const setAccount = (id: WebsiteSetupAccountId, patch: Partial<{ value: string; done: boolean }>) =>
        onChange({ accounts: { ...setup.accounts, [id]: { ...accountState(setup, id), ...patch } } });

    const ownGuideUrl = ownerGuideSlug ? `/owner-guide/${ownerGuideSlug}` : "";
    const [guideOpen, setGuideOpen] = useState(false);

    return (
        <div className="mt-3 flex flex-col gap-6">
            <p className="max-w-prose text-md text-tertiary">
                A few accounts need to be in your own name before we can put your website live. Work through this page in your own time — every answer saves as
                you go.
            </p>

            {/* Progress — derived, so it always agrees with the cards below. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-48 flex-1">
                    <ProgressBar value={Math.round((progress.done / progress.total) * 100)} />
                </div>
                <span className="text-sm font-semibold text-secondary tabular-nums">
                    {progress.done} of {progress.total} done
                </span>
            </div>

            {/* ── 1. Netlify — required of every client ── */}
            <Card
                title="Netlify hosting account"
                badge={
                    <div className="flex items-center gap-2">
                        <Badge color="warning" size="sm" type="pill-color">
                            Required
                        </Badge>
                        <DoneBadge done={netlifyDone(setup)} />
                    </div>
                }
            >
                <p className="mt-2 max-w-prose text-sm text-tertiary">
                    Netlify is where your website lives on the internet. The account has to be yours — registered under your own business email — so you own
                    your site outright and we only ever work inside it.
                </p>
                <ol className="mt-4 grid list-none gap-2.5 p-0">
                    {[
                        "Open Netlify and choose Sign up with email — not GitHub, GitLab or Bitbucket.",
                        "Use your business email address and a password of your own. You'll need Netlify's Pro plan.",
                        "Come back here and enter the email and password you used.",
                    ].map((step, i) => (
                        <li key={step} className="flex gap-3 text-sm text-secondary">
                            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-bold text-quaternary tabular-nums">
                                {i + 1}
                            </span>
                            <span className="pt-0.5">{step}</span>
                        </li>
                    ))}
                </ol>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button size="sm" color="secondary" href={NETLIFY_SIGNUP_URL} target="_blank" rel="noopener noreferrer" iconTrailing={LinkExternal01}>
                        Open Netlify
                    </Button>
                    {/* The owner guide's Netlify step in a pop-up — screenshots for every click, so an
                        AM can walk the client through it on the onboarding call without leaving the page. */}
                    <Button size="sm" color="link-color" iconTrailing={BookOpen01} onClick={() => setGuideOpen(true)}>
                        Step-by-step guide
                    </Button>
                </div>
                {guideOpen && <NetlifyGuideModal onClose={() => setGuideOpen(false)} setup={setup} editable={editable} onChange={onChange} />}
                <div className="mt-5 border-t border-secondary pt-5">
                    <NetlifyLogin setup={setup} editable={editable} onChange={onChange} />
                </div>
            </Card>

            {/* ── 2. The AI website — opt-in ── */}
            <Card
                title="AI-built direct booking website"
                badge={
                    setup.ai_website === "yes" ? (
                        <DoneBadge
                            done={progress.complete}
                            todo={`${SETUP_ACCOUNTS.filter((a) => accountState(setup, a.id).done).length}/${SETUP_ACCOUNTS.length} accounts`}
                        />
                    ) : setup.ai_website === "no" ? (
                        <Badge color="gray" size="sm" type="pill-color">
                            Not right now
                        </Badge>
                    ) : (
                        <Badge color="gray" size="sm" type="pill-color">
                            Optional
                        </Badge>
                    )
                }
            >
                {setup.ai_website !== "yes" && (
                    <>
                        <p className="mt-2 max-w-prose text-sm text-tertiary">
                            Your own booking website, built by our web team with AI and connected to your property management system. Guests book and pay you
                            directly, with no platform fee in between.
                        </p>
                        <ul className="mt-4 grid list-none gap-2 p-0 sm:grid-cols-2">
                            {[
                                "Live availability and rates from your PMS",
                                "Card payments straight to your Stripe account",
                                "Booking confirmations sent from your own domain",
                                "Every account stays in your name — no lock-in",
                            ].map((line) => (
                                <li key={line} className="flex items-start gap-2 text-sm text-secondary">
                                    <CheckCircle className="mt-0.5 size-4 shrink-0 text-fg-brand-secondary" aria-hidden="true" />
                                    {line}
                                </li>
                            ))}
                        </ul>
                        {/* The template is team-gated, so the preview link is only ever shown to the team. */}
                        {isTeam && (
                            <div className="mt-4">
                                <Button
                                    size="sm"
                                    color="link-color"
                                    href={OWNER_GUIDE_TEMPLATE_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    iconTrailing={LinkExternal01}
                                >
                                    Open the master owner guide (team)
                                </Button>
                            </div>
                        )}
                    </>
                )}

                {setup.ai_website === "" && (
                    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-secondary pt-5">
                        <p className="mr-auto text-sm font-medium text-secondary">Would you like us to build one for you?</p>
                        <Button size="sm" color="secondary" isDisabled={!editable} onClick={() => onChange({ ai_website: "no" })}>
                            Not right now
                        </Button>
                        <Button size="sm" isDisabled={!editable} onClick={() => onChange({ ai_website: "yes" })}>
                            Yes, I'd like one
                        </Button>
                    </div>
                )}

                {setup.ai_website === "no" && (
                    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-secondary pt-5">
                        <p className="mr-auto text-sm text-tertiary">
                            No problem — nothing else is needed from you on this page. You can change your mind any time.
                        </p>
                        <Button size="sm" color="secondary" isDisabled={!editable} onClick={() => onChange({ ai_website: "yes" })}>
                            Actually, I'd like one
                        </Button>
                    </div>
                )}

                {setup.ai_website === "yes" && (
                    <>
                        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                            <p className="max-w-prose text-sm text-tertiary">
                                Great. Your site runs on a handful of services, and each one needs an account in your name so you own it. Create each account
                                below, enter the email you used, and tick it off. Existing accounts are fine — just tell us which.
                            </p>
                            {editable && (
                                <button
                                    type="button"
                                    onClick={() => onChange({ ai_website: "no" })}
                                    className="shrink-0 text-xs font-semibold text-tertiary transition duration-100 ease-linear hover:text-primary"
                                >
                                    Changed your mind?
                                </button>
                            )}
                        </div>

                        <ol className="mt-5 grid list-none gap-0 p-0">
                            {SETUP_ACCOUNTS.map((acct, i) => {
                                const state = accountState(setup, acct.id);
                                return (
                                    <li
                                        key={acct.id}
                                        className="grid gap-4 border-t border-secondary py-5 first:border-t-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
                                    >
                                        <div className="flex gap-3">
                                            <span
                                                className={cx(
                                                    "grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums",
                                                    state.done ? "bg-brand-solid text-white" : "bg-secondary text-quaternary",
                                                )}
                                            >
                                                {state.done ? <CheckCircle className="size-4" aria-hidden="true" /> : i + 1}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-primary">{acct.name}</p>
                                                <p className="mt-1 text-sm text-tertiary">{acct.what}</p>
                                                {acct.signupUrl && (
                                                    <div className="mt-2.5">
                                                        <Button
                                                            size="sm"
                                                            color="link-color"
                                                            href={acct.signupUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            iconTrailing={LinkExternal01}
                                                        >
                                                            {acct.signupLabel}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-3 md:pl-2">
                                            <Field
                                                label={acct.valueLabel}
                                                value={state.value}
                                                placeholder={acct.valuePlaceholder}
                                                editable={editable}
                                                onChange={(v) => setAccount(acct.id, { value: v })}
                                            />
                                            <Checkbox
                                                size="sm"
                                                isSelected={state.done}
                                                isDisabled={!editable}
                                                onChange={(v) => setAccount(acct.id, { done: v })}
                                                label={`${acct.name} account is ready`}
                                            />
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>

                        <div className="grid gap-4 border-t border-secondary pt-5">
                            <Field
                                label="Web address for the site"
                                hint="The domain you'd like guests to type — one you already own, or one you'd like us to help register."
                                value={setup.domain}
                                placeholder="www.yourproperty.com"
                                editable={editable}
                                onChange={(v) => onChange({ domain: v })}
                            />
                            <Field
                                label="Anything else the web team should know"
                                hint="Existing website to replace, several properties or brands, a second Stripe account, a launch date you're working to."
                                value={setup.notes}
                                rows={3}
                                editable={editable}
                                onChange={(v) => onChange({ notes: v })}
                            />
                        </div>

                        {/* Hand-over of the logins themselves — in the gated guide, never here. */}
                        <div className="mt-5 flex flex-col gap-3 rounded-xl bg-secondary p-4 sm:flex-row sm:items-center">
                            <Lock01 className="size-5 shrink-0 text-fg-quaternary" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-secondary">Never type a password on this page.</p>
                                <p className="mt-0.5 text-sm text-tertiary">
                                    {ownGuideUrl
                                        ? "The logins themselves are handed over in your private Setup Guide, which only opens with the password your Account Manager gave you."
                                        : isTeam
                                          ? "No owner guide exists for this client yet — create one from the master template so they have somewhere to hand over the logins."
                                          : "Once your accounts are ready, your Account Manager will send you a private, password-protected link for handing over the logins."}
                                </p>
                            </div>
                            {ownGuideUrl ? (
                                <Button size="sm" color="secondary" href={ownGuideUrl} iconTrailing={LinkExternal01}>
                                    Open my Setup Guide
                                </Button>
                            ) : (
                                isTeam && (
                                    <Button
                                        size="sm"
                                        color="secondary"
                                        href={`${OWNER_GUIDE_TEMPLATE_URL}?create=1`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        iconTrailing={LinkExternal01}
                                    >
                                        Create their guide
                                    </Button>
                                )
                            )}
                        </div>
                    </>
                )}
            </Card>

            {/* Save state — only the client saves from here; the team saves the whole dashboard. */}
            {!isTeam && saveState !== "idle" && (
                <p className={cx("text-xs", saveState === "error" ? "text-error-primary" : "text-quaternary")} role="status">
                    {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : `Couldn't save — ${saveError ?? "please try again."}`}
                </p>
            )}
            {isTeam && editable && (
                <p className="text-xs text-quaternary">Answers here are saved with the dashboard's Save button, like every other section.</p>
            )}
        </div>
    );
};
