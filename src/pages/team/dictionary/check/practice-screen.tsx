import { useState } from "react";
import { useSearchParams } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { CheckPage, Notice, PageTitle, SessionFallback, SignInCard } from "@/pages/team/dictionary/check/check-chrome";
import { flashcardMaskWords, maskText } from "@/pages/team/dictionary/check/check-model";
import { missedTerms } from "@/pages/team/dictionary/check/check-score";
import { type CardSide, readSide, writeSide } from "@/pages/team/dictionary/check/practice-model";
import { type CheckContent, useCheckSession } from "@/pages/team/dictionary/check/use-check-session";
import { entryPath } from "@/pages/team/dictionary/dictionary-data";
import type { DictionaryEntry } from "@/pages/team/dictionary/dictionary-model";
import { type CardFaces, FaceText, FaceWord, FlashcardDeck, Formula } from "@/pages/team/dictionary/flashcards";

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

const SIDES = [
    { id: "word", label: "Word first" },
    { id: "definition", label: "Definition first" },
] as const;

/** A term's two faces: the term (with its expansion) and its definition, plus the formula if it has one. */
const termFaces = (entry: DictionaryEntry, side: string, bank: CheckContent["bank"]): CardFaces => {
    const word = <FaceWord>{entry.term}</FaceWord>;
    if (side === "definition") {
        // The definition with the term blanked, so the card doesn't give away its own answer.
        return {
            frontLabel: "Definition",
            front: <FaceText>{maskText(entry.gloss, flashcardMaskWords(entry, bank))}</FaceText>,
            backLabel: "Word",
            back: word,
            backText: entry.term,
        };
    }
    return {
        frontLabel: "Word",
        front: word,
        backLabel: "Definition",
        back: (
            <>
                <FaceText>{entry.gloss}</FaceText>
                {entry.formula?.trim() && <Formula formula={entry.formula} />}
            </>
        ),
        backText: `${entry.gloss}${entry.formula ? ` Formula: ${entry.formula}` : ""}`,
    };
};

const Flashcards = ({ slugs, content, set, canRetakeMissed }: { slugs: string[]; content: CheckContent; set: "missed" | "all"; canRetakeMissed: boolean }) => {
    const [side, setSide] = useState<CardSide>(readSide);
    return (
        <FlashcardDeck
            title="Time to practise your words."
            intro={
                set === "missed"
                    ? `${plural(slugs.length, "card", "cards")}, one for each term you missed in the check.`
                    : `${plural(slugs.length, "card", "cards")}, one for every term in the check.`
            }
            cardIds={slugs}
            sides={SIDES}
            side={side}
            onSideChange={(s) => {
                const next: CardSide = s === "definition" ? "definition" : "word";
                setSide(next);
                writeSide(next);
            }}
            faces={(slug, s) => {
                const entry = content.dict.bySlug.get(slug);
                return entry ? termFaces(entry, s, content.bank) : { frontLabel: "", front: null, backLabel: "", back: null, backText: "" };
            }}
            entryLink={(slug) => ({ href: entryPath(slug), label: "See the full entry" })}
            endActions={
                <>
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
                </>
            }
        />
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
