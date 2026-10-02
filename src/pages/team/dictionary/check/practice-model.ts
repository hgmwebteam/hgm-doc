import { type Random, shuffle } from "@/pages/team/dictionary/check/check-model";

/**
 * The flashcard deck on /dictionary/practice. Plain functions, pinned by
 * practice-model.check.ts. The deck writes nothing anywhere: practising is never recorded.
 *
 * The deck is a queue of slugs; the front card is the one showing. "Got it" takes it out.
 * "Not yet" puts it back a few places later, so it comes round again soon but not straight
 * away. The deck is done when every card is "Got it".
 */

export type Deck = { queue: string[]; got: string[]; total: number };

/** How many cards "Not yet" puts in front of the card it sends back. */
export const NOT_YET_GAP = 3;

export const newDeck = (slugs: readonly string[], random: Random): Deck => ({ queue: shuffle(slugs, random), got: [], total: slugs.length });

export const currentCard = (deck: Deck): string | undefined => deck.queue[0];

export const gotIt = (deck: Deck): Deck => (deck.queue.length ? { ...deck, queue: deck.queue.slice(1), got: [...deck.got, deck.queue[0]] } : deck);

export const notYet = (deck: Deck): Deck => {
    const [card, ...rest] = deck.queue;
    if (card === undefined) return deck;
    const at = Math.min(NOT_YET_GAP, rest.length);
    return { ...deck, queue: [...rest.slice(0, at), card, ...rest.slice(at)] };
};

export const isDone = (deck: Deck) => deck.total > 0 && deck.queue.length === 0;

/** Which side faces up first. Remembered per browser (a convenience, so localStorage is fine). */
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
