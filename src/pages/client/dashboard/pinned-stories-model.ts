/**
 * Marketing → Pinned Stories — the pure model.
 *
 * The shapes stored in `pinned_stories.data`, the North Star sample the team can load to
 * see the section working before a client's own design exists, and the small helpers the
 * section and the Netlify functions share (Canva link parsing, arranging pages into
 * highlights). No JSX and no React, so a script can import it without pulling in the UI.
 *
 * Vocabulary, matching Instagram's: a HIGHLIGHT is one circle pinned to the profile, with
 * a COVER image and an ordered run of SLIDES. A Canva "Story Highlights" design is one
 * file holding several highlights, conventionally as [cover, slides…, cover, slides…], so
 * the AM's job after import is to say which page is which.
 */
import { uid } from "@/pages/client/dashboard/dashboard-model";

export interface StorySlide {
    id: string;
    kind: "image" | "video";
    /** Public URL — Supabase Storage, or a /public path for the sample. */
    url: string;
    /** 1-based page number in the source design, kept so the team can cross-reference Canva. */
    page: number;
}

export interface StoryHighlight {
    id: string;
    title: string;
    /** Cover image URL. Empty falls back to the first slide. */
    cover: string;
    slides: StorySlide[];
}

export interface StorySource {
    via: "canva" | "upload" | "sample";
    canvaUrl: string;
    designId: string;
    designTitle: string;
    importedAt: string;
    importedBy: string;
}

export interface StoryComment {
    id: string;
    /** Empty when the note is about the whole set rather than one slide. */
    highlightId: string;
    slideId: string;
    text: string;
    by: string;
    at: string;
    /** Ticked by the team once handled — stays visible so the client sees it was read. */
    resolved?: boolean;
}

export interface StoryReview {
    status: "pending" | "approved" | "changes";
    respondedAt?: string;
    respondedBy?: string;
    comments: StoryComment[];
}

export interface StoryVersion {
    id: string;
    highlights: StoryHighlight[];
    source: StorySource;
    publishedAt: string;
    publishedBy: string;
    /** Each version carries its own review, so feedback on v1 survives publishing v2. */
    review: StoryReview;
    /**
     * Imported pages that were left in the tray when this was published. Never shown to
     * the client; kept so "Make changes" gives the AM the whole import back rather than only
     * the pages they placed. Older versions don't have it.
     */
    unassigned?: StorySlide[];
}

/** The team's working copy — imported but not yet shown to the client. */
export interface StoryDraft {
    highlights: StoryHighlight[];
    /** Imported pages not yet placed in a highlight. */
    unassigned: StorySlide[];
    source: StorySource;
}

export interface PinnedStoriesData {
    draft: StoryDraft | null;
    /** Newest first — versions[0] is what the client sees. */
    versions: StoryVersion[];
}

export const EMPTY_PINNED_STORIES: PinnedStoriesData = { draft: null, versions: [] };

export const EMPTY_REVIEW: StoryReview = { status: "pending", comments: [] };

/** Seconds an image slide stays up before the player advances — Instagram's own timing. */
export const IMAGE_SLIDE_SECONDS = 5;

/** Merge whatever an older row holds over the empty shape so no renderer meets undefined. */
export const mergePinnedStories = (partial?: Partial<PinnedStoriesData> | null): PinnedStoriesData => ({
    draft: partial?.draft ?? null,
    versions: Array.isArray(partial?.versions)
        ? partial.versions.map((v) => ({ ...v, review: { ...EMPTY_REVIEW, ...v.review, comments: v.review?.comments ?? [] } }))
        : [],
});

/* ── Canva links ─────────────────────────────────────────────────────────── */

/** Canva links are parsed by parseCanvaUrl in dashboard-model.ts — shared with Pinned Posts. */
export const canvaEditUrl = (designId: string) => `https://www.canva.com/design/${designId}/edit`;

/* ── Arranging pages ─────────────────────────────────────────────────────── */

/**
 * A draft straight after import: every page in the tray, no highlights yet. One Canva
 * story file usually holds several highlights back to back, so pre-filling one highlight
 * with all twenty pages only gave the AM something to take apart. From the tray they star
 * the cover pages and build the highlights in one move (see buildHighlightsFromCovers), or
 * drag pages where they belong.
 */
export const draftFromPages = (pages: StorySlide[], source: StorySource): StoryDraft => ({
    highlights: [],
    unassigned: pages,
    source,
});

export const emptyHighlight = (n: number): StoryHighlight => ({ id: uid(), title: `Highlight ${n}`, cover: "", slides: [] });

/** Where a slide currently lives in a draft: the tray, or one highlight's run. */
export type SlideHome = { kind: "tray" } | { kind: "highlight"; highlightId: string };

export const findSlide = (d: StoryDraft, slideId: string): { slide: StorySlide; home: SlideHome } | null => {
    const inTray = d.unassigned.find((s) => s.id === slideId);
    if (inTray) return { slide: inTray, home: { kind: "tray" } };
    for (const h of d.highlights) {
        const s = h.slides.find((x) => x.id === slideId);
        if (s) return { slide: s, home: { kind: "highlight", highlightId: h.id } };
    }
    return null;
};

/** The draft without `slideId` anywhere — the first half of every move. */
const withoutSlide = (d: StoryDraft, slideId: string): StoryDraft => ({
    ...d,
    unassigned: d.unassigned.filter((s) => s.id !== slideId),
    highlights: d.highlights.map((h) => ({ ...h, slides: h.slides.filter((s) => s.id !== slideId) })),
});

/**
 * Move one slide to the tray (`highlightId` null) or into a highlight's run, at `index`
 * (append when omitted or out of range). Same-run moves reorder. Never mutates.
 */
