import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, CheckCircle, Plus, SearchSm, Trash01 } from "@untitledui/icons";
import { supabase, type DocsRequest } from "@/lib/supabase";
import { DocsRequestModal } from "@/components/application/docs-request-modal";
import { priorityMeta, priorityRank, requestForLabel } from "@/lib/requests";
import { cx } from "@/utils/cx";

type SortKey = "priority" | "date";
type StatusFilter = "all" | "open" | "done";

const formatDate = (iso?: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const initials = (name: string) =>
    (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

const StatCard = ({ label, value, accent }: { label: string; value: number; accent?: string }) => (
    <div className="rounded-xl bg-primary p-4 ring-1 ring-secondary">
        <p className={cx("text-2xl font-semibold", accent ?? "text-primary")}>{value}</p>
        <p className="mt-0.5 text-xs font-medium text-tertiary">{label}</p>
    </div>
);

const Segmented = <T extends string>({ value, onChange, options }: {
    value: T; onChange: (v: T) => void; options: { id: T; label: string }[];
}) => (
    <div className="inline-flex rounded-lg border border-secondary bg-primary p-0.5">
        {options.map((o) => (
            <button key={o.id} type="button" onClick={() => onChange(o.id)}
                className={cx(
                    "rounded-md px-3 py-1.5 text-sm font-semibold transition duration-100 ease-linear",
                    value === o.id ? "bg-brand-solid text-white" : "text-secondary hover:text-primary",
                )}>
                {o.label}
            </button>
        ))}
    </div>
);

const RequestCard = ({ req, index, onDelete, onToggleDone }: {
    req: DocsRequest; index: number; onDelete: (id: string) => void; onToggleDone: (req: DocsRequest) => void;
}) => {
    const [confirm, setConfirm] = useState(false);
    const pm = priorityMeta(req.priority);
    const done = req.status === "done";

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1], delay: Math.min(index * 0.03, 0.2) }}
            className={cx(
                "group flex items-start gap-4 rounded-xl bg-primary p-4 shadow-sm ring-1 transition duration-100 ease-linear",
                done ? "opacity-60 ring-secondary" : "ring-secondary hover:ring-brand",
            )}
        >
            {/* Avatar */}
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                {initials(req.requester || req.title)}
            </span>

            {/* Body */}
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={cx("inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-semibold", pm?.badge)}>
                        {pm?.label ?? req.priority}
                    </span>
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-tertiary">{requestForLabel(req.request_for)}</span>
                    {done && <span className="rounded-md bg-utility-green-50 px-2 py-0.5 text-xs font-semibold text-utility-green-700">Done</span>}
                </div>
                <h3 className={cx("mt-1.5 text-sm font-semibold text-primary", done && "line-through")}>{req.title}</h3>
                {req.details && <p className="mt-1 text-sm text-secondary">{req.details}</p>}
                <p className="mt-1.5 text-xs text-quaternary">
                    {req.requester ? `${req.requester} · ` : ""}{formatDate(req.created_at)}
                </p>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-1">
                {confirm ? (
                    <>
                        <button type="button" onClick={() => onDelete(req.id)}
                            className="rounded-lg bg-error-solid px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-error-solid_hover">Delete</button>
                        <button type="button" onClick={() => setConfirm(false)}
                            className="rounded-lg border border-secondary px-2.5 py-1.5 text-xs font-medium text-secondary transition hover:bg-secondary">Cancel</button>
                    </>
                ) : (
                    <>
                        <button type="button" onClick={() => onToggleDone(req)} title={done ? "Reopen" : "Mark done"}
                            className={cx(
                                "flex size-8 items-center justify-center rounded-lg transition",
                                done ? "text-success-primary hover:bg-secondary" : "text-quaternary hover:bg-secondary hover:text-success-primary",
                            )}>
                            <CheckCircle className="size-4" />
                        </button>
                        <button type="button" onClick={() => setConfirm(true)} title="Delete"
                            className="flex size-8 items-center justify-center rounded-lg text-quaternary opacity-0 transition hover:bg-secondary hover:text-error-primary group-hover:opacity-100">
                            <Trash01 className="size-4" />
                        </button>
                    </>
                )}
            </div>
        </motion.div>
    );
};

