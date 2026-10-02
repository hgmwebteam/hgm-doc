import { type CSSProperties, type ChangeEvent, type KeyboardEvent, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw01, UploadCloud02, XClose } from "@untitledui-pro/icons/line";
import { motion, useReducedMotion } from "motion/react";
import { MAX_VIDEO_BYTES, uploadVideo } from "@/components/application/video-block";
import { PhoneFrame } from "@/components/shared-assets/phone-frame";
import { ReelVideo } from "@/components/shared-assets/reel-video";
import { ClientFeedbackBox, type ClientFeedbackProps, ClientFeedbackReview } from "@/pages/client/dashboard/client-feedback";
import { editInput } from "@/pages/client/dashboard/dashboard-chrome";
import type { ExampleReel } from "@/pages/client/dashboard/dashboard-model";
import { cx } from "@/utils/cx";

/**
 * Marketing → Example Reels: the team's reels playing inside the iPhone bezel, the way
 * /mockup shows them — same `PhoneFrame` + `ReelVideo`, so nothing here is re-measured.
 *
 * ONE REEL AT A TIME. Three loops side by side all moving at once gave the eye nowhere to
 * land, so the set is a stage: the reel in focus sits centre at full size and is the only
 * one playing; its two neighbours wait either side, smaller, dimmed and paused on their
 * first frame. They are still on screen — that is the "two more to see" — and clicking
 * one brings it to the centre. Arrows, the segment indicator, ← → on the keyboard and a
 * swipe all do the same. With exactly three slots the ring wraps, so every reel always has
 * a neighbour on each side and the stage never shows a gap.
 *
 * THE SLOTS ARE FIXED AT THREE (see `normalizeReels`). In edit mode every slot is on the
 * stage, empty ones as an upload target when in focus and a labelled blank beside it;
 * locked, only filled slots are, and the client gets one quiet line when none are.
 *
 * THE CAPTION IS THE TEXT ALTERNATIVE. These loops are silent and autoplay, so the title
 * and description at the top of the stage are what a reduced-motion visitor (or a screen
 * reader) gets instead of the footage — which is why both are editable rather than fixed
 * labels. The caption follows the reel in focus and is a live region, so moving between
 * reels is announced. It sits above the phone, not under it, so the name is read before
 * the footage it names.
 *
 * NO FEEDBACK BOX ON THIS SECTION. The dashboard passes no `feedback`, so neither the
 * client's box nor the team's review list renders. The prop is kept so it can come back by
 * passing it again (client-feedback.tsx, like the welcome emails and landing page).
 *
 * UPLOADS GO TO THE `videos` BUCKET, never into the row: a reel is tens of MB. The bucket
 * caps a file at 50 MB and only accepts mp4 / webm / mov; an iPhone's HEVC .mov will
 * upload but won't play in Chrome, so the hint steers the team to mp4.
 */

const ACCEPT = "video/mp4,video/webm,video/quicktime";

/** How far a neighbour sits from the centre (of its own width), how small, how faded. */
const SIDE = { shift: 78, scale: 0.74, opacity: 0.2 };

/**
 * The arrows sit just outside the neighbours, centred on the phone: half the stage, less
 * how far a neighbour reaches (its shift plus half its scaled width ≈ 1.15 phone widths),
 * less the button and a gap. On a narrow stage that goes negative, so they pin to the edge.
 */
const ARROW_INSET = "max(0px, calc(50% - var(--reel-w) * 1.15 - 60px))";

/** The reel's width on the stage: a phone's worth, never so wide a reel outgrows a laptop viewport. */
const STAGE_VARS = { "--reel-w": "clamp(232px, 42%, 320px)" } as CSSProperties;

type UploadState = { busy?: boolean; error?: string | null };

/**
 * Where slot `index` sits relative to the one in focus, as a ring: -1 left, 0 centre, +1
 * right. Three slots always fill all three places; two leave the left one empty.
 */
