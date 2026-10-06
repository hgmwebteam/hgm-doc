import { type Random, shuffle } from "@/pages/team/dictionary/check/check-model";

/**
 * Sort the stack: the model behind the tools review game (/dictionary/tools/review, and the
 * no-sign-in copy at /acumen-sort). No React, so sort-model.check.ts can pin all of it against
 * the real card list. The tools training (/dictionary/tools/practice) is built from the vendor
 * icons' manifest (vendor-icons.ts) and takes only the boxes' wording from the card list.
 *
 * The card list is src/data/industry-acumen-sort-cards.json. Its wording is Kyle's and its
 * master is the Claude project file named in `source_of_copy`: edit there, then copy it in.
 * Rounds 1 and 2 ("vendors") are a tray of vendor cards and four boxes that each take exactly
 * `per_box` cards. Round 3 ("jobs") turns it round: one suite at a time is the only box, and
 * the tray is the suite's jobs mixed with any jobs it doesn't do.
 *
 * THE GATE: while any card or suite says `"verify": true`, nothing plays. The pages show what's
 * waiting and the check script fails (the brief: "Refuse to build if any card in the data has
 * verify: true"). There is no bypass, on purpose.
 */

/* ── The card list's stored shape ───────────────────────────────── */

export type SortBox = { id: string; name: string; job: string; term_slug?: string };

/** Where an entry's wording was checked. `verify: true` blocks the game until it has been. */
type Provenance = { sources: string[]; checked: string | null; verify?: boolean; verify_what?: string };

export type VendorCard = Provenance & { vendor: string; box: string; also: string[]; note: string };
export type VendorRound = { id: string; mode: "vendors"; title: string; term_slug?: string; per_box: number; boxes: SortBox[]; cards: VendorCard[] };

export type SortJob = { id: string; name: string };
export type Suite = Provenance & { vendor: string; does: string[]; distractors: string[]; note: string };
export type JobsRound = { id: string; mode: "jobs"; title: string; intro: string; jobs: SortJob[]; suites: Suite[] };

export type SortRound = VendorRound | JobsRound;

export type SortData = {
    title: string;
    version: string;
    source_of_copy: string;
    made_up_line: string;
    finish: string;
    rounds: SortRound[];
    /** Vendor names to print if the page can't be used on the day. The game doesn't read it. */
    fallback_cards?: string[];
};

/* ── Validation ─────────────────────────────────────────────────── */

/** The number keys place a picked-up card, and they stop at 9. */
const MAX_BOXES = 9;

/** A non-blank string. Shared with vendor-icons.ts, whose manifest also reaches the page by a cast. */
export const isText = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const listOf = (v: unknown): unknown[] | null => (Array.isArray(v) ? v : null);
const field = (v: unknown, key: string): unknown => (v && typeof v === "object" ? (v as Record<string, unknown>)[key] : undefined);
const quoted = (v: unknown) => `"${String(v)}"`;

/**
 * Everything wrong with a card list, as plain sentences; empty when it's fine to play. The
 * brief's build checks: every card's box is one of its round's boxes, every box holds exactly
 * `per_box` cards, every also names a real box, every suite has at least two jobs. The brief
 * also asked for two distractors a suite, but a suite may now have none: the 5 Oct vendor check
 * found Cloudbeds sells all eight jobs, so its tray is all right answers. It also catches what
 * would break the page (a missing name, a duplicate id, more boxes than number keys). Unchecked
 * cards (`verify: true`) are not a problem here: see `unverified`, which the pages and the check
 * script apply after this.
 *
 * The JSON reaches the page by a cast, so this trusts nothing about its shape.
 */
