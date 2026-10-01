import { type FC, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown } from "@untitledui/icons";
import { RadioButton, RadioGroup } from "@/components/base/radio-buttons/radio-buttons";
import {
    type BankItem,
    type BankTable,
    type BucketsVariant,
    type CheckBank,
    type CheckResponse,
    type ChoiceVariant,
    type MatchingVariant,
    type NumericVariant,
    type OrderingVariant,
    type PlanEntry,
    type TrueFalseVariant,
    type WordProblemVariant,
    findVariant,
    maskText,
    maskWords,
    seededRandom,
    shuffle,
    shuffledSteps,
    standaloneBlank,
    standalonePrompt,
} from "@/pages/team/dictionary/check/check-model";
import { type DictionaryEntry, byTerm } from "@/pages/team/dictionary/dictionary-model";
import { cx } from "@/utils/cx";

/**
 * One screen of the check: the question and its inputs, for every item type. It shows no
 * feedback, ever: right and wrong appear only on the results page.
 *
 * Everything works from the keyboard and at phone width. Nothing drags: multiple choice and
 * true/false are radio groups (arrow keys move between options), sorting and matching are one
 * native select per row, and ordering has Move up / Move down buttons on every step.
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

/** A native select styled like the portal's inputs: the most dependable choice for keyboard, phone and screen reader alike. */
const PickSelect = ({
    labelledBy,
    placeholder,
    options,
    value,
    onChange,
}: {
    labelledBy: string;
    placeholder: string;
    options: { value: string; label: string }[];
    value: string | undefined;
    onChange: (v: string) => void;
}) => (
    <div className="relative grid w-full shrink-0 sm:w-64">
        <select
            aria-labelledby={labelledBy}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={cx(
                "h-11 w-full appearance-none truncate rounded-lg bg-primary pr-9 pl-3 text-md font-medium shadow-xs ring-1 ring-primary outline-hidden transition duration-100 ease-linear ring-inset focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none",
                value ? "text-primary" : "text-placeholder",
            )}
        >
            <option value="">{placeholder}</option>
            {options.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-quaternary" />
    </div>
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

const Choice = ({ item, entry, response, onChange, seed }: QuestionProps) => {
    const promptId = useId();
    const v = findVariant(item, entry.variant) as ChoiceVariant;
    const options = useMemo(() => shuffle(v.options, seededRandom(`${seed}:options`)).map((o) => ({ value: o, label: o })), [v, seed]);
    return (
        <>
            <Prompt id={promptId}>{v.prompt}</Prompt>
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

const Buckets = ({ item, entry, response, onChange, seed }: QuestionProps) => {
    const promptId = useId();
    const rowId = useId();
    const v = findVariant(item, entry.variant) as BucketsVariant;
    const chips = useMemo(() => shuffle(v.chips, seededRandom(`${seed}:chips`)), [v, seed]);
    const placed = response?.kind === "boxes" ? response.placed : {};
    const boxes = v.boxes.map((b) => ({ value: b, label: b }));
    return (
        <>
            <Prompt id={promptId}>{v.prompt}</Prompt>
            <ul aria-labelledby={promptId} className="flex flex-col gap-2">
                {chips.map((c, i) => (
                    <li
                        key={c.term}
                        className="flex flex-col gap-3 rounded-xl bg-primary p-4 ring-1 ring-secondary sm:flex-row sm:items-center sm:justify-between"
                    >
                        <span id={`${rowId}-${i}`} className="min-w-0 text-md text-pretty text-primary">
                            {c.text}
                        </span>
                        <PickSelect
                            labelledBy={`${rowId}-${i}`}
                            placeholder="Put in…"
                            options={boxes}
                            value={placed[c.term]}
                            onChange={(box) => onChange({ kind: "boxes", placed: { ...placed, [c.term]: box } })}
                        />
                    </li>
                ))}
            </ul>
        </>
    );
};

/**
 * Each line belongs to one term: its definition (version 1) or its call line with the term
 * blanked (version 2, by the bank's masking rule). Each row picks the term it describes.
 */
const Matching = ({ item, entry, response, onChange, seed, bySlug }: QuestionProps) => {
    const promptId = useId();
    const rowId = useId();
    const v = findVariant(item, entry.variant) as MatchingVariant;
    const terms = item.type === "matching" ? item.terms : [];
    const maskExtra = item.type === "matching" ? item.mask_extra : undefined;

    const lines = useMemo(
        () =>
            shuffle(terms, seededRandom(`${seed}:lines`)).map((slug) => {
                const e = bySlug.get(slug)!;
                const text = v.match_on === "usage" ? `“${maskText(e.usage ?? "", maskWords(e, maskExtra?.[slug] ?? []))}”` : e.gloss;
                return { slug, text };
            }),
        [terms, v, seed, bySlug, maskExtra],
    );
    const choices = useMemo(
        () =>
            terms
                .map((s) => bySlug.get(s)!)
                .sort(byTerm)
                .map((e) => ({ value: e.slug, label: e.term })),
        [terms, bySlug],
    );
    const chosen = response?.kind === "pairs" ? response.chosen : {};

    return (
        <>
            <Prompt id={promptId}>{v.prompt}</Prompt>
            <ul aria-labelledby={promptId} className="flex flex-col gap-2">
                {lines.map((l, i) => (
                    <li
                        key={l.slug}
                        className="flex flex-col gap-3 rounded-xl bg-primary p-4 ring-1 ring-secondary sm:flex-row sm:items-center sm:justify-between"
                    >
                        <span id={`${rowId}-${i}`} className={cx("min-w-0 text-md text-pretty text-primary", v.match_on === "usage" && "italic")}>
                            {l.text}
                        </span>
                        <PickSelect
                            labelledBy={`${rowId}-${i}`}
                            placeholder="Choose a term"
                            options={choices}
                            value={chosen[l.slug]}
                            onChange={(slug) => onChange({ kind: "pairs", chosen: { ...chosen, [l.slug]: slug } })}
                        />
                    </li>
                ))}
            </ul>
        </>
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
