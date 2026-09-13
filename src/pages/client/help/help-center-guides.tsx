/**
 * The four Reference guides linked from the help home's "Reference" row:
 * /{client}/help/guides/property-onboarding, /monthly-reporting,
 * /booking-flow-changes and /team-responsibilities.
 *
 * Each is a short factual page in the help centre's frame and type system. The copy
 * describes only what the system actually does today: which category a request goes
 * under, who it is assigned to, what the request's timeline shows, and that the
 * account manager confirms completion with the client. No dates are promised
 * anywhere here, because the system does not promise any: a date appears on a
 * request only when its category carries a turnaround, and today none does.
 *
 * The guides are rendered INSIDE HelpCenterScreen (view="guide"), so they sit behind
 * the same gate and under the same top bar as the rest of the help centre.
 *
 * House style: no em or en dashes anywhere.
 */
import { Link } from "react-router";
import { Button, Card, Eyebrow } from "@/pages/client/help/help-atoms";

export interface HelpGuide {
    /** The path segment after /help/guides/. */
    slug: string;
    /** The link text on the help home and the page's h1. */
    title: string;
    /** One line under the title, in body/input. */
    lede: string;
    /** The sections, each a heading and its paragraphs. */
    sections: Array<{ heading: string; paragraphs: string[] }>;
    /** The category the guide's request goes under; "any" opens the composer with the selector. */
    topicKey: string;
}

/** In the order the help home's Reference row lists them. */
export const HELP_GUIDES: HelpGuide[] = [
    {
        slug: "property-onboarding",
        title: "Property onboarding",
        lede: "Adding a property to your site, and what happens after you ask.",
        topicKey: "website",
        sections: [
            {
                heading: "What you do",
                paragraphs: [
                    "Raise a request under Website and pages. Put the property's name in the first line, so the request is easy to find in your list. In the description, say what the property needs: a new page, photos, the booking link, a listing to copy from. Attach screenshots or images if you have them.",
                    "You get a reference straight away, and the request appears on your list as Received.",
                ],
            },
            {
                heading: "What happens next",
                paragraphs: [
                    "The request is turned into one task on the web team's board with a named owner. Once that has happened, the request shows as Assigned and the owner's name appears on it, with your account manager's name beside it.",
                    "If the request cannot be routed at that moment, it stays at Received and your account manager is asked to pick it up by hand. Nothing is lost.",
                ],
            },
            {
                heading: "When it is done",
                paragraphs: [
                    "The request moves to Completed when the task is closed, and your account manager confirms the finished property with you. The request stays on your list afterwards for your records.",
                ],
            },
        ],
    },
    {
        slug: "monthly-reporting",
        title: "Monthly reporting",
        lede: "Questions about your report, your dashboard, or the tracking behind them.",
        topicKey: "other",
        sections: [
            {
                heading: "What you do",
                paragraphs: [
                    "Raise a request under Other. Say which report or dashboard you mean and what you are asking for: a number that looks wrong, a metric you want added, a walkthrough of the month. A screenshot of the figure you are looking at helps.",
                    "You get a reference straight away, and the request appears on your list as Received.",
                ],
            },
            {
                heading: "What happens next",
                paragraphs: [
                    "Requests under Other are given out by hand: the request stays at Received and your account manager is asked to pick it up; once they have given it to someone, the request shows as Assigned with that name on it.",
                ],
            },
            {
                heading: "When it is done",
                paragraphs: ["The request moves to Completed when the task is closed, and your account manager confirms the answer or the change with you."],
            },
        ],
    },
    {
        slug: "booking-flow-changes",
        title: "Booking flow changes",
        lede: "Changes to how guests book: your property system, your channels, and the booking pages between them.",
        topicKey: "other",
        sections: [
            {
                heading: "What you do",
                paragraphs: [
                    "Raise a request under Website and pages when the change is on your own site, and under Other for your property management system or a channel (Airbnb, Vrbo). Name the property and the channel and describe the change or the fault: a rate, a minimum stay, dates that show as available when they are not, a listing that needs new photos. Screenshots of what a guest sees are the most useful thing you can attach.",
                    "You get a reference straight away, and the request appears on your list as Received.",
                ],
            },
            {
                heading: "What happens next",
                paragraphs: [
                    "A website change goes straight to the web team with a named owner. Anything under Other is given out by hand: it stays at Received while your account manager is asked to pick it up, and shows as Assigned once they have.",
                ],
            },
            {
                heading: "When it is done",
                paragraphs: [
                    "The request moves to Completed when the task is closed, and your account manager confirms the change with you. If you no longer need it before then, you can withdraw the request from its page and the task is closed.",
                ],
            },
        ],
    },
    {
        slug: "team-responsibilities",
        title: "Team responsibilities",
        lede: "Who picks up each kind of request, and what each person does with it.",
        topicKey: "any",
        sections: [
            {
                heading: "The category decides the owner",
                paragraphs: [
                    "Every request goes under one of two categories: Website and pages, or Other. Website and pages goes straight to the web team: one task on their board, given to whichever of the team has the lightest load that minute, and that person's name appears on your request.",
                    "Other is for everything else. A request under it stays at Received while your account manager is asked to give it to the right person by hand; once they have, the request shows as Assigned with that name on it.",
                ],
            },
            {
                heading: "The owner",
                paragraphs: [
                    "The owner does the work. Your request's timeline records each change of status: Received when you raise it, Assigned when it has an owner, Completed when the work is closed, or Withdrawn if you take it back.",
                ],
            },
            {
                heading: "Your account manager",
                paragraphs: [
                    "Your account manager's name appears on a request once it has an owner. They are asked to step in whenever a request cannot be routed automatically, and they are told the moment a task is closed so they can confirm completion with you. They are also who to ask if a request needs to change hands.",
                ],
            },
        ],
    },
];