export const sortProblems = (data: SortData): string[] => {
    const problems: string[] = [];
    const say = (p: string) => problems.push(p);
    if (!data || typeof data !== "object") return ["The card list is empty."];
    if (!isText(data.title)) say("The card list has no title.");
    if (!isText(data.made_up_line)) say("The card list has no made_up_line.");
    if (!isText(data.finish)) say("The card list has no finish line.");
    const rounds = listOf(data.rounds);
    if (!rounds?.length) return [...problems, "The card list has no rounds."];

    // Box ids across every vendor round: an "also" may name a box from another round
    // (RateGain, in round 2, is also sold as a channel manager, a round 1 box).
    const allBoxes = new Set<string>();
    for (const round of rounds)
        if (field(round, "mode") === "vendors")
            for (const b of listOf(field(round, "boxes")) ?? []) if (isText(field(b, "id"))) allBoxes.add(field(b, "id") as string);

    const roundIds = new Set<string>();
    const vendorCards = new Map<string, string>(); // vendor → the round it's a card in

    rounds.forEach((round, i) => {
        const r = `Round ${i + 1}`;
        const id = field(round, "id");
        if (!isText(id)) say(`${r} has no id.`);
        else if (roundIds.has(id)) say(`${r} has the same id as an earlier round (${quoted(id)}).`);
        else roundIds.add(id);
        if (!isText(field(round, "title"))) say(`${r} has no title.`);
        const mode = field(round, "mode");

        if (mode === "vendors") {
            const perBox = field(round, "per_box");
            const per = typeof perBox === "number" && Number.isInteger(perBox) && perBox > 0 ? perBox : null;
            if (per === null) say(`${r}: per_box must be a whole number above 0.`);

            const boxes = listOf(field(round, "boxes")) ?? [];
            if (!boxes.length) say(`${r} has no boxes.`);
            if (boxes.length > MAX_BOXES) say(`${r} has ${boxes.length} boxes; the number keys only reach ${MAX_BOXES}.`);
            const here = new Map<string, number>(); // box id → cards in it
            const names = new Map<string, string>();
            boxes.forEach((box, j) => {
                const bid = field(box, "id");
                if (!isText(bid)) return say(`${r}: box ${j + 1} has no id.`);
                if (here.has(bid)) return say(`${r}: the box id ${quoted(bid)} is used twice.`);
                here.set(bid, 0);
                const name = field(box, "name");
                names.set(bid, isText(name) ? name : bid);
                if (!isText(name)) say(`${r}: the box ${quoted(bid)} has no name.`);
                if (!isText(field(box, "job"))) say(`${r}: the box ${quoted(bid)} has no job line.`);
            });
            for (const [j, other] of rounds.entries())
                if (j < i && field(other, "mode") === "vendors")
                    for (const b of listOf(field(other, "boxes")) ?? [])
                        if (here.has(field(b, "id") as string)) say(`${r}: the box id ${quoted(field(b, "id"))} is already a box in round ${j + 1}.`);

            const cards = listOf(field(round, "cards")) ?? [];
            if (!cards.length) say(`${r} has no cards.`);
            cards.forEach((card, k) => {
                const vendor = field(card, "vendor");
                if (!isText(vendor)) return say(`${r}: card ${k + 1} has no vendor.`);
                const seenIn = vendorCards.get(vendor);
                if (seenIn) say(seenIn === r ? `${r}: ${vendor} is a card twice.` : `${r}: ${vendor} is already a card in ${seenIn.toLowerCase()}.`);
                else vendorCards.set(vendor, r);

                const box = field(card, "box");
                if (!isText(box) || !here.has(box)) say(`${r}: ${vendor}'s box ${quoted(box)} isn't one of the round's boxes.`);
                else here.set(box, here.get(box)! + 1);

                const also = listOf(field(card, "also"));
                if (!also) say(`${r}: ${vendor}'s also must be a list (empty if it has none).`);
                else {
                    const seen = new Set<unknown>();
                    for (const a of also) {
                        if (seen.has(a)) say(`${r}: ${vendor}'s also names ${quoted(a)} twice.`);
                        seen.add(a);
                        if (a === box) say(`${r}: ${vendor}'s also repeats its own box.`);
                        else if (!isText(a) || !allBoxes.has(a)) say(`${r}: ${vendor}'s also names ${quoted(a)}, which isn't a box.`);
                    }
                }
                if (!isText(field(card, "note"))) say(`${r}: ${vendor} has no note.`);
                const verify = field(card, "verify");
                if (verify !== undefined && typeof verify !== "boolean") say(`${r}: ${vendor}'s verify must be true or false.`);
            });
            if (per !== null)
                for (const [bid, n] of here)
                    if (n !== per) say(`${r}: the box ${quoted(names.get(bid))} has ${n} ${n === 1 ? "card" : "cards"}; every box takes ${per}.`);
            return;
        }

        if (mode === "jobs") {
            if (!isText(field(round, "intro"))) say(`${r} has no intro.`);
            const jobs = listOf(field(round, "jobs")) ?? [];
            if (!jobs.length) say(`${r} has no jobs.`);
            const jobIds = new Set<string>();
            jobs.forEach((job, j) => {
                const jid = field(job, "id");
                if (!isText(jid)) return say(`${r}: job ${j + 1} has no id.`);
                if (jobIds.has(jid)) return say(`${r}: the job id ${quoted(jid)} is used twice.`);
                jobIds.add(jid);
                if (!isText(field(job, "name"))) say(`${r}: the job ${quoted(jid)} has no name.`);
            });

            const suites = listOf(field(round, "suites")) ?? [];
            if (!suites.length) say(`${r} has no suites.`);
            const suiteNames = new Set<string>();
            suites.forEach((suite, k) => {
                const vendor = field(suite, "vendor");
                if (!isText(vendor)) return say(`${r}: suite ${k + 1} has no vendor.`);
                if (suiteNames.has(vendor)) say(`${r}: ${vendor} is a suite twice.`);
                suiteNames.add(vendor);

                const does = listOf(field(suite, "does"));
                const distractors = listOf(field(suite, "distractors"));
                if (!does || does.length < 2) say(`${r}: ${vendor} needs at least two jobs in does.`);
                if (!distractors) say(`${r}: ${vendor}'s distractors must be a list (empty if it has none).`);
                const seen = new Set<unknown>();
                for (const id of [...(does ?? []), ...(distractors ?? [])]) {
                    if (seen.has(id))
                        say(
                            does?.includes(id) && distractors?.includes(id)
                                ? `${r}: ${vendor} has ${quoted(id)} in both does and distractors.`
                                : `${r}: ${vendor} names ${quoted(id)} twice.`,
                        );
                    seen.add(id);
                    if (!isText(id) || !jobIds.has(id)) say(`${r}: ${vendor} names ${quoted(id)}, which isn't one of the round's jobs.`);
                }
                if (!isText(field(suite, "note"))) say(`${r}: ${vendor} has no note.`);
                const verify = field(suite, "verify");
                if (verify !== undefined && typeof verify !== "boolean") say(`${r}: ${vendor}'s verify must be true or false.`);
            });
            return;
        }

        say(`${r} has mode ${quoted(mode)}; it must be "vendors" or "jobs".`);
    });

    return [...new Set(problems)];
};

