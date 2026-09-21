import { type PointerEvent, useEffect, useRef, useState } from "react";
import { ChevronLeft, MessageChatCircle } from "@untitledui/icons";
import { useReducedMotion } from "motion/react";
import { IMAGE_SLIDE_SECONDS, type StoryHighlight, type StorySlide, coverOf, storyFrames } from "@/pages/client/dashboard/pinned-stories-model";
import { IgScreen, IgStatusBar } from "@/pages/team/mockup-ig/ig-chrome";
import { IgProfileScreen } from "@/pages/team/mockup-ig/ig-profile";
import type { IgProfile } from "@/pages/team/mockup-ig/instagram-data";
import { cx } from "@/utils/cx";

/**
 * The client's Instagram profile with its pinned highlights, playing inside a phone screen.
 *
 * Two views. PROFILE is the /mockup-ig profile surface — the same one Pinned Posts shows
 * next door, so the client meets one account across both sections — with the highlight
 * circles made tappable. What they are approving is "what sits at the top of my profile",
 * so that is the first frame they see. STORY plays one highlight: segmented progress bar,
 * cover + title header, the slide, tap zones (left third back, the rest forward), and
 * hold-to-pause — the gestures the client already knows from the real app.
 *
 * The bottom "Send message" bar is the one deliberate departure: on Instagram it DMs the
 * account; here it hands the current slide to the caller (`onReply`), which is how a
 * client leaves a note on precisely the slide they're looking at. Feedback therefore
 * needs no "which slide do you mean?" step.
 *
 * Controlled: the caller owns `position` so the arrange panel beside the phone can jump
 * it, and comments beside the phone can say "Slide 3 of 6 · FAQ" from the same value.
 *
 * Everything renders inside IgScreen's 402 × 874pt stage, so the px values below are
 * iPhone points, not CSS pixels — the stage scales to the frame. Colours come from the
 * `.ig-surface` variables (src/styles/instagram.css), never HGM tokens: this is a picture
 * of Instagram, and Instagram does not follow the portal's theme.
 *
 * Auto-advance is driven by the CSS animation's `animationend` (see story-progress in
 * globals.css) for images and by `ended` for videos — never a parallel timer. Under
 * reduced motion nothing auto-advances: the segment fills instantly and the client taps.
 */

export interface StoryPosition {
    /** null = the profile view. */
    highlightId: string | null;
    slide: number;
}

export const PROFILE: StoryPosition = { highlightId: null, slide: 0 };

/** Status bar 48pt + the 6pt gap IgStoryProgress uses, so the two story surfaces agree. */
const CHROME_TOP = 54;

