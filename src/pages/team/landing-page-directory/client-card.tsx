import { type ReactNode, useState } from "react";
import { Check, Clock, Copy01, Edit01, File02, Globe01, InfoCircle, LayoutAlt01, LinkExternal01, XClose } from "@untitledui/icons";
import { motion } from "motion/react";
import { BadgeWithIcon } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { useClipboard } from "@/hooks/use-clipboard";
import { cx } from "@/utils/cx";
import { CHANNELS, type DirectoryClient, cardState, designName, fmtAdded, linkOf, managerOf, propsOf, showUrl, staysOf } from "./directory-model";
import { CopyButton, FAST, Initial, LiveDot, MetaMark, SOFT, StateBadge, rowProps } from "./directory-ui";

/** One link: the row copies it, the button at the end opens it. */
const LinkRow = ({ label, url, clientName, highlight = false }: { label: string; url: string; clientName: string; highlight?: boolean }) => {
    const { copied, copy } = useClipboard();
    return (
        <div className="group flex items-center gap-1">
            <button
                type="button"
                onClick={() => void copy(url)}
                aria-label={`Copy ${label} link for ${clientName}`}
                className={cx(
                    "grid min-h-12 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-lg px-2 py-2 text-left transition duration-100 ease-linear hover:bg-secondary sm:grid-cols-[112px_minmax(0,1fr)_auto]",
                    copied ? "bg-brand-primary_alt" : highlight && "bg-success-primary",
                )}
            >
                <span className="truncate text-sm font-medium text-primary">{label}</span>
                <span className="col-span-2 truncate text-sm text-tertiary sm:col-span-1" title={url}>
                    {showUrl(url)}
                </span>
                <span
                    className={cx(
                        "col-start-2 row-start-1 inline-flex items-center gap-1.5 text-xs font-medium sm:col-start-auto sm:row-start-auto",
                        copied ? "text-brand-secondary" : "text-quaternary group-hover:text-primary",
                    )}
                >
                    {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy01 className="size-4" aria-hidden="true" />}
                    <span className={cx("transition-opacity duration-100", copied ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                        {copied ? "Copied" : "Copy"}
                    </span>
                </span>
            </button>
            <ButtonUtility size="xs" color="tertiary" icon={LinkExternal01} tooltip="Open in new tab" href={url} target="_blank" rel="noopener" />
        </div>
    );
};

const EmptyRow = ({ label }: { label: string }) => (
    <div className="grid min-h-12 grid-cols-[112px_minmax(0,1fr)] items-center gap-3 px-2 py-2">
        <span className="text-sm font-medium text-tertiary">{label}</span>
        <span className="text-sm text-quaternary">No link yet</span>
    </div>
);

/** A row in a list of links: fades up a beat after the one before when the card arrives. */
const Row = ({ index, entrance, children }: { index: number; entrance: boolean; children: ReactNode }) => (
    <motion.div className="border-t border-secondary first:border-t-0" {...(entrance ? rowProps(index) : {})}>
        {children}
    </motion.div>
);

/**
 * One client's landing-page setup: status, hosting and manager, then every link the team
 * hands out, each a click away from the clipboard.
 *
 * `onOpen` makes the whole card open the client's details (the peek); its own buttons and link
 * rows keep their click. `details` is that peek: it adds the setup the card leaves out.
 *
 * `entrance` plays the arrival: the card settles in and its rows follow one by one. The peek
 * dialog turns it off, since the dialog itself is what arrives there.
 */
export const ClientCard = ({
    client,
    editing,
    onEdit,
    onRemove,
    onOpen,
    details = false,
    actionsClassName = "top-4 right-4",
    className,
    entrance = true,
}: {
    client: DirectoryClient;
    editing: boolean;
    onEdit?: () => void;
    onRemove?: () => void;
    onOpen?: () => void;
    details?: boolean;
    /** Where the top-right toolbar sits; the peek moves it clear of the dialog's close button. */
    actionsClassName?: string;
    className?: string;
    entrance?: boolean;
}) => {
    // While a "Copy all" shows its tick, the rows it copied glow green, so you can see what went.
    const [linksCopied, setLinksCopied] = useState(false);
    const [pagesCopied, setPagesCopied] = useState(false);
    const state = cardState(client);
    const manager = managerOf(client);
    const design = designName(client);
    const stays = staysOf(client);
    const properties = propsOf(client);
    const channelLines = CHANNELS.filter((ch) => linkOf(client, ch.key)).map((ch) => `${ch.label}: ${linkOf(client, ch.key)}`);
    const pageLines = [...(stays ? [`Stays page: ${stays}`] : []), ...properties.map((p, i) => `${p.name || `Property ${i + 1}`}: ${p.url}`)];
    // The peek carries its actions in the status row instead of a toolbar.
    const showActions = !details && (!!client.doc || (editing && !!onEdit) || !!onRemove || !!onOpen);
    const arrive = entrance
        ? {
              initial: { opacity: 0, y: 10, scale: 0.995 },
              animate: { opacity: 1, y: 0, scale: 1 },
              exit: { opacity: 0, y: 4, scale: 0.985, transition: FAST },
              transition: SOFT,
          }
        : {};

    return (
        <motion.section
            layout
            data-pop
            {...arrive}
            onClick={
                onOpen &&
                ((e) => {
                    // A copy row, a link or a toolbar button inside keeps its own click.
                    if ((e.target as HTMLElement).closest("button, a, input")) return;
                    onOpen();
                })
            }
            className={cx(
                "relative rounded-2xl border border-secondary bg-primary p-5 shadow-xs",
                onOpen && "cursor-pointer transition-colors duration-100 ease-linear hover:border-primary",
                className,
            )}
        >
            {showActions && (
                <div className={cx("absolute flex items-center gap-0.5 rounded-lg border border-secondary bg-primary p-0.5 shadow-xs", actionsClassName)}>
                    {/* The keyboard's way into what a click on the card opens. */}
                    {onOpen && <ButtonUtility size="xs" color="tertiary" icon={InfoCircle} tooltip="Details" onClick={onOpen} />}
                    {client.doc && (
                        <ButtonUtility size="xs" color="tertiary" icon={File02} tooltip="Open brand doc" href={client.doc} target="_blank" rel="noopener" />
                    )}
                    {editing && onEdit && <ButtonUtility size="xs" color="tertiary" icon={Edit01} tooltip="Edit" onClick={onEdit} />}
                    {onRemove && <ButtonUtility size="xs" color="tertiary" icon={XClose} tooltip="Remove from selection" onClick={onRemove} />}
                </div>
            )}

            <motion.div className={cx("flex flex-col gap-2", showActions && "pr-28", details && "pr-10")} {...(entrance ? rowProps(0, 0) : {})}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <h2 className="min-w-0 truncate text-xl font-semibold text-primary">{client.name}</h2>
                    {/* Two marks, each its own state: the dot is the page, the Meta logo the tags. Grey means not yet. */}
                    <span className="inline-flex items-center gap-2" title={state.detail}>
                        <LiveDot live={!!client.live} />
                        <MetaMark added={!!client.metaTags} />
                    </span>
                    {state.tone === "soon" && <StateBadge state={state} />}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-tertiary">
                    <span className="inline-flex items-center gap-1.5">
                        <span
                            className={cx("size-1.5 rounded-full", client.platform === "Netlify" ? "bg-utility-sky-500" : "bg-fg-warning-secondary")}
                            aria-hidden="true"
                        />
                        {client.platform}
                    </span>
                    {manager ? (
                        <span className="inline-flex items-center gap-1.5">
                            <Initial name={manager} />
                            {manager}
                        </span>
                    ) : (
                        <span className="text-quaternary">No account manager</span>
                    )}
                    {details && client.domain && (
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                            <Globe01 className="size-3.5 shrink-0 text-fg-quaternary" aria-hidden="true" />
                            <span className="truncate">{client.domain}</span>
                        </span>
                    )}
                    {details && client.added && <span className="text-quaternary">Added {fmtAdded(client.added)}</span>}
                    {/* The peek's actions ride the summary line, so no row is kept open just for them. */}
                    {details && client.doc && (
                        <Button size="sm" color="link-color" iconLeading={File02} href={client.doc} target="_blank" rel="noopener">
                            Brand doc
                        </Button>
                    )}
                    {details && editing && onEdit && (
                        <Button size="sm" color="link-gray" iconLeading={Edit01} onClick={onEdit}>
                            Edit
                        </Button>
                    )}
                </div>
            </motion.div>

            {details && (!client.metaTags || design) && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    {/* Added is the Meta mark beside the name; only what's still to do gets a chip. */}
                    {!client.metaTags && (
                        <BadgeWithIcon type="pill-color" size="md" color={client.live ? "error" : "gray"} iconLeading={Clock}>
                            Meta tags pending
                        </BadgeWithIcon>
                    )}
                    {design && (
                        <BadgeWithIcon type="pill-color" size="md" color="gray" iconLeading={LayoutAlt01}>
                            {design}
                        </BadgeWithIcon>
                    )}
                </div>
            )}

            <div className="mt-5">
                <motion.div className="mb-1 flex min-h-8 items-center justify-between gap-3" {...(entrance ? rowProps(0, 0.03) : {})}>
                    <span className="text-xs font-medium text-tertiary">Channel links</span>
                    {channelLines.length > 0 && (
                        <CopyButton
                            onCopiedChange={setLinksCopied}
                            text={channelLines.join("\n")}
                            label="Copy all links"
                            copiedLabel={`Copied ${channelLines.length} link${channelLines.length === 1 ? "" : "s"}`}
                        />
                    )}
                </motion.div>
                <div className="border-b border-secondary">
                    {CHANNELS.map((ch, i) => {
                        const url = linkOf(client, ch.key);
                        return (
                            <Row key={ch.key} index={i} entrance={entrance}>
                                {url ? <LinkRow label={ch.label} url={url} clientName={client.name} highlight={linksCopied} /> : <EmptyRow label={ch.label} />}
                            </Row>
                        );
                    })}
                </div>
            </div>

            {(stays || properties.length > 0) && (
                <motion.div className="mt-5 rounded-xl border border-secondary bg-secondary px-3 py-2" {...(entrance ? rowProps(CHANNELS.length) : {})}>
                    <div className="mb-1 flex min-h-8 items-center justify-between gap-3">
                        <span className="text-xs font-medium text-tertiary">
                            Site pages
                            {properties.length > 0 && ` · ${properties.length} propert${properties.length === 1 ? "y" : "ies"}`}
                        </span>
                        {/* One page already has its own copy button on its row. */}
                        {pageLines.length > 1 && (
                            <CopyButton
                                onCopiedChange={setPagesCopied}
                                text={pageLines.join("\n")}
                                label="Copy all pages"
                                copiedLabel={`Copied ${pageLines.length}`}
                            />
                        )}
                    </div>
                    <div>
                        {stays && (
                            <Row index={0} entrance={false}>
                                <LinkRow label="Stays page" url={stays} clientName={client.name} highlight={pagesCopied} />
                            </Row>
                        )}
                        {properties.map((p, i) => (
                            <Row key={`${p.url}-${i}`} index={i + 1} entrance={false}>
                                <LinkRow label={p.name || `Property ${i + 1}`} url={p.url} clientName={client.name} highlight={pagesCopied} />
                            </Row>
                        ))}
                    </div>
                </motion.div>
            )}
        </motion.section>
    );
};
