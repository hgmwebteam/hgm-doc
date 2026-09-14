import type { CSSProperties, FC, ReactNode } from "react";
import { Rocket01 } from "@untitledui/icons";
import { cx } from "@/utils/cx";

/** One cell of the tracker: a journey step, or one piece of a step ticked piece by piece. */
export interface JourneyCell {
    id: string;
    /** The milestone's name, written out in full and shown in caps where there's room. */
    label: string;
    /** 0–1. A whole step or piece is 1; a step answered in parts is its fraction. */
    fraction: number;
    /** The cell a client should be on — the first unfinished one. */
    current?: boolean;
    /** The last cell: the rocket, and the end of the journey. */
    rocket?: boolean;
}

/** A named stage, bracketed under the run of cells it covers. */
export interface JourneyGroup {
    id: string;
    label: string;
    /** How many cells, taken in order from where the previous group ended. */
    cells: number;
}

/**
 * How far a slanted edge leans, in pixels at each end.
 *
 * The dividers are skewed by an angle and every fill is clipped by a polygon, so the two
 * only line up if the lean matches: at the bar's 56px height, skewX(-12deg) moves each end
 * of a divider by tan(12°) × 28px ≈ 6px. Change the height or the angle and this has to be
 * recomputed, which is why the bar is one fixed height at every width.
 */
const LEAN = 6;

/**
 * A parallelogram spanning [from, to] of the BAR, leaning right.
 *
 * Both ends take the lean so neighbouring cells tile with no seam. The bar's two outer ends
 * don't: they sit inside the pill's round caps, where a lean would read as a wonky edge
 * rather than a chevron.
 */
const cellClip = (from: number, to: number, { leanStart = true, leanEnd = true } = {}) => {
    const s = leanStart ? LEAN : 0;
    const e = leanEnd ? LEAN : 0;
    return `polygon(calc(${from}% + ${s}px) 0, calc(${to}% + ${e}px) 0, calc(${to}% - ${e}px) 100%, calc(${from}% - ${s}px) 100%)`;
};

/**
 * The launch meter under "Your journey".
 *
 * A stage tracker, in the spirit of a pizza tracker: one leaning cell per thing a client
 * can finish, grouped under four named stages, ending in a rocket. This is the only thing
 * on the Overview that says how close they are to going live, so it is deliberately the
 * loudest element on the page — the steps list below explains WHAT is left, this answers
 * "how far along am I, and where am I heading".
 *
 * A cell per PIECE rather than per step, which is why the Marketing funnel stage is the
 * long one: its five reviews are built and signed off separately over several weeks, and a
 * client watching that stretch needs it to move five times, not once. It also keeps the
 * arithmetic honest — every cell is worth the same, so the fill and the percentage above it
 * are the same number.
 *
 * Every cell carries its OWN state rather than the bar filling left to right: these steps
 * don't have to be done in order, and a run of colour up to the sixth cell would tell a
 * client who skipped their form that the second was finished.
 *
 * The colour is one ramp measured across the WHOLE bar, and each cell shows its own slice
 * of it — so the funnel is pink whether or not the kick-off was ever ticked, and a client
 * near the rocket is looking at a visibly warmer bar than the one they started on. That's
 * why every fill here is a full-width layer clipped down, never a box painted its own
 * colour.
 *
 * The rocket is the destination. It is the Live stage's own cell, not an extra step to tick
 * off, so nothing here writes to `content.journey_done`.
 */
