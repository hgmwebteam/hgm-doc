/**
 * Self-check for practice-model.ts: the flashcard deck.
 *
 * Run it from the repo root:
 *   npx esbuild src/pages/team/dictionary/check/practice-model.check.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --outfile=/tmp/hgm-check/practice-model.cjs \
 *   && node /tmp/hgm-check/practice-model.cjs
 */
import assert from "node:assert";
import { seededRandom } from "@/pages/team/dictionary/check/check-model";
import { currentCard, gotIt, isDone, newDeck, notYet } from "@/pages/team/dictionary/check/practice-model";

const cards = Array.from({ length: 12 }, (_, i) => `term-${i}`);
const r = seededRandom("deck");

const deck = newDeck(cards, r);
assert.equal(deck.total, 12);
assert.deepEqual([...deck.queue].sort(), [...cards].sort(), "every card, once");
assert.notDeepEqual(deck.queue, cards, "shuffled");
assert.ok(!isDone(deck));

/* ── "Not yet" moves on to a card you haven't seen ──────────────── */

// The bug Kyle found (2 Oct): "Not yet" on every card cycled the first few forever.
// Now "Not yet" on every card shows all twelve before any comes back.
{
    let d = deck;
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
        seen.push(currentCard(d)!);
        d = notYet(d, r);
    }
    assert.equal(new Set(seen).size, 12, "twelve Not yets show twelve different cards");
    assert.equal(d.queue.length, 12, "then all twelve come round again");
    assert.notEqual(currentCard(d), seen[11], "the next pass never opens on the card just seen");
    assert.notDeepEqual(d.queue, seen, "and in a fresh order");

    // And again: a second pass of Not yets still visits every card.
    const second: string[] = [];
    for (let i = 0; i < 12; i++) {
        second.push(currentCard(d)!);
        d = notYet(d, r);
    }
    assert.equal(new Set(second).size, 12, "every pass visits every card");
}
{
    // Three Not yets in a row show three different cards, then a fourth new one.
    let d = newDeck(cards, seededRandom("three"));
    const shown = [currentCard(d)];
    for (let i = 0; i < 3; i++) {
        d = notYet(d, r);
        shown.push(currentCard(d));
    }
    assert.equal(new Set(shown).size, 4, "no cycling through the same three");
}

/* ── "Got it" takes the card out ───────────────────────────────── */

const top = currentCard(deck)!;
const one = gotIt(deck, r);
assert.equal(one.queue.length, 11);
assert.deepEqual(one.got, [top], "1 of 12 got");

// A card sent back comes round once the cards not yet seen have all been through.
{
    let d = notYet(deck, r); // send the first card back
    const sentBack = top;
    for (let i = 0; i < 11; i++) {
        assert.notEqual(currentCard(d), sentBack, "a card sent back waits for the rest of the pass");
        d = gotIt(d, r);
    }
    assert.equal(currentCard(d), sentBack, "then it comes back");
    d = gotIt(d, r);
    assert.ok(isDone(d), "and the deck is done when every card is Got it");
    assert.equal(d.got.length, 12);
}

/* ── Small decks ────────────────────────────────────────────────── */

{
    const single = newDeck(["only"], r);
    assert.equal(currentCard(notYet(single, r)), "only", "a deck of one comes straight back");
    const two = newDeck(["a", "b"], seededRandom("two"));
    const first = currentCard(two)!;
    const afterOne = notYet(two, r);
    assert.notEqual(currentCard(afterOne), first);
    const afterTwo = notYet(afterOne, r);
    assert.equal(currentCard(afterTwo), first, "with two, the next pass opens on the other card");
}

/* ── Done ───────────────────────────────────────────────────────── */

{
    let d = newDeck(cards, seededRandom("e"));
    for (let i = 0; i < 60 && !isDone(d); i++) d = i % 3 === 0 ? notYet(d, r) : gotIt(d, r);
    assert.ok(isDone(d));
    assert.equal(d.got.length, 12, "12 of 12 got");
    assert.equal(new Set(d.got).size, 12, "each card counted once");
    assert.ok(!isDone(newDeck([], r)), "an empty deck is never 'done'");
}

console.log("practice-model: PASS");
