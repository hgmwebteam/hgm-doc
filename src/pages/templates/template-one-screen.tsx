import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { AppShell, CollapsedTopBar, HeaderAvatar, IconRail, NavCollapseButton, RailBottom, useNavCollapsed } from "@/components/application/icon-rail";
import { VideoAttach, VideoEmbed } from "@/components/application/video-block";
import { Linkified } from "@/utils/linkify";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useEditShortcuts } from "@/hooks/use-edit-shortcuts";
import { supabase } from "@/lib/supabase";
import { useSuppressFloatingThemeToggle } from "@/providers/theme-provider";
import { compressImageFile } from "@/utils/compress-image";
import { cx } from "@/utils/cx";

/** The master template lives at /template-1; copies live at /{custom-slug} (stored in template_docs). */
const TEMPLATE_BASE = "template-1";
export const slugify = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Slugs that are named routes (or route elsewhere) — a copy can't use these or it'd be unreachable. */
const RESERVED_SLUGS = new Set([
    "template-1", "template", "dashboard", "roadmap", "requests", "settings",
    "designsystem", "home2", "popup", "owner-guide", "metapixel",
    "log-script",
]);
export const isReservedSlug = (slug: string) =>
    RESERVED_SLUGS.has(slug) || /-(leadcapture|dashboard)$/.test(slug);

/* ── Types ───────────────────────────────────────────────────────── */

type LensPos = { x: number; y: number };
type Step = { id: string; heading: string; tools: string[]; command: string; note?: string; video?: string; image: string; lensPos?: LensPos };
/** `parentId` nests a stage as a sub menu under another stage; absent = top-level menu (old docs stay flat).
 *  `hidden` hides the menu from viewers (locked mode) — same eye-icon pattern as owner-guide steps:
 *  hide instead of delete, restorable, and viewer numbering skips it. */
type Stage = { id: string; name: string; steps: Step[]; parentId?: string | null; hidden?: boolean };
/** Doc-level open question — same shape as the overview pages' QA (answered = resolved). */
type QA = { id: string; question: string; answer: string; video?: string };
type SOPState = { stages: Stage[]; selectedId: string | null; locked: boolean; questions?: QA[]; title?: string };

/** Sidebar heading. Per-doc, so a copy made for another team can be renamed;
 *  absent on docs written before it was editable, which is what the fallback is for. */
const DEFAULT_TITLE = "Web Team";

/** Top-level menus; a stage whose parent went missing is promoted rather than lost. */
const topStages = (stages: Stage[]) => stages.filter((s) => !s.parentId || !stages.some((p) => p.id === s.parentId));
const subStages = (stages: Stage[], parentId: string) => stages.filter((s) => s.parentId === parentId);

/** "1" for top-level menus, "2.1" for sub menus (parent № . child №). */
function stageNum(stages: Stage[], stage: Stage): string {
    const tops = topStages(stages);
    const topIdx = tops.findIndex((t) => t.id === stage.id);
    if (topIdx !== -1) return String(topIdx + 1);
    const parentIdx = tops.findIndex((t) => t.id === stage.parentId);
    const sibs = subStages(stages, stage.parentId!);
    return `${parentIdx + 1}.${sibs.findIndex((c) => c.id === stage.id) + 1}`;
}

const storageKey = (slug: string) => `hgm_template1_${slug}`;


/* ── Helpers ─────────────────────────────────────────────────────── */

const uid = () => "id" + Math.random().toString(36).slice(2, 9);

function mkStep(heading = "New step"): Step {
    return { id: uid(), heading, tools: [], command: "", note: "", image: "" };
}

/** Blank 3-section/3-step shell (no placeholder prose) for pages spun up from elsewhere
    — e.g. the dashboard's "Create a new page" shortcut in the Add Card modal. */
export function createBlankTemplateData(): SOPState {
    const stages: Stage[] = ["Section 1", "Section 2", "Section 3"].map((name) => ({
        id: uid(),
        name,
        steps: [mkStep("Step 1"), mkStep("Step 2"), mkStep("Step 3")],
    }));
    return { stages, selectedId: stages[0].id, locked: true, questions: [] };
}

function seed(): SOPState {
    const S = (heading: string, tool: string, command: string): Step => ({ id: uid(), heading, tools: tool ? [tool] : [], command, image: "" });
    const stages: Stage[] = [
        {
            id: uid(), name: "Section One", steps: [
                S("First step", "VS Code", "This is placeholder content for the first step. Unlock editing to replace this text, add a tool tag, drop in a command, or attach an image."),
                S("Second step", "Terminal", "echo \"Replace this command with your own — every field on this page is editable once you unlock.\""),
                S("Third step", "", "Add any closing notes for this section here. Copy this template to spin up a fresh document with the same layout."),
            ],
        },
        {
            id: uid(), name: "Section Two", steps: [
                S("First step", "GitHub", "Placeholder instructions for section two, step one."),
                S("Second step", "", "Placeholder instructions for section two, step two."),
                S("Third step", "Netlify", "Placeholder instructions for section two, step three."),
            ],
        },
        {
            id: uid(), name: "Section Three", steps: [
                S("First step", "", "Placeholder instructions for section three, step one."),
                S("Second step", "Supabase", "Placeholder instructions for section three, step two."),
                S("Third step", "", "Placeholder instructions for section three, step three."),
            ],
        },
    ];
    return { stages, selectedId: stages[0].id, locked: true };
}

function load(slug: string): SOPState {
    try {
        const raw = localStorage.getItem(storageKey(slug));
        if (raw) {
            const d = JSON.parse(raw) as SOPState;
            if (Array.isArray(d.stages) && d.stages.length) {
                // migrate old tool: string → tools: string[]
                d.stages.forEach((stage) => {
                    stage.steps.forEach((step: Step & { tool?: string }) => {
                        if (!Array.isArray(step.tools)) {
                            step.tools = step.tool ? [step.tool] : [];
                        }
                        delete step.tool;
                    });
                });
                // Lock is a per-view UI state, never restored from saved data.
                return { ...d, locked: true };
            }
        }
    } catch {}
    return seed();
}