export const JourneyProgress: FC<{
    /** Every cell, in order. */
    cells: JourneyCell[];
    /** The named stages, in order; their `cells` counts must add up to `cells.length`. */
    groups: JourneyGroup[];
    /** Steps fully done, and how many there are — the line beside the percentage counts
     *  STEPS, which is not the cell count: the funnel is one step and five cells. */
    stepsDone: number;
    stepsTotal: number;
    /** What's next, down to the piece where a step has several. Null once done. */
    nextLabel?: string | null;
}> = ({ cells, groups, stepsDone, stepsTotal, nextLabel }) => {
    const count = Math.max(cells.length, 1);
    const clamp = (n: number) => Math.min(Math.max(n, 0), 1);
    const filled = cells.reduce((acc, cell) => acc + clamp(cell.fraction), 0);
    const complete = filled >= count;
    const percent = Math.round((filled / count) * 100);

    /** Cell geometry, in percent of the bar. Every cell is worth the same. */
    const span = 100 / count;
    const startOf = (i: number) => i * span;

    /** Where each group starts and ends, in cells. */
    let cursor = 0;
    const spans = groups.map((group) => {
        const from = cursor;
        cursor += group.cells;
        return { ...group, from, to: Math.min(cursor, count) };
    });

    return (
        <div className="mt-5 rounded-2xl bg-secondary p-4 ring-1 ring-secondary md:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm font-semibold text-primary">
                    {complete ? (
                        "You're live — every step is done."
                    ) : (
                        <>
                            <span className="journey-meter-figure text-lg font-bold tabular-nums">{percent}%</span> of the way to launch
                        </>
                    )}
                </p>
                <p className="text-xs text-tertiary">
                    {complete ? (
                        "Congratulations from all of us at HiddenGem."
                    ) : (
                        <>
                            <span className="tabular-nums">
                                {stepsDone} of {stepsTotal} steps
                            </span>
                            {nextLabel ? ` · Up next: ${nextLabel}` : null}
                        </>
                    )}
                </p>
            </div>

            <div
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progress to launch"
                className="journey-meter-track relative mt-3.5 h-14 w-full overflow-hidden rounded-full ring-1 ring-secondary"
                // Where the ramp hands over from brand blue to the logo's gold: the last
                // cell's own edge, so the changeover always lands on a divider. Measured
                // here rather than written into the CSS as a percentage, which would drift
                // the moment the bar gains or loses a cell.
                style={{ "--journey-meter-gold-from": `${startOf(count - 1)}%` } as CSSProperties}
            >
                {/* Layer 1 — each cell's slice of the ramp, clipped to how much of it is
                    done. Full-width layers, so the colour is continuous across the bar. */}
                {cells.map((cell, i) => {
                    const done = clamp(cell.fraction);
                    if (done <= 0) return null;
                    const from = startOf(i);
                    return (
                        <div
                            key={`fill-${cell.id}`}
                            aria-hidden="true"
                            className="journey-meter-fill absolute inset-0 transition-[clip-path] duration-700 ease-out"
                            style={{
                                clipPath: cellClip(from, from + span * done, {
                                    leanStart: i > 0,
                                    leanEnd: !(i === count - 1 && done === 1),
                                }),
                            }}
                        />
                    );
                })}

                {/* The step a client should be on, tinted so it reads as "you are here" against
                    the empty cells either side of it. Under the labels, over nothing else —
                    a cell that is partly done keeps its ramp slice on top. */}
                {cells.map((cell, i) =>
                    cell.current ? (
                        <div
                            key={`now-${cell.id}`}
                            aria-hidden="true"
                            className="journey-meter-current absolute inset-0"
                            style={{ clipPath: cellClip(startOf(i), startOf(i) + span, { leanStart: i > 0, leanEnd: i < count - 1 }) }}
                        />
                    ) : null,
                )}

                {/* Layer 2 — the cells themselves, in their unfilled colours. */}
                <div aria-hidden="true" className="absolute inset-0">
                    {cells.map((cell, i) => (
                        <Cell key={cell.id} left={startOf(i)} width={span} divider={i > 0} tone={cell.current ? "current" : "rest"}>
                            <Face cell={cell} tone={cell.current ? "current" : "rest"} />
                        </Cell>
                    ))}
                </div>

                {/* Layer 3 — the same cells in their filled colours, each clipped to its own
                    fill, so a label switches from dark to white exactly where the colour ends
                    and no cell is ever left half-legible. */}
                <div aria-hidden="true" className="absolute inset-0">
                    {cells.map((cell, i) => {
                        const done = clamp(cell.fraction);
                        if (done <= 0) return null;
                        const from = startOf(i);
                        return (
                            <Cell
                                key={`on-${cell.id}`}
                                left={from}
                                width={span}
                                divider={i > 0}
                                tone="fill"
                                // Clipped against the BAR, not the cell, so this lines up with
                                // the ramp slice underneath to the pixel.
                                clip={done < 1 ? cellClip(from, from + span * done, { leanStart: i > 0 }) : undefined}
                            >
                                <Face cell={cell} tone="fill" />
                            </Cell>
                        );
                    })}
                </div>
            </div>

            {/* The four stages, bracketed under the run of cells each covers. The names live
                here rather than inside the bar because a stage is up to six cells wide and a
                name centred across them would sit on top of its own dividers. It doubles as
                the only labelling on a phone, where the cells themselves are too narrow for
                text of any size. */}
            <div className="relative mt-2 h-11 sm:h-7">
                {spans.map((group) => {
                    const from = startOf(group.from);
                    const to = startOf(group.to);
                    const groupDone = cells.slice(group.from, group.to).every((cell) => clamp(cell.fraction) >= 1);
                    const groupCurrent = cells.slice(group.from, group.to).some((cell) => cell.current);
                    return (
                        <div key={group.id} className="absolute inset-y-0 px-0.5 sm:px-1" style={{ left: `${from}%`, width: `${to - from}%` }}>
                            <span className={cx("block h-0.5 rounded-full", groupDone ? "bg-brand-solid" : "bg-border-secondary")} />
                            {/* Wraps rather than truncates: on a phone the Brand foundation
                                bracket is about 50px wide, and "BRAND FOUND…" is worse than
                                two short lines. */}
                            <span
                                className={cx(
                                    "mt-1.5 block text-center text-[10px] leading-tight font-bold tracking-wide uppercase",
                                    groupDone || groupCurrent ? "text-secondary" : "text-quaternary",
                                )}
                            >
                                {group.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

type Tone = "rest" | "current" | "fill";

/**
 * One column of the bar. Positioned rather than flexed: the ramp slices are clipped by
 * percentages of the bar, and the labels have to land on exactly the same boundaries.
 *
 * `clip` is applied to a full-bar-width wrapper so its percentages mean the same thing they
 * do in the ramp layer — a clip on the column itself would measure against the column and
 * drift.
 */
const Cell: FC<{ left: number; width: number; divider?: boolean; tone: Tone; clip?: string; children: ReactNode }> = ({
    left,
    width,
    divider,
    tone,
    clip,
    children,
}) => {
    const column = (
        <div className="absolute inset-y-0 grid min-w-0 place-items-center px-1.5" style={{ left: `${left}%`, width: `${width}%` }}>
            {divider && (
                <span
                    className={cx("absolute inset-y-0 left-0 w-0.5 -translate-x-1/2 skew-x-[-12deg]", tone === "fill" ? "bg-white/35" : "bg-border-secondary")}
                />
            )}
            <span className="grid min-w-0 place-items-center gap-1 leading-none">{children}</span>
        </div>
    );
    return clip ? (
        <div className="absolute inset-0 transition-[clip-path] duration-700 ease-out" style={{ clipPath: clip }}>
            {column}
        </div>
    ) : (
        column
    );
};

/**
 * What a cell shows: a rocket for the last one, a name for the rest.
 *
 * The names appear only from `lg` up. Fourteen cells share the bar, so below that each is
 * too narrow for text of any size that would still be readable — the bracket underneath
 * names the stage instead, and "Up next" above names the exact step.
 */
const Face: FC<{ cell: JourneyCell; tone: Tone }> = ({ cell, tone }) => {
    const text = tone === "fill" ? "text-white" : tone === "current" ? "text-brand-secondary" : "text-tertiary";
    return (
        <>
            {cell.rocket ? (
                // No name beside it: the bracket underneath already says Live, and the
                // rocket is the one cell that needs no explaining.
                <Rocket01 className={cx("size-5", tone === "fill" ? "journey-meter-rocket-ink" : text)} />
            ) : (
                <>
                    <span className={cx("size-1.5 rounded-full lg:hidden", tone === "fill" ? "bg-white/70" : "bg-border-secondary")} />
                    {/* Wraps rather than truncates, the same way the stage brackets do.
                        Names are written out in full, and "ONBOARDIN…" is a worse cell
                        than two short lines — the bar is 56px tall, so there is room. */}
                    <span className={cx("hidden max-w-full text-center text-[10px] leading-tight font-bold tracking-wide uppercase lg:block", text)}>
                        {cell.label}
                    </span>
                </>
            )}
        </>
    );
};
