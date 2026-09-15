import { Flag05 } from "@untitledui/icons";
import { cx } from "@/utils/cx";

/**
 * Question priority — HIGH / MEDIUM / LOW flag shared by every log page's
 * Questions section and the /questions inbox. Clicking cycles
 * none → High → Medium → Low → none, so no dropdown is needed.
 */
export type QuestionPriority = "high" | "medium" | "low";

const NEXT: Record<string, QuestionPriority | undefined> = { none: "high", high: "medium", medium: "low", low: undefined };
const LABEL: Record<QuestionPriority, string> = { high: "High", medium: "Medium", low: "Low" };
const STYLES: Record<QuestionPriority, string> = {
    high: "bg-utility-red-50 text-utility-red-700",
    medium: "bg-utility-yellow-50 text-utility-yellow-700",
    low: "bg-primary text-tertiary ring-1 ring-inset ring-secondary",
};

/** Sort key — high first, unset last. Use with a stable sort so equal-priority
    questions keep their original order. */
export const priorityRank = (p?: QuestionPriority) => (p === "high" ? 0 : p === "medium" ? 1 : p === "low" ? 2 : 3);

export const PriorityFlag = ({ value, onChange }: { value?: QuestionPriority; onChange: (v: QuestionPriority | undefined) => void }) => (
    <button
        type="button"
        title={value ? `Priority: ${LABEL[value]} — click to change` : "Set priority (High → Medium → Low)"}
        onClick={() => onChange(NEXT[value ?? "none"])}
        className={cx(
            "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold transition duration-100 ease-linear",
            value ? STYLES[value] : "text-quaternary hover:bg-secondary hover:text-secondary",
        )}
    >
        <Flag05 className="size-3" aria-hidden="true" />
        {value ? LABEL[value] : ""}
    </button>
);