export const StoryPlayer = ({
    highlights,
    position,
    onPosition,
    profile,
    onReply,
    replyLabel = "Send message",
    commentCountFor,
    className,
}: {
    highlights: StoryHighlight[];
    position: StoryPosition;
    onPosition: (p: StoryPosition) => void;
    /** The account the profile view shows. Its `highlights` are ignored — this player's own set is the tray. */
    profile: IgProfile;
    /** Called with the slide on screen when the reply bar is tapped. Omit to hide the bar. */
    onReply?: (highlightId: string, slideId: string) => void;
    replyLabel?: string;
    /** Notes already left on a slide — shown as a small count so the client sees what's covered. */
    commentCountFor?: (slideId: string) => number;
    className?: string;
}) => {
    const reduced = useReducedMotion();
    const [holding, setHolding] = useState(false);
    const [videoProgress, setVideoProgress] = useState(0);
    const downAt = useRef(0);
    const downX = useRef(0);

    const hIndex = highlights.findIndex((h) => h.id === position.highlightId);
    const highlight = hIndex >= 0 ? highlights[hIndex] : null;
    // Frames, not slides: a coverless highlight's first image is its icon and never plays.
    const frames = highlight ? storyFrames(highlight) : [];
    const slide = frames[position.slide] ?? null;

    // Bounce back to the profile if the highlight on screen was deleted or emptied
    // underneath us (the arrange panel can do both).
    useEffect(() => {
        if (position.highlightId && (!highlight || !slide)) onPosition(PROFILE);
    }, [position.highlightId, highlight, slide, onPosition]);

    useEffect(() => setVideoProgress(0), [position.highlightId, position.slide]);

    const next = () => {
        if (!highlight) return;
        if (position.slide + 1 < frames.length) return onPosition({ highlightId: highlight.id, slide: position.slide + 1 });
        // End of this highlight: roll into the next circle, like the real app; the last one
        // returns to the profile so the loop is obviously finished.
        const after = highlights[hIndex + 1];
        onPosition(after && storyFrames(after).length ? { highlightId: after.id, slide: 0 } : PROFILE);
    };

    const prev = () => {
        if (!highlight) return;
        if (position.slide > 0) return onPosition({ highlightId: highlight.id, slide: position.slide - 1 });
        const before = highlights[hIndex - 1];
        const beforeFrames = before ? storyFrames(before) : [];
        onPosition(beforeFrames.length ? { highlightId: before.id, slide: beforeFrames.length - 1 } : PROFILE);
    };

    const onDown = (e: PointerEvent<HTMLDivElement>) => {
        downAt.current = Date.now();
        downX.current = e.nativeEvent.offsetX / e.currentTarget.clientWidth;
        setHolding(true);
    };
    const onUp = () => {
        setHolding(false);
        // A quick press is a tap; a longer one was a hold-to-pause and moves nothing.
        if (Date.now() - downAt.current < 250) (downX.current < 0.3 ? prev : next)();
    };

    const label = highlight
        ? `Instagram story: ${highlight.title || "Untitled"}, slide ${position.slide + 1} of ${frames.length}`
        : `Instagram profile for @${profile.handle} with the pinned highlights`;

    return (
        <IgScreen interactive label={label} className={cx("size-full max-w-none select-none", className)}>
            {!highlight || !slide ? (
                /* ── Profile view — the shared surface, with tappable circles ── */
                <IgProfileScreen
                    profile={{
                        ...profile,
                        highlights: highlights.map((h) => ({ label: h.title || "Untitled", src: coverOf(h) || undefined })),
                    }}
                    avatar={profile.avatar}
                    tab="grid"
                    onHighlight={(i) => {
                        const h = highlights[i];
                        if (h && storyFrames(h).length) onPosition({ highlightId: h.id, slide: 0 });
                    }}
                />
            ) : (
                <StoryView
                    highlight={highlight}
                    frames={frames}
                    slide={slide}
                    index={position.slide}
                    holding={holding}
                    reduced={!!reduced}
                    videoProgress={videoProgress}
                    onVideoProgress={setVideoProgress}
                    onNext={next}
                    onDown={onDown}
                    onUp={onUp}
                    onRelease={() => setHolding(false)}
                    onBack={() => onPosition(PROFILE)}
                    onReply={onReply ? () => onReply(highlight.id, slide.id) : undefined}
                    replyLabel={replyLabel}
                    count={commentCountFor?.(slide.id) ?? 0}
                />
            )}
        </IgScreen>
    );
};

/* ── The story surface itself, kept apart so the player above reads as its two states ── */

