/**
 * Self-check for the vendor icons (src/data/vendor-icons.json and public/vendor-icons/) and the
 * tools training built from them (/dictionary/tools/practice), against Sort the stack's card list.
 * The game's own rules and its verify gate are sort-model.check.ts.
 *
 * Run it from the repo root (it reads the icon files from public/vendor-icons/) after replacing
 * the manifest, the icons or the card list:
 *   npx esbuild src/pages/team/dictionary/tools/vendor-icons.check.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --outfile=/tmp/hgm-check/vendor-icons.cjs \
 *     --log-level=warning && node /tmp/hgm-check/vendor-icons.cjs
 *
 * It fails loudly when the manifest's eight boxes aren't exactly the card list's, a vendor has no
 * name, alt, box or main box, an icon's PNG is missing or the wrong size, a card_name_to_slug entry
 * points at no vendor, a card or suite in the card list has no icon, the training would show a card
 * wrong, or the game and the training would tell a player different things about a vendor
 * (boxClashes). It never reads verify: the training isn't behind the game's gate, so this passes
 * while sort-model.check.ts still fails there.
 *
 * Until 6 Oct 2026 a disagreement between the two was only a note, and the training and the game
 * drifted apart: the game took the 5 Oct vendor check, the training kept the slides' boxes. Now it
 * fails, so correcting a vendor means correcting both files together.
 */
import assert from "node:assert";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import cardsJson from "@/data/industry-acumen-sort-cards.json";
import iconsJson from "@/data/vendor-icons.json";
import { type JobsRound, type SortData, type VendorRound, sortProblems } from "@/pages/team/dictionary/tools/sort-model";
import { type IconSize, type VendorIcons, boxClashes, iconSlug, iconUrl, trainingCards, trainingProblems } from "@/pages/team/dictionary/tools/vendor-icons";

const cards = cardsJson as unknown as SortData;
const icons = iconsJson as unknown as VendorIcons;
const pass = (what: string) => console.log(`  ok  ${what}`);
const section = (name: string) => console.log(`\n${name}`);
const vendorRounds = cards.rounds.filter((r): r is VendorRound => r.mode === "vendors");
const jobsRounds = cards.rounds.filter((r): r is JobsRound => r.mode === "jobs");
const boxes = new Map(vendorRounds.flatMap((r) => r.boxes.map((b) => [b.id, b] as const)));
const slugs = Object.keys(icons.vendors);
const SIZES: IconSize[] = [128, 512];

console.log(`Vendor icons ${icons.version} (${icons.made}) · ${slugs.length} vendors · against ${cards.title} ${cards.version}`);

/* ── 1. The manifest and the card list ──────────────────────────── */

section("The manifest (src/data/vendor-icons.json) and the card list");
{
    assert.deepEqual(sortProblems(cards), [], "the card list has problems: run sort-model.check.ts");

    // As sets: the training orders a vendor's boxes by slide number, so the card list may order its boxes (the game's number keys) as it likes.
    const slides = Object.entries(icons.categories).sort(([a], [b]) => Number(a) - Number(b));
    assert.equal(slides.length, 8, "the manifest has eight boxes, one per tools slide");
    assert.deepEqual(slides.map(([, id]) => id).sort(), [...boxes.keys()].sort(), "the slides' eight boxes are exactly the card list's boxes");
    pass(`its eight boxes are the card list's, slide ${slides[0][0]} to slide ${slides[slides.length - 1][0]}`);

    const problems = trainingProblems(icons, cards);
    for (const p of problems) console.log(`  ✗ ${p}`);
    assert.deepEqual(problems, [], "trainingProblems finds problems (listed above)");
    pass(`every vendor (${slugs.length}) has a name, an alt, at least one box and a main box among them, and every box is the card list's`);

    for (const [name, slug] of Object.entries(icons.card_name_to_slug))
        assert.ok(slugs.includes(slug), `card_name_to_slug: "${name}" is ${slug}, which isn't a vendor`);
    pass(`all ${Object.keys(icons.card_name_to_slug).length} card_name_to_slug entries name a vendor`);

    const named = [...vendorRounds.flatMap((r) => r.cards.map((c) => c.vendor)), ...jobsRounds.flatMap((r) => r.suites.map((s) => s.vendor))];
    const missing = named.filter((n) => !iconSlug(icons, n));
    assert.deepEqual(missing, [], "cards and suites with no icon: add the name, exactly as the card list writes it, to card_name_to_slug");
    pass(`every card and suite in the card list has an icon (${named.length} names, ${new Set(named).size} vendors)`);

    for (const [slug, v] of Object.entries(icons.vendors))
        if (!v.confidence.startsWith("identified")) console.log(`  note ${slug}: "${v.confidence}". ${v.note}`);
}

