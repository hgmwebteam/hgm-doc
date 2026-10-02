import { type ReactNode, type Ref, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { supabase } from "@/lib/supabase";
import { GoogleIcon, TeamGate } from "@/pages/team/dashboard-screen";
import { type CheckSession, TEAM_DOMAIN } from "@/pages/team/dictionary/check/use-check-session";
import { DictionaryLayout } from "@/pages/team/dictionary/dictionary-layout";

/**
 * The pieces the check, results and flashcard pages share: the page frame, the notice card,
 * the sign-in card, and what to show while a session isn't ready.
 *
 * Copy rules for all three pages (from the brief): call it "the check", never quiz, test or
 * exam; sentence case, warm and plain, no exclamation marks; never a tier label, an item
 * number, or "you got question 7 wrong". And no entrance animation: the check is a form, and
 * a form that moves while you're answering it is hostile.
 */

/** The dictionary's Docs frame behind TeamGate, with a way back for phones, where the Docs menu is hidden. */
export const CheckPage = ({ children, scrollRef }: { children: ReactNode; scrollRef?: Ref<HTMLDivElement> }) => (
    <TeamGate>
        <DictionaryLayout scrollRef={scrollRef}>
            <div className="mx-auto w-full max-w-3xl px-4 pt-4 pb-12 sm:px-8 sm:pt-6">
                <Button href="/dictionary" color="link-gray" size="sm" iconLeading={ArrowLeft}>
                    Dictionary
                </Button>
                <div className="mt-4">{children}</div>
            </div>
        </DictionaryLayout>
    </TeamGate>
);

/**
 * The page's h1. It takes focus when it appears: these pages are reached by buttons that
 * vanish with the page they were on (Finish the check → results), and without this a keyboard
 * or screen-reader user would be left on <body>.
 */
export const PageTitle = ({ children }: { children: ReactNode }) => {
    const ref = useRef<HTMLHeadingElement>(null);
    useEffect(() => ref.current?.focus({ preventScroll: true }), []);
    return (
        <h1 ref={ref} tabIndex={-1} className="text-display-xs font-semibold text-pretty text-primary outline-none md:text-display-sm">
            {children}
        </h1>
    );
};

/** The dictionary's plain card for a message: a title, a line or two, and its buttons. */
export const Notice = ({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) => (
    <div className="rounded-xl bg-primary p-5 ring-1 ring-secondary">
        <p className="text-md font-semibold text-primary">{title}</p>
        {children && <div className="mt-1 max-w-[60ch] text-sm text-pretty text-tertiary">{children}</div>}
        {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
);

/**
 * For anyone through TeamGate without a Google session (the team password), or signed in
 * with an account outside the team. Inline, inside the Docs frame, so nothing jumps.
 * Google returns to this page's path; it drops the query, which is why the check never
 * starts on its own.
 */
export const SignInCard = ({ email, reason }: { email?: string; reason: string }) => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const wrongAccount = !!email;

    const signIn = async () => {
        setBusy(true);
        setError("");
        const { error: err } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${window.location.origin}${window.location.pathname}`, queryParams: { hd: TEAM_DOMAIN, prompt: "select_account" } },
        });
        if (err) {
            setError("Couldn't start Google sign-in. Try again in a moment.");
            setBusy(false);
        }
    };

    return (
        <div className="rounded-xl bg-primary p-5 ring-1 ring-secondary">
            <h2 className="text-md font-semibold text-primary">{wrongAccount ? "Switch to your team account" : "Sign in to keep your progress"}</h2>
            <p className="mt-1 max-w-[60ch] text-sm text-pretty text-tertiary">
                {wrongAccount ? (
                    <>
                        You're signed in as <span className="font-medium text-secondary">{email}</span>. {reason} Use your{" "}
                        <span className="font-medium text-secondary">@{TEAM_DOMAIN}</span> Google account.
                    </>
                ) : (
                    <>
                        {reason} Sign in with your <span className="font-medium text-secondary">@{TEAM_DOMAIN}</span> Google account.
                    </>
                )}
            </p>
            <button
                type="button"
                onClick={signIn}
                disabled={busy}
                className="mt-4 inline-flex items-center gap-2.5 rounded-lg border border-secondary bg-primary px-4 py-2.5 text-sm font-semibold text-secondary outline-focus-ring transition duration-100 ease-linear hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
                <GoogleIcon className="size-5" />
                {busy ? "Redirecting…" : wrongAccount ? "Switch account" : "Continue with Google"}
            </button>
            {error && (
                <p role="alert" className="mt-3 text-sm text-error-primary">
                    {error}
                </p>
            )}
        </div>
    );
};

/** Why a page needs a sign-in, in its own words. */
export const SIGN_IN_REASON =
    "The check saves your answers to your own account, so you can finish later and see which terms to practise. Only you can see them.";

/** Everything a page shows before its session is ready. Pages render this for any status but "ready". */
export const SessionFallback = ({ session, signInReason = SIGN_IN_REASON }: { session: Exclude<CheckSession, { status: "ready" }>; signInReason?: string }) => {
    switch (session.status) {
        case "loading":
            return <p className="py-6 text-sm text-tertiary">Loading…</p>;
        case "failed":
            return (
                <Notice
                    title="The check couldn't load"
                    actions={
                        <Button size="sm" onClick={() => window.location.reload()}>
                            Reload
                        </Button>
                    }
                >
                    The portal may have been updated since this tab was opened. Reloading picks up the new version.
                </Notice>
            );
        case "broken":
            // Only reachable if the bank and the dictionary disagree in a deploy, which
            // check-bank.check.ts exists to stop. Says what's wrong so it can be fixed fast.
            return (
                <Notice title="The check is being updated">
                    <p>Its questions don't match the dictionary right now, so it's paused until they do. The dictionary itself works as usual.</p>
                    <details className="mt-3">
                        <summary className="cursor-pointer text-secondary">What needs fixing</summary>
                        <ul className="mt-2 list-disc pl-5">
                            {session.problems.slice(0, 20).map((p) => (
                                <li key={p}>{p}</li>
                            ))}
                        </ul>
                    </details>
                </Notice>
            );
        case "signed-out":
            return <SignInCard email={session.email} reason={signInReason} />;
        case "history-failed":
            return (
                <Notice
                    title="Your check history couldn't load"
                    actions={
                        <Button size="sm" onClick={session.retry}>
                            Try again
                        </Button>
                    }
                >
                    This is usually the connection. Nothing you've saved is lost.
                </Notice>
            );
    }
};
