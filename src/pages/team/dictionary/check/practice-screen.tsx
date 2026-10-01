import { type Ref, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, LinkExternal01, RefreshCw01, Shuffle01 } from "@untitledui/icons";
import { useSearchParams } from "react-router";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { Button } from "@/components/base/buttons/button";
import { CheckPage, Notice, PageTitle, SessionFallback, SignInCard } from "@/pages/team/dictionary/check/check-chrome";
import { flashcardMaskWords, maskText } from "@/pages/team/dictionary/check/check-model";
import { missedTerms } from "@/pages/team/dictionary/check/check-score";
import { type CardSide, type Deck, currentCard, gotIt, isDone, newDeck, notYet, readSide, writeSide } from "@/pages/team/dictionary/check/practice-model";
import { type CheckContent, useCheckSession } from "@/pages/team/dictionary/check/use-check-session";
import { entryPath } from "@/pages/team/dictionary/dictionary-data";
import type { DictionaryEntry } from "@/pages/team/dictionary/dictionary-model";
import { cx } from "@/utils/cx";

/**
 * `/dictionary/practice` — flashcards. `?set=missed` (the default, from the results page)
 * uses the terms the person currently has wrong; `?set=all` every tier A and B term, and
 * works without signing in. Practising writes nothing anywhere.
 *
 * Every card's words come from the dictionary by slug. Word first: the term (with its
 * expansion, "ADR (average daily rate)") on the front; its definition, and formula if it
 * has one, on the back. Definition first: the definition on the front with the term blanked
 * ("___", the bank's masking rule plus flashcardMaskWords' extras); the term on the back.
 */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const SideToggle = ({ side, onChange }: { side: CardSide; onChange: (s: CardSide) => void }) => (
    <div className="flex flex-wrap items-center gap-3">
        <span id="practice-side" className="text-sm font-medium text-secondary">
            Show first
        </span>
        <ButtonGroup
            size="sm"
            aria-labelledby="practice-side"
            disallowEmptySelection
            selectedKeys={[side]}
            onSelectionChange={(keys) => {
                const next = [...keys][0];
                if (next === "word" || next === "definition") onChange(next);
            }}
        >
            {/* A check mark on the chosen side: the group's own selected shade is too faint to read alone. */}
            <ButtonGroupItem id="word" iconLeading={side === "word" ? Check : undefined}>
                Word first
            </ButtonGroupItem>
            <ButtonGroupItem id="definition" iconLeading={side === "definition" ? Check : undefined}>
                Definition first
            </ButtonGroupItem>
        </ButtonGroup>
    </div>
);

const Formula = ({ formula }: { formula: string }) => (
    // The dictionary's blue formula card.
    <span className="block rounded-xl bg-utility-brand-50 px-4 py-3 ring-1 ring-brand">
        <span className="block text-sm font-semibold text-utility-brand-700">Formula</span>
        <span className="mt-1 block font-mono text-sm font-medium break-words whitespace-pre-wrap text-primary">{formula}</span>
    </span>
);

const FACE =
    "flex min-h-64 flex-col justify-center gap-4 rounded-2xl p-6 ring-1 ring-secondary shadow-xs [grid-area:1/1] [backface-visibility:hidden] sm:p-8 motion-reduce:transition-opacity motion-reduce:duration-200";

/**
 * One card. A 3D turn, or a cross-fade under reduced motion. The whole card is one button:
 * click, tap, Space or Enter turns it. Only the side facing up is exposed to a screen reader,
 * and turning it announces the other side.
 */
