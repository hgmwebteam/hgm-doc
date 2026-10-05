import { type ReactNode, type Ref, useEffect, useId, useRef, useState } from "react";
import { Check, LinkExternal01, RefreshCw01, Shuffle01 } from "@untitledui/icons";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { Button } from "@/components/base/buttons/button";
import { PageTitle } from "@/pages/team/dictionary/check/check-chrome";
import { type Deck, currentCard, gotIt, isDone, newDeck, notYet } from "@/pages/team/dictionary/check/practice-model";
import { cx } from "@/utils/cx";

/**
 * The flashcard game, shared by the terms deck (/dictionary/practice) and the tools deck
 * (/dictionary/tools/practice). A page supplies the cards' ids, the two sides a person can put
 * first, and what each face shows; everything else is here: the intro, the 3D turn (a fade
 * under reduced motion), Got it / Not yet, "8 of 12 got", focus and the end screen.
 *
 * The deck itself is practice-model.ts: "Not yet" sets a card aside until every card not yet
 * seen in this pass has come up. Nothing is written anywhere.
 */

export type CardFaces = {
    frontLabel: string;
    front: ReactNode;
    backLabel: string;
    back: ReactNode;
    /** Read to a screen reader when the card turns over. */
    backText: string;
};

export type DeckSide = { id: string; label: string };

/* ── What faces are made of ─────────────────────────────────────── */

/** The big line on a face: a term or a vendor's name. */
export const FaceWord = ({ children }: { children: ReactNode }) => (
    <span className="block text-display-xs font-semibold text-pretty text-primary md:text-display-sm">{children}</span>
);

/** A face's sentence: a definition, or a vendor's note. */
export const FaceText = ({ children }: { children: ReactNode }) => <span className="block text-lg leading-relaxed text-pretty text-primary">{children}</span>;

/** The dictionary's blue formula card. */
export const Formula = ({ formula }: { formula: string }) => (
    <span className="block rounded-xl bg-utility-brand-50 px-4 py-3 ring-1 ring-brand">
        <span className="block text-sm font-semibold text-utility-brand-700">Formula</span>
        <span className="mt-1 block font-mono text-sm font-medium break-words whitespace-pre-wrap text-primary">{formula}</span>
    </span>
);

const FaceLabel = ({ children }: { children: string }) => <span className="block text-sm font-medium text-quaternary">{children}</span>;

/* ── The parts ──────────────────────────────────────────────────── */

const SideToggle = ({ sides, side, onChange }: { sides: readonly [DeckSide, DeckSide]; side: string; onChange: (s: string) => void }) => {
    const labelId = useId();
    return (
        <div className="flex flex-wrap items-center gap-3">
            <span id={labelId} className="text-sm font-medium text-secondary">
                Show first
            </span>
            <ButtonGroup
                size="sm"
                aria-labelledby={labelId}
                disallowEmptySelection
                selectedKeys={[side]}
                onSelectionChange={(keys) => {
                    const next = [...keys][0];
                    if (typeof next === "string" && sides.some((s) => s.id === next)) onChange(next);
                }}
            >
                {/* A check mark on the chosen side: the group's own selected shade is too faint to read alone. */}
                {sides.map((s) => (
                    <ButtonGroupItem key={s.id} id={s.id} iconLeading={side === s.id ? Check : undefined}>
                        {s.label}
                    </ButtonGroupItem>
                ))}
            </ButtonGroup>
        </div>
    );
};

const FACE =
    "flex min-h-64 flex-col justify-center gap-4 rounded-2xl p-6 ring-1 ring-secondary shadow-xs [grid-area:1/1] [backface-visibility:hidden] sm:p-8 motion-reduce:transition-opacity motion-reduce:duration-200";

/**
 * One card. A 3D turn, or a cross-fade under reduced motion. The whole card is one button:
 * click, tap, Space or Enter turns it. Only the side facing up is exposed to a screen reader,
 * and turning it announces the other side.
 */
const FlashCard = ({ faces, flipped, onFlip, cardRef }: { faces: CardFaces; flipped: boolean; onFlip: () => void; cardRef: Ref<HTMLButtonElement> }) => {
    const hintId = useId();
    return (
        <div className="[perspective:1600px]">
            <button
                ref={cardRef}
                type="button"
                onClick={onFlip}
                aria-describedby={hintId}
                className="block w-full rounded-2xl text-left outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-4"
            >
                <span
                    className={cx(
                        "grid transition-transform duration-500 ease-out [transform-style:preserve-3d] motion-reduce:transition-none",
                        flipped && "[transform:rotateY(180deg)] motion-reduce:[transform:none]",
                    )}
                >
                    <span aria-hidden={flipped} className={cx(FACE, "bg-primary", flipped && "motion-reduce:opacity-0")}>
                        <FaceLabel>{faces.frontLabel}</FaceLabel>
                        {faces.front}
                    </span>
                    <span
                        aria-hidden={!flipped}
                        className={cx(FACE, "[transform:rotateY(180deg)] bg-secondary motion-reduce:[transform:none]", !flipped && "motion-reduce:opacity-0")}
                    >
                        <FaceLabel>{faces.backLabel}</FaceLabel>
                        {faces.back}
                    </span>
                </span>
            </button>
            <p id={hintId} className="mt-2 text-center text-xs text-quaternary">
                Click, tap or press Space to turn the card over
            </p>
            <p role="status" className="sr-only">
                {flipped ? faces.backText : ""}
            </p>
        </div>
    );
};

