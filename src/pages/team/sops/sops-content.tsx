import { useMemo, useState } from "react";
import { Download01, FileCheck02, Lock01, Plus, SearchSm } from "@untitledui/icons";
import { useNavigate } from "react-router";
import sopsIndex from "@/data/sops.json";
import { supabase } from "@/lib/supabase";
import { cx } from "@/utils/cx";
import { SOP_DEPARTMENTS, findSopDepartment, sopDeptTabId } from "./sop-departments";

/**
 * SOP dashboard — the content pane for the "SOPs" department (kind: "sops").
 *
 * MVP scope, on purpose: read the library from `src/data/sops.json`, list it by
 * department, open an SOP, download its PDF. Create SOP is a visible, disabled
 * button so the team sees what is coming. Runs, review tracking and step-level
 * search are phase 3 and 4 in the portal plan and have no UI here yet — the
 * wireframe holds their slots.
 *
 * `tab` is the sidebar selection: "all" or a lower-case department code.
 */

export type SopStatus = "draft" | "live" | "pending_approval" | "archived";

export interface SopIndexEntry {
    id: string;
    dept: string;
    title: string;
    version: string;
    status: SopStatus;
    owner_role: string;
    owner: string;
    /** ISO date of the current version's publish. */
    updated: string;
    /** ISO date, or null until first approval. */
    next_review: string | null;
    /** Path inside the private `sops` storage bucket. */
    html: string;
    pdf: string;
    change_summary: string;
}

export const SOPS: SopIndexEntry[] = sopsIndex as SopIndexEntry[];

export const sopPath = (id: string) => `/sop/${id}`;

const STATUS_LABEL: Record<SopStatus, string> = {
    draft: "Draft",
    live: "Live",
    pending_approval: "Pending approval",
    archived: "Archived",
};

const STATUS_CLASS: Record<SopStatus, string> = {
    draft: "bg-warning-secondary text-warning-primary",
    live: "bg-success-secondary text-success-primary",
    pending_approval: "bg-brand-secondary text-brand-secondary",
    archived: "bg-secondary text-tertiary ring-1 ring-secondary ring-inset",
};

const formatDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-CA", { day: "numeric", month: "short", year: "numeric" });