/* ── The gate ───────────────────────────────────────────────────── */

/** A card or suite still marked `verify: true`: its box, note or jobs haven't been checked yet. */
export type Unverified = { vendor: string; round: number; roundTitle: string; what?: string };

/** Every entry still marked `verify: true`, in the card list's order. Nothing plays until this is empty. */
export const unverified = (data: SortData): Unverified[] =>
    data.rounds.flatMap((round, i) => {
        const entries: (VendorCard | Suite)[] = (round.mode === "vendors" ? round.cards : round.suites) ?? [];
        return entries
            .filter((e) => e.verify === true)
            .map((e) => ({ vendor: e.vendor, round: i + 1, roundTitle: round.title, ...(e.verify_what ? { what: e.verify_what } : {}) }));
    });

/* ── Rounds and boards ──────────────────────────────────────────── */

/**
 * One board: a vendor round, or one suite of a jobs round. The game walks through these in
 * order (round 1, round 2, then round 3 once per suite); "Next" is the next one.
 */
export type Stage =
    | { kind: "vendors"; round: VendorRound; roundIndex: number }
    | { kind: "jobs"; round: JobsRound; roundIndex: number; suite: Suite; suiteIndex: number };

export const gameStages = (data: SortData): Stage[] =>
    data.rounds.flatMap((round, roundIndex): Stage[] =>
        round.mode === "vendors"
            ? [{ kind: "vendors", round, roundIndex }]
            : round.suites.map((suite, suiteIndex) => ({ kind: "jobs", round, roundIndex, suite, suiteIndex })),
    );