function save(slug: string, s: SOPState) {
    try { localStorage.setItem(storageKey(slug), JSON.stringify(s)); } catch {}
}


/* ── Icon buttons ────────────────────────────────────────────────── */

const IconBtn = ({ onClick, title, danger, className, children }: {
    onClick: (e: React.MouseEvent) => void;
    title: string;
    danger?: boolean;
    className?: string;
    children: React.ReactNode;
}) => (
    <button
        type="button"
        title={title}
        onClick={onClick}
        className={cx(
            "flex size-[30px] shrink-0 items-center justify-center rounded-[7px] border border-secondary bg-primary text-tertiary transition duration-100 ease-linear",
            danger ? "hover:border-red-300 hover:bg-red-50 hover:text-red-600" : "hover:border-primary hover:bg-secondary hover:text-primary",
            className,
        )}
    >
        {children}
    </button>
);

/* ── Copy button ─────────────────────────────────────────────────── */

const CopyButton = ({ text }: { text: string }) => {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <button
            type="button"
            onClick={copy}
            title="Copy to clipboard"
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-quaternary transition duration-100 ease-linear hover:bg-secondary hover:text-secondary"
        >
            {copied ? (
                <>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success-primary"><path d="M20 6L9 17l-5-5" /></svg>
                    <span className="text-success-primary">Copied</span>
                </>
            ) : (
                <>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                    Copy
                </>
            )}
        </button>
    );
};

/* ── Image with magnifier ────────────────────────────────────────── */

const LENS = 72;
const ZOOM = 1.3;

const ImageWithMagnifier = ({ src, editing, lensPos, onLensPosChange }: {
    src: string;
    editing: boolean;
    lensPos?: LensPos;
    onLensPosChange?: (pos: LensPos) => void;
}) => {
    const imgRef    = useRef<HTMLImageElement>(null);
    const lbImgRef  = useRef<HTMLImageElement>(null);
    const lbWrapRef = useRef<HTMLDivElement>(null);

    const [dims,   setDims]   = useState({ w: 0, h: 0 });
    const [lbDims, setLbDims] = useState({ w: 0, h: 0 });
    const [lightbox, setLightbox] = useState(false);
    const [pos, setPos] = useState<LensPos>(lensPos ?? { x: 0.5, y: 0.5 });
    const posRef = useRef(pos);

    const dragMode = useRef<"thumb" | "lb" | null>(null);

    const applyPos = (newPos: LensPos) => {
        setPos(newPos);
        posRef.current = newPos;
    };

    // normalize against the image element itself — perfectly consistent with offsetWidth/Height
    const computePos = (el: HTMLImageElement | null, clientX: number, clientY: number) => {
        const rect = el?.getBoundingClientRect();
        if (!rect || rect.width === 0) return;
        applyPos({
            x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
            y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
        });
    };

    // window-level drag: mouse can leave the element freely
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (dragMode.current === "thumb") computePos(imgRef.current, e.clientX, e.clientY);
            else if (dragMode.current === "lb") computePos(lbImgRef.current, e.clientX, e.clientY);
        };
        const onUp = () => {
            if (dragMode.current !== null) onLensPosChange?.(posRef.current);
            dragMode.current = null;
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    }, []);

    useEffect(() => {
        const refresh = () => { if (imgRef.current) setDims({ w: imgRef.current.offsetWidth, h: imgRef.current.offsetHeight }); };
        window.addEventListener("resize", refresh);
        return () => window.removeEventListener("resize", refresh);
    }, []);

    useEffect(() => {
        if (!lightbox) return;
        const esc = (e: KeyboardEvent) => { if (e.key === "Escape") closeLightbox(); };
        window.addEventListener("keydown", esc);
        return () => window.removeEventListener("keydown", esc);
    }, [lightbox]);

    // no didDrag guard — clicking the image always opens the lightbox
    // (the lens circle has stopPropagation so clicks on it never reach the img)
    const openLightbox  = () => setLightbox(true);
    const closeLightbox = () => { dragMode.current = null; setLightbox(false); };

    const lensStyle = (w: number, h: number): React.CSSProperties => ({
        position: "absolute",
        width: LENS, height: LENS,
        left: pos.x * w - LENS / 2,
        top:  pos.y * h - LENS / 2,
        borderRadius: "50%",
        border: "2.5px solid rgba(255,255,255,0.9)",
        boxShadow: "0 0 0 1.5px rgba(0,0,0,0.18), 0 3px 12px rgba(0,0,0,0.25)",
        backgroundImage: `url(${src})`,
        backgroundSize: `${w * ZOOM}px ${h * ZOOM}px`,
        backgroundPosition: `${-(pos.x * w * ZOOM - LENS / 2)}px ${-(pos.y * h * ZOOM - LENS / 2)}px`,
        backgroundRepeat: "no-repeat",
    });

    return (
        <>
            {/* thumbnail */}
            <div
                className="relative select-none"
                onTouchMove={(e) => { if (dragMode.current === "thumb") { e.preventDefault(); computePos(imgRef.current, e.touches[0].clientX, e.touches[0].clientY); } }}
                onTouchEnd={() => { dragMode.current = null; }}
            >
                <img
                    ref={imgRef}
                    src={src}
                    alt="reference"
                    className="block w-full cursor-zoom-in rounded-xl border border-secondary"
                    onLoad={() => { if (imgRef.current) setDims({ w: imgRef.current.offsetWidth, h: imgRef.current.offsetHeight }); }}
                    draggable={false}
                    onClick={openLightbox}
                />
                {dims.w > 0 && (
                    <div
                        style={{ ...lensStyle(dims.w, dims.h), cursor: editing ? "grab" : "default" }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={editing ? (e) => { e.preventDefault(); dragMode.current = "thumb"; computePos(imgRef.current, e.clientX, e.clientY); } : undefined}
                        onTouchStart={editing ? (e) => { e.preventDefault(); dragMode.current = "thumb"; computePos(imgRef.current, e.touches[0].clientX, e.touches[0].clientY); } : undefined}
                    />
                )}
            </div>

            {/* lightbox */}
            <AnimatePresence>
            {lightbox && (
                <motion.div onClick={closeLightbox} className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-10 backdrop-blur-sm"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: "easeOut" }}>
                    <motion.div
                        ref={lbWrapRef}
                        className="relative select-none"
                        onClick={(e) => e.stopPropagation()}
                        onTouchMove={(e) => { if (dragMode.current === "lb") computePos(lbImgRef.current, e.touches[0].clientX, e.touches[0].clientY); }}
                        onTouchEnd={() => { dragMode.current = null; }}
                        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 26 }}
                    >
                        <img
                            ref={lbImgRef}
                            src={src}
                            alt="full view"
                            className="block rounded-xl shadow-2xl"
                            style={{ maxHeight: "90vh", maxWidth: "90vw" }}
                            onLoad={() => { if (lbImgRef.current) setLbDims({ w: lbImgRef.current.offsetWidth, h: lbImgRef.current.offsetHeight }); }}
                            draggable={false}
                        />
                        {lbDims.w > 0 && (
                            <div
                                style={{ ...lensStyle(lbDims.w, lbDims.h), cursor: "grab" }}
                                onMouseDown={(e) => { e.preventDefault(); dragMode.current = "lb"; computePos(lbImgRef.current, e.clientX, e.clientY); }}
                                onTouchStart={(e) => { e.preventDefault(); dragMode.current = "lb"; computePos(lbImgRef.current, e.touches[0].clientX, e.touches[0].clientY); }}
                            />
                        )}
                    </motion.div>
                    <button type="button" onClick={closeLightbox} title="Close"
                        className="absolute right-6 top-6 flex size-10 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                </motion.div>
            )}
            </AnimatePresence>
        </>
    );
};

