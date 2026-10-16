/**
 * The side menu of an EXISTING client's dashboard.
 *
 * An existing client has finished the journey: the forms, the brand work and the funnel
 * are done, so the journey dashboard's eighteen steps are history to them. What they come
 * back for is the Help Centre, so their dashboard IS the help centre (help-center-screen.tsx
 * renders inside this rail when client-stage.ts says "existing") and this menu is short:
 * the help home, raising and following requests, and the guides. No Resources group: the
 * owner cut it (Loom, 16 Oct 2026, "I don't need this section, Resources"). The full
 * dashboard still exists at `?view=full`, which is how the team reaches the editable page.
 *
 * Same surface as the journey dashboard's rail (bg-secondary, 276px, SectionNavItem rows)
 * so a client moved from Onboarding to Existing recognises the place. The portal's semantic
 * tokens, not the help centre's --hc-* ones: the rail sits outside the `hc` frame.
 *
 * No numbers from HiddenGem AI yet: the owner will say how that data should appear before
 * anything is drawn for it (16 Oct 2026).
 */
import { HelpCircle, Image01, LayoutAlt01, LayoutGrid01, MessageQuestionCircle, PlusCircle } from "@untitledui-pro/icons/line";
import { useLocation, useNavigate } from "react-router";
import { BadgeWithDot } from "@/components/base/badges/badges";
import { SectionNavItem } from "@/pages/client/dashboard/dashboard-chrome";
import { initialOf } from "@/pages/client/help/help-atoms";
import { HELP_GUIDES } from "@/pages/client/help/help-center-guides";

const Group = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div role="group" aria-label={label} className="flex shrink-0 flex-row gap-1 md:mt-3 md:flex-col md:first:mt-1">
        {/* Finder-sidebar heading, as the journey rail draws it: quiet, sentence case. Phones
            show the rows alone in one scrolling strip, so the heading is desktop only. */}
        <p className="mb-0.5 hidden px-2.5 py-2 text-[13px] font-medium text-secondary md:block">{label}</p>
        {children}
    </div>
);

export const ExistingDashboardRail = ({
    slug,
    clientName,
    logoUrl,
    isStaff,
    email,
    name,
    onSignOut,
}: {
    /** The full "-dashboard" slug. */
    slug: string;
    clientName: string;
    logoUrl: string;
    /** A HiddenGem Media viewer gets the way into the editable dashboard. */
    isStaff: boolean;
    /** Who is signed in. Drawn at the foot of the rail, where the owner wanted the profile
     *  (Loom, 16 Oct 2026), instead of in the help centre's top bar. */
    email: string;
    name?: string;
    onSignOut: () => void;
}) => {
    const person = (name ?? "").trim() || email.split("@")[0];
    const avatar =
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-primary text-sm font-semibold text-brand-secondary ring-1 ring-brand";
    const account = (
        <div className="flex items-center gap-3">
            <span role="img" aria-label={`Account, ${person}`} className={avatar}>
                {initialOf(person)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-primary">{person}</span>
                <span className="truncate text-xs text-tertiary">{email}</span>
            </span>
            <button
                type="button"
                onClick={onSignOut}
                className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-brand-secondary transition duration-100 ease-linear hover:bg-primary"
            >
                Sign out
            </button>
        </div>
    );
    const navigate = useNavigate();
    const { pathname, search } = useLocation();
    const params = new URLSearchParams(search);
    const base = `/${slug}`;
    const onHelp = pathname.startsWith(`${base}/help`);
    const raising = onHelp && params.has("raise");
    const onRequests = pathname.startsWith(`${base}/help/requests`);
    const onGuides = pathname.startsWith(`${base}/help/guides/`);
    const onHome = !raising && !onRequests && !onGuides;

    return (
        <aside className="flex w-full shrink-0 flex-col border-secondary bg-secondary md:sticky md:top-0 md:h-dvh md:w-[276px] md:border-r">
            <div className="flex items-center gap-3 px-4 pt-5 pb-3 md:pb-4">
                <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary ring-1 ring-secondary">
                    {logoUrl ? (
                        <img src={logoUrl} alt={`${clientName || "Client"} logo`} className="size-full object-contain p-1" draggable={false} />
                    ) : (
                        <Image01 className="size-5 text-fg-quaternary" aria-hidden="true" />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-primary">{clientName || "Your dashboard"}</p>
                    <BadgeWithDot color="success" size="sm" type="pill-color">
                        Existing client
                    </BadgeWithDot>
                </div>
                {/* On a phone the rail is a strip at the top, so the person sits in the
                    identity row; from md up they move to the foot of the column. */}
                <button
                    type="button"
                    onClick={onSignOut}
                    title={`${person}. Sign out`}
                    aria-label={`Account, ${person}. Sign out`}
                    className={`${avatar} md:hidden`}
                >
                    {initialOf(person)}
                </button>
            </div>

            {/* One strip that scrolls sideways on a phone, a column on desktop. Each row keeps
                its own width in the strip (SectionNavItem is w-full) and fills the column. */}
            <nav aria-label="Dashboard" className="flex flex-row gap-2 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:gap-0 md:overflow-visible">
                <div className="min-w-max shrink-0 md:min-w-0 md:first:mt-1">
                    <SectionNavItem icon={LayoutAlt01} label="Overview" current={onHome} onClick={() => navigate(base)} />
                </div>
                <Group label="Help Centre">
                    <div className="min-w-max md:min-w-0">
                        <SectionNavItem icon={PlusCircle} label="Raise a request" current={raising} onClick={() => navigate(`${base}/help?raise=any`)} />
                    </div>
                    <div className="min-w-max md:min-w-0">
                        <SectionNavItem
                            icon={MessageQuestionCircle}
                            label="Your requests"
                            current={onRequests}
                            onClick={() => navigate(`${base}/help/requests`)}
                        />
                    </div>
                    <div className="min-w-max md:min-w-0">
                        <SectionNavItem
                            icon={HelpCircle}
                            label="Guides"
                            current={onGuides}
                            onClick={() => navigate(`${base}/help/guides/${HELP_GUIDES[0].slug}`)}
                        />
                    </div>
                </Group>
                {isStaff && (
                    <Group label="HiddenGem team">
                        <div className="min-w-max md:min-w-0">
                            <SectionNavItem
                                icon={LayoutGrid01}
                                label="Full dashboard"
                                current={false}
                                onClick={() => navigate({ pathname: base, search: "?view=full" })}
                            />
                        </div>
                    </Group>
                )}
            </nav>

            {/* No theme toggle here: the help centre opts out of the floating one and the
                page follows the system (theme-provider), the same as every help route today. */}
            <div className="mt-auto hidden flex-col gap-3 border-t border-secondary px-4 py-3 md:flex">
                {account}
                {/* The same lockup as the journey rail's foot: the gem beside the name, a
                    link out to hiddengem.media in a new tab so a client never loses their page. */}
                <a
                    href="https://hiddengem.media"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Visit HiddenGem Media"
                    className="flex items-center gap-3 rounded-lg transition duration-100 ease-linear hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                    <img src="/hgm logo/Favicon ON LIGHT.svg" alt="" className="size-8" draggable={false} />
                    <span className="truncate text-sm font-semibold text-primary">HiddenGem Media</span>
                </a>
            </div>
        </aside>
    );
};
