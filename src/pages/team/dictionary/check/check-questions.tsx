import { type FC, type ReactNode, type RefObject, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "@untitledui/icons";
import { RadioButton, RadioGroup } from "@/components/base/radio-buttons/radio-buttons";
import {
    type BankItem,
    type BankTable,
    type BucketsVariant,
    type CheckBank,
    type CheckResponse,
    type ChoiceItem,
    type ChoiceVariant,
    type MatchingVariant,
    type NumericVariant,
    type OrderingVariant,
    type PlanEntry,
    type TrueFalseVariant,
    type WordProblemVariant,
    findVariant,
    matchingLine,
    seededRandom,
    shuffle,
    shuffledSteps,
    standaloneBlank,
    standalonePrompt,
} from "@/pages/team/dictionary/check/check-model";
import type { DictionaryEntry } from "@/pages/team/dictionary/dictionary-model";
import { BoardAnnouncer, type DragBoard, KeyBadge, chipClass, targetClass, useDragBoard } from "@/pages/team/dictionary/drag-board";
import { cx } from "@/utils/cx";

/**
 * One screen of the check: the question and its inputs, for every item type. It shows no
 * feedback, ever: right and wrong appear only on the results page.
 *
 * Everything works from the keyboard and at phone width. Multiple choice and true/false are radio
 * groups (arrow keys move between options). Sorting and matching are drag and drop (Kyle, 2 Oct
 * 2026: "more of a drag-and-drop feature" than a select), through drag-board.tsx: drag with a mouse
 * or finger, or tap a card and then its slot, or Enter on a card and a number key. Ordering has
 * Move up / Move down buttons on every step.
 *
 * Option, chip and line order is shuffled from `seed` (the sitting's id plus the screen), so
 * a resumed sitting shows each question exactly as it did before.
 */

type QuestionProps = {
    item: BankItem;
    entry: PlanEntry;
    response: CheckResponse | undefined;
    onChange: (response: CheckResponse) => void;
    seed: string;
    bank: CheckBank;
    bySlug: Map<string, DictionaryEntry>;
    /** The pane's scroller, so a drag near its edge scrolls it. */
    scrollRef?: RefObject<HTMLDivElement | null>;
};

/* ── Shared parts ───────────────────────────────────────────────── */

const Prompt = ({ id, children }: { id: string; children: ReactNode }) => (
    <p id={id} className="max-w-[66ch] text-lg leading-relaxed text-pretty text-primary">
        {children}
    </p>
);

/**
 * A question's figures. When the first row starts with an empty cell it's a header row
 * ("This year / Last year"). Every row is shown, the ones you don't need included: picking
 * the right figures is part of the question.
 */
const FiguresTable = ({ table, labelledBy }: { table: BankTable; labelledBy: string }) => {
    const header = table[0]?.[0] === "" ? table[0] : null;
    const rows = header ? table.slice(1) : table;
    return (
        // Focusable, so a table wider than a phone can be scrolled from the keyboard too.
        <div
            tabIndex={0}
            role="region"
            aria-labelledby={labelledBy}
            className="overflow-x-auto rounded-xl ring-1 ring-secondary outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2"
        >
            <table aria-labelledby={labelledBy} className="w-full text-sm">
                {header && (
                    <thead className="bg-secondary">
                        <tr>
                            <td />
                            {header.slice(1).map((h, i) => (
                                <th key={i} scope="col" className="px-4 py-2.5 text-right font-semibold whitespace-nowrap text-secondary">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                )}
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className={cx(i > 0 && "border-t border-secondary")}>
                            <th scope="row" className="px-4 py-2.5 text-left font-normal text-secondary">
                                {row[0]}
                            </th>
                            {row.slice(1).map((cell, j) => (
                                <td key={j} className="px-4 py-2.5 text-right font-medium whitespace-nowrap text-primary tabular-nums">
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const UNIT_SPOKEN: Record<string, string> = { $: ", in dollars", "%": ", as a percentage" };

/** A number box. The unit sits beside it so nobody wonders whether 75% is "75" or "0.75". */
const NumberField = ({
    label,
    unit,
    value,
    onChange,
    hintId,
}: {
    label: string;
    unit: string;
    value: string;
    onChange: (v: string) => void;
    hintId: string;
}) => {
    const id = useId();
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-sm font-medium text-secondary">
                {label}
                <span className="sr-only">{UNIT_SPOKEN[unit] ?? ""}</span>
            </label>
            <div className="flex h-11 w-full max-w-64 items-center rounded-lg bg-primary shadow-xs ring-1 ring-primary transition duration-100 ease-linear ring-inset focus-within:ring-2 focus-within:ring-brand motion-reduce:transition-none">
                {unit === "$" && (
                    <span aria-hidden="true" className="pl-3.5 text-md text-tertiary">
                        $
                    </span>
                )}
                <input
                    id={id}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    spellCheck={false}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    aria-describedby={hintId}
                    className="h-full min-w-0 flex-1 bg-transparent px-3 text-md text-primary tabular-nums outline-none placeholder:text-placeholder"
                />
                {unit === "%" && (
                    <span aria-hidden="true" className="pr-3.5 text-md text-tertiary">
                        %
                    </span>
                )}
            </div>
        </div>
    );
};

const NumberHint = ({ id }: { id: string }) => (
    <p id={id} className="text-sm text-tertiary">
        Type the number. Commas, $ and % are fine.
    </p>
);

/** Options as a radio group: arrow keys move between them, and the chosen one shows its filled dot, not just a colour. */
const Options = ({
    labelledBy,
    options,
    value,
    onChange,
}: {
    labelledBy: string;
    options: { value: string; label: string }[];
    value: string | null;
    onChange: (v: string) => void;
}) => (
    <RadioGroup aria-labelledby={labelledBy} value={value} onChange={onChange} size="md" className="gap-2">
        {options.map((o) => (
            <RadioButton
                key={o.value}
                value={o.value}
                label={o.label}
                className={({ isSelected }) =>
                    cx(
                        "cursor-pointer rounded-xl px-4 py-3.5 transition duration-100 ease-linear motion-reduce:transition-none",
                        isSelected ? "bg-brand-primary_alt ring-2 ring-brand" : "bg-primary ring-1 ring-secondary hover:bg-primary_hover",
                    )
                }
            />
        ))}
    </RadioGroup>
);

/* ── Each type ──────────────────────────────────────────────────── */

const WordProblem = ({ item, entry, response, onChange }: QuestionProps) => {
    const promptId = useId();
    const hintId = useId();
    const alone = standaloneBlank(item, entry);
    const variant = findVariant(item, entry.variant) as WordProblemVariant;

    if (alone) {
        const value = response?.kind === "number" ? response.value : "";
        return (
            <>
                <Prompt id={promptId}>{standalonePrompt(alone)}</Prompt>
                <FiguresTable table={alone.variant.table} labelledBy={promptId} />
                <NumberField
                    label={alone.blank.label}
                    unit={alone.blank.unit}
                    value={value}
                    onChange={(v) => onChange({ kind: "number", value: v })}
                    hintId={hintId}
                />
                <NumberHint id={hintId} />
            </>
        );
    }

    const values = response?.kind === "numbers" ? response.values : {};
    return (
        <>
            <Prompt id={promptId}>{variant.prompt}</Prompt>
            <FiguresTable table={variant.table} labelledBy={promptId} />
            <div className="grid gap-4 sm:grid-cols-2">
                {variant.blanks.map((b) => (
                    <NumberField
                        key={b.id}
                        label={b.label}
                        unit={b.unit}
                        value={values[b.id] ?? ""}
                        onChange={(v) => onChange({ kind: "numbers", values: { ...values, [b.id]: v } })}
                        hintId={hintId}
                    />
                ))}
            </div>
            <NumberHint id={hintId} />
        </>
    );
};

const Numeric = ({ item, entry, response, onChange }: QuestionProps) => {
    const promptId = useId();
    const hintId = useId();
    const v = findVariant(item, entry.variant) as NumericVariant;
    return (
        <>
            <Prompt id={promptId}>{v.prompt}</Prompt>
            <FiguresTable table={v.table} labelledBy={promptId} />
            <NumberField
                label="Your answer"
                unit={v.unit}
                value={response?.kind === "number" ? response.value : ""}
                onChange={(x) => onChange({ kind: "number", value: x })}
                hintId={hintId}
            />
            <NumberHint id={hintId} />
        </>
    );
};

const Choice = ({ item, entry, response, onChange, seed, bySlug }: QuestionProps) => {
    const promptId = useId();
    const v = findVariant(item, entry.variant) as ChoiceVariant;
    const define = v.format === "define";
    // A reverse question's options are slugs; each shows as that entry's definition.
    const options = useMemo(
        () => shuffle(v.options, seededRandom(`${seed}:options`)).map((o) => ({ value: o, label: define ? (bySlug.get(o)?.gloss ?? o) : o })),
        [v, seed, define, bySlug],
    );
    const term = define ? bySlug.get((item as ChoiceItem).term)?.term : null;
    return (
        <>
            {define ? (
                <div id={promptId}>
                    <p className="text-sm font-semibold text-secondary">{v.prompt}</p>
                    <p className="mt-2 text-display-xs font-semibold text-pretty text-primary">{term}</p>
                </div>
            ) : (
                <Prompt id={promptId}>{v.prompt}</Prompt>
            )}
            <Options
                labelledBy={promptId}
                options={options}
                value={response?.kind === "choice" ? response.value : null}
                onChange={(x) => onChange({ kind: "choice", value: x })}
            />
        </>
    );
};

const TrueFalse = ({ item, entry, response, onChange }: QuestionProps) => {
    const promptId = useId();
    const v = findVariant(item, entry.variant) as TrueFalseVariant;
    return (
        <>
            <div id={promptId}>
                <p className="text-sm font-semibold text-secondary">True or false?</p>
                <blockquote className="mt-2 max-w-[66ch] rounded-xl bg-secondary px-4 py-3.5 text-lg leading-relaxed text-pretty text-primary ring-1 ring-secondary">
                    “{v.statement}”
                </blockquote>
            </div>
            <Options
                labelledBy={promptId}
                options={[
                    { value: "true", label: "True" },
                    { value: "false", label: "False" },
                ]}
                value={response?.kind === "bool" ? String(response.value) : null}
                onChange={(x) => onChange({ kind: "bool", value: x === "true" })}
            />
        </>
    );
};

/** The tray of cards still to place. Sticky at the bottom of the pane on a phone, so a card is always in reach while the slots scroll. */
const Tray = ({ board, title, empty, children, side = false }: { board: DragBoard; title: string; empty: boolean; children: ReactNode; side?: boolean }) => (
    <div
        {...board.dropProps(null)}
        onClick={board.backToTray}
        className={cx(
            "sticky bottom-0 z-10 -mx-1 rounded-xl bg-primary p-3 shadow-lg ring-1 ring-secondary",
            side && "sm:top-4 sm:bottom-auto sm:mx-0 sm:shadow-xs",
            targetClass({ carrying: !!board.picked, over: board.over === null }),
        )}
    >
        <p className="text-sm font-semibold text-secondary">{title}</p>
        {empty ? (
            <p className="mt-2 text-sm text-tertiary">All placed. Move any card to change it.</p>
        ) : (
            <ul className="mt-2 flex flex-wrap gap-2">{children}</ul>
        )}
    </div>
);

const Buckets = ({ item, entry, response, onChange, seed, scrollRef }: QuestionProps) => {
    const promptId = useId();
    const v = findVariant(item, entry.variant) as BucketsVariant;
    const chips = useMemo(() => shuffle(v.chips, seededRandom(`${seed}:chips`)), [v, seed]);
    const placed = response?.kind === "boxes" ? response.placed : {};
    const label = (term: string) => v.chips.find((c) => c.term === term)?.text ?? term;
    const board = useDragBoard({
        targets: v.boxes.map((b) => ({ id: b, label: b })),
        noun: "box",
        chipLabel: label,
        scrollRef,
        onMove: (term, to) => {
            const next = { ...placed };
            if (to === null) delete next[term];
            else next[term] = to;
            onChange({ kind: "boxes", placed: next });
            return { ok: true, message: to === null ? `${label(term)} is back with the cards.` : `${label(term)} is in ${to}.` };
        },
    });
    const inTray = chips.filter((c) => !placed[c.term]);

    return (
        <div {...board.rootProps} className="flex flex-col gap-5">
            <Prompt id={promptId}>{v.prompt}</Prompt>
            <p className="-mt-2 text-sm text-tertiary">Drag each card into its box, or tap a card and then a box.</p>
            <ol aria-labelledby={promptId} className="grid gap-3 sm:grid-cols-2">
                {v.boxes.map((box, i) => (
                    <li
                        key={box}
                        {...board.dropProps(box)}
                        onClick={() => board.placeInto(box)}
                        className={cx(
                            "flex flex-col gap-3 rounded-xl bg-secondary p-3 ring-1 ring-secondary",
                            targetClass({ carrying: !!board.picked, over: board.over === box }),
                        )}
                    >
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                board.placeInto(box);
                            }}
                            className="flex items-center gap-2 rounded-lg text-left outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                            <KeyBadge n={i + 1} />
                            <span className="text-md font-semibold text-primary">{box}</span>
                        </button>
                        <ul className="flex min-h-11 flex-col gap-2">
                            {chips
                                .filter((c) => placed[c.term] === box)
                                .map((c) => (
                                    <li key={c.term}>
                                        <button {...board.chipProps(c.term, box)} className={chipClass({ picked: board.picked === c.term, fill: true })}>
                                            {c.text}
                                        </button>
                                    </li>
                                ))}
                        </ul>
                    </li>
                ))}
            </ol>
            <Tray board={board} title="Cards" empty={!inTray.length}>
                {inTray.map((c) => (
                    <li key={c.term}>
                        <button {...board.chipProps(c.term, null)} className={chipClass({ picked: board.picked === c.term })}>
                            {c.text}
                        </button>
                    </li>
                ))}
            </Tray>
            <BoardAnnouncer message={board.message} />
        </div>
    );
};

/**
 * Each definition (version 1) or call line (version 2) is a card with one slot above it, and the
 * terms wait jumbled in the tray (Kyle, 2 Oct 2026). Every slot is the same size, so a slot's
 * width says nothing about which term fits it. A line's own term is blanked in both versions.
 * Dropping a term on a filled slot swaps the two, or sends the old one back to the tray.
 */
const Matching = ({ item, entry, response, onChange, seed, bySlug, scrollRef }: QuestionProps) => {
    const promptId = useId();
    const v = findVariant(item, entry.variant) as MatchingVariant;
    const terms = useMemo(() => (item.type === "matching" ? item.terms : []), [item]);
    const maskExtra = item.type === "matching" ? item.mask_extra : undefined;

    const lines = useMemo(
        () =>
            shuffle(terms, seededRandom(`${seed}:lines`)).map((slug) => ({ slug, text: matchingLine(bySlug.get(slug)!, v.match_on, maskExtra?.[slug] ?? []) })),
        [terms, v, seed, bySlug, maskExtra],
    );
    const words = useMemo(() => shuffle(terms, seededRandom(`${seed}:words`)), [terms, seed]);
    const chosen = response?.kind === "pairs" ? response.chosen : {};
    const name = (slug: string) => bySlug.get(slug)?.term ?? slug;
    const slotOf = (term: string) => Object.keys(chosen).find((line) => chosen[line] === term);

    const board = useDragBoard({
        targets: lines.map((l, i) => ({ id: l.slug, label: `slot ${i + 1}` })),
        noun: "slot",
        chipLabel: name,
        scrollRef,
        onMove: (term, to) => {
            const next = { ...chosen };
            const from = Object.keys(next).find((line) => next[line] === term);
            if (from) delete next[from];
            if (to !== null) {
                const occupant = next[to];
                if (occupant && from) next[from] = occupant;
                next[to] = term;
            }
            onChange({ kind: "pairs", chosen: next });
            const n = to === null ? 0 : lines.findIndex((l) => l.slug === to) + 1;
            return { ok: true, message: to === null ? `${name(term)} is back with the terms.` : `${name(term)} is in slot ${n}.` };
        },
    });
    const inTray = words.filter((t) => !slotOf(t));

    return (
        <div {...board.rootProps} className="flex flex-col gap-5">
            <Prompt id={promptId}>{v.prompt}</Prompt>
            <p className="-mt-2 text-sm text-tertiary">
                Drag each term into the slot above its {v.match_on === "usage" ? "line" : "definition"}, or tap a term and then a slot.
            </p>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_15rem] sm:items-start">
                <ol aria-labelledby={promptId} className="flex flex-col gap-2">
                    {lines.map((l, i) => {
                        const here = chosen[l.slug];
                        return (
                            <li
                                key={l.slug}
                                {...board.dropProps(l.slug)}
                                onClick={() => board.placeInto(l.slug)}
                                className={cx(
                                    "flex flex-col gap-3 rounded-xl bg-primary p-4 ring-1 ring-secondary",
                                    targetClass({ carrying: !!board.picked, over: board.over === l.slug }),
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <KeyBadge n={i + 1} />
                                    {/* Keyed apart, so the empty slot's button is never reused as the card's. */}
                                    {here ? (
                                        <button
                                            key={`card-${here}`}
                                            {...board.chipProps(here, l.slug)}
                                            className={chipClass({ picked: board.picked === here, fill: true })}
                                        >
                                            {name(here)}
                                        </button>
                                    ) : (
                                        <button
                                            key="empty"
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                board.placeInto(l.slug);
                                            }}
                                            aria-label={`Slot ${i + 1}, empty`}
                                            className="flex min-h-11 w-full items-center rounded-lg border-2 border-dashed border-primary px-3 text-sm text-quaternary outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2"
                                        >
                                            Empty
                                        </button>
                                    )}
                                </div>
                                <p className={cx("text-md text-pretty text-primary", v.match_on === "usage" && "italic")}>
                                    {v.match_on === "usage" ? `“${l.text}”` : l.text}
                                </p>
                            </li>
                        );
                    })}
                </ol>
                <Tray board={board} title="Terms" empty={!inTray.length} side>
                    {inTray.map((t) => (
                        <li key={t}>
                            <button {...board.chipProps(t, null)} className={chipClass({ picked: board.picked === t })}>
                                {name(t)}
                            </button>
                        </li>
                    ))}
                </Tray>
            </div>
            <BoardAnnouncer message={board.message} />
        </div>
    );
};

const MoveButton = ({
    icon: Icon,
    label,
    disabled,
    onClick,
    buttonRef,
}: {
    icon: FC<{ className?: string }>;
    label: string;
    disabled: boolean;
    onClick: () => void;
    buttonRef: (el: HTMLButtonElement | null) => void;
}) => (
    <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-fg-quaternary outline-focus-ring transition duration-100 ease-linear hover:bg-secondary hover:text-fg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none sm:size-9"
    >
        <Icon className="size-5" aria-hidden="true" />
    </button>
);

/**
 * Steps start shuffled (never already in order) and move one place at a time. Focus follows
 * the step that moved, and a screen reader hears where it landed. The answer counts once a
 * step has been moved.
 */
const Ordering = ({ item, entry, response, onChange, seed }: QuestionProps) => {
    const promptId = useId();
    const v = findVariant(item, entry.variant) as OrderingVariant;
    const start = useMemo(() => shuffledSteps(v.steps, seededRandom(`${seed}:steps`)), [v, seed]);
    const order = response?.kind === "order" && response.steps.length === v.steps.length ? response.steps : start;
    const buttons = useRef(new Map<string, HTMLButtonElement>());
    const [focusNext, setFocusNext] = useState<{ step: string; dir: "up" | "down" } | null>(null);
    const [announcement, setAnnouncement] = useState("");

    useEffect(() => {
        if (!focusNext) return;
        const i = order.indexOf(focusNext.step);
        // At the top or bottom the button just pressed is disabled, so focus its partner.
        const dir =
            (focusNext.dir === "up" && i === 0) || (focusNext.dir === "down" && i === order.length - 1)
                ? focusNext.dir === "up"
                    ? "down"
                    : "up"
                : focusNext.dir;
        buttons.current.get(`${focusNext.step}:${dir}`)?.focus();
        setFocusNext(null);
    }, [focusNext, order]);

    const move = (i: number, by: -1 | 1) => {
        const j = i + by;
        if (j < 0 || j >= order.length) return;
        const next = [...order];
        [next[i], next[j]] = [next[j], next[i]];
        onChange({ kind: "order", steps: next });
        setFocusNext({ step: order[i], dir: by < 0 ? "up" : "down" });
        setAnnouncement(`${order[i]}: now ${j + 1} of ${order.length}.`);
    };

    return (
        <>
            <Prompt id={promptId}>{v.prompt}</Prompt>
            <p className="-mt-2 text-sm text-tertiary">Use the arrows to move each step into place.</p>
            <ol aria-labelledby={promptId} className="flex flex-col gap-2">
                {order.map((step, i) => (
                    <li key={step} className="flex items-center gap-3 rounded-xl bg-primary py-1.5 pr-1.5 pl-4 ring-1 ring-secondary">
                        <span aria-hidden="true" className="w-5 shrink-0 text-sm font-semibold text-quaternary tabular-nums">
                            {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 py-2 text-md text-pretty text-primary">{step}</span>
                        <MoveButton
                            icon={ArrowUp}
                            label={`Move up: ${step}`}
                            disabled={i === 0}
                            onClick={() => move(i, -1)}
                            buttonRef={(el) => (el ? buttons.current.set(`${step}:up`, el) : buttons.current.delete(`${step}:up`))}
                        />
                        <MoveButton
                            icon={ArrowDown}
                            label={`Move down: ${step}`}
                            disabled={i === order.length - 1}
                            onClick={() => move(i, 1)}
                            buttonRef={(el) => (el ? buttons.current.set(`${step}:down`, el) : buttons.current.delete(`${step}:down`))}
                        />
                    </li>
                ))}
            </ol>
            <p role="status" className="sr-only">
                {announcement}
            </p>
        </>
    );
};

/* ── The screen ─────────────────────────────────────────────────── */

export const Question = (props: QuestionProps) => {
    const body = (() => {
        switch (props.item.type) {
            case "wordproblem":
                return <WordProblem {...props} />;
            case "numeric":
                return <Numeric {...props} />;
            case "mcq":
            case "scenario":
                return <Choice {...props} />;
            case "truefalse":
                return <TrueFalse {...props} />;
            case "buckets":
                return <Buckets {...props} />;
            case "matching":
                return <Matching {...props} />;
            case "ordering":
                return <Ordering {...props} />;
        }
    })();
    return <div className="flex flex-col gap-5">{body}</div>;
};