/* ── Step card ───────────────────────────────────────────────────── */

const StepCard = ({
    step, index, editing, onUpdate, onUpdateLensPos, onDelete, onMove, onInsert,
}: {
    step: Step;
    index: number;
    editing: boolean;
    onUpdate: (id: string, field: keyof Step, val: string) => void;
    onUpdateLensPos: (id: string, pos: LensPos) => void;
    onDelete: (id: string) => void;
    onMove: (id: string, dir: -1 | 1) => void;
    onInsert: (id: string, pos: "before" | "after") => void;
}) => {
    const fileRef = useRef<HTMLInputElement>(null);

    const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        void compressImageFile(file).then((img) => onUpdate(step.id, "image", img));
        e.target.value = "";
    };

    return (
        <div className="group/step relative">
            {/* insert above */}
            {editing && index === 0 && (
                <div className="absolute -top-5 left-0 right-0 z-10 flex items-center gap-2.5 px-3.5 opacity-0 transition duration-100 ease-linear group-hover/step:opacity-100 pointer-events-none group-hover/step:pointer-events-auto">
                    <span className="h-0.5 flex-1 rounded-full bg-brand-200" />
                    <button type="button" onClick={() => onInsert(step.id, "before")} title="Insert step above"
                        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-md hover:brightness-110">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    </button>
                    <span className="h-0.5 flex-1 rounded-full bg-brand-200" />
                </div>
            )}

            <div className="rounded-2xl border border-secondary bg-primary pb-6 shadow-xs">
                {/* title row */}
                <div className="flex items-start gap-3.5 p-5 pb-0">
                    <div className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-[15px] text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                        {index + 1}
                    </div>
                    {editing ? (
                        <input
                            type="text"
                            value={step.heading}
                            onChange={(e) => onUpdate(step.id, "heading", e.target.value)}
                            placeholder="Step title"
                            className="mt-0.5 flex-1 min-w-0 rounded-lg border border-secondary bg-transparent px-2.5 py-1 text-[18px] font-semibold leading-7 text-primary outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                    ) : (
                        <p className="mt-1 flex-1 min-w-0 text-[18px] font-semibold leading-7 text-primary">{step.heading}</p>
                    )}
                    {editing && (
                        <div className="flex shrink-0 gap-1 mt-0.5">
                            <IconBtn onClick={(e) => { e.stopPropagation(); onMove(step.id, -1); }} title="Move up">
                                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
                            </IconBtn>
                            <IconBtn onClick={(e) => { e.stopPropagation(); onMove(step.id, 1); }} title="Move down">
                                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                            </IconBtn>
                            <IconBtn onClick={(e) => { e.stopPropagation(); onDelete(step.id); }} title="Delete step" danger>
                                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                            </IconBtn>
                        </div>
                    )}
                </div>


                {/* command */}
                <div className="mt-3.5 flex flex-col gap-1.5 px-5 pl-[69px]">
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-quaternary">Instructions</p>
                        {step.command && <CopyButton text={step.command} />}
                    </div>
                    {editing ? (
                        <textarea
                            value={step.command}
                            onChange={(e) => onUpdate(step.id, "command", e.target.value)}
                            placeholder="Describe exactly what to do…"
                            rows={3}
                            className="w-full resize-y rounded-lg border border-secondary bg-secondary px-3.5 py-3 font-mono text-[13.5px] leading-[22px] text-secondary outline-none focus:border-brand focus:bg-primary focus:ring-1 focus:ring-brand"
                        />
                    ) : step.command ? (
                        <pre className="whitespace-pre-wrap break-words rounded-lg border border-secondary bg-secondary px-3.5 py-3 font-mono text-[13.5px] leading-[22px] text-secondary"><Linkified text={step.command} /></pre>
                    ) : (
                        <span className="text-sm text-placeholder">—</span>
                    )}
                </div>

                {/* note */}
                {(editing || !!step.note) && (
                    <div className="mt-3.5 flex flex-col gap-1.5 px-5 pl-[69px]">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-quaternary">Note</p>
                        {editing ? (
                            <textarea
                                value={step.note ?? ""}
                                onChange={(e) => onUpdate(step.id, "note", e.target.value)}
                                placeholder="Add a note…"
                                rows={2}
                                className="w-full resize-y rounded-lg border border-secondary bg-secondary px-3.5 py-3 text-[13.5px] leading-[22px] text-secondary outline-none focus:border-brand focus:bg-primary focus:ring-1 focus:ring-brand"
                            />
                        ) : (
                            <p className="whitespace-pre-wrap rounded-lg border border-secondary bg-secondary px-3.5 py-3 text-[13.5px] leading-[22px] text-secondary"><Linkified text={step.note ?? ""} /></p>
                        )}
                    </div>
                )}

                {/* video — Loom / YouTube / uploaded; hidden entirely when empty, like the note */}
                {(editing || !!step.video) && (
                    <div className="mt-3.5 flex flex-col gap-1.5 px-5 pl-[69px]">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-quaternary">Video</p>
                        {editing ? (
                            <VideoAttach value={step.video || undefined} onChange={(v) => onUpdate(step.id, "video", v ?? "")} />
                        ) : (
                            <VideoEmbed url={step.video!} />
                        )}
                    </div>
                )}

                {/* image */}
                {step.image ? (
                    <div className="relative mx-5 mt-6 ml-[69px]">
                        <ImageWithMagnifier
                                        src={step.image}
                                        editing={editing}
                                        lensPos={step.lensPos}
                                        onLensPosChange={(p) => onUpdateLensPos(step.id, p)}
                                        />
                        {editing && (
                            <button type="button" onClick={() => onUpdate(step.id, "image", "")} title="Remove image"
                                className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-[7px] bg-black/70 text-white backdrop-blur hover:bg-black/90">
                                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                            </button>
                        )}
                    </div>
                ) : editing ? (
                    <label className="mx-5 mt-6 ml-[69px] flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-primary bg-secondary py-8 text-[13px] font-medium text-tertiary transition duration-100 ease-linear hover:border-brand hover:bg-brand-50 hover:text-brand-700">
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="M21 15l-5-5L5 21" />
                        </svg>
                        Add reference image
                    </label>
                ) : null}
            </div>

            {/* insert below */}
            {editing && (
                <div className="absolute -bottom-5 left-0 right-0 z-10 flex items-center gap-2.5 px-3.5 opacity-0 transition duration-100 ease-linear group-hover/step:opacity-100 pointer-events-none group-hover/step:pointer-events-auto">
                    <span className="h-0.5 flex-1 rounded-full bg-brand-200" />
                    <button type="button" onClick={() => onInsert(step.id, "after")} title="Insert step below"
                        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-md hover:brightness-110">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    </button>
                    <span className="h-0.5 flex-1 rounded-full bg-brand-200" />
                </div>
            )}
        </div>
    );
};

