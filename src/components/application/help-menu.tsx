import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, BookOpen01, CheckCircle, GraduationHat01, HelpCircle, Image01, Inbox01, Keyboard01, Send01, XClose } from "@untitledui/icons";
import { DocsRequestModal } from "@/components/application/docs-request-modal";
import { Button } from "@/components/base/buttons/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { supabase } from "@/lib/supabase";
import { compressImageFile } from "@/utils/compress-image";
import { cx } from "@/utils/cx";

const inputCls =
    "w-full rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary placeholder:text-placeholder focus:border-brand focus:outline-none";

const SHORTCUTS: { keys: string[]; label: string }[] = [
    { keys: ["Shift", "F"], label: "Open sitewide search" },
    { keys: ["Shift", "E"], label: "Unlock / lock editing" },
    { keys: ["Shift", "S"], label: "Save and lock" },
    { keys: ["Shift", "B"], label: "Show / hide the menu" },
    { keys: ["Shift", "R"], label: "Show / hide the icon rail" },
    { keys: ["Shift", "Q"], label: "Open / close the AI chat" },
    { keys: ["Ctrl", "B"], label: "Go to the Dashboard" },
];

/** Shared modal shell (same pattern as DocsRequestModal). */
const ModalShell = ({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) => (
    <AnimatePresence>
        {open && (
            <motion.div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 py-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onMouseDown={(e) => {
                    if (e.target === e.currentTarget) onClose();
                }}
            >
                <motion.div
                    className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl bg-primary p-6 shadow-2xl ring-1 ring-secondary"
                    initial={{ opacity: 0, scale: 0.94, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 10 }}
                    transition={{ type: "spring", stiffness: 300, damping: 26 }}
                >
                    {children}
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
);

/** "Report a bug" modal → saves into docs_requests for the Web Team. */
const BugReportModal = ({ open, onClose, reporter }: { open: boolean; onClose: () => void; reporter: string }) => {
    const [issue, setIssue] = useState("");
    const [details, setDetails] = useState("");
    const [image, setImage] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reset = () => {
        setIssue("");
        setDetails("");
        setImage(null);
        setDone(false);
        setError(null);
    };

    const handleImage = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        void compressImageFile(file).then(setImage);
        e.target.value = "";
    };

    const submit = async () => {
        if (!issue.trim() || submitting) return;
        setSubmitting(true);
        setError(null);
        const row = {
            id: crypto.randomUUID(),
            requester: reporter,
            title: `[Bug] ${issue.trim()}`,
            request_for: "webteam",
            priority: "high",
            details: `${details.trim()}\n\nPage: ${window.location.href}`.trim(),
            status: "open",
        };
        let { error: dbError } = await supabase.from("docs_requests").insert({ ...row, image });
        // Fallback for environments where the image column migration hasn't landed yet.
        if (dbError && image) ({ error: dbError } = await supabase.from("docs_requests").insert(row));
        setSubmitting(false);
        if (dbError) setError("Couldn't submit right now — please try again.");
        else setDone(true);
    };

    return (
        <ModalShell
            open={open}
            onClose={() => {
                onClose();
                if (done) reset();
            }}
        >
            {done ? (
                <div className="flex flex-col items-center py-6 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-success-secondary">
                        <CheckCircle className="size-6 text-fg-success-primary" aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 text-md font-semibold text-primary">Thank you!</h3>
                    <p className="mt-1 text-sm text-tertiary">The Web Team got your report and will work on it.</p>
                    <Button
                        size="md"
                        color="secondary"
                        className="mt-5"
                        onClick={() => {
                            onClose();
                            reset();
                        }}
                    >
                        Close
                    </Button>
                </div>
            ) : (
                <>
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-md font-semibold text-primary">Report a bug</h3>
                            <p className="mt-0.5 text-sm text-tertiary">Tell the Web Team what went wrong.</p>
                        </div>
                        <button
                            type="button"
                            title="Close"
                            onClick={onClose}
                            className="flex size-8 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-primary_hover hover:text-fg-secondary"
                        >
                            <XClose className="size-5" aria-hidden="true" />
                        </button>
                    </div>

                    <div className="mt-5 flex flex-col gap-4">
                        <div>
                            <label className="text-sm font-medium text-secondary">What's the issue?</label>
                            <input className={cx(inputCls, "mt-1.5")} value={issue} placeholder="Short summary" onChange={(e) => setIssue(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-secondary">Details (optional)</label>
                            <textarea
                                className={cx(inputCls, "mt-1.5 resize-none")}
                                rows={4}
                                value={details}
                                placeholder="What did you expect, what happened instead, steps to reproduce…"
                                onChange={(e) => setDetails(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-secondary">Screenshot (optional)</label>
                            {image ? (
                                <div className="relative mt-1.5 w-fit">
                                    <img src={image} alt="Bug screenshot" className="max-h-48 rounded-lg border border-secondary" />
                                    <button
                                        type="button"
                                        title="Remove screenshot"
                                        onClick={() => setImage(null)}
                                        className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border border-secondary bg-primary text-fg-quaternary shadow-xs transition duration-100 ease-linear hover:bg-error-primary hover:text-fg-error-primary"
                                    >
                                        <XClose className="size-3.5" aria-hidden="true" />
                                    </button>
                                </div>
                            ) : (
                                <label className="mt-1.5 flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-primary px-3 py-1.5 text-xs font-medium text-tertiary transition duration-100 ease-linear hover:border-brand hover:text-brand-secondary">
                                    <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
                                    <Image01 className="size-4" aria-hidden="true" />
                                    Add screenshot
                                </label>
                            )}
                        </div>
                        {error && <p className="text-sm text-error-primary">{error}</p>}
                        <div className="flex justify-end gap-2">
                            <Button size="md" color="secondary" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button size="md" color="primary" isLoading={submitting} isDisabled={!issue.trim()} onClick={submit}>
                                Submit report
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </ModalShell>
    );
};

/** Keyboard shortcuts reference. */
const ShortcutsModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    <ModalShell open={open} onClose={onClose}>
        <div className="flex items-start justify-between">
            <h3 className="text-md font-semibold text-primary">Keyboard shortcuts</h3>
            <button
                type="button"
                title="Close"
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-primary_hover hover:text-fg-secondary"
            >
                <XClose className="size-5" aria-hidden="true" />
            </button>
        </div>
        <div className="mt-4 divide-y divide-secondary">
            {SHORTCUTS.map((s) => (
                <div key={s.label} className="flex items-center justify-between py-3">
                    <span className="text-sm text-secondary">{s.label}</span>
                    <span className="flex items-center gap-1">
                        {s.keys.map((k) => (
                            <kbd
                                key={k}
                                className="rounded-md border border-secondary bg-secondary px-1.5 py-0.5 font-sans text-xs font-semibold text-secondary"
                            >
                                {k}
                            </kbd>
                        ))}
                    </span>
                </div>
            ))}
        </div>
        <p className="mt-3 text-xs text-quaternary">Editing shortcuts work on team pages; shortcuts are ignored while typing in a field.</p>
    </ModalShell>
);

/**
 * "?" help button — floating (bottom-right) on pages without an icon rail, or
 * docked in the icon rail (under the theme toggle) on pages that have one, so
 * the floating bottom-right slot is free for the AI chat widget there.
 * Only rendered for signed-in @hiddengem.media team members.
 */
export const HelpMenu = ({ variant = "floating" }: { variant?: "floating" | "rail" }) => {
    const { user } = useAuthUser();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [bugOpen, setBugOpen] = useState(false);
    const [requestOpen, setRequestOpen] = useState(false);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close the menu on outside click
    useEffect(() => {
        if (!menuOpen) return;
        const onDown = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setMenuOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [menuOpen]);

    const isTeam = !!user?.email && user.email.toLowerCase().endsWith("@hiddengem.media");
    if (!isTeam) return null;

    const items = [
        // Every client's requests, and the form that raises one for a client.
        { label: "Client requests", icon: Inbox01, onClick: () => navigate("/team/tickets") },
        { label: "About this project", icon: BookOpen01, onClick: () => navigate("/roadmap") },
        { label: "Learning Center", icon: GraduationHat01, soon: true, onClick: () => {} },
        { label: "Send docs request", icon: Send01, onClick: () => setRequestOpen(true) },
        { label: "Report a bug", icon: AlertCircle, onClick: () => setBugOpen(true) },
        { label: "Keyboard shortcuts", icon: Keyboard01, onClick: () => setShortcutsOpen(true) },
    ];

    return (
        <>
            <div ref={containerRef} className={variant === "rail" ? "relative" : "fixed right-4 bottom-4 z-50"}>
                <AnimatePresence>
                    {menuOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.97 }}
                            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                            className={cx(
                                "absolute w-60 rounded-xl border border-secondary_alt bg-primary p-1.5 shadow-lg",
                                variant === "rail" ? "bottom-0 left-full ml-2" : "right-0 bottom-12",
                            )}
                        >
                            {items.map((item, i) => (
                                <div key={item.label}>
                                    {i === items.length - 1 && <div className="mx-1 my-1 h-px bg-border-secondary" />}
                                    <button
                                        type="button"
                                        disabled={item.soon}
                                        onClick={() => {
                                            if (item.soon) return;
                                            setMenuOpen(false);
                                            item.onClick();
                                        }}
                                        className={cx(
                                            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition duration-100 ease-linear",
                                            item.soon
                                                ? "cursor-not-allowed text-quaternary opacity-50"
                                                : "text-secondary hover:bg-primary_hover hover:text-primary",
                                        )}
                                    >
                                        <item.icon className="size-4 shrink-0 text-fg-quaternary" aria-hidden="true" />
                                        <span className="flex-1">{item.label}</span>
                                        {item.soon && <span className="text-[10px] font-semibold text-quaternary uppercase">Soon</span>}
                                    </button>
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                <button
                    type="button"
                    title="Help and resources"
                    onClick={() => setMenuOpen((o) => !o)}
                    className={cx(
                        "flex size-10 items-center justify-center rounded-full border border-secondary bg-primary text-secondary transition duration-100 ease-linear hover:bg-secondary hover:text-primary",
                        variant === "rail" ? "mt-2 hover:bg-tertiary" : "shadow-sm",
                    )}
                >
                    <HelpCircle className="size-5" aria-hidden="true" />
                </button>
            </div>

            <BugReportModal open={bugOpen} onClose={() => setBugOpen(false)} reporter={user?.name || user?.email || ""} />
            <DocsRequestModal open={requestOpen} onClose={() => setRequestOpen(false)} />
            <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        </>
    );
};
