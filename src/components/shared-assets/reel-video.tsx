import { useEffect, useRef } from "react";
import { useInView, useReducedMotion } from "motion/react";

/**
 * A muted 9:16 client reel sized to fill a phone screen. Ported from
 * hiddengem-media's `(site)/mockup/reel-video.tsx`.
 *
 * PLAYBACK IS DRIVEN FROM AN EFFECT, NOT `autoPlay`. The attribute fires at
 * load, before any preference has been read, and setting or clearing it
 * afterwards neither starts nor stops a video — so honouring reduced motion
 * with it is not possible. The markup therefore never autoplays, and the effect
 * starts the loop only when motion is allowed. The loop also stays paused with
 * JS off, which is the correct failure direction.
 *
 * THE MP4S WERE NOT PORTED — only the poster JPEGs live in /public/mockup-ig,
 * so every `<video src>` here 404s and the poster carries the surface. That is
 * exactly what the source site ships too (its `.gitignore` blocks the MP4s), so
 * a still frame IS parity with the live reference, not a downgrade. Drop the
 * MP4s into /public/mockup-ig under the same names and the reels start moving.
 *
 * `preload="none"` so the browser fetches nothing until `play()` is called —
 * which the effect only does when motion is allowed AND the element is in view.
 *
 * WITHOUT A POSTER (the dashboard's uploaded Example Reels have none) the element
 * preloads metadata instead, so the browser paints the first frame: a paused or
 * reduced-motion reel then shows a still rather than a black screen.
 *
 * SOUND IS OPT-IN. `muted` defaults to true, and a caller unmutes only after the viewer
 * asks (the Example Reels sound button): browsers refuse an unmuted play() until the page
 * has had a click, so a reel that started with sound would just not start. If a browser
 * still refuses, it falls back to playing muted rather than freezing.
 */
export const ReelVideo = ({ src, poster, paused = false, muted = true }: { src: string; poster?: string; paused?: boolean; muted?: boolean }) => {
    const ref = useRef<HTMLVideoElement>(null);
    const prefersReducedMotion = useReducedMotion();
    // Not `once` — leaving the section should pause the loop, not just skip
    // starting it. The margin starts the fetch just before the phones arrive.
    const inView = useInView(ref, { margin: "200px" });

    useEffect(() => {
        const video = ref.current;
        if (!video) return;

        // Asserted as a property: the attribute only sets the starting state.
        video.muted = muted;

        if (prefersReducedMotion || !inView || paused) {
            video.pause();
        } else {
            // Rejects when the browser blocks playback. Blocked with sound → try muted;
            // blocked muted → the poster is the fallback.
            video.play().catch(() => {
                if (video.muted) return;
                video.muted = true;
                video.play().catch(() => {});
            });
        }
    }, [prefersReducedMotion, inView, paused, muted]);

    return (
        <video
            ref={ref}
            src={src}
            poster={poster}
            muted
            loop
            playsInline
            preload={poster ? "none" : "metadata"}
            // The reel is 9:16 and so is the screen, so `cover` crops nothing
            // worth keeping — it only absorbs the bezel's rounded corners.
            className="size-full object-cover"
        />
    );
};
