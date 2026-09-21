import { type ChangeEvent, useState } from "react";
import { RefreshCw01, UploadCloud02, XClose } from "@untitledui-pro/icons/line";
import { MAX_VIDEO_BYTES, uploadVideo } from "@/components/application/video-block";
import { PhoneFrame } from "@/components/shared-assets/phone-frame";
import { ReelVideo } from "@/components/shared-assets/reel-video";
import { ClientFeedbackBox, type ClientFeedbackProps, ClientFeedbackReview } from "@/pages/client/dashboard/client-feedback";
import { editInput } from "@/pages/client/dashboard/dashboard-chrome";
import type { ExampleReel } from "@/pages/client/dashboard/dashboard-model";
import { cx } from "@/utils/cx";

/**
 * Marketing → Example Reels: three client reels playing inside the iPhone bezel, the way
 * /mockup shows them — same `PhoneFrame` + `ReelVideo`, so nothing here is re-measured.
 *
 * THE SLOTS ARE FIXED AT THREE (see `normalizeReels`). In edit mode every slot renders,
 * empty ones as an upload target inside the screen; locked, only filled slots render, and
 * the client gets one quiet line when none are.
 *
 * THE CAPTION IS THE TEXT ALTERNATIVE. These loops are silent and autoplay, so the title
 * and description under each phone are what a reduced-motion visitor (or a screen reader)
 * gets instead of the footage — which is why both are editable rather than fixed labels.
 *
 * THE CLIENT ANSWERS IN THE SHARED FEEDBACK BOX (client-feedback.tsx), the same one the
 * welcome emails and the landing page carry — one note on the set of three, editable and
 * withdrawable, read and closed by the team in the review list above the phones.
 *
 * UPLOADS GO TO THE `videos` BUCKET, never into the row: a reel is tens of MB. The bucket
 * caps a file at 50 MB and only accepts mp4 / webm / mov; an iPhone's HEVC .mov will
 * upload but won't play in Chrome, so the hint steers the team to mp4.
 */

const ACCEPT = "video/mp4,video/webm,video/quicktime";

