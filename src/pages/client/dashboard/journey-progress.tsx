import type { CSSProperties, FC } from "react";
import { Check, Rocket01 } from "@untitledui/icons";
import { BadgeWithDot } from "@/components/base/badges/badges";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { cx } from "@/utils/cx";

/**
 * Where one step stands, in the four words a client reads in the key:
 *  - `done`     — finished.
 *  - `progress` — "We're on it": ours to build, being built.
 *  - `waiting`  — "Needs your input": the client is the one holding it.
 *  - `todo`     — "Coming up".
 */
export type JourneyStatus = "done" | "progress" | "waiting" | "todo";

/** One pill: a journey step, or one piece of a step ticked piece by piece. */
export interface JourneyPill {
    id: string;
    /** Short name shown on the pill. */
    label: string;
    /** Full name, for the tooltip and screen readers. */
    name: string;
    status: JourneyStatus;
}

/** A named stage — one chevron — and the pills under it. */
export interface JourneyPhase {
    id: string;
    label: string;
    /** "Week 1", counted from the Kick-off Call. */
    week: string;
    pills: JourneyPill[];
}

const STATUS_LABEL: Record<JourneyStatus, string> = {
    done: "Done",
    progress: "We're on it",
    waiting: "Needs your input",
    todo: "Coming up",
};

/**
 * The launch meter under "Your journey".
 *
 * One chevron per stage, pointing at a rocket, with a pill per step underneath. The
 * chevrons answer "how far along am I"; the pills answer "and what is holding it up", which
 * is the question a client opening the Overview actually has. Yellow is reserved for the
 * client's own steps — one glance says whether the next move is theirs or ours.
 *
 * Every pill carries its OWN state rather than the meter filling left to right: these steps
 * don't have to be done in order, and a run of colour up to the sixth pill would tell a
 * client who skipped their form that the second was finished.
 *
 * The rocket is the destination, the Marketing Launch step. It lights up only when an AM
 * ticks that step, so nothing here writes to `content.journey_done`.
 */
