import { Fragment, type ReactNode, type PointerEvent as ReactPointerEvent, type RefObject, useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowRight, Check, DotsGrid, Eye, Moon01, RefreshCw01, Sun, XClose } from "@untitledui/icons";
import { Tabs } from "@/components/application/tabs/tabs";
import { Button } from "@/components/base/buttons/button";
import { Notice, PageTitle } from "@/pages/team/dictionary/check/check-chrome";
import { BoardAnnouncer, KeyBadge, type MoveResult, chipClass, targetClass, useDragBoard } from "@/pages/team/dictionary/drag-board";
import {
    ALSO_RIGHT,
    type Board,
    type Mark,
    SUITE,
    type SortData,
    type SortJob,
    type Stage,
    type Unverified,
    type VendorCard,
    boxCountLine,
    canCheck,
    cardLabel,
    doesLine,
    firstStageOf,
    fullLine,
    gameStages,
    jobsLine,
    markBoard,
    moveCard,
    newBoard,
    placeOf,
    roundLine,
    sortProblems,
    stageBoxes,
    stageCapacity,
    suiteLine,
    tally,
    tallyLine,
    trayCards,
    unverified,
} from "@/pages/team/dictionary/tools/sort-model";
import { useSortCards } from "@/pages/team/dictionary/tools/tools-data";
import { useTheme } from "@/providers/theme-provider";
import { cx } from "@/utils/cx";

/**
 * Sort the stack: the three-round sort from reference/industry-acumen-sort/PROMPT.md, shared by
 * /dictionary/tools/review (behind the team sign-in) and /acumen-sort (no sign-in, the live
 * session's backup). The rules are sort-model.ts; the gestures are drag-board.tsx.
 *
 *   - Rounds 1 and 2: twelve vendor cards in a shuffled tray, four boxes of exactly three.
 *   - Round 3: one suite at a time is the only box; drag in the jobs it does, leave the rest.
 *   - "Check my stack" marks every card (round 3: the tray too) with an icon and a word, and
 *     shows the right box and the note. Cards stay put until "Try again".
 *   - ?present: large type, Round 1 / 2 / 3 tabs and "Show answers", for screen sharing.
 *
 * Every word on the board comes from the card list except the few UI strings below. Nothing is
 * stored or sent: the game lives in this component's state, and a refresh starts clean.
 *
 * The tray is pinned to the bottom of the pane with the round's buttons, so the next card is
 * always in reach while the boxes scroll. It stays there, empty or not, for as long as the board
 * is live, so picking up a placed card never changes its height under the finger; and whatever
 * takes focus in a box keeps the bar's height clear below it, so focus is never hidden under it.
 * On a phone, or a window too short for a wrapping tray, the tray is one row that scrolls
 * sideways (STRIP), so it covers a strip of the screen, not half of it.
 *
 * Touch: round 3's jobs, and the cards in a wrapping tray, drag in any direction. In the one-row
 * STRIP a sideways swipe scrolls the row (pan-x), so it starts no drag (drag-board leaves it to
 * the browser); a card drags up out of it. A vendor card already in a box lets a vertical swipe
 * scroll the page (touch-action: pan-y), because with three full-width cards a box a thumb
 * scrolling the page would otherwise keep landing on one and dragging it off; a finger drags it
 * by its grip instead (DotsGrid, at its right end). Tap, mouse and keyboard move every card from
 * anywhere on it.
 */

/* ── The frame for /acumen-sort and ?present ────────────────────── */

/**
 * The plain frame's own light/dark switch, in the page rather than floating over it: the global
 * floating toggle sat on top of the cards as the board scrolled under it, and took their taps.
 */
const FrameThemeButton = () => {
    const { theme, setTheme } = useTheme();
    const isDark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const label = isDark ? "Switch to light mode" : "Switch to dark mode";
    return (
        <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            title={label}
            aria-label={label}
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-secondary bg-primary text-secondary outline-focus-ring transition duration-100 ease-linear hover:bg-tertiary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2"
        >
            {isDark ? <Sun aria-hidden="true" className="size-[18px]" /> : <Moon01 aria-hidden="true" className="size-[18px]" />}
        </button>
    );
};

/**
 * A plain, calm page with the HGM logo and its own theme switch: no icon rail, no Docs menu, and
 * no floating toggle (main.tsx lists both its routes). Its scroller is `scrollRef`.
 */