/** Where a round starts, for the presenter's round tabs and for "Next" out of a round's answers. */
export const firstStageOf = (stages: readonly Stage[], roundIndex: number): number =>
    Math.max(
        0,
        stages.findIndex((s) => s.roundIndex === roundIndex),
    );

/** The one box of a jobs round. */
export const SUITE = "suite";

/** The cards a board deals: a vendor round's vendors, or a suite's jobs and distractors (job ids). */
export const stageCards = (stage: Stage): string[] =>
    stage.kind === "vendors" ? stage.round.cards.map((c) => c.vendor) : [...stage.suite.does, ...stage.suite.distractors];

/** A board's boxes, in key order: box 1 is the 1 key. */
export const stageBoxes = (stage: Stage): { id: string; label: string }[] =>
    stage.kind === "vendors" ? stage.round.boxes.map((b) => ({ id: b.id, label: b.name })) : [{ id: SUITE, label: stage.suite.vendor }];

/** How many cards a box takes: `per_box` in a vendor round. The suite takes any number. */
export const stageCapacity = (stage: Stage): number | null => (stage.kind === "vendors" ? stage.round.per_box : null);

/** What a card says: the vendor, or the job's name. */
export const cardLabel = (stage: Stage, id: string): string => (stage.kind === "vendors" ? id : (stage.round.jobs.find((j) => j.id === id)?.name ?? id));

/** Where every card is. A card in no box is in the tray. */
export type Board = {
    /** Every card, in the tray's shuffled order, so a card sent back returns to its own place. */
    order: string[];
    /** Each box's cards, in the order they went in. */
    boxes: Record<string, string[]>;
};

/** A fresh board: every card in the tray, shuffled (rounds 1 and 2 on load; each suite's jobs mixed with its distractors). */
export const newBoard = (stage: Stage, random: Random): Board => ({
    order: shuffle(stageCards(stage), random),
    boxes: Object.fromEntries(stageBoxes(stage).map((b) => [b.id, []])),
});

/** The box a card is in, or null when it's in the tray. */
export const placeOf = (board: Board, card: string): string | null => Object.keys(board.boxes).find((b) => board.boxes[b].includes(card)) ?? null;

export const trayCards = (board: Board): string[] => board.order.filter((c) => placeOf(board, c) === null);

export type MoveOutcome = "placed" | "tray" | "same" | "full" | "unknown";

/**
 * Moves a card into a box (`to`, a box id) or back to the tray (`to` null). A box already
 * holding `capacity` cards refuses ("full"), so no box ever takes a fourth card.
 */
export const moveCard = (board: Board, card: string, to: string | null, capacity: number | null): { board: Board; outcome: MoveOutcome } => {
    if (!board.order.includes(card) || (to !== null && !Array.isArray(board.boxes[to]))) return { board, outcome: "unknown" };
    const from = placeOf(board, card);
    if (from === to) return { board, outcome: "same" };
    if (to !== null && capacity !== null && board.boxes[to].length >= capacity) return { board, outcome: "full" };
    const boxes = { ...board.boxes };
    if (from !== null) boxes[from] = boxes[from].filter((c) => c !== card);
    if (to !== null) boxes[to] = [...boxes[to], card];
    return { board: { ...board, boxes }, outcome: to === null ? "tray" : "placed" };
};