export const findHelpGuide = (slug: string): HelpGuide | null => HELP_GUIDES.find((g) => g.slug === slug) ?? null;

/**
 * One guide, in the help centre's column: the eyebrow, the title in display/title,
 * the lede in body/input, a card of sections (heading/section over body/input), then
 * the primary button that opens the composer under the guide's category and a link
 * back to the help home. Body copy is 16px throughout (build notes: 13px is for meta
 * lines only).
 */
export const HelpGuidePage = ({ guide, slug }: { guide: HelpGuide; slug: string }) => {
    const raise = guide.topicKey === "any" ? `/${slug}/help?raise=any` : `/${slug}/help?raise=${encodeURIComponent(guide.topicKey)}`;
    return (
        <article className="mx-auto flex w-full max-w-[680px] flex-col gap-6 sm:gap-10">
            <header className="flex flex-col gap-2">
                <Eyebrow>HELP CENTER</Eyebrow>
                <h1 className="hc-t-display-title text-(--hc-text-primary)">{guide.title}</h1>
                <p className="hc-t-body-input text-(--hc-text-secondary)">{guide.lede}</p>
            </header>
            <Card as="section" className="flex flex-col gap-6">
                {guide.sections.map((s) => (
                    <div key={s.heading} className="flex flex-col gap-2">
                        <h2 className="hc-t-heading-section text-(--hc-text-primary)">{s.heading}</h2>
                        {s.paragraphs.map((p) => (
                            <p key={p} className="hc-t-body-input text-(--hc-text-secondary)">
                                {p}
                            </p>
                        ))}
                    </div>
                ))}
            </Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                <Button to={raise} fill className="sm:w-[176px]">
                    Raise a request
                </Button>
                <Link
                    to={`/${slug}/help`}
                    className="inline-flex min-h-11 items-center rounded-(--hc-radius-sm) hc-t-body-helper text-(--hc-text-brand-secondary) underline"
                >
                    Back to the help centre
                </Link>
            </div>
            {/* The other guides. The help home lists them only from 640px up (the 390
                frame has no Reference row), so on a phone this is the way between them. */}
            <nav aria-labelledby="hc-more-guides" className="flex flex-col gap-2 border-t border-(--hc-border-secondary) pt-6">
                <h2 id="hc-more-guides" className="hc-t-caption-meta text-(--hc-text-tertiary)">
                    MORE GUIDES
                </h2>
                <ul className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-6">
                    {HELP_GUIDES.filter((g) => g.slug !== guide.slug).map((g) => (
                        <li key={g.slug} className="flex">
                            <Link to={`/${slug}/help/guides/${g.slug}`} className="inline-flex min-h-11 items-center rounded-(--hc-radius-sm) hc-t-body-helper text-(--hc-text-brand-secondary) underline">
                                {g.title}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>
        </article>
    );
};
