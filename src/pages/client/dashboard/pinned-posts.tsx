/**
 * Pinned Posts — the three carousels HiddenGem designs for the top of a client's
 * Instagram grid, previewed on a phone, reviewed by the client.
 *
 * THE WORKFLOW, end to end:
 *   1. The team designs the posts in Canva (one design, one page per slide) and pastes
 *      the design link here. The browser never fetches the link itself; the pages come
 *      through canva-import.mts, which holds the team's Canva token.
 *   2. The pages come in either through the portal's Canva connection ("Import from
 *      Canva" — see src/lib/canva-import.ts) or as files the AM exported by hand. Either
 *      way each slide goes through compressImageFile (capped at Instagram's own 1080px)
 *      and is stored as WebP in the dashboard row, the same place every other dashboard
 *      image lives.
 *   3. The AM reveals the section with the eye toggle. The client sees their profile
 *      as a guest opens it, taps through each carousel, and leaves a note on any of them
 *      in the same feedback box the Welcome Email Flow uses. Nobody is asked to approve
 *      anything. The note lands in dashboard_suggestions through the same Netlify
 *      function the Master Brand Document uses, so a client never writes the row — see
 *      the `pinnedposts.{postId}.*` keys below.
 *
 * The phone is the existing Instagram profile surface from /mockup-ig, fed this client's
 * handle, logo, highlights and covers. It is a picture (role="img"); the cards beside it
 * are where a client actually opens a post.
 */
import { type ChangeEvent, type DragEvent, type ReactNode, useEffect, useState } from "react";
import {
    Camera01,
    Check,
    ChevronLeft,
    ChevronRight,
    Download01,
    Link01,
    LinkExternal01,
    ThumbsUp,
    Trash01,
    UploadCloud02,
    XClose,
} from "@untitledui-pro/icons/line";
import { AnimatePresence, motion } from "motion/react";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { PhoneFrame } from "@/components/shared-assets/phone-frame";
import { Reveal } from "@/components/shared-assets/reveal";
import {
    CanvaNotConnectedError,
    type CanvaStatus,
    exportCanvaDesign,
    fetchCanvaPagesAsFiles,
    fetchCanvaStatus,
    readCanvaOutcome,
    startCanvaConnect,
} from "@/lib/canva-import";
import { ClientFeedbackBox } from "@/pages/client/dashboard/client-feedback";
import { SectionEyebrow, SectionHeading, editInput } from "@/pages/client/dashboard/dashboard-chrome";
import {
    MAX_PINNED_POSTS,
    type PinnedPost,
    type PinnedPosts,
    SAMPLE_PINNED_POSTS,
    emptyPinnedPost,
    filledPinnedPosts,
    normalizePinnedPosts,
    parseCanvaUrl,
    uid,
} from "@/pages/client/dashboard/dashboard-model";
import type { Suggestion, SuggestionItem } from "@/pages/client/dashboard/suggestions-model";
import { IgScreen } from "@/pages/team/mockup-ig/ig-chrome";
import { IgProfileScreen } from "@/pages/team/mockup-ig/ig-profile";
import type { IgGridItem, IgProfile } from "@/pages/team/mockup-ig/instagram-data";
import { compressImageFile } from "@/utils/compress-image";
import { cx } from "@/utils/cx";
import { downloadSlideJpeg, downloadSlidesZip, fileStem } from "@/utils/download-slides";

/* ── Feedback keys ─────────────────────────────────────────────────────────
   Client input on a post rides the dashboard_suggestions table under a namespaced key,
   so the Master Brand Document's own suggestion model never sees it (its whitelist
   rejects the prefix) and the Netlify function can gate it on the section being revealed. */

const KEY_PREFIX = "pinnedposts.";
export const isPinnedKey = (fieldKey: string) => fieldKey.startsWith(KEY_PREFIX);
const feedbackKey = (postId: string) => `${KEY_PREFIX}${postId}.feedback`;
/** Legacy: approvals were sent before the feedback box replaced the Approve button. Read only. */
const approveKey = (postId: string) => `${KEY_PREFIX}${postId}.approve`;

/** Instagram serves slides at 1080 wide; storing more is weight the row carries for nothing. */
const SLIDE_MAX_DIM = 1080;

const shortDate = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/* ── Per-post review state ───────────────────────────────────────────────── */

type PostReview = {
    /** Every note on this post, newest first, open and closed alike — what the client's box reads. */
    notes: Suggestion[];
    /** Latest pending note from anyone. */
    openNote: Suggestion | null;
    /** Every pending note, newest first — several clients on one dashboard can each leave one. */
    openNotes: Suggestion[];
    /** The approval in force, if any. */
    approval: Suggestion | null;
    /** The most recent note the team has marked addressed. */
    lastAddressed: Suggestion | null;
};

const reviewFor = (postId: string, feedback: Suggestion[]): PostReview => {
    const notes = feedback.filter((s) => s.field_key === feedbackKey(postId));
    const approvals = feedback.filter((s) => s.field_key === approveKey(postId) && s.status !== "declined");
    const openNotes = notes.filter((s) => s.status === "pending");
    const lastAddressed = notes.find((s) => s.status === "accepted") ?? null;
    // An approval only counts while nothing newer asks for a change.
    const approval = approvals.find((a) => !openNotes.some((n) => n.created_at > a.created_at)) ?? null;
    return { notes, openNote: openNotes[0] ?? null, openNotes, approval, lastAddressed };
};

const StatusBadge = ({ review, forTeam }: { review: PostReview; forTeam: boolean }) => {
    if (review.openNote) return <Badge color="warning">{forTeam ? "Feedback to action" : "Feedback sent"}</Badge>;
    if (forTeam && review.approval) return <Badge color="success">Approved</Badge>;
    if (review.lastAddressed) return <Badge color="brand">{forTeam ? "Updated — awaiting client" : "Updated for you"}</Badge>;
    return <Badge color="gray">{forTeam ? "Awaiting client review" : "Ready for your review"}</Badge>;
};

/* ── The phone ───────────────────────────────────────────────────────────── */

export interface PinnedProfileInputs {
    handle: string;
    displayName: string;
    avatar: string;
    bio: string[];
    linkLabel: string;
    highlights: { label: string; src?: string }[];
}