export const RequestsScreen = () => {
    const navigate = useNavigate();
    const [rows, setRows] = useState<DocsRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [sort, setSort] = useState<SortKey>("priority");
    const [status, setStatus] = useState<StatusFilter>("all");
    const [query, setQuery] = useState("");
    const [modalOpen, setModalOpen] = useState(false);

    const load = () => {
        setLoading(true);
        supabase.from("docs_requests").select("*").then(({ data, error }) => {
            if (!error && data) setRows(data as DocsRequest[]);
            setLoading(false);
        });
    };
    useEffect(load, []);

    const deleteRequest = async (id: string) => {
        setRows((prev) => prev.filter((r) => r.id !== id));
        await supabase.from("docs_requests").delete().eq("id", id);
    };

    const toggleDone = async (req: DocsRequest) => {
        const next = req.status === "done" ? "open" : "done";
        setRows((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: next } : r)));
        await supabase.from("docs_requests").update({ status: next }).eq("id", req.id);
    };

    const stats = useMemo(() => ({
        total: rows.length,
        open: rows.filter((r) => r.status !== "done").length,
        done: rows.filter((r) => r.status === "done").length,
        urgent: rows.filter((r) => r.priority === "urgent" && r.status !== "done").length,
    }), [rows]);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        const filtered = rows.filter((r) => {
            if (status === "open" && r.status === "done") return false;
            if (status === "done" && r.status !== "done") return false;
            if (!q) return true;
            return r.title.toLowerCase().includes(q)
                || r.requester?.toLowerCase().includes(q)
                || r.details?.toLowerCase().includes(q)
                || requestForLabel(r.request_for).toLowerCase().includes(q);
        });
        filtered.sort((a, b) => {
            if (sort === "priority") {
                const d = priorityRank(b.priority) - priorityRank(a.priority);
                if (d !== 0) return d;
            }
            return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
        });
        return filtered;
    }, [rows, query, status, sort]);

    return (
        <main className="min-h-dvh bg-secondary">
            <div className="mx-auto w-full max-w-[920px] px-6 py-10">
                {/* Header */}
                <button type="button" onClick={() => navigate("/dashboard")}
                    className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-tertiary transition hover:text-primary">
                    <ArrowLeft className="size-4" /> Back to dashboard
                </button>

                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-display-xs font-semibold text-primary">Requests</h1>
                        <p className="mt-1 text-sm text-tertiary">Docs & workflow requests from the team</p>
                    </div>
                    <button type="button" onClick={() => setModalOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-solid px-3.5 py-2 text-sm font-semibold text-white transition hover:opacity-90">
                        <Plus className="size-4" /> New request
                    </button>
                </div>

                {/* Stats */}
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatCard label="Total" value={stats.total} />
                    <StatCard label="Open" value={stats.open} accent="text-brand-secondary" />
                    <StatCard label="Urgent open" value={stats.urgent} accent="text-error-primary" />
                    <StatCard label="Done" value={stats.done} accent="text-success-primary" />
                </div>

                {/* Controls */}
                <div className="mt-6 flex flex-wrap items-center gap-3">
                    <div className="relative min-w-[220px] flex-1">
                        <SearchSm className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-quaternary" aria-hidden="true" />
                        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search requests…"
                            className="w-full rounded-lg border border-secondary bg-primary py-2.5 pl-10 pr-3 text-sm text-primary placeholder:text-placeholder outline-none transition focus:border-brand focus:ring-1 focus:ring-brand" />
                    </div>
                    <Segmented value={status} onChange={setStatus}
                        options={[{ id: "all", label: "All" }, { id: "open", label: "Open" }, { id: "done", label: "Done" }]} />
                    <Segmented value={sort} onChange={setSort}
                        options={[{ id: "priority", label: "Priority" }, { id: "date", label: "Date" }]} />
                </div>

                {/* List */}
                <div className="mt-5">
                    {loading ? (
                        <div className="flex items-center justify-center rounded-xl bg-primary py-16 ring-1 ring-secondary">
                            <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent opacity-60" />
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="rounded-xl bg-primary px-6 py-16 text-center ring-1 ring-secondary">
                            <p className="text-sm font-medium text-secondary">No requests yet</p>
                            <p className="mt-1 text-sm text-tertiary">Submit one with the “New request” button above.</p>
                        </div>
                    ) : visible.length === 0 ? (
                        <div className="rounded-xl bg-primary px-6 py-16 text-center ring-1 ring-secondary">
                            <p className="text-sm font-medium text-secondary">Nothing matches your filters</p>
                        </div>
                    ) : (
                        <motion.div layout className="flex flex-col gap-3">
                            <AnimatePresence mode="popLayout">
                                {visible.map((r, i) => (
                                    <RequestCard key={r.id} req={r} index={i} onDelete={deleteRequest} onToggleDone={toggleDone} />
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </div>
            </div>

            <DocsRequestModal open={modalOpen} onClose={() => { setModalOpen(false); load(); }} />
        </main>
    );
};