export const StandaloneFrame = ({
    present = false,
    scrollRef,
    children,
}: {
    present?: boolean;
    scrollRef: RefObject<HTMLDivElement | null>;
    children: ReactNode;
}) => {
    return (
        <div ref={scrollRef} className="h-dvh overflow-y-auto bg-primary">
            <div className={cx("mx-auto w-full px-4 pt-6 pb-12 sm:px-8 sm:pt-8", present ? "max-w-[96rem]" : "max-w-3xl")}>
                <div className="flex items-center justify-between gap-4">
                    <img src="/hgm logo/Logo ON LIGHT.svg" alt="HiddenGem Media" className="h-8 w-auto dark:hidden" draggable={false} />
                    <img src="/hgm logo/LOGO ON Dark.svg" alt="HiddenGem Media" className="hidden h-8 w-auto dark:block" draggable={false} />
                    <FrameThemeButton />
                </div>
                <div className="mt-6">{children}</div>
            </div>
        </div>
    );
};

/* ── Loading, and the gate ──────────────────────────────────────── */

const WaitingNotice = ({ entries }: { entries: Unverified[] }) => (
    <Notice title="Some cards are still being checked">
        <p>
            Until every card has been checked against the vendor's own site, the tools pages stay closed. In industry-acumen-sort-cards.json, check each card's
            box and note, set verify to false and fill in checked.
        </p>
        <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5">
            {entries.map((e) => (
                <li key={`${e.round}:${e.vendor}`}>
                    <span className="font-medium text-secondary">{e.vendor}</span> · {`Round ${e.round}, ${e.roundTitle}`}
                    {e.what && <span className="block">{e.what}</span>}
                </li>
            ))}
        </ul>
    </Notice>
);

const BrokenNotice = ({ problems }: { problems: string[] }) => (
    <Notice title="The tools are being updated">
        <p>The card list has a problem, so these pages are paused until it's fixed.</p>
        <details className="mt-3">
            <summary className="cursor-pointer text-secondary">What needs fixing</summary>
            <ul className="mt-2 list-disc pl-5">
                {problems.slice(0, 20).map((p) => (
                    <li key={p}>{p}</li>
                ))}
            </ul>
        </details>
    </Notice>
);

const FailedNotice = () => (
    <Notice
        title="The cards couldn't load"
        actions={
            <Button size="sm" onClick={() => window.location.reload()}>
                Reload
            </Button>
        }
    >
        The portal may have been updated since this tab was opened. Reloading picks up the new version.
    </Notice>
);

/**
 * Loads the card list, then refuses to go on while it's broken (sortProblems) or while any card
 * or suite is still marked verify (the brief's rule). There is no way round it in the page.
 * `title` heads the page while it waits; without one, the card list's own title does once loaded.
 */
export const SortCardsGate = ({ title, children }: { title?: string; children: (data: SortData) => ReactNode }) => {
    const cards = useSortCards();
    if (cards.status === "ready") {
        const problems = sortProblems(cards.data);
        const waiting = problems.length ? [] : unverified(cards.data);
        if (!problems.length && !waiting.length) return <>{children(cards.data)}</>;
        return (
            <>
                <PageTitle>{title ?? cards.data.title}</PageTitle>
                <div className="mt-6">{problems.length ? <BrokenNotice problems={problems} /> : <WaitingNotice entries={waiting} />}</div>
            </>
        );
    }
    return (
        <>
            {title && <PageTitle>{title}</PageTitle>}
            <div className={cx(title && "mt-6")}>{cards.status === "loading" ? <p className="py-6 text-sm text-tertiary">Loading…</p> : <FailedNotice />}</div>
        </>
    );
};

/* ── The board's parts ──────────────────────────────────────────── */

/** Right or wrong, as an icon and a word: never colour alone. */
const MarkPill = ({ mark, large }: { mark: Mark; large: boolean }) => (
    <span
        className={cx(
            "inline-flex shrink-0 items-center gap-1 rounded-full py-0.5 pr-2.5 pl-2 font-semibold ring-1 ring-inset",
            large ? "text-lg" : "text-md",
            mark.right ? "bg-utility-green-50 text-utility-green-700 ring-utility-green-200" : "bg-utility-red-50 text-utility-red-700 ring-utility-red-200",
        )}
    >
        {mark.right ? <Check aria-hidden="true" className="size-4 shrink-0" /> : <XClose aria-hidden="true" className="size-4 shrink-0" />}
        {mark.right ? "Right" : "Wrong"}
    </span>
);

