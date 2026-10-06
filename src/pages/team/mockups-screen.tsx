import { LinkExternal01 } from "@untitledui/icons";
import { useSearchParams } from "react-router";
import { Tab, TabList, Tabs } from "@/components/application/tabs/tabs";
import { Button } from "@/components/base/buttons/button";

// The hiddengem.media design references, shown LIVE rather than copied — ship a
// change to /mockup there and it is here on the next load, with no port to
// redo. That site allows hgmportal.com to frame these three paths only (CSP
// frame-ancestors in its next.config.mjs); every other page of it still refuses.
//
// The older copies at /mockup, /animation and /background (ported 2026-09-01)
// do not update — this page supersedes them.
//
// VITE_MOCKUP_ORIGIN points it at a local hiddengem.media dev server.
const ORIGIN = import.meta.env.VITE_MOCKUP_ORIGIN ?? "https://hiddengem.media";

const PAGES = [
    { id: "mockup", label: "Mockup" },
    { id: "animation", label: "Animation" },
    { id: "background", label: "Background" },
];

// hiddengem.media's own dashboard menu, which it shows as a left rail and hides when
// framed here. These pages refuse to be framed, so they open on hiddengem.media in a
// new tab. ponytail: copied from its src/app/log/nav.ts (2026-10-06); a page added
// there needs adding here too.
const DASHBOARD = [
    { label: "Dashboard", href: "/log" },
    { label: "Pages", href: "/dashboard" },
    { label: "Marketing slides", href: "/marketing" },
    { label: "Deck copies", href: "/marketing/overview" },
    { label: "Rebuild plan", href: "/log/plan" },
    { label: "Project log", href: "/log/project" },
    { label: "Marketing deck log", href: "/marketing-logs" },
    { label: "Updates", href: "/update" },
    { label: "Design system", href: "/log/design" },
    { label: "Links", href: "/manual/links" },
    { label: "Architecture", href: "/manual/architecture" },
    { label: "Manual", href: "/manual" },
    { label: "Feedback", href: "/feedback" },
    { label: "Prompt library", href: "/log/prompts" },
];

export function MockupsScreen() {
    const [params, setParams] = useSearchParams();
    const page = PAGES.find((p) => p.id === params.get("tab")) ?? PAGES[0];
    const src = `${ORIGIN}/${page.id}/`;

    return (
        <div className="flex h-dvh flex-col bg-primary">
            <header className="flex items-center gap-4 border-b border-secondary px-4 py-3 md:px-6">
                <Tabs className="shrink-0" selectedKey={page.id} onSelectionChange={(key) => setParams({ tab: String(key) }, { replace: true })}>
                    <TabList type="button-gray" size="sm" items={PAGES}>
                        {(item) => <Tab id={item.id} label={item.label} />}
                    </TabList>
                </Tabs>
                <span className="h-5 w-px shrink-0 bg-border-secondary" aria-hidden="true" />
                <nav aria-label="hiddengem.media dashboard" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                    {DASHBOARD.map((item) => (
                        <a
                            key={item.href}
                            href={`${ORIGIN}${item.href}`}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 rounded-md px-2.5 py-1.5 text-sm font-semibold whitespace-nowrap text-quaternary transition duration-100 ease-linear hover:bg-primary_hover hover:text-secondary"
                        >
                            {item.label}
                        </a>
                    ))}
                </nav>
                <Button href={src} target="_blank" rel="noreferrer" color="tertiary" size="sm" iconTrailing={LinkExternal01} className="shrink-0">
                    Open on hiddengem.media
                </Button>
            </header>
            <iframe key={src} src={src} title={`${page.label} reference`} className="w-full flex-1 border-0" />
        </div>
    );
}