/* ── 2. The files ───────────────────────────────────────────────── */

section("The files (public/vendor-icons/)");
{
    assert.ok(existsSync("public/vendor-icons"), "public/vendor-icons/ isn't here: run this from the repo root");
    const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    for (const slug of slugs)
        for (const size of SIZES) {
            const file = `public${iconUrl(slug, size)}`;
            assert.ok(existsSync(file), `${file} is missing`);
            const png = readFileSync(file);
            assert.ok(png.subarray(0, 8).equals(PNG), `${file} isn't a PNG`);
            assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [size, size], `${file} should be ${size} by ${size} px`);
        }
    pass(`both files for every vendor: ${slugs.length} at 128 px and ${slugs.length} at 512 px, each a square PNG of its size`);

    for (const size of SIZES)
        for (const f of readdirSync(`public/vendor-icons/${size}`))
            if (!slugs.includes(f.replace(/\.png$/, ""))) console.log(`  note public/vendor-icons/${size}/${f} isn't any vendor's icon`);
}

/* ── 3. Broken manifests are caught, in plain words ─────────────── */

section("What trainingProblems catches");
{
    const broken = (edit: (m: VendorIcons) => void) => {
        const copy = structuredClone(icons);
        edit(copy);
        return trainingProblems(copy, cards);
    };
    const [first] = slugs;
    // Its main box, so the copies below that keep only `box` keep a main box among their categories.
    const box = icons.vendors[first].main[0];

    assert.deepEqual(
        broken((m) => (m.vendors[first].name = "")),
        [`Vendor icons: ${first} has no name.`],
    );
    assert.deepEqual(
        broken((m) => (m.vendors[first].alt = " ")),
        [`Vendor icons: ${first} has no alt text.`],
    );
    assert.deepEqual(
        broken((m) => (m.vendors[first].categories = [])),
        [`Vendor icons: ${first} isn't under any box.`],
    );
    assert.deepEqual(
        broken((m) => (m.vendors[first].categories = [box, "spa"])),
        [`Vendor icons: ${first}'s box "spa" isn't a box in the card list.`],
    );
    assert.deepEqual(
        broken((m) => (m.vendors[first].categories = [box, box])),
        [`Vendor icons: ${first} names "${box}" twice.`],
    );
    assert.deepEqual(
        broken((m) => (m.vendors = {})),
        ["Vendor icons: the manifest has no vendors."],
    );
    assert.deepEqual(
        broken((m) => (m.vendors[first].main = [])),
        [`Vendor icons: ${first} has no main box.`],
    );
    const elsewhere = [...boxes.keys()].find((id) => !icons.vendors[first].categories.includes(id))!;
    assert.deepEqual(
        broken((m) => (m.vendors[first].main = [elsewhere])),
        [`Vendor icons: ${first}'s main box "${elsewhere}" isn't one of its categories.`],
    );
    assert.deepEqual(
        broken((m) => (m.vendors[first].main = [box, box])),
        [`Vendor icons: ${first}'s main names "${box}" twice.`],
    );
    pass("no name, no alt, no box, a box the card list doesn't have, a box twice, no vendors, no main box, a main box it isn't under, a main box twice");
}

/* ── 4. The training ────────────────────────────────────────────── */

