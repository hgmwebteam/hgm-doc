import { useRef } from "react";
import { useSearchParams } from "react-router";
import { SortCardsGate, SortStack, StandaloneFrame } from "@/pages/team/dictionary/tools/sort-stack";

/**
 * `/acumen-sort` — Sort the stack with no sign-in: the backup for the live training session, in
 * case the team sign-in gets in the way on someone's phone. Same game and same card list as
 * /dictionary/tools/review, in a plain frame with no team chrome. `?present` works here too.
 *
 * Public on purpose, so it stores and sends nothing, and it's in RESERVED_SLUGS
 * (template-one-screen.tsx) so no client page can take the slug.
 */
export const AcumenSortScreen = () => {
    const [params] = useSearchParams();
    const present = params.has("present");
    const scrollRef = useRef<HTMLDivElement>(null);
    return (
        <StandaloneFrame present={present} scrollRef={scrollRef}>
            <SortCardsGate>{(data) => <SortStack data={data} present={present} scrollRef={scrollRef} />}</SortCardsGate>
        </StandaloneFrame>
    );
};
