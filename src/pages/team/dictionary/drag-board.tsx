import { type KeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cx } from "@/utils/cx";

/**
 * Drag and drop for cards, slots and boxes, shared by the check's matching and sorting questions
 * and by Sort the stack. A card moves three equivalent ways:
 *
 *   - drag it, with a mouse, a finger or a pen (pointer events, so it works on phones);
 *   - tap or click it, then tap the slot or box: the dependable way on a phone;
 *   - from the keyboard: Tab to it, Enter to pick it up, a number key for the slot or box,
 *     Backspace (or Delete) to send it back, Escape to put it down.
 *
 * The hook owns only the gesture. Where every card is lives in the caller's state, which the
 * caller changes in `onMove` and can refuse (a full box) with a message. Every move, refusal
 * and pick-up is announced in a polite live region, so a screen reader hears what happened.
 *
 * While a card is dragged it follows the pointer by transform, so nothing re-renders per move,
 * and it ignores the pointer (pointer-events: none) so the slot underneath it can be found.
 * The pane's own scroller scrolls when the pointer nears its edge, as on a long phone page.
 */

/** The drop id of the tray: the cards' starting place, where a card goes back to. */
export const TRAY = "__tray__";

export type BoardTarget = { id: string; label: string };
export type MoveResult = { ok: boolean; message: string };

type Options = {
    /** Every slot or box, in order. A number key places into that position (1 is the first). */
    targets: BoardTarget[];
    chipLabel: (chipId: string) => string;
    /** Move a card to a slot or box, or back to the tray (`to` null). Refuse with `ok: false`. */
    onMove: (chipId: string, to: string | null) => MoveResult;
    /** "slot" or "box": what the announcements call a target. */
    noun: string;
    /** After checking, nothing moves. */
    disabled?: boolean;
    /** The scroll container to scroll when a drag nears its edge. */
    scrollRef?: RefObject<HTMLElement | null>;
};

type Gesture = {
    chipId: string;
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
    startScroll: number;
    el: HTMLElement;
    active: boolean;
};

/** Movement before a press becomes a drag; anything less is a tap. */
const DRAG_START_PX = 6;
/** How close to the scroller's edge a drag has to come before it scrolls, and how fast. */
const EDGE_PX = 56;
const SCROLL_STEP_PX = 12;

const prefersReducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** The drop target under a point: an id, `null` for the tray, or `undefined` for nothing. */
const dropAt = (x: number, y: number): string | null | undefined => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const id = el?.closest<HTMLElement>("[data-drop]")?.dataset.drop;
    if (id === undefined) return undefined;
    return id === TRAY ? null : id;
};