/* ── Sidebar ─────────────────────────────────────────────────────── */

/** One sidebar row — module scope so re-renders don't remount it (and replay the stagger animation). */
const StageRow = ({ stage, num, sub, active, locked, editing, onSelect, onMoveStage, onDeleteStage, onToggleHidden }: {
    stage: Stage;
    num: string;
    sub: boolean;
    active: boolean;
    locked: boolean;
    editing: boolean;
    onSelect: (id: string) => void;
    onMoveStage: (id: string, dir: -1 | 1) => void;
    onDeleteStage: (id: string) => void;
    onToggleHidden: (id: string) => void;
}) => (
    <motion.div
        variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } } }}
        onClick={() => onSelect(stage.id)}
        className={cx(
            "relative flex cursor-pointer items-center gap-[11px] rounded-[9px] px-3 pl-[13px] transition-colors duration-100 ease-linear",
            sub ? "ml-[26px] py-[7px]" : "py-[9px]",
            active ? "bg-brand-50 dark:bg-brand-950/40" : "hover:bg-secondary hover:text-primary",
            stage.hidden && "opacity-50",
        )}
    >
        {/* active bar */}
        <span className={cx(
            "absolute left-0 top-[7px] bottom-[7px] w-[3px] rounded-r-[3px] bg-brand-600 transition duration-100",
            active ? "opacity-100" : "opacity-0",
        )} />
        {/* number — "01" for menus, "2.1" for sub menus */}
        <span className={cx(
            "shrink-0 font-mono text-[11px] font-semibold",
            active ? "text-brand-600 dark:text-brand-400" : "text-quaternary",
        )}>
            {sub ? num : num.padStart(2, "0")}
        </span>
        {/* name */}
        <span className={cx(
            "flex-1 min-w-0 truncate font-medium",
            sub ? "text-[13.5px]" : "text-[14px]",
            active ? "text-primary" : "text-secondary",
        )}>
            {stage.name}
        </span>
        {/* step count badge */}
        {locked && (
            <span className={cx(
                "shrink-0 rounded-full px-[7px] py-[1px] text-[11px] font-semibold",
                active
                    ? "bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300"
                    : "bg-secondary text-quaternary",
            )}>
                {stage.steps.length}
            </span>
        )}
        {/* editing controls */}
        {editing && (
            <div className="flex shrink-0 gap-px" onClick={(e) => e.stopPropagation()}>
                <button type="button" title="Move up" onClick={() => onMoveStage(stage.id, -1)}
                    className="flex size-[22px] items-center justify-center rounded-md text-quaternary transition duration-100 hover:bg-secondary hover:text-primary">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
                </button>
                <button type="button" title="Move down" onClick={() => onMoveStage(stage.id, 1)}
                    className="flex size-[22px] items-center justify-center rounded-md text-quaternary transition duration-100 hover:bg-secondary hover:text-primary">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                </button>
                <button type="button" title={stage.hidden ? "Show menu (hidden from viewers)" : "Hide menu from viewers"} onClick={() => onToggleHidden(stage.id)}
                    className={cx(
                        "flex size-[22px] items-center justify-center rounded-md transition duration-100 hover:bg-secondary hover:text-primary",
                        stage.hidden ? "text-brand-secondary" : "text-quaternary",
                    )}>
                    {stage.hidden ? (
                        /* eye-off */
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></svg>
                    ) : (
                        /* eye */
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    )}
                </button>
                <button type="button" title={sub ? "Delete sub menu" : "Delete menu"} onClick={() => onDeleteStage(stage.id)}
                    className="flex size-[22px] items-center justify-center rounded-md text-quaternary transition duration-100 hover:bg-error-primary hover:text-fg-error-primary">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                </button>
            </div>
        )}
    </motion.div>
);

