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
import { NOT_YET_GAP, currentCard, gotIt, isDone, newDeck, notYet } from "@/pages/team/dictionary/check/practice-model";

const cards = Array.from({ length: 12 }, (_, i) => `term-${i}`);

const deck = newDeck(cards, seededRandom("deck"));
assert.equal(deck.total, 12);
assert.deepEqual([...deck.queue].sort(), [...cards].sort(), "every card, once");
assert.notDeepEqual(deck.queue, cards, "shuffled");
assert.ok(!isDone(deck));

// "Not yet" sends the card back a few places, not to the front and not out of the deck.
const top = currentCard(deck)!;
const later = notYet(deck);
assert.equal(later.queue.indexOf(top), NOT_YET_GAP, `back ${NOT_YET_GAP} places`);
assert.equal(later.queue.length, 12);
assert.equal(later.got.length, 0);

// "Got it" takes it out and counts it.
const one = gotIt(deck);
assert.equal(one.queue.length, 11);
assert.deepEqual(one.got, [top], "1 of 12 got");

// Near the end of the deck, "Not yet" puts the card last; on its own, it stays.
let d = deck;
while (d.queue.length > 2) d = gotIt(d);
const [a, b] = d.queue;
assert.deepEqual(notYet(d).queue, [b, a]);
d = gotIt(d);
assert.deepEqual(notYet(d).queue, d.queue, "a last card comes straight back");

// The deck is done when every card is "Got it", however many "Not yet"s it took.
let e = newDeck(cards, seededRandom("e"));
for (let i = 0; i < 40 && !isDone(e); i++) e = i % 3 === 0 ? notYet(e) : gotIt(e);
assert.ok(isDone(e));
assert.equal(e.got.length, 12, "12 of 12 got");
assert.equal(new Set(e.got).size, 12, "each card counted once");
assert.ok(!isDone(newDeck([], seededRandom("x"))), "an empty deck is never 'done'");

console.log("practice-model: PASS");
