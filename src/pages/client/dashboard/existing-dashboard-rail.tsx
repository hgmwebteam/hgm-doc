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
 * Same surface as the journey dashboard's rail (bg-secondary, 276px, SectionNavItem rows,
 * the search box under the identity, the gem and the theme toggle at the foot) so a client
 * moved from Onboarding to Existing recognises the place. Nobody's name or address is shown
 * (owner, Loom 16 Oct 2026, "whoever signed in, I don't need to see this"); Sign out is a
 * quiet link at the foot. The portal's semantic tokens, not the help centre's --hc-* ones:
 * the rail sits outside the `hc` frame.
 *
 * No numbers from HiddenGem AI yet: the owner will say how that data should appear before
 * anything is drawn for it (16 Oct 2026).
 */
import { Edit05, Image01, LayoutAlt01, LayoutGrid01, MessageQuestionCircle, Moon01, PlusCircle, Sun } from "@untitledui-pro/icons/line";
import { useLocation, useNavigate } from "react-router";
import { ClientSearchBar, EyeGlyph, SectionNavItem } from "@/pages/client/dashboard/dashboard-chrome";
import { HELP_GUIDES } from "@/pages/client/help/help-center-guides";
import { useTheme } from "@/providers/theme-provider";

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
    previewing = false,
    onTogglePreview,
    editing = false,
    onEdit,
    onSignOut,
}: {
    /** The full "-dashboard" slug. */
    slug: string;
    clientName: string;
    logoUrl: string;
    /** A HiddenGem Media viewer gets the way into the editable dashboard. */
    isStaff: boolean;
    /** Staff looking at the page as the client would see it: no staff rows, no staff banner.
     *  Toggled by clicking the client's logo or name, as on the journey rail. */
    previewing?: boolean;
    onTogglePreview?: () => void;
    /** Staff: the access panel ("Who can open this dashboard") is open. */
    editing?: boolean;
    onEdit?: () => void;
    onSignOut: () => void;
}) => {
    const { theme, setTheme } = useTheme();
    const isDark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const logo = (
        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary ring-1 ring-secondary">
            {logoUrl ? (
                <img src={logoUrl} alt={`${clientName || "Client"} logo`} className="size-full object-contain p-1" draggable={false} />
            ) : (
                <Image01 className="size-6 text-fg-quaternary" aria-hidden="true" />
            )}
        </span>
    );
    const toggle = (extra: string) => (
        <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className={`flex size-9 shrink-0 items-center justify-center rounded-full border border-secondary bg-primary text-secondary transition duration-100 ease-linear hover:bg-tertiary hover:text-primary ${extra}`}
        >
            {isDark ? <Sun className="size-[18px]" aria-hidden="true" /> : <Moon01 className="size-[18px]" aria-hidden="true" />}
        </button>
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
    /** Everything the menu reaches, for the search box: the rows and the four guides. */
    const hits = [
        { id: base, label: "Overview" },
        { id: `${base}/help?raise=any`, label: "Raise a request" },
        { id: `${base}/help/requests`, label: "Your requests" },
        ...HELP_GUIDES.map((g) => ({ id: `${base}/help/guides/${g.slug}`, label: g.title, sub: "Guide" })),
    ];

    return (
        <aside className="flex w-full shrink-0 flex-col border-secondary bg-secondary md:sticky md:top-0 md:h-dvh md:w-[276px] md:border-r">
            {/* Identity: a bigger logo and the name alone. No status badge; the owner cut it
                ("remove Existing, have the logo bigger", Loom 16 Oct 2026). */}
            <div className="flex items-center gap-3 border-b border-secondary px-4 py-4">
                {/* For the team the logo and name are one button that flips the client view on and
                    off, with the eye on hover as the journey rail has it. A client sees plain text. */}
                {isStaff && onTogglePreview ? (
                    <button
                        type="button"
                        onClick={onTogglePreview}
                        title={previewing ? "Back to the team view" : "View this dashboard as the client sees it"}
                        className="group/name flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left"
                    >
                        {logo}
                        <span className="flex min-w-0 flex-1 flex-col">
                            <span className="flex items-center gap-1.5">
                                <span className="truncate text-base font-semibold text-primary transition duration-100 ease-linear group-hover/name:text-brand-secondary">
                                    {clientName || "Your dashboard"}
                                </span>
                                <span
                                    aria-hidden="true"
                                    className={`shrink-0 text-fg-quaternary transition duration-100 ease-linear ${previewing ? "" : "opacity-0 group-hover/name:opacity-100"}`}
                                >
                                    <EyeGlyph />
                                </span>
                            </span>
                            {previewing && <span className="text-xs text-tertiary">Client view. Click to go back.</span>}
                        </span>
                    </button>
                ) : (
                    <>
                        {logo}
                        <p className="min-w-0 flex-1 truncate text-base font-semibold text-primary">{clientName || "Your dashboard"}</p>
                    </>
                )}
                {/* On a phone the rail is a strip with no foot, so the toggle sits here. */}
                {toggle("md:hidden")}
            </div>

            {/* Search, directly under the identity as the journey rail has it. A hit is a route. */}
            <div className="hidden px-3 pt-3 pb-3 md:block">
                <ClientSearchBar hits={hits} onSelect={(to) => navigate(to)} />
            </div>

            {/* One strip that scrolls sideways on a phone, a column on desktop. Each row keeps
                its own width in the strip (SectionNavItem is w-full) and fills the column. */}
            <nav aria-label="Dashboard" className="flex flex-row gap-2 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:gap-0 md:overflow-visible">
                <div className="min-w-max shrink-0 md:min-w-0 md:first:mt-1">
                    <SectionNavItem icon={LayoutAlt01} label="Overview" current={onHome} onClick={() => navigate(base)} />
                </div>
                <Group label="Help Center">
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
                </Group>
                {isStaff && !previewing && (
                    <Group label="HiddenGem team">
                        {onEdit && (
                            <div className="min-w-max md:min-w-0">
                                <SectionNavItem icon={Edit05} label="Edit dashboard" current={editing} onClick={onEdit} />
                            </div>
                        )}
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
            {/* The foot, as the journey rail draws it: the gem and the name (a link out to
                hiddengem.media in a new tab, so a client never loses their page) and the
                theme toggle. Sign out is the one quiet line under it. */}
            <div className="mt-auto hidden flex-col gap-2 border-t border-secondary px-4 py-3 md:flex">
                <div className="flex items-center gap-3">
                    <a
                        href="https://hiddengem.media"
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Visit HiddenGem Media"
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg transition duration-100 ease-linear hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                        <img src="/hgm logo/Favicon ON LIGHT.svg" alt="" className="size-8" draggable={false} />
                        <span className="truncate text-sm font-semibold text-primary">HiddenGem Media</span>
                    </a>
                    {toggle("")}
                </div>
                <div className="flex items-center gap-3">
                    {/* The client's own password (help-center-screen.tsx, PasswordPanel). */}
                    <button
                        type="button"
                        onClick={() => navigate(`${base}/help?password=set`)}
                        className="rounded-md px-1 text-xs text-tertiary transition duration-100 ease-linear hover:text-primary"
                    >
                        Set a password
                    </button>
                    <button
                        type="button"
                        onClick={onSignOut}
                        className="rounded-md px-1 text-xs text-tertiary transition duration-100 ease-linear hover:text-primary"
                    >
                        Sign out
                    </button>
                </div>
            </div>
        </aside>
    );
};
