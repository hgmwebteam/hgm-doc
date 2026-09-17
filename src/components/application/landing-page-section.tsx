import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle, Code02, Globe01, Link01, LinkExternal01, MessageChatCircle, Monitor01, Phone01, UploadCloud02 } from "@untitledui/icons";
import { Badge, BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { supabase } from "@/lib/supabase";
import { ClientFeedbackBox, type ClientFeedbackProps, ClientFeedbackReview } from "@/pages/client/dashboard/client-feedback";
import { uid } from "@/pages/client/dashboard/dashboard-model";
import { cx } from "@/utils/cx";

/**
 * Marketing → Landing page — an AM uploads or pastes the finished HTML, or points at the
 * live URL of a page that is already hosted, and the client reviews it in-frame and
 * approves or asks for changes. Persists to landing_pages (see the
 * 20260910150000_landing_pages migration): one row per dashboard slug, holding every
 * published version (newest first) and the client's current review state. Pasted HTML
 * lives in the `landing-pages` Storage bucket (20260910170000 migration), one immutable
 * object per version; the row only carries its path. A link version carries just the URL
 * and the frame loads it directly.
 *
 * Team writes (publish / restore) go straight to Supabase under the team-only RLS policy.
 * The client is `anon` to Supabase, so Approve / Request changes go through
 * landing-page-review.mts instead, which checks the caller's email against the
 * dashboard's allowed_emails on every call — same shape as the suggestion flow.
 *
 * Alongside that decision sits the shared client feedback box (client-feedback.tsx, also
 * used by the Welcome Email Flow). The two are not the same channel: Approve / Request
 * changes is a verdict that closes — after approving, a client had no way to say anything
 * more — while the box is open-ended and stays available either side of it. Its notes ride
 * dashboard_suggestions under "landingPage.all", not landing_pages.review.
 *
 * Deliberately NOT wired into JOURNEY_STEPS this pass: the review state lives here,
 * ready for a future step to read, but adding one touches the Overview page's own large
 * step list and felt like a separate change.
 */

interface LandingPageVersion {
    id: string;
    /** A live URL instead of stored HTML — the page is already hosted (a Netlify preview,
     *  the client's own domain) and the frame loads it as-is. A link version has neither
     *  `path` nor `html`. */
    url?: string;
    /** Object path in the `landing-pages` Storage bucket — every version published since
     *  the 20260910170000 bucket migration. The row holds the path; the bytes live there. */
    path?: string;
    /** Size of the stored file, for the versions list (stat only). */
    bytes?: number;
    /** Legacy: the full HTML inline in the row, from before the bucket existed. Still
     *  rendered and restorable; nothing new is written this way. */
    html?: string;
    /** What changed, or the file's own <title> when nothing was typed — shown next to
     *  the version in the list, never required to publish. */
    note: string;
    publishedAt: string;
    publishedBy: string;
}

interface LandingPageReview {
    status: "pending" | "approved" | "changes";
    /** The client's requested changes — set only when status is "changes". */
    note?: string;
    respondedAt?: string;
    respondedBy?: string;
}

interface LandingPageData {
    /** Newest first — versions[0] is what's live. */
    versions: LandingPageVersion[];
    review: LandingPageReview;
}

const EMPTY_DATA: LandingPageData = { versions: [], review: { status: "pending" } };
const ENDPOINT = "/.netlify/functions/landing-page-review";
const BUCKET = "landing-pages";
// Matches the bucket's file_size_limit. Exports with inline base64 images run 3–10 MB;
// anything past this is almost always an un-optimised image, not a bigger page.
const MAX_HTML_BYTES = 25 * 1024 * 1024;
const TOO_LARGE = "That file is over 25 MB. Host the images at URLs instead of embedding them as base64, then upload again.";

const looksLikeAPage = (html: string) => /<html[\s>]/i.test(html) || /<body[\s>]/i.test(html);
/** Brandon exports a single self-contained file; an `.htm` from an older tool is the same
 *  thing. Anything else (a zip, a Next.js build folder) can't be pasted either. */
const isHtmlFile = (file: File) => /\.html?$/i.test(file.name) || file.type === "text/html";
const bytesOf = (html: string) => new Blob([html]).size;
const fmtSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`);
const sizeOf = (v: LandingPageVersion) => fmtSize(v.bytes ?? bytesOf(v.html ?? ""));
const urlOf = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
const titleOf = (html: string) => html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
/** A version is stored HTML (path / html) or a live link (url) — never both. */
const isLink = (v: LandingPageVersion) => !!v.url;
/** Accepts what actually gets pasted — a bare domain, a full URL, with or without www —
 *  and returns it as an absolute http(s) address, or "" when it isn't one. */
const normalizeUrl = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    try {
        const u = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
        return u.hostname.includes(".") ? u.toString() : "";
    } catch {
        return "";
    }
};
const hostOf = (url: string) => {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
};
/** What the versions list shows after the date: the file size, or the link's host. */
const descOf = (v: LandingPageVersion) => (isLink(v) ? hostOf(v.url!) : sizeOf(v));
const shortDate = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
};

/** Same trick the design used: write the file into a blank tab so it renders exactly as
 *  the client will eventually see it hosted, without the app having its own preview route. */
const openInNewTab = (html: string) => {
    const w = window.open("about:blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
};
/**
 * Read a version's HTML. Storage deliberately serves HTML objects as `text/plain` (so nobody
 * can host a phishing page on a project's bucket), which means the public URL can't be an
 * iframe `src` or a tab on its own — it shows source, and without a charset the browser
 * mangles every non-ASCII character. So the bytes are fetched here and rendered via
 * `srcDoc` / `document.write`, exactly like the legacy inline versions. Public bucket +
 * `access-control-allow-origin: *` is what makes the cross-origin fetch possible.
 */
const fetchHtml = async (v: LandingPageVersion): Promise<string> => {
    if (v.html) return v.html;
    if (!v.path) return "";
    const res = await fetch(urlOf(v.path));
    if (!res.ok) throw new Error(`Storage returned ${res.status}`);
    return res.text();
};
/** Open the tab synchronously (popup blockers), then fill it once the HTML arrives. A link
 *  version is just opened. */
const openVersion = async (v: LandingPageVersion) => {
    if (isLink(v)) {
        window.open(v.url, "_blank", "noopener,noreferrer");
        return;
    }
    const w = window.open("about:blank");
    if (!w) return;
    try {
        const html = await fetchHtml(v);
        w.document.write(html);
        w.document.close();
    } catch {
        w.document.write("<p style='font:14px system-ui;padding:24px'>Couldn't load this version — close the tab and try again.</p>");
        w.document.close();
    }
};

const inputCls =
    "w-full resize-y rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary placeholder:text-placeholder outline-none transition duration-100 ease-linear focus:border-brand focus:ring-1 focus:ring-brand";
const monoInputCls =
    "w-full min-h-[220px] resize-y rounded-lg border bg-secondary px-3.5 py-3 font-mono text-xs leading-5 text-primary placeholder:text-placeholder outline-none transition duration-100 ease-linear focus:border-brand focus:ring-1 focus:ring-brand";

export const LandingPageSection = ({
    slug,
    clientName,
    isTeam,
    isLocked,
    isTemplate,
    teamName,
    clientEmail,
    feedback,
}: {
    slug?: string;
    clientName: string;
    isTeam: boolean;
    isLocked: boolean;
    isTemplate: boolean;
    /** Signed-in AM's display name — attributed on every version this session publishes. */
    teamName: string;
    /** The client's own identity email (see identityEmail in client-dashboard-page.tsx).
     *  Empty for team / an anonymous unlock, in which case Approve / Request changes stay hidden. */
    clientEmail: string;
    /** Open-ended feedback wiring — omit (or mode "off") and no feedback box is shown. */
    feedback?: ClientFeedbackProps;
}) => {
    const [data, setData] = useState<LandingPageData>(EMPTY_DATA);
    const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

    // Two ways to fill the composer: paste / upload HTML, or point at a live URL. Each keeps
    // its own draft so switching tabs never throws away what was typed in the other.
    const [mode, setMode] = useState<"html" | "link">("html");
    const [draft, setDraft] = useState("");
    const [draftError, setDraftError] = useState(false);
    const [linkDraft, setLinkDraft] = useState("");
    const [linkError, setLinkError] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [publishErr, setPublishErr] = useState("");
    const [showReplace, setShowReplace] = useState(false);
    const [restoringId, setRestoringId] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // Load the published landing page for this client.
    useEffect(() => {
        if (!slug || isTemplate) return;
        supabase
            .from("landing_pages")
            .select("data")
            .eq("slug", slug)
            .maybeSingle()
            .then(({ data: row, error }) => {
                const d = row?.data as Partial<LandingPageData> | undefined;
                if (!error && d && Array.isArray(d.versions)) setData({ versions: d.versions, review: d.review ?? { status: "pending" } });
            });
    }, [slug, isTemplate]);

    const versions = data.versions;
    const live = versions[0];
    const canEdit = isTeam && !isLocked && !isTemplate;
    const tagOf = (i: number) => `v${versions.length - i}`;

    // The live version's HTML for the preview frame — fetched from Storage (see fetchHtml).
    // Re-fetched only when the live version changes; a 7 MB file is not something to
    // re-download on every render.
    const [liveHtml, setLiveHtml] = useState<string | null>(null);
    const [liveErr, setLiveErr] = useState(false);
    const liveId = live?.id;
    useEffect(() => {
        // A link version needs no fetch — the frame loads the URL itself.
        if (!live || isLink(live)) return;
        let cancelled = false;
        setLiveHtml(null);
        setLiveErr(false);
        fetchHtml(live)
            .then((html) => {
                if (!cancelled) setLiveHtml(html);
            })
            .catch(() => {
                if (!cancelled) setLiveErr(true);
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liveId]);

    /**
     * Upload is a second way to fill the same draft, not a second pipeline: the file's
     * text lands in the textarea, so Preview, the size/title readout and Publish all work
     * exactly as they do for a paste. That also keeps the AM able to fix a typo in-place
     * before publishing rather than re-exporting.
     */
    const loadFile = async (file: File | undefined) => {
        if (!file || !canEdit) return;
        if (!isHtmlFile(file)) {
            setDraftError(false);
            setPublishErr("That isn't an HTML file — export the page as a single .html file and upload that.");
            return;
        }
        if (file.size > MAX_HTML_BYTES) {
            setDraftError(false);
            setPublishErr(TOO_LARGE);
            return;
        }
        try {
            const text = await file.text();
            setDraft(text);
            setDraftError(false);
            setPublishErr("");
        } catch {
            setPublishErr("Couldn't read that file — try again.");
        }
    };
    const onFilePicked = (e: ChangeEvent<HTMLInputElement>) => {
        void loadFile(e.target.files?.[0]);
        // Reset so picking the same file again (after a Cancel) still fires onChange.
        e.target.value = "";
    };
    const onDrop = (e: DragEvent<HTMLElement>) => {
        e.preventDefault();
        setDragOver(false);
        void loadFile(e.dataTransfer.files?.[0]);
    };
    const onDragOver = (e: DragEvent<HTMLElement>) => {
        if (!canEdit) return;
        e.preventDefault();
        if (!dragOver) setDragOver(true);
    };

    /** The hidden picker plus its button — rendered once per composer. */
    const uploadButton = (
        <>
            <input ref={fileRef} type="file" accept=".html,.htm,text/html" className="hidden" onChange={onFilePicked} disabled={!canEdit} />
            <Button color="secondary" size="md" iconLeading={UploadCloud02} isDisabled={!canEdit} onClick={() => fileRef.current?.click()}>
                Upload HTML file
            </Button>
        </>
    );

    const linkUrl = normalizeUrl(linkDraft);
    const hasDraft = mode === "link" ? !!linkUrl : !!draft.trim();
    const resetComposer = () => {
        setDraft("");
        setLinkDraft("");
        setDraftError(false);
        setLinkError(false);
        setPublishErr("");
    };
    /** Preview the draft in a new tab — the pasted HTML written into a blank tab, or the link itself. */
    const previewDraft = () => {
        if (mode === "link") window.open(linkUrl, "_blank", "noopener,noreferrer");
        else openInNewTab(draft);
    };

    /** Paste HTML / Live link — same segmented control as the Desktop / Mobile switch. */
    const modeTabs = (
        <div className="flex w-fit items-center gap-1 rounded-lg bg-secondary p-1">
            {(
                [
                    { id: "html", icon: Code02, label: "Paste HTML" },
                    { id: "link", icon: Link01, label: "Live link" },
                ] as const
            ).map((m) => (
                <button
                    key={m.id}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => {
                        setMode(m.id);
                        setDraftError(false);
                        setLinkError(false);
                        setPublishErr("");
                    }}
                    className={cx(
                        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition duration-100 ease-linear disabled:cursor-not-allowed disabled:opacity-50",
                        mode === m.id ? "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300" : "text-tertiary hover:text-primary",
                    )}
                >
                    <m.icon className="size-3.5" aria-hidden="true" />
                    {m.label}
                </button>
            ))}
        </div>
    );

    /** The URL input — rendered in place of the textarea when the Live link tab is active. */
    const linkField = (
        <div className="flex flex-col gap-2">
            <input
                type="url"
                inputMode="url"
                value={linkDraft}
                onChange={(e) => {
                    setLinkDraft(e.target.value);
                    setLinkError(false);
                }}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && hasDraft && !publishing) void publish();
                }}
                spellCheck={false}
                disabled={!canEdit}
                placeholder="https://client-page.netlify.app"
                className={cx(inputCls, "disabled:cursor-not-allowed disabled:opacity-50", linkError ? "border-error-primary" : "border-secondary")}
            />
            {linkError ? (
                <p className="text-sm text-error-primary">That doesn't look like a web address — paste the full link, starting with https://.</p>
            ) : (
                <p className="text-sm text-quaternary">
                    The live page loads in the frame below on desktop and mobile. Some hosts refuse to be embedded — if the frame stays blank, Open full page
                    still works.
                </p>
            )}
        </div>
    );

    const [changesOpen, setChangesOpen] = useState(false);
    const [reviewNote, setReviewNote] = useState("");
    const [reviewBusy, setReviewBusy] = useState(false);
    const [reviewErr, setReviewErr] = useState("");

    const persist = async (next: LandingPageData) => {
        if (!slug) return false;
        const { error } = await supabase
            .from("landing_pages")
            .upsert({ slug, client_name: clientName, data: next, updated_at: new Date().toISOString() }, { onConflict: "slug" });
        return !error;
    };

    /** A link version is a row write only — nothing goes to Storage. */
    const publishLink = async () => {
        const url = normalizeUrl(linkDraft);
        if (!url) {
            setLinkError(true);
            setPublishErr("");
            return;
        }
        if (!slug) return;
        setLinkError(false);
        setPublishErr("");
        setPublishing(true);
        const version: LandingPageVersion = {
            id: uid(),
            url,
            note: hostOf(url),
            publishedAt: new Date().toISOString(),
            publishedBy: teamName,
        };
        const next: LandingPageData = { versions: [version, ...versions], review: { status: "pending" } };
        const ok = await persist(next);
        setPublishing(false);
        if (!ok) {
            setPublishErr("Couldn't publish — try again.");
            return;
        }
        setData(next);
        setLinkDraft("");
        setShowReplace(false);
    };

    const publish = async () => {
        if (mode === "link") return publishLink();
        if (!draft.trim()) return;
        if (!looksLikeAPage(draft)) {
            setDraftError(true);
            setPublishErr("");
            return;
        }
        const size = bytesOf(draft);
        if (size > MAX_HTML_BYTES) {
            setPublishErr(TOO_LARGE);
            return;
        }
        if (!slug) return;
        setDraftError(false);
        setPublishErr("");
        setPublishing(true);

        // Bytes to Storage first, path to the row second. The object is named by the
        // version id under the slug, so it's immutable and a failed row write leaves at
        // worst an orphan file, never a version pointing at nothing.
        const id = uid();
        const path = `${slug}/${id}.html`;
        const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(path, new Blob([draft], { type: "text/html" }), { contentType: "text/html", cacheControl: "31536000" });
        if (upErr) {
            setPublishing(false);
            setPublishErr(
                /bucket/i.test(upErr.message)
                    ? "Storage isn't set up for landing pages yet — apply the landing-pages bucket migration, then try again."
                    : `Couldn't upload the file — ${upErr.message}`,
            );
            return;
        }

        const version: LandingPageVersion = {
            id,
            path,
            bytes: size,
            note: titleOf(draft),
            publishedAt: new Date().toISOString(),
            publishedBy: teamName,
        };
        const next: LandingPageData = { versions: [version, ...versions], review: { status: "pending" } };
        const ok = await persist(next);
        setPublishing(false);
        if (!ok) {
            setPublishErr("Couldn't publish — try again.");
            return;
        }
        setData(next);
        setDraft("");
        setShowReplace(false);
    };

    const restore = async (v: LandingPageVersion, tag: string) => {
        setRestoringId(v.id);
        // Points at the same stored object (or carries the same inline HTML) — nothing is
        // copied, so a restore is a row write only.
        const version: LandingPageVersion = {
            id: uid(),
            url: v.url,
            path: v.path,
            bytes: v.bytes,
            html: v.html,
            note: `Restored ${tag}`,
            publishedAt: new Date().toISOString(),
            publishedBy: teamName,
        };
        const next: LandingPageData = { versions: [version, ...versions], review: { status: "pending" } };
        const ok = await persist(next);
        setRestoringId(null);
        if (ok) setData(next);
    };

    const respond = async (action: "approve" | "request_changes", note?: string) => {
        if (!slug || !clientEmail) return;
        setReviewBusy(true);
        setReviewErr("");
        try {
            const res = await fetch(ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, slug, email: clientEmail, note }),
            });
            const json = (await res.json().catch(() => ({}))) as { error?: string; review?: LandingPageReview };
            if (!res.ok || !json.review) {
                setReviewErr(json.error || "Something went wrong — try again.");
                return;
            }
            setData((d) => ({ ...d, review: json.review! }));
            setChangesOpen(false);
            setReviewNote("");
        } catch {
            setReviewErr("Something went wrong — try again.");
        } finally {
            setReviewBusy(false);
        }
    };

    const subtitle = isTeam
        ? "Upload or paste the finished HTML, or drop in the live link, and it renders here for the client. Every publish is kept as a version you can restore."
        : live
          ? "Your direct-booking page, ready for review. Try it on desktop and mobile, then let us know."
          : "The page that turns visitors into direct bookings.";

    const reviewCopy: Record<LandingPageReview["status"], { color: "warning" | "success" | "gray"; text: string }> = {
        pending: { color: "warning", text: "Awaiting review" },
        approved: { color: "success", text: "Approved" },
        changes: { color: "gray", text: "Changes requested" },
    };
    const rv = reviewCopy[data.review.status];

    return (
        <div>
            <div>
                <h2 className="text-display-xs font-semibold text-primary md:text-display-sm">Landing page</h2>
                <p className="mt-1.5 max-w-2xl text-md text-pretty text-tertiary">{subtitle}</p>
            </div>

            {/* ── Client, nothing published yet — reassurance, not a dead end ── */}
            {!isTeam && !live && (
                <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl bg-primary px-8 py-16 text-center ring-1 ring-secondary">
                    <FeaturedIcon icon={Globe01} color="gray" theme="light" size="lg" className="mb-2" />
                    <p className="text-md font-semibold text-primary">Your landing page is on its way</p>
                    <p className="max-w-md text-sm text-pretty text-tertiary">
                        We're building it from your Master Brand and Brand Kit. Once it's ready you'll review it right here and tell us anything you'd like
                        changed.
                    </p>
                </div>
            )}

            {/* ── Team, nothing published yet — the paste composer ── */}
            {isTeam && !live && (
                <div className="mt-6 flex flex-col rounded-2xl bg-primary ring-1 ring-secondary">
                    <div className="flex items-start justify-between gap-4 border-b border-secondary px-6 py-5">
                        <div>
                            <p className="text-md font-semibold text-primary">Add the landing page</p>
                            <p className="mt-0.5 text-sm text-pretty text-tertiary">
                                Upload the exported .html file or paste the complete page, or link to the page where it's already hosted. It renders exactly as
                                the client will see it. Clients see "on its way" until you publish.
                            </p>
                        </div>
                        <Badge color="gray" size="md" type="pill-color">
                            Not published
                        </Badge>
                    </div>
                    <div className="flex flex-col gap-3 px-6 py-5">
                        {modeTabs}
                        {mode === "link" ? (
                            linkField
                        ) : (
                            <textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onDrop={onDrop}
                                onDragOver={onDragOver}
                                onDragLeave={() => setDragOver(false)}
                                spellCheck={false}
                                disabled={!canEdit}
                                placeholder="Drop the .html file here, or paste the full page — from the opening html tag to the closing one."
                                className={cx(
                                    monoInputCls,
                                    draftError ? "border-error-primary" : dragOver ? "border-brand ring-1 ring-brand" : "border-secondary",
                                )}
                            />
                        )}
                        {draftError && (
                            <div role="alert" className="flex items-start gap-3 rounded-xl bg-error-primary p-3.5 ring-1 ring-error_subtle">
                                <AlertCircle className="mt-0.5 size-5 shrink-0 text-fg-error-secondary" aria-hidden="true" />
                                <div className="flex flex-col gap-0.5">
                                    <p className="text-sm font-semibold text-primary">Couldn't publish this file</p>
                                    <p className="text-sm text-tertiary">
                                        It doesn't look like a complete page. Make sure it has an html or body tag and nothing was cut off when copying.
                                    </p>
                                </div>
                            </div>
                        )}
                        {publishErr && !draftError && !linkError && <p className="text-sm text-error-primary">{publishErr}</p>}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm text-quaternary">
                                {mode === "link"
                                    ? linkUrl
                                        ? `Link: ${hostOf(linkUrl)}`
                                        : "Nothing added yet"
                                    : draft.trim()
                                      ? `${fmtSize(bytesOf(draft))} · ${titleOf(draft) ? `Title: ${titleOf(draft)}` : "No title tag found"}`
                                      : "Nothing added yet"}
                            </p>
                            <div className="flex flex-wrap gap-3">
                                {mode === "html" && uploadButton}
                                <Button color="secondary" size="md" isDisabled={!hasDraft || !canEdit} onClick={previewDraft}>
                                    Preview
                                </Button>
                                <Button size="md" isDisabled={!hasDraft || !canEdit} isLoading={publishing} showTextWhileLoading onClick={() => void publish()}>
                                    {publishing ? "Publishing…" : "Publish to client"}
                                </Button>
                            </div>
                        </div>
                        {isLocked && <p className="text-xs text-quaternary">Unlock the dashboard to upload, paste, link and publish.</p>}
                    </div>
                </div>
            )}

            {/* ── A version exists — the live preview, for team and client alike ── */}
            {live && (
                <div className="mt-6 flex flex-col overflow-hidden rounded-2xl bg-primary ring-1 ring-secondary">
                    <div className="flex flex-wrap items-center gap-3 border-b border-secondary px-4 py-3">
                        <div className="flex min-w-[200px] flex-1 items-center gap-2.5">
                            <BadgeWithDot color="success" size="sm" type="pill-color">
                                Live
                            </BadgeWithDot>
                        </div>
                        <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
                            {(
                                [
                                    { id: "desktop", icon: Monitor01, label: "Desktop" },
                                    { id: "mobile", icon: Phone01, label: "Mobile" },
                                ] as const
                            ).map((v) => (
                                <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => setDevice(v.id)}
                                    className={cx(
                                        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition duration-100 ease-linear",
                                        device === v.id
                                            ? "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300"
                                            : "text-tertiary hover:text-primary",
                                    )}
                                >
                                    <v.icon className="size-3.5" aria-hidden="true" />
                                    {v.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex flex-1 justify-end gap-2">
                            {canEdit && (
                                <Button color="secondary" size="sm" iconLeading={Code02} onClick={() => setShowReplace((v) => !v)}>
                                    Replace page
                                </Button>
                            )}
                            <Button color="secondary" size="sm" iconLeading={LinkExternal01} onClick={() => void openVersion(live)}>
                                Open full page
                            </Button>
                        </div>
                    </div>

                    {canEdit && showReplace && (
                        <div className="flex flex-col gap-3 border-b border-secondary bg-secondary px-4 py-4">
                            {modeTabs}
                            {mode === "link" ? (
                                linkField
                            ) : (
                                <textarea
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onDrop={onDrop}
                                    onDragOver={onDragOver}
                                    onDragLeave={() => setDragOver(false)}
                                    spellCheck={false}
                                    placeholder="Drop or paste the new HTML here. Publishing creates a new version — the current one stays in the list below."
                                    className={cx(
                                        monoInputCls,
                                        "min-h-[180px] bg-primary",
                                        draftError ? "border-error-primary" : dragOver ? "border-brand ring-1 ring-brand" : "border-secondary",
                                    )}
                                />
                            )}
                            {draftError && (
                                <p className="text-sm text-error-primary">It doesn't look like a complete page — make sure it has an html or body tag.</p>
                            )}
                            {publishErr && !draftError && !linkError && <p className="text-sm text-error-primary">{publishErr}</p>}
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-sm text-quaternary">
                                    {mode === "link"
                                        ? linkUrl
                                            ? `Link: ${hostOf(linkUrl)}`
                                            : "Nothing added yet"
                                        : draft.trim()
                                          ? fmtSize(bytesOf(draft))
                                          : "Nothing added yet"}
                                </p>
                                <div className="flex flex-wrap gap-3">
                                    {mode === "html" && uploadButton}
                                    <Button
                                        color="tertiary"
                                        size="md"
                                        onClick={() => {
                                            setShowReplace(false);
                                            resetComposer();
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button size="md" isDisabled={!hasDraft} isLoading={publishing} showTextWhileLoading onClick={() => void publish()}>
                                        {publishing ? "Publishing…" : `Publish as ${tagOf(-1)}`}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={cx("flex justify-center bg-tertiary", device === "mobile" ? "p-8" : "p-0")}>
                        <div
                            className={cx(
                                "relative overflow-hidden bg-primary transition-[width] duration-200 ease-linear",
                                device === "mobile" && "rounded-3xl border border-secondary shadow-lg",
                            )}
                            style={{ width: device === "mobile" ? 390 : "100%", maxWidth: "100%", height: device === "mobile" ? 760 : 640 }}
                        >
                            {/* A link version is framed straight from its URL. The sandbox keeps the
                                live page's scripts and forms working but stops it navigating this
                                tab. Stored HTML is always srcDoc, never the Storage URL as src — see
                                fetchHtml. Keyed by version id so a new version remounts the frame
                                rather than leaving a stale document behind a changed srcDoc. */}
                            {live.url ? (
                                <iframe
                                    key={live.id}
                                    title="Landing page preview"
                                    src={live.url}
                                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                                    referrerPolicy="no-referrer"
                                    className="size-full border-0"
                                />
                            ) : liveHtml !== null ? (
                                <iframe
                                    key={live.id}
                                    title="Landing page preview"
                                    srcDoc={liveHtml}
                                    sandbox="allow-same-origin"
                                    className="size-full border-0"
                                />
                            ) : (
                                <div className="flex size-full flex-col items-center justify-center gap-2 text-center">
                                    {liveErr ? (
                                        <>
                                            <AlertCircle className="size-5 text-fg-error-secondary" aria-hidden="true" />
                                            <p className="text-sm font-medium text-primary">Couldn't load the preview</p>
                                            <p className="max-w-xs text-sm text-tertiary">
                                                Check your connection and reload the page. The published file itself is safe.
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <div
                                                className="size-5 animate-spin rounded-full border-2 border-secondary border-t-fg-brand-primary"
                                                aria-hidden="true"
                                            />
                                            <p className="text-sm text-tertiary">Loading {sizeOf(live)}…</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Can't detect a host that refuses framing (the blocked frame still fires load),
                        so say where the page comes from and point at the way out. */}
                    {live.url && (
                        <p className="border-t border-secondary px-4 py-2.5 text-xs text-quaternary">
                            Showing the live page at {hostOf(live.url)}. If it stays blank, that host blocks embedding — use Open full page.
                        </p>
                    )}
                </div>
            )}

            {/* ── Team panels: versions + review summary ── */}
            {isTeam && live && (
                <div className="mt-6 grid [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))] gap-6">
                    <div className="flex flex-col rounded-2xl bg-primary ring-1 ring-secondary">
                        <div className="flex items-center justify-between border-b border-secondary px-5 py-4">
                            <p className="text-md font-semibold text-primary">Versions</p>
                            <span className="text-sm text-quaternary">
                                {versions.length} version{versions.length === 1 ? "" : "s"}
                            </span>
                        </div>
                        {versions.map((v, i) => (
                            <div key={v.id} className="flex items-center gap-3 border-b border-secondary px-5 py-3 last:border-b-0">
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary font-mono text-xs font-medium text-tertiary">
                                    {tagOf(i)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-primary">{v.note || "Landing page update"}</p>
                                    <p className="text-sm text-quaternary">
                                        {shortDate(v.publishedAt)}
                                        {v.publishedBy ? ` · ${v.publishedBy}` : ""} · {descOf(v)}
                                    </p>
                                </div>
                                {i === 0 ? (
                                    <BadgeWithDot color="success" size="sm" type="pill-color">
                                        Live
                                    </BadgeWithDot>
                                ) : (
                                    canEdit && (
                                        <Button color="tertiary" size="sm" isLoading={restoringId === v.id} onClick={() => void restore(v, tagOf(i))}>
                                            Restore
                                        </Button>
                                    )
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col rounded-2xl bg-primary ring-1 ring-secondary">
                        <div className="flex items-center justify-between gap-3 border-b border-secondary px-5 py-4">
                            <p className="text-md font-semibold text-primary">Client review</p>
                            <BadgeWithDot color={rv.color} size="sm" type="pill-color">
                                {rv.text}
                            </BadgeWithDot>
                        </div>
                        <div className="flex flex-col gap-3 px-5 py-4">
                            <p className="text-sm text-pretty text-tertiary">
                                {data.review.status === "pending" &&
                                    `The client hasn't reviewed ${tagOf(0)} yet. They'll see Approve and Request changes under the preview.`}
                                {data.review.status === "approved" &&
                                    `${data.review.respondedBy ?? "The client"} approved ${tagOf(0)}${data.review.respondedAt ? ` on ${shortDate(data.review.respondedAt)}` : ""}.`}
                                {data.review.status === "changes" &&
                                    `${data.review.respondedBy ?? "The client"} asked for changes${data.review.respondedAt ? ` on ${shortDate(data.review.respondedAt)}` : ""}. Publish a new version to send it back for review.`}
                            </p>
                            {data.review.status === "changes" && data.review.note && (
                                <div className="border-l-2 border-secondary py-1 pl-3.5">
                                    <p className="text-sm text-pretty text-secondary">{data.review.note}</p>
                                </div>
                            )}
                            <p className="text-sm text-quaternary">The client can approve this from their own dashboard, or ask for changes.</p>
                        </div>
                    </div>

                    {/* Open feedback notes — separate from the verdict above, and they can
                        arrive after an approval, so they are listed whatever the review says. */}
                    {feedback && <ClientFeedbackReview feedback={feedback} />}
                </div>
            )}

            {/* ── Client review controls — only once a version is live ── */}
            {!isTeam && live && (
                <div className="mt-6 flex flex-col rounded-2xl bg-primary ring-1 ring-secondary">
                    {data.review.status !== "approved" && (
                        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
                            <div className="min-w-60 flex-1">
                                <p className="text-md font-semibold text-primary">Does this look right to you?</p>
                                <p className="text-sm text-pretty text-tertiary">
                                    Approve it and we'll connect it to your domain. Or tell us what to change and we'll send a new version.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <Button color="secondary" size="md" isDisabled={!clientEmail || reviewBusy} onClick={() => setChangesOpen((v) => !v)}>
                                    Request changes
                                </Button>
                                <Button
                                    size="md"
                                    iconLeading={CheckCircle}
                                    isDisabled={!clientEmail}
                                    isLoading={reviewBusy}
                                    onClick={() => void respond("approve")}
                                >
                                    Approve
                                </Button>
                            </div>
                        </div>
                    )}
                    {data.review.status !== "approved" && changesOpen && (
                        <div className="flex flex-col gap-3 px-6 pb-6">
                            <textarea
                                value={reviewNote}
                                onChange={(e) => setReviewNote(e.target.value)}
                                placeholder="What would you like changed? Be as specific as you can — colours, wording, photos, the order of sections."
                                className={cx(inputCls, "min-h-[120px]")}
                            />
                            {reviewErr && <p className="text-sm text-error-primary">{reviewErr}</p>}
                            <div className="flex justify-end gap-3">
                                <Button color="tertiary" size="md" onClick={() => setChangesOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    size="md"
                                    isDisabled={!reviewNote.trim()}
                                    isLoading={reviewBusy}
                                    showTextWhileLoading
                                    onClick={() => void respond("request_changes", reviewNote.trim())}
                                >
                                    Send to your team
                                </Button>
                            </div>
                        </div>
                    )}
                    {data.review.status === "approved" && (
                        <div className="flex items-start gap-3 px-6 py-5">
                            <CheckCircle className="mt-0.5 size-5 shrink-0 text-fg-success-primary" aria-hidden="true" />
                            <div>
                                <p className="text-sm font-semibold text-primary">Approved</p>
                                <p className="text-sm text-tertiary">
                                    Thanks. Your Account Manager will connect this page to your domain and let you know in Google Chat when it's live.
                                </p>
                            </div>
                        </div>
                    )}
                    {data.review.status === "changes" && (
                        <div className="flex items-start gap-3 border-t border-secondary px-6 py-5">
                            <MessageChatCircle className="mt-0.5 size-5 shrink-0 text-fg-quaternary" aria-hidden="true" />
                            <div className="flex flex-col gap-1.5">
                                <p className="text-sm font-semibold text-primary">Changes requested</p>
                                <p className="text-sm text-pretty text-secondary">{data.review.note}</p>
                                <p className="text-sm text-quaternary">We'll publish a new version here once it's updated.</p>
                            </div>
                        </div>
                    )}
                    {!clientEmail && data.review.status === "pending" && (
                        <p className="px-6 pb-5 text-sm text-quaternary">Sign in with your own email to approve or request changes.</p>
                    )}
                </div>
            )}

            {/* Open-ended feedback — deliberately outside the card above, because it is not
                part of the verdict: it is here before a client decides and still here after
                they have approved, which is when they used to be left with nowhere to write. */}
            {!isTeam && live && feedback && (
                <div className="mt-4">
                    <ClientFeedbackBox feedback={feedback} placeholder="Your feedback on the landing page…" rows={5} />
                </div>
            )}
        </div>
    );
};
