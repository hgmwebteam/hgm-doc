import { useMemo } from "react";
import { Button } from "@/components/base/buttons/button";
import { CheckPage, PageTitle } from "@/pages/team/dictionary/check/check-chrome";
import { type CardFaces, FaceWord, FlashcardDeck } from "@/pages/team/dictionary/flashcards";
import { sortProblems } from "@/pages/team/dictionary/tools/sort-model";
import { BrokenNotice, ToolsLoading, VendorIcon, preloadIcon } from "@/pages/team/dictionary/tools/sort-stack";
import { type ToolsData, useToolsData } from "@/pages/team/dictionary/tools/tools-data";
import { type TrainingCard, trainingCards, trainingProblems } from "@/pages/team/dictionary/tools/vendor-icons";

/**
 * `/dictionary/tools/practice` — "Practise the tools": the tools training, behind the team
 * sign-in, on the shared deck (flashcards.tsx). One card for every vendor in the icon manifest
 * (src/data/vendor-icons.json, keyed by slug), not only the 25 in Sort the stack.
 *
 * One way round. Front: the logo and the vendor's name, with its products where the slides name
 * more than one (Amadeus iHotelier and Amadeus Demand360). Back: what it's known for, as the card
 * list's boxes and job lines, then everything else it sells, by name, each in the slides' order.
 * These are the boxes the game accepts for it (vendor-icons.ts, boxClashes).
 *
 * Not behind the game's verify gate: it's built from the manifest, not the unchecked cards. It
 * pauses only if the card list or the manifest is broken. Like every tools page it stores nothing.
 * While a card is up the next two cards' logos load; the first card's loads when Start is pressed.
 */

const TITLE = "Time to practise the tools.";
/** Over everything else a vendor sells, after what it's known for. */
const ALSO_SELLS = "Also sells";
/** The logo on a card's front, drawn from the 512 px file. */
const LOGO = 112;
const preloadLogo = (slug: string) => preloadIcon(slug, LOGO, true);

const toolFaces = (card: TrainingCard): CardFaces => ({
    frontLabel: "Vendor",
    front: (
        <>
            <VendorIcon slug={card.slug} size={LOGO} large />
            <span className="block">
                <FaceWord>{card.name}</FaceWord>
                {card.products.length > 0 && <span className="mt-1 block text-md text-pretty text-tertiary">{card.products.join(" · ")}</span>}
            </span>
        </>
    ),
    backLabel: "Falls under",
    // Spans, not a list: the whole card is a button, which may only hold phrasing content. The hidden ": " and ". "
    // keep a screen reader re-reading the turned card from running one box's job line into the next box's name.
    // What it's known for gets its job line; everything else it sells is names only, so a suite selling six or
    // eight jobs (Mews, Cloudbeds) stays close to a phone's height. Its Got it / Not yet row pins itself in reach
    // regardless (flashcards.tsx).
    back: (
        <span className="flex flex-col gap-2.5">
            {card.main.map((box) => (
                <span key={box.id} className="block">
                    <span className="block text-lg font-semibold text-pretty text-primary">
                        {box.name}
                        <span className="sr-only">: </span>
                    </span>
                    <span className="block text-md text-pretty text-tertiary">
                        {box.job}
                        <span className="sr-only">. </span>
                    </span>
                </span>
            ))}
            {card.also.length > 0 && (
                <span className="mt-1 block border-t border-secondary pt-3.5">
                    <span className="block text-sm font-semibold text-secondary">
                        {ALSO_SELLS}
                        <span className="sr-only">: </span>
                    </span>
                    <span className="mt-0.5 block text-md text-pretty text-primary">{card.also.map((box) => box.name).join(", ")}</span>
                </span>
            )}
        </span>
    ),
    backText: [
        ...card.main.map((box) => `${box.name}: ${box.job}`),
        ...(card.also.length ? [`${ALSO_SELLS}: ${card.also.map((box) => box.name).join(", ")}`] : []),
    ].join(". "),
});

const ToolsDeck = ({ data }: { data: ToolsData }) => {
    const cards = useMemo(() => trainingCards(data.icons, data.cards), [data]);
    const bySlug = useMemo(() => new Map(cards.map((c) => [c.slug, c])), [cards]);
    return (
        <FlashcardDeck
            title={TITLE}
            intro={`${cards.length} cards: a tool's logo and name, then what it falls under and what else it sells.`}
            cardIds={cards.map((c) => c.slug)}
            faces={(slug) => {
                const card = bySlug.get(slug);
                return card ? toolFaces(card) : { frontLabel: "", front: null, backLabel: "", back: null, backText: "" };
            }}
            preload={preloadLogo}
            pinActions
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

const Training = () => {
    const loaded = useToolsData();
    if (loaded.status !== "ready") return <ToolsLoading title={TITLE} failed={loaded.status === "failed"} />;
    const listProblems = sortProblems(loaded.data.cards);
    // A broken card list pauses every tools page; a broken manifest only this one (the game never reads trainingProblems).
    const iconProblems = listProblems.length ? [] : trainingProblems(loaded.data.icons, loaded.data.cards);
    if (!listProblems.length && !iconProblems.length) return <ToolsDeck data={loaded.data} />;
    return (
        <>
            <PageTitle>{TITLE}</PageTitle>
            <div className="mt-6">
                {listProblems.length ? (
                    <BrokenNotice problems={listProblems} />
                ) : (
                    <BrokenNotice problems={iconProblems} line="The vendor icons' manifest has a problem, so the training is paused until it's fixed." />
                )}
            </div>
        </>
    );
};

export const ToolsPracticeScreen = () => (
    <CheckPage>
        <Training />
    </CheckPage>
);
