import { type Random, shuffle } from "@/pages/team/dictionary/check/check-model";

/**
 * The flashcard decks (terms on /dictionary/practice, tools on /dictionary/tools/practice).
 * Plain functions, pinned by practice-model.check.ts. A deck writes nothing anywhere:
 * practising is never recorded.
 *
 * The deck goes round in passes. A pass is every card still in play, shuffled; the front card
 * is the one showing. "Got it" takes the card out. "Not yet" sets it aside for the next pass,
 * so every card you haven't seen this pass comes up before any card you've sent back. When a
 * pass runs out, the cards set aside are shuffled into the next one, which never opens on the
 * card just seen. The deck is done when every card is "Got it".
 *
 * (Until 2 Oct 2026 "Not yet" put a card three places later. Saying "Not yet" to everything
 * then cycled the same four cards forever and the rest of the deck never came up.)
 */

export type Deck = {
    /** This pass, in order. */
    queue: string[];
    /** Sent back with "Not yet": the next pass. */
    later: string[];
    got: string[];
    total: number;
};

export const newDeck = (ids: readonly string[], random: Random): Deck => ({ queue: shuffle(ids, random), later: [], got: [], total: ids.length });

export const currentCard = (deck: Deck): string | undefined => deck.queue[0];

/** When a pass runs out, the cards set aside become the next one: shuffled, never opening on the card just seen. */
const nextPass = (deck: Deck, justSeen: string, random: Random): Deck => {
    if (deck.queue.length || !deck.later.length) return deck;
    const queue = shuffle(deck.later, random);
    if (queue.length > 1 && queue[0] === justSeen) [queue[0], queue[1]] = [queue[1], queue[0]];
    return { ...deck, queue, later: [] };
};

export const gotIt = (deck: Deck, random: Random): Deck => {
    const [card, ...rest] = deck.queue;
    if (card === undefined) return deck;
    return nextPass({ ...deck, queue: rest, got: [...deck.got, card] }, card, random);
};

export const notYet = (deck: Deck, random: Random): Deck => {
    const [card, ...rest] = deck.queue;
    if (card === undefined) return deck;
    return nextPass({ ...deck, queue: rest, later: [...deck.later, card] }, card, random);
};

export const isDone = (deck: Deck) => deck.total > 0 && deck.queue.length === 0 && deck.later.length === 0;

/** Which side faces up first on the terms deck. Remembered per browser (a convenience, so localStorage is fine). */
export type CardSide = "word" | "definition";
export const SIDE_KEY = "hgm_practice_side";

export const readSide = (): CardSide => {
    try {
        return localStorage.getItem(SIDE_KEY) === "definition" ? "definition" : "word";
    } catch {
        return "word";
    }
};

export const writeSide = (side: CardSide) => {
    try {
        localStorage.setItem(SIDE_KEY, side);
    } catch {
        /* storage unavailable: the choice lasts until the page closes */
    }
};
