import { type ComponentProps, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, XClose } from "@untitledui/icons";
import { AnimatePresence, motion } from "motion/react";
import { cx } from "@/utils/cx";
import { type AlertHits, type DirectoryClient, alertsFor, byName, clientId, fmtAdded, managerOf } from "./directory-model";
import { EASE_SOFT, Eyebrow, FAST, HostingBadge, SOFT } from "./directory-ui";

/** One check that some clients fail: a ring that fills to their share, and the clients behind a click. */
const AlertItem = ({ alert, total, onOpen }: { alert: AlertHits; total: number; onOpen: (id: string, alertId: string) => void }) => {
    const [open, setOpen] = useState(false);
    const share = total ? alert.hits.length / total : 0;
    return (
        <div
            data-pop
            className={cx(
                "rounded-xl border transition-colors duration-100 ease-linear",
                open ? "border-error_subtle/50 bg-primary/50" : "border-transparent hover:bg-primary/50",
            )}
        >
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left"
            >
                <span className="relative grid size-11 shrink-0 place-items-center" aria-hidden="true">
                    <svg className="absolute inset-0 -rotate-90" width="44" height="44" viewBox="0 0 44 44">
                        <circle cx="22" cy="22" r="17" className="fill-none stroke-fg-quaternary opacity-25" strokeWidth="3.5" />
                        <motion.circle
                            cx="22"
                            cy="22"
                            r="17"
                            className={"fill-none stroke-fg-error-secondary"}
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: share }}
                            transition={{ duration: 0.7, ease: EASE_SOFT }}
                        />
                    </svg>
                    <span className={"relative text-xs font-bold text-error-primary tabular-nums"}>{alert.hits.length}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-primary">{alert.rule.label}</span>
                    <span className="truncate text-xs text-tertiary">{alert.rule.hint}</span>
                </span>
                <span className="hidden text-xs font-medium text-tertiary sm:block">
                    {alert.hits.length} client{alert.hits.length === 1 ? "" : "s"}
                </span>
                <ChevronDown className={cx("size-4 shrink-0 text-fg-quaternary transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.26, ease: EASE_SOFT }}
                        className="overflow-hidden"
                    >
                        <div className="flex flex-wrap gap-2 px-3 pb-3 sm:pl-[68px]">
                            {alert.hits.map((c) => (
                                <button
                                    key={clientId(c)}
                                    type="button"
                                    onClick={() => onOpen(clientId(c), alert.rule.id)}
                                    className="rounded-lg border border-secondary bg-primary px-3 py-1.5 text-xs text-secondary shadow-xs transition duration-100 ease-linear hover:border-primary hover:text-primary"
                                >
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const Panel = ({ title, count, children }: { title: string; count?: number; children: ReactNode }) => (
    <div data-pop className="rounded-xl border border-secondary bg-secondary px-4 py-3">
        <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-widest text-quaternary uppercase">
            {title}
            {count ? (
                <span className="rounded-md bg-brand-primary px-1.5 text-[11px] font-semibold tracking-normal text-brand-secondary normal-case">{count}</span>
            ) : null}
        </h3>
        {/* Wrapped so the first row's divider can drop (first:border-t-0) under the heading. */}
        <div>{children}</div>
    </div>
);

const Row = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
    <button
        type="button"
        onClick={onClick}
        className="flex min-h-11 w-full items-center justify-between gap-3 border-t border-secondary px-1 text-left transition duration-100 ease-linear first:border-t-0 hover:bg-primary"
    >
        {children}
    </button>
);

/**
 * What the directory shows before a client is picked: the alerts, the hosting split, who is
 * still onboarding and who was added lately. With `collapsible` it sits above the picked
 * clients' cards and folds back into the summary bar.
 */
export const DirectoryOverview = ({
    clients,
    scopeLabel,
    collapsible = false,
    onCollapse,
    onOpen,
    onOpenAlert,
}: {
    clients: DirectoryClient[];
    scopeLabel: string;
    collapsible?: boolean;
    onCollapse?: () => void;
    onOpen: (id: string) => void;
    onOpenAlert: (id: string, alertId: string) => void;
}) => {
    const [clearHidden, setClearHidden] = useState(false);
    const alerts = alertsFor(clients);
    const alertTotal = alerts.reduce((n, a) => n + a.hits.length, 0);
    const ghl = clients.filter((c) => c.platform !== "Netlify").length;
    const netlify = clients.length - ghl;
    const upcoming = clients.filter((c) => c.upcoming).sort(byName);
    const recent = clients
        .filter((c) => c.added)
        .sort((a, b) => (b.added ?? "").localeCompare(a.added ?? ""))
        .slice(0, 5);

    return (
        <section
            data-pop={collapsible ? undefined : true}
            // Collapsible, it sits inside CollapsibleOverview's card, which draws the edge.
            className={cx("p-6", !collapsible && "rounded-2xl border border-secondary bg-primary shadow-xs")}
        >
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-secondary pb-5">
                <div>
                    <Eyebrow>{scopeLabel}</Eyebrow>
                    <h2 className="mt-1 text-2xl font-semibold text-primary">
                        {clients.length} client{clients.length === 1 ? "" : "s"}
                    </h2>
                </div>
                {collapsible ? (
                    <button
                        type="button"
                        onClick={onCollapse}
                        className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-tertiary transition duration-100 ease-linear hover:bg-secondary hover:text-primary"
                    >
                        Collapse <ChevronUp className="size-3.5" aria-hidden="true" />
                    </button>
                ) : (
                    <p className="text-sm text-tertiary">
                        {clients.length
                            ? "Pick one or more clients above, or press / to search."
                            : "No clients assigned yet. Set an account manager from a client's Edit panel."}
                    </p>
                )}
            </div>

            {alerts.length > 0 ? (
                <div role="region" aria-label="Alerts" className="mt-5 rounded-2xl border border-error_subtle bg-error-primary p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1.5 pb-2">
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-error-primary">
                            <AlertTriangle className="size-4" aria-hidden="true" />
                            Needs attention
                        </span>
                        <span className="text-xs text-tertiary">
                            {alertTotal} item{alertTotal === 1 ? "" : "s"} across {alerts.length} check{alerts.length === 1 ? "" : "s"}
                        </span>
                    </div>
                    <div className="flex flex-col gap-2">
                        {alerts.map((a) => (
                            <AlertItem key={a.rule.id} alert={a} total={clients.length} onOpen={onOpenAlert} />
                        ))}
                    </div>
                </div>
            ) : (
                <AnimatePresence initial={false}>
                    {!clearHidden && (
                        <motion.div
                            key="clear"
                            data-pop
                            exit={{ opacity: 0, y: 4, scale: 0.985 }}
                            transition={FAST}
                            className="mt-5 flex items-center gap-3 rounded-2xl border border-secondary bg-success-primary px-5 py-3"
                        >
                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-success-primary">
                                <CheckCircle className="size-4" aria-hidden="true" />
                                All clear
                            </span>
                            <span className="text-xs text-tertiary">Nothing needs attention right now.</span>
                            <button
                                type="button"
                                onClick={() => setClearHidden(true)}
                                aria-label="Hide this until something needs attention"
                                className="ml-auto flex size-7 items-center justify-center rounded-md text-success-primary opacity-70 transition duration-100 ease-linear hover:opacity-100"
                            >
                                <XClose className="size-4" aria-hidden="true" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <Panel title="Hosting">
                    <div className="flex min-h-10 items-center justify-between border-t border-secondary px-1 first:border-t-0">
                        <HostingBadge platform="GoHighLevel" size="sm" />
                        <span className="text-sm font-semibold text-primary tabular-nums">{ghl}</span>
                    </div>
                    <div className="flex min-h-10 items-center justify-between border-t border-secondary px-1">
                        <HostingBadge platform="Netlify" size="sm" />
                        <span className="text-sm font-semibold text-primary tabular-nums">{netlify}</span>
                    </div>
                </Panel>
                <Panel title="Upcoming clients" count={upcoming.length}>
                    {upcoming.length ? (
                        <>
                            {upcoming.slice(0, 5).map((c) => (
                                <Row key={clientId(c)} onClick={() => onOpen(clientId(c))}>
                                    <span className="truncate text-sm font-medium text-primary">{c.name}</span>
                                    {managerOf(c) && <span className="shrink-0 text-xs text-tertiary">{managerOf(c)}</span>}
                                </Row>
                            ))}
                            {upcoming.length > 5 && <p className="py-2 text-xs text-tertiary">and {upcoming.length - 5} more</p>}
                        </>
                    ) : (
                        <p className="py-2 text-sm text-tertiary">None right now. Tick Upcoming client in a client's Edit panel.</p>
                    )}
                </Panel>
                <Panel title="Recently added" count={recent.length}>
                    {recent.length ? (
                        recent.map((c) => (
                            <Row key={clientId(c)} onClick={() => onOpen(clientId(c))}>
                                <span className="truncate text-sm font-medium text-primary">{c.name}</span>
                                <span className="flex shrink-0 items-center gap-2">
                                    <HostingBadge platform={c.platform} />
                                    <span className="min-w-16 text-right text-xs text-tertiary">{fmtAdded(c.added ?? "")}</span>
                                </span>
                            </Row>
                        ))
                    ) : (
                        <p className="py-2 text-sm text-tertiary">Nothing yet. New clients show here, newest first.</p>
                    )}
                </Panel>
            </div>
        </section>
    );
};

/** The overview folded to one line, shown above the picked clients' cards. */
export const MiniBar = ({ clients, scopeLabel, onExpand }: { clients: DirectoryClient[]; scopeLabel: string; onExpand: () => void }) => {
    const ghl = clients.filter((c) => c.platform !== "Netlify").length;
    return (
        <button
            type="button"
            onClick={onExpand}
            aria-label="Expand overview"
            className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 text-left transition duration-100 ease-linear hover:bg-primary_hover"
        >
            <Eyebrow>{scopeLabel}</Eyebrow>
            <span className="text-sm font-semibold text-primary">
                {clients.length} client{clients.length === 1 ? "" : "s"}
            </span>
            <span className="hidden h-5 border-l border-secondary sm:block" aria-hidden="true" />
            <span className="inline-flex items-center gap-2 text-sm text-secondary">
                <HostingBadge platform="GoHighLevel" />
                <b className="font-semibold text-primary tabular-nums">{ghl}</b>
            </span>
            <span className="inline-flex items-center gap-2 text-sm text-secondary">
                <HostingBadge platform="Netlify" />
                <b className="font-semibold text-primary tabular-nums">{clients.length - ghl}</b>
            </span>
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-tertiary">
                Expand <ChevronDown className="size-3.5" aria-hidden="true" />
            </span>
        </button>
    );
};

/**
 * The overview on the cards page: one card that stays on screen and morphs between the one-line
 * bar and the full overview. Its height follows whichever is showing while the two crossfade
 * inside, so neither folds to nothing before the other arrives.
 */
export const CollapsibleOverview = ({
    open,
    onToggle,
    ...props
}: Omit<ComponentProps<typeof DirectoryOverview>, "collapsible" | "onCollapse"> & { open: boolean; onToggle: (open: boolean) => void }) => {
    const inner = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState<number | "auto">("auto");
    useLayoutEffect(() => {
        const el = inner.current;
        if (!el) return;
        const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    return (
        <motion.div
            data-pop
            initial={false}
            animate={{ height }}
            transition={SOFT}
            className="overflow-hidden rounded-2xl border border-secondary bg-primary shadow-xs"
        >
            {/* popLayout lifts the leaving view out of flow, so this measures the arriving one at once. */}
            <div ref={inner} className="relative">
                <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                        key={open ? "expanded" : "mini"}
                        initial={{ opacity: 0, y: open ? -6 : 6 }}
                        animate={{ opacity: 1, y: 0, transition: { ...FAST, delay: 0.06 } }}
                        exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_SOFT } }}
                        className="w-full"
                    >
                        {open ? (
                            <DirectoryOverview {...props} collapsible onCollapse={() => onToggle(false)} />
                        ) : (
                            <MiniBar clients={props.clients} scopeLabel={props.scopeLabel} onExpand={() => onToggle(true)} />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </motion.div>
    );
};