/** "Check my stack" wakes up once every card is placed (vendor rounds), or once one job is in the suite. */
export const canCheck = (stage: Stage, board: Board): boolean =>
    stage.kind === "vendors" ? trayCards(board).length === 0 : (board.boxes[SUITE]?.length ?? 0) > 0;

/* ── Marking ────────────────────────────────────────────────────── */

/** `also`: right because the vendor is sold as more than one thing and sits in one of its also boxes. */
export type Mark = { right: boolean; also: boolean };

/** The line under a card that's right by its also. The brief's words, verbatim. */
export const ALSO_RIGHT = "also right: it's sold as more than one of these";

export const markVendor = (card: VendorCard, at: string | null): Mark => {
    if (at === card.box) return { right: true, also: false };
    if (at !== null && card.also.includes(at)) return { right: true, also: true };
    return { right: false, also: false };
};

/** A job is right in the suite when the suite does it, and right left in the tray when it doesn't. */
export const markJob = (suite: Suite, job: string, inSuite: boolean): Mark => ({ right: suite.does.includes(job) === inSuite, also: false });

/**
 * What a marked job says about the suite, after its "Right" or "Wrong". On a job left out, the mark
 * alone reads backwards: "CRM ✓ Right" looked like "SiteMinder does CRM" (Kyle, 6 Oct 2026). So a job
 * left out, or wrongly put in, says outright whether the suite does it. A job rightly in the suite
 * needs nothing more: "".
 */
export const jobFact = (suite: Suite, job: string, inSuite: boolean): string => {
    const does = suite.does.includes(job);
    if (inSuite && does) return "";
    return does ? `${suite.vendor} does this` : `${suite.vendor} doesn't do this`;
};

/** Every card on a checked board, tray included, marked right or wrong. */
export const markBoard = (stage: Stage, board: Board): Map<string, Mark> => {
    if (stage.kind === "vendors") return new Map(stage.round.cards.map((c) => [c.vendor, markVendor(c, placeOf(board, c.vendor))]));
    const inSuite = new Set(board.boxes[SUITE] ?? []);
    return new Map(stageCards(stage).map((job) => [job, markJob(stage.suite, job, inSuite.has(job))]));
};

export type Tally = { right: number; total: number };

export const tally = (marks: ReadonlyMap<string, Mark>): Tally => ({ right: [...marks.values()].filter((m) => m.right).length, total: marks.size });

/* ── The page's figures ─────────────────────────────────────────── */

/** "Round 1 of 3". */
export const roundLine = (stage: Stage, rounds: number) => `Round ${stage.roundIndex + 1} of ${rounds}`;

/** "Suite 1 of 3", for round 3's three boards. */
export const suiteLine = (stage: Extract<Stage, { kind: "jobs" }>) => `Suite ${stage.suiteIndex + 1} of ${stage.round.suites.length}`;

/** Under a vendor box: "2 of 3". */
export const boxCountLine = (n: number, perBox: number) => `${n} of ${perBox}`;

/** In the suite: "2 jobs", never out of how many, so the count gives nothing away. */
export const jobsLine = (n: number) => `${n} ${n === 1 ? "job" : "jobs"}`;

/** The round's tally: "10 of 12". Shown on the device only; nothing is kept across rounds. */
export const tallyLine = ({ right, total }: Tally) => `${right} of ${total}`;

/** The refusal when a box is full. */
export const fullLine = (box: string, capacity: number) => `${box} already has ${capacity} cards. Move one out first.`;

/** Under a checked suite: "Does: PMS, Channel manager, Booking engine, Guest messaging". */
export const doesLine = (jobs: readonly SortJob[]) => `Does: ${jobs.map((j) => j.name).join(", ")}`;