section("The tools training (/dictionary/tools/practice)");
{
    const deck = trainingCards(icons, cards);
    assert.deepEqual(
        deck.map((c) => c.slug),
        slugs,
        "one card per vendor in the manifest, keyed by slug",
    );
    pass(`${deck.length} cards, one per vendor, not only the game's`);

    const slideOf = new Map(Object.entries(icons.categories).map(([slide, id]) => [id, Number(slide)]));
    const inSlideOrder = (ids: string[]) => [...ids].sort((a, b) => slideOf.get(a)! - slideOf.get(b)!);
    for (const c of deck) {
        const v = icons.vendors[c.slug];
        assert.equal(c.name, v.name, `${c.slug}: the front shows the manifest's name`);
        assert.deepEqual(
            c.main.map((b) => b.id),
            inSlideOrder(v.main),
            `${c.slug}: what it's known for, in the slides' order`,
        );
        assert.deepEqual(
            c.also.map((b) => b.id),
            inSlideOrder(v.categories.filter((id) => !v.main.includes(id))),
            `${c.slug}: everything else it sells, in the slides' order`,
        );
        for (const b of [...c.main, ...c.also]) assert.equal(b, boxes.get(b.id), `${c.slug}: ${b.id} is the card list's box, name and job line`);
        assert.deepEqual(c.products, v.deck_card_names.length > 1 ? v.deck_card_names : [], `${c.slug}: products only when the slides name more than one`);
    }
    pass("the back: what it's known for, then everything else it sells, worded as the card list's boxes, each in the slides' order");
    for (const c of deck.filter((x) => x.products.length)) console.log(`  ${c.name}: ${c.products.join(" · ")}`);

    // The slides' order, not the manifest's: a vendor's boxes listed backwards still come out in slide order.
    const widest = deck.reduce((a, b) => (b.also.length > a.also.length ? b : a));
    const reversed = structuredClone(icons);
    reversed.vendors[widest.slug].categories.reverse();
    assert.deepEqual(trainingCards(reversed, cards).find((c) => c.slug === widest.slug)!.also, widest.also, `${widest.slug}'s boxes listed backwards`);
    pass(`the order is the slides' (${widest.name}, with its ${widest.also.length + widest.main.length} boxes listed backwards, comes out the same)`);
    const counts = deck.map((c) => c.main.length + c.also.length);
    pass(
        `boxes per vendor: ${Math.min(...counts)} to ${Math.max(...counts)}; ${deck.filter((c) => c.also.length).length} of ${deck.length} sell more than what they're known for`,
    );

    // Not behind the game's gate: marking every card and suite verify changes nothing here.
    const allWaiting = structuredClone(cards);
    for (const r of allWaiting.rounds) for (const e of r.mode === "vendors" ? r.cards : r.suites) e.verify = true;
    assert.deepEqual(trainingProblems(icons, allWaiting), []);
    assert.deepEqual(trainingCards(icons, allWaiting), deck);
    pass("not behind the verify gate: with every card marked verify, the deck is the same");
}

/* ── 5. One answer per vendor ──────────────────────────────────── */

section("The game and the training agree on every vendor");
{
    const clashes = boxClashes(icons, cards);
    for (const c of clashes) console.log(`  ✗ ${c}`);
    assert.deepEqual(clashes, [], "the game and the training disagree (listed above): correct the manifest and the card list together");
    const named = cards.rounds.reduce((n, r) => n + (r.mode === "vendors" ? r.cards.length : r.suites.length), 0);
    pass(`all ${named} cards and suites accept exactly the boxes the training lists`);

    // What boxClashes catches, on copies.
    const r1 = cards.rounds.findIndex((r) => r.mode === "vendors");
    const card = (cards.rounds[r1] as VendorRound).cards[0];
    const v = icons.vendors[iconSlug(icons, card.vendor)!];
    const spare = [...boxes.keys()].find((id) => !v.categories.includes(id))!;
    const withAlso = (also: string[]) => {
        const copy = structuredClone(cards);
        (copy.rounds[r1] as VendorRound).cards[0].also = also;
        return boxClashes(icons, copy);
    };
    assert.equal(withAlso([...card.also, spare]).length, 1, "a box the game accepts and the training doesn't list");
    if (card.also.length) assert.equal(withAlso(card.also.slice(1)).length, 1, "a box the training lists and the game doesn't accept");
    const suiteRound = cards.rounds.findIndex((r) => r.mode === "jobs");
    if (suiteRound >= 0) {
        const copy = structuredClone(cards);
        const suite = (copy.rounds[suiteRound] as JobsRound).suites[0];
        suite.distractors = [...suite.distractors, suite.does.pop()!];
        assert.ok(boxClashes(icons, copy).length >= 1, "a suite whose distractor is a job the training lists");
    }
    pass("a box only one of them gives, a distractor the vendor sells");
}

console.log("\nvendor-icons: PASS");