const offsetOf = (index: number, active: number, count: number) => {
    const d = (((index - active) % count) + count) % count;
    return d > count / 2 ? d - count : d;
};

const ReelSlide = ({
    reel,
    index,
    offset,
    count,
    isLocked,
    upload,
    onFocus,
    onFile,
}: {
    reel: ExampleReel;
    index: number;
    offset: number;
    count: number;
    isLocked: boolean;
    upload: UploadState;
    onFocus: () => void;
    onFile: (e: ChangeEvent<HTMLInputElement>) => void;
}) => {
    const reduced = useReducedMotion();
    const isActive = offset === 0;
    const title = reel.title.trim();
    const description = reel.description.trim();
    const label = `${index + 1} of ${count}: ${title || "Example reel"}`;

    return (
        <motion.div
            role="group"
            aria-roledescription="slide"
            aria-label={label}
            // Neighbours are a mouse affordance; the keyboard gets the arrows below, so
            // they stay out of the tab order and the accessibility tree.
            aria-hidden={!isActive || undefined}
            onClick={isActive ? undefined : onFocus}
            className={cx("absolute top-0 left-[calc(50%-var(--reel-w)/2)] w-[var(--reel-w)] origin-center", !isActive && "cursor-pointer")}
            style={{ zIndex: isActive ? 2 : 1 }}
            initial={false}
            animate={{
                x: `${offset * SIDE.shift}%`,
                scale: isActive ? 1 : SIDE.scale,
                opacity: isActive ? 1 : SIDE.opacity,
            }}
            whileHover={isActive ? undefined : { opacity: 0.45 }}
            transition={reduced ? { duration: 0 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
            <PhoneFrame label={`Slot ${index + 1} · empty`} className="w-full drop-shadow-xl">
                {reel.url ? (
                    // The description is the footage's text alternative (WCAG 1.2.1).
                    <div role="img" aria-label={description || title || "Example reel"} className="size-full">
                        {/* Only the reel in focus moves; a neighbour holds its first frame. */}
                        <ReelVideo src={reel.url} paused={!isActive} />
                    </div>
                ) : isLocked || !isActive ? undefined : (
                    <label
                        className={cx(
                            "flex size-full cursor-pointer flex-col items-center justify-center gap-2 bg-secondary px-4 text-center text-xs font-medium text-tertiary transition duration-100 ease-linear hover:bg-secondary_hover hover:text-brand-secondary",
                            upload.busy && "pointer-events-none opacity-50",
                        )}
                    >
                        <input type="file" accept={ACCEPT} className="hidden" onChange={onFile} disabled={upload.busy} />
                        <UploadCloud02 className={cx("size-6", upload.busy && "animate-pulse")} aria-hidden="true" />
                        {upload.busy ? "Uploading…" : "Upload reel"}
                        {!upload.busy && <span className="text-[11px] font-normal text-quaternary">9:16 mp4 · up to 50 MB</span>}
                    </label>
                )}
            </PhoneFrame>
        </motion.div>
    );
};

const StageButton = ({
    label,
    icon: Icon,
    onPress,
    className,
    style,
}: {
    label: string;
    icon: typeof ChevronLeft;
    onPress: () => void;
    className?: string;
    style?: CSSProperties;
}) => (
    <button
        type="button"
        aria-label={label}
        onClick={onPress}
        style={style}
        className={cx(
            "flex size-11 items-center justify-center rounded-full border border-primary bg-primary text-fg-secondary shadow-md transition duration-100 ease-linear outline-none hover:bg-primary_hover hover:text-fg-primary focus-visible:ring-2 focus-visible:ring-brand",
            className,
        )}
    >
        <Icon className="size-5" aria-hidden="true" />
    </button>
);

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
    const reduced = useReducedMotion();
    const [focused, setFocused] = useState(0);
    const [uploads, setUploads] = useState<Record<string, UploadState>>({});

    const shown = isLocked ? reels.filter((r) => r.url) : reels;
    const count = shown.length;
    // Clamp rather than reset: clearing the last slot in edit mode must not throw the stage
    // back to the first.
    const active = Math.min(focused, Math.max(count - 1, 0));
    const reel = shown[active];

    const go = (step: number) => setFocused((((active + step) % count) + count) % count);

    /** True when the event started in one of the caption's edit inputs, where ← → and a
     *  drag mean "move the caret" and "select text", never "change reel". */
    const fromInput = (target: EventTarget | null) => target instanceof Element && !!target.closest("input, textarea");

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        if (fromInput(e.target)) return;
        e.preventDefault();
        go(e.key === "ArrowLeft" ? -1 : 1);
    };

    const fileHandler = (id: string) => async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        if (file.size > MAX_VIDEO_BYTES) {
            setUploads((u) => ({ ...u, [id]: { error: "Over 50 MB — export the reel again at a lower bitrate." } }));
            return;
        }
        setUploads((u) => ({ ...u, [id]: { busy: true } }));
        try {
            onChange(id, { url: await uploadVideo(file) });
            setUploads((u) => ({ ...u, [id]: {} }));
        } catch {
            setUploads((u) => ({ ...u, [id]: { error: "Upload failed — check the connection and try again." } }));
        }
    };

    if (!count || !reel) {
        return (
            // Nothing to watch yet, so nothing to say about it — the feedback box waits until
            // there is a reel on screen rather than asking for notes on an empty section.
            <p className="mt-6 rounded-xl border border-dashed border-secondary px-4 py-5 text-sm text-quaternary italic">Your example reels are on the way.</p>
        );
    }

    const upload = uploads[reel.id] ?? {};
    const title = reel.title.trim();
    const description = reel.description.trim();

    return (
        <>
            {/* The team's side above the stage: an open note is the reason they opened this
                section, so it shouldn't sit below a full-height reel. */}
            {feedback && (
                // `empty:hidden` because the review list renders nothing at all for a client,
                // or for a team with no open notes — an empty div would leave its margin behind.
                <div className="mt-8 empty:hidden">
                    <ClientFeedbackReview feedback={feedback} />
                </div>
            )}

            {/* The stage. A bounded panel, not open page: the neighbours fade into its edge,
                and on a phone they are clipped to a peek rather than pushing the page wide. */}
            <motion.div
                role="group"
                aria-roledescription="carousel"
                aria-label="Example reels"
                tabIndex={0}
                onKeyDown={onKeyDown}
                // A swipe is the gesture a reel already teaches. `touch-pan-y` keeps the page
                // scrolling vertically through the stage.
                onPanEnd={(event, info) => {
                    if (count < 2 || fromInput(event.target)) return;
                    if (info.offset.x < -48) go(1);
                    else if (info.offset.x > 48) go(-1);
                }}
                style={STAGE_VARS}
                className="mt-8 touch-pan-y overflow-hidden rounded-3xl border border-secondary bg-secondary bg-radial-[ellipse_70%_60%_at_50%_42%] from-primary to-secondary outline-none select-none focus-visible:ring-2 focus-visible:ring-brand"
            >
                {/* The caption leads: name first, then the phone it names. Keyed so it fades in
                    fresh with each reel; `aria-live` so moving between reels is announced, not
                    silent. `select-text` because the stage is select-none and the edit inputs
                    live here. */}
                <div aria-live="polite" className="mx-auto w-full max-w-[400px] px-4 pt-6 select-text sm:pt-7">
                    <motion.div
                        key={reel.id}
                        initial={reduced ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className={cx("flex flex-col", isLocked ? "items-center text-center" : "gap-2")}
                    >
                        <span className={cx("text-xs font-semibold tracking-wide text-quaternary uppercase", !isLocked && "text-center")}>
                            {isLocked ? "Reel" : "Slot"} {active + 1} of {count}
                        </span>

                        {isLocked ? (
                            <>
                                <span className="mt-1.5 block text-lg font-semibold text-primary">{title || "Example reel"}</span>
                                {description && <span className="mt-1 block text-sm text-tertiary">{description}</span>}
                            </>
                        ) : (
                            <>
                                {reel.url && (
                                    <div className="flex items-center justify-center gap-1.5">
                                        <label
                                            className={cx(
                                                "flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-tertiary transition duration-100 ease-linear hover:bg-secondary hover:text-brand-secondary",
                                                upload.busy && "pointer-events-none opacity-50",
                                            )}
                                        >
                                            <input type="file" accept={ACCEPT} className="hidden" onChange={fileHandler(reel.id)} disabled={upload.busy} />
                                            <RefreshCw01 className={cx("size-3.5", upload.busy && "animate-spin")} aria-hidden="true" />
                                            {upload.busy ? "Uploading…" : "Replace"}
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => onChange(reel.id, { url: "" })}
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
                                    onChange={(e) => onChange(reel.id, { title: e.target.value })}
                                    className={editInput("text-center font-semibold")}
                                />
                                <textarea
                                    value={reel.description}
                                    placeholder="What the reel shows — one line"
                                    aria-label="Reel description"
                                    rows={2}
                                    onChange={(e) => onChange(reel.id, { description: e.target.value })}
                                    className={editInput("resize-none text-center")}
                                />
                                {upload.error && <p className="text-center text-xs text-error-primary">{upload.error}</p>}
                            </>
                        )}
                    </motion.div>
                </div>

                {/* Padding sits on this wrapper, not the positioned box: an absolute child
                    ignores its parent's padding, so a padded parent would put the phone on
                    the panel's top edge. */}
                <div className="px-4 pt-5 sm:pt-6">
                    <div className="relative flex justify-center">
                        {/* Sets the stage's height: the phones are positioned over this blank. */}
                        <div aria-hidden="true" className="aspect-626/1290 w-[var(--reel-w)]" />
                        {shown.map((r, i) => (
                            <ReelSlide
                                key={r.id}
                                reel={r}
                                index={i}
                                count={count}
                                offset={offsetOf(i, active, count)}
                                isLocked={isLocked}
                                upload={uploads[r.id] ?? {}}
                                onFocus={() => setFocused(i)}
                                onFile={fileHandler(r.id)}
                            />
                        ))}

                        {/* The arrows flank the phone at its midline, above the neighbours.
                            Hidden for a single reel — there is nowhere to go. */}
                        {count > 1 && (
                            <>
                                <StageButton
                                    label="Previous reel"
                                    icon={ChevronLeft}
                                    onPress={() => go(-1)}
                                    className="absolute top-1/2 z-10 -translate-y-1/2"
                                    style={{ left: ARROW_INSET }}
                                />
                                <StageButton
                                    label="Next reel"
                                    icon={ChevronRight}
                                    onPress={() => go(1)}
                                    className="absolute top-1/2 z-10 -translate-y-1/2"
                                    style={{ right: ARROW_INSET }}
                                />
                            </>
                        )}
                    </div>
                </div>

                {/* Where you are in the set, under the phone: one segment per reel, the one in
                    focus drawn long. */}
                {count > 1 && (
                    <div className="flex items-center justify-center gap-1.5 px-4 pt-5 pb-5">
                        {shown.map((r, i) => (
                            <button
                                key={r.id}
                                type="button"
                                aria-label={`Show reel ${i + 1} of ${count}${r.title.trim() ? `: ${r.title.trim()}` : ""}`}
                                aria-current={i === active ? "true" : undefined}
                                onClick={() => setFocused(i)}
                                className={cx(
                                    "h-1.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
                                    reduced ? "transition-none" : "transition-all duration-300 ease-out",
                                    i === active ? "w-7 bg-brand-solid" : "w-2 bg-quaternary hover:bg-fg-quaternary",
                                )}
                            />
                        ))}
                    </div>
                )}
            </motion.div>

            {/* The client's: one note on the set, under the reel they just watched. Capped at
                the width of a paragraph — a textarea spanning the stage reads as a form. */}
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