/** A card after checking: the vendor, its mark, why an also counts, the right box if it isn't this one, and its note. */
const VendorResult = ({ card, at, mark, boxName, large }: { card: VendorCard; at: string; mark: Mark; boxName: string; large: boolean }) => {
    const text = large ? "text-lg" : "text-md";
    return (
        <div className="rounded-lg bg-primary px-3.5 py-2.5 shadow-xs ring-1 ring-primary ring-inset">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <span className={cx("font-medium text-pretty text-primary", large ? "text-xl" : "text-md")}>{card.vendor}</span>
                <MarkPill mark={mark} large={large} />
            </div>
            {mark.also && <p className={cx("mt-1.5 font-medium text-pretty text-secondary", text)}>{ALSO_RIGHT}</p>}
            {at !== card.box && (
                <p className={cx("mt-1.5 text-pretty text-secondary", text)}>
                    Box: <span className="font-semibold">{boxName}</span>
                </p>
            )}
            <p className={cx("mt-1.5 text-pretty text-tertiary", text)}>{card.note}</p>
        </div>
    );
};

/** A job card in round 3 after checking, in the suite or left in the tray. */
const JobResult = ({ name, mark, large }: { name: string; mark: Mark; large: boolean }) => (
    <span
        className={cx(
            "inline-flex min-h-11 flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg bg-primary px-3.5 py-2 font-medium text-primary shadow-xs ring-1 ring-primary ring-inset",
            large ? "text-xl" : "text-md",
        )}
    >
        {name}
        <MarkPill mark={mark} large={large} />
    </span>
);

/** A card in "Show answers": nothing to move, so not a button. */
const AnswerCard = ({ name, note, large }: { name: string; note?: string; large: boolean }) => (
    <span
        className={cx(
            "block min-h-11 rounded-lg bg-primary px-3.5 py-2 shadow-xs ring-1 ring-primary ring-inset",
            !note && "inline-flex items-center",
            large ? "text-xl" : "text-md",
        )}
    >
        <span className="block font-medium text-pretty text-primary">{name}</span>
        {note && <span className={cx("mt-1 block text-pretty text-tertiary", large ? "text-lg" : "text-md")}>{note}</span>}
    </span>
);

/** An empty place in a box, the size of a card, so a box doesn't grow (and move the boxes under it) as cards go in. */
const EmptySlot = ({ large }: { large: boolean }) => (
    <span aria-hidden="true" className={cx("block rounded-lg border border-dashed border-primary", large ? "min-h-12" : "min-h-11")} />
);

/**
 * The tray on a phone, or in a window too short for a wrapping tray (a phone on its side): one
 * row that scrolls sideways, as the check's tray does, so it covers a strip of the screen. Its
 * cards keep their width and let a sideways swipe scroll the row; a drag up still picks one up.
 */
const STRIP =
    "max-sm:max-h-none max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:pb-1 [@media(max-height:32rem)]:max-h-none [@media(max-height:32rem)]:flex-nowrap [@media(max-height:32rem)]:overflow-x-auto [@media(max-height:32rem)]:pb-1";
const STRIP_CARD =
    "max-sm:max-w-[80vw] max-sm:shrink-0 max-sm:touch-pan-x [@media(max-height:32rem)]:max-w-[80vw] [@media(max-height:32rem)]:shrink-0 [@media(max-height:32rem)]:touch-pan-x";

/**
 * What takes focus in a box keeps the pinned bar's height (--tray-clear, set by StageBoard) clear
 * below it, so Tab and a keyboard move scroll it out from under the bar instead of leaving focus
 * hidden there.
 */
const CLEAR_OF_BAR = "scroll-mb-(--tray-clear)";

/** The handle a finger drags a placed vendor card by: elsewhere on the card, a vertical swipe scrolls the page. */
const Grip = () => (
    <span
        data-grip
        aria-hidden="true"
        className="-my-2 -mr-3.5 ml-auto flex w-11 shrink-0 touch-none items-center justify-center self-stretch text-fg-quaternary"
    >
        <DotsGrid className="size-4" />
    </span>
);

type DropTarget = { drop: { "data-drop": string }; onPlace: () => void; carrying: boolean; over: boolean };