/**
 * The Instagram profile object the mockup renders, built from what the dashboard already
 * knows about the client. Follower counts are not ours to invent, so they read "—".
 *
 * Exported because the Pinned Stories section beside this one shows the same profile —
 * the pinned tiles in the grid, the story highlights in the tray — so a client sees one
 * account across both sections rather than two mockups that disagree.
 */
export const buildProfile = (inputs: PinnedProfileInputs, posts: PinnedPost[]): IgProfile => {
    const live = filledPinnedPosts(posts);
    // The grid keys tiles by alt, so untitled posts still need distinct text.
    const pinnedTiles: IgGridItem[] = live.slice(0, MAX_PINNED_POSTS).map((p, i) => ({
        src: p.slides[0]?.url,
        alt: p.title || `Pinned post ${i + 1}`,
        kind: "carousel",
        pinned: true,
    }));
    const filler: IgGridItem[] = Array.from({ length: Math.max(0, 9 - pinnedTiles.length) }, (_, i) => ({ alt: `Grid post ${i + 1}`, kind: "photo" }));
    return {
        handle: inputs.handle || "yourhandle",
        displayName: inputs.displayName || "Your brand",
        category: "Vacation Home Rental",
        verified: false,
        avatar: inputs.avatar,
        stats: { posts: String(live.length || "—"), followers: "—", following: "—" },
        bio: inputs.bio.length ? inputs.bio : ["Your bio goes here"],
        link: { label: inputs.linkLabel || "Link in bio", href: "#" },
        highlights: inputs.highlights,
        grid: [...pinnedTiles, ...filler],
    };
};

const PinnedPhone = ({ profile }: { profile: IgProfile }) => (
    <PhoneFrame label={`Instagram profile preview for @${profile.handle}`} className="w-[248px] sm:w-[280px]">
        <IgScreen
            label={`Instagram profile mockup for @${profile.handle} — the three pinned posts sit at the top of the grid`}
            className="size-full max-w-none"
        >
            <IgProfileScreen profile={profile} avatar={profile.avatar} tab="grid" />
        </IgScreen>
    </PhoneFrame>
);

/* ── Callout ─────────────────────────────────────────────────────────────── */

/**
 * A hand-drawn arrow from the caption up into the first row of the grid — "these three
 * tiles". Drawn in the phone's own width units (a 248-wide frame is 511 tall; the caption
 * sits below), so it scales with the frame at every breakpoint and the stroke stays even.
 * It bows out to the right of the bezel by ~40px, which is inside the gap to the post
 * cards on large screens. The first row starts between 57% and 62% of the screen and is
 * 20% tall, so aiming at 66% lands inside it whatever the bio length. Decorative only.
 */