const Sidebar = ({
    title, onTitleChange,
    stages, selectedId, locked, editing,
    onSelect, onAddStage, onAddSubStage, onDeleteStage, onMoveStage, onToggleHidden, onCollapse,
}: {
    title: string;
    onTitleChange: (v: string) => void;
    stages: Stage[];
    selectedId: string | null;
    locked: boolean;
    editing: boolean;
    onSelect: (id: string) => void;
    onAddStage: () => void;
    onAddSubStage: () => void;
    onDeleteStage: (id: string) => void;
    onMoveStage: (id: string, dir: -1 | 1) => void;
    onToggleHidden: (id: string) => void;
    onCollapse?: () => void;
}) => {
    const rowProps = { locked, editing, onSelect, onMoveStage, onDeleteStage, onToggleHidden };
    return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-r border-secondary bg-primary">
        {/* header */}
        <div className="flex h-[73px] shrink-0 items-center justify-between border-b border-secondary px-5">
            {editing ? (
                <input
                    type="text"
                    value={title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    placeholder={DEFAULT_TITLE}
                    aria-label="Page title"
                    className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-md font-semibold text-primary outline-none ring-1 ring-secondary focus:ring-brand placeholder:text-placeholder"
                />
            ) : (
                <h2 className="truncate text-md font-semibold text-primary">{title}</h2>
            )}
            {onCollapse && <NavCollapseButton onClick={onCollapse} />}
        </div>

        {/* menu list — top-level menus with their sub menus indented beneath */}
        <div className="flex-1 overflow-y-auto px-3 py-3.5">
            <p className="mb-3 px-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-quaternary">Workflow</p>
            <motion.div
                className="flex flex-col gap-[3px]"
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.05 } } }}
            >
                {topStages(stages).flatMap((top) => [
                    <StageRow key={top.id} stage={top} num={stageNum(stages, top)} sub={false} active={top.id === selectedId} {...rowProps} />,
                    ...subStages(stages, top.id).map((child) => (
                        <StageRow key={child.id} stage={child} num={stageNum(stages, child)} sub active={child.id === selectedId} {...rowProps} />
                    )),
                ])}
            </motion.div>
        </div>

        {/* footer */}
        {editing && (
            <div className="flex flex-col gap-2 border-t border-secondary p-3.5">
                <button type="button" onClick={onAddStage}
                    className="flex items-center justify-center gap-2 rounded-[9px] border border-primary bg-primary px-2.5 py-2.5 text-[13px] font-semibold text-secondary transition duration-100 ease-linear hover:bg-secondary">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    Add menu
                </button>
                <button type="button" onClick={onAddSubStage} disabled={stages.length === 0}
                    title="Adds a sub menu under the selected menu"
                    className="flex items-center justify-center gap-2 rounded-[9px] border border-dashed border-primary px-2.5 py-2 text-[12.5px] font-semibold text-tertiary transition duration-100 ease-linear hover:bg-secondary hover:text-secondary disabled:cursor-not-allowed disabled:opacity-50">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    Add sub menu
                </button>
            </div>
        )}
    </aside>
    );
};

/* ── Main screen ─────────────────────────────────────────────────── */

