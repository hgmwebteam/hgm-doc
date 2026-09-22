import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Download01 } from "@untitledui/icons";
import { useLocation, useNavigate, useParams } from "react-router";
import { useAuthUser } from "@/hooks/use-auth-user";
import { supabase } from "@/lib/supabase";
import { TeamGate } from "@/pages/team/dashboard-screen";
import { findSopDepartment, sopDeptTabId } from "./sop-departments";
import { SOPS, openSopPdf } from "./sops-content";

/**
 * `/sop/:id` — one SOP, read from the private `sops` storage bucket and shown in an
 * iframe. The file is the portal page `to_html.py` renders: self-contained (fonts and
 * figures inlined), with its own phase menu, task picker and follow-along ticks.
 *
 * Two gates, deliberately. TeamGate is the usual one. On top of it this page needs a
 * real Supabase session (Google), because the bucket policy is `authenticated` only:
 * SOPs describe the vault and the deploy path, and a shared password is not identity.
 * Someone who came through the password path sees a sign-in card, not the document.
 *
 * `#5.4` in the URL scrolls to task 5.4 once the page has loaded — the renderer gives
 * every task `id="task-5.4"`. Best effort: a hash that matches nothing is ignored.
 */

const ALLOWED_DOMAIN = "hiddengem.media";

const SignInCard = ({ onSignIn, busy, error }: { onSignIn: () => void; busy: boolean; error: string }) => (
    <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl bg-primary p-6 shadow-sm ring-1 ring-secondary">
            <h1 className="text-lg font-semibold text-primary">SOPs need your Google sign-in</h1>
            <p className="mt-1 text-sm text-tertiary">
                Standard operating procedures are stored privately and opened with your own account, not the shared team password. Sign in with your{" "}
                <span className="font-medium text-secondary">@{ALLOWED_DOMAIN}</span> Google account to continue.
            </p>
            {error && <p className="mt-3 text-sm text-error-primary">{error}</p>}
            <button
                type="button"
                onClick={onSignIn}
                disabled={busy}
                className="mt-5 w-full rounded-lg bg-brand-solid px-3.5 py-2.5 text-sm font-semibold text-white transition duration-100 ease-linear hover:opacity-90 disabled:opacity-60"
            >
                {busy ? "Opening Google…" : "Sign in with Google"}
            </button>
        </div>
    </div>
);

const SopViewer = () => {
    const { id = "" } = useParams();
    const { hash } = useLocation();
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuthUser();
    const entry = SOPS.find((s) => s.id.toLowerCase() === id.toLowerCase());
    const dept = entry ? findSopDepartment(entry.dept) : undefined;

    const [html, setHtml] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [signInBusy, setSignInBusy] = useState(false);
    const [signInError, setSignInError] = useState("");
    const frame = useRef<HTMLIFrameElement>(null);

    const signIn = async () => {
        setSignInError("");
        setSignInBusy(true);
        const { error: e } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}${window.location.pathname}${window.location.hash}`,
                queryParams: { hd: ALLOWED_DOMAIN, prompt: "select_account" },
            },
        });
        if (e) {
            setSignInError(e.message);
            setSignInBusy(false);
        }
    };

    // Fetch the page once there is a session. Storage enforces the policy; this just reads.
    useEffect(() => {
        if (!entry || !user) return;
        let cancelled = false;
        setError("");
        setHtml(null);
        supabase.storage
            .from("sops")
            .download(entry.html)
            .then(async ({ data, error: e }) => {
                if (cancelled) return;
                if (e || !data) {
                    setError(`This SOP's page is not in the library yet (${entry.html}). Ask Kyle to publish it.`);
                    return;
                }
                setHtml(await data.text());
            });
        return () => {
            cancelled = true;
        };
    }, [entry?.id, user?.email]);

    // Deep link to a task: `/sop/HGM-SOP-WEB-002#5.4` → the renderer's `#task-5.4`.
    const scrollToHash = () => {
        const doc = frame.current?.contentDocument;
        const target = hash.replace(/^#/, "");
        if (!doc || !target) return;
        const el = doc.getElementById(`task-${target}`) ?? doc.getElementById(target);
        el?.scrollIntoView({ block: "start" });
    };

    if (!entry) {
        return (
            <div className="flex flex-1 items-center justify-center p-6">
                <div className="flex max-w-md items-start gap-3 rounded-xl bg-primary p-5 shadow-sm ring-1 ring-secondary">
                    <AlertCircle className="mt-0.5 size-5 shrink-0 text-error-primary" aria-hidden="true" />
                    <div>
                        <p className="text-sm font-semibold text-primary">No SOP with the ID “{id}”</p>
                        <p className="mt-1 text-sm text-tertiary">Check the ID against the library, or open the SOP dashboard and pick it from there.</p>
                        <button
                            type="button"
                            onClick={() => navigate("/dashboard?dept=sops")}
                            className="mt-3 text-sm font-semibold text-brand-secondary hover:underline"
                        >
                            Go to SOPs
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen flex-col bg-secondary">
            <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-secondary bg-primary px-4">
                <div className="flex min-w-0 items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(`/dashboard?dept=sops${dept ? `&tab=${sopDeptTabId(dept.code)}` : ""}`)}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-secondary transition duration-100 ease-linear hover:bg-secondary hover:text-primary"
                    >
                        <ArrowLeft className="size-4" aria-hidden="true" />
                        SOPs
                    </button>
                    <span className="hidden font-mono text-xs text-tertiary sm:inline">
                        {entry.id} · v{entry.version}
                    </span>
                    <span className="truncate text-sm font-semibold text-primary">{entry.title}</span>
                </div>
                <button
                    type="button"
                    onClick={() => void openSopPdf(entry)}
                    disabled={!user}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-secondary bg-primary px-3 py-1.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:bg-secondary hover:text-primary disabled:opacity-50"
                >
                    <Download01 className="size-4" aria-hidden="true" />
                    PDF
                </button>
            </header>

            {authLoading ? (
                <div className="flex flex-1 items-center justify-center">
                    <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent opacity-60" />
                </div>
            ) : !user ? (
                <SignInCard onSignIn={() => void signIn()} busy={signInBusy} error={signInError} />
            ) : error ? (
                <div className="flex flex-1 items-center justify-center p-6">
                    <div className="flex max-w-md items-start gap-3 rounded-xl bg-primary p-5 shadow-sm ring-1 ring-secondary">
                        <AlertCircle className="mt-0.5 size-5 shrink-0 text-warning-primary" aria-hidden="true" />
                        <p className="text-sm text-secondary">{error}</p>
                    </div>
                </div>
            ) : html === null ? (
                <div className="flex flex-1 items-center justify-center">
                    <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent opacity-60" />
                </div>
            ) : (
                // allow-same-origin keeps the page's follow-along ticks in this browser's
                // storage; allow-popups lets links inside the SOP open in a new tab.
                <iframe
                    ref={frame}
                    title={entry.title}
                    srcDoc={html}
                    onLoad={scrollToHash}
                    sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                    className="min-h-0 w-full flex-1 border-0 bg-primary"
                />
            )}
        </div>
    );
};

export const SopViewerScreen = () => (
    <TeamGate>
        <SopViewer />
    </TeamGate>
);
