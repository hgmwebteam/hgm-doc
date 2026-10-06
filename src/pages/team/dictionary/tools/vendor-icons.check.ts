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
 * name, alt or box, an icon's PNG is missing or the wrong size, a card_name_to_slug entry points at
 * no vendor, a card or suite in the card list has no icon, or the training would show a card wrong.
 * It never reads verify: the training isn't behind the game's gate, so this passes while
 * sort-model.check.ts still fails there.
 *
 * Where the slides and the game put a vendor in different boxes it prints a note, not a failure:
 * which is right is Kyle's call (a check of every vendor against its own site is under way), and
 * the fix is a data change in the Claude project, never code.
 */
import assert from "node:assert";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import cardsJson from "@/data/industry-acumen-sort-cards.json";
import iconsJson from "@/data/vendor-icons.json";
import { type JobsRound, type SortData, type VendorRound, sortProblems } from "@/pages/team/dictionary/tools/sort-model";
import { type IconSize, type VendorIcons, iconSlug, iconUrl, trainingCards, trainingProblems } from "@/pages/team/dictionary/tools/vendor-icons";

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
    pass(`every vendor (${slugs.length}) has a name, an alt and at least one box, and every box is the card list's`);

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
    const box = icons.vendors[first].categories[0];

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
    pass("no name, no alt, no box, a box the card list doesn't have, a box twice, no vendors");
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
    for (const c of deck) {
        const v = icons.vendors[c.slug];
        assert.equal(c.name, v.name, `${c.slug}: the front shows the manifest's name`);
        assert.deepEqual(
            c.boxes.map((b) => b.id),
            [...v.categories].sort((a, b) => slideOf.get(a)! - slideOf.get(b)!),
            `${c.slug}: its boxes, in the slides' order`,
        );
        for (const b of c.boxes) assert.equal(b, boxes.get(b.id), `${c.slug}: ${b.id} is the card list's box, name and job line`);
        assert.deepEqual(c.products, v.deck_card_names.length > 1 ? v.deck_card_names : [], `${c.slug}: products only when the slides name more than one`);
    }
    pass("the back: what the slides put it under, worded as the card list's boxes, in the slides' order");
    for (const c of deck.filter((x) => x.products.length)) console.log(`  ${c.name}: ${c.products.join(" · ")}`);

    // The slides' order, not the manifest's: a vendor's boxes listed backwards still come out in slide order.
    const widest = deck.reduce((a, b) => (b.boxes.length > a.boxes.length ? b : a));
    const reversed = structuredClone(icons);
    reversed.vendors[widest.slug].categories.reverse();
    assert.deepEqual(trainingCards(reversed, cards).find((c) => c.slug === widest.slug)!.boxes, widest.boxes, `${widest.slug}'s boxes listed backwards`);
    pass(`the order is the slides' (${widest.name}, with its ${widest.boxes.length} boxes listed backwards, comes out the same)`);

    // Not behind the game's gate: marking every card and suite verify changes nothing here.
    const allWaiting = structuredClone(cards);
    for (const r of allWaiting.rounds) for (const e of r.mode === "vendors" ? r.cards : r.suites) e.verify = true;
    assert.deepEqual(trainingProblems(icons, allWaiting), []);
    assert.deepEqual(trainingCards(icons, allWaiting), deck);
    pass("not behind the verify gate: with every card marked verify, the deck is the same");
}

/* ── 5. Where the slides and the game disagree ──────────────────── */

section("Where the tools slides and the game disagree (notes for Kyle, not failures)");
{
    const names = (ids: string[]) => ids.map((id) => boxes.get(id)?.name ?? id).join(", ");
    let clashes = 0;
    const compare = (who: string, game: string[], vendorName: string) => {
        const slug = iconSlug(icons, vendorName)!;
        const v = icons.vendors[slug];
        const onlyGame = game.filter((id) => !v.categories.includes(id));
        const onlySlides = v.categories.filter((id) => !game.includes(id));
        if (!onlyGame.length && !onlySlides.length) return;
        clashes++;
        const parts = [onlyGame.length && `only the game says ${names(onlyGame)}`, onlySlides.length && `only the slides say ${names(onlySlides)}`];
        const merged = v.deck_card_names.length > 1 ? ` (the slides' ${v.name} is ${v.deck_card_names.join(" and ")} together)` : "";
        console.log(`  note ${who}: ${parts.filter(Boolean).join("; ")}${merged}`);
    };
    cards.rounds.forEach((r, i) => {
        if (r.mode === "vendors") for (const c of r.cards) compare(`${c.vendor}, round ${i + 1}`, [c.box, ...c.also], c.vendor);
        else for (const s of r.suites) compare(`${s.vendor}, round ${i + 1} suite`, s.does, s.vendor);
    });
    console.log(clashes ? `  ${clashes} in all. The training shows the slides; the game marks by the card list.` : "  none");
}

console.log("\nvendor-icons: PASS");
