import { useRef } from "react";
import { useSearchParams } from "react-router";
import { TeamGate } from "@/pages/team/dashboard-screen";
import { CheckPage } from "@/pages/team/dictionary/check/check-chrome";
import { SortCardsGate, StandaloneFrame } from "@/pages/team/dictionary/tools/sort-stack";

/**
 * `/dictionary/tools/review` — "Review the tools": Sort the stack, behind the team sign-in, in
 * the dictionary's Docs frame. `?present` is the presenter's large-type layout for screen
 * sharing (Round 1 / 2 / 3 tabs, Show answers): still behind TeamGate, but full width, without
 * the icon rail and the Docs menu. The same game with no sign-in is /acumen-sort.
 */
export const ToolsReviewScreen = () => {
    const [params] = useSearchParams();
    const present = params.has("present");
    const scrollRef = useRef<HTMLDivElement>(null);
    const game = <SortCardsGate present={present} scrollRef={scrollRef} />;

    if (present)
        return (
            <TeamGate>
                <StandaloneFrame present scrollRef={scrollRef}>
                    {game}
                </StandaloneFrame>
            </TeamGate>
        );
    return <CheckPage scrollRef={scrollRef}>{game}</CheckPage>;
};