const StoryView = ({
    highlight,
    frames,
    slide,
    index,
    holding,
    reduced,
    videoProgress,
    onVideoProgress,
    onNext,
    onDown,
    onUp,
    onRelease,
    onBack,
    onReply,
    replyLabel,
    count,
}: {
    highlight: StoryHighlight;
    frames: StorySlide[];
    slide: StorySlide;
    index: number;
    holding: boolean;
    reduced: boolean;
    videoProgress: number;
    onVideoProgress: (p: number) => void;
    onNext: () => void;
    onDown: (e: PointerEvent<HTMLDivElement>) => void;
    onUp: () => void;
    onRelease: () => void;
    onBack: () => void;
    onReply?: () => void;
    replyLabel: string;
    count: number;
}) => {
    const cover = coverOf(highlight);
    const animate = slide.kind === "image" && !reduced;

    return (
        <div className="relative h-full overflow-hidden bg-(--ig-canvas)">
            {slide.kind === "video" ? (
                <video
                    key={slide.id}
                    src={slide.url}
                    muted
                    playsInline
                    autoPlay={!reduced}
                    // Holding pauses; so does reduced motion, which never autoplays.
                    ref={(el) => {
                        if (!el) return;
                        if (holding) el.pause();
                        else if (!reduced) el.play().catch(() => {});
                    }}
                    onTimeUpdate={(e) => {
                        const v = e.currentTarget;
                        if (v.duration) onVideoProgress(v.currentTime / v.duration);
                    }}
                    onEnded={onNext}
                    className="absolute inset-0 size-full object-cover"
                />
            ) : (
                <img key={slide.id} src={slide.url} alt="" className="absolute inset-0 size-full object-cover" draggable={false} />
            )}

            {/* Legibility scrims for the chrome, like the app's own. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[150px] bg-linear-to-b from-(--ig-canvas)/55 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[120px] bg-linear-to-t from-(--ig-canvas)/55 to-transparent" />

            <div className="relative">
                <IgStatusBar />
            </div>

            {/* Progress — same track geometry as IgStoryProgress, but the active segment animates. */}
            <div className="absolute inset-x-2 flex items-center gap-1" style={{ top: CHROME_TOP }}>
                {frames.map((s, i) => {
                    const state = i < index ? "done" : i === index ? "active" : "todo";
                    return (
                        <span key={s.id} className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-(--ig-text)/30">
                            {state === "done" && <span className="block size-full bg-(--ig-text)" />}
                            {state === "active" &&
                                (slide.kind === "video" ? (
                                    <span className="block h-full origin-left bg-(--ig-text)" style={{ transform: `scaleX(${videoProgress})` }} />
                                ) : (
                                    <span
                                        key={`${highlight.id}-${i}`}
                                        className="block h-full origin-left bg-(--ig-text)"
                                        style={
                                            animate
                                                ? {
                                                      animation: `story-progress ${IMAGE_SLIDE_SECONDS}s linear forwards`,
                                                      animationPlayState: holding ? "paused" : "running",
                                                  }
                                                : { transform: "scaleX(1)" }
                                        }
                                        onAnimationEnd={onNext}
                                    />
                                ))}
                        </span>
                    );
                })}
            </div>

            {/* Header */}
            <div className="absolute inset-x-3 flex items-center gap-2.5" style={{ top: CHROME_TOP + 12 }}>
                <button type="button" onClick={onBack} className="-ml-1 rounded-full p-1" aria-label="Back to profile">
                    <ChevronLeft className="size-[24px]" strokeWidth={2.2} aria-hidden="true" />
                </button>
                <span className="size-[34px] overflow-hidden rounded-full bg-(--ig-elevated) ring-1 ring-(--ig-text)/60">
                    {cover && <img src={cover} alt="" className="size-full object-cover" />}
                </span>
                <span className="text-[14px] font-semibold drop-shadow">{highlight.title || "Untitled"}</span>
                <span className="text-[13px] text-(--ig-text-secondary)">
                    {index + 1}/{frames.length}
                </span>
                {count > 0 && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-(--ig-text)/20 px-2 py-0.5 text-[12px] font-semibold backdrop-blur-sm">
                        <MessageChatCircle className="size-[13px]" aria-hidden="true" />
                        {count}
                    </span>
                )}
            </div>

            {/* Tap / hold surface — below the header and above the reply bar. */}
            <div
                className="absolute inset-x-0 cursor-pointer touch-none"
                style={{ top: CHROME_TOP + 60, bottom: 100 }}
                onPointerDown={onDown}
                onPointerUp={onUp}
                onPointerLeave={onRelease}
                onPointerCancel={onRelease}
                role="presentation"
            />

            {/* Reply bar → a note on this slide. Sits above the 34pt home-indicator area. */}
            {onReply && (
                <div className="absolute inset-x-3 bottom-[38px] flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onReply}
                        className="flex h-[44px] flex-1 items-center rounded-full border border-(--ig-text)/60 px-4 text-left text-[14px] text-(--ig-text)/90 backdrop-blur-sm transition duration-100 ease-linear hover:bg-(--ig-text)/10"
                    >
                        {replyLabel}
                    </button>
                </div>
            )}
        </div>
    );
};
