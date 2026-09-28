import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, Copy01, XClose } from "@untitledui/icons";
import { AnimatePresence, type Transition, motion, useReducedMotion } from "motion/react";
import type { BadgeColors } from "@/components/base/badges/badge-types";
import { Badge, BadgeWithDot } from "@/components/base/badges/badges";
import { useClipboard } from "@/hooks/use-clipboard";
import { cx } from "@/utils/cx";
import { teamPhotoByName } from "@/utils/team-photos";
import type { ClientState, Hosting, StateTone } from "./directory-model";

/* Small pieces the directory's screens share. They follow the dashboard's own modals
   (AddCardModal) so the directory reads as part of the same page. */

/** The house text-input classes, as the dashboard's modals use them. */
export const inputClass =
    "w-full rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary transition duration-100 ease-linear outline-none placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand";

export const invalidInputClass = "border-error focus:border-error focus:ring-error";

/* ── Motion ────────────────────────────────────────────────────────
   The standalone page moved on one easing family and two durations, so a tab, a card and a
   menu all settle the same way; these are those curves, for every motion prop in the folder.
   MotionConfig at the directory's root honours the OS reduced-motion setting for all of it. */

export const EASE_SOFT: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
export const SOFT: Transition = { duration: 0.38, ease: EASE_SOFT };
export const FAST: Transition = { duration: 0.2, ease: EASE_SOFT };

/** A block arriving or leaving: a short rise that settles, a quick fall away. Spread onto a motion element. */
export const settleProps = {
    initial: { opacity: 0, y: 10, scale: 0.995 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 4, scale: 0.985, transition: FAST },
    transition: SOFT,
};

/** A panel that opens downward and folds shut. The element needs `overflow-hidden`. */
export const foldProps = {
    initial: { height: 0, opacity: 0 },
    animate: { height: "auto", opacity: 1 },
    exit: { height: 0, opacity: 0 },
    transition: { duration: 0.3, ease: EASE_SOFT },
};

/** A menu appearing under its button, growing from `origin`. */
export const popProps = (origin: string) => ({
    initial: { opacity: 0, y: -8, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -8, scale: 0.97, transition: { duration: 0.18, ease: EASE_SOFT } },
    transition: { duration: 0.26, ease: EASE_SOFT },
    style: { transformOrigin: origin },
});

/** The nth row of an arriving block: fades up, each a beat after the last. */
export const rowProps = (index: number, base = 0.06) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.36, ease: EASE_SOFT, delay: base + index * 0.05 },
});

export const Field = ({
    label,
    optional,
    hint,
    error,
    children,
    className,
}: {
    label: ReactNode;
    optional?: boolean;
    hint?: ReactNode;
    error?: string;
    children: ReactNode;
    className?: string;
}) => (
    <div className={className}>
        <span className="mb-1.5 block text-sm font-medium text-secondary">
            {label}
            {optional && <span className="font-normal text-quaternary"> (optional)</span>}
        </span>
        {children}
        {error ? (
            <p className="mt-1.5 text-xs text-error-primary" role="alert">
                {error}
            </p>
        ) : hint ? (
            <p className="mt-1.5 text-xs text-tertiary">{hint}</p>
        ) : null}
    </div>
);

/** Uppercase kicker above a heading. */
export const Eyebrow = ({ children, className }: { children: ReactNode; className?: string }) => (
    <span className={cx("block text-[11px] font-semibold tracking-widest text-quaternary uppercase", className)}>{children}</span>
);

/**
 * The directory's dialog: a dimmed backdrop and a card, animated like the dashboard's own
 * modals. Escape and a click on the backdrop close it. Rendered inside AnimatePresence by the
 * caller so the exit animation plays.
 */
