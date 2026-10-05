/**
 * Self-check for sort-model.ts and the card list behind Sort the stack (/dictionary/tools/review
 * and /acumen-sort) and the tools flashcards (/dictionary/tools/practice). It is the brief's
 * check-cards.js, in the repo's .check.ts convention.
 *
 * Run it from the repo root after changing the card list or the model:
 *   npx esbuild src/pages/team/dictionary/tools/sort-model.check.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --outfile=/tmp/hgm-check/sort-model.cjs \
 *     --log-level=warning && node /tmp/hgm-check/sort-model.cjs
 *
 * In order: the real card list's shape (the brief's build checks: every card's box is a real box,
 * every vendor box holds exactly three cards, every also names a real box, every suite has at least
 * two jobs and two distractors; plus every checked card says when); then the game's rules (the
 * full box, the also line, round 3's tray marks, the tally) and the flashcards, on a copy of the
 * list with verify switched off; and LAST the gate. While any card or suite still says
 * "verify": true it FAILS and lists them, as the brief asks. Everything before the gate reports
 * first, so a failure there is about the gate alone.
 *
 * The rules are pinned by role (the first card of the first box, the first suite…), never by a
 * vendor's name, so correcting the card list doesn't break them. Where a rule needs a card with,
 * or without, an also, the copy sets one.
 */
import assert from "node:assert";
import cardsJson from "@/data/industry-acumen-sort-cards.json";
import { seededRandom } from "@/pages/team/dictionary/check/check-model";
import {
    ALSO_RIGHT,
    type Board,
    type JobsRound,
    SUITE,
    type SortData,
    type Stage,
    type Suite,
    type VendorCard,
    type VendorRound,
    alsoLine,
    boxCountLine,
    canCheck,
    cardLabel,
    doesLine,
    firstStageOf,
    fullLine,
    gameStages,
    jobsLine,
    markBoard,
    markJob,
    markVendor,
    moveCard,
    newBoard,
    placeOf,
    practiceCards,
    practiceClue,
    roundLine,
    sortProblems,
    stageBoxes,
    stageCapacity,
    stageCards,
    suiteLine,
    tally,
    tallyLine,
    trayCards,
    unverified,
} from "@/pages/team/dictionary/tools/sort-model";

const real = cardsJson as unknown as SortData;
const pass = (what: string) => console.log(`  ok  ${what}`);
const section = (name: string) => console.log(`\n${name}`);
const vendorRounds = (d: SortData) => d.rounds.filter((r): r is VendorRound => r.mode === "vendors");
const jobsRounds = (d: SortData) => d.rounds.filter((r): r is JobsRound => r.mode === "jobs");
const entriesOf = (d: SortData) => d.rounds.flatMap((r): (VendorCard | Suite)[] => (r.mode === "vendors" ? r.cards : r.suites));
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

console.log(`${real.title} · ${real.version} · ${real.rounds.length} rounds`);

/* ── 1. The real card list ──────────────────────────────────────── */