/**
 * A box: its number key, name and job line, its cards, and its count. While the board is live
 * (`target`), a tap anywhere on it places the card being carried, and its heading is a button,
 * so a screen reader on a phone, with no number keys, can place a card too.
 */
const BoxFrame = ({
    n,
    name,
    job,
    count,
    large,
    target,
    after,
    children,
}: {
    n: number | null;
    name: string;
    job?: string;
    count: string;
    large: boolean;
    target?: DropTarget;
    after?: ReactNode;
    children: ReactNode;
}) => {
    const nameId = useId();
    const head = (
        <>
            {n !== null && <KeyBadge n={n} className={large ? "mt-1" : "mt-px"} />}
            <span className="min-w-0">
                <span id={nameId} className={cx("block font-semibold text-pretty text-primary", large ? "text-xl" : "text-md")}>
                    {name}
                </span>
                {job && <span className={cx("mt-0.5 block text-pretty text-tertiary", large ? "text-lg" : "text-sm")}>{job}</span>}
            </span>
        </>
    );
    return (
        <div
            role="group"
            aria-labelledby={nameId}
            {...target?.drop}
            onClick={target?.onPlace}
            className={cx(
                "flex flex-col rounded-xl bg-secondary p-3 ring-1 ring-secondary ring-inset",
                large && "p-4",
                target && targetClass({ carrying: target.carrying, over: target.over }),
            )}
        >
            {target ? (
                <button
                    type="button"
                    className={cx(
                        "flex w-full items-start gap-3 rounded-md text-left outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2",
                        CLEAR_OF_BAR,
                    )}
                >
                    {head}
                </button>
            ) : (
                <div className="flex items-start gap-3">{head}</div>
            )}
            <div className="mt-3 flex-1">{children}</div>
            <p className={cx("mt-2 font-mono text-tertiary tabular-nums", large ? "text-md" : "text-sm")}>{count}</p>
            {after}
        </div>
    );
};

/** After round 3's last suite: the card list's finish line, and back to round 1. */
const Finish = ({ line, onStartOver, large }: { line: string; onStartOver: () => void; large: boolean }) => (
    <div className="mt-4 flex flex-col items-start gap-3 border-t border-secondary pt-4">
        <p className={cx("max-w-[60ch] font-medium text-pretty text-primary", large ? "text-xl" : "text-md")}>{line}</p>
        <Button size={large ? "xl" : "lg"} onClick={onStartOver}>
            Start over
        </Button>
    </div>
);

const jobsOf = (jobs: readonly SortJob[], ids: readonly string[]): SortJob[] => ids.flatMap((id) => jobs.find((j) => j.id === id) ?? []);

/* ── The game ───────────────────────────────────────────────────── */

type StageProps = {
    data: SortData;
    stages: Stage[];
    at: number;
    answers: boolean;
    present: boolean;
    scrollRef: RefObject<HTMLDivElement | null>;
    goTo: (index: number) => void;
    /** Every board but the page's first takes focus on its heading: the button that brought it here is gone. */
    focusOnMount: boolean;
};

/**
 * One board, from a fresh shuffle to its marks. SortStack mounts a new one (by key) for every
 * Next, Try again, Start over and round tab, so nothing carries over: not a card in hand, not
 * the last announcement, not a refusal.
 */
