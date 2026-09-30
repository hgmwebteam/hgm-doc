/**
 * Self-check for mergeFoundationDraft — the one guarantee the Draft button rests on:
 * a drafted Master Brand Document can ADD to what's there and can never change or erase it.
 *
 * There is no test runner in this project and adding one is a bigger decision than this
 * feature, so this is a plain assert script with no framework. Nothing imports it, so it
 * costs nothing at runtime; `tsc -b` still type-checks it because it lives under src/.
 *
 * Run it (no test runner and no new dependency: npx fetches tsx, and the app's tsconfig
 * resolves the `@/` imports, the runtime one to website-setup included):
 *   npx --yes tsx --tsconfig tsconfig.app.json src/pages/client/dashboard/dashboard-model.check.ts
 *
 * The tsc-to-commonjs command this header used to give stopped running when
 * dashboard-model.ts gained a runtime `@/` import (website-setup), which a plain `node`
 * cannot resolve.
 *
 * It also pins newDashboardRow, the row the team's Clients page creates for a new client,
 * and that a dashboard Save carries data.websites through mergeContent untouched (Enjoy
 * Unique Stays, 29 Sep 2026).
 */
import assert from "node:assert/strict";
import {
    DEFAULT_CLIENT_VISIBLE,
    DEFAULT_FOUNDATION,
    FOCUS_PROPERTY_MAX,
    type FocusProperty,
    type Foundation,
    createDefaultContent,
    emptyFocusProperty,
    fillFocusProperty,
    mergeContent,
    mergeFoundationDraft,
    newDashboardRow,
} from "./dashboard-model";

const base = (over: Partial<Foundation> = {}): Foundation => ({ ...DEFAULT_FOUNDATION, ...over });

/* 1. An empty field takes the draft. */
{
    const patch = mergeFoundationDraft(base(), { hosts: "Two sisters who inherited the lodge." });
    assert.equal(patch.hosts, "Two sisters who inherited the lodge.");
}

/* 2. A field a person wrote is NEVER touched — the whole point. */
{
    const patch = mergeFoundationDraft(base({ hosts: "AM's own careful wording." }), { hosts: "Model's version." });
    assert.equal(patch.hosts, undefined, "a filled field must not appear in the patch at all");
}

/* 3. Whitespace is not content: a box holding only spaces still counts as empty. */
{
    const patch = mergeFoundationDraft(base({ uvp: "   " }), { uvp: "Ski-in, ski-out with a private gondola." });
    assert.equal(patch.uvp, "Ski-in, ski-out with a private gondola.");
}

/* 4. A blank draft value never blanks an existing field, and never lands as an empty string. */
{
    const patch = mergeFoundationDraft(base({ brandVoice: "Warm, dry, never twee." }), { brandVoice: "" });
    assert.equal(patch.brandVoice, undefined);
    const fresh = mergeFoundationDraft(base(), { brandVoice: "   " });
    assert.equal(fresh.brandVoice, undefined, "an all-whitespace draft value is not content");
}

/* 5. Row lists keep what a person filled, drop empty scaffolding rows, and dedupe. */
{
    const current = base({
        restaurants: [
            { id: "a", name: "Joe's Diner", description: "Best pie in the valley." },
            { id: "b", name: "", description: "" },
            { id: "c", name: "", description: "" },
        ],
    });
    const patch = mergeFoundationDraft(current, {
        restaurants: [
            { name: "Joe's Diner", description: "A model's rewrite that must lose." },
            { name: "Pine & Ash", description: "Wood-fired, book ahead." },
        ],
    });
    const rows = patch.restaurants!;
    assert.equal(rows.length, 2, "one kept row plus one genuinely new row");
    assert.equal(rows[0].name, "Joe's Diner");
    assert.equal(rows[0].description, "Best pie in the valley.", "the AM's description survives the draft");
    assert.equal(rows[1].name, "Pine & Ash");
    assert.ok(rows[1].id && rows[1].id !== "b", "a drafted row gets its own id");
}

/* 5b. A re-draft fills the EMPTY description of an existing row (how the website addresses
       reach rows an earlier draft created with names only) — but never touches a filled one. */
{
    const current = base({
        restaurants: [
            { id: "a", name: "The Foundry", description: "" },
            { id: "b", name: "Joe's Diner", description: "Best pie in the valley." },
        ],
    });
    const patch = mergeFoundationDraft(current, {
        restaurants: [
            { name: "The Foundry", description: "https://www.foundrykillington.com/" },
            { name: "Joe's Diner", description: "A rewrite that must lose." },
        ],
    });
    const rows = patch.restaurants!;
    assert.equal(rows.length, 2, "no new rows, just the fill");
    assert.equal(rows[0].id, "a", "the existing row keeps its id");
    assert.equal(rows[0].description, "https://www.foundrykillington.com/");
    assert.equal(rows[1].description, "Best pie in the valley.", "a filled description is never overwritten");
}