/** Opens the current version's PDF through a short-lived signed URL. Never a public link. */
export const openSopPdf = async (entry: SopIndexEntry) => {
    const { data, error } = await supabase.storage.from("sops").createSignedUrl(entry.pdf, 120);
    if (error || !data?.signedUrl) {
        window.alert("The PDF could not be opened. Sign in with your Google account and try again.");
        return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
};

const StatusPill = ({ status }: { status: SopStatus }) => (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", STATUS_CLASS[status])}>{STATUS_LABEL[status]}</span>
);

const SopCard = ({ entry }: { entry: SopIndexEntry }) => {
    const navigate = useNavigate();
    const dept = findSopDepartment(entry.dept);
    return (
        <div className="group flex flex-col gap-3 rounded-xl bg-primary p-4 shadow-sm ring-1 ring-secondary transition duration-100 ease-linear hover:ring-brand">
            <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-medium text-tertiary">{entry.id}</span>
                <div className="flex items-center gap-1.5">
                    {dept?.requiresApproval && <Lock01 className="size-3.5 text-quaternary" aria-label="Approval required" />}
                    <StatusPill status={entry.status} />
                </div>
            </div>
            <button
                type="button"
                onClick={() => navigate(sopPath(entry.id))}
                className="text-left text-md font-semibold text-primary transition duration-100 ease-linear hover:text-brand-secondary"
            >
                {entry.title}
            </button>
            <div className="mt-auto flex flex-col gap-0.5 text-xs text-tertiary">
                <span>
                    v{entry.version} · {entry.owner} · {formatDate(entry.updated)}
                </span>
                <span>
                    {entry.owner_role} ({entry.owner}){entry.next_review ? ` · review ${formatDate(entry.next_review)}` : ""}
                </span>
            </div>
            <div className="flex items-center gap-2 border-t border-secondary pt-3">
                <button
                    type="button"
                    onClick={() => navigate(sopPath(entry.id))}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-solid px-3 py-1.5 text-sm font-semibold text-white transition duration-100 ease-linear hover:opacity-90"
                >
                    Open
                </button>
                <button
                    type="button"
                    onClick={() => void openSopPdf(entry)}
                    title="Download PDF"
                    className="flex items-center gap-1.5 rounded-lg border border-secondary bg-primary px-3 py-1.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:bg-secondary hover:text-primary"
                >
                    <Download01 className="size-4" aria-hidden="true" />
                    PDF
                </button>
            </div>
        </div>
    );
};

/** One bar per department, zeros shown — the region the Operations Manager reads first. */
const CoverageBars = ({ onSelect }: { onSelect: (tabId: string) => void }) => {
    const liveCounts = SOP_DEPARTMENTS.map((d) => SOPS.filter((s) => s.dept === d.code && s.status === "live").length);
    const totalCounts = SOP_DEPARTMENTS.map((d) => SOPS.filter((s) => s.dept === d.code).length);
    const max = Math.max(1, ...totalCounts);
    return (
        <div className="rounded-xl bg-primary p-5 shadow-sm ring-1 ring-secondary">
            <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-primary">Coverage by department</h2>
                <span className="text-xs text-tertiary">live · all</span>
            </div>
            <div className="flex flex-col gap-2">
                {SOP_DEPARTMENTS.map((d, i) => (
                    <button
                        key={d.code}
                        type="button"
                        onClick={() => onSelect(sopDeptTabId(d.code))}
                        className="grid grid-cols-[3.25rem_1fr_3.5rem] items-center gap-3 rounded-md px-1 py-0.5 text-left transition duration-100 ease-linear hover:bg-secondary"
                    >
                        <span className="font-mono text-xs font-medium text-secondary">{d.code}</span>
                        <span className="relative h-2 overflow-hidden rounded-full bg-secondary">
                            <span className="absolute inset-y-0 left-0 rounded-full bg-quaternary" style={{ width: `${(totalCounts[i] / max) * 100}%` }} />
                            <span className="absolute inset-y-0 left-0 rounded-full bg-brand-solid" style={{ width: `${(liveCounts[i] / max) * 100}%` }} />
                        </span>
                        <span className="text-right font-mono text-xs text-tertiary">
                            {liveCounts[i]} · {totalCounts[i]}
                        </span>
                    </button>
                ))}
            </div>
            <p className="mt-3 text-xs text-tertiary">Drafts are visible to the team but only live SOPs count as coverage.</p>
        </div>
    );
};

export const SopsContent = ({ tab, onSelectTab }: { tab: string; onSelectTab: (tabId: string) => void }) => {
    const [query, setQuery] = useState("");
    const selected = tab === "all" ? null : findSopDepartment(tab);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return SOPS.filter((s) => (selected ? s.dept === selected.code : true)).filter(
            (s) => !q || s.title.toLowerCase().includes(q) || s.id.toLowerCase().includes(q),
        );
    }, [query, selected]);

    const liveCount = SOPS.filter((s) => s.status === "live").length;
    const deptsWithSops = new Set(SOPS.map((s) => s.dept)).size;
    const groups = selected ? [selected] : SOP_DEPARTMENTS;

    return (
        <div className="flex h-full flex-1 flex-col overflow-hidden rounded-lg bg-secondary shadow-sm">
            {/* Top bar — same pattern as every other department pane. */}
            <header className="flex h-[73px] shrink-0 items-center justify-between border-b border-secondary bg-primary px-6">
                <div>
                    <h1 className="text-md font-semibold text-primary">{selected ? selected.name : "All SOPs"}</h1>
                    <p className="text-sm text-tertiary">
                        {selected
                            ? `${visible.length} SOP${visible.length !== 1 ? "s" : ""}${selected.requiresApproval ? " · approval required to publish" : ""}`
                            : `${SOPS.length} SOP${SOPS.length !== 1 ? "s" : ""} across ${deptsWithSops} of ${SOP_DEPARTMENTS.length} departments · ${liveCount} live`}
                    </p>
                </div>
                <button
                    type="button"
                    disabled
                    title="Coming in phase 2 — ask Kyle to add or update an SOP for now"
                    className="flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-brand-solid px-3.5 py-2 text-sm font-semibold text-white opacity-50"
                >
                    <Plus className="size-4" aria-hidden="true" />
                    Create SOP
                </button>
            </header>

            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-6 py-6">
                    {/* Task search. MVP filters by title and ID; the copy stays the same when step-level search lands. */}
                    <div className="relative">
                        <SearchSm className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-quaternary" aria-hidden="true" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="What are you trying to do?"
                            className="w-full rounded-lg border border-secondary bg-primary py-2.5 pr-3 pl-10 text-sm text-primary transition duration-100 ease-linear outline-none placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                    </div>

                    {!selected && !query && <CoverageBars onSelect={onSelectTab} />}

                    {groups.map((d) => {
                        const rows = visible.filter((s) => s.dept === d.code);
                        if (query && rows.length === 0) return null;
                        return (
                            <section key={d.code} className="flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <d.icon className="size-4 text-tertiary" aria-hidden="true" />
                                    <h2 className="text-sm font-semibold text-primary">{d.name}</h2>
                                    <span className="font-mono text-xs text-quaternary">{d.code}</span>
                                    {d.requiresApproval && <Lock01 className="size-3.5 text-quaternary" aria-label="Approval required" />}
                                </div>
                                {rows.length === 0 ? (
                                    <div className="flex items-center gap-3 rounded-xl border border-dashed border-secondary px-4 py-5 text-sm text-tertiary">
                                        <FileCheck02 className="size-5 shrink-0 text-quaternary" aria-hidden="true" />
                                        No {d.name} SOPs yet — anyone can propose one; ask Kyle to add it.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                        {rows.map((s) => (
                                            <SopCard key={s.id} entry={s} />
                                        ))}
                                    </div>
                                )}
                            </section>
                        );
                    })}

                    {query && visible.length === 0 && (
                        <p className="py-10 text-center text-sm text-tertiary">Nothing matches “{query}”. Search covers titles and IDs for now.</p>
                    )}

                    <p className="pb-2 text-center text-xs text-quaternary">Live from the SOP library — publish or update there and these numbers follow.</p>
                </div>
            </div>
        </div>
    );
};
