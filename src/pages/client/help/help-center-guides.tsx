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
                    "Raise a request under Website and pages. Put the property's name in the first line; that line becomes the title of the task the team works from. In the description, say what the property needs: a new page, photos, the booking link, a listing to copy from. Attach screenshots or images if you have them.",
                    "You get a reference straight away, and the request appears on your list as Received.",
                ],
            },
            {
                heading: "What happens next",
                paragraphs: [
                    "The request is turned into one task on the web team's board with a named owner. Once that has happened, the request shows as Assigned and the owner's name appears on it. When the owner starts, it moves to In progress, and any update the team writes on the task appears on the request's timeline.",
                    "If the category cannot be routed at that moment, the request stays at Received and your account manager is asked to pick it up by hand. Nothing is lost.",
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
        topicKey: "reporting-tracking",
        sections: [
            {
                heading: "What you do",
                paragraphs: [
                    "Raise a request under Reporting and tracking. Say which report or dashboard you mean and what you are asking for: a number that looks wrong, a metric you want added, a walkthrough of the month. A screenshot of the figure you are looking at helps.",
                    "You get a reference straight away, and the request appears on your list as Received.",
                ],
            },
            {
                heading: "What happens next",
                paragraphs: [
                    "The request is turned into one task with a named owner on the team, and the request shows as Assigned with that name on it. Work in progress and any notes the team writes appear on the request's timeline, so you can see where it stands without asking.",
                    "If the category cannot be routed at that moment, the request stays at Received and your account manager is asked to pick it up by hand.",
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
        topicKey: "booking-listings",
        sections: [
            {
                heading: "What you do",
                paragraphs: [
                    "Raise a request under Booking and listings. Name the property and the channel (your property management system, Airbnb, Vrbo, your own site) and describe the change or the fault: a rate, a minimum stay, dates that show as available when they are not, a listing that needs new photos. Screenshots of what a guest sees are the most useful thing you can attach.",
                    "You get a reference straight away, and the request appears on your list as Received.",
                ],
            },
            {
                heading: "What happens next",
                paragraphs: [
                    "The request is turned into one task with a named owner, and the request shows as Assigned with that name on it. When work starts it shows as In progress, and updates from the team appear on the request's timeline.",
                    "If the category cannot be routed at that moment, the request stays at Received and your account manager is asked to pick it up by hand.",
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
                    "Every request goes under one of six categories: Website and pages, Paid media, Content and social, Booking and listings, Reporting and tracking, and Other. Each category has its own board and its own owner on the team, and a request is turned into one task on that board with that owner. The owner's name appears on your request once it is assigned.",
                    "Other is for anything that does not fit the five. It is read on receipt and given to the right person by hand.",
                ],
            },
            {
                heading: "The owner",
                paragraphs: [
                    "The owner does the work and writes updates on the task. Those updates appear on your request's timeline, along with each change of status: Received, Assigned, In progress, Completed.",
                ],
            },
            {
                heading: "Your account manager",
                paragraphs: [
                    "Your account manager is named on every request. They are asked to step in whenever a request cannot be routed automatically, and they are told the moment a task is closed so they can confirm completion with you. They are also who to ask if a request needs to change hands.",
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
        </article>
    );
};