/* ── The game ───────────────────────────────────────────────────── */

export const FlashcardDeck = ({
    title,
    intro,
    cardIds,
    sides,
    side,
    onSideChange,
    faces,
    entryLink,
    endActions,
}: {
    title: string;
    /** The first sentence on the intro screen, e.g. "12 cards, one for each term you missed in the check." */
    intro: string;
    cardIds: string[];
    sides: readonly [DeckSide, DeckSide];
    side: string;
    onSideChange: (side: string) => void;
    faces: (id: string, side: string) => CardFaces;
    /** A link under a turned card ("See the full entry"), opened in a new tab so the deck carries on. */
    entryLink?: (id: string) => { href: string; label: string } | null;
    /** The end screen's buttons after "Shuffle and keep going". */
    endActions: ReactNode;
}) => {
    const [phase, setPhase] = useState<"intro" | "deck">("intro");
    const [deck, setDeck] = useState<Deck>(() => newDeck(cardIds, Math.random));
    const [flipped, setFlipped] = useState(false);
    const cardRef = useRef<HTMLButtonElement>(null);
    const endRef = useRef<HTMLHeadingElement>(null);
    const acted = useRef(false);

    const setSide = (s: string) => {
        onSideChange(s);
        setFlipped(false);
    };

    const id = currentCard(deck);
    const done = isDone(deck);

    // After Start, Got it or Not yet: focus the next card, or the end heading.
    useEffect(() => {
        if (!acted.current) return;
        acted.current = false;
        (done ? endRef.current : cardRef.current)?.focus({ preventScroll: true });
    }, [deck, done, phase]);

    const answer = (got: boolean) => {
        acted.current = true;
        setFlipped(false);
        setDeck((d) => (got ? gotIt(d, Math.random) : notYet(d, Math.random)));
    };

    const start = () => {
        setDeck(newDeck(cardIds, Math.random));
        setFlipped(false);
        setPhase("deck");
        acted.current = true;
    };

    if (phase === "intro") {
        return (
            <>
                <PageTitle>{title}</PageTitle>
                <p className="mt-3 max-w-[60ch] text-md text-pretty text-tertiary">
                    {intro} Turn each one over, then say whether you had it. The ones you didn't come back round.
                </p>
                <div className="mt-6">
                    <SideToggle sides={sides} side={side} onChange={setSide} />
                </div>
                <div className="mt-6">
                    <Button size="lg" onClick={start}>
                        Start
                    </Button>
                </div>
            </>
        );
    }

    if (done) {
        return (
            <>
                <PageTitle>{title}</PageTitle>
                <section className="mt-6 rounded-xl bg-primary p-5 ring-1 ring-secondary sm:p-6">
                    <h2 ref={endRef} tabIndex={-1} className="text-lg font-semibold text-primary outline-none">
                        You've been through all {deck.total}.
                    </h2>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <Button size="lg" iconLeading={Shuffle01} onClick={start}>
                            Shuffle and keep going
                        </Button>
                        {endActions}
                    </div>
                </section>
            </>
        );
    }

    const link = id && entryLink ? entryLink(id) : null;

    return (
        <>
            <PageTitle>{title}</PageTitle>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                <SideToggle sides={sides} side={side} onChange={setSide} />
                <p role="status" className="text-sm font-semibold text-secondary tabular-nums">
                    {deck.got.length} of {deck.total} got
                </p>
            </div>

            <div className="mt-6">
                {id && (
                    // Keyed by card and side: a new card mounts face up, so its answer never shows mid-turn.
                    <FlashCard key={`${id}:${side}`} faces={faces(id, side)} flipped={flipped} onFlip={() => setFlipped((f) => !f)} cardRef={cardRef} />
                )}
            </div>

            {flipped && id && (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Button size="lg" iconLeading={Check} onClick={() => answer(true)}>
                        Got it
                    </Button>
                    <Button size="lg" color="secondary" iconLeading={RefreshCw01} onClick={() => answer(false)}>
                        Not yet
                    </Button>
                    {link && (
                        <Button size="md" color="link-color" iconTrailing={LinkExternal01} href={link.href} target="_blank" rel="noopener noreferrer">
                            {link.label}
                            <span className="sr-only"> (opens in a new tab)</span>
                        </Button>
                    )}
                </div>
            )}
        </>
    );
};
