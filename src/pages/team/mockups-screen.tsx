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

export function MockupsScreen() {
    const [params, setParams] = useSearchParams();
    const page = PAGES.find((p) => p.id === params.get("tab")) ?? PAGES[0];
    const src = `${ORIGIN}/${page.id}/`;

    return (
        <div className="flex h-dvh flex-col bg-primary">
            <header className="flex items-center justify-between gap-4 border-b border-secondary px-4 py-3 md:px-6">
                <Tabs selectedKey={page.id} onSelectionChange={(key) => setParams({ tab: String(key) }, { replace: true })}>
                    <TabList type="button-gray" size="sm" items={PAGES}>
                        {(item) => <Tab id={item.id} label={item.label} />}
                    </TabList>
                </Tabs>
                <Button href={src} target="_blank" rel="noreferrer" color="tertiary" size="sm" iconTrailing={LinkExternal01}>
                    Open on hiddengem.media
                </Button>
            </header>
            <iframe key={src} src={src} title={`${page.label} reference`} className="w-full flex-1 border-0" />
        </div>
    );
}