const ReelSlot = ({ reel, isLocked, onChange }: { reel: ExampleReel; isLocked: boolean; onChange: (patch: Partial<ExampleReel>) => void }) => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        if (file.size > MAX_VIDEO_BYTES) {
            setError("Over 50 MB — export the reel again at a lower bitrate.");
            return;
        }
        setError(null);
        setBusy(true);
        try {
            onChange({ url: await uploadVideo(file) });
        } catch {
            setError("Upload failed — check the connection and try again.");
        } finally {
            setBusy(false);
        }
    };

    const title = reel.title.trim();
    const description = reel.description.trim();

    return (
        // Each phone takes its third of the column, capped so an ultrawide window doesn't
        // blow a single reel past a viewport in height. 240px read too small in review.
        <figure className="flex w-[240px] shrink-0 snap-center flex-col items-center sm:w-full sm:max-w-[340px]">
            <PhoneFrame label={title || "Reel"} className="w-full">
                {reel.url ? (
                    // The description is the footage's text alternative (WCAG 1.2.1).
                    <div role="img" aria-label={description || title || "Example reel"} className="size-full">
                        <ReelVideo src={reel.url} />
                    </div>
                ) : isLocked ? undefined : (
                    <label
                        className={cx(
                            "flex size-full cursor-pointer flex-col items-center justify-center gap-2 bg-secondary px-4 text-center text-xs font-medium text-tertiary transition duration-100 ease-linear hover:bg-secondary_hover hover:text-brand-secondary",
                            busy && "pointer-events-none opacity-50",
                        )}
                    >
                        <input type="file" accept={ACCEPT} className="hidden" onChange={handleFile} disabled={busy} />
                        <UploadCloud02 className={cx("size-6", busy && "animate-pulse")} aria-hidden="true" />
                        {busy ? "Uploading…" : "Upload reel"}
                        {!busy && <span className="text-[11px] font-normal text-quaternary">9:16 mp4 · up to 50 MB</span>}
                    </label>
                )}
            </PhoneFrame>

            {isLocked ? (
                <figcaption className="mt-5 text-center">
                    <span className="block text-md font-semibold text-primary">{title || "Example reel"}</span>
                    {description && <span className="mt-1 block text-sm text-tertiary">{description}</span>}
                </figcaption>
            ) : (
                <figcaption className="mt-4 flex w-full flex-col gap-2">
                    {reel.url && (
                        <div className="flex items-center justify-center gap-1.5">
                            <label
                                className={cx(
                                    "flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-tertiary transition duration-100 ease-linear hover:bg-secondary hover:text-brand-secondary",
                                    busy && "pointer-events-none opacity-50",
                                )}
                            >
                                <input type="file" accept={ACCEPT} className="hidden" onChange={handleFile} disabled={busy} />
                                <RefreshCw01 className={cx("size-3.5", busy && "animate-spin")} aria-hidden="true" />
                                {busy ? "Uploading…" : "Replace"}
                            </label>
                            <button
                                type="button"
                                onClick={() => onChange({ url: "" })}
                                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-tertiary transition duration-100 ease-linear hover:bg-error-primary hover:text-error-primary"
                            >
                                <XClose className="size-3.5" aria-hidden="true" />
                                Remove
                            </button>
                        </div>
                    )}
                    <input
                        type="text"
                        value={reel.title}
                        placeholder="Reel title"
                        aria-label="Reel title"
                        onChange={(e) => onChange({ title: e.target.value })}
                        className={editInput("text-center font-semibold")}
                    />
                    <textarea
                        value={reel.description}
                        placeholder="What the reel shows — one line"
                        aria-label="Reel description"
                        rows={2}
                        onChange={(e) => onChange({ description: e.target.value })}
                        className={editInput("resize-none text-center")}
                    />
                    {error && <p className="text-center text-xs text-error-primary">{error}</p>}
                </figcaption>
            )}
        </figure>
    );
};

export const ExampleReelsSection = ({
    reels,
    isLocked,
    onChange,
    feedback,
}: {
    reels: ExampleReel[];
    isLocked: boolean;
    onChange: (id: string, patch: Partial<ExampleReel>) => void;
    /** The shared client feedback box — the same one the welcome emails and landing page use. */
    feedback?: ClientFeedbackProps;
}) => {
    const shown = isLocked ? reels.filter((r) => r.url) : reels;

    if (!shown.length) {
        return (
            // Nothing to watch yet, so nothing to say about it — the feedback box waits until
            // there is a reel on screen rather than asking for notes on an empty section.
            <p className="mt-6 rounded-xl border border-dashed border-secondary px-4 py-5 text-sm text-quaternary italic">Your example reels are on the way.</p>
        );
    }

    return (
        <>
            {/* The team's side above the phones: an open note is the reason they opened this
                section, so it shouldn't sit below three full-height reels. */}
            {feedback && (
                // `empty:hidden` because the review list renders nothing at all for a client,
                // or for a team with no open notes — an empty div would leave its margin behind.
                <div className="mt-8 empty:hidden">
                    <ClientFeedbackReview feedback={feedback} />
                </div>
            )}

            <div className="-mx-4 mt-8 scrollbar-hide flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:justify-items-center sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0">
                {shown.map((reel) => (
                    <ReelSlot key={reel.id} reel={reel} isLocked={isLocked} onChange={(patch) => onChange(reel.id, patch)} />
                ))}
            </div>

            {/* The client's: one note on the set, under the reels they just watched. Capped at
                the width of a paragraph — a textarea spanning three phones reads as a form. */}
            {feedback && (
                <div className="mt-8 max-w-2xl empty:hidden">
                    <ClientFeedbackBox
                        feedback={feedback}
                        placeholder="Anything you'd change? Name the reel if it helps — “the second one, the music is too loud”."
                        rows={4}
                    />
                </div>
            )}
        </>
    );
};