/* 6. Re-running a draft over its own output changes nothing. This is what makes the button
      safe to press twice, which an AM will do. */
{
    const drafted = { hosts: "Two sisters who inherited the lodge.", uvp: "Ski-in, ski-out." };
    const first = mergeFoundationDraft(base(), drafted);
    const settled = base(first);
    const second = mergeFoundationDraft(settled, drafted);
    assert.deepEqual(second, {}, "a second identical run must be a complete no-op");
}

/* 7. Personas: the scaffolding pair a new client starts with is empty, so a draft fills it;
      a persona someone has named is kept and not duplicated. */
{
    const patch = mergeFoundationDraft(base({ personas: [] }), {
        personas: [
            { name: "Weekend Recharger", rank: "Primary", summary: "Drives up Friday night.", keywords: ["ski weekend", "hot tub cabin"] },
            { name: "Multi-Gen Organiser", rank: "Secondary", summary: "Books for nine people." },
        ],
    });
    assert.equal(patch.personas!.length, 2);
    assert.equal(patch.personas![0].rank, "Primary");
    assert.deepEqual(patch.personas![0].keywords, ["ski weekend", "hot tub cabin"]);
    assert.equal(patch.personas![1].keywords.length, 0, "a persona with no keywords gets an empty array, not undefined");

    const kept = mergeFoundationDraft(base({ personas: [{ ...patch.personas![0], summary: "Hand-written summary." }] }), {
        personas: [{ name: "Weekend Recharger", rank: "Primary", summary: "Model rewrite." }],
    });
    assert.equal(kept.personas, undefined, "nothing new to add means no patch for that list");
}

/* 8. Taglines are all-or-nothing: one the AM wrote keeps the model out of the list. */
{
    assert.deepEqual(mergeFoundationDraft(base({ taglines: [] }), { taglines: ["Above the tree line", "", "  "] }).taglines, ["Above the tree line"]);
    assert.equal(mergeFoundationDraft(base({ taglines: ["Ours"] }), { taglines: ["Theirs"] }).taglines, undefined);
}

/* 9. Keys the document doesn't have are dropped, so a drifting tool schema can't write
      junk into a client's row. */
{
    const patch = mergeFoundationDraft(base(), { notAFieldAtAll: "x", hosts: "Real." });
    assert.deepEqual(Object.keys(patch), ["hosts"]);
}

console.log("mergeFoundationDraft: all checks passed");

/* newDashboardRow: the Clients page's "Create dashboard", as one function. */
{
    const row = newDashboardRow({ name: "Enjoy Unique Stays", email: "", password: " ABC-DEF-HGMS " });
    assert.equal(row.slug, "enjoy-unique-stays-dashboard");
    assert.equal(row.client_name, "Enjoy Unique Stays");
    assert.equal(row.client_website, "");
    assert.ok(!("websites" in row.data), "a template row never carries a website list: it is set on purpose");
    assert.deepEqual(row.data.client_visible, DEFAULT_CLIENT_VISIBLE);
    assert.equal(row.data.status, "Onboarding");
    assert.deepEqual(row.data.revenue, { currency: "USD", months: [] }, "no sample figures on a new client, the umbrella's least of all");
    assert.deepEqual(row.data.dashboard_users, [], "no email: nobody on the list");
    assert.deepEqual(row.data.allowed_emails, []);
    assert.equal(row.data.share_password, "ABC-DEF-HGMS");
    const { dashboard_users: _u, allowed_emails: _a, share_password: _p, ...template } = row.data;
    void _u;
    void _a;
    void _p;
    // Every call mints fresh ids for the scaffolding rows, so ids are left out of the comparison.
    const withoutIds = (v: unknown) => JSON.parse(JSON.stringify(v, (k, x) => (k === "id" ? undefined : x)));
    assert.deepEqual(withoutIds(template), withoutIds(createDefaultContent("enjoy-unique-stays")), "otherwise exactly the template under the client's base");
}
{
    const row = newDashboardRow({ name: "  FLOHOM ", email: " fred@example.com ", password: "ABC-DEF-HGMS" });
    assert.equal(row.slug, "flohom-dashboard");
    assert.equal(row.client_name, "FLOHOM");
    assert.deepEqual(
        row.data.dashboard_users,
        [{ email: "fred@example.com", password: "ABC-DEF-HGMS", sections: null }],
        "one email: one person, on the dashboard default",
    );
    assert.deepEqual(row.data.allowed_emails, ["fred@example.com"], "and the mirror in step");
}

/* A dashboard Save keeps data.websites: mergeContent spreads the row. */
{
    const websites = [
        { name: "Paradise Pointe", url: "https://stayparadisepointe.com/", tenant_slug: "paradise-pointe" },
        { name: "Stay Saluda", url: "https://staysaluda.com/", tenant_slug: "stay-saluda" },
    ];
    assert.deepEqual(mergeContent({ websites }).websites, websites);
    assert.equal(mergeContent({}).websites, undefined, "absent stays absent");
}

