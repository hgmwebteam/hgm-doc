import { type DragEvent, useCallback, useEffect, useState } from "react";
import {
    AlertCircle,
    Check,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Download01,
    Image03,
    Link01,
    LinkExternal01,
    MessageChatCircle,
    Plus,
    RefreshCw01,
    Star01,
    Trash01,
    XClose,
} from "@untitledui/icons";
import { FileUploadDropZone } from "@/components/application/file-upload/file-upload-base";
import { PROFILE, StoryPlayer, type StoryPosition } from "@/components/application/story-player";
import { Badge, BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { PhoneFrame } from "@/components/shared-assets/phone-frame";
import {
    CanvaNotConnectedError,
    type CanvaStatus,
    disconnectCanva as disconnectCanvaRemote,
    exportCanvaDesign,
    fetchCanvaStatus,
    readCanvaOutcome,
    startCanvaConnect,
    storeCanvaPages,
} from "@/lib/canva-import";
import { STORIES_SECTION, recordDashboardPublish } from "@/lib/dashboard-updates";
import { supabase } from "@/lib/supabase";
import { ClientFeedbackBox, type ClientFeedbackProps, ClientFeedbackReview } from "@/pages/client/dashboard/client-feedback";
import { type PinnedPost, parseCanvaUrl, uid } from "@/pages/client/dashboard/dashboard-model";
import { type PinnedProfileInputs, buildProfile } from "@/pages/client/dashboard/pinned-posts";
import {
    EMPTY_PINNED_STORIES,
    EMPTY_REVIEW,
    type PinnedStoriesData,
    type StoryComment,
    type StoryDraft,
    type StoryHighlight,
    type StoryReview,
    type StorySlide,
    type StoryVersion,
    buildHighlightsFromCovers,
    canvaEditUrl,
    coverOf,
    draftFromPages,
    draftPublishable,
    emptyHighlight,
    firstSlideIsCover,
    mergePinnedStories,
    moveSlideTo,
    sampleDraft,
    setCoverFromSlide,
    storyFrames,
    totalSlides,
} from "@/pages/client/dashboard/pinned-stories-model";
import { compressImageFile } from "@/utils/compress-image";
import { cx } from "@/utils/cx";

/**
 * Marketing → Pinned Stories.
 *
 * The workflow, end to end:
 *   1. The AM pastes the Canva link (or uploads the pages Canva exports). The pages land
 *      in the `stories` bucket and become a DRAFT only the team sees.
 *   2. The AM arranges the pages into highlights — which page is a cover, what each circle
 *      is called, what order the slides play in — watching the phone update as they go.
 *   3. Publish. The set becomes the live version; the client's dashboard now plays it in
 *      the same phone, and they leave notes on individual slides or approve the lot.
 *   4. Notes come back here as a list the AM works through; a new import + publish sends
 *      v2 back for review while v1's notes stay on v1.
 *
 * Beside all of that sits the shared client feedback box (client-feedback.tsx, also on the
 * welcome emails and the landing page): one open-ended note on the section, which survives
 * the approval that closes step 3. It rides dashboard_suggestions, not pinned_stories, so
 * it is not versioned and not tied to a slide — the AM reads it in the list above Versions.
 *
 * Persistence: pinned_stories (see the 20260910180000 migration). Team writes go straight
 * to Supabase under the team-only policy; the client's notes/approval go through
 * pinned-stories-review.mts, the same shape as the landing page and suggestion flows. The
 * Canva half goes through canva-import.mts.
 */

const REVIEW_ENDPOINT = "/.netlify/functions/pinned-stories-review";
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // keep in sync with the bucket's file_size_limit

const shortDate = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
};

const inputCls =
    "w-full rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary placeholder:text-placeholder outline-none transition duration-100 ease-linear focus:border-brand focus:ring-1 focus:ring-brand";

const dataUrlToBlob = async (dataUrl: string) => (await fetch(dataUrl)).blob();

/** A thumbnail of one slide — image or the first frame of a video. */
const SlideThumb = ({ slide, className }: { slide: StorySlide; className?: string }) =>
    slide.kind === "video" ? (
        <video src={slide.url} muted playsInline preload="metadata" className={cx("pointer-events-none size-full object-cover", className)} />
    ) : (
        <img src={slide.url} alt="" className={cx("size-full object-cover", className)} draggable={false} />
    );

const REVIEW_BADGE: Record<StoryReview["status"], { color: "warning" | "success" | "gray"; text: string }> = {
    pending: { color: "warning", text: "Awaiting review" },
    approved: { color: "success", text: "Approved" },
    changes: { color: "gray", text: "Notes from the client" },
};

