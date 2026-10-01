import type { MouseEvent, ReactNode } from "react";
import { Check, ChevronDown, Link01, LinkExternal01 } from "@untitledui/icons";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { useClipboard } from "@/hooks/use-clipboard";
import { type DictionaryEntry, isHgmTerm, linkKind, tierBadge } from "@/pages/team/dictionary/dictionary-model";
import { cx } from "@/utils/cx";

/**
 * One dictionary entry, as a compact card (term plus the first lines of its
 * definition) or opened in full. Fields the master leaves empty are left off.
 *
 * The full entry follows the brief's order: definition, formula, worked example,
 * what it means for the owner, the line to use on a call, then — Core terms
 * only — how HGM uses it, common confusions and further reading, then related
 * terms and the source.
 */

/** The DOM id of an entry's card; the URL hash is the bare slug, so the browser never jumps on its own. */
export const entryElementId = (slug: string) => `dict-${slug}`;
export const entryTermId = (slug: string) => `dict-term-${slug}`;

const Badges = ({ entry }: { entry: DictionaryEntry }) => {
    const tier = tierBadge(entry.tier);
    if (!tier && !isHgmTerm(entry)) return null;
    return (
        <span className="flex shrink-0 flex-wrap items-center gap-1.5">
            {tier && (
                <Badge type="pill-color" size="sm" color={entry.tier === "A" ? "brand" : "gray"}>
                    {tier}
                </Badge>
            )}
            {isHgmTerm(entry) && (
                <Badge type="pill-color" size="sm" color="purple">
                    HGM term
                </Badge>
            )}
        </span>
    );
};

const CopyLink = ({ slug }: { slug: string }) => {
    const { copied, copy } = useClipboard();
    return (
        <>
            <Button size="sm" color="secondary" iconLeading={copied ? Check : Link01} onClick={() => void copy(`${window.location.origin}/dictionary#${slug}`)}>
                {copied ? "Link copied" : "Copy link"}
            </Button>
            <span role="status" className="sr-only">
                {copied ? "Link copied" : ""}
            </span>
        </>
    );
};

const Part = ({ label, children }: { label: string; children: ReactNode }) => (
    <section className="flex flex-col gap-1.5">
        <h4 className="text-sm font-semibold text-secondary">{label}</h4>
        {children}
    </section>
);

const prose = "max-w-[66ch] text-md leading-relaxed text-tertiary text-pretty";

/** A plain left click opens the related entry here; any modified click is left to the browser. */
const plainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