section("The card list (src/data/industry-acumen-sort-cards.json)");
{
    const problems = sortProblems(real);
    for (const p of problems) console.log(`  ✗ ${p}`);
    assert.deepEqual(problems, [], "the card list has problems (listed above)");
    pass("sortProblems finds nothing");

    assert.deepEqual(
        real.rounds.map((r) => r.mode),
        ["vendors", "vendors", "jobs"],
        "the brief's three rounds: two vendor rounds, then the jobs round",
    );
    for (const round of vendorRounds(real)) {
        assert.equal(round.per_box, 3, `${round.id}: every box takes exactly three cards`);
        assert.equal(round.boxes.length, 4, `${round.id}: four boxes`);
        assert.equal(round.cards.length, 12, `${round.id}: twelve cards`);
        for (const box of round.boxes) assert.equal(round.cards.filter((c) => c.box === box.id).length, 3, `${round.id}: ${box.name} has three cards`);
    }
    pass("rounds 1 and 2: four boxes, twelve cards, exactly three in every box");

    const allBoxIds = new Set(vendorRounds(real).flatMap((r) => r.boxes.map((b) => b.id)));
    for (const r of vendorRounds(real)) for (const c of r.cards) for (const a of c.also) assert.ok(allBoxIds.has(a), `${c.vendor}'s also ${a} is a box`);
    pass("every also names a real box");

    for (const r of jobsRounds(real)) {
        assert.ok(r.suites.length > 0, `${r.id} has suites`);
        for (const s of r.suites) {
            assert.ok(s.does.length >= 2, `${s.vendor} does at least two jobs`);
            assert.ok(s.distractors.length >= 2, `${s.vendor} has at least two distractors`);
        }
    }
    pass("round 3: every suite has at least two jobs and two distractors");

    // The brief: "set verify to false and fill in checked". So a card that isn't waiting on
    // verify must carry its checked date: the gate can't be opened by flipping the flag alone.
    for (const e of entriesOf(real)) {
        if (e.verify === true) continue;
        assert.match(String(e.checked), /^\d{4}-\d{2}-\d{2}$/, `${e.vendor} isn't marked verify, so it needs its checked date (YYYY-MM-DD)`);
        if (!e.sources?.length) console.log(`  note ${e.vendor} is checked but lists no sources`);
    }
    pass("every card not waiting on verify has a checked date");

    const vendorsInList = new Set(entriesOf(real).map((e) => e.vendor));
    for (const v of real.fallback_cards ?? []) assert.ok(vendorsInList.has(v), `fallback card ${v} is a card or suite`);
    pass(`all ${real.fallback_cards?.length ?? 0} fallback cards name a card or a suite`);
}

/* ── 2. Broken lists are caught, in plain words ─────────────────── */

section("What sortProblems catches");
{
    const broken = (edit: (d: SortData) => void) => {
        const copy = structuredClone(real);
        edit(copy);
        return sortProblems(copy);
    };
    const r1 = (d: SortData) => d.rounds[0] as VendorRound;
    const jobsAt = real.rounds.findIndex((r) => r.mode === "jobs");
    const r3 = (d: SortData) => d.rounds[jobsAt] as JobsRound;
    const R = `Round ${jobsAt + 1}`;
    const [first, second] = r1(real).cards;
    const firstBox = r1(real).boxes.find((b) => b.id === first.box)!;
    const lastSuite = r3(real).suites[r3(real).suites.length - 1];
    const firstSuite = r3(real).suites[0];

    assert.deepEqual(
        broken((d) => (r1(d).cards[0].box = "front-desk")),
        [`Round 1: ${first.vendor}'s box "front-desk" isn't one of the round's boxes.`, `Round 1: the box "${firstBox.name}" has 2 cards; every box takes 3.`],
    );
    pass("a card whose box doesn't exist, and the box it leaves short");

    assert.deepEqual(
        broken((d) => (r1(d).cards[0].also = ["spa"])),
        [`Round 1: ${first.vendor}'s also names "spa", which isn't a box.`],
    );
    assert.deepEqual(
        broken((d) => (r1(d).cards[0].also = [first.box])),
        [`Round 1: ${first.vendor}'s also repeats its own box.`],
    );
    pass("an also that isn't a box, or repeats the card's own box");

    assert.deepEqual(
        broken((d) => r1(d).cards.push({ ...first, vendor: "A fourth vendor" })),
        [`Round 1: the box "${firstBox.name}" has 4 cards; every box takes 3.`],
    );
    pass("a box with a fourth card");

    assert.deepEqual(
        broken((d) => (r3(d).suites[r3(d).suites.length - 1].distractors = [lastSuite.distractors[0]])),
        [`${R}: ${lastSuite.vendor} needs at least two distractors.`],
    );
    assert.deepEqual(
        broken((d) => r3(d).suites[r3(d).suites.length - 1].distractors.push(lastSuite.does[0])),
        [`${R}: ${lastSuite.vendor} has "${lastSuite.does[0]}" in both does and distractors.`],
    );
    assert.deepEqual(
        broken((d) => (r3(d).suites[0].does = [firstSuite.does[0], "spa"])),
        [`${R}: ${firstSuite.vendor} names "spa", which isn't one of the round's jobs.`],
    );
    pass("a suite short of distractors, a job on both sides, a job that doesn't exist");

    assert.deepEqual(
        broken((d) => ((r1(d).cards[1] as { verify?: unknown }).verify = "yes")),
        [`Round 1: ${second.vendor}'s verify must be true or false.`],
    );
    assert.deepEqual(
        broken((d) =>
            r1(d).boxes.push(...Array.from({ length: 10 - r1(d).boxes.length }, (_, i) => ({ id: `extra-${i}`, name: `Extra ${i}`, job: "An extra box" }))),
        ).slice(0, 1),
        ["Round 1 has 10 boxes; the number keys only reach 9."],
    );
    assert.deepEqual(sortProblems({ ...real, rounds: [] }), ["The card list has no rounds."]);
    pass("a verify that isn't true or false, too many boxes for the number keys, no rounds");
}