export const useDragBoard = (options: Options) => {
    const opts = useRef(options);
    useLayoutEffect(() => {
        opts.current = options;
    });

    const [picked, setPicked] = useState<string | null>(null);
    const [over, setOver] = useState<string | null | undefined>(undefined);
    const [dragging, setDragging] = useState<string | null>(null);
    const [message, setMessage] = useState("");

    const rootRef = useRef<HTMLDivElement>(null);
    const gesture = useRef<Gesture | null>(null);
    const suppressClick = useRef(false);
    const raf = useRef<number | null>(null);
    /** After a keyboard move, where focus goes once the card has re-rendered in its new place. */
    const pendingFocus = useRef<{ chipId: string; nextInTray: boolean } | null>(null);

    const move = useCallback((chipId: string, to: string | null, byKeyboard = false) => {
        const result = opts.current.onMove(chipId, to);
        setMessage(result.message);
        if (result.ok) {
            setPicked(null);
            // Into a slot: on to the next card waiting in the tray. Back to the tray: stay on it.
            if (byKeyboard) pendingFocus.current = { chipId, nextInTray: to !== null };
        }
        return result.ok;
    }, []);

    // Keyboard moves remount the card in its new container, which drops focus; put it back.
    useEffect(() => {
        const want = pendingFocus.current;
        if (!want) return;
        pendingFocus.current = null;
        const root = rootRef.current;
        if (!root) return;
        const next = want.nextInTray ? root.querySelector<HTMLElement>(`[data-drop="${TRAY}"] [data-chip]:not([disabled])`) : null;
        (next ?? root.querySelector<HTMLElement>(`[data-chip="${CSS.escape(want.chipId)}"]`))?.focus({ preventScroll: false });
    });

    // Pointer dragging. The listeners live on window for the whole gesture: once the card ignores
    // the pointer, its own element no longer receives the events.
    useEffect(() => {
        const scroller = () => opts.current.scrollRef?.current ?? null;

        const follow = (g: Gesture) => {
            const s = scroller();
            const scrolled = s ? s.scrollTop - g.startScroll : 0;
            g.el.style.transform = `translate(${g.x - g.startX}px, ${g.y - g.startY + scrolled}px)`;
        };

        const stopScrolling = () => {
            if (raf.current !== null) cancelAnimationFrame(raf.current);
            raf.current = null;
        };

        const edgeScroll = () => {
            raf.current = null;
            const g = gesture.current;
            const s = scroller();
            if (!g?.active || !s) return;
            const box = s.getBoundingClientRect();
            const step = g.y < box.top + EDGE_PX ? -SCROLL_STEP_PX : g.y > box.bottom - EDGE_PX ? SCROLL_STEP_PX : 0;
            if (!step) return;
            s.scrollTop += step;
            follow(g);
            raf.current = requestAnimationFrame(edgeScroll);
        };

        const release = (g: Gesture) => {
            stopScrolling();
            const el = g.el;
            el.style.pointerEvents = "";
            el.style.zIndex = "";
            el.removeAttribute("data-dragging");
            if (prefersReducedMotion()) el.style.transform = "";
            else {
                el.style.transition = "transform 150ms ease-out";
                el.style.transform = "";
                window.setTimeout(() => (el.style.transition = ""), 160);
            }
            setDragging(null);
            setOver(undefined);
        };

        const onPointerMove = (e: PointerEvent) => {
            const g = gesture.current;
            if (!g || e.pointerId !== g.pointerId) return;
            g.x = e.clientX;
            g.y = e.clientY;
            if (!g.active) {
                if (Math.hypot(g.x - g.startX, g.y - g.startY) < DRAG_START_PX) return;
                g.active = true;
                g.el.style.transition = "none";
                g.el.style.pointerEvents = "none";
                g.el.style.zIndex = "50";
                g.el.setAttribute("data-dragging", "true");
                setDragging(g.chipId);
                setPicked(null);
            }
            e.preventDefault();
            follow(g);
            const target = dropAt(g.x, g.y);
            setOver((current) => (current === target ? current : target));
            if (raf.current === null) raf.current = requestAnimationFrame(edgeScroll);
        };

        const onPointerUp = (e: PointerEvent) => {
            const g = gesture.current;
            if (!g || e.pointerId !== g.pointerId) return;
            gesture.current = null;
            if (!g.active) return; // a tap: the card's click handler picks it up
            suppressClick.current = true;
            window.setTimeout(() => (suppressClick.current = false), 0);
            const target = dropAt(e.clientX, e.clientY);
            release(g);
            if (target === undefined) setMessage(`${opts.current.chipLabel(g.chipId)} went back where it was.`);
            else move(g.chipId, target);
        };

        const onPointerCancel = (e: PointerEvent) => {
            const g = gesture.current;
            if (!g || e.pointerId !== g.pointerId) return;
            gesture.current = null;
            if (g.active) release(g);
        };

        window.addEventListener("pointermove", onPointerMove, { passive: false });
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerCancel);
        return () => {
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            window.removeEventListener("pointercancel", onPointerCancel);
            stopScrolling();
        };
    }, [move]);

    // A round that becomes checked (or reset) drops whatever was picked up.
    useEffect(() => {
        if (options.disabled) setPicked(null);
    }, [options.disabled]);

    const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
        if (opts.current.disabled) return;
        const focused = (e.target as HTMLElement).closest?.("[data-chip]")?.getAttribute("data-chip") ?? null;
        if (/^[1-9]$/.test(e.key) && picked) {
            const target = opts.current.targets[Number(e.key) - 1];
            if (!target) return;
            e.preventDefault();
            move(picked, target.id, true);
            return;
        }
        if (e.key === "Backspace" || e.key === "Delete") {
            const id = picked ?? focused;
            if (!id) return;
            e.preventDefault();
            move(id, null, true);
            return;
        }
        if (e.key === "Escape" && picked) {
            e.preventDefault();
            setMessage(`${opts.current.chipLabel(picked)} put down.`);
            setPicked(null);
        }
    };

    /** Tap or Enter on a card: pick it up, put it down, or drop the picked card onto this card's slot. */
    const activateChip = (chipId: string, at: string | null) => {
        if (suppressClick.current || opts.current.disabled) return;
        const { chipLabel, targets, noun } = opts.current;
        if (picked && picked !== chipId && at !== null) {
            move(picked, at);
            return;
        }
        if (picked === chipId) {
            setPicked(null);
            setMessage(`${chipLabel(chipId)} put down.`);
            return;
        }
        setPicked(chipId);
        const keys = targets.length > 1 ? `Press 1 to ${targets.length}` : "Press 1";
        setMessage(`${chipLabel(chipId)} picked up. ${keys} for the ${noun}, or tap one.${at !== null ? " Backspace sends it back." : ""}`);
    };

    /** Tap or Enter on a slot or box. */
    const placeInto = (targetId: string) => {
        if (opts.current.disabled) return;
        if (picked) move(picked, targetId);
        else setMessage(`Pick a card up first, then choose the ${opts.current.noun}.`);
    };

    /** Tap on the tray while carrying a card from a slot. */
    const backToTray = () => {
        if (!opts.current.disabled && picked) move(picked, null);
    };

    return {
        picked,
        dragging,
        /** The target under a dragged card: an id, `null` for the tray, `undefined` for none. */
        over,
        message,
        placeInto,
        backToTray,
        rootProps: { ref: rootRef, onKeyDown },
        /** Spread on a card's <button>. `at` is where it is now: a target id, or null in the tray. */
        chipProps: (chipId: string, at: string | null) => ({
            type: "button" as const,
            "data-chip": chipId,
            "aria-pressed": picked === chipId,
            disabled: options.disabled,
            onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
                if (opts.current.disabled || e.button !== 0 || !e.isPrimary) return;
                gesture.current = {
                    chipId,
                    pointerId: e.pointerId,
                    startX: e.clientX,
                    startY: e.clientY,
                    x: e.clientX,
                    y: e.clientY,
                    startScroll: opts.current.scrollRef?.current?.scrollTop ?? 0,
                    el: e.currentTarget,
                    active: false,
                };
            },
            onClick: (e: { stopPropagation: () => void }) => {
                e.stopPropagation();
                activateChip(chipId, at);
            },
        }),
        /** Spread on a slot's or box's container (or the tray, with null), so a drag can find it. */
        dropProps: (targetId: string | null) => ({ "data-drop": targetId ?? TRAY }),
    };
};