const FlashCard = ({
    entry,
    side,
    flipped,
    onFlip,
    maskWords,
    cardRef,
}: {
    entry: DictionaryEntry;
    side: CardSide;
    flipped: boolean;
    onFlip: () => void;
    maskWords: string[];
    cardRef: Ref<HTMLButtonElement>;
}) => {
    const hintId = useId();
    const term = <span className="block text-display-xs font-semibold text-pretty text-primary md:text-display-sm">{entry.term}</span>;
    const definition = (masked: boolean) => (
        <span className="block text-lg leading-relaxed text-pretty text-primary">{masked ? maskText(entry.gloss, maskWords) : entry.gloss}</span>
    );
    const label = (text: string) => <span className="block text-sm font-medium text-quaternary">{text}</span>;

    const front =
        side === "word" ? (
            <>
                {label("Word")}
                {term}
            </>
        ) : (
            <>
                {label("Definition")}
                {definition(true)}
            </>
        );
    const back =
        side === "word" ? (
            <>
                {label("Definition")}
                {definition(false)}
                {entry.formula?.trim() && <Formula formula={entry.formula} />}
            </>
        ) : (
            <>
                {label("Word")}
                {term}
            </>
        );
    const backText = side === "word" ? `${entry.gloss}${entry.formula ? ` Formula: ${entry.formula}` : ""}` : entry.term;

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
                        {front}
                    </span>
                    <span
                        aria-hidden={!flipped}
                        className={cx(FACE, "[transform:rotateY(180deg)] bg-secondary motion-reduce:[transform:none]", !flipped && "motion-reduce:opacity-0")}
                    >
                        {back}
                    </span>
                </span>
            </button>
            <p id={hintId} className="mt-2 text-center text-xs text-quaternary">
                Click, tap or press Space to turn the card over
            </p>
            <p role="status" className="sr-only">
                {flipped ? backText : ""}
            </p>
        </div>
    );
};

const Flashcards = ({ slugs, content, set, canRetakeMissed }: { slugs: string[]; content: CheckContent; set: "missed" | "all"; canRetakeMissed: boolean }) => {
    const [phase, setPhase] = useState<"intro" | "deck">("intro");
    const [side, setSideState] = useState<CardSide>(readSide);
    const [deck, setDeck] = useState<Deck>(() => newDeck(slugs, Math.random));
    const [flipped, setFlipped] = useState(false);
    const cardRef = useRef<HTMLButtonElement>(null);
    const endRef = useRef<HTMLHeadingElement>(null);
    const acted = useRef(false);

    const setSide = (s: CardSide) => {
        setSideState(s);
        writeSide(s);
        setFlipped(false);
    };

    const slug = currentCard(deck);
    const entry = slug ? content.dict.bySlug.get(slug) : undefined;
    const maskWords = useMemo(() => (entry ? flashcardMaskWords(entry, content.bank) : []), [entry, content.bank]);
    const done = isDone(deck);

    // After Got it / Not yet, focus the next card, or the end heading.
    useEffect(() => {
        if (!acted.current) return;
        acted.current = false;
        (done ? endRef.current : cardRef.current)?.focus({ preventScroll: true });
    }, [deck, done]);

    const answer = (got: boolean) => {
        acted.current = true;
        setFlipped(false);
        setDeck((d) => (got ? gotIt(d) : notYet(d)));
    };

    const start = () => {
        setDeck(newDeck(slugs, Math.random));
        setFlipped(false);
        setPhase("deck");
        acted.current = true;
    };

    if (phase === "intro") {
        return (
            <>
                <PageTitle>Time to practise your words.</PageTitle>
                <p className="mt-3 max-w-[60ch] text-md text-pretty text-tertiary">
                    {set === "missed"
                        ? `${plural(slugs.length, "card", "cards")}, one for each term you missed in the check.`
                        : `${plural(slugs.length, "card", "cards")}, one for every term in the check.`}{" "}
                    Turn each one over, then say whether you had it. The ones you didn't come back round.
                </p>
                <div className="mt-6">
                    <SideToggle side={side} onChange={setSide} />
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
                <PageTitle>Time to practise your words.</PageTitle>
                <section className="mt-6 rounded-xl bg-primary p-5 ring-1 ring-secondary sm:p-6">
                    <h2 ref={endRef} tabIndex={-1} className="text-lg font-semibold text-primary outline-none">
                        You've been through all {deck.total}.
                    </h2>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <Button size="lg" iconLeading={Shuffle01} onClick={start}>
                            Shuffle and keep going
                        </Button>
                        {canRetakeMissed ? (
                            <Button size="lg" color="secondary" href="/dictionary/check?mode=missed">
                                Retake the terms you missed
                            </Button>
                        ) : (
                            <Button size="lg" color="secondary" href="/dictionary/check">
                                Take the check
                            </Button>
                        )}
                        <Button size="lg" color="link-gray" href="/dictionary">
                            Back to the dictionary
                        </Button>
                    </div>
                </section>
            </>
        );
    }

    return (
        <>
            <PageTitle>Time to practise your words.</PageTitle>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                <SideToggle side={side} onChange={setSide} />
                <p role="status" className="text-sm font-semibold text-secondary tabular-nums">
                    {deck.got.length} of {deck.total} got
                </p>
            </div>

            <div className="mt-6">
                {entry && (
                    // Keyed by card and side: a new card mounts face up, so its answer never shows mid-turn.
                    <FlashCard
                        key={`${slug}:${side}`}
                        entry={entry}
                        side={side}
                        flipped={flipped}
                        onFlip={() => setFlipped((f) => !f)}
                        maskWords={maskWords}
                        cardRef={cardRef}
                    />
                )}
            </div>

            {flipped && entry && (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Button size="lg" iconLeading={Check} onClick={() => answer(true)}>
                        Got it
                    </Button>
                    <Button size="lg" color="secondary" iconLeading={RefreshCw01} onClick={() => answer(false)}>
                        Not yet
                    </Button>
                    <Button size="md" color="link-color" iconTrailing={LinkExternal01} href={entryPath(entry.slug)} target="_blank" rel="noopener noreferrer">
                        See the full entry
                        <span className="sr-only"> (opens in a new tab)</span>
                    </Button>
                </div>
            )}
        </>
    );
};