const FullBody = ({ entry, bySlug, onRelated }: { entry: DictionaryEntry; bySlug: Map<string, DictionaryEntry>; onRelated: (slug: string) => void }) => {
    const core = entry.tier === "A" ? entry.core : null;
    const worked = (core?.worked ?? []).filter((s) => s?.trim());
    const links = (core?.links ?? []).filter((l) => l?.url?.trim());
    const related = (entry.related ?? []).map((slug) => bySlug.get(slug)).filter((e): e is DictionaryEntry => !!e);

    return (
        <div className="flex flex-col gap-5 border-t border-secondary px-4 pt-4 pb-5 sm:px-5">
            <p className="max-w-[66ch] text-lg leading-relaxed text-pretty text-primary">{entry.gloss}</p>

            {entry.formula?.trim() && (
                <Part label="Formula">
                    <p className="max-w-[66ch] rounded-lg bg-secondary px-3.5 py-2.5 font-mono text-sm break-words whitespace-pre-wrap text-secondary ring-1 ring-secondary">
                        {entry.formula}
                    </p>
                </Part>
            )}

            {(entry.example?.trim() || worked.length > 0) && (
                <Part label="Worked example (illustrative)">
                    {entry.example?.trim() && <p className={prose}>{entry.example}</p>}
                    {worked.length > 0 && (
                        <ol className={cx(prose, "flex list-decimal flex-col gap-1 pl-5 marker:text-quaternary")}>
                            {worked.map((step, i) => (
                                <li key={i}>{step}</li>
                            ))}
                        </ol>
                    )}
                </Part>
            )}

            {entry.owner?.trim() && (
                <Part label="What it means for the owner">
                    <p className={prose}>{entry.owner}</p>
                </Part>
            )}

            {entry.usage?.trim() && (
                <Part label="On a call">
                    <blockquote className="max-w-[66ch] border-l-2 border-brand pl-3.5 text-md leading-relaxed text-pretty text-secondary italic">
                        {entry.usage}
                    </blockquote>
                </Part>
            )}

            {core?.hgm?.trim() && (
                <Part label="How HGM uses it">
                    <p className={prose}>{core.hgm}</p>
                </Part>
            )}

            {core?.confusions?.trim() && (
                <Part label="Common confusions">
                    <p className={prose}>{core.confusions}</p>
                </Part>
            )}

            {links.length > 0 && (
                <Part label="Go deeper">
                    <ul className="flex flex-col gap-1.5 text-md text-tertiary">
                        {links.map((link, i) => {
                            const kind = linkKind(link.url);
                            return (
                                <li key={i} className="break-words">
                                    {kind.kind === "web" ? (
                                        <>
                                            <a
                                                href={kind.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-baseline gap-1 rounded font-medium text-brand-secondary outline-focus-ring hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                                            >
                                                {link.title || kind.href}
                                                <LinkExternal01 className="size-3.5 shrink-0 self-center" aria-hidden="true" />
                                                <span className="sr-only">(opens in a new tab)</span>
                                            </a>
                                            {link.checked && <span className="text-sm text-quaternary"> · checked {link.checked}</span>}
                                        </>
                                    ) : kind.kind === "doctrine" ? (
                                        <span>HGM doctrine: {kind.file}</span>
                                    ) : (
                                        <span>{link.title}</span>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </Part>
            )}

            {related.length > 0 && (
                <Part label="Related">
                    <ul className="flex flex-wrap gap-2">
                        {related.map((r) => (
                            <li key={r.slug}>
                                <a
                                    href={`#${r.slug}`}
                                    onClick={(e) => {
                                        if (!plainClick(e)) return;
                                        e.preventDefault();
                                        onRelated(r.slug);
                                    }}
                                    className="inline-flex rounded-full border border-secondary bg-primary px-3 py-1 text-sm text-secondary outline-focus-ring transition duration-100 ease-linear hover:border-brand hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                                >
                                    {r.term}
                                </a>
                            </li>
                        ))}
                    </ul>
                </Part>
            )}

            {entry.source?.trim() && <p className="max-w-[66ch] text-xs leading-relaxed text-quaternary">Source: {entry.source}</p>}
        </div>
    );
};

export const DictionaryEntryCard = ({
    entry,
    open,
    highlighted = false,
    bySlug,
    onToggle,
    onRelated,
}: {
    entry: DictionaryEntry;
    open: boolean;
    /** The keyboard highlight in a results list — where Enter will act. */
    highlighted?: boolean;
    bySlug: Map<string, DictionaryEntry>;
    onToggle: (slug: string) => void;
    onRelated: (slug: string) => void;
}) => (
    <article
        id={entryElementId(entry.slug)}
        className={cx(
            "relative rounded-xl bg-primary transition duration-100 ease-linear motion-reduce:transition-none",
            highlighted ? "ring-2 ring-brand" : "ring-1 ring-secondary",
            !open && "hover:bg-primary_hover",
        )}
    >
        <header className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 pt-3.5 pb-3 sm:px-5">
            {/* On a phone the term takes the whole first line; badges and Copy link wrap under it. */}
            <h3 className="w-full min-w-0 text-md font-semibold text-primary sm:w-auto sm:flex-1">
                {/* Closed, the whole card is the button (the ::after covers it); open, only the heading is. */}
                <button
                    type="button"
                    id={entryTermId(entry.slug)}
                    aria-expanded={open}
                    onClick={() => onToggle(entry.slug)}
                    className={cx(
                        "group inline-flex max-w-full items-start gap-1.5 rounded text-left outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2",
                        !open && "after:absolute after:inset-0 after:rounded-xl",
                    )}
                >
                    <span className="min-w-0 break-words">{entry.term}</span>
                    <ChevronDown
                        className={cx(
                            "mt-1 size-4 shrink-0 text-fg-quaternary transition-transform duration-100 ease-linear motion-reduce:transition-none",
                            !open && "-rotate-90",
                        )}
                        aria-hidden="true"
                    />
                </button>
            </h3>
            <Badges entry={entry} />
            {open && <CopyLink slug={entry.slug} />}
        </header>

        {open ? (
            <FullBody entry={entry} bySlug={bySlug} onRelated={onRelated} />
        ) : (
            <p className="-mt-1 line-clamp-2 px-4 pb-3.5 text-sm text-tertiary sm:px-5">{entry.gloss}</p>
        )}
    </article>
);
