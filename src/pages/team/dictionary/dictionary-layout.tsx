import type { ReactNode, Ref } from "react";
import { AppShell, CollapsedTopBar, HeaderAvatar, IconRail, RailBottom, useNavCollapsed } from "@/components/application/icon-rail";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { DocsSideMenu } from "@/pages/team/dashboard-screen";

/**
 * The frame every dictionary page sits in: /dictionary, the check, its results and the
 * flashcards. It is exactly the dashboard's arrangement for a Docs tab (icon rail, header
 * row, the Docs menu with Dictionary highlighted, the page in the pane beside it), so moving
 * between Docs pages leaves the menu where it is. Below md, where that doesn't fit, the rail
 * and menu drop out and the pane is the page.
 *
 * `scrollRef` is the pane's own scroller. Scroll it, never the window: AppShell's root is
 * overflow-hidden, so scrollIntoView would drag the rail out of view.
 */
export const DictionaryLayout = ({ children, scrollRef }: { children: ReactNode; scrollRef?: Ref<HTMLDivElement> }) => {
    const { collapsed: navCollapsed, toggle: toggleNav } = useNavCollapsed();
    const roomForChrome = useBreakpoint("md");
    const showChrome = roomForChrome && !navCollapsed;

    return (
        <AppShell
            className="flex flex-col"
            rail={showChrome && <IconRail activeDept="docs" bottom={<RailBottom />} />}
            headerRight={showChrome && <HeaderAvatar />}
        >
            {roomForChrome && navCollapsed && <CollapsedTopBar title="Client Docs" onExpand={toggleNav} />}

            <div className="flex min-h-0 flex-1 gap-2 bg-secondary p-2">
                {showChrome && <DocsSideMenu current="dictionary" onCollapse={toggleNav} />}

                <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-primary shadow-sm">
                    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
                        {children}
                    </div>
                </div>
            </div>
        </AppShell>
    );
};