/* ── 3. The rules, on a copy of the list with verify switched off ─ */

// The real list is blocked by its verify flags, so the rules are pinned on a copy with every flag
// switched off. Where a rule needs a card with (or without) an also, the copy sets it below.
const fixture = structuredClone(real);
for (const e of entriesOf(fixture)) delete e.verify;
const random = seededRandom("sort-model.check");

section("The rounds (a copy of the list with verify switched off)");
const stages = gameStages(fixture);
const V1 = fixture.rounds[0] as VendorRound;
const J = jobsRounds(fixture)[0];
const jIndex = fixture.rounds.indexOf(J);
{
    assert.deepEqual(sortProblems(fixture), []);
    assert.deepEqual(unverified(fixture), [], "the copy has nothing waiting");
    assert.deepEqual(
        stages.map((s) => (s.kind === "vendors" ? s.round.id : `${s.round.id}:${s.suite.vendor}`)),
        fixture.rounds.flatMap((r) => (r.mode === "vendors" ? [r.id] : r.suites.map((s) => `${r.id}:${s.vendor}`))),
        "one board per vendor round, then one per suite, in the list's order",
    );
    for (const [i] of fixture.rounds.entries()) assert.equal(stages[firstStageOf(stages, i)].roundIndex, i, `the Round ${i + 1} tab opens round ${i + 1}`);
    assert.equal(
        firstStageOf(stages, jIndex),
        stages.findIndex((s) => s.kind === "jobs"),
        "the jobs round's tab opens on its first suite",
    );
    assert.equal(roundLine(stages[0], fixture.rounds.length), "Round 1 of 3");
    assert.equal(roundLine(stages[stages.length - 1], fixture.rounds.length), "Round 3 of 3");
    const secondSuite = stages[firstStageOf(stages, jIndex) + 1];
    assert.ok(secondSuite.kind === "jobs");
    assert.equal(suiteLine(secondSuite), `Suite 2 of ${J.suites.length}`);
    pass("Round 1 of 3 … Round 3 of 3; the suites as Suite 1, 2 … of n");

    assert.deepEqual(
        stageBoxes(stages[0]).map((b) => b.label),
        V1.boxes.map((b) => b.name),
        "box n is the n key",
    );
    const suiteStage = stages[firstStageOf(stages, jIndex)];
    assert.ok(suiteStage.kind === "jobs");
    assert.deepEqual(stageBoxes(suiteStage), [{ id: SUITE, label: suiteStage.suite.vendor }], "a suite is round 3's only box");
    assert.equal(stageCapacity(stages[0]), 3);
    assert.equal(stageCapacity(suiteStage), null, "the suite takes any number of jobs");
    assert.equal(cardLabel(suiteStage, J.jobs[0].id), J.jobs[0].name, "job cards show the job's name");
    pass("boxes in key order; three a box; the suite has no limit");
}

const place = (board: Board, stage: Stage, card: string, to: string | null) => {
    const { board: next, outcome } = moveCard(board, card, to, stageCapacity(stage));
    assert.ok(outcome === "placed" || outcome === "tray", `${card} → ${to}: ${outcome}`);
    return next;
};

