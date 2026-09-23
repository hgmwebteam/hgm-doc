import { AlertTriangle, CheckCircle, InfoCircle } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";

/**
 * A Brand Kit draft, as generate-brand-kit-background returns it (netlify/lib/brand-kit.mts).
 * Every swatch carries where it came from; nothing is in the dashboard until the AM applies it.
 */
export interface BrandKitDraft {
    colors: { name: string; hex: string; source: string }[];
    fonts: string;
    logos: { name: string; url: string }[];
    notes: string[];
    confident: boolean;
    source: {
        site: string;
        stylesheets: number;
        pdf: { pages: number; codes: number; named: boolean; vision: boolean } | null;
    };
}

/**
 * The review step between Generate and the palette.
 *
 * The first version merged its draft straight in: over the template it replaced, over
 * anything else it appended, silently — which is how a template palette ended up with two
 * scraped greys on the end and nobody could say where any swatch had come from. Here the AM
 * sees each colour next to its evidence ("button background (.btn-primary)", "printed
 * 'HEX 2C3B2A' on page 2") and chooses what happens.
 *
 * Team-only and edit-mode-only, so it is dense and tool-like rather than client-calm.
 */
export const BrandKitDraftReview = ({
    draft,
    canAdd,
    onReplace,
    onAdd,
    onDiscard,
}: {
    draft: BrandKitDraft;
    /** False while the palette is still the template — there is nothing worth adding to. */
    canAdd: boolean;
    onReplace: () => void;
    onAdd: () => void;
    onDiscard: () => void;
}) => {
    const pdf = draft.source.pdf;
    const from = pdf
        ? `the brand guidelines PDF (${pdf.pages} page${pdf.pages === 1 ? "" : "s"})`
        : draft.source.site
          ? new URL(draft.source.site).hostname.replace(/^www\./, "")
          : "the client's material";

    return (
        <div className="mt-4 rounded-xl border border-secondary bg-primary p-4 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-primary">Draft from {from}</p>
                    <p className="mt-0.5 text-sm text-tertiary">Nothing is in the kit yet. Check each colour against its source, then apply.</p>
                </div>
                {draft.confident ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success-primary">
                        <CheckCircle className="size-4" aria-hidden="true" />
                        Strong evidence
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-warning-primary">
                        <AlertTriangle className="size-4" aria-hidden="true" />
                        Check before saving
                    </span>
                )}
            </div>

            {draft.colors.length > 0 && (
                <ul className="mt-4 flex flex-col divide-y divide-secondary border-y border-secondary">
                    {draft.colors.map((c) => (
                        <li key={c.hex} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2">
                            {/* The swatch is the client's colour as-is, not a theme token. */}
                            <span
                                className="size-8 shrink-0 rounded-md ring-1 ring-secondary ring-inset"
                                style={{ backgroundColor: c.hex }}
                                aria-hidden="true"
                            />
                            <span className="w-28 shrink-0 truncate text-sm font-medium text-primary">{c.name}</span>
                            <span className="w-20 shrink-0 font-mono text-xs text-secondary tabular-nums">{c.hex}</span>
                            {/* Its own line on a phone, where a truncated source says nothing. */}
                            <span className="w-full pl-11 text-xs text-tertiary sm:w-auto sm:min-w-0 sm:flex-1 sm:truncate sm:pl-0" title={c.source}>
                                {c.source}
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-tertiary">Fonts</dt>
                <dd className="text-secondary">{draft.fonts || "None found"}</dd>
                <dt className="text-tertiary">Logos</dt>
                <dd className="text-secondary">
                    {draft.logos.length ? `${draft.logos.length} file${draft.logos.length > 1 ? "s" : ""}, added to Logo files` : "None found"}
                </dd>
            </dl>

            {draft.notes.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1.5">
                    {draft.notes.map((n) => (
                        <li key={n} className="flex gap-2 text-sm text-secondary">
                            <InfoCircle className="mt-0.5 size-4 shrink-0 text-fg-quaternary" aria-hidden="true" />
                            {n}
                        </li>
                    ))}
                </ul>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" color="primary" onClick={onReplace}>
                    {draft.colors.length ? "Replace palette" : "Apply fonts & logos"}
                </Button>
                {canAdd && draft.colors.length > 0 && (
                    <Button size="sm" color="secondary" onClick={onAdd}>
                        Add to palette
                    </Button>
                )}
                <Button size="sm" color="tertiary" onClick={onDiscard}>
                    Discard
                </Button>
            </div>
        </div>
    );
};