const StageBoard = ({ data, stages, at, answers, present, scrollRef, goTo, focusOnMount }: StageProps) => {
    const stage = stages[at];
    const [board, setBoard] = useState<Board>(() => newBoard(stage, Math.random));
    const [checked, setChecked] = useState(false);
    const [refusal, setRefusal] = useState("");
    const headingId = useId();
    const indicatorId = useId();
    const trayLabelId = useId();
    const sectionRef = useRef<HTMLElement>(null);
    const barRef = useRef<HTMLDivElement>(null);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const tallyRef = useRef<HTMLParagraphElement>(null);
    /**
     * What happens once the next render lands. Focus moves because the buttons that move on vanish
     * with the board they were on; a checked suite scrolls to its end, where its tray now is.
     */
    const after = useRef<{ focus: "heading" | "tally"; toEnd?: boolean } | null>(focusOnMount ? { focus: "heading" } : null);

    const boxes = stageBoxes(stage);
    const capacity = stageCapacity(stage);
    const locked = checked || answers;
    const large = present;
    const buttonSize = present ? "xl" : "lg";
    const last = at === stages.length - 1;
    const label = (id: string) => cardLabel(stage, id);
    const boxName = (id: string) => boxes.find((b) => b.id === id)?.label ?? id;

    useEffect(() => {
        const want = after.current;
        if (!want) return;
        after.current = null;
        const pane = scrollRef.current;
        if (want.toEnd && pane) pane.scrollTo({ top: pane.scrollHeight, behavior: "instant" });
        (want.focus === "heading" ? headingRef.current : tallyRef.current)?.focus({ preventScroll: true });
    });

    // "Show answers" replaces the board, and the button with it.
    useEffect(() => {
        if (answers) headingRef.current?.focus({ preventScroll: true });
    }, [answers]);

    // The pinned bar's height, for CLEAR_OF_BAR. The bar is there until "Show answers" replaces the board.
    useEffect(() => {
        const bar = barRef.current;
        const section = sectionRef.current;
        if (!bar || !section || typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(() => section.style.setProperty("--tray-clear", `${bar.offsetHeight + 8}px`));
        observer.observe(bar);
        return () => {
            observer.disconnect();
            section.style.removeProperty("--tray-clear");
        };
    }, [answers]);

    const check = () => {
        setChecked(true);
        setRefusal("");
        after.current = { focus: "tally", toEnd: stage.kind === "jobs" };
    };

    const onMove = (card: string, to: string | null): MoveResult => {
        const { board: next, outcome } = moveCard(board, card, to, capacity);
        const name = label(card);
        const into = to === null ? "" : boxName(to);
        switch (outcome) {
            // "same" never comes: drag-board answers a move to where the card already is itself ("… stays where it is.").
            case "unknown":
            case "same":
                return { ok: false, message: "" };
            case "full": {
                const line = fullLine(into, capacity ?? 0);
                setRefusal(line);
                return { ok: false, message: line };
            }
            case "tray":
                setBoard(next);
                setRefusal("");
                return { ok: true, message: `${name} back in the tray.` };
            case "placed":
                setBoard(next);
                setRefusal("");
                return {
                    ok: true,
                    message: capacity === null ? `${name} in ${into}.` : `${name} in ${into}, ${boxCountLine(next.boxes[to ?? ""].length, capacity)}.`,
                };
        }
    };

    const drag = useDragBoard({ targets: boxes, chipLabel: label, onMove, noun: "box", disabled: locked, scrollRef });

    const marks = checked ? markBoard(stage, board) : null;
    const carried = drag.picked ?? drag.dragging;
    const carrying = carried !== null;
    /** Where the carried card came from: a box id, null for the tray, undefined when nothing is carried. */
    const carriedFrom = carried === null ? undefined : placeOf(board, carried);
    const fromBox = carriedFrom !== undefined && carriedFrom !== null;
    /** A placed card is picked up, so the tray's button can take it back (a dragged one is dropped instead). */
    const sendBack = drag.picked !== null && placeOf(board, drag.picked) !== null;
    const tray = trayCards(board);
    /**
     * The tray stays on the board, empty or not, until it's checked: picking up a placed card must
     * never change the pinned bar's height under the finger that's about to tap again.
     */
    const liveTray = !marks;

    /**
     * A card that can move. In the tray it fits the phone's one-row strip; in a box it keeps clear
     * of the pinned bar when it takes focus. A vendor card in a box (`fill`) lets a vertical swipe
     * scroll the page, so on touch and pen it drags by its grip; a mouse drags it from anywhere.
     */
    const chip = (id: string, where: string | null, fill = false) => {
        const props = drag.chipProps(id, where);
        const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
            if (fill && e.pointerType !== "mouse" && !(e.target as Element).closest("[data-grip]")) return;
            props.onPointerDown(e);
        };
        return (
            <button
                {...props}
                onPointerDown={onPointerDown}
                className={cx(chipClass({ picked: drag.picked === id, fill, large }), where === null ? STRIP_CARD : CLEAR_OF_BAR, fill && "touch-pan-y")}
            >
                {label(id)}
                {fill && <Grip />}
            </button>
        );
    };

    const target = (id: string): DropTarget | undefined => {
        if (locked) return undefined;
        // A full box refuses the carried card, so it mustn't look like a place it can go. The box the card came from keeps its look.
        const refuses = capacity !== null && carriedFrom !== id && (board.boxes[id]?.length ?? 0) >= capacity;
        return { drop: drag.dropProps(id), onPlace: () => drag.placeInto(id), carrying: carrying && !refuses, over: drag.over === id && !refuses };
    };

    const grid = present ? "grid gap-4 @2xl:grid-cols-2 @6xl:grid-cols-4" : "grid gap-3 @xl:grid-cols-2";

    /* What the board shows: the boxes (live or marked), or the answers. */
    let body: ReactNode;
    if (answers && stage.kind === "vendors") {
        const round = stage.round;
        body = (
            <>
                <div className={cx("mt-5", grid)}>
                    {round.boxes.map((box, i) => {
                        const cards = round.cards.filter((c) => c.box === box.id);
                        return (
                            <BoxFrame key={box.id} n={i + 1} name={box.name} job={box.job} count={boxCountLine(cards.length, round.per_box)} large={large}>
                                <ul className="flex flex-col gap-2">
                                    {cards.map((c) => (
                                        <li key={c.vendor}>
                                            <AnswerCard name={c.vendor} note={c.note} large={large} />
                                        </li>
                                    ))}
                                </ul>
                            </BoxFrame>
                        );
                    })}
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Button size={buttonSize} color="secondary" iconLeading={RefreshCw01} onClick={() => goTo(at)}>
                        Try again
                    </Button>
                    {stage.roundIndex < data.rounds.length - 1 && (
                        <Button size={buttonSize} iconTrailing={ArrowRight} onClick={() => goTo(firstStageOf(stages, stage.roundIndex + 1))}>
                            Next
                        </Button>
                    )}
                </div>
            </>
        );
    } else if (answers && stage.kind === "jobs") {
        const round = stage.round;
        body = (
            <>
                <div className={cx("mt-5 grid gap-4", present ? "@4xl:grid-cols-3" : "@2xl:grid-cols-3")}>
                    {round.suites.map((suite) => (
                        <BoxFrame
                            key={suite.vendor}
                            n={null}
                            name={suite.vendor}
                            count={jobsLine(suite.does.length)}
                            large={large}
                            after={<p className={cx("mt-3 text-pretty text-tertiary", large ? "text-lg" : "text-md")}>{suite.note}</p>}
                        >
                            <ul className="flex flex-wrap gap-2">
                                {jobsOf(round.jobs, suite.does).map((j) => (
                                    <li key={j.id}>
                                        <AnswerCard name={j.name} large={large} />
                                    </li>
                                ))}
                            </ul>
                        </BoxFrame>
                    ))}
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Button size={buttonSize} color="secondary" iconLeading={RefreshCw01} onClick={() => goTo(at)}>
                        Try again
                    </Button>
                </div>
                <Finish line={data.finish} onStartOver={() => goTo(0)} large={large} />
            </>
        );
    } else {
        const inSuite = stage.kind === "jobs" ? (board.boxes[SUITE] ?? []) : [];
        body = (
            <div {...drag.rootProps} className="mt-5 -mb-12">
                <BoardAnnouncer message={drag.message} />

                {stage.kind === "vendors" ? (
                    <div className={grid}>
                        {stage.round.boxes.map((box, i) => {
                            const inBox = board.boxes[box.id] ?? [];
                            return (
                                <BoxFrame
                                    key={box.id}
                                    n={i + 1}
                                    name={box.name}
                                    job={box.job}
                                    count={boxCountLine(inBox.length, stage.round.per_box)}
                                    large={large}
                                    target={target(box.id)}
                                >
                                    <ul className="flex flex-col gap-2">
                                        {inBox.map((id) => {
                                            const card = stage.round.cards.find((c) => c.vendor === id);
                                            const mark = marks?.get(id);
                                            return (
                                                <li key={id}>
                                                    {mark && card ? (
                                                        <VendorResult card={card} at={box.id} mark={mark} boxName={boxName(card.box)} large={large} />
                                                    ) : (
                                                        chip(id, box.id, true)
                                                    )}
                                                </li>
                                            );
                                        })}
                                        {!marks &&
                                            Array.from({ length: Math.max(0, stage.round.per_box - inBox.length) }, (_, k) => (
                                                <li key={`empty-${k}`} aria-hidden="true">
                                                    <EmptySlot large={large} />
                                                </li>
                                            ))}
                                    </ul>
                                </BoxFrame>
                            );
                        })}
                    </div>
                ) : (
                    <>
                        <BoxFrame n={1} name={stage.suite.vendor} count={jobsLine(inSuite.length)} large={large} target={target(SUITE)}>
                            {inSuite.length ? (
                                <ul className="flex flex-wrap gap-2">
                                    {inSuite.map((id) => {
                                        const mark = marks?.get(id);
                                        return <li key={id}>{mark ? <JobResult name={label(id)} mark={mark} large={large} /> : chip(id, SUITE)}</li>;
                                    })}
                                </ul>
                            ) : (
                                <EmptySlot large={large} />
                            )}
                        </BoxFrame>
                        {marks && (
                            <div className={cx("mt-3 max-w-[66ch] text-pretty", large ? "text-lg" : "text-md")}>
                                <p className="font-semibold text-primary">{doesLine(jobsOf(stage.round.jobs, stage.suite.does))}</p>
                                <p className="mt-1 text-tertiary">{stage.suite.note}</p>
                            </div>
                        )}
                    </>
                )}

                {/* Checked: round 3's tray stays on the page, marked, since a job the suite does left here is wrong. */}
                {marks && stage.kind === "jobs" && tray.length > 0 && (
                    <div className="mt-5">
                        <p id={trayLabelId} className={cx("font-medium text-tertiary", large ? "text-md" : "text-sm")}>
                            Tray
                        </p>
                        <div role="group" aria-labelledby={trayLabelId} className="mt-2 flex flex-wrap gap-2">
                            {tray.map((id) => {
                                const mark = marks.get(id);
                                return mark && <JobResult key={id} name={label(id)} mark={mark} large={large} />;
                            })}
                        </div>
                    </div>
                )}
                {marks && last && <p className={cx("mt-5 max-w-[60ch] font-medium text-pretty text-primary", large ? "text-xl" : "text-md")}>{data.finish}</p>}

                {/* Pinned to the bottom of the pane: the tray while cards are moving, so the next one is always in
                    reach as the boxes scroll, and the round's buttons. The board's -mb-12 cancels the frame's
                    pb-12 (CheckPage, StandaloneFrame), so at the end of the page this sits flush with the bottom. */}
                <div ref={barRef} className="sticky bottom-0 z-10 -mx-4 mt-5 border-t border-secondary bg-primary px-4 pt-3 pb-3 sm:-mx-8 sm:px-8 sm:pb-4">
                    {liveTray && (
                        <div
                            role="group"
                            aria-label="Tray"
                            {...drag.dropProps(null)}
                            onClick={drag.backToTray}
                            className={cx(
                                "-m-1 flex max-h-[50dvh] min-h-12 flex-wrap content-start items-center gap-2 overflow-y-auto rounded-lg p-1",
                                STRIP,
                                targetClass({ carrying: fromBox, over: drag.over === null }),
                            )}
                        >
                            {/* The tray's own button: what a screen reader on a phone (no Backspace) sends a placed card
                                back with. It names the tray for everyone, and takes a card only when a placed one is in hand. */}
                            <button
                                type="button"
                                aria-disabled={!sendBack || undefined}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (sendBack) drag.backToTray();
                                }}
                                className={cx(
                                    "inline-flex min-h-11 shrink-0 items-center rounded-md px-1.5 font-medium outline-focus-ring transition duration-100 ease-linear focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none",
                                    large ? "text-md" : "text-sm",
                                    // The utility brand tint stays blue in dark mode, where text-brand-secondary turns grey.
                                    sendBack ? "text-utility-brand-700" : "text-quaternary",
                                    !tray.length && "m-auto",
                                )}
                            >
                                Tray
                            </button>
                            {tray.map((id) => (
                                <Fragment key={id}>{chip(id, null)}</Fragment>
                            ))}
                        </div>
                    )}
                    {refusal && (
                        <p className={cx("flex items-start gap-1.5 font-medium text-secondary", liveTray && "mt-3", large ? "text-lg" : "text-sm")}>
                            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-warning-primary" />
                            {refusal}
                        </p>
                    )}
                    <div className={cx("flex flex-wrap items-center gap-x-3 gap-y-2", (liveTray || refusal) && "mt-3")}>
                        {marks ? (
                            <>
                                <p
                                    ref={tallyRef}
                                    tabIndex={-1}
                                    className={cx(
                                        "mr-1 w-full font-mono font-semibold text-primary tabular-nums outline-none @md:w-auto",
                                        large ? "text-xl" : "text-lg",
                                    )}
                                >
                                    {tallyLine(tally(marks))}
                                </p>
                                <Button size={buttonSize} color="secondary" iconLeading={RefreshCw01} onClick={() => goTo(at)}>
                                    Try again
                                </Button>
                                {last ? (
                                    <Button size={buttonSize} onClick={() => goTo(0)}>
                                        Start over
                                    </Button>
                                ) : (
                                    <Button size={buttonSize} iconTrailing={ArrowRight} onClick={() => goTo(at + 1)}>
                                        Next
                                    </Button>
                                )}
                            </>
                        ) : (
                            <Button size={buttonSize} isDisabled={!canCheck(stage, board)} onClick={check}>
                                Check my stack
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const indicator = [!present && roundLine(stage, data.rounds.length), stage.kind === "jobs" && !answers && suiteLine(stage)].filter(Boolean).join(" · ");

    return (
        <section ref={sectionRef} aria-labelledby={headingId} className="@container">
            {indicator && (
                <p id={indicatorId} className={cx("font-mono text-tertiary", large ? "text-md" : "text-sm")}>
                    {indicator}
                </p>
            )}
            {/* Focus lands here on every new board, so it carries where the board is ("Round 3 of 3 · Suite 2 of 3")
                and, in round 3, whose suite it is: the three suites share one title, and without the name a
                screen reader would hear the same heading after every Next. */}
            <h2
                id={headingId}
                ref={headingRef}
                tabIndex={-1}
                aria-describedby={indicator ? indicatorId : undefined}
                className={cx("mt-1 font-semibold text-pretty text-primary outline-none", large ? "text-display-xs md:text-display-sm" : "text-xl")}
            >
                {stage.round.title}
                {stage.kind === "jobs" && !answers && <span className="sr-only">: {stage.suite.vendor}</span>}
            </h2>
            {stage.kind === "jobs" && <p className={cx("mt-2 max-w-[60ch] text-pretty text-tertiary", large ? "text-xl" : "text-md")}>{stage.round.intro}</p>}
            {body}
        </section>
    );
};

/**
 * The game: the card list's title, its made-up line, and one board at a time. In ?present, the
 * board sits under Round 1 / 2 / 3 tabs, with "Show answers" beside them.
 */
export const SortStack = ({ data, present = false, scrollRef }: { data: SortData; present?: boolean; scrollRef: RefObject<HTMLDivElement | null> }) => {
    const stages = useMemo(() => gameStages(data), [data]);
    const [view, setView] = useState({ at: 0, attempt: 0, answers: false });
    const stage = stages[view.at];

    /** A fresh, reshuffled board: Next, Try again, Start over and the round tabs all come here. */
    const goTo = (index: number) => {
        setView((v) => ({ at: index, attempt: v.attempt + 1, answers: false }));
        scrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
    };

    const board = (
        <StageBoard
            key={`${view.at}:${view.attempt}`}
            data={data}
            stages={stages}
            at={view.at}
            answers={view.answers}
            present={present}
            scrollRef={scrollRef}
            goTo={goTo}
            focusOnMount={view.attempt > 0}
        />
    );

    return (
        <>
            <PageTitle>{data.title}</PageTitle>
            <p className={cx("mt-2 max-w-[60ch] text-pretty text-quaternary", present ? "text-md" : "text-sm")}>{data.made_up_line}</p>

            {present ? (
                <Tabs
                    selectedKey={String(stage.roundIndex)}
                    onSelectionChange={(key) => {
                        if (Number(key) !== stage.roundIndex) goTo(firstStageOf(stages, Number(key)));
                    }}
                    className="mt-6"
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <Tabs.List type="button-border" size="md" items={data.rounds.map((_, i) => ({ id: String(i), label: `Round ${i + 1}` }))} />
                        {!view.answers && (
                            <Button size="lg" color="secondary" iconLeading={Eye} onClick={() => setView((v) => ({ ...v, answers: true }))}>
                                Show answers
                            </Button>
                        )}
                    </div>
                    {data.rounds.map((r, i) => (
                        <Tabs.Panel key={r.id} id={String(i)} className="mt-6 rounded-lg">
                            {board}
                        </Tabs.Panel>
                    ))}
                </Tabs>
            ) : (
                <div className="mt-6">{board}</div>
            )}
        </>
    );
};