const Practice = () => {
    const session = useCheckSession();
    const [params] = useSearchParams();
    const set = params.get("set") === "all" ? "all" : "missed";
    const allButton = (
        <Button size="md" href="/dictionary/practice?set=all">
            Practise all the terms
        </Button>
    );

    // Everything except "ready" and "signed-out" means the cards themselves aren't loaded.
    if (session.status === "loading" || session.status === "failed" || session.status === "broken") {
        return (
            <>
                <PageTitle>Time to practise your words.</PageTitle>
                <div className="mt-6">
                    <SessionFallback session={session} />
                </div>
            </>
        );
    }

    const { content } = session;

    if (set === "all") {
        const canRetakeMissed = session.status === "ready" && session.history.finished.length > 0;
        return <Flashcards key="all" slugs={[...content.weights.keys()]} content={content} set="all" canRetakeMissed={canRetakeMissed} />;
    }

    if (session.status === "signed-out") {
        return (
            <>
                <PageTitle>Time to practise your words.</PageTitle>
                <div className="mt-6 flex flex-col gap-4">
                    <SignInCard email={session.email} reason="Your missed terms come from your check, which is saved to your own account." />
                    <Notice title="Or practise every term" actions={allButton}>
                        All the terms from the check work without signing in.
                    </Notice>
                </div>
            </>
        );
    }
    if (session.status !== "ready") {
        return (
            <>
                <PageTitle>Time to practise your words.</PageTitle>
                <div className="mt-6">
                    <SessionFallback session={session} />
                </div>
            </>
        );
    }
    if (!session.history.finished.length) {
        return (
            <>
                <PageTitle>Time to practise your words.</PageTitle>
                <div className="mt-6">
                    <Notice
                        title="No missed terms yet"
                        actions={
                            <>
                                {allButton}
                                <Button size="md" color="secondary" href="/dictionary/check">
                                    Take the check
                                </Button>
                            </>
                        }
                    >
                        Once you've finished the check, the terms to review show up here. Until then, practise all of them.
                    </Notice>
                </div>
            </>
        );
    }

    const missed = missedTerms(content.weights, session.history.correct);
    if (!missed.length) {
        return (
            <>
                <PageTitle>Time to practise your words.</PageTitle>
                <div className="mt-6">
                    <Notice title="Nothing missed to practise" actions={allButton}>
                        You got every term right in the check.
                    </Notice>
                </div>
            </>
        );
    }
    return <Flashcards key="missed" slugs={missed} content={content} set="missed" canRetakeMissed />;
};

export const PracticeScreen = () => (
    <CheckPage>
        <Practice />
    </CheckPage>
);