const vendorStage = stages[0] as Extract<Stage, { kind: "vendors" }>;
const [boxA, boxB, boxC, boxD] = V1.boxes;
const inBox = (id: string) => V1.cards.filter((c) => c.box === id);

section("The tray and the boxes");
{
    let board = newBoard(vendorStage, random);
    assert.deepEqual([...board.order].sort(), stageCards(vendorStage).sort(), "the tray deals every card once");
    assert.deepEqual(trayCards(board), board.order, "and they all start in the tray");
    assert.notDeepEqual(newBoard(vendorStage, seededRandom("another seed")).order, board.order, "the tray is shuffled");
    assert.equal(canCheck(vendorStage, board), false, "Check my stack waits for every card");

    const a = inBox(boxA.id).map((c) => c.vendor);
    for (const v of a) board = place(board, vendorStage, v, boxA.id);
    assert.deepEqual(board.boxes[boxA.id], a);
    const outsider = inBox(boxB.id)[0].vendor;
    const refused = moveCard(board, outsider, boxA.id, 3);
    assert.equal(refused.outcome, "full", "a fourth card is refused");
    assert.equal(refused.board, board, "and nothing moves");
    assert.equal(fullLine(boxA.name, 3), `${boxA.name} already has 3 cards. Move one out first.`);
    assert.equal(moveCard(board, a[0], boxA.id, 3).outcome, "same");
    assert.equal(moveCard(board, a[0], "spa", 3).outcome, "unknown");
    pass("three cards fill a box; a fourth is refused");

    board = place(board, vendorStage, a[0], boxB.id);
    assert.equal(placeOf(board, a[0]), boxB.id, "a placed card moves to another box");
    board = place(board, vendorStage, a[0], null);
    assert.equal(placeOf(board, a[0]), null, "or back to the tray");
    assert.deepEqual(
        trayCards(board),
        board.order.filter((v) => !a.slice(1).includes(v)),
        "back in its own place in the tray",
    );
    assert.equal(boxCountLine(board.boxes[boxA.id].length, 3), "2 of 3");
    pass("a placed card moves to another box or back to the tray until the round is checked");

    for (const c of V1.cards) if (placeOf(board, c.vendor) === null) board = place(board, vendorStage, c.vendor, c.box);
    assert.equal(canCheck(vendorStage, board), true, "Check my stack once all twelve are placed");
    assert.equal(boxCountLine(board.boxes[boxA.id].length, 3), "3 of 3");
    pass("Check my stack wakes up once all twelve are placed");
}