export const DirectoryModal = ({
    title,
    subtitle,
    hideTitle = false,
    onClose,
    children,
    footer,
    width = "max-w-xl",
}: {
    title: string;
    /** Keep `title` as the dialog's accessible name only; the close button floats in the corner. */
    hideTitle?: boolean;
    subtitle?: ReactNode;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    width?: string;
}) => {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={cx("relative flex max-h-full w-full flex-col overflow-hidden rounded-2xl bg-primary shadow-2xl ring-1 ring-secondary", width)}
                initial={{ opacity: 0, scale: 0.94, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
            >
                <div className={cx("flex items-start justify-between gap-4 px-6 pt-6", hideTitle && "absolute top-5 right-5 z-10 p-0")}>
                    {!hideTitle && (
                        <div className="min-w-0">
                            <h3 className="text-md font-semibold text-primary">{title}</h3>
                            {subtitle && <p className="mt-1 text-sm text-tertiary">{subtitle}</p>}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-tertiary transition duration-100 ease-linear hover:bg-secondary"
                    >
                        <XClose className="size-4" />
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
                {footer && <div className="flex items-center justify-between gap-3 border-t border-secondary px-6 py-4">{footer}</div>}
            </motion.div>
        </motion.div>
    );
};

/** A row of tabs on a grey track; the white pill slides to whichever is selected. */
export const Segmented = <T extends string>({
    value,
    onChange,
    options,
    ariaLabel,
    className,
    size = "sm",
    fullWidth = false,
}: {
    value: T;
    onChange: (v: T) => void;
    options: { id: T; label: ReactNode }[];
    ariaLabel: string;
    className?: string;
    /** `md` is the toolbar height (40px), level with a md Button and the search field. */
    size?: "sm" | "md";
    /** Tabs share the width equally. */
    fullWidth?: boolean;
}) => {
    const id = useId();
    return (
        <div
            role="tablist"
            aria-label={ariaLabel}
            className={cx(
                "shrink-0 items-center rounded-lg border border-secondary bg-secondary p-0.5",
                fullWidth ? "flex w-full" : "inline-flex",
                size === "md" && "h-10",
                className,
            )}
        >
            {options.map((o) => {
                const active = o.id === value;
                return (
                    <button
                        key={o.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(o.id)}
                        className={cx(
                            "relative rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors duration-100 ease-linear",
                            size === "md" ? "inline-flex h-full items-center justify-center" : "py-1.5",
                            fullWidth && "flex-1",
                            active ? "text-primary" : "text-tertiary hover:text-secondary",
                        )}
                    >
                        {active && (
                            <motion.span
                                layoutId={`${id}-pill`}
                                className="absolute inset-0 rounded-md bg-primary shadow-xs"
                                transition={{ type: "spring", stiffness: 520, damping: 42 }}
                                aria-hidden="true"
                            />
                        )}
                        <span className="relative">{o.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

/** Pill-shaped radio buttons for a short list of choices. */
export const PillRadio = <T extends string>({
    value,
    onChange,
    options,
    ariaLabel,
}: {
    value: T;
    onChange: (v: T) => void;
    options: { id: T; label: ReactNode }[];
    ariaLabel: string;
}) => (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-2">
        {options.map((o) => (
            <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={o.id === value}
                onClick={() => onChange(o.id)}
                className={cx(
                    "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition duration-100 ease-linear",
                    o.id === value ? "border-brand bg-brand-primary_alt text-brand-secondary" : "border-secondary bg-primary text-secondary hover:bg-secondary",
                )}
            >
                {o.label}
            </button>
        ))}
    </div>
);

export const HostingBadge = ({ platform, size = "sm" }: { platform: Hosting; size?: "sm" | "md" }) => (
    <BadgeWithDot type="pill-color" size={size} color={platform === "Netlify" ? "sky" : "warning"}>
        {platform === "Netlify" ? "Netlify" : "GoHighLevel"}
    </BadgeWithDot>
);

const TONE_COLOR: Record<StateTone, BadgeColors> = { live: "success", warn: "warning", soon: "purple", off: "gray", tags: "blue" };

/** A status pill. A page that is live carries a pulsing dot, as the original did. */
export const StateBadge = ({ state, size = "sm" }: { state: ClientState; size?: "sm" | "md" }) => {
    const pulse = state.tone === "live" || state.tone === "warn";
    return (
        <span title={state.detail} className="inline-flex">
            <Badge type="pill-color" size={size} color={TONE_COLOR[state.tone]}>
                <span className="inline-flex items-center gap-1.5">
                    <span className="relative flex size-1.5" aria-hidden="true">
                        {pulse && (
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60 [animation-duration:2.4s] motion-reduce:hidden" />
                        )}
                        <span className="relative inline-flex size-1.5 rounded-full bg-current" />
                    </span>
                    {state.label}
                </span>
            </Badge>
        </span>
    );
};

/** Whether the page is live: a pulsing green dot, or a still grey one when it's offline. The word
 *  is for screen readers and the tooltip. */
export const LiveDot = ({ live, title }: { live: boolean; title?: string }) => (
    <span title={title ?? (live ? "Live" : "Offline")} className="relative flex size-2 shrink-0">
        {live && (
            <span
                className="absolute inline-flex size-full animate-ping rounded-full bg-fg-success-secondary opacity-60 [animation-duration:2.4s] motion-reduce:hidden"
                aria-hidden="true"
            />
        )}
        <span className={cx("relative inline-flex size-2 rounded-full", live ? "bg-fg-success-secondary" : "bg-fg-quaternary")} aria-hidden="true" />
        <span className="sr-only">{live ? "Live" : "Offline"}</span>
    </span>
);

/** The Meta mark: in colour once the client's meta tags are in, greyed and dimmed while they're pending. */
export const MetaMark = ({ added }: { added: boolean }) => {
    const label = added ? "Meta tags added" : "Meta tags pending";
    return (
        <img
            src="/brand-logos/meta.webp"
            alt={label}
            title={label}
            width={18}
            height={18}
            className={cx("size-[18px] shrink-0 object-contain transition duration-100 ease-linear", !added && "opacity-40 grayscale")}
        />
    );
};

/** A one-letter avatar for a person. */
export const Initial = ({ name, size = "sm", muted = false }: { name: string; size?: "sm" | "md"; muted?: boolean }) => {
    // A team member's headshot when the portal has one; otherwise their initial.
    const photo = teamPhotoByName(name);
    if (photo)
        return (
            <img
                src={photo}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className={cx("shrink-0 rounded-full object-cover ring-1 ring-secondary", size === "sm" ? "size-5" : "size-7")}
            />
        );
    return (
        <span
            aria-hidden="true"
            className={cx(
                "inline-flex shrink-0 items-center justify-center rounded-md font-bold",
                muted ? "bg-secondary text-secondary" : "bg-brand-primary text-brand-secondary",
                size === "sm" ? "size-5 text-[10px]" : "size-7 text-xs",
            )}
        >
            {name.trim().slice(0, 1).toUpperCase() || "?"}
        </span>
    );
};

/** Copies `text`; shows a tick for a moment after. Presses sink slightly, so it reads as a button. */
export const CopyButton = ({
    text,
    label = "Copy",
    copiedLabel = "Copied",
    title,
    pop,
    onCopiedChange,
    className,
}: {
    text: string;
    label?: string;
    copiedLabel?: string;
    /** Told when the copied state starts and ends, so what was copied can light up with it. */
    onCopiedChange?: (copied: boolean) => void;
    /** Tooltip: what a click does. */
    title?: string;
    /** Take part in the directory's entrance (see popIn). */
    pop?: boolean;
    className?: string;
}) => {
    const { copied, copy } = useClipboard();
    useEffect(() => onCopiedChange?.(!!copied), [copied, onCopiedChange]);
    return (
        <button
            type="button"
            title={title}
            data-pop={pop || undefined}
            onClick={() => void copy(text)}
            className={cx(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap shadow-xs transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97]",
                copied
                    ? "border-brand bg-brand-primary_alt text-brand-secondary"
                    : "border-secondary bg-primary text-secondary hover:border-primary hover:bg-secondary hover:text-primary",
                className,
            )}
        >
            {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy01 className="size-3.5" aria-hidden="true" />}
            {copied ? copiedLabel : label}
        </button>
    );
};

/**
 * A destructive action that asks once: the first press arms it (and the label says what it will
 * do), the second within four seconds does it. The published page can't show a confirm box, and
 * this is quicker than one anyway.
 */
export const ConfirmButton = ({ label, armedLabel, onConfirm, disabled }: { label: string; armedLabel: string; onConfirm: () => void; disabled?: boolean }) => {
    const [armed, setArmed] = useState(false);
    useEffect(() => {
        if (!armed) return;
        const t = window.setTimeout(() => setArmed(false), 4000);
        return () => window.clearTimeout(t);
    }, [armed]);
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => {
                if (armed) {
                    setArmed(false);
                    onConfirm();
                } else setArmed(true);
            }}
            className={cx(
                "text-sm font-semibold transition duration-100 ease-linear disabled:cursor-not-allowed disabled:opacity-50",
                armed ? "rounded-lg bg-error-solid px-3 py-2 text-white hover:bg-error-solid_hover" : "text-error-primary hover:underline",
            )}
        >
            {armed ? armedLabel : label}
        </button>
    );
};

/* ── Entrance ──────────────────────────────────────────────────────
   Opening the directory: each block marked `data-pop` rises and pops into place a beat after the
   one before it, in page order. It's the Web Animations API rather than motion, so it runs off the
   main thread while the page is still busy mounting, and `fill: backwards` keeps every block
   hidden until its turn — no flash of the finished page first. Reduced motion gets a plain fade. */

export function popIn(root: Element | null | undefined, { start = 0, stagger = 40, cap = 12 } = {}) {
    if (!root) return;
    const blocks = Array.from(root.querySelectorAll<HTMLElement>("[data-pop]"));
    if (!blocks.length || typeof blocks[0].animate !== "function") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    blocks.forEach((el, i) => {
        if (reduce) {
            el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease-out", fill: "backwards" });
            return;
        }
        const delay = start + Math.min(i, cap) * stagger;
        // Opacity and blur settle on a plain ease-out; the rise gets the slight overshoot that reads as a pop.
        el.animate(
            [
                { opacity: 0, filter: "blur(3px)" },
                { opacity: 1, filter: "blur(0px)" },
            ],
            {
                duration: 340,
                delay,
                easing: "cubic-bezier(0.23, 1, 0.32, 1)",
                fill: "backwards",
            },
        );
        el.animate([{ transform: "translateY(14px) scale(0.96)" }, { transform: "none" }], {
            duration: 560,
            delay,
            easing: "cubic-bezier(0.34, 1.4, 0.64, 1)",
            fill: "backwards",
        });
    });
}

/** Plays popIn over its children once, when it mounts with `play` set. */
export const PopScope = ({ play, onPlayed, className, children }: { play: boolean; onPlayed?: () => void; className?: string; children: ReactNode }) => {
    const ref = useRef<HTMLDivElement>(null);
    const playOnMount = useRef(play);
    useLayoutEffect(() => {
        if (!playOnMount.current) return;
        popIn(ref.current);
        onPlayed?.();
        // Mount only: later renders must not replay the entrance.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div ref={ref} className={className}>
            {children}
        </div>
    );
};

/* ── Edit frame ────────────────────────────────────────────────────
   Edit mode frames the whole directory in yellow so a change is never made without knowing edits
   are live. Switching it on plays once: light washes in from every edge and ebbs, the frame settles
   onto the edge, and its dashes fade in last. Nothing travels around the border; the whole panel
   reacts at once. Once, not on a loop, since you work inside the frame for minutes at a time. */

/** The theme's yellow-500 (identical in light and dark) at `alpha` percent. */
const yellow = (alpha: number) => `color-mix(in oklab, var(--color-utility-yellow-500) ${alpha}%, transparent)`;

/** Edit mode's frame, drawn above everything; clicks pass straight through. */
export const EditFrame = ({ on }: { on: boolean }) => {
    const reduce = useReducedMotion();
    return (
        <>
            {/* The wash: a deep inner glow that floods in from the edges, then ebbs to nothing. Only on
                the switch — a page that loads already editing (initial={false}) doesn't flash. */}
            <AnimatePresence initial={false}>
                {on && !reduce && (
                    <motion.span
                        key="wash"
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 z-20 rounded-lg"
                        style={{ boxShadow: `inset 0 0 160px ${yellow(22)}, inset 0 0 48px ${yellow(26)}` }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 1, 0], transition: { duration: 1.2, times: [0, 0.3, 1], ease: EASE_SOFT } }}
                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    />
                )}
            </AnimatePresence>
            <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-20 rounded-lg"
                style={{ boxShadow: `inset 0 0 6px ${yellow(14)}` }}
                initial={false}
                // Settles inward onto the edge, as if the panel were being picked up for editing.
                animate={on ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.006 }}
                transition={on ? { duration: 0.5, ease: EASE_SOFT } : { duration: 0.2, ease: "easeOut" }}
            >
                {/* An SVG outline rather than a dotted border, so the dash spacing is ours, not the browser's. */}
                <motion.svg
                    className="absolute inset-0 size-full overflow-visible"
                    initial={false}
                    animate={{ opacity: on ? 1 : 0 }}
                    transition={on ? { duration: 0.4, delay: 0.3, ease: EASE_SOFT } : { duration: 0.15 }}
                >
                    <rect
                        x="1"
                        y="1"
                        rx="7"
                        style={{ width: "calc(100% - 2px)", height: "calc(100% - 2px)" }}
                        fill="none"
                        stroke={yellow(80)}
                        strokeWidth="2"
                        strokeDasharray="10 8"
                        strokeLinecap="round"
                    />
                </motion.svg>
            </motion.span>
        </>
    );
};
