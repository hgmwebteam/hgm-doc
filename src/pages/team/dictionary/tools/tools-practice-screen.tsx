import { useMemo, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { CheckPage } from "@/pages/team/dictionary/check/check-chrome";
import { type CardFaces, FaceText, FaceWord, FlashcardDeck } from "@/pages/team/dictionary/flashcards";
import { type PracticeCard, type SortData, alsoLine, doesLine, practiceCards, practiceClue } from "@/pages/team/dictionary/tools/sort-model";
import { SortCardsGate } from "@/pages/team/dictionary/tools/sort-stack";

/**
 * `/dictionary/tools/practice` — "Practise the tools": flashcards of Sort the stack's vendors,
 * behind the team sign-in, on the shared deck (flashcards.tsx). One card per vendor in rounds 1
 * and 2, plus Cloudbeds, which is only a round 3 suite.
 *
 * Vendor first: the vendor on the front; its box, any also boxes and its note on the back.
 * Box first: the box, its job line and the note with the vendor's name blanked on the front;
 * the vendor on the back. Cloudbeds has "Does: …" where the others have a box.
 *
 * Like every tools page it stores nothing: the side you pick lasts until you leave or reload the page.
 */

const TITLE = "Time to practise the tools.";

const SIDES = [
    { id: "vendor", label: "Vendor first" },
    { id: "box", label: "Box first" },
] as const;

const Line = ({ children }: { children: string }) => <span className="block text-md font-medium text-pretty text-secondary">{children}</span>;
const JobLine = ({ children }: { children: string }) => <span className="block text-md text-pretty text-tertiary">{children}</span>;

const toolFaces = (card: PracticeCard, side: string): CardFaces => {
    const vendor = <FaceWord>{card.vendor}</FaceWord>;
    const what = card.kind === "card" ? card.box.name : doesLine(card.does);
    const kindLabel = card.kind === "card" ? "Box" : "Suite";

    if (side === "box") {
        const clue = practiceClue(card);
        return {
            frontLabel: kindLabel,
            front:
                card.kind === "card" ? (
                    <>
                        <FaceWord>{card.box.name}</FaceWord>
                        <JobLine>{card.box.job}</JobLine>
                        <FaceText>{clue}</FaceText>
                    </>
                ) : (
                    <>
                        <Line>{what}</Line>
                        <FaceText>{clue}</FaceText>
                    </>
                ),
            backLabel: "Vendor",
            back: vendor,
            backText: card.vendor,
        };
    }

    const also = card.kind === "card" && card.also.length ? alsoLine(card.also) : "";
    return {
        frontLabel: "Vendor",
        front: vendor,
        backLabel: kindLabel,
        back:
            card.kind === "card" ? (
                <>
                    <FaceWord>{card.box.name}</FaceWord>
                    {also && <Line>{also}</Line>}
                    <FaceText>{card.note}</FaceText>
                </>
            ) : (
                <>
                    <Line>{what}</Line>
                    <FaceText>{card.note}</FaceText>
                </>
            ),
        backText: [what, also, card.note].filter(Boolean).join(". "),
    };
};

const EMPTY: CardFaces = { frontLabel: "", front: null, backLabel: "", back: null, backText: "" };

const ToolsDeck = ({ data }: { data: SortData }) => {
    const cards = useMemo(() => practiceCards(data), [data]);
    const byVendor = useMemo(() => new Map(cards.map((c) => [c.vendor, c])), [cards]);
    const [side, setSide] = useState<string>("vendor");
    return (
        <FlashcardDeck
            title={TITLE}
            intro={`${cards.length} cards, one for every vendor in ${data.title}.`}
            cardIds={cards.map((c) => c.vendor)}
            sides={SIDES}
            side={side}
            onSideChange={setSide}
            faces={(id, s) => {
                const card = byVendor.get(id);
                return card ? toolFaces(card, s) : EMPTY;
            }}
            endActions={
                <>
                    <Button size="lg" color="secondary" href="/dictionary/tools/review">
                        Review the tools
                    </Button>
                    <Button size="lg" color="link-gray" href="/dictionary">
                        Back to the dictionary
                    </Button>
                </>
            }
        />
    );
};

export const ToolsPracticeScreen = () => (
    <CheckPage>
        <SortCardsGate title={TITLE}>{(data) => <ToolsDeck data={data} />}</SortCardsGate>
    </CheckPage>
);