section("Marking a vendor round");
{
    // Roles: a1 is sold as box B too (an also); b1, c1 and d1 are sold as their own box only.
    const [a1, b1, c1, d1] = [inBox(boxA.id)[0], inBox(boxB.id)[0], inBox(boxC.id)[0], inBox(boxD.id)[0]];
    a1.also = [boxB.id];
    for (const c of [b1, c1, d1]) c.also = [];
    const n = V1.cards.length;

    assert.deepEqual(markVendor(a1, boxA.id), { right: true, also: false }, "in its own box");
    assert.deepEqual(markVendor(a1, boxB.id), { right: true, also: true }, "in its also box");
    assert.deepEqual(markVendor(a1, boxC.id), { right: false, also: false }, "anywhere else");
    assert.deepEqual(markVendor(a1, null), { right: false, also: false }, "or left in the tray");
    assert.equal(ALSO_RIGHT, "also right: it's sold as more than one of these", "the brief's words");
    pass("right in its box; right by its also, with the also line; wrong anywhere else");

    const allInPlace = () => {
        let b = newBoard(vendorStage, random);
        for (const c of V1.cards) b = place(b, vendorStage, c.vendor, c.box);
        return b;
    };
    /** Two full boxes trade a card each, by way of the tray (a full box refuses a fourth). */
    const swap = (b: Board, x: string, y: string) => {
        const [bx, by] = [placeOf(b, x)!, placeOf(b, y)!];
        return place(place(place(b, vendorStage, x, null), vendorStage, y, bx), vendorStage, x, by);
    };

    let marks = markBoard(vendorStage, allInPlace());
    assert.equal(tallyLine(tally(marks)), `${n} of ${n}`, "every card in its box");
    assert.equal(marks.size, n, "every card is marked");

    marks = markBoard(vendorStage, swap(allInPlace(), c1.vendor, d1.vendor));
    assert.deepEqual(marks.get(c1.vendor), { right: false, also: false });
    assert.equal(tallyLine(tally(marks)), `${n - 2} of ${n}`, "two cards in each other's boxes");
    assert.equal(tallyLine({ right: 10, total: 12 }), "10 of 12", "the brief's tally");

    marks = markBoard(vendorStage, swap(allInPlace(), a1.vendor, b1.vendor));
    assert.deepEqual(marks.get(a1.vendor), { right: true, also: true }, "a1 in box B is right by its also");
    assert.deepEqual(marks.get(b1.vendor), { right: false, also: false }, "b1 in box A is wrong");
    assert.equal(tallyLine(tally(marks)), `${n - 1} of ${n}`, "an also counts as right");
    pass(`the tally: ${n} of ${n}, ${n - 2} of ${n} for a swap, ${n - 1} of ${n} when one of the swap is rescued by its also`);

    // An also may name another round's box (RateGain, in round 2, is also sold as a channel
    // manager). It can't fire in its own round, but its flashcard names it.
    const roundBoxes = new Map(vendorRounds(real).map((r) => [r.id, new Set(r.boxes.map((b) => b.id))]));
    const crossing = vendorRounds(real).flatMap((r) =>
        r.cards.filter((c) => c.also.some((a) => !roundBoxes.get(r.id)!.has(a))).map((c) => `${c.vendor} (${r.id})`),
    );
    if (crossing.length) console.log(`  note an also from another round, shown on the flashcard only: ${crossing.join(", ")}`);
}

section("Round 3: one suite, many jobs");
{
    const stage = stages[firstStageOf(stages, jIndex)] as Extract<Stage, { kind: "jobs" }>;
    const { does, distractors, vendor } = stage.suite;
    let board = newBoard(stage, random);
    assert.deepEqual([...board.order].sort(), [...does, ...distractors].sort(), "its jobs and its distractors, mixed");
    assert.equal(canCheck(stage, board), false, "Check my stack waits for one job in the suite");
    assert.equal(jobsLine(0), "0 jobs");

    board = place(board, stage, does[0], SUITE);
    assert.equal(canCheck(stage, board), true, "one job is enough");
    assert.equal(jobsLine(1), "1 job");
    board = place(board, stage, does[1], SUITE);
    board = place(board, stage, distractors[0], SUITE);
    assert.equal(jobsLine(board.boxes[SUITE].length), "3 jobs", "no count given away");

    const marks = markBoard(stage, board);
    const total = does.length + distractors.length;
    assert.equal(marks.size, total, "every card is marked, the tray's too");
    assert.deepEqual(marks.get(does[0]), { right: true, also: false }, "a job it does, in the suite");
    assert.deepEqual(marks.get(distractors[0]), { right: false, also: false }, "a job it doesn't do, in the suite");
    for (const j of does.slice(2)) assert.deepEqual(marks.get(j), { right: false, also: false }, `${j}: a job it does, left in the tray, is wrong`);
    for (const j of distractors.slice(1)) assert.deepEqual(marks.get(j), { right: true, also: false }, `${j}: a distractor left in the tray is right`);
    assert.equal(tallyLine(tally(marks)), `${2 + distractors.length - 1} of ${total}`, `${vendor}: two of its jobs in, the other distractors left out`);
    assert.deepEqual(markJob(stage.suite, does[does.length - 1], false), { right: false, also: false });

    for (const s of stages.filter((x) => x.kind === "jobs")) {
        assert.ok(s.kind === "jobs");
        let b = newBoard(s, random);
        for (const job of s.suite.does) b = place(b, s, job, SUITE);
        assert.equal(tallyLine(tally(markBoard(s, b))), `${b.order.length} of ${b.order.length}`, `${s.suite.vendor}: its own jobs in, the rest left out`);
    }
    pass(`the tray is marked too (${vendor}: ${2 + distractors.length - 1} of ${total}); every suite can be got fully right`);
}