export const JourneyProgress: FC<{
    /** The stages with a chevron, in order. */
    phases: JourneyPhase[];
    /** The launch step is ticked — the rocket lights and the header says so. */
    launched: boolean;
    /** The launch phase's estimate, shown once every pill is done but the rocket isn't. */
    launchWeek?: string;
}> = ({ phases, launched, launchWeek }) => {
    const pills = phases.flatMap((phase) => phase.pills);
    const total = pills.length;
    const done = pills.filter((pill) => pill.status === "done").length;
    const percent = total ? Math.round((done / total) * 100) : 0;

    const isComplete = (phase: JourneyPhase) => phase.pills.every((pill) => pill.status === "done");
    const now = phases.find((phase) => !isComplete(phase)) ?? null;
    const live = launched && !now;

    /** Pills are numbered across the whole journey, so "step 9" means the same thing everywhere. */
    let n = 0;

    return (
        <div className="@container mt-5 rounded-2xl bg-primary p-4 ring-1 ring-secondary md:p-6">
            <div
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progress to launch"
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
            >
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-md font-semibold text-primary">
                    <span className="journey-figure text-display-xs font-bold tabular-nums">{percent}%</span>
                    {live ? "You're live!" : now ? "of the way to launch" : "Ready for launch"}
                    {live && (
                        <BadgeWithDot color="success" type="pill-color" size="sm">
                            Live
                        </BadgeWithDot>
                    )}
                </p>
                <p className="text-sm text-tertiary">
                    <span className="font-semibold text-primary tabular-nums">
                        {done} of {total}
                    </span>{" "}
                    steps done ·{" "}
                    {live ? (
                        "All phases complete"
                    ) : now ? (
                        <>
                            Now: <span className="font-semibold text-primary">{now.label}</span> · {now.week}
                        </>
                    ) : (
                        <>
                            Now: <span className="font-semibold text-primary">Launch</span>
                            {launchWeek ? ` · ${launchWeek}` : null}
                        </>
                    )}
                </p>
            </div>

            <div className="mt-5 flex flex-col gap-4 @3xl:flex-row @3xl:gap-1.5">
                <ol className="flex min-w-0 flex-1 list-none flex-col gap-4 p-0 @3xl:flex-row @3xl:gap-1.5">
                    {phases.map((phase, i) => {
                        const complete = isComplete(phase);
                        const current = phase === now;
                        const phaseDone = phase.pills.filter((pill) => pill.status === "done").length;
                        return (
                            <li
                                key={phase.id}
                                className="grid min-w-0 content-start gap-3 @3xl:gap-3.5"
                                // A stage's width follows its step count, so the long Marketing
                                // funnel gets room for its pills; floored at four so a two-step
                                // stage's name and count still fit inside its chevron.
                                style={{ flex: `${Math.max(phase.pills.length, 4)} 1 0` } as CSSProperties}
                            >
                                <div
                                    className={cx(
                                        "journey-chevron flex h-14 items-center px-5",
                                        i === 0 && "journey-chevron-first",
                                        complete ? "journey-chevron-done" : current ? "journey-chevron-now" : "journey-chevron-todo",
                                    )}
                                >
                                    <span className="min-w-0 truncate">
                                        <span className="block truncate text-sm font-bold">{phase.label}</span>
                                        <span className="block truncate text-xs font-medium opacity-80">
                                            {phase.week} · {complete ? "✓ Done" : `${phaseDone} of ${phase.pills.length}`}
                                        </span>
                                    </span>
                                </div>
                                <ul className={cx("flex list-none flex-wrap gap-1.5 p-0", i > 0 && "@3xl:pl-4")}>
                                    {phase.pills.map((pill) => {
                                        n += 1;
                                        return (
                                            <li
                                                key={pill.id}
                                                title={`Step ${n}: ${pill.name} — ${STATUS_LABEL[pill.status]}`}
                                                className={cx("journey-pill", `journey-pill-${pill.status}`)}
                                            >
                                                <span aria-hidden="true" className="journey-pill-mark">
                                                    {pill.status === "done" ? (
                                                        <Check className="size-2.5" strokeWidth={3} />
                                                    ) : pill.status === "waiting" ? (
                                                        "!"
                                                    ) : (
                                                        n
                                                    )}
                                                </span>
                                                {pill.label}
                                                <span className="sr-only"> — {STATUS_LABEL[pill.status]}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </li>
                        );
                    })}
                </ol>

                <div className="flex shrink-0 items-center gap-3 @3xl:items-start @3xl:px-1">
                    <span
                        role="img"
                        aria-label={live ? "Live" : "Not live yet"}
                        className={cx(
                            "journey-rocket grid size-14 place-items-center rounded-full",
                            live ? "journey-rocket-on" : !now ? "journey-rocket-ready" : "journey-rocket-off",
                        )}
                    >
                        <Rocket01 aria-hidden="true" className="size-6" />
                    </span>
                    <span className="text-xs font-semibold tracking-wide text-tertiary uppercase @3xl:hidden">{live ? "Live" : "Launch"}</span>
                </div>
            </div>

            <div aria-hidden="true" className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-tertiary">
                {(Object.keys(STATUS_LABEL) as JourneyStatus[]).map((status) => (
                    <span key={status} className="inline-flex items-center gap-1.5">
                        <i className={cx("journey-key size-2.5 rounded-[3px]", `journey-key-${status}`)} />
                        {STATUS_LABEL[status]}
                    </span>
                ))}
            </div>
        </div>
    );
};

/**
 * The AM's status picker for one unfinished step or piece, shown in edit mode only.
 *
 * "Auto" leaves the meter to work the status out from real state (the step the client is
 * on, a revealed section, a started form). The other two pin it — for what the dashboard
 * can't see: a review we're still building before it's revealed, or something we're
 * waiting on the client for over chat. Done is not offered here: that stays the existing
 * tick, so there is still one way to finish a step.
 */
export const JourneyMarkPicker: FC<{
    /** What the step is called, for the group's accessible name. */
    name: string;
    value: "waiting" | "progress" | null;
    onChange: (value: "waiting" | "progress" | null) => void;
}> = ({ name, value, onChange }) => (
    <ButtonGroup
        size="sm"
        aria-label={`Status of ${name}`}
        disallowEmptySelection
        selectedKeys={[value ?? "auto"]}
        onSelectionChange={(keys) => {
            const next = [...keys][0];
            onChange(next === "waiting" || next === "progress" ? next : null);
        }}
    >
        <ButtonGroupItem id="auto" iconLeading={value === null ? Check : undefined}>
            Auto
        </ButtonGroupItem>
        <ButtonGroupItem id="waiting" iconLeading={value === "waiting" ? Check : undefined}>
            Needs client input
        </ButtonGroupItem>
        <ButtonGroupItem id="progress" iconLeading={value === "progress" ? Check : undefined}>
            In progress
        </ButtonGroupItem>
    </ButtonGroup>
);