export const TemplateOneScreen = ({
    slug = TEMPLATE_BASE,
    isTemplate = slug === TEMPLATE_BASE,
}: {
    slug?: string;
    isTemplate?: boolean;
}) => {
    const navigate = useNavigate();
    const { user } = useAuthUser(); // Supabase session — required for writes (authenticated-only RLS).
    const [signingIn, setSigningIn] = useState(false);
    const [state, setState] = useState<SOPState>(() => load(slug));
    const { collapsed: navCollapsed, toggle: toggleNav } = useNavCollapsed();
    // Copies live at arbitrary slugs that can't be listed in main.tsx's static
    // PAGES_WITHOUT_FLOATING_CHROME array — self-report to hide the duplicate
    // floating toggle (this page already has one in the rail via RailBottom).
    useSuppressFloatingThemeToggle();
    const mainRef = useRef<HTMLElement>(null);
    const hydratedRef = useRef(false);

    // "Copy this template" modal state.
    const [copyOpen, setCopyOpen] = useState(false);
    const [copyName, setCopyName] = useState("");
    const [copySlug, setCopySlug] = useState("");
    const [slugTouched, setSlugTouched] = useState(false);
    const [copying, setCopying] = useState(false);
    const [copyError, setCopyError] = useState("");

    const openCopy = () => {
        setCopyName("");
        setCopySlug("");
        setSlugTouched(false);
        setCopyError("");
        setCopyOpen(true);
    };

    // Slug follows the name until the user edits the slug field directly.
    const onCopyNameChange = (v: string) => {
        setCopyName(v);
        if (!slugTouched) setCopySlug(slugify(v));
    };
    const effectiveSlug = slugify(copySlug || copyName);

    // Supabase is the shared source of truth; override the local cache on mount.
    useEffect(() => {
        supabase
            .from("template_docs")
            .select("data")
            .eq("slug", slug)
            .maybeSingle()
            .then(({ data, error }) => {
                if (!error && Array.isArray((data?.data as SOPState | undefined)?.stages)) {
                    const loaded = data!.data as SOPState;
                    loaded.stages.forEach((stage) => {
                        stage.steps.forEach((step: Step & { tool?: string }) => {
                            if (!Array.isArray(step.tools)) step.tools = step.tool ? [step.tool] : [];
                            delete step.tool;
                        });
                    });
                    // Always open locked, regardless of the saved lock flag.
                    setState({ ...loaded, questions: loaded.questions ?? [], locked: true });
                }
                hydratedRef.current = true;
            });
    }, []);

    const { stages, selectedId, locked } = state;
    const title = state.title ?? DEFAULT_TITLE;
    const setTitle = (v: string) => update((d) => { d.title = v; });

    // Auto-publish every edit (stages, steps and all step details) to Supabase, debounced,
    // so nothing is trapped in one browser even if the user forgets to click Save.
    useEffect(() => {
        if (!hydratedRef.current) return;
        const t = setTimeout(() => {
            supabase
                .from("template_docs")
                .upsert({ slug, data: state, updated_at: new Date().toISOString() }, { onConflict: "slug" })
                .then(({ error }) => { if (error) console.error("[template-1 autosave]", error); });
        }, 1000);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);
    const editing = !locked;

    // Viewers never see hidden menus (a sub menu also disappears with its hidden parent);
    // while editing, everything shows — hidden rows just render dimmed with the eye-off icon.
    // Numbering comes from the visible list, so viewer numbering skips hidden menus cleanly.
    const visibleStages = editing
        ? stages
        : stages.filter((s) => !s.hidden && !(s.parentId && stages.find((p) => p.id === s.parentId)?.hidden));
    const sel = visibleStages.find((s) => s.id === selectedId) ?? visibleStages[0] ?? null;
    const selNum = sel ? stageNum(visibleStages, sel) : ""; // "3" for menus, "2.1" for sub menus

    const update = (mutator: (draft: SOPState) => SOPState | void) => {
        setState((prev) => {
            const next = JSON.parse(JSON.stringify(prev)) as SOPState;
            const result = mutator(next);
            const final = result ?? next;
            save(slug, final);
            return final;
        });
    };

    // auto-select first stage on load
    useEffect(() => {
        if (!selectedId && stages.length) {
            update((d) => { d.selectedId = d.stages[0].id; });
        }
    }, []);

    /* ── Stage handlers ── */
    const handleSelect = (id: string) => {
        update((d) => { d.selectedId = id; });
        mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    };
    const handleToggleLock = () => update((d) => { d.locked = !d.locked; });
    const handleToggleHidden = (id: string) =>
        update((d) => {
            const s = d.stages.find((x) => x.id === id);
            if (s) s.hidden = !s.hidden;
        });

    // Shift+E toggles edit mode; Shift+S saves immediately and locks — same
    // shortcuts as /roadmap, /chat-widget-overview, etc. (Content also
    // autosaves on every change, debounced, via the effect above.)
    useEditShortcuts({
        onToggle: handleToggleLock,
        onSave: () => {
            const next = { ...state, locked: true };
            save(slug, next);
            supabase
                .from("template_docs")
                .upsert({ slug, data: next, updated_at: new Date().toISOString() }, { onConflict: "slug" })
                .then(({ error }) => { if (error) console.error("[template-1 save]", error); });
            setState(next);
        },
    });

    // "Copy this template" → create a new document from the current content.
    const handleCopy = async () => {
        if (!copyName.trim() || copying) return;
        if (!user) { setCopyError("Sign in with your team Google account to create documents."); return; }
        const newSlug = effectiveSlug;
        if (!newSlug) { setCopyError("Enter a name or slug with at least one letter or number."); return; }
        if (isReservedSlug(newSlug)) { setCopyError("That slug is reserved — please pick another."); return; }
        setCopying(true);
        setCopyError("");
        // Fresh copy: clone the current stages/steps with brand-new ids, locked.
        // Ids are remapped up front so sub menus keep pointing at their parent's new id.
        const idMap = new Map(state.stages.map((st) => [st.id, uid()]));
        const cloned: SOPState = {
            stages: state.stages.map((st) => ({
                id: idMap.get(st.id)!,
                name: st.name,
                parentId: st.parentId ? (idMap.get(st.parentId) ?? null) : null,
                steps: st.steps.map((s) => ({ ...s, id: uid() })),
            })),
            selectedId: null,
            locked: true,
            questions: (state.questions ?? []).map((q) => ({ ...q, id: uid() })),
        };
        cloned.selectedId = cloned.stages[0]?.id ?? null;
        const { error } = await supabase
            .from("template_docs")
            .insert({ slug: newSlug, name: copyName.trim(), data: cloned, updated_at: new Date().toISOString() });
        setCopying(false);
        if (error) {
            setCopyError(error.code === "23505" ? "A document with that slug already exists — pick another." : error.message);
            return;
        }
        setCopyOpen(false);
        navigate(`/${newSlug}`);
    };

    // Team Google sign-in — writes require an authenticated Supabase session.
    const handleGoogleSignIn = async () => {
        setSigningIn(true);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: window.location.href, queryParams: { prompt: "select_account" } },
        });
        if (error) setSigningIn(false);
    };

    const handleAddStage = () => update((d) => {
        const id = uid();
        d.stages.push({ id, name: "New Menu", steps: [] });
        d.selectedId = id;
        d.locked = false;
    });

    // Adds a sub menu under the selected menu (or the selected sub menu's parent).
    const handleAddSubStage = () => update((d) => {
        const selStage = d.stages.find((x) => x.id === d.selectedId);
        const parentId = selStage ? (selStage.parentId ?? selStage.id) : topStages(d.stages)[0]?.id;
        if (!parentId) return;
        const id = uid();
        // Insert after the parent's last existing sub so sidebar order matches array order.
        const kids = subStages(d.stages, parentId);
        const anchorId = kids.length ? kids[kids.length - 1].id : parentId;
        d.stages.splice(d.stages.findIndex((s) => s.id === anchorId) + 1, 0, { id, name: "New Sub Menu", steps: [], parentId });
        d.selectedId = id;
        d.locked = false;
    });

    // Deleting a menu also deletes its sub menus.
    const handleDeleteStage = (id: string) => update((d) => {
        const removed = new Set([id, ...subStages(d.stages, id).map((s) => s.id)]);
        d.stages = d.stages.filter((s) => !removed.has(s.id));
        if (d.selectedId && removed.has(d.selectedId)) d.selectedId = d.stages[0]?.id ?? null;
    });


    // Reorders within siblings only — menus swap among menus, subs among their parent's subs.
    const handleMoveStage = (id: string, dir: -1 | 1) => update((d) => {
        const stage = d.stages.find((s) => s.id === id);
        if (!stage) return;
        const siblings = stage.parentId ? subStages(d.stages, stage.parentId) : topStages(d.stages);
        const target = siblings[siblings.findIndex((s) => s.id === id) + dir];
        if (!target) return;
        const i = d.stages.findIndex((s) => s.id === id);
        const j = d.stages.findIndex((s) => s.id === target.id);
        [d.stages[i], d.stages[j]] = [d.stages[j], d.stages[i]];
    });

    /* ── Step handlers ── */
    const handleUpdateStageName = (val: string) => update((d) => {
        const s = d.stages.find((x) => x.id === d.selectedId);
        if (s) s.name = val || "Untitled stage";
    });

    const handleUpdateStep = (stepId: string, field: keyof Step, val: string) => update((d) => {
        const s = d.stages.find((x) => x.id === d.selectedId);
        const st = s?.steps.find((x) => x.id === stepId);
        if (st) (st as Record<string, unknown>)[field as string] = val;
    });

    const handleUpdateLensPos = (stepId: string, pos: LensPos) => update((d) => {
        const s = d.stages.find((x) => x.id === d.selectedId);
        const st = s?.steps.find((x) => x.id === stepId);
        if (st) st.lensPos = pos;
    });

    const handleAddStep = () => update((d) => {
        const s = d.stages.find((x) => x.id === d.selectedId);
        if (s) s.steps.push(mkStep());
    });

    const handleDeleteStep = (stepId: string) => update((d) => {
        const s = d.stages.find((x) => x.id === d.selectedId);
        if (s) s.steps = s.steps.filter((st) => st.id !== stepId);
    });

    const handleMoveStep = (stepId: string, dir: -1 | 1) => update((d) => {
        const s = d.stages.find((x) => x.id === d.selectedId);
        if (!s) return;
        const i = s.steps.findIndex((st) => st.id === stepId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= s.steps.length) return;
        [s.steps[i], s.steps[j]] = [s.steps[j], s.steps[i]];
    });

    const handleInsertStep = (stepId: string, pos: "before" | "after") => update((d) => {
        const s = d.stages.find((x) => x.id === d.selectedId);
        if (!s) return;
        const i = s.steps.findIndex((st) => st.id === stepId);
        if (i < 0) return;
        const at = pos === "before" ? i : i + 1;
        s.steps.splice(at, 0, mkStep());
    });

    return (
        <AppShell
            className="flex flex-col"
            rail={!navCollapsed && <IconRail activeDept="" bottom={<RailBottom editing={editing} onToggleEditing={handleToggleLock} />} />}
            headerRight={!navCollapsed && <HeaderAvatar />}
        >
            {navCollapsed && <CollapsedTopBar title={title} onExpand={toggleNav} />}
            <div className="flex min-h-0 flex-1">
            {!navCollapsed && (
            <Sidebar
                title={title}
                onTitleChange={setTitle}
                stages={visibleStages}
                selectedId={selectedId}
                locked={locked}
                editing={editing}
                onSelect={handleSelect}
                onAddStage={handleAddStage}
                onAddSubStage={handleAddSubStage}
                onDeleteStage={handleDeleteStage}
                onMoveStage={handleMoveStage}
                onToggleHidden={handleToggleHidden}
                onCollapse={toggleNav}
            />
            )}

            <main ref={mainRef} className="flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">
                {sel ? (
                    <motion.div
                        key={sel.id}
                        className="mx-auto max-w-[840px] px-10 py-9 pb-20"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {/* stage header */}
                        <div className="mb-1.5 flex items-start gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="mb-2 flex items-center gap-2.5">
                                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-600 dark:text-brand-400">
                                        Stage {sel.parentId ? selNum : selNum.padStart(2, "0")}
                                    </span>
                                    <span className="size-1 rounded-full bg-tertiary" />
                                    <span className="text-[12px] font-medium text-quaternary">
                                        {sel.steps.length} {sel.steps.length === 1 ? "step" : "steps"}
                                    </span>
                                </div>
                                {editing ? (
                                    <div className="-ml-2.5 flex items-center gap-2">
                                        <span className="shrink-0 px-2.5 py-1 text-[34px] font-semibold leading-10 tracking-[-0.02em] text-primary">{selNum}.</span>
                                        <input
                                            type="text"
                                            value={sel.name}
                                            onChange={(e) => handleUpdateStageName(e.target.value)}
                                            className="w-full rounded-xl border border-secondary bg-transparent px-2.5 py-1 text-[34px] font-semibold leading-10 tracking-[-0.02em] text-primary outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                                        />
                                    </div>
                                ) : (
                                    <h1 className="text-[34px] font-semibold leading-10 tracking-[-0.02em] text-primary">
                                        {selNum}. {sel.name}
                                    </h1>
                                )}
                            </div>
                            <span className={cx(
                                "shrink-0 mt-1 inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap",
                                editing
                                    ? "border-brand-200 bg-brand-50 text-brand-700"
                                    : "border-secondary bg-secondary text-tertiary",
                            )}>
                                {editing ? "Editing on — fields are live" : "Locked — read only"}
                            </span>
                        </div>

                        <hr className="my-6 border-secondary" />

                        {/* steps */}
                        {sel.steps.length > 0 ? (
                            <motion.div
                                className={cx("flex flex-col", editing ? "gap-9" : "gap-4")}
                                initial="hidden"
                                animate="show"
                                variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } }}
                            >
                                {sel.steps.map((step, i) => (
                                    <motion.div
                                        key={step.id}
                                        variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } }}
                                    >
                                        <StepCard
                                            step={step}
                                            index={i}
                                            editing={editing}
                                            onUpdate={handleUpdateStep}
                                            onUpdateLensPos={handleUpdateLensPos}
                                            onDelete={handleDeleteStep}
                                            onMove={handleMoveStep}
                                            onInsert={handleInsertStep}
                                        />
                                    </motion.div>
                                ))}
                            </motion.div>
                        ) : (
                            <div className="rounded-2xl border-[1.5px] border-dashed border-primary bg-primary p-14 text-center">
                                <p className="text-[17px] font-semibold text-primary">No steps in this stage yet</p>
                                <p className="mt-1.5 text-[14px] text-tertiary">Unlock editing and add the first step of this workflow.</p>
                            </div>
                        )}

                        {editing && (
                            <button type="button" onClick={handleAddStep}
                                className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-primary bg-primary py-3.5 text-[14px] font-semibold text-secondary transition duration-100 ease-linear hover:border-brand hover:bg-brand-50 hover:text-brand-700">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                                Add step
                            </button>
                        )}

                    </motion.div>
                ) : (
                    <motion.div
                        key="empty"
                        className="flex h-full flex-col items-center justify-center gap-3.5 p-10 text-center"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-950/30">
                            <svg viewBox="0 0 32 32" width="30" height="30">
                                <path d="M16 2 L30 13 L16 30 L2 13 Z" fill="#7F56D9" />
                                <path d="M16 2 L30 13 L16 13 Z" fill="#fff" opacity="0.3" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-[20px] font-semibold text-primary">No stages yet</p>
                            <p className="mt-1 max-w-xs text-[14px] text-tertiary">
                                Add your first workflow stage from the sidebar to start building your SOP.
                            </p>
                        </div>
                    </motion.div>
                )}
                </AnimatePresence>
            </main>

            {/* Fixed bottom-right controls */}
            <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2.5">
                {/* Copy this template — master template only */}
                {isTemplate && (
                    <button
                        type="button"
                        onClick={openCopy}
                        className="flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg ring-1 ring-brand-600 transition duration-100 ease-linear hover:bg-brand-700"
                    >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                        Copy this template
                    </button>
                )}
            </div>

            {/* Copy-template modal */}
            <AnimatePresence>
                {copyOpen && (
                    <motion.div
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.16 }}
                        onMouseDown={(e) => { if (e.target === e.currentTarget && !copying) setCopyOpen(false); }}
                    >
                        <motion.div
                            className="w-full max-w-md rounded-2xl bg-primary p-6 shadow-2xl ring-1 ring-secondary"
                            initial={{ opacity: 0, scale: 0.94, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 10 }}
                            transition={{ type: "spring", stiffness: 300, damping: 26 }}
                        >
                            <h3 className="text-md font-semibold text-primary">Copy this template</h3>

                            {!user ? (
                                <>
                                    <p className="mt-1 text-sm text-tertiary">
                                        Creating a document saves to the database, which requires signing in with your team Google account.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleGoogleSignIn}
                                        disabled={signingIn}
                                        className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-lg border border-secondary bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary transition duration-100 ease-linear hover:bg-secondary_hover disabled:opacity-50"
                                    >
                                        {signingIn ? (
                                            <span className="size-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                                        ) : (
                                            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" /><path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 6.68 9.14 4.75 12 4.75z" /></svg>
                                        )}
                                        Sign in with Google
                                    </button>
                                    <div className="mt-4 flex justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setCopyOpen(false)}
                                            className="rounded-lg border border-secondary bg-primary px-3.5 py-2 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:bg-secondary_hover"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </>
                            ) : (
                            <>
                            <p className="mt-1 text-sm text-tertiary">
                                Name your new document. It starts as a copy of this template — same sections and steps, ready to edit.
                            </p>

                            <label htmlFor="template-copy-name" className="mt-4 block text-sm font-medium text-secondary">
                                Document name
                            </label>
                            <input
                                id="template-copy-name"
                                autoFocus
                                type="text"
                                value={copyName}
                                onChange={(e) => onCopyNameChange(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleCopy(); }}
                                placeholder="e.g. Acme Onboarding"
                                className="mt-1.5 w-full rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary placeholder:text-placeholder outline-none transition duration-100 ease-linear focus:border-brand focus:ring-1 focus:ring-brand"
                            />

                            <label htmlFor="template-copy-slug" className="mt-4 block text-sm font-medium text-secondary">
                                Slug
                            </label>
                            <div className="mt-1.5 flex items-center overflow-hidden rounded-lg border border-secondary bg-primary transition duration-100 ease-linear focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
                                <span className="shrink-0 border-r border-secondary bg-secondary px-3 py-2 text-sm text-quaternary">/</span>
                                <input
                                    id="template-copy-slug"
                                    type="text"
                                    value={copySlug}
                                    onChange={(e) => { setSlugTouched(true); setCopySlug(e.target.value); }}
                                    onKeyDown={(e) => { if (e.key === "Enter") handleCopy(); }}
                                    placeholder="acme-onboarding"
                                    className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-primary placeholder:text-placeholder outline-none"
                                />
                            </div>
                            <p className="mt-1.5 text-xs text-quaternary">
                                URL: /{effectiveSlug || "…"}
                            </p>

                            {copyError && <p className="mt-2 text-sm text-error-primary">{copyError}</p>}

                            <div className="mt-5 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCopyOpen(false)}
                                    disabled={copying}
                                    className="rounded-lg border border-secondary bg-primary px-3.5 py-2 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:bg-secondary_hover disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    disabled={copying || !copyName.trim()}
                                    className="flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white transition duration-100 ease-linear hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {copying && <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                                    Create document
                                </button>
                            </div>
                            </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            </div>
        </AppShell>
    );
};