/* ── 4. The flashcards ──────────────────────────────────────────── */

section("The tools flashcards");
{
    const deck = practiceCards(fixture);
    const cardVendors = new Set(vendorRounds(fixture).flatMap((r) => r.cards.map((c) => c.vendor)));
    const suiteOnly = jobsRounds(fixture).flatMap((r) => r.suites.map((s) => s.vendor).filter((v) => !cardVendors.has(v)));
    assert.equal(deck.length, cardVendors.size + suiteOnly.length, "one card per vendor, and one per suite that isn't already a card");
    assert.equal(new Set(deck.map((c) => c.vendor)).size, deck.length, "keyed by vendor, no repeats");
    assert.deepEqual(
        deck.filter((c) => c.kind === "suite").map((c) => c.vendor),
        suiteOnly,
    );
    console.log(`  ${deck.length} cards; suite only: ${suiteOnly.join(", ") || "none"}`);

    const boxes = new Map(vendorRounds(fixture).flatMap((r) => r.boxes.map((b) => [b.id, b.name] as const)));
    for (const r of vendorRounds(fixture))
        for (const c of r.cards) {
            const card = deck.find((x) => x.vendor === c.vendor)!;
            assert.ok(card.kind === "card");
            assert.equal(card.box.name, boxes.get(c.box), `${c.vendor}'s box`);
            if (c.also.length) assert.equal(alsoLine(card.also), `Also: ${c.also.map((a) => boxes.get(a)).join(", ")}`, `${c.vendor}'s also line`);
        }
    for (const r of jobsRounds(fixture))
        for (const s of r.suites.filter((x) => suiteOnly.includes(x.vendor))) {
            const card = deck.find((x) => x.vendor === s.vendor)!;
            assert.ok(card.kind === "suite");
            assert.equal(doesLine(card.does), `Does: ${s.does.map((j) => r.jobs.find((x) => x.id === j)!.name).join(", ")}`, `${s.vendor}'s Does line`);
        }
    assert.equal(alsoLine([{ id: "x", name: "Booking engine", job: "" }]), "Also: Booking engine");
    pass("Vendor first: the box and its also line, or Does: for a suite");

    for (const c of deck) {
        const named = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(c.vendor)}(?![\\p{L}\\p{N}])`, "iu");
        assert.ok(!named.test(practiceClue(c)), `the Box first side of ${c.vendor} shows its own name: ${practiceClue(c)}`);
        if (named.test(c.note)) assert.ok(practiceClue(c).includes("___"), `${c.vendor}'s name is blanked to ___`);
    }
    pass("no Box first card shows its own vendor's name; where the note names it, it reads ___");

    // Not a failure: a note naming part of a multi-word vendor ("Sabre's booking engine" on
    // the Sabre SynXis card) is a strong hint on the Box first side. Printed for the card list's owner.
    for (const c of deck)
        for (const w of c.vendor.includes(" ") ? c.vendor.split(/\s+/).filter((x) => x.length > 2) : [])
            if (new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(w)}(?![\\p{L}\\p{N}])`, "iu").test(practiceClue(c)))
                console.log(`  note ${c.vendor}: its Box first note still says "${w}"`);
}

/* ── 5. The gate ────────────────────────────────────────────────── */

const waiting = unverified(real);
console.log(`\nEverything above: PASS`);
section(`The verify gate: ${waiting.length ? `FAIL, ${waiting.length} still marked "verify": true` : "PASS"}`);
for (const w of waiting) console.log(`  ✗ Round ${w.round} (${w.roundTitle}): ${w.vendor}${w.what ? ` — ${w.what}` : ""}`);
if (waiting.length)
    console.log(
        "\n  Check each one's box and note against the vendor's own site, set verify to false and fill in checked\n" +
            "  (and sources), or swap the card for one that has been checked. Until then the tools pages stay closed.\n",
    );
assert.deepEqual(
    waiting.map((w) => w.vendor),
    [],
    "cards still marked verify: true (listed above). The brief: refuse to build until every card is checked.",
);

console.log("\nsort-model: PASS");
