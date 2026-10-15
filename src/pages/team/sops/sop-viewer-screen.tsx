import { type ReactNode, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, ChevronDown, ClockRewind, Download01 } from "@untitledui/icons";
import type { Key } from "react-aria-components";
import { useLocation, useNavigate, useParams } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { findSopDepartment, sopDeptTabId } from "./sop-departments";
import { SOPS, type SopIndexEntry, type SopVersion, formatSopDate, openSopPdf, sopFileUrl, sopPath } from "./sops-content";

/**
 * `/sop/:id` — the current version of an SOP; `/sop/:id/v0.5` — an earlier one.
 * Every SOP is public: each version's page and PDF are files the site serves from
 * public/sops/, so nothing here needs a sign-in. Documents are self-contained, with
 * their own phase menu and follow-along ticks.
 *
 * `#5.4` in the URL scrolls to task 5.4 once the page has loaded — the renderer gives
 * every task `id="task-5.4"`. Best effort: a hash that matches nothing is ignored.
 */

const Notice = ({ tone, children }: { tone: "error" | "warning"; children: ReactNode }) => (
    <div className="flex flex-1 items-center justify-center p-6">
        <div className="flex max-w-md items-start gap-3 rounded-xl bg-primary p-5 shadow-sm ring-1 ring-secondary">
            <AlertCircle
                className={tone === "error" ? "mt-0.5 size-5 shrink-0 text-error-primary" : "mt-0.5 size-5 shrink-0 text-warning-primary"}
                aria-hidden="true"
            />
            <div>{children}</div>
        </div>
    </div>
);

/** The menu of every version; one without a published copy is listed but cannot be opened. */
const VersionMenu = ({ entry, shown }: { entry: SopIndexEntry; shown: SopVersion }) => {
    const navigate = useNavigate();
    const open = (keys: "all" | Set<Key>) => {
        const version = keys === "all" ? undefined : String([...keys][0] ?? "");
        if (!version || version === shown.version) return;
        navigate(sopPath(entry.id, version === entry.version ? undefined : version));
    };
    return (
        <Dropdown.Root>
            <Button size="sm" color="secondary" iconLeading={ClockRewind} iconTrailing={ChevronDown}>
                <span className="hidden sm:inline">Versions</span>
            </Button>
            <Dropdown.Popover className="w-72">
                <Dropdown.Menu
                    aria-label={`Versions of ${entry.id}`}
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={[shown.version]}
                    disabledKeys={entry.versions.filter((v) => !v.html).map((v) => v.version)}
                    onSelectionChange={open}
                >
                    {entry.versions.map((v) => (
                        <Dropdown.Item
                            key={v.version}
                            id={v.version}
                            textValue={`v${v.version}`}
                            label={`v${v.version}${v.date ? ` · ${formatSopDate(v.date)}` : ""}`}
                            addon={v.version === entry.version ? "Current" : v.html ? undefined : "No copy"}
                        />
                    ))}
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown.Root>
    );
};