export const PinnedStoriesSection = ({
    slug,
    clientName,
    profile,
    pinnedPosts,
    isTeam,
    isLocked,
    isTemplate,
    teamName,
    clientEmail,
    feedback,
}: {
    slug?: string;
    clientName: string;
    /** The Instagram account the phone shows — the same inputs Pinned Posts renders, so both mockups agree. */
    profile: PinnedProfileInputs;
    /** The published pinned carousels, so the profile's grid matches the Pinned Posts section next door. */
    pinnedPosts: PinnedPost[];
    isTeam: boolean;
    isLocked: boolean;
    isTemplate: boolean;
    /** Signed-in AM's display name — attributed on imports and publishes. */
    teamName: string;
    /** The client's own identity email; empty for team / an anonymous unlock, which hides the review controls. */
    clientEmail: string;
    /**
     * The shared client feedback box (client-feedback.tsx), riding dashboard_suggestions —
     * NOT the per-slide notes and Approve all above it, which live in pinned_stories and
     * close on one published version. This is the channel that stays open after an
     * approval, so "actually, could we swap the cover?" has somewhere to go.
     */
    feedback?: ClientFeedbackProps;
}) => {
    const [data, setData] = useState<PinnedStoriesData>(EMPTY_PINNED_STORIES);
    const [position, setPosition] = useState<StoryPosition>(PROFILE);

    const [canvaLink, setCanvaLink] = useState("");
    const [importing, setImporting] = useState<string | null>(null);
    const [importErr, setImportErr] = useState("");
    const [canva, setCanva] = useState<CanvaStatus | null>(null);
    const [canvaBusy, setCanvaBusy] = useState(false);
    const [canvaNote, setCanvaNote] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
    const [showImport, setShowImport] = useState(false);

    const [publishing, setPublishing] = useState(false);
    const [saveErr, setSaveErr] = useState("");

    const [noteFor, setNoteFor] = useState<{ highlightId: string; slideId: string } | null>(null);
    const [noteText, setNoteText] = useState("");
    const [reviewBusy, setReviewBusy] = useState(false);
    const [reviewErr, setReviewErr] = useState("");

    const canEdit = isTeam && !isLocked && !isTemplate;

    /* ── Canva connection (team only) ──
       Asked once per mount; the answer decides whether the import button, Connect Canva,
       or "not set up" shows. The `?canva=` query is what canva-auth.mts sends the AM back
       with after the OAuth round-trip — read it, say what happened, and clean the URL. */
    const refreshCanva = useCallback(async () => setCanva(await fetchCanvaStatus()), []);
    useEffect(() => {
        if (!isTeam || isTemplate) return;
        void refreshCanva();
        const outcome = readCanvaOutcome();
        if (outcome) setCanvaNote(outcome);
    }, [isTeam, isTemplate, refreshCanva]);

    const connectCanva = async () => {
        setCanvaBusy(true);
        setCanvaNote(null);
        try {
            window.location.assign(await startCanvaConnect(`${window.location.pathname}#pinnedstories`));
        } catch (e) {
            setCanvaNote({ kind: "err", text: e instanceof Error ? e.message : "Couldn't start the Canva connection." });
            setCanvaBusy(false);
        }
    };

    const disconnectCanva = async () => {
        setCanvaBusy(true);
        try {
            await disconnectCanvaRemote();
            await refreshCanva();
        } finally {
            setCanvaBusy(false);
        }
    };

    /* ── Load ── */
    useEffect(() => {
        if (isTemplate) {
            // The shared template shows the sample as though it were live, so the section
            // can be demonstrated without a client row and without writing anything.
            const d = sampleDraft("HiddenGem");
            setData({
                draft: null,
                versions: [
                    {
                        id: "sample",
                        highlights: d.highlights,
                        source: d.source,
                        publishedAt: new Date().toISOString(),
                        publishedBy: "HiddenGem",
                        review: EMPTY_REVIEW,
                    },
                ],
            });
            return;
        }
        if (!slug) return;
        supabase
            .from("pinned_stories")
            .select("data")
            .eq("slug", slug)
            .maybeSingle()
            .then(({ data: row, error }) => {
                if (error) return;
                const merged = mergePinnedStories(row?.data as Partial<PinnedStoriesData> | null);
                setData(merged);
            });
    }, [slug, isTemplate]);

    const live = data.versions[0];
    const draft = data.draft;
    // The design link lives with the import (draft.source / the live version's source), so
    // coming back to edit finds it in the field again — same as Pinned Posts' canva_url.
    const storedCanvaUrl = draft?.source.canvaUrl || live?.source.canvaUrl || "";
    useEffect(() => {
        if (storedCanvaUrl) setCanvaLink((cur) => cur || storedCanvaUrl);
    }, [storedCanvaUrl]);
    /** What the phone plays: the team sees their draft while one exists, everyone else the live set. */
    const view: "live" | "draft" = isTeam && draft ? "draft" : "live";
    const shownHighlights = view === "draft" && draft ? draft.highlights : (live?.highlights ?? []);
    const review = live?.review ?? EMPTY_REVIEW;
    /* The same account Pinned Posts renders (its carousels in the grid), with the tray swapped
       for whichever story set the phone is playing — the player does that swap itself. */
    const igProfile = buildProfile(profile, pinnedPosts);
    const tagOf = (i: number) => `v${data.versions.length - i}`;

    // Keep the phone on a highlight that exists in whichever set is showing.
    useEffect(() => {
        if (position.highlightId && !shownHighlights.some((h) => h.id === position.highlightId)) setPosition(PROFILE);
    }, [shownHighlights, position.highlightId]);

    /* ── Team persistence ── */
    const persist = useCallback(
        async (next: PinnedStoriesData) => {
            setData(next);
            if (!slug || isTemplate) return true;
            setSaveErr("");
            const { error } = await supabase
                .from("pinned_stories")
                .upsert({ slug, client_name: clientName, data: next, updated_at: new Date().toISOString() }, { onConflict: "slug" });
            if (error) setSaveErr("Couldn't save — check your connection and try again.");
            return !error;
        },
        [slug, isTemplate, clientName],
    );

    const setDraft = (fn: (d: StoryDraft) => StoryDraft) => {
        if (!draft) return;
        void persist({ ...data, draft: fn(draft) });
    };

    const publish = async () => {
        if (!draft || !draftPublishable(draft)) return;
        setPublishing(true);
        const version: StoryVersion = {
            id: uid(),
            highlights: draft.highlights.filter((h) => h.slides.length > 0),
            source: draft.source,
            publishedAt: new Date().toISOString(),
            publishedBy: teamName,
            review: EMPTY_REVIEW,
            // The tray travels with the version so "Make changes" restores the whole import.
            unassigned: draft.unassigned,
        };
        const versions = [version, ...data.versions];
        const ok = await persist({ draft: null, versions });
        setPublishing(false);
        if (!ok) return;
        setPosition(PROFILE);
        // Only the publish is logged to the team's feed at /log, never persist() itself —
        // this section saves the draft on every keystroke, and those writes would bury every
        // other entry in the feed. Fire-and-forget: the stories are already live.
        if (slug && !isTemplate) {
            void recordDashboardPublish({
                slug,
                clientName,
                section: STORIES_SECTION,
                summary: `Published Pinned Stories v${versions.length}`,
            });
        }
    };

    const discardDraft = () => void persist({ ...data, draft: null }).then(() => setPosition(PROFILE));

    /**
     * Back to stage 0: no draft, no versions, so the section shows the import panel again
     * (Canva link, Connect Canva if needed). Two clicks on purpose — it removes every
     * published version and the client's notes on them. The pages themselves stay in the
     * `stories` bucket (uploads are immutable there); only the row forgets them. The Canva
     * connection is portal-wide and is deliberately NOT touched: that has its own Disconnect.
     */
    const [resetArmed, setResetArmed] = useState(false);
    const [resetting, setResetting] = useState(false);
    const startOver = async () => {
        setResetting(true);
        const ok = await persist(EMPTY_PINNED_STORIES);
        setResetting(false);
        setResetArmed(false);
        if (ok) {
            setPosition(PROFILE);
            setShowImport(false);
            setCanvaLink("");
        }
    };

    /**
     * Start a draft from the live set, so titles and order can change without a re-import.
     * The tray comes back too: the pages left unplaced at publish time, plus any page an
     * older version used that this one dropped, so nothing imported is ever out of reach.
     */
    const editLive = () => {
        if (!live) return;
        const inLive = new Set(live.highlights.flatMap((h) => [h.cover, ...h.slides.map((s) => s.url)]));
        const tray: StorySlide[] = [...(live.unassigned ?? [])];
        for (const v of data.versions.slice(1)) {
            for (const s of [...v.highlights.flatMap((h) => h.slides), ...(v.unassigned ?? [])]) {
                if (!inLive.has(s.url) && !tray.some((t) => t.url === s.url)) tray.push({ ...s });
            }
        }
        void persist({
            ...data,
            draft: {
                highlights: live.highlights.map((h) => ({ ...h, id: uid(), slides: h.slides.map((s) => ({ ...s })) })),
                unassigned: tray.sort((a, b) => a.page - b.page),
                source: live.source,
            },
        });
        setPosition(PROFILE);
    };

    const startDraftWith = (pages: StorySlide[], source: StoryDraft["source"]) => {
        // A second import while a draft is open never throws the AM's arrangement away. From
        // Canva it REPLACES the tray (the design's current pages, once), so pressing the button
        // twice never stacks forty pages; an upload adds to it, since that is how a video page
        // joins an image set.
        const next: StoryDraft = draft
            ? {
                  ...draft,
                  unassigned: source.via === "canva" ? pages : [...draft.unassigned, ...pages],
                  source: source.designId || !draft.source.designId ? source : draft.source,
              }
            : draftFromPages(pages, source);
        void persist({ ...data, draft: next });
        setPosition(PROFILE);
        setShowImport(false);
    };

    /* ── Import: Canva ── */
    const importFromCanva = async () => {
        const designId = parseCanvaUrl(canvaLink)?.id ?? null;
        setImportErr("");
        if (!designId) {
            setImportErr(
                /canva\.com\/d\/|canva\.link\//.test(canvaLink)
                    ? "That's a Canva shortlink. In Canva use Share → Copy link, which gives the full canva.com/design/… address."
                    : "Paste the design's link from Canva — it looks like canva.com/design/D…/…/edit.",
            );
            return;
        }
        if (!slug) return;
        setImporting("Checking the design…");
        try {
            const { title, urls } = await exportCanvaDesign(designId, { width: 810, onProgress: setImporting });
            const pages: StorySlide[] = (await storeCanvaPages(slug, designId, urls, setImporting)).map((p) => ({
                id: uid(),
                kind: "image" as const,
                url: p.url,
                page: p.page,
            }));
            startDraftWith(pages, {
                via: "canva",
                canvaUrl: canvaLink.trim(),
                designId,
                designTitle: title,
                importedAt: new Date().toISOString(),
                importedBy: teamName,
            });
            // The link stays in the field: the arrange panel shows it so the AM can open the
            // design or pull the pages in again after editing it in Canva.
        } catch (e) {
            // The stored token stopped working mid-way — re-read the status so the panel
            // swaps the import button for Connect Canva.
            if (e instanceof CanvaNotConnectedError) void refreshCanva();
            setImportErr(e instanceof Error ? e.message : "Something went wrong.");
        } finally {
            setImporting(null);
        }
    };

    /* ── Import: the AM uploads Canva's exported pages ── */
    const uploadPages = async (list: FileList) => {
        if (!slug) return;
        // Canva names exports "…-01.jpg", "…-02.jpg", so filename order is page order.
        const files = Array.from(list).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        setImportErr("");
        setImporting(`Uploading 1 of ${files.length}…`);
        try {
            const folder = `${slug}/upload/${Date.now()}`;
            const startPage = (draft?.unassigned.length ?? 0) + totalSlides(draft?.highlights ?? []);
            const pages: StorySlide[] = [];
            for (let i = 0; i < files.length; i++) {
                setImporting(`Uploading ${i + 1} of ${files.length}…`);
                const f = files[i];
                const isVideo = f.type.startsWith("video/");
                if (isVideo && f.size > MAX_VIDEO_BYTES) throw new Error(`${f.name} is over 50 MB — export the story video at 1080p.`);
                let blob: Blob = f;
                let ext = f.name.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
                if (!isVideo) {
                    // The house rule: every uploaded image is compressed to WebP first.
                    blob = await dataUrlToBlob(await compressImageFile(f));
                    ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
                }
                const path = `${folder}/page-${String(startPage + i + 1).padStart(2, "0")}.${ext}`;
                const { error } = await supabase.storage.from("stories").upload(path, blob, { contentType: blob.type || f.type, cacheControl: "31536000" });
                if (error) throw new Error(`Couldn't upload ${f.name}.`);
                pages.push({
                    id: uid(),
                    kind: isVideo ? "video" : "image",
                    url: supabase.storage.from("stories").getPublicUrl(path).data.publicUrl,
                    page: startPage + i + 1,
                });
            }
            const designId = parseCanvaUrl(canvaLink)?.id ?? "";
            startDraftWith(pages, {
                via: "upload",
                canvaUrl: designId ? canvaLink.trim() : "",
                designId,
                designTitle: "",
                importedAt: new Date().toISOString(),
                importedBy: teamName,
            });
        } catch (e) {
            setImportErr(e instanceof Error ? e.message : "Something went wrong.");
        } finally {
            setImporting(null);
        }
    };

    const loadSample = () => {
        void persist({ ...data, draft: sampleDraft(teamName) });
        setPosition(PROFILE);
        setShowImport(false);
    };

    /* ── Arranging the draft ──
       Every edit is a pure model function applied through setDraft, so the phone (which
       renders draft.highlights) follows each move instantly. Drag-and-drop is the main
       gesture; the arrow / star / × buttons on each slide do the same moves for keyboards. */
    const updateHighlight = (id: string, patch: Partial<StoryHighlight>) =>
        setDraft((d) => ({ ...d, highlights: d.highlights.map((h) => (h.id === id ? { ...h, ...patch } : h)) }));
    const addHighlight = () => setDraft((d) => ({ ...d, highlights: [...d.highlights, emptyHighlight(d.highlights.length + 1)] }));
    /** Its slides go back to the tray; its cover image is dropped (it was a page once — re-import brings it back). */
    const removeHighlight = (id: string) =>
        setDraft((d) => {
            const h = d.highlights.find((x) => x.id === id);
            return { ...d, highlights: d.highlights.filter((x) => x.id !== id), unassigned: [...d.unassigned, ...(h?.slides ?? [])] };
        });
    const nudgeSlide = (hId: string, index: number, dir: -1 | 1) =>
        setDraft((d) => {
            const h = d.highlights.find((x) => x.id === hId);
            const s = h?.slides[index];
            if (!h || !s) return d;
            const j = index + dir;
            return j < 0 || j >= h.slides.length ? d : moveSlideTo(d, s.id, hId, j);
        });
    const toTray = (slideId: string) => setDraft((d) => moveSlideTo(d, slideId, null));
    const makeCover = (hId: string, slideId: string) => setDraft((d) => setCoverFromSlide(d, slideId, hId));
    const deleteUnassigned = (slideId: string) => setDraft((d) => ({ ...d, unassigned: d.unassigned.filter((x) => x.id !== slideId) }));

    /* Tray → highlights in one move: star the covers, press Build. */
    const [coverPicks, setCoverPicks] = useState<Set<string>>(new Set());
    const togglePick = (id: string) =>
        setCoverPicks((p) => {
            const n = new Set(p);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    const buildFromCovers = () => {
        setDraft((d) => buildHighlightsFromCovers(d, [...coverPicks]));
        setCoverPicks(new Set());
    };

    /* Native drag-and-drop. `dragId` is the slide in flight; `over` names the target under
       the pointer so it can light up. Targets: a slide (insert before it), a run's tail
       (append), a cover circle (become the cover), the tray (unplace). */
    const [dragId, setDragId] = useState<string | null>(null);
    const [over, setOver] = useState<string | null>(null);
    const onDragStart = (e: DragEvent, slideId: string) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", slideId);
        setDragId(slideId);
    };
    const onDragEnd = () => {
        setDragId(null);
        setOver(null);
    };
    const dropZone = (key: string, onDrop: (slideId: string) => void) => ({
        onDragOver: (e: DragEvent) => {
            if (!dragId) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (over !== key) setOver(key);
        },
        onDragLeave: () => over === key && setOver(null),
        onDrop: (e: DragEvent) => {
            e.preventDefault();
            const id = e.dataTransfer.getData("text/plain") || dragId;
            if (id) onDrop(id);
            onDragEnd();
        },
    });

    /* ── Review ── */
    const respond = async (body: Record<string, unknown>) => {
        if (!slug || !clientEmail) return;
        setReviewBusy(true);
        setReviewErr("");
        try {
            const res = await fetch(REVIEW_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...body, slug, email: clientEmail }),
            });
            const json = (await res.json().catch(() => ({}))) as { error?: string; review?: StoryReview };
            if (!res.ok || !json.review) {
                setReviewErr(json.error || "Something went wrong — try again.");
                return;
            }
            setData((d) => ({ ...d, versions: d.versions.map((v, i) => (i === 0 ? { ...v, review: json.review! } : v)) }));
            setNoteFor(null);
            setNoteText("");
        } catch {
            setReviewErr("Something went wrong — try again.");
        } finally {
            setReviewBusy(false);
        }
    };

    const toggleResolved = (c: StoryComment) => {
        if (!live) return;
        const next = { ...live, review: { ...review, comments: review.comments.map((x) => (x.id === c.id ? { ...x, resolved: !x.resolved } : x)) } };
        void persist({ ...data, versions: [next, ...data.versions.slice(1)] });
    };

    const commentCountFor = (slideId: string) => (view === "live" || !isTeam ? review.comments.filter((c) => c.slideId === slideId).length : 0);

    /** "Slide 3 of 6 · FAQ" for a note, from the live set. */
    const describe = (c: { highlightId: string; slideId: string }) => {
        const h = live?.highlights.find((x) => x.id === c.highlightId);
        const frames = h ? storyFrames(h) : [];
        const i = frames.findIndex((s) => s.id === c.slideId);
        if (!h || i < 0) return { label: "Whole set", slide: null as StorySlide | null };
        return { label: `Slide ${i + 1} of ${frames.length} · ${h.title || "Untitled"}`, slide: frames[i] };
    };

    const jumpTo = (c: { highlightId: string; slideId: string }) => {
        // Slides keep their ids when the live set becomes a draft, so the note can be found
        // in whichever set the phone is showing.
        for (const h of shownHighlights) {
            const i = storyFrames(h).findIndex((s) => s.id === c.slideId);
            if (i >= 0) return setPosition({ highlightId: h.id, slide: i });
        }
    };

    const openNote = (highlightId: string, slideId: string) => {
        if (isTeam) return;
        setNoteFor({ highlightId, slideId });
    };

    /* ── Copy ── */
    const subtitle = isTeam
        ? "Paste the Canva link, arrange the pages into highlights, publish. The client plays them in this phone and leaves notes slide by slide."
        : live
          ? "The highlights that will sit at the top of your Instagram profile. Tap a circle to play it, then tell us what to change or approve the set."
          : "The story highlights pinned to the top of your Instagram profile.";

    const rv = REVIEW_BADGE[review.status];
    const nothingYet = !live && !draft;
    const hasSomething = shownHighlights.length > 0;
    const notePos = noteFor ? describe(noteFor) : null;

    return (
        <div>
            <div>
                <h2 className="text-display-xs font-semibold text-primary md:text-display-sm">Pinned Stories</h2>
                <p className="mt-1.5 max-w-2xl text-md text-pretty text-tertiary">{subtitle}</p>
            </div>

            {/* ── Client, nothing published yet ── */}
            {!isTeam && !live && (
                <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl bg-primary px-8 py-16 text-center ring-1 ring-secondary">
                    <FeaturedIcon icon={Image03} color="gray" theme="light" size="lg" className="mb-2" />
                    <p className="text-md font-semibold text-primary">Your story highlights are on their way</p>
                    <p className="max-w-md text-sm text-pretty text-tertiary">
                        We're designing them from your Master Brand and Brand Kit. Once they're ready you'll play them right here, exactly as they'll look on
                        your profile, and tell us anything you'd like changed.
                    </p>
                </div>
            )}

            {/* ── Team: import panel (first import, or a new version) ── */}
            {isTeam && (nothingYet || showImport) && (
                <div className="mt-6 flex flex-col rounded-2xl bg-primary ring-1 ring-secondary">
                    <div className="flex items-start justify-between gap-4 border-b border-secondary px-6 py-5">
                        <div>
                            <p className="text-md font-semibold text-primary">{draft ? "Add pages to the draft" : "Import the story highlights"}</p>
                            <p className="mt-0.5 text-sm text-pretty text-tertiary">
                                Paste the Canva design link and the portal pulls every page in. If Canva isn't connected, export the pages from Canva (Share →
                                Download → JPG) and drop them here instead — same result.
                            </p>
                        </div>
                        {!draft && !live && (
                            <Badge color="gray" size="md" type="pill-color">
                                Not published
                            </Badge>
                        )}
                    </div>
                    <div className="flex flex-col gap-4 px-6 py-5">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-secondary" htmlFor="canva-link">
                                Canva link
                            </label>
                            <div className="flex flex-wrap gap-3">
                                <input
                                    id="canva-link"
                                    value={canvaLink}
                                    onChange={(e) => setCanvaLink(e.target.value)}
                                    disabled={!canEdit || !!importing}
                                    placeholder="https://www.canva.com/design/DAHSwF8HKF8/…/edit"
                                    className={cx(inputCls, "min-w-60 flex-1 font-mono text-xs")}
                                    spellCheck={false}
                                />
                                {canva && !canva.connected && canva.configured ? (
                                    <Button
                                        size="md"
                                        iconLeading={Link01}
                                        isDisabled={!canEdit}
                                        isLoading={canvaBusy}
                                        showTextWhileLoading
                                        onClick={() => void connectCanva()}
                                    >
                                        Connect Canva
                                    </Button>
                                ) : (
                                    <Button
                                        size="md"
                                        isDisabled={!canEdit || !canvaLink.trim() || (!!canva && !canva.connected)}
                                        isLoading={!!importing}
                                        showTextWhileLoading
                                        onClick={() => void importFromCanva()}
                                    >
                                        {importing ?? "Import from Canva"}
                                    </Button>
                                )}
                            </div>
                            {canvaNote && (
                                <p className={cx("text-xs", canvaNote.kind === "ok" ? "text-success-primary" : "text-error-primary")}>{canvaNote.text}</p>
                            )}
                            {canva && canva.connected && (
                                <p className="text-xs text-quaternary">
                                    Canva connected{canva.connectedBy ? ` by ${canva.connectedBy}` : ""}. The portal refreshes the token itself.
                                    {canEdit && (
                                        <>
                                            {" "}
                                            <button
                                                type="button"
                                                onClick={() => void disconnectCanva()}
                                                disabled={canvaBusy}
                                                className="font-semibold text-tertiary transition duration-100 ease-linear hover:text-error-primary disabled:opacity-50"
                                            >
                                                Disconnect
                                            </button>
                                        </>
                                    )}
                                </p>
                            )}
                            {canva && !canva.connected && canva.configured && (
                                <p className="text-xs text-quaternary">
                                    One-time step: Connect Canva signs the portal in to the HiddenGem Canva account, so pasting a design link pulls every page
                                    in from then on. The link is kept with the import either way.
                                </p>
                            )}
                            {canva && !canva.configured && (
                                <p className="text-xs text-quaternary">
                                    Canva isn't set up on the portal yet — the web team adds CANVA_CLIENT_ID and CANVA_CLIENT_SECRET in Netlify, then Connect
                                    Canva appears here. Until then, upload the exported pages below.
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-3 text-xs font-medium text-quaternary uppercase">
                            <span className="h-px flex-1 bg-border-secondary" />
                            or upload the exported pages
                            <span className="h-px flex-1 bg-border-secondary" />
                        </div>

                        <FileUploadDropZone
                            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                            allowsMultiple
                            isDisabled={!canEdit || !!importing}
                            hint="JPG or PNG per page, MP4 for video pages · named in page order · videos under 50 MB"
                            onDropFiles={(files) => void uploadPages(files)}
                        />

                        {importErr && (
                            <div role="alert" className="flex items-start gap-3 rounded-xl bg-error-primary p-3.5 ring-1 ring-error_subtle">
                                <AlertCircle className="mt-0.5 size-5 shrink-0 text-fg-error-secondary" aria-hidden="true" />
                                <p className="text-sm text-primary">{importErr}</p>
                            </div>
                        )}
                        {saveErr && <p className="text-sm text-error-primary">{saveErr}</p>}

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            {!draft && !isTemplate ? (
                                <Button color="link-color" size="sm" isDisabled={!canEdit} onClick={loadSample}>
                                    Load the North Star sample to see the section working
                                </Button>
                            ) : (
                                <span />
                            )}
                            {showImport && (
                                <Button color="tertiary" size="sm" onClick={() => setShowImport(false)}>
                                    Close
                                </Button>
                            )}
                        </div>
                        {isLocked && !isTemplate && <p className="text-xs text-quaternary">Unlock the dashboard to import and publish.</p>}
                    </div>
                </div>
            )}

            {/* ── Team settings, above the phone like Pinned Posts: the Canva source and how the section works ── */}
            {canEdit && draft && (
                <div className="mt-6 rounded-2xl bg-secondary p-4 ring-1 ring-secondary">
                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-secondary">Canva design link</span>
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                type="url"
                                value={canvaLink}
                                onChange={(e) => setCanvaLink(e.target.value)}
                                disabled={!!importing}
                                placeholder="https://www.canva.com/design/…/edit"
                                className={cx(inputCls, "min-w-60 flex-1 font-mono text-xs")}
                                spellCheck={false}
                            />
                            {parseCanvaUrl(canvaLink) && (
                                <Button
                                    href={canvaEditUrl(parseCanvaUrl(canvaLink)!.id)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    color="secondary"
                                    size="sm"
                                    iconTrailing={LinkExternal01}
                                >
                                    Open
                                </Button>
                            )}
                            {canva && !canva.connected && canva.configured ? (
                                <Button size="sm" iconLeading={Link01} isLoading={canvaBusy} showTextWhileLoading onClick={() => void connectCanva()}>
                                    Connect Canva
                                </Button>
                            ) : (
                                <Button
                                    size="sm"
                                    iconLeading={Download01}
                                    isDisabled={!parseCanvaUrl(canvaLink) || (!!canva && !canva.connected)}
                                    isLoading={!!importing}
                                    showTextWhileLoading
                                    onClick={() => void importFromCanva()}
                                >
                                    {importing ?? "Import from Canva"}
                                </Button>
                            )}
                        </div>
                        {canvaLink.trim() && !parseCanvaUrl(canvaLink) && (
                            <span className="text-xs text-warning-primary">That doesn't look like a Canva design link.</span>
                        )}
                        {!showImport && importErr && <span className="text-xs text-error-primary">{importErr}</span>}
                        {canvaNote && (
                            <span className={cx("text-xs", canvaNote.kind === "ok" ? "text-success-primary" : "text-error-primary")}>{canvaNote.text}</span>
                        )}
                        {canva && !canva.configured && (
                            <span className="text-xs text-quaternary">Canva isn't set up on the portal yet — use Add pages to upload the export.</span>
                        )}
                        {importing === null && !importErr && (
                            <span className="text-xs text-quaternary">
                                The pages land below. Importing again refreshes them from the design; the highlights you've arranged stay as they are.
                            </span>
                        )}
                    </label>
                    <div className="mt-3 grid gap-2 text-xs text-tertiary sm:grid-cols-3">
                        <p className="rounded-xl bg-primary px-3 py-2.5 ring-1 ring-secondary">
                            <span className="font-semibold text-secondary">1 · Design in Canva.</span> One design, one page per slide, 9:16. Each highlight is a
                            icon page followed by its slides. Paste its link above.
                        </p>
                        <p className="rounded-xl bg-primary px-3 py-2.5 ring-1 ring-secondary">
                            <span className="font-semibold text-secondary">2 · Import and arrange.</span> Press Import from Canva, star the icon pages in the
                            tray and press Build — or drag pages into highlights yourself. The phone follows.
                        </p>
                        <p className="rounded-xl bg-primary px-3 py-2.5 ring-1 ring-secondary">
                            <span className="font-semibold text-secondary">3 · Publish and review.</span> Name each highlight, then publish. The client plays
                            the set in this phone and leaves notes slide by slide, or approves it.
                        </p>
                    </div>

                    {/* ── Imported pages, right under the link they came from. Not yet in a highlight; also a drop target, to unplace. ── */}
                    {(draft.unassigned.length > 0 || dragId) && (
                        <div
                            className={cx(
                                "mt-4 flex flex-col gap-3 rounded-xl p-3 ring-1 ring-secondary transition duration-100 ease-linear",
                                over === "tray" ? "bg-brand-primary" : "bg-primary",
                            )}
                            {...(canEdit ? dropZone("tray", (id) => toTray(id)) : {})}
                        >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-primary">
                                    Pages to place <span className="font-normal text-quaternary">· {draft.unassigned.length}</span>
                                </p>
                                {canEdit && draft.unassigned.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs text-tertiary">
                                            {coverPicks.size
                                                ? `${coverPicks.size} icon${coverPicks.size === 1 ? "" : "s"} starred`
                                                : "Star the icon pages, then"}
                                        </span>
                                        <Button
                                            size="sm"
                                            color={coverPicks.size ? "primary" : "secondary"}
                                            iconLeading={Star01}
                                            isDisabled={!coverPicks.size}
                                            onClick={buildFromCovers}
                                        >
                                            Build {coverPicks.size || ""} highlight{coverPicks.size === 1 ? "" : "s"}
                                        </Button>
                                    </div>
                                )}
                            </div>
                            <div className="-m-1 flex gap-3 overflow-x-auto p-1 pb-2">
                                {draft.unassigned.map((s) => {
                                    const picked = coverPicks.has(s.id);
                                    return (
                                        <div
                                            key={s.id}
                                            className={cx(
                                                "group relative flex w-[100px] shrink-0 flex-col gap-1.5 transition duration-100 ease-linear",
                                                dragId === s.id && "opacity-40",
                                            )}
                                            draggable={canEdit}
                                            onDragStart={(e) => onDragStart(e, s.id)}
                                            onDragEnd={onDragEnd}
                                        >
                                            <div
                                                className={cx(
                                                    "relative aspect-9/16 overflow-hidden rounded-lg bg-secondary ring-1 transition duration-100 ease-linear",
                                                    canEdit && "cursor-grab active:cursor-grabbing",
                                                    picked ? "ring-2 ring-brand" : "ring-secondary",
                                                )}
                                            >
                                                <SlideThumb slide={s} className="pointer-events-none" />
                                                <span className="pointer-events-none absolute top-1 left-1 rounded bg-primary-solid/70 px-1 text-[10px] font-semibold text-white tabular-nums">
                                                    p{s.page}
                                                </span>
                                                {canEdit && s.kind === "image" && (
                                                    <button
                                                        type="button"
                                                        onClick={() => togglePick(s.id)}
                                                        aria-pressed={picked}
                                                        aria-label={picked ? "Not an icon" : "Mark as the icon"}
                                                        className={cx(
                                                            "absolute top-1 right-1 flex size-6 items-center justify-center rounded-full transition duration-100 ease-linear",
                                                            picked
                                                                ? "bg-brand-solid text-white"
                                                                : "bg-primary-solid/60 text-white opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
                                                        )}
                                                    >
                                                        <Star01 className="size-3.5" />
                                                    </button>
                                                )}
                                                {picked && (
                                                    <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-brand-solid py-0.5 text-center text-[10px] font-semibold text-white">
                                                        Icon
                                                    </span>
                                                )}
                                            </div>
                                            {canEdit && (
                                                <div className="flex items-center justify-between gap-1">
                                                    <select
                                                        aria-label={`Add page ${s.page} to a highlight`}
                                                        value=""
                                                        onChange={(e) => e.target.value && setDraft((d) => moveSlideTo(d, s.id, e.target.value))}
                                                        className={cx(inputCls, "min-w-0 flex-1 px-1 py-0.5 text-[11px]")}
                                                    >
                                                        <option value="">Add to…</option>
                                                        {draft.highlights.map((h) => (
                                                            <option key={h.id} value={h.id}>
                                                                {h.title || "Untitled"}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => deleteUnassigned(s.id)}
                                                        className="rounded p-1 text-fg-quaternary transition duration-100 ease-linear hover:text-error-primary"
                                                        aria-label="Discard page"
                                                    >
                                                        <Trash01 className="size-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {draft.unassigned.length === 0 && (
                                    <p className="py-3 text-xs text-quaternary">Drop a slide here to take it out of its highlight.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── The phone + its side panel ── */}
            {(live || (isTeam && draft)) && (
                <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(260px,320px)_1fr] xl:grid-cols-[440px_1fr]">
                    {/* Phone — on wide screens it sits to the right of its column, leaving room for the pointer beside it. */}
                    <div className="flex flex-col items-center gap-4 xl:items-end">
                        <div className="relative">
                            {/* A hand-drawn pointer at the highlight circles, the cue the section is about. Decorative;
                                the caption under the phone says the same thing on smaller screens. */}
                            {!position.highlightId && hasSomething && (
                                <div
                                    aria-hidden="true"
                                    className="pointer-events-none absolute top-[40%] right-full mr-2 hidden w-[140px] flex-col items-start gap-1 xl:flex"
                                >
                                    <svg
                                        viewBox="0 0 120 80"
                                        className="ml-6 h-[64px] w-[96px] text-fg-quaternary"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M8 74 C 22 46, 52 22, 106 14" />
                                        <path d="M90 6 L 106 14 L 96 28" />
                                    </svg>
                                    <p className="max-w-[120px] text-xs leading-snug text-tertiary italic">Tap a highlight circle to play it</p>
                                </div>
                            )}
                            <PhoneFrame label="Pinned stories" className="w-[248px] sm:w-[280px]">
                                <StoryPlayer
                                    highlights={shownHighlights}
                                    position={position}
                                    onPosition={setPosition}
                                    profile={igProfile}
                                    onReply={!isTeam && live && review.status !== "approved" && clientEmail ? openNote : undefined}
                                    replyLabel="Leave a note on this slide"
                                    commentCountFor={commentCountFor}
                                />
                            </PhoneFrame>
                        </div>
                        <p className={cx("max-w-[300px] text-center text-xs text-pretty text-quaternary", !position.highlightId && "xl:hidden")}>
                            {position.highlightId
                                ? "Tap the right side to go forward, the left to go back. Hold to pause."
                                : "Tap a highlight circle to play it."}
                        </p>
                    </div>

                    {/* Side panel */}
                    <div className="flex min-w-0 flex-col gap-6">
                        {/* Team: state strip */}
                        {isTeam && (
                            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-primary px-5 py-4 ring-1 ring-secondary">
                                {live ? (
                                    <>
                                        <BadgeWithDot color="success" size="sm" type="pill-color">
                                            Live
                                        </BadgeWithDot>
                                        <span className="text-sm text-tertiary">
                                            {tagOf(0)} · {live.highlights.length} highlight{live.highlights.length === 1 ? "" : "s"},{" "}
                                            {totalSlides(live.highlights)} slides · Published {shortDate(live.publishedAt)}
                                            {live.publishedBy ? ` by ${live.publishedBy}` : ""}
                                        </span>
                                        <BadgeWithDot color={rv.color} size="sm" type="pill-color">
                                            {rv.text}
                                        </BadgeWithDot>
                                    </>
                                ) : (
                                    <>
                                        <Badge color="gray" size="sm" type="pill-color">
                                            Draft
                                        </Badge>
                                        <span className="text-sm text-tertiary">Not shown to the client until you publish.</span>
                                    </>
                                )}
                                <div className="ml-auto flex flex-wrap gap-2">
                                    {(view === "draft" ? draft?.source : live?.source)?.designId && (
                                        <Button
                                            color="secondary"
                                            size="sm"
                                            iconLeading={LinkExternal01}
                                            href={canvaEditUrl((view === "draft" ? draft?.source : live?.source)!.designId)}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            Open in Canva
                                        </Button>
                                    )}
                                    {canEdit && live && !draft && (
                                        <>
                                            <Button color="secondary" size="sm" onClick={editLive}>
                                                Make changes
                                            </Button>
                                            <Button color="secondary" size="sm" onClick={() => setShowImport(true)}>
                                                Import new version
                                            </Button>
                                        </>
                                    )}
                                    {canEdit && !resetArmed && (
                                        <Button color="tertiary-destructive" size="sm" iconLeading={RefreshCw01} onClick={() => setResetArmed(true)}>
                                            Start over
                                        </Button>
                                    )}
                                </div>
                                {canEdit && resetArmed && (
                                    <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl bg-error-primary px-4 py-3 ring-1 ring-error_subtle">
                                        <p className="text-sm text-pretty text-primary">
                                            Start over? This removes{" "}
                                            {data.versions.length
                                                ? `${data.versions.length} published version${data.versions.length === 1 ? "" : "s"}`
                                                : "the draft"}
                                            {review.comments.length
                                                ? ` and ${review.comments.length} client note${review.comments.length === 1 ? "" : "s"}`
                                                : ""}{" "}
                                            for this client and brings back the import panel. The Canva connection stays.
                                        </p>
                                        <div className="flex gap-2">
                                            <Button color="tertiary" size="sm" onClick={() => setResetArmed(false)}>
                                                Keep everything
                                            </Button>
                                            <Button
                                                color="primary-destructive"
                                                size="sm"
                                                isLoading={resetting}
                                                showTextWhileLoading
                                                onClick={() => void startOver()}
                                            >
                                                {resetting ? "Resetting…" : "Yes, start over"}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Team: arrange the draft */}
                        {isTeam && draft && view === "draft" && (
                            <div className="flex flex-col rounded-2xl bg-primary ring-1 ring-secondary">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-secondary px-5 py-4">
                                    <div>
                                        <p className="text-md font-semibold text-primary">Arrange the highlights</p>
                                        <p className="text-sm text-pretty text-tertiary">
                                            Drag pages from the tray above into highlights and onto icon circles; the phone follows. Faster: star the icon pages
                                            and press Build — every page after an icon joins that highlight.
                                        </p>
                                    </div>
                                    {canEdit && (
                                        <Button color="secondary" size="sm" iconLeading={Plus} onClick={addHighlight}>
                                            Add highlight
                                        </Button>
                                    )}
                                </div>

                                <div className="flex flex-col divide-y divide-border-secondary">
                                    {draft.highlights.length === 0 && (
                                        <p className="px-5 py-6 text-sm text-quaternary">
                                            No highlights yet. Star the icons below and press Build, or add a highlight and drag pages into it.
                                        </p>
                                    )}
                                    {draft.highlights.map((h, hi) => {
                                        const coverKey = `cover:${h.id}`;
                                        const tailKey = `tail:${h.id}`;
                                        return (
                                            <div key={h.id} className="flex flex-col gap-3 px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    {/* Cover circle — tap to play, drop a page to make it the cover. */}
                                                    <button
                                                        type="button"
                                                        onClick={() => storyFrames(h).length && setPosition({ highlightId: h.id, slide: 0 })}
                                                        className={cx(
                                                            "flex size-12 shrink-0 items-center justify-center rounded-full ring-1 ring-offset-2 ring-offset-bg-primary transition duration-100 ease-linear",
                                                            over === coverKey ? "scale-110 ring-2 ring-brand" : "ring-primary",
                                                        )}
                                                        aria-label={`Play ${h.title}`}
                                                        {...(canEdit ? dropZone(coverKey, (id) => makeCover(h.id, id)) : {})}
                                                    >
                                                        <span className="size-11 overflow-hidden rounded-full bg-secondary">
                                                            {coverOf(h) && (
                                                                <img src={coverOf(h)} alt="" className="pointer-events-none size-full object-cover" />
                                                            )}
                                                        </span>
                                                    </button>
                                                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                        {canEdit ? (
                                                            <input
                                                                value={h.title}
                                                                onChange={(e) => updateHighlight(h.id, { title: e.target.value })}
                                                                placeholder={`Highlight ${hi + 1}`}
                                                                aria-label="Highlight name"
                                                                maxLength={24}
                                                                className={cx(inputCls, "max-w-60 py-1.5 font-semibold")}
                                                            />
                                                        ) : (
                                                            <p className="text-sm font-semibold text-primary">{h.title}</p>
                                                        )}
                                                        <p className="text-xs text-quaternary">
                                                            {storyFrames(h).length} slide{storyFrames(h).length === 1 ? "" : "s"}
                                                            {firstSlideIsCover(h) && " · the first page is the icon and doesn't play"}
                                                            {!h.cover && h.slides.length === 1 && " · drop a page on the circle, or star one, to set the icon"}
                                                            {h.cover && h.slides.length === 0 && " · icon set — drag the story pages in"}
                                                            {!h.cover && h.slides.length === 0 && " · empty highlights aren't published"}
                                                        </p>
                                                    </div>
                                                    {canEdit && (
                                                        <Button
                                                            color="tertiary"
                                                            size="sm"
                                                            iconLeading={Trash01}
                                                            onClick={() => removeHighlight(h.id)}
                                                            aria-label="Remove highlight"
                                                        />
                                                    )}
                                                </div>
                                                <div className="-m-1 flex gap-2 overflow-x-auto p-1 pb-2">
                                                    {h.slides.map((s, si) => {
                                                        // With no explicit cover the first page is the icon only; the rest play as 1, 2, 3…
                                                        const isIconOnly = firstSlideIsCover(h) && si === 0;
                                                        const frameIndex = firstSlideIsCover(h) ? si - 1 : si;
                                                        const active = position.highlightId === h.id && !isIconOnly && position.slide === frameIndex;
                                                        const key = `slide:${s.id}`;
                                                        return (
                                                            <div
                                                                key={s.id}
                                                                className={cx(
                                                                    "group relative w-[62px] shrink-0 transition duration-100 ease-linear",
                                                                    dragId === s.id && "opacity-40",
                                                                    over === key && "translate-x-1",
                                                                )}
                                                                draggable={canEdit}
                                                                onDragStart={(e) => onDragStart(e, s.id)}
                                                                onDragEnd={onDragEnd}
                                                                {...(canEdit ? dropZone(key, (id) => setDraft((d) => moveSlideTo(d, id, h.id, si))) : {})}
                                                            >
                                                                {over === key && (
                                                                    <span
                                                                        className="absolute top-0 bottom-0 -left-1.5 w-0.5 rounded bg-brand-solid"
                                                                        aria-hidden="true"
                                                                    />
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPosition({ highlightId: h.id, slide: Math.max(0, frameIndex) })}
                                                                    className={cx(
                                                                        "block aspect-9/16 w-full overflow-hidden rounded-lg bg-secondary ring-1 transition duration-100 ease-linear",
                                                                        canEdit && "cursor-grab active:cursor-grabbing",
                                                                        active ? "ring-2 ring-brand" : "ring-secondary hover:ring-primary",
                                                                        isIconOnly && "opacity-70",
                                                                    )}
                                                                    aria-label={isIconOnly ? "Icon" : `Slide ${frameIndex + 1}`}
                                                                >
                                                                    <SlideThumb slide={s} className="pointer-events-none" />
                                                                </button>
                                                                <span
                                                                    className={cx(
                                                                        "pointer-events-none absolute top-1 left-1 rounded px-1 text-[10px] font-semibold text-white tabular-nums",
                                                                        isIconOnly ? "bg-brand-solid" : "bg-primary-solid/70",
                                                                    )}
                                                                >
                                                                    {isIconOnly ? "Icon" : frameIndex + 1}
                                                                </span>
                                                                {canEdit && (
                                                                    <div className="absolute inset-x-0 bottom-0 flex justify-center gap-0.5 rounded-b-lg bg-primary-solid/70 py-0.5 opacity-0 transition duration-100 ease-linear group-focus-within:opacity-100 group-hover:opacity-100">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => nudgeSlide(h.id, si, -1)}
                                                                            className="rounded p-0.5 text-white hover:bg-white/20"
                                                                            aria-label="Move earlier"
                                                                        >
                                                                            <ChevronLeft className="size-3.5" />
                                                                        </button>
                                                                        {s.kind === "image" && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => makeCover(h.id, s.id)}
                                                                                className="rounded p-0.5 text-white hover:bg-white/20"
                                                                                aria-label="Use as icon"
                                                                            >
                                                                                <Star01 className="size-3.5" />
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => toTray(s.id)}
                                                                            className="rounded p-0.5 text-white hover:bg-white/20"
                                                                            aria-label="Back to the tray"
                                                                        >
                                                                            <XClose className="size-3.5" />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => nudgeSlide(h.id, si, 1)}
                                                                            className="rounded p-0.5 text-white hover:bg-white/20"
                                                                            aria-label="Move later"
                                                                        >
                                                                            <ChevronRight className="size-3.5" />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                    {/* Tail — drop here to append. Wide enough to hit; reads as an invitation when empty. */}
                                                    {canEdit && (
                                                        <div
                                                            className={cx(
                                                                "flex aspect-9/16 w-[62px] shrink-0 items-center justify-center rounded-lg border border-dashed text-center text-[10px] leading-tight transition duration-100 ease-linear",
                                                                over === tailKey
                                                                    ? "border-brand bg-brand-primary text-brand-secondary"
                                                                    : "border-secondary text-quaternary",
                                                                h.slides.length === 0 && "aspect-auto w-full max-w-[200px] py-6",
                                                            )}
                                                            {...dropZone(tailKey, (id) => setDraft((d) => moveSlideTo(d, id, h.id)))}
                                                        >
                                                            {h.slides.length === 0 ? "Drag pages here" : "+"}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {canEdit && (
                                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-secondary px-5 py-4">
                                        <p className="text-sm text-quaternary">
                                            {draft.source.via === "canva" &&
                                                `Imported from Canva${draft.source.designTitle ? ` · ${draft.source.designTitle}` : ""} · ${shortDate(draft.source.importedAt)}`}
                                            {draft.source.via === "upload" && `Uploaded ${shortDate(draft.source.importedAt)}`}
                                            {draft.source.via === "sample" &&
                                                "North Star sample — replace it with the client's own design before publishing to a real client."}
                                        </p>
                                        <div className="flex gap-2">
                                            <Button color="secondary" size="md" onClick={() => setShowImport(true)}>
                                                Add pages
                                            </Button>
                                            <Button color="tertiary" size="md" onClick={discardDraft}>
                                                Discard draft
                                            </Button>
                                            <Button
                                                size="md"
                                                isDisabled={!draftPublishable(draft)}
                                                isLoading={publishing}
                                                showTextWhileLoading
                                                onClick={() => void publish()}
                                            >
                                                {publishing ? "Publishing…" : live ? `Publish as ${tagOf(-1)}` : "Publish to client"}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                {saveErr && <p className="px-5 pb-4 text-sm text-error-primary">{saveErr}</p>}
                            </div>
                        )}

                        {/* Team: the live set's highlights, read-only, and the client's notes */}
                        {isTeam && live && (
                            <div className="flex flex-col rounded-2xl bg-primary ring-1 ring-secondary">
                                <div className="flex items-center justify-between gap-3 border-b border-secondary px-5 py-4">
                                    <p className="text-md font-semibold text-primary">Client notes</p>
                                    <span className="text-sm text-quaternary">
                                        {review.comments.length} note{review.comments.length === 1 ? "" : "s"} on {tagOf(0)}
                                    </span>
                                </div>
                                <div className="px-5 py-4">
                                    <p className="text-sm text-pretty text-tertiary">
                                        {review.status === "pending" &&
                                            "The client hasn't responded yet. They'll see a note bar on every slide and an Approve button under the phone."}
                                        {review.status === "approved" &&
                                            `${review.respondedBy ?? "The client"} approved ${tagOf(0)}${review.respondedAt ? ` on ${shortDate(review.respondedAt)}` : ""}. Pin these to the profile.`}
                                        {review.status === "changes" &&
                                            "Work through the notes, tick each as you handle it, then import or arrange a new version and publish it back for review."}
                                    </p>
                                </div>
                                {review.comments.length > 0 && (
                                    <ul className="flex flex-col divide-y divide-border-secondary border-t border-secondary">
                                        {review.comments.map((c) => {
                                            const d = describe(c);
                                            return (
                                                <li key={c.id} className={cx("flex gap-3 px-5 py-3", c.resolved && "opacity-60")}>
                                                    <button
                                                        type="button"
                                                        onClick={() => jumpTo(c)}
                                                        className="aspect-9/16 w-9 shrink-0 overflow-hidden rounded-md bg-secondary ring-1 ring-secondary"
                                                        aria-label="Show this slide"
                                                    >
                                                        {d.slide ? (
                                                            <SlideThumb slide={d.slide} />
                                                        ) : (
                                                            <Image03 className="m-auto mt-3 size-4 text-fg-quaternary" />
                                                        )}
                                                    </button>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-semibold text-tertiary">{d.label}</p>
                                                        <p className={cx("mt-0.5 text-sm text-pretty text-primary", c.resolved && "line-through")}>{c.text}</p>
                                                        <p className="mt-0.5 text-xs text-quaternary">
                                                            {c.by} · {shortDate(c.at)}
                                                        </p>
                                                    </div>
                                                    {canEdit && (
                                                        <Button
                                                            color={c.resolved ? "tertiary" : "secondary"}
                                                            size="sm"
                                                            iconLeading={c.resolved ? undefined : Check}
                                                            onClick={() => toggleResolved(c)}
                                                        >
                                                            {c.resolved ? "Reopen" : "Done"}
                                                        </Button>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        )}

                        {/* Team: the open feedback notes, which are about the section rather than
                            one slide, so they sit beside the version list and not inside a
                            version's own note list. Renders nothing when there are none. */}
                        {feedback && <ClientFeedbackReview feedback={feedback} />}

                        {/* Team: versions */}
                        {isTeam && data.versions.length > 1 && (
                            <div className="flex flex-col rounded-2xl bg-primary ring-1 ring-secondary">
                                <div className="flex items-center justify-between border-b border-secondary px-5 py-4">
                                    <p className="text-md font-semibold text-primary">Versions</p>
                                    <span className="text-sm text-quaternary">{data.versions.length} versions</span>
                                </div>
                                {data.versions.map((v, i) => (
                                    <div key={v.id} className="flex items-center gap-3 border-b border-secondary px-5 py-3 last:border-b-0">
                                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary font-mono text-xs font-medium text-tertiary">
                                            {tagOf(i)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-primary">
                                                {v.highlights.length} highlights · {totalSlides(v.highlights)} slides
                                            </p>
                                            <p className="text-sm text-quaternary">
                                                {shortDate(v.publishedAt)}
                                                {v.publishedBy ? ` · ${v.publishedBy}` : ""} · {REVIEW_BADGE[v.review.status].text}
                                                {v.review.comments.length ? ` · ${v.review.comments.length} notes` : ""}
                                            </p>
                                        </div>
                                        {i === 0 && (
                                            <BadgeWithDot color="success" size="sm" type="pill-color">
                                                Live
                                            </BadgeWithDot>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Client: review */}
                        {!isTeam && live && (
                            <div className="flex flex-col rounded-2xl bg-primary ring-1 ring-secondary">
                                {review.status !== "approved" ? (
                                    <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
                                        <div className="min-w-60 flex-1">
                                            <p className="text-md font-semibold text-primary">Do these look right to you?</p>
                                            <p className="text-sm text-pretty text-tertiary">
                                                Play each highlight. To change something, tap “Leave a note on this slide” while it's on screen. Happy with all
                                                of it? Approve, and we'll pin them to your profile.
                                            </p>
                                        </div>
                                        <div className="flex gap-3">
                                            <Button
                                                color="secondary"
                                                size="md"
                                                iconLeading={MessageChatCircle}
                                                isDisabled={!clientEmail || reviewBusy}
                                                onClick={() =>
                                                    setNoteFor({
                                                        highlightId: position.highlightId ?? "",
                                                        slideId: position.highlightId
                                                            ? (shownHighlights.filter((h) => h.id === position.highlightId).flatMap(storyFrames)[position.slide]
                                                                  ?.id ?? "")
                                                            : "",
                                                    })
                                                }
                                            >
                                                {position.highlightId ? "Note on this slide" : "General note"}
                                            </Button>
                                            <Button
                                                size="md"
                                                iconLeading={CheckCircle}
                                                isDisabled={!clientEmail}
                                                isLoading={reviewBusy && !noteFor}
                                                onClick={() => void respond({ action: "approve" })}
                                            >
                                                Approve all
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-3 px-6 py-5">
                                        <CheckCircle className="mt-0.5 size-5 shrink-0 text-fg-success-primary" aria-hidden="true" />
                                        <div>
                                            <p className="text-sm font-semibold text-primary">Approved</p>
                                            <p className="text-sm text-tertiary">
                                                Thanks. Your Account Manager will pin these to your Instagram profile and let you know in Google Chat when
                                                they're up.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {noteFor && review.status !== "approved" && (
                                    <div className="flex flex-col gap-3 border-t border-secondary bg-secondary px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            {notePos?.slide && (
                                                <span className="aspect-9/16 w-9 shrink-0 overflow-hidden rounded-md ring-1 ring-secondary">
                                                    <SlideThumb slide={notePos.slide} />
                                                </span>
                                            )}
                                            <p className="text-sm font-semibold text-primary">{notePos?.label}</p>
                                        </div>
                                        <textarea
                                            value={noteText}
                                            onChange={(e) => setNoteText(e.target.value)}
                                            autoFocus
                                            placeholder="What would you like changed on this slide? Wording, a photo, colours — be as specific as you can."
                                            className={cx(inputCls, "min-h-[100px] resize-y")}
                                        />
                                        {reviewErr && <p className="text-sm text-error-primary">{reviewErr}</p>}
                                        <div className="flex justify-end gap-3">
                                            <Button
                                                color="tertiary"
                                                size="md"
                                                onClick={() => {
                                                    setNoteFor(null);
                                                    setNoteText("");
                                                }}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                size="md"
                                                isDisabled={!noteText.trim()}
                                                isLoading={reviewBusy}
                                                showTextWhileLoading
                                                onClick={() => void respond({ action: "comment", text: noteText.trim(), ...noteFor })}
                                            >
                                                Send to your team
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                {reviewErr && !noteFor && <p className="px-6 pb-4 text-sm text-error-primary">{reviewErr}</p>}
                                {!clientEmail && review.status !== "approved" && (
                                    <p className="px-6 pb-5 text-sm text-quaternary">Sign in with your own email to leave notes or approve.</p>
                                )}

                                {review.comments.length > 0 && (
                                    <div className="border-t border-secondary">
                                        <p className="px-6 pt-4 text-sm font-semibold text-primary">Your notes</p>
                                        <ul className="flex flex-col divide-y divide-border-secondary">
                                            {review.comments.map((c) => {
                                                const d = describe(c);
                                                return (
                                                    <li key={c.id} className="flex gap-3 px-6 py-3">
                                                        <button
                                                            type="button"
                                                            onClick={() => jumpTo(c)}
                                                            className="aspect-9/16 w-9 shrink-0 overflow-hidden rounded-md bg-secondary ring-1 ring-secondary"
                                                            aria-label="Show this slide"
                                                        >
                                                            {d.slide ? (
                                                                <SlideThumb slide={d.slide} />
                                                            ) : (
                                                                <Image03 className="m-auto mt-3 size-4 text-fg-quaternary" />
                                                            )}
                                                        </button>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-semibold text-tertiary">{d.label}</p>
                                                            <p className="mt-0.5 text-sm text-pretty text-primary">{c.text}</p>
                                                            <p className="mt-0.5 text-xs text-quaternary">
                                                                {shortDate(c.at)}
                                                                {c.resolved ? " · handled by your team" : " · with your team"}
                                                            </p>
                                                        </div>
                                                        {c.resolved && <Check className="mt-1 size-4 shrink-0 text-fg-success-primary" aria-hidden="true" />}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                        <p className="px-6 py-4 text-sm text-quaternary">We'll publish an updated set here once your notes are in.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Client: anything the per-slide notes and Approve all don't cover. It stays
                            after an approval on purpose — that gate closes, this doesn't — and it is
                            one note on the set, edited in place, rather than another comment thread.
                            Nothing published yet means nothing to say, so it waits for `live`. */}
                        {live && feedback && (
                            <ClientFeedbackBox
                                feedback={feedback}
                                placeholder="Anything else about the highlights? For a change to one slide, the note button above tells us which slide you mean."
                                rows={4}
                            />
                        )}

                        {/* The live set, highlight by highlight — the same list the AM arranges, read-only. Every
                            thumbnail plays that slide in the phone, so the client can find a slide without tapping
                            through, and the note button then targets it. */}
                        {live && view === "live" && (
                            <div className="flex flex-col rounded-2xl bg-primary ring-1 ring-secondary">
                                <div className="border-b border-secondary px-5 py-4">
                                    <p className="text-md font-semibold text-primary">{isTeam ? "What the client sees" : "Your highlights"}</p>
                                    <p className="text-sm text-pretty text-tertiary">
                                        {live.highlights.length} highlight{live.highlights.length === 1 ? "" : "s"}, {totalSlides(live.highlights)} slides. Tap
                                        a slide to see it on the phone.
                                    </p>
                                </div>
                                <div className="flex flex-col divide-y divide-border-secondary">
                                    {live.highlights.map((h) => {
                                        const frames = storyFrames(h);
                                        return (
                                            <div key={h.id} className="flex flex-col gap-3 px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => frames.length && setPosition({ highlightId: h.id, slide: 0 })}
                                                        className="flex size-12 shrink-0 items-center justify-center rounded-full ring-1 ring-primary ring-offset-2 ring-offset-bg-primary transition duration-100 ease-linear hover:ring-brand"
                                                        aria-label={`Play ${h.title}`}
                                                    >
                                                        <span className="size-11 overflow-hidden rounded-full bg-secondary">
                                                            {coverOf(h) && <img src={coverOf(h)} alt="" className="size-full object-cover" />}
                                                        </span>
                                                    </button>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-semibold text-primary">{h.title || "Untitled"}</p>
                                                        <p className="text-xs text-quaternary">
                                                            {frames.length} slide{frames.length === 1 ? "" : "s"}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="-m-1 flex gap-2 overflow-x-auto p-1 pb-2">
                                                    {frames.map((s, si) => {
                                                        const active = position.highlightId === h.id && position.slide === si;
                                                        const notes = commentCountFor(s.id);
                                                        return (
                                                            <div key={s.id} className="relative w-[62px] shrink-0">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPosition({ highlightId: h.id, slide: si })}
                                                                    className={cx(
                                                                        "block aspect-9/16 w-full overflow-hidden rounded-lg bg-secondary ring-1 transition duration-100 ease-linear",
                                                                        active ? "ring-2 ring-brand" : "ring-secondary hover:ring-primary",
                                                                    )}
                                                                    aria-label={`Slide ${si + 1} of ${h.title}`}
                                                                >
                                                                    <SlideThumb slide={s} className="pointer-events-none" />
                                                                </button>
                                                                <span className="pointer-events-none absolute top-1 left-1 rounded bg-primary-solid/70 px-1 text-[10px] font-semibold text-white tabular-nums">
                                                                    {si + 1}
                                                                </span>
                                                                {notes > 0 && (
                                                                    <span
                                                                        className="pointer-events-none absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-solid px-1 text-[10px] font-semibold text-white tabular-nums"
                                                                        aria-label={`${notes} note${notes === 1 ? "" : "s"}`}
                                                                    >
                                                                        {notes}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {!hasSomething && isTeam && draft && view === "draft" && draft.highlights.length === 0 && draft.unassigned.length === 0 && (
                            <p className="text-sm text-quaternary">Nothing imported yet.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
