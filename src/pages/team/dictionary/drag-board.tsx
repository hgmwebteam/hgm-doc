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
 * caller changes in `onMove` and can refuse (a full box) with a message. A move to where the card
 * already is never reaches `onMove`: nothing changed, so nothing must be saved (on a screen
 * answered on another device, saving an untouched answer would mark its right answers wrong).
 * Every move, refusal and pick-up is announced in a polite live region.
 *
 * While a card is dragged, a copy of it follows the pointer in a fixed layer on top of the page
 * and the card itself fades where it was. The copy can't be clipped by a scrolling tray or carried
 * off by a sticky one, it ignores the pointer so the slot underneath can be found, and nothing
 * re-renders per move. The pane's own scroller scrolls when a drag heads for its edge.
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
    /** The card itself, faded while it's carried. */
    el: HTMLElement;
    /** The copy that follows the pointer, once the press has become a drag. */
    ghost: HTMLElement | null;
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

/** The copy of a card that a drag carries: same size and look, on a fixed layer, inert. */
const makeGhost = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const ghost = el.cloneNode(true) as HTMLElement;
    ghost.removeAttribute("data-chip");
    ghost.removeAttribute("id");
    ghost.setAttribute("aria-hidden", "true");
    ghost.setAttribute("data-dragging", "true");
    ghost.tabIndex = -1;
    Object.assign(ghost.style, {
        position: "fixed",
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: "0",
        boxSizing: "border-box",
        zIndex: "1000",
        pointerEvents: "none",
        transition: "none",
    });
    document.body.appendChild(ghost);
    return ghost;
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
    /** Where each card is, as of the last render: a target id, or null in the tray. */
    const atRef = useRef(new Map<string, string | null>());
    /** After a move, where focus goes once the card has re-rendered in its new place. */
    const pendingFocus = useRef<{ chipId: string; nextInTray: boolean; onlyIfLost: boolean } | null>(null);

    const move = useCallback((chipId: string, to: string | null, byKeyboard = false) => {
        const { chipLabel, onMove } = opts.current;
        // Nothing to do: say so, and don't tell the caller (it would save an unchanged answer).
        if (atRef.current.has(chipId) && atRef.current.get(chipId) === to) {
            setPicked(null);
            setMessage(`${chipLabel(chipId)} stays where it is.`);
            return true;
        }
        const root = rootRef.current;
        const hadFocus = !!root && root.contains(document.activeElement);
        const result = onMove(chipId, to);
        setMessage(result.message);
        if (result.ok) {
            setPicked(null);
            // The moved card remounts in its new container, and so may the button that was pressed
            // (an empty slot, a card that got swapped out). If focus was on the board, keep it there.
            // A number key moves on to the next card in the tray; anything else stays on the card.
            if (hadFocus) pendingFocus.current = { chipId, nextInTray: byKeyboard && to !== null, onlyIfLost: !byKeyboard };
        }
        return result.ok;
    }, []);

    useEffect(() => {
        const want = pendingFocus.current;
        if (!want) return;
        pendingFocus.current = null;
        const root = rootRef.current;
        if (!root) return;
        const active = document.activeElement;
        if (want.onlyIfLost && active && active !== document.body && root.contains(active)) return;
        const next = want.nextInTray ? root.querySelector<HTMLElement>(`[data-drop="${TRAY}"] [data-chip]:not([disabled])`) : null;
        (next ?? root.querySelector<HTMLElement>(`[data-chip="${CSS.escape(want.chipId)}"]`))?.focus({ preventScroll: false });
    });

    // Pointer dragging. The listeners live on window for the whole gesture: the copy ignores the
    // pointer, and the card may be anywhere by the time the pointer lifts.
    useEffect(() => {
        const scroller = () => opts.current.scrollRef?.current ?? null;

        const follow = (g: Gesture) => {
            if (g.ghost) g.ghost.style.transform = `translate(${g.x - g.startX}px, ${g.y - g.startY}px)`;
        };

        /** Follow the pointer and update the highlight; also after the page scrolls under a still pointer. */
        const track = (g: Gesture) => {
            follow(g);
            setOver(dropAt(g.x, g.y));
        };

        const stopScrolling = () => {
            if (raf.current !== null) cancelAnimationFrame(raf.current);
            raf.current = null;
        };

        // Scroll only toward an edge the drag is heading for: a drag that starts in a tray pinned to the
        // bottom of a phone, and heads up, mustn't scroll the page down just for starting near the edge.
        const edgeScroll = () => {
            raf.current = null;
            const g = gesture.current;
            const s = scroller();
            if (!g?.active || !s) return;
            const box = s.getBoundingClientRect();
            const up = g.y < g.startY - DRAG_START_PX && g.y < box.top + EDGE_PX;
            const down = g.y > g.startY + DRAG_START_PX && g.y > box.bottom - EDGE_PX;
            if (!up && !down) return;
            const before = s.scrollTop;
            // "instant": globals.css makes every scroller smooth, which would crawl at a fifth of the speed.
            s.scrollBy({ top: up ? -SCROLL_STEP_PX : SCROLL_STEP_PX, behavior: "instant" });
            if (s.scrollTop === before) return; // the end of the page
            track(g);
            raf.current = requestAnimationFrame(edgeScroll);
        };

        /**
         * End a drag. A card that found a new place lets its copy go at once; otherwise the copy slides
         * home, and the card stays faded until it lands, so there are never two of it.
         */
        const release = (g: Gesture, placed: boolean) => {
            stopScrolling();
            document.documentElement.style.cursor = "";
            const ghost = g.ghost;
            const land = () => {
                ghost?.remove();
                g.el.style.opacity = "";
            };
            if (!ghost || placed || prefersReducedMotion()) land();
            else {
                ghost.style.transition = "transform 150ms ease-out";
                ghost.style.transform = "translate(0px, 0px)";
                window.setTimeout(land, 160);
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
                g.ghost = makeGhost(g.el);
                g.el.style.opacity = "0.35";
                document.documentElement.style.cursor = "grabbing";
                setDragging(g.chipId);
                setPicked(null);
            }
            e.preventDefault();
            track(g);
            if (raf.current === null) raf.current = requestAnimationFrame(edgeScroll);
        };

        const onPointerUp = (e: PointerEvent) => {
            const g = gesture.current;
            if (!g || e.pointerId !== g.pointerId) return;
            gesture.current = null;
            if (!g.active) return; // a tap: the card's click handler picks it up
            // The click a drag ends with lands on whatever the pointer was over; ignore it.
            suppressClick.current = true;
            window.setTimeout(() => (suppressClick.current = false), 0);
            const target = dropAt(e.clientX, e.clientY);
            if (target === undefined) {
                setMessage(`${opts.current.chipLabel(g.chipId)} went back where it was.`);
                release(g, false);
                return;
            }
            const stayed = atRef.current.get(g.chipId) === target;
            const ok = move(g.chipId, target);
            release(g, ok && !stayed);
        };

        const onPointerCancel = (e: PointerEvent) => {
            const g = gesture.current;
            if (!g || e.pointerId !== g.pointerId) return;
            gesture.current = null;
            if (g.active) release(g, false);
        };

        window.addEventListener("pointermove", onPointerMove, { passive: false });
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerCancel);
        return () => {
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            window.removeEventListener("pointercancel", onPointerCancel);
            stopScrolling();
            // Leaving mid-drag (the round changed, the page went away): take the copy with us.
            const g = gesture.current;
            if (g?.ghost) g.ghost.remove();
            if (g) g.el.style.opacity = "";
            document.documentElement.style.cursor = "";
            gesture.current = null;
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

    /**
     * Tap or Enter on a card: pick it up, put it down, or drop the picked card onto this card's slot.
     * A card in the same place as the picked one (the tray, or the same box) is picked up instead.
     */
    const activateChip = (chipId: string, at: string | null) => {
        if (suppressClick.current || opts.current.disabled) return;
        const { chipLabel, targets, noun } = opts.current;
        if (picked && picked !== chipId && at !== null && atRef.current.get(picked) !== at) {
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

    /** Tap or Enter on a slot or box. (Not the click a drag ends with.) */
    const placeInto = (targetId: string) => {
        if (suppressClick.current || opts.current.disabled) return;
        if (picked) move(picked, targetId);
        else setMessage(`Pick a card up first, then choose the ${opts.current.noun}.`);
    };

    /** Tap on the tray while carrying a card from a slot. */
    const backToTray = () => {
        if (!suppressClick.current && !opts.current.disabled && picked) move(picked, null);
    };

    const carried = picked ?? dragging;
    const carriedFrom = carried !== null ? (atRef.current.get(carried) ?? null) : undefined;

    return {
        picked,
        dragging,
        /** A card is picked up or being dragged: every slot and box shows it can take it. */
        carrying: carried !== null,
        /** Where the carried card came from: a target id, null for the tray, undefined when nothing is carried. */
        carriedFrom,
        /**
         * The target under a dragged card: an id, `null` for the tray, `undefined` for none. The place
         * the card came from doesn't count: dropping it there changes nothing, so it mustn't light up.
         */
        over: over === carriedFrom ? undefined : over,
        message,
        placeInto,
        backToTray,
        rootProps: { ref: rootRef, onKeyDown },
        /** Spread on a card's <button>. `at` is where it is now: a target id, or null in the tray. */
        chipProps: (chipId: string, at: string | null) => {
            atRef.current.set(chipId, at);
            return {
                type: "button" as const,
                "data-chip": chipId,
                "aria-pressed": picked === chipId,
                disabled: options.disabled,
                onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
                    if (opts.current.disabled || e.button !== 0 || !e.isPrimary) return;
                    gesture.current = { chipId, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, el: e.currentTarget, ghost: null, active: false };
                },
                onClick: (e: { stopPropagation: () => void }) => {
                    e.stopPropagation();
                    activateChip(chipId, at);
                },
            };
        },
        /** Spread on a slot's or box's container (or the tray, with null), so a drag can find it. */
        dropProps: (targetId: string | null) => ({ "data-drop": targetId ?? TRAY }),
    };
};

export type DragBoard = ReturnType<typeof useDragBoard>;

/* ── Shared look ────────────────────────────────────────────────── */

/**
 * A card. Its text is at least 16px (the phone rule), it never scrolls the page when a finger
 * starts on it (touch-action: none, so a drag can begin; a tray that scrolls sideways can loosen
 * that to touch-pan-x), and a picked-up card shows a brand ring and a raised shadow: the state is
 * in the shape, not only the colour.
 */
export const chipClass = ({ picked, fill = false, large = false }: { picked: boolean; fill?: boolean; large?: boolean }) =>
    cx(
        "relative inline-flex min-h-11 cursor-grab touch-none items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-left font-medium text-pretty text-primary shadow-xs ring-1 ring-primary outline-focus-ring transition-shadow duration-100 ease-linear select-none ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default data-[dragging=true]:cursor-grabbing data-[dragging=true]:shadow-xl motion-reduce:transition-none",
        large ? "text-xl" : "text-md",
        fill && "w-full",
        picked && "shadow-lg ring-2 ring-brand",
    );

/**
 * A slot's or box's look while a card is carried: a dashed brand outline on every place it can go,
 * and, under a dragged card, a solid brand ring and a brand fill. The fill is the utility brand tint,
 * which stays blue in dark mode (brand-primary_alt turns into the same grey as a box there). The
 * outline's dashes and the ring's weight carry the state, not the colour alone.
 */
export const targetClass = ({ carrying, over }: { carrying: boolean; over: boolean }) =>
    cx(
        "transition duration-100 ease-linear motion-reduce:transition-none",
        carrying && "outline-2 outline-offset-2 outline-brand outline-dashed",
        over && "bg-utility-brand-50 ring-2 ring-brand ring-inset",
    );

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