export const moveSlideTo = (d: StoryDraft, slideId: string, highlightId: string | null, index?: number): StoryDraft => {
    const found = findSlide(d, slideId);
    if (!found) return d;
    const base = withoutSlide(d, slideId);
    const insert = (list: StorySlide[]) => {
        const at = index === undefined || index < 0 || index > list.length ? list.length : index;
        return [...list.slice(0, at), found.slide, ...list.slice(at)];
    };
    if (highlightId === null) return { ...base, unassigned: insert(base.unassigned) };
    const target = base.highlights.find((h) => h.id === highlightId);
    if (!target) return d;
    // The first image dropped into an empty, coverless highlight IS its cover: a Canva story
    // file runs [cover, slides…] and the icon page is never a story frame.
    if (!target.cover && target.slides.length === 0 && found.slide.kind === "image") {
        return { ...base, highlights: base.highlights.map((h) => (h.id === highlightId ? { ...h, cover: found.slide.url } : h)) };
    }
    return { ...base, highlights: base.highlights.map((h) => (h.id === highlightId ? { ...h, slides: insert(h.slides) } : h)) };
};

/**
 * Use `slideId`'s image as `highlightId`'s cover and take the page out of every run — a
 * cover is a circle on the profile, never a story frame. Video pages can't be covers.
 */
export const setCoverFromSlide = (d: StoryDraft, slideId: string, highlightId: string): StoryDraft => {
    const found = findSlide(d, slideId);
    if (!found || found.slide.kind !== "image") return d;
    const base = withoutSlide(d, slideId);
    return { ...base, highlights: base.highlights.map((h) => (h.id === highlightId ? { ...h, cover: found.slide.url } : h)) };
};

/**
 * The one-move arrange for the Canva convention [cover, slides…, cover, slides…]: the AM
 * stars the cover pages in the tray and this builds one highlight per cover, in page
 * order, each holding the tray pages that follow it up to the next cover. Tray pages
 * before the first cover stay in the tray. Existing highlights are kept and the new ones
 * appended, so it can be run again after another import.
 */
export const buildHighlightsFromCovers = (d: StoryDraft, coverIds: string[]): StoryDraft => {
    const tray = [...d.unassigned].sort((a, b) => a.page - b.page);
    const covers = new Set(coverIds.filter((id) => tray.some((s) => s.id === id && s.kind === "image")));
    if (!covers.size) return d;
    const built: StoryHighlight[] = [];
    const leftover: StorySlide[] = [];
    let current: StoryHighlight | null = null;
    for (const s of tray) {
        if (covers.has(s.id)) {
            current = { ...emptyHighlight(d.highlights.length + built.length + 1), cover: s.url };
            built.push(current);
        } else if (current) current.slides.push(s);
        else leftover.push(s);
    }
    return { ...d, highlights: [...d.highlights, ...built], unassigned: leftover };
};

/** The image a highlight's circle shows — its cover, else its first slide. */
export const coverOf = (h: StoryHighlight): string => h.cover || h.slides.find((s) => s.kind === "image")?.url || h.slides[0]?.url || "";

/**
 * True when the highlight has no explicit cover and is standing in with its first slide —
 * that slide is then the icon only, and storyFrames() leaves it out of playback.
 */
export const firstSlideIsCover = (h: StoryHighlight): boolean => !h.cover && h.slides.length > 1 && h.slides[0].kind === "image";

/** The frames that actually play — every slide, minus the one doubling as the cover icon. */
export const storyFrames = (h: StoryHighlight): StorySlide[] => (firstSlideIsCover(h) ? h.slides.slice(1) : h.slides);

/** Publishable = at least one highlight with at least one slide. */
export const draftPublishable = (d: StoryDraft | null): boolean => !!d && d.highlights.some((h) => storyFrames(h).length > 0);

export const totalSlides = (highlights: StoryHighlight[]) => highlights.reduce((n, h) => n + storyFrames(h).length, 0);

/* ── The sample ──────────────────────────────────────────────────────────── */

/**
 * North Star Lodge (Killington, VT), exported from the team's own Canva file
 * "North Star Story Highlights" (DAHSwF8HKF8) — the 20 pages live in
 * /public/pinned-stories-sample so the section can be shown working on any dashboard
 * before that client's design exists. Page numbers are the Canva page numbers; the file
 * follows the [cover, slides…] convention, which is why covers are pages 1, 3, 7, 9, 16.
 */
const samplePage = (n: number): StorySlide => ({
    id: `sample-${n}`,
    kind: "image",
    url: `/pinned-stories-sample/page-${String(n).padStart(2, "0")}.jpg`,
    page: n,
});

export const SAMPLE_CANVA_URL = "https://www.canva.com/design/DAHSwF8HKF8/AbLwOWABn26fc82W03Kfnw/edit";

export const sampleDraft = (importedBy: string): StoryDraft => ({
    highlights: [
        { id: "sample-location", title: "Location", cover: samplePage(1).url, slides: [samplePage(2)] },
        { id: "sample-welcome", title: "Welcome", cover: samplePage(3).url, slides: [samplePage(4), samplePage(5), samplePage(6)] },
        { id: "sample-newsletter", title: "Save 10%", cover: samplePage(7).url, slides: [samplePage(8)] },
        { id: "sample-faq", title: "FAQ", cover: samplePage(9).url, slides: [10, 11, 12, 13, 14, 15].map(samplePage) },
        { id: "sample-reviews", title: "Reviews", cover: samplePage(16).url, slides: [17, 18, 19, 20].map(samplePage) },
    ],
    unassigned: [],
    source: {
        via: "sample",
        canvaUrl: SAMPLE_CANVA_URL,
        designId: "DAHSwF8HKF8",
        designTitle: "North Star Story Highlights",
        importedAt: new Date().toISOString(),
        importedBy,
    },
});