const SopViewer = () => {
    const { id = "", version: versionParam } = useParams();
    const { hash } = useLocation();
    const navigate = useNavigate();
    const entry = SOPS.find((s) => s.id.toLowerCase() === id.toLowerCase());
    const dept = entry ? findSopDepartment(entry.dept) : undefined;
    const wanted = versionParam?.replace(/^v/i, "");
    const shown = entry && (wanted ? entry.versions.find((v) => v.version === wanted) : (entry.versions[0] ?? null));
    const isCurrent = !!entry && shown?.version === entry.version;

    const [html, setHtml] = useState<string | null>(null);
    const [error, setError] = useState("");
    const frame = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        if (!entry || !shown?.html) return;
        const path = shown.html;
        let cancelled = false;
        setError("");
        setHtml(null);
        const load = async () => {
            try {
                const response = await fetch(sopFileUrl(path));
                if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) throw new Error("Missing SOP");
                const document = await response.text();
                if (!document.includes(entry.id)) throw new Error("Missing SOP");
                if (!cancelled) setHtml(document);
            } catch {
                if (!cancelled) setError(`This SOP's page could not be loaded (${path}). Please try again.`);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [entry?.id, shown?.html]);

    // Deep link to a task: `/sop/HGM-SOP-WEB-002#5.4` → the renderer's `#task-5.4`.
    const scrollToHash = () => {
        const doc = frame.current?.contentDocument;
        const target = hash.replace(/^#/, "");
        if (!doc || !target) return;
        const el = doc.getElementById(`task-${target}`) ?? doc.getElementById(target);
        if (!el) return;
        // Each phase is a <details class="phase">, collapsed on load. A real fragment
        // navigation makes the browser expand one to reveal its target; scrollIntoView
        // does not, so open every <details> above the task or the scroll goes nowhere.
        // Matched on tagName, not instanceof: these nodes belong to the iframe's realm,
        // where the parent window's HTMLDetailsElement never matches.
        for (let n = el.parentElement; n; n = n.parentElement) {
            if (n.tagName === "DETAILS") (n as HTMLDetailsElement).open = true;
        }
        el.scrollIntoView({ block: "start" });
    };

    // A link to another SOP is `<a target="_top" href="https://hgmportal.com/sop/…">`.
    // Followed by the frame itself it resolves against the portal's URL and loads the
    // whole portal inside the frame (the doubled header), so it goes through the
    // router instead, keeping any `#task` hash. hgmportal.com is matched as well as
    // this origin because the renderer always writes that host, and the link should
    // stay on a deploy preview or localhost too.
    const routeSopLink = (event: MouseEvent) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        // tagName, not instanceof, for the same realm reason as in scrollToHash.
        const link = (event.target as Element | null)?.closest?.("a[href]");
        if (link?.tagName !== "A") return;
        const { origin, hostname, pathname, hash: linkHash, target } = link as HTMLAnchorElement;
        if (target === "_blank" || !pathname.startsWith("/sop/") || (origin !== window.location.origin && hostname !== "hgmportal.com")) return;
        event.preventDefault();
        navigate(pathname + linkHash);
    };

    const onFrameLoad = () => {
        frame.current?.contentDocument?.addEventListener("click", routeSopLink);
        scrollToHash();
    };

    if (!entry) {
        return (
            <Notice tone="error">
                <p className="text-sm font-semibold text-primary">No SOP with the ID “{id}”</p>
                <p className="mt-1 text-sm text-tertiary">Check the ID against the library, or open the SOP dashboard and pick it from there.</p>
                <button
                    type="button"
                    onClick={() => navigate("/dashboard?dept=sops")}
                    className="mt-3 text-sm font-semibold text-brand-secondary hover:underline"
                >
                    Go to SOPs
                </button>
            </Notice>
        );
    }

    return (
        <div className="flex h-screen flex-col bg-secondary">
            <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-secondary bg-primary px-4">
                <div className="flex min-w-0 items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(`/dashboard?dept=sops${dept ? `&tab=${sopDeptTabId(dept.code)}` : ""}`)}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-secondary transition duration-100 ease-linear hover:bg-secondary hover:text-primary"
                    >
                        <ArrowLeft className="size-4" aria-hidden="true" />
                        SOPs
                    </button>
                    <span className="hidden font-mono text-xs text-tertiary sm:inline">
                        {entry.id} · v{shown?.version ?? wanted}
                    </span>
                    <span className="truncate text-sm font-semibold text-primary">{entry.title}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {shown && entry.versions.length > 1 && <VersionMenu entry={entry} shown={shown} />}
                    <button
                        type="button"
                        onClick={() => shown?.pdf && openSopPdf(shown.pdf)}
                        disabled={!shown?.pdf}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-secondary bg-primary px-3 py-1.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:bg-secondary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Download01 className="size-4" aria-hidden="true" />
                        PDF
                    </button>
                </div>
            </header>

            {shown && !isCurrent && (
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-secondary bg-warning-primary px-4 py-2.5">
                    <p className="text-sm text-secondary">
                        <span className="font-semibold text-primary">You're reading v{shown.version}</span>
                        {shown.date ? `, published ${formatSopDate(shown.date)}` : ""}. The current version is v{entry.version}.
                    </p>
                    <button
                        type="button"
                        onClick={() => navigate(sopPath(entry.id))}
                        className="text-sm font-semibold text-brand-secondary transition duration-100 ease-linear hover:underline"
                    >
                        Open the current version
                    </button>
                </div>
            )}

            {!shown || !shown.html ? (
                <Notice tone="warning">
                    <p className="text-sm font-semibold text-primary">
                        {shown ? `v${shown.version} has no published copy` : `${entry.id} has no version ${wanted}`}
                    </p>
                    <p className="mt-1 text-sm text-tertiary">
                        {shown ? "It predates the SOP library, so only its revision-history row survives." : "Pick one from the list of versions."}
                    </p>
                    <button
                        type="button"
                        onClick={() => navigate(sopPath(entry.id))}
                        className="mt-3 text-sm font-semibold text-brand-secondary hover:underline"
                    >
                        Open v{entry.version}, the current version
                    </button>
                </Notice>
            ) : error ? (
                <Notice tone="warning">
                    <p className="text-sm text-secondary">{error}</p>
                </Notice>
            ) : html === null ? (
                <div className="flex flex-1 items-center justify-center">
                    <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent opacity-60" />
                </div>
            ) : (
                // allow-same-origin keeps the page's follow-along ticks in this browser's
                // storage; allow-popups lets links inside the SOP open in a new tab;
                // allow-top-navigation-by-user-activation lets a clicked target="_top" link
                // that routeSopLink misses take the whole tab rather than the frame. No
                // allow-modals: the renderer asks twice instead of calling confirm().
                <iframe
                    ref={frame}
                    title={`${entry.title}, v${shown.version}`}
                    srcDoc={html}
                    onLoad={onFrameLoad}
                    sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
                    className="min-h-0 w-full flex-1 border-0 bg-primary"
                />
            )}
        </div>
    );
};

export const SopViewerScreen = SopViewer;