export type DragBoard = ReturnType<typeof useDragBoard>;

/* ── Shared look ────────────────────────────────────────────────── */

/**
 * A card. Its text is at least 16px (the phone rule), it never scrolls the page when a finger
 * starts on it (touch-action: none, so a drag can begin), and a picked-up card shows a brand
 * ring and a raised shadow: the state is in the shape, not only the colour.
 */
export const chipClass = ({ picked, fill = false, large = false }: { picked: boolean; fill?: boolean; large?: boolean }) =>
    cx(
        "relative inline-flex min-h-11 cursor-grab touch-none items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-left font-medium text-pretty text-primary shadow-xs ring-1 ring-primary outline-focus-ring transition-shadow duration-100 ease-linear select-none ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default data-[dragging=true]:cursor-grabbing data-[dragging=true]:shadow-xl motion-reduce:transition-none",
        large ? "text-xl" : "text-md",
        fill && "w-full",
        picked && "shadow-lg ring-2 ring-brand",
    );

/** A slot's or box's look while a card is being carried: a brand ring, plus a brand fill under a dragged card. */
export const targetClass = ({ carrying, over }: { carrying: boolean; over: boolean }) =>
    cx("transition duration-100 ease-linear motion-reduce:transition-none", carrying && "ring-2 ring-brand ring-inset", over && "bg-brand-primary_alt");

/** The small number by each slot or box: the key that places a picked-up card there. */
export const KeyBadge = ({ n, className }: { n: number; className?: string }) => (
    <span
        aria-hidden="true"
        className={cx(
            "flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary font-mono text-xs font-semibold text-tertiary tabular-nums ring-1 ring-secondary",
            className,
        )}
    >
        {n}
    </span>
);

/** What every board announces. Render it once per board. */
export const BoardAnnouncer = ({ message }: { message: string }) => (
    <p role="status" aria-live="polite" className="sr-only">
        {message}
    </p>
);