const PinnedCallout = () => (
    <svg
        viewBox="0 0 248 600"
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 aspect-[248/600] w-[248px] -translate-x-1/2 overflow-visible text-fg-secondary sm:w-[280px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        {/* A page-coloured halo under the stroke keeps the head legible where it crosses a photo. */}
        <g className="stroke-(--color-bg-primary)" strokeWidth="6">
            <path d="M232 524 C296 512, 296 400, 226 344" />
            <path d="M226 344 L235.9 345.5 M226 344 L229.6 353.3" />
        </g>
        <path d="M232 524 C296 512, 296 400, 226 344" />
        <path d="M226 344 L235.9 345.5 M226 344 L229.6 353.3" />
    </svg>
);

/* ── Slide viewer ────────────────────────────────────────────────────────── */

/**
 * Tap-through carousel, the way the client will meet it on their phone: one 4:5 slide at a
 * time, arrows and dots, arrow keys and Escape. The caption sits under the slide as it does
 * on Instagram.
 */
const SlideViewer = ({
    post,
    index: initial,
    onClose,
    downloadStem,
}: {
    post: PinnedPost | null;
    index: number;
    onClose: () => void;
    /** When set (team only), each slide offers a JPEG download under this file stem. */
    downloadStem?: string;
}) => {
    const [index, setIndex] = useState(initial);
    const count = post?.slides.length ?? 0;

    useEffect(() => setIndex(initial), [initial, post?.id]);
    useEffect(() => {
        if (!post) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowRight") setIndex((i) => Math.min(count - 1, i + 1));
            if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [post, count, onClose]);

    const slide = post?.slides[Math.min(index, Math.max(0, count - 1))];

    return (
        <AnimatePresence>
            {post && slide && (
                <motion.div
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm sm:p-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    onClick={onClose}
                    role="dialog"
                    aria-modal="true"
                    aria-label={`${post.title || "Pinned post"} — slide ${index + 1} of ${count}`}
                >
                    <motion.div
                        className="flex w-full max-w-[420px] flex-col gap-3"
                        onClick={(e) => e.stopPropagation()}
                        initial={{ scale: 0.96, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.97, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 26 }}
                    >
                        <div className="relative overflow-hidden rounded-2xl bg-primary-solid ring-1 ring-white/10">
                            <img
                                key={slide.id}
                                src={slide.url}
                                alt={`${post.title || "Pinned post"} — slide ${index + 1}`}
                                className="block aspect-3/4 w-full object-cover"
                                draggable={false}
                            />
                            {count > 1 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setIndex((i) => Math.max(0, i - 1))}
                                        disabled={index === 0}
                                        aria-label="Previous slide"
                                        className="absolute top-1/2 left-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition duration-100 ease-linear hover:bg-black/65 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <ChevronLeft className="size-5" aria-hidden="true" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIndex((i) => Math.min(count - 1, i + 1))}
                                        disabled={index === count - 1}
                                        aria-label="Next slide"
                                        className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition duration-100 ease-linear hover:bg-black/65 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <ChevronRight className="size-5" aria-hidden="true" />
                                    </button>
                                    <span className="absolute top-3 right-3 rounded-full bg-black/55 px-2 py-0.5 text-xs font-semibold text-white tabular-nums">
                                        {index + 1}/{count}
                                    </span>
                                </>
                            )}
                        </div>
                        {count > 1 && (
                            <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
                                {post.slides.map((s, i) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setIndex(i)}
                                        className={cx(
                                            "size-1.5 rounded-full transition duration-100 ease-linear",
                                            i === index ? "bg-white" : "bg-white/35 hover:bg-white/60",
                                        )}
                                    />
                                ))}
                            </div>
                        )}
                        <div className="flex items-start justify-between gap-3 text-white">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold">{post.title || "Pinned post"}</p>
                                {post.caption.trim() && <p className="mt-1 text-sm whitespace-pre-wrap text-white/75">{post.caption}</p>}
                            </div>
                            {downloadStem && (
                                <button
                                    type="button"
                                    onClick={() => void downloadSlideJpeg(slide.url, downloadStem, index + 1)}
                                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition duration-100 ease-linear hover:bg-white/20"
                                >
                                    <Download01 className="size-3.5" aria-hidden="true" />
                                    Save slide {index + 1} as JPG
                                </button>
                            )}
                        </div>
                    </motion.div>
                    <button
                        type="button"
                        onClick={onClose}
                        title="Close"
                        className="absolute top-5 right-5 flex size-10 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-sm transition duration-100 ease-linear hover:bg-white/20"
                    >
                        <XClose className="size-5" aria-hidden="true" />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

/* ── Feedback panel ──────────────────────────────────────────────────────── */

interface FeedbackProps {
    post: PinnedPost;
    ordinal: number;
    review: PostReview;
    isTeam: boolean;
    /** The client (or a team member previewing as one) may leave feedback. */
    canReview: boolean;
    reviewerEmail: string;
    onSend: (items: SuggestionItem[]) => Promise<void>;
    onWithdraw: (s: Suggestion) => void;
    onResolve: (s: Suggestion) => void;
}

const FeedbackPanel = ({ post, ordinal, review, isTeam, canReview, reviewerEmail, onSend, onWithdraw, onResolve }: FeedbackProps) => {
    const label = `Pinned post ${ordinal}${post.title.trim() ? ` · ${post.title.trim()}` : ""}`;
    const mine = (s: Suggestion | null) => !!s && !!reviewerEmail && s.suggested_by === reviewerEmail;

    return (
        <div className="mt-4 flex flex-col gap-3 border-t border-secondary pt-4">
            {/* The team's side: every open note on this post, marked addressed here. A client
                never reads this list — their own note comes back to them inside the box. */}
            {isTeam &&
                review.openNotes.map((n) => (
                    <div key={n.id} className="rounded-xl bg-warning-primary p-3 ring-1 ring-secondary">
                        <p className="text-xs font-medium text-secondary">
                            {mine(n) ? "You asked" : `${n.suggested_by} asked`} · {shortDate(n.created_at)}
                        </p>
                        <p className="mt-1 text-sm whitespace-pre-wrap text-primary">{n.suggested_value}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Button size="sm" color="primary" iconLeading={Check} onClick={() => onResolve(n)}>
                                Mark as addressed
                            </Button>
                        </div>
                    </div>
                ))}

            {/* Legacy approvals: nobody can send one any more, but a post approved before the
                box replaced the buttons still says so to the team. */}
            {isTeam && review.approval && (
                <p className="flex items-center gap-1.5 text-xs text-success-primary">
                    <ThumbsUp className="size-3.5" aria-hidden="true" />
                    Approved by {review.approval.suggested_by} · {shortDate(review.approval.created_at)}
                </p>
            )}

            {isTeam && !review.openNote && review.lastAddressed && (
                <p className="text-xs text-quaternary">
                    The note from {shortDate(review.lastAddressed.created_at)} was addressed
                    {review.lastAddressed.resolved_at ? ` on ${shortDate(review.lastAddressed.resolved_at)}` : ""}.
                </p>
            )}

            {/* The client's side: one box, no verdict asked for. Same component as the Welcome
                Email Flow and the Landing Page, keyed to this post. */}
            {canReview && (
                <ClientFeedbackBox
                    feedback={{
                        mode: "client",
                        items: review.notes,
                        author: reviewerEmail,
                        send: (text) => onSend([{ fieldKey: feedbackKey(post.id), fieldLabel: label, currentValue: "", suggestedValue: text }]),
                        withdraw: async (s) => onWithdraw(s),
                        // The box never resolves — only the team closes a note, from the list above.
                        resolve: async () => undefined,
                    }}
                    placeholder="Anything you'd change? Name the slide if it helps — “slide 3, the dates are wrong”."
                    rows={4}
                />
            )}
        </div>
    );
};

/* ── Post cards (review mode) ────────────────────────────────────────────── */

const CoverThumb = ({ post, onOpen }: { post: PinnedPost; onOpen: () => void }) => {
    const cover = post.slides[0];
    return (
        <button
            type="button"
            onClick={onOpen}
            disabled={!cover}
            aria-label={`Open ${post.title || "pinned post"}`}
            className="relative block w-24 shrink-0 overflow-hidden rounded-xl bg-secondary ring-1 ring-secondary transition duration-100 ease-linear hover:ring-brand disabled:cursor-not-allowed disabled:opacity-50 sm:w-28"
        >
            {cover ? (
                <img src={cover.url} alt="" className="block aspect-3/4 w-full object-cover" draggable={false} />
            ) : (
                <span className="flex aspect-3/4 w-full items-center justify-center">
                    <Camera01 className="size-6 text-fg-quaternary" aria-hidden="true" />
                </span>
            )}
            {post.slides.length > 1 && (
                <span className="absolute top-1.5 right-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                    {post.slides.length}
                </span>
            )}
        </button>
    );
};

/* ── Drag and drop ───────────────────────────────────────────────────────── */

/**
 * What is being dragged. Native HTML drag-and-drop only carries strings, and `getData`
 * is unreadable during dragover, so the payload lives in React state for the drag's
 * lifetime and the data-transfer entry is just a marker that says "one of ours".
 */
type DragPayload = { kind: "pages"; ids: string[] } | { kind: "slide"; postId: string; slideId: string };
const DRAG_MARK = "application/x-hgm-pinned";
const isOurs = (e: DragEvent<Element>) => e.dataTransfer.types.includes(DRAG_MARK);

/* ── Editor (team, unlocked) ─────────────────────────────────────────────── */

/**
 * One of the three fixed slots. A drop target for imported pages and for slides dragged
 * out of another slot; drop on a slide to insert before it, anywhere else to append.
 */
const PostEditor = ({
    post,
    slot,
    drag,
    onChange,
    onClear,
    onDragSlide,
    onDragEnd,
    onDrop,
    children,
}: {
    post: PinnedPost;
    slot: number;
    drag: DragPayload | null;
    onChange: (patch: Partial<PinnedPost>) => void;
    onClear: () => void;
    onDragSlide: (e: DragEvent<Element>, slideId: string) => void;
    onDragEnd: () => void;
    /** `index` is where the payload lands in this post's slides; null appends. */
    onDrop: (index: number | null) => void;
    children?: ReactNode;
}) => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    /** Where the drop would land: a slide index, "end", or null when nothing hovers. */
    const [over, setOver] = useState<number | "end" | null>(null);
    const empty = post.slides.length === 0;
    const label = `Pinned post ${String(slot).padStart(2, "0")}`;

    const addSlides = async (e: ChangeEvent<HTMLInputElement>) => {
        // Canva exports as 0001.jpg, 0002.jpg… and a multi-select arrives in whatever order
        // the OS felt like, so sort by name to keep the carousel in page order.
        const files = [...(e.target.files ?? [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        e.target.value = "";
        if (!files.length) return;
        setBusy(true);
        setError("");
        try {
            const added = await Promise.all(files.map(async (f) => ({ id: uid(), url: await compressImageFile(f, { maxDim: SLIDE_MAX_DIM }) })));
            onChange({ slides: [...post.slides, ...added] });
        } catch {
            setError("Couldn't read one of those images — try exporting the pages again as PNG or JPG.");
        } finally {
            setBusy(false);
        }
    };
    const move = (from: number, to: number) => {
        if (to < 0 || to >= post.slides.length) return;
        const next = [...post.slides];
        const [s] = next.splice(from, 1);
        next.splice(to, 0, s);
        onChange({ slides: next });
    };

    const dragOver = (target: number | "end") => (e: DragEvent<Element>) => {
        if (!isOurs(e)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        if (over !== target) setOver(target);
    };
    const drop = (target: number | "end") => (e: DragEvent<Element>) => {
        if (!isOurs(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(null);
        onDrop(target === "end" ? null : target);
    };

    return (
        <div
            onDragOver={dragOver("end")}
            onDragLeave={(e) => {
                // Only clear when the pointer actually leaves the card, not when it crosses a child.
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
            }}
            onDrop={drop("end")}
            className={cx(
                "rounded-2xl bg-primary p-4 ring-1 transition duration-100 ease-linear",
                over !== null ? "ring-2 ring-brand" : drag ? "ring-dashed ring-brand/40" : "ring-secondary",
            )}
        >
            <div className="flex items-start gap-3">
                <span className="mt-2 shrink-0 font-mono text-xs text-quaternary tabular-nums">{String(slot).padStart(2, "0")}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <input
                        type="text"
                        value={post.title}
                        onChange={(e) => onChange({ title: e.target.value })}
                        placeholder={`${label} — what this carousel is for`}
                        className={editInput("font-semibold")}
                    />
                    <textarea
                        rows={2}
                        value={post.caption}
                        onChange={(e) => onChange({ caption: e.target.value })}
                        placeholder="Caption the client will see under the slides (optional)"
                        className={editInput("resize-y")}
                    />
                </div>
                {(!empty || post.title || post.caption) && (
                    <button
                        type="button"
                        title="Clear this post"
                        onClick={onClear}
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-error-primary hover:text-fg-error-primary"
                    >
                        <Trash01 className="size-4" aria-hidden="true" />
                    </button>
                )}
            </div>

            {/* Slides in carousel order. The first is the grid tile — the cover. */}
            {empty ? (
                <div
                    className={cx(
                        "mt-4 flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 text-center transition duration-100 ease-linear",
                        over !== null ? "border-brand bg-brand-primary" : "border-secondary bg-secondary",
                    )}
                >
                    <p className="text-sm font-medium text-tertiary">{drag ? "Drop here" : "Drag imported pages here"}</p>
                    <label
                        className={cx(
                            "cursor-pointer text-xs font-semibold text-brand-secondary transition duration-100 ease-linear hover:text-brand-secondary_hover",
                            busy && "pointer-events-none opacity-50",
                        )}
                    >
                        <input type="file" accept="image/*" multiple className="hidden" onChange={addSlides} disabled={busy} />
                        {busy ? "Adding…" : "or upload exported pages"}
                    </label>
                </div>
            ) : (
                <div className="mt-4 scrollbar-hide flex gap-2 overflow-x-auto pb-1">
                    {post.slides.map((s, i) => (
                        <div
                            key={s.id}
                            draggable
                            onDragStart={(e) => onDragSlide(e, s.id)}
                            onDragEnd={onDragEnd}
                            onDragOver={dragOver(i)}
                            onDrop={drop(i)}
                            className={cx(
                                "group relative w-20 shrink-0 cursor-grab rounded-lg active:cursor-grabbing",
                                over === i && "ring-2 ring-brand ring-offset-2 ring-offset-bg-primary",
                                drag?.kind === "slide" && drag.slideId === s.id && "opacity-40",
                            )}
                        >
                            <img
                                src={s.url}
                                alt={`Slide ${i + 1}`}
                                className="pointer-events-none block aspect-3/4 w-full rounded-lg object-cover ring-1 ring-secondary"
                                draggable={false}
                            />
                            <span
                                className={cx(
                                    "absolute top-1 left-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                                    i === 0 ? "bg-brand-solid text-white" : "bg-black/55 text-white",
                                )}
                            >
                                {i === 0 ? "Cover" : i + 1}
                            </span>
                            <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition duration-100 ease-linear group-focus-within:opacity-100 group-hover:opacity-100">
                                <button
                                    type="button"
                                    aria-label="Move slide left"
                                    onClick={() => move(i, i - 1)}
                                    disabled={i === 0}
                                    className="flex size-6 items-center justify-center rounded-md bg-black/60 text-white disabled:opacity-30"
                                >
                                    <ChevronLeft className="size-3.5" aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    aria-label="Remove slide"
                                    onClick={() => onChange({ slides: post.slides.filter((x) => x.id !== s.id) })}
                                    className="flex size-6 items-center justify-center rounded-md bg-black/60 text-white hover:bg-error-solid"
                                >
                                    <XClose className="size-3.5" aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    aria-label="Move slide right"
                                    onClick={() => move(i, i + 1)}
                                    disabled={i === post.slides.length - 1}
                                    className="flex size-6 items-center justify-center rounded-md bg-black/60 text-white disabled:opacity-30"
                                >
                                    <ChevronRight className="size-3.5" aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                    ))}
                    <label
                        className={cx(
                            "flex aspect-3/4 w-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center text-[11px] font-medium transition duration-100 ease-linear",
                            over === "end"
                                ? "border-brand text-brand-secondary"
                                : "border-secondary text-tertiary hover:border-brand hover:text-brand-secondary",
                            busy && "pointer-events-none opacity-50",
                        )}
                    >
                        <input type="file" accept="image/*" multiple className="hidden" onChange={addSlides} disabled={busy} />
                        <UploadCloud02 className={cx("size-4", busy && "animate-pulse")} aria-hidden="true" />
                        {busy ? "Adding…" : "Add slides"}
                    </label>
                </div>
            )}
            <p className="mt-2 text-[11px] text-quaternary">
                {empty
                    ? "Drag pages from the import tray, or select the exported pages of this post at once — they sort into page order."
                    : `${post.slides.length} slide${post.slides.length === 1 ? "" : "s"} · drag to reorder, or drag a slide onto another post to move it.`}
            </p>
            {error && <p className="mt-1 text-xs text-error-primary">{error}</p>}
            {children}
        </div>
    );
};

/* ── The section ─────────────────────────────────────────────────────────── */

export interface PinnedPostsSectionProps {
    pinned: PinnedPosts;
    onPatch: (patch: Partial<PinnedPosts>) => void;
    isLocked: boolean;
    isTeam: boolean;
    isTemplate: boolean;
    profile: PinnedProfileInputs;
    /** Every dashboard_suggestions row under the pinnedposts.* keys, pending and resolved. */
    feedback: Suggestion[];
    canReview: boolean;
    reviewerEmail: string;
    onSendFeedback: (items: SuggestionItem[]) => Promise<void>;
    onWithdrawFeedback: (s: Suggestion) => void;
    onResolveFeedback: (s: Suggestion) => void;
}

type TrayPage = { id: string; page: number; url: string };

export const PinnedPostsSection = ({
    pinned,
    onPatch,
    isLocked,
    isTeam,
    isTemplate,
    profile,
    feedback,
    canReview,
    reviewerEmail,
    onSendFeedback,
    onWithdrawFeedback,
    onResolveFeedback,
}: PinnedPostsSectionProps) => {
    // Three slots, always — a row saved before the slots existed is padded on the way in.
    const posts = normalizePinnedPosts(pinned.posts);
    const filled = filledPinnedPosts(posts);
    const slotOf = (post: PinnedPost) => posts.indexOf(post) + 1;
    const [viewer, setViewer] = useState<{ post: PinnedPost; index: number } | null>(null);
    /* ── Download for posting ──
       The AM posts these to Instagram by hand, from a phone or a desktop. One zip of JPEGs
       per post (slides are stored as WebP, which Instagram's uploader won't take), named
       after the post so three downloads don't collide. */
    const [downloading, setDownloading] = useState<string | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const stemFor = (post: PinnedPost) => fileStem(post.title, `pinned-post-${slotOf(post)}`);
    const downloadPost = async (post: PinnedPost) => {
        setDownloading(post.id);
        setDownloadError(null);
        try {
            await downloadSlidesZip(post.slides, stemFor(post));
        } catch (e) {
            setDownloadError(e instanceof Error ? e.message : "Couldn't prepare the download.");
        } finally {
            setDownloading(null);
        }
    };
    const canva = parseCanvaUrl(pinned.canva_url);
    const editing = isTeam && !isLocked;

    /* ── Import from Canva ──
       The portal's Canva connection (see src/lib/canva-import.ts) exports every page of the
       pasted design and hands them back here, where each goes through compressImageFile
       exactly as a hand-uploaded page would. They land in a tray — one design usually holds
       all three carousels back to back — and the AM drags them into the three slots. The
       tray is session state on purpose: the pages aren't the client's until they're in a
       post and saved, and a re-import is a few seconds. */
    const [canvaStatus, setCanvaStatus] = useState<CanvaStatus | null>(null);
    const [canvaBusy, setCanvaBusy] = useState(false);
    const [canvaNote, setCanvaNote] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
    const [importing, setImporting] = useState<string | null>(null);
    const [tray, setTray] = useState<TrayPage[]>([]);
    /** Tray pages picked for a group move, in tray order. Shift-click extends a run. */
    const [selected, setSelected] = useState<string[]>([]);
    const [lastPicked, setLastPicked] = useState<string | null>(null);
    const [drag, setDrag] = useState<DragPayload | null>(null);

    useEffect(() => {
        if (!isTeam || isTemplate) return;
        void fetchCanvaStatus().then(setCanvaStatus);
        const outcome = readCanvaOutcome();
        if (outcome) setCanvaNote(outcome);
    }, [isTeam, isTemplate]);

    const connectCanva = async () => {
        setCanvaBusy(true);
        setCanvaNote(null);
        try {
            window.location.assign(await startCanvaConnect(`${window.location.pathname}#pinnedposts`));
        } catch (e) {
            setCanvaNote({ kind: "err", text: e instanceof Error ? e.message : "Couldn't start the Canva connection." });
            setCanvaBusy(false);
        }
    };

    const importFromCanva = async () => {
        if (!canva) return;
        setCanvaNote(null);
        try {
            const { urls } = await exportCanvaDesign(canva.id, { width: SLIDE_MAX_DIM, onProgress: setImporting });
            const files = await fetchCanvaPagesAsFiles(urls, setImporting);
            setImporting("Compressing…");
            const pages = await Promise.all(
                files.map(async (f, i) => ({ id: uid(), page: i + 1, url: await compressImageFile(f, { maxDim: SLIDE_MAX_DIM }) })),
            );
            setTray((t) => [...t, ...pages]);
        } catch (e) {
            if (e instanceof CanvaNotConnectedError) void fetchCanvaStatus().then(setCanvaStatus);
            setCanvaNote({ kind: "err", text: e instanceof Error ? e.message : "Couldn't import from Canva." });
        } finally {
            setImporting(null);
        }
    };

    /* ── Placing pages ── */

    const updatePost = (id: string, patch: Partial<PinnedPost>) => onPatch({ posts: posts.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
    const clearPost = (id: string) => onPatch({ posts: posts.map((p) => (p.id === id ? { ...emptyPinnedPost(), id } : p)) });

    /** Move tray pages into a slot, at `index` (null appends), keeping their page order. */
    const dealPages = (pageIds: string[], postId: string, index: number | null = null) => {
        const moving = tray.filter((p) => pageIds.includes(p.id));
        if (!moving.length) return;
        const slides = moving.map((p) => ({ id: p.id, url: p.url }));
        onPatch({
            posts: posts.map((p) => {
                if (p.id !== postId) return p;
                const next = [...p.slides];
                next.splice(index ?? next.length, 0, ...slides);
                return { ...p, slides: next };
            }),
        });
        setTray((t) => t.filter((p) => !pageIds.includes(p.id)));
        setSelected((s) => s.filter((id) => !pageIds.includes(id)));
    };

    /** Move one slide within a post or into another, landing at `index` (null appends). */
    const moveSlide = (fromPostId: string, slideId: string, toPostId: string, index: number | null) => {
        const from = posts.find((p) => p.id === fromPostId);
        const slide = from?.slides.find((s) => s.id === slideId);
        if (!from || !slide) return;
        onPatch({
            posts: posts.map((p) => {
                let slides = p.id === fromPostId ? p.slides.filter((s) => s.id !== slideId) : p.slides;
                if (p.id === toPostId) {
                    slides = [...slides];
                    // The removal above shifted anything after the source slot back by one.
                    const fromIdx = from.slides.findIndex((s) => s.id === slideId);
                    const at = index === null ? slides.length : p.id === fromPostId && index > fromIdx ? index - 1 : index;
                    slides.splice(Math.min(at, slides.length), 0, slide);
                }
                return slides === p.slides ? p : { ...p, slides };
            }),
        });
    };

    const startDrag = (e: DragEvent<Element>, payload: DragPayload) => {
        e.dataTransfer.setData(DRAG_MARK, "1");
        e.dataTransfer.effectAllowed = "move";
        setDrag(payload);
    };
    const endDrag = () => setDrag(null);
    const dropInto = (postId: string, index: number | null) => {
        if (!drag) return;
        if (drag.kind === "pages") dealPages(drag.ids, postId, index);
        else moveSlide(drag.postId, drag.slideId, postId, index);
        setDrag(null);
    };

    /** Click picks a page; shift-click picks the run between it and the last pick. */
    const pickPage = (id: string, shift: boolean) => {
        const order = tray.map((p) => p.id);
        setSelected((cur) => {
            if (shift && lastPicked && order.includes(lastPicked)) {
                const [a, b] = [order.indexOf(lastPicked), order.indexOf(id)].sort((x, y) => x - y);
                const run = order.slice(a, b + 1);
                return order.filter((pid) => cur.includes(pid) || run.includes(pid));
            }
            return cur.includes(id) ? cur.filter((pid) => pid !== id) : order.filter((pid) => cur.includes(pid) || pid === id);
        });
        setLastPicked(id);
    };
    /** What a drag from the tray carries: the selection when the page is part of it, else that page. */
    const trayDragIds = (id: string) => (selected.includes(id) ? selected : [id]);
    /** The header buttons act on the selection, or on the whole tray when nothing is picked. */
    const trayTargetIds = selected.length ? selected : tray.map((p) => p.id);

    const igProfile = buildProfile({ ...profile, handle: pinned.handle.trim() || profile.handle }, posts);

    const loadSample = () =>
        onPatch({
            // Fresh ids, so a test client's sample rows never share feedback keys with the template's.
            posts: SAMPLE_PINNED_POSTS.posts.map((p) => ({
                ...emptyPinnedPost(),
                title: p.title,
                caption: p.caption,
                slides: p.slides.map((s) => ({ id: uid(), url: s.url })),
            })),
            handle: pinned.handle || SAMPLE_PINNED_POSTS.handle,
            canva_url: pinned.canva_url || SAMPLE_PINNED_POSTS.canva_url,
        });

    const openCount = filled.filter((p) => reviewFor(p.id, feedback).openNote).length;
    const approvedCount = filled.filter((p) => reviewFor(p.id, feedback).approval).length;

    return (
        <Reveal>
            <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                    <SectionEyebrow section="pinnedposts" />
                </div>
                {isTeam && openCount > 0 && (
                    <Badge color="warning" size="md" type="pill-color">
                        {openCount} change request{openCount === 1 ? "" : "s"}
                    </Badge>
                )}
                {isTeam && filled.length > 0 && approvedCount === filled.length && (
                    <Badge color="success" size="md" type="pill-color">
                        All approved
                    </Badge>
                )}
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3">
                <SectionHeading>Pinned Posts</SectionHeading>
                {isTeam && canva && isLocked && (
                    <Button href={canva.url} target="_blank" rel="noopener noreferrer" color="link-color" size="md" iconTrailing={LinkExternal01}>
                        Open in Canva
                    </Button>
                )}
            </div>
            <p className="mt-3 max-w-2xl text-md text-tertiary">
                Three posts pinned to the top of your Instagram grid, so every guest who lands on your profile meets them first: follow to win a stay, sign up
                for the discount, book direct. Tap through each one below.
                {canReview && " Anything you'd change? Leave a note under the post — your account manager reads it."}
            </p>

            {/* ── Team settings: the Canva source and the handle on the phone ── */}
            {editing && (
                <div className="mt-6 rounded-2xl bg-secondary p-4 ring-1 ring-secondary">
                    <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-secondary">Canva design link</span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="url"
                                    value={pinned.canva_url}
                                    onChange={(e) => onPatch({ canva_url: e.target.value })}
                                    placeholder="https://www.canva.com/design/…/edit"
                                    className={editInput()}
                                />
                                {canva && (
                                    <Button
                                        href={canva.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        color="secondary"
                                        size="sm"
                                        iconTrailing={LinkExternal01}
                                    >
                                        Open
                                    </Button>
                                )}
                                {canvaStatus && !canvaStatus.connected && canvaStatus.configured ? (
                                    <Button size="sm" iconLeading={Link01} isLoading={canvaBusy} showTextWhileLoading onClick={() => void connectCanva()}>
                                        Connect Canva
                                    </Button>
                                ) : (
                                    <Button
                                        size="sm"
                                        iconLeading={Download01}
                                        isDisabled={!canva || (!!canvaStatus && !canvaStatus.connected)}
                                        isLoading={!!importing}
                                        showTextWhileLoading
                                        onClick={() => void importFromCanva()}
                                    >
                                        {importing ?? "Import from Canva"}
                                    </Button>
                                )}
                            </div>
                            {pinned.canva_url.trim() && !canva && (
                                <span className="text-xs text-warning-primary">That doesn't look like a Canva design link.</span>
                            )}
                            {canvaNote && (
                                <span className={cx("text-xs", canvaNote.kind === "ok" ? "text-success-primary" : "text-error-primary")}>{canvaNote.text}</span>
                            )}
                            {canvaStatus && !canvaStatus.configured && (
                                <span className="text-xs text-quaternary">Canva isn't set up on the portal yet — export the pages yourself for now.</span>
                            )}
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-secondary">Instagram handle</span>
                            <div className="relative">
                                <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-quaternary">@</span>
                                <input
                                    type="text"
                                    value={pinned.handle}
                                    onChange={(e) => onPatch({ handle: e.target.value.replace(/^@/, "") })}
                                    placeholder={profile.handle || "yourhandle"}
                                    className={editInput("pl-6")}
                                />
                            </div>
                        </label>
                    </div>
                    <ol className="mt-4 grid gap-2 text-xs text-tertiary sm:grid-cols-3">
                        <li className="rounded-lg bg-primary px-3 py-2 ring-1 ring-secondary">
                            <span className="font-semibold text-secondary">1 · Design in Canva.</span> One design, one page per slide, 4:5. Paste its link
                            above.
                        </li>
                        <li className="rounded-lg bg-primary px-3 py-2 ring-1 ring-secondary">
                            <span className="font-semibold text-secondary">2 · Import and drag.</span> Press Import from Canva, then drag each page onto post
                            01, 02 or 03. Shift-click picks a run of pages so a whole carousel moves in one drag.
                        </li>
                        <li className="rounded-lg bg-primary px-3 py-2 ring-1 ring-secondary">
                            <span className="font-semibold text-secondary">3 · Save and reveal.</span> Title each post, save, then reveal the section with the
                            eye. The client approves or requests changes here.
                        </li>
                    </ol>

                    {/* ── Imported pages, waiting to be dragged into the three slots ── */}
                    {tray.length > 0 && (
                        <div className="mt-4 rounded-xl bg-primary p-3 ring-1 ring-secondary">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-primary">
                                    Imported pages{" "}
                                    <span className="font-normal text-quaternary">
                                        · {tray.length} waiting{selected.length ? ` · ${selected.length} selected` : ""}
                                    </span>
                                </p>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-xs text-tertiary">{selected.length ? `Add ${selected.length} selected to` : "Add all to"}</span>
                                    {posts.map((post, i) => (
                                        <Button key={post.id} size="sm" color="secondary" onClick={() => dealPages(trayTargetIds, post.id)}>
                                            {String(i + 1).padStart(2, "0")}
                                        </Button>
                                    ))}
                                    {selected.length > 0 && (
                                        <Button size="sm" color="tertiary" onClick={() => setSelected([])}>
                                            Deselect
                                        </Button>
                                    )}
                                    <Button size="sm" color="tertiary" onClick={() => (setTray([]), setSelected([]))}>
                                        Clear
                                    </Button>
                                </div>
                            </div>
                            <p className="mt-1 text-xs text-tertiary">
                                Drag a page onto a post below, or click pages to pick several (shift-click for a run) and drag them together. Pages stay here
                                only until you place them; a re-import brings them back.
                            </p>
                            <div className="mt-3 scrollbar-hide flex gap-3 overflow-x-auto pb-1">
                                {tray.map((p) => {
                                    const picked = selected.includes(p.id);
                                    const lifting = drag?.kind === "pages" && drag.ids.includes(p.id);
                                    return (
                                        <div key={p.id} className="flex w-24 shrink-0 flex-col gap-1.5">
                                            <div
                                                role="button"
                                                tabIndex={0}
                                                aria-pressed={picked}
                                                aria-label={`Page ${p.page}${picked ? ", selected" : ""}`}
                                                draggable
                                                onClick={(e) => pickPage(p.id, e.shiftKey)}
                                                onKeyDown={(e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), pickPage(p.id, e.shiftKey))}
                                                onDragStart={(e) => startDrag(e, { kind: "pages", ids: trayDragIds(p.id) })}
                                                onDragEnd={endDrag}
                                                className={cx(
                                                    "relative cursor-grab rounded-lg transition duration-100 ease-linear outline-none focus-visible:ring-2 focus-visible:ring-brand active:cursor-grabbing",
                                                    picked && "ring-2 ring-brand ring-offset-2 ring-offset-bg-primary",
                                                    lifting && "opacity-40",
                                                )}
                                            >
                                                <img
                                                    src={p.url}
                                                    alt=""
                                                    className="pointer-events-none block aspect-3/4 w-full rounded-lg object-cover ring-1 ring-secondary"
                                                    draggable={false}
                                                />
                                                <span className="absolute top-1 left-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                                                    p{p.page}
                                                </span>
                                                {picked && (
                                                    <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-brand-solid text-white">
                                                        <Check className="size-3" aria-hidden="true" />
                                                    </span>
                                                )}
                                            </div>
                                            {/* Keyboard and touch fallback for the drag. */}
                                            <select
                                                aria-label={`Add page ${p.page} to a post`}
                                                value=""
                                                onChange={(e) => e.target.value && dealPages(trayDragIds(p.id), e.target.value)}
                                                className={editInput("px-1.5 py-1 text-xs")}
                                            >
                                                <option value="">Add to…</option>
                                                {posts.map((post, i) => (
                                                    <option key={post.id} value={post.id}>
                                                        {String(i + 1).padStart(2, "0")} {post.title.trim() || `Pinned post ${i + 1}`}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="mt-8 grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-12">
                {/* ── The phone: how the profile opens for a guest ── */}
                {/* Not sticky: the editor below runs long (tray plus three slots), and a phone that
                    follows the scroll covers what the AM is dragging past. It scrolls with the page. */}
                <div className="relative flex flex-col items-center lg:self-start">
                    <PinnedPhone profile={igProfile} />
                    <p className="mt-4 max-w-[260px] text-center text-xs text-quaternary">
                        How <span className="font-medium text-tertiary">@{igProfile.handle}</span> opens for a guest — the pinned posts are the first three
                        tiles.
                    </p>
                    {filled.length > 0 && <PinnedCallout />}
                </div>

                {/* ── The posts ── */}
                <div className="flex flex-col gap-4">
                    {filled.length === 0 && !editing && (
                        <div className="flex items-center gap-3 rounded-xl bg-secondary px-4 py-5">
                            <Camera01 className="size-5 shrink-0 text-fg-quaternary" aria-hidden="true" />
                            <p className="text-sm text-tertiary">
                                {isTeam
                                    ? "No posts yet — unlock to paste the Canva link and import the pages."
                                    : "Your pinned posts are on the way — the HiddenGem team will add them here."}
                            </p>
                        </div>
                    )}

                    {editing
                        ? posts.map((post, i) => (
                              <PostEditor
                                  key={post.id}
                                  post={post}
                                  slot={i + 1}
                                  drag={drag}
                                  onChange={(patch) => updatePost(post.id, patch)}
                                  onClear={() => clearPost(post.id)}
                                  onDragSlide={(e, slideId) => startDrag(e, { kind: "slide", postId: post.id, slideId })}
                                  onDragEnd={endDrag}
                                  onDrop={(index) => dropInto(post.id, index)}
                              >
                                  {feedback.some((s) => s.field_key.startsWith(`${KEY_PREFIX}${post.id}.`)) && (
                                      <FeedbackPanel
                                          post={post}
                                          ordinal={i + 1}
                                          review={reviewFor(post.id, feedback)}
                                          isTeam
                                          canReview={false}
                                          reviewerEmail={reviewerEmail}
                                          onSend={onSendFeedback}
                                          onWithdraw={onWithdrawFeedback}
                                          onResolve={onResolveFeedback}
                                      />
                                  )}
                              </PostEditor>
                          ))
                        : filled.map((post) => (
                              <article key={post.id} className="rounded-2xl bg-primary p-4 ring-1 ring-secondary sm:p-5">
                                  <div className="flex gap-4">
                                      <CoverThumb post={post} onOpen={() => setViewer({ post, index: 0 })} />
                                      <div className="flex min-w-0 flex-1 flex-col">
                                          <div className="flex flex-wrap items-center gap-2">
                                              <span className="font-mono text-xs text-quaternary tabular-nums">{String(slotOf(post)).padStart(2, "0")}</span>
                                              <StatusBadge review={reviewFor(post.id, feedback)} forTeam={isTeam} />
                                          </div>
                                          <h3 className="mt-1.5 text-md font-semibold text-primary">{post.title.trim() || `Pinned post ${slotOf(post)}`}</h3>
                                          {post.caption.trim() && <p className="mt-1 line-clamp-3 text-sm text-tertiary">{post.caption}</p>}
                                          <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                                              <Button size="sm" color="secondary" iconTrailing={ChevronRight} onClick={() => setViewer({ post, index: 0 })}>
                                                  {post.slides.length > 1 ? `View all ${post.slides.length} slides` : "View post"}
                                              </Button>
                                              {isTeam && (
                                                  <Button
                                                      size="sm"
                                                      color="secondary"
                                                      iconLeading={Download01}
                                                      isLoading={downloading === post.id}
                                                      showTextWhileLoading
                                                      onClick={() => void downloadPost(post)}
                                                  >
                                                      {downloading === post.id
                                                          ? "Preparing…"
                                                          : `Download ${post.slides.length} slide${post.slides.length === 1 ? "" : "s"} (JPG)`}
                                                  </Button>
                                              )}
                                          </div>
                                          {isTeam && downloadError && downloading === null && (
                                              <p className="mt-1.5 text-xs text-error-primary">{downloadError}</p>
                                          )}
                                      </div>
                                  </div>
                                  {/* Slide strip — every page at a glance, each opening the viewer at itself. */}
                                  {post.slides.length > 1 && (
                                      <div className="mt-4 scrollbar-hide flex gap-1.5 overflow-x-auto">
                                          {post.slides.map((s, si) => (
                                              <button
                                                  key={s.id}
                                                  type="button"
                                                  onClick={() => setViewer({ post, index: si })}
                                                  aria-label={`Slide ${si + 1}`}
                                                  className="w-14 shrink-0 overflow-hidden rounded-md ring-1 ring-secondary transition duration-100 ease-linear hover:ring-brand"
                                              >
                                                  <img src={s.url} alt="" className="block aspect-3/4 w-full object-cover" draggable={false} loading="lazy" />
                                              </button>
                                          ))}
                                      </div>
                                  )}
                                  {(canReview || isTeam) && (
                                      <FeedbackPanel
                                          post={post}
                                          ordinal={slotOf(post)}
                                          review={reviewFor(post.id, feedback)}
                                          isTeam={isTeam}
                                          canReview={canReview}
                                          reviewerEmail={reviewerEmail}
                                          onSend={onSendFeedback}
                                          onWithdraw={onWithdrawFeedback}
                                          onResolve={onResolveFeedback}
                                      />
                                  )}
                              </article>
                          ))}

                    {editing && filled.length === 0 && !isTemplate && (
                        <div>
                            <Button size="sm" color="tertiary" onClick={loadSample}>
                                Load the sample set to try it
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <SlideViewer
                post={viewer?.post ?? null}
                index={viewer?.index ?? 0}
                onClose={() => setViewer(null)}
                downloadStem={isTeam && viewer ? stemFor(viewer.post) : undefined}
            />
        </Reveal>
    );
};