/* ── Filling ONE focus property from its own listing page ──────────────────
   The row button hands a drafted property straight back to the row the AM is looking at,
   so this is where "a draft never overwrites" has to hold for a single row. */
{
    const drafted = {
        name: "Coach House",
        link: "https://cabins.com/properties/coach-house",
        location: "Hochatown, OK",
        guests: "6",
        bedrooms: "2",
        beds: "3",
        bathrooms: "2",
        description: "A cozy cabin among the trees.",
        features: "Hot tub\nFire pit",
        terms: "No pets. Two-night minimum.",
        reviews: ["Perfect for our family of 5.", "Hosts were always in touch."],
    };

    /* An empty row, apart from the link the AM pasted: everything lands. */
    const empty = { ...emptyFocusProperty(), link: "https://cabins.com/properties/coach-house" };
    const done = fillFocusProperty(empty, drafted);
    assert.equal(done.id, empty.id, "the row keeps its identity");
    assert.equal(done.name, "Coach House");
    assert.equal(done.guests, "6");
    assert.equal(done.terms, "No pets. Two-night minimum.");
    assert.deepEqual(done.reviews, ["Perfect for our family of 5.", "Hosts were always in touch."]);

    /* Anything the AM typed wins, field by field — the rest still fills in around it. */
    const partly = { ...empty, name: "The Coach House", description: "Our own words for this one." };
    const mixed = fillFocusProperty(partly, drafted);
    assert.equal(mixed.name, "The Coach House");
    assert.equal(mixed.description, "Our own words for this one.");
    assert.equal(mixed.link, "https://cabins.com/properties/coach-house", "the pasted link is not replaced");
    assert.equal(mixed.bedrooms, "2", "and the empty boxes still fill");

    /* One quote typed means the list is the AM's; drafted quotes don't interleave. */
    const started = { ...empty, reviews: ["", "A quote they pasted", ""] };
    assert.deepEqual(fillFocusProperty(started, drafted).reviews, ["", "A quote they pasted", ""]);

    /* A page that yielded nothing changes nothing. */
    assert.deepEqual(fillFocusProperty(empty, {}), empty);
    assert.deepEqual(fillFocusProperty(empty, { name: "   ", guests: "" }), empty, "blank strings are not values");
}

/* ── The section is five cards ─────────────────────────────────────────────
   Blank cards accumulate from the Add button and persist; filled ones are never dropped. */
{
    const blank = () => emptyFocusProperty();
    const named = (name: string) => ({ ...emptyFocusProperty(), name });
    /* Through mergeContent, because that is where a stored row is read. */
    const stored = (focusProperties: FocusProperty[]) => {
        const { foundation } = mergeContent({ foundation: { ...DEFAULT_FOUNDATION, focusProperties } });
        assert.ok(foundation, "mergeContent always returns a foundation");
        return foundation.focusProperties;
    };

    /* Cabin Collective's row: twelve cards, nothing written in any of them. */
    const twelveBlanks = Array.from({ length: 12 }, blank);
    assert.equal(stored(twelveBlanks).length, FOCUS_PROPERTY_MAX);

    /* Idempotent, and a row already at or under the size is untouched. */
    const five = stored(twelveBlanks);
    assert.deepEqual(stored(five), five);
    const two = [blank(), blank()];
    assert.deepEqual(stored(two), two);

    /* A filled card is never dropped — not at the size, not past it. */
    assert.equal(stored(Array.from({ length: 8 }, (_, i) => named(`Cabin ${i + 1}`))).length, 8);

    /* Mixed: the filled ones stay, blanks fill up to five, and the order is the stored one. */
    const kept = stored([blank(), named("Coach House"), blank(), blank(), named("Wild Blue"), blank(), blank(), blank()]);
    assert.equal(kept.length, FOCUS_PROPERTY_MAX);
    assert.deepEqual(
        kept.map((p) => p.name),
        ["", "Coach House", "", "", "Wild Blue"],
        "stored order, not filled-first",
    );

    /* A card counts as filled by anything in it, not just a name. */
    const late = { ...emptyFocusProperty(), link: "https://x.com/properties/late-addition" };
    assert.ok(
        stored([...Array.from({ length: 5 }, blank), late]).some((p) => p.id === late.id),
        "a link the AM pasted is content, and keeps its card",
    );
    const quoted = { ...emptyFocusProperty(), reviews: ["Loved it", "", ""] };
    assert.ok(
        stored([...Array.from({ length: 5 }, blank), quoted]).some((p) => p.id === quoted.id),
        "so is a quote",
    );
}

console.log("newDashboardRow, websites, fillFocusProperty and the five-card section: all checks passed");
