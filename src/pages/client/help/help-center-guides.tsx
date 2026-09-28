/**
 * The four Reference guides linked from the help home's "Reference" row:
 * /{client}/help/guides/property-onboarding, /monthly-reporting,
 * /booking-flow-changes and /team-responsibilities.
 *
 * Each is a short factual page in the help centre's frame and type system. The copy
 * describes only what the system actually does today: what goes through a request (Website
 * and pages, the one category since 28 Sep 2026) and what goes to the account manager
 * instead, what a request shows as it moves, and that the account manager confirms
 * completion. No date, turnaround or named owner is promised anywhere here: a client is
 * shown none of them (owner, 28 Sep 2026), and "Other" is gone with its category.
 *
 * The completion email is mentioned ONLY when the switch is "on" (completion-email-mode.ts):
 * in "staff" mode no client can enter an address. The sentence says where the notice goes,
 * never that one is sent, because the switch is on before the platform can send.
 *
 * The guides are rendered INSIDE HelpCenterScreen (view="guide"), so they sit behind
 * the same gate and under the same top bar as the rest of the help centre.
 *
 * House style: no em or en dashes anywhere.
 */
import { Link } from "react-router";
import { COMPLETION_EMAIL_MODE } from "@/pages/client/help/completion-email-mode";
import { Button, Card, Eyebrow } from "@/pages/client/help/help-atoms";

/** Added to each guide's "when it is done" paragraph only while clients can enter an address. */
const EMAIL_TOO = COMPLETION_EMAIL_MODE === "on" ? " The email address you gave on the request is where its completion notice goes." : "";

export interface HelpGuide {
    /** The path segment after /help/guides/. */
    slug: string;
    /** The link text on the help home and the page's h1. */
    title: string;
    /** One line under the title, in body/input. */
    lede: string;
    /** The sections, each a heading and its paragraphs. */
    sections: Array<{ heading: string; paragraphs: string[] }>;
    /** The category the guide's Raise a request opens ("any": the composer decides). Absent: the guide sends people to their account manager, so it offers no request. */
    raise?: string;
}

/** In the order the help home's Reference row lists them. */
export const HELP_GUIDES: HelpGuide[] = [
    {
        slug: "property-onboarding",
        title: "Property onboarding",
        lede: "Adding a property to your site, and what happens after you ask.",
        raise: "website",
        sections: [
            {
                heading: "What you do",
                paragraphs: [
                    "Raise a request under Website and pages. Put the property's name in the first line, so the request is easy to find in your list. In the description, say what the property needs: a new page, photos, the booking link, a listing to copy from. Attach screenshots, photos, PDFs or spreadsheets if you have them.",
                    "You get a reference straight away, and the request appears on your list as Received.",
                ],
            },
            {
                heading: "What happens next",
                paragraphs: [
                    "The request is turned into one task on the web team's board, and the team takes it on. Once that has happened, the request shows as Assigned, with your account manager's name on it.",
                    "If the request cannot be routed at that moment, it stays at Received and your account manager is asked to pick it up by hand. Nothing is lost.",
                ],
            },
            {
                heading: "When it is done",
                paragraphs: [
                    `The request moves to Completed when the task is closed, and your account manager confirms the finished property with you.${EMAIL_TOO} The request stays on your list afterwards for your records.`,
                ],
            },
        ],
    },
    {
        slug: "monthly-reporting",
        title: "Monthly reporting",
        lede: "Questions about your report, your dashboard, or the tracking behind them.",
        sections: [
            {
                heading: "What you do",
                paragraphs: [
                    "Ask your account manager: questions about reporting go to them directly rather than through a request. Say which report or dashboard you mean and what you are asking for: a number that looks wrong, a metric you want added, a walkthrough of the month. A screenshot of the figure you are looking at helps.",
                ],
            },
            {
                heading: "What happens next",
                paragraphs: [
                    "Your account manager answers it, or brings in the person who can. If the answer turns out to be a change on your website, such as a tracking tag on a page or a form that does not send, they may ask you to raise it here under Website and pages so the web team can take it on.",
                ],
            },
        ],
    },
    {
        slug: "booking-flow-changes",
        title: "Booking flow changes",
        lede: "Changes to how guests book: your property system, your channels, and the booking pages between them.",
        raise: "website",
        sections: [
            {
                heading: "What you do",
                paragraphs: [
                    "Raise a request under Website and pages when the change is on your own site: a booking page, a booking button, dates that show as available on the site when they are not. Name the property and describe the change or the fault. Screenshots of what a guest sees are the most useful thing you can attach, alongside any PDF or spreadsheet that shows the change.",
                    "For your property management system or a channel (Airbnb, Vrbo), such as a rate, a minimum stay or a listing that needs new photos, ask your account manager instead.",
                    "You get a reference straight away, and the request appears on your list as Received.",
                ],
            },
            {
                heading: "What happens next",
                paragraphs: [
                    "A website change goes straight to the web team, and the request shows as Assigned once the team has taken it on. Your account manager looks after the property system and channel changes with you directly.",
                ],
            },
            {
                heading: "When it is done",
                paragraphs: [
                    `The request moves to Completed when the task is closed, and your account manager confirms the change with you.${EMAIL_TOO} If you no longer need it before then, you can withdraw the request from its page and the task is closed.`,
                ],
            },
        ],
    },
    {
        slug: "team-responsibilities",
        title: "Team responsibilities",
        lede: "What goes through a request, who looks after the rest, and what each request shows.",
        raise: "any",
        sections: [
            {
                heading: "Where a request goes",
                paragraphs: [
                    "Requests are for your website and its pages, and each goes straight to the web team: one task on their board, given to whoever on the team has the lightest load.",
                    "Questions about your reporting, your property system or your channels go to your account manager directly rather than through a request.",
                ],
            },
            {
                heading: "What a request shows",
                paragraphs: [
                    "Each request shows where it stands: Received when you raise it, Assigned once the team has taken it on, In progress when work starts, and Completed when the work is closed, or Withdrawn if you take it back. When the team has news for you, it appears on the request under Team updates, with the name of the person who wrote it and the time.",
                ],
            },
            {
                heading: "Your account manager",
                paragraphs: [
                    `Your account manager's name appears on each request once the team has it. They are asked to step in whenever a request cannot be routed automatically, and they are told the moment a task is closed so they can confirm completion with you.${EMAIL_TOO}`,
                ],
            },
        ],
    },
];

export const findHelpGuide = (slug: string): HelpGuide | null => HELP_GUIDES.find((g) => g.slug === slug) ?? null;

/**
 * One guide, in the help centre's column: the eyebrow, the title in display/title,
 * the lede in body/input, a card of sections (heading/section over body/input), then
 * the primary button that opens the composer under the guide's category (none on a guide
 * that sends people to their account manager) and a link back to the help home. Body copy is 16px throughout (build notes: 13px is for meta
 * lines only).
 */
export const HelpGuidePage = ({ guide, slug }: { guide: HelpGuide; slug: string }) => {
    const raise = guide.raise ? `/${slug}/help?raise=${encodeURIComponent(guide.raise)}` : null;
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
                {raise && (
                    <Button to={raise} fill className="sm:w-[176px]">
                        Raise a request
                    </Button>
                )}
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
