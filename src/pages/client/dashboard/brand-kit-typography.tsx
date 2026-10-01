import { useEffect, useMemo, useState } from "react";
import { Trash01, UploadCloud02 } from "@untitledui-pro/icons/line";
import { editInput } from "@/pages/client/dashboard/dashboard-chrome";
import { TYPE_SCALE, clampFor } from "@/pages/client/dashboard/type-scale";

export type BrandFontFile = { name: string; url: string };
export type BrandFontFiles = { heading?: BrandFontFile; heading2?: BrandFontFile; body?: BrandFontFile };
export type FontRole = keyof BrandFontFiles;

/**
 * Client bases (slug minus "-dashboard") whose Brand Kit gets a third typeface card,
 * "Heading font 2", for the two largest Display sizes. Everyone else keeps the two
 * cards. Asked for Cabin Collective alone, so it is a list rather than a template change.
 */
const THIRD_HEADING_FONT_CLIENTS = new Set(["cabin-collective"]);
export const hasThirdHeadingFont = (clientBase: string) => THIRD_HEADING_FONT_CLIENTS.has(clientBase);

/** The comma-separated fonts field, as up-to-4 trimmed family names. */
export const splitFamilies = (fonts: string) =>
    fonts
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean)
        .slice(0, 4);

/**
 * Which family each role resolves to. An uploaded file wins over a typed name for its
 * role; the body falls back to the heading so one font still styles the whole scale, and
 * so does heading 2 (the large Display sizes) — so a kit without one reads as before.
 * Shared with the brand preview and the CSS export so every surface agrees on which
 * font is "the heading font".
 */
export const resolveRoles = (fonts: string, files: BrandFontFiles | undefined, heading2Name?: string) => {
    const typed = splitFamilies(fonts);
    const heading = files?.heading?.name ?? typed[0];
    const body = files?.body?.name ?? typed[1] ?? heading;
    const ownHeading2 = files?.heading2?.name ?? (heading2Name?.trim() || undefined);
    return { heading, heading2: ownHeading2 ?? heading, body, hasHeading2: !!ownHeading2, headingCustom: !!files?.heading, bodyCustom: !!files?.body };
};

/** A family name as a CSS font-family value with the one fallback the previews use. */
export const fontStack = (family: string | undefined) => (family ? `"${family}", sans-serif` : undefined);

/**
 * Load typed families from Google Fonts while mounted. A family Google doesn't host
 * simply falls back to sans-serif — the preview's job is "show me the typeface" and a
 * fallback rendering is visibly not it. Injected <link> tags are removed on unmount so
 * leaving Brand Kit doesn't leave client fonts on other pages.
 */
const useGoogleFonts = (families: string[]) => {
    useEffect(() => {
        const links = families.map((f) => {
            const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;600&display=swap`;
            if (document.head.querySelector(`link[href="${href}"]`)) return null;
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = href;
            document.head.appendChild(link);
            return link;
        });
        return () => links.forEach((l) => l?.remove());
    }, [families]);
};

/** Register uploaded font files (data URLs) with the browser while mounted. */
const useCustomFonts = (files: BrandFontFiles | undefined) => {
    useEffect(() => {
        const faces = [files?.heading, files?.heading2, files?.body]
            .filter((f): f is BrandFontFile => !!f)
            .map((f) => {
                const face = new FontFace(f.name, `url(${f.url})`);
                void face.load().then(
                    () => document.fonts.add(face),
                    () => undefined, // a corrupt file just previews in the fallback face
                );
                return face;
            });
        return () => faces.forEach((face) => document.fonts.delete(face));
    }, [files]);
};

const TWO_ROLES = [
    { role: "heading" as const, label: "Heading font", note: "Used for the Display sizes", placeholder: "e.g. Cormorant Infant" },
    { role: "body" as const, label: "Body font", note: "Used for the Text sizes", placeholder: "e.g. Inter" },
];

const THREE_ROLES = [
    { role: "heading" as const, label: "Heading font 1", note: "Display lg → xs", placeholder: "e.g. Cormorant Infant" },
    { role: "heading2" as const, label: "Heading font 2", note: "Display 2xl & xl", placeholder: "e.g. Playfair Display" },
    { role: "body" as const, label: "Body font", note: "Used for the Text sizes", placeholder: "e.g. Inter" },
];

/**
 * The typeface cards, side by side — Heading and Body, plus Heading 2 for the clients
 * in THIRD_HEADING_FONT_CLIENTS. Each previews its resolved font and, in edit mode,
 * takes a typed family name OR an uploaded font file (the upload wins for that role
 * until it's removed). Heading and body names live in the ONE stored comma string
 * (slot 0 heading, slot 1 body), so older rows and the generate-from-website filler
 * keep working unchanged; heading 2 is its own field (brand.heading2_font) so it can
 * never shift those slots. Uploads live in brand.font_files.
 */
export const TypographyCards = ({
    fonts,
    files,
    heading2 = "",
    thirdFont = false,
    isLocked,
    onFonts,
    onHeading2,
    onUpload,
    onClearUpload,
}: {
    fonts: string;
    files: BrandFontFiles | undefined;
    heading2?: string;
    thirdFont?: boolean;
    isLocked: boolean;
    onFonts: (fonts: string) => void;
    onHeading2?: (name: string) => void;
    onUpload: (role: FontRole, file: File) => void;
    onClearUpload: (role: FontRole) => void;
}) => {
    const typed = useMemo(() => splitFamilies(fonts), [fonts]);
    const toLoad = useMemo(() => (thirdFont && heading2.trim() ? [...typed, heading2.trim()] : typed), [typed, thirdFont, heading2]);
    useGoogleFonts(toLoad);
    useCustomFonts(files);
    const resolved = resolveRoles(fonts, files, thirdFont ? heading2 : undefined);
    const roles = thirdFont ? THREE_ROLES : TWO_ROLES;

    /* Local input state keeps typing free (a trailing space would otherwise be trimmed
       away on the round trip); it resyncs only when the stored value changes from
       outside — e.g. the generate-from-website draft filling the field. */
    const [names, setNames] = useState<[string, string]>([typed[0] ?? "", typed[1] ?? ""]);
    const localJoin = names
        .map((f) => f.trim())
        .filter(Boolean)
        .join(", ");
    useEffect(() => {
        if (typed.slice(0, 2).join(", ") !== localJoin) setNames([typed[0] ?? "", typed[1] ?? ""]);
    }, [fonts]); // eslint-disable-line react-hooks/exhaustive-deps -- resync only on outside writes

    const setName = (i: 0 | 1, v: string) => {
        const next: [string, string] = i === 0 ? [v, names[1]] : [names[0], v];
        setNames(next);
        onFonts(
            next
                .map((f) => f.trim())
                .filter(Boolean)
                .join(", "),
        );
    };

    /* Same local-state reasoning as `names`, for the one heading-2 input. */
    const [heading2Name, setHeading2Name] = useState(heading2);
    useEffect(() => {
        if (heading2.trim() !== heading2Name.trim()) setHeading2Name(heading2);
    }, [heading2]); // eslint-disable-line react-hooks/exhaustive-deps -- resync only on outside writes

    const inputValue = (role: FontRole) => (role === "heading2" ? heading2Name : names[role === "heading" ? 0 : 1]);
    const setInput = (role: FontRole, v: string) => {
        if (role !== "heading2") return setName(role === "heading" ? 0 : 1, v);
        setHeading2Name(v);
        onHeading2?.(v.trim());
    };

    return (
        <div className={thirdFont ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" : "grid grid-cols-1 gap-4 sm:grid-cols-2"}>
            {roles.map(({ role, label, note, placeholder }) => {
                const family = resolved[role];
                const custom = files?.[role];
                const fallbackToHeading = !custom && !!resolved.heading && ((role === "body" && !typed[1]) || (role === "heading2" && !resolved.hasHeading2));
                return (
                    <div key={role} className="rounded-2xl bg-primary p-5 ring-1 ring-secondary">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <p className="text-sm font-semibold text-primary">{label}</p>
                            <span className="text-xs text-quaternary">{note}</span>
                        </div>

                        {!isLocked &&
                            (custom ? (
                                <div className="mt-2 flex items-center gap-1.5">
                                    <span className="truncate text-sm text-tertiary">
                                        {custom.name} <span className="text-quaternary">(uploaded)</span>
                                    </span>
                                    <button
                                        type="button"
                                        title="Remove the uploaded font"
                                        onClick={() => onClearUpload(role)}
                                        className="flex size-6 shrink-0 items-center justify-center rounded-md text-fg-quaternary transition duration-100 ease-linear hover:bg-secondary hover:text-error-primary"
                                    >
                                        <Trash01 className="size-3.5" aria-hidden="true" />
                                    </button>
                                </div>
                            ) : (
                                <div className="mt-2 flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder={placeholder}
                                        value={inputValue(role)}
                                        onChange={(e) => setInput(role, e.target.value)}
                                        className={editInput("min-w-0 flex-1")}
                                    />
                                    <label
                                        title="Upload a font file (.woff2, .woff, .ttf, .otf)"
                                        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-secondary hover:text-brand-secondary"
                                    >
                                        <input
                                            type="file"
                                            accept=".woff2,.woff,.ttf,.otf"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) onUpload(role, file);
                                                e.target.value = "";
                                            }}
                                        />
                                        <UploadCloud02 className="size-4" aria-hidden="true" />
                                    </label>
                                </div>
                            ))}

                        {family ? (
                            <>
                                <p className="mt-3 text-display-md font-medium text-primary" style={{ fontFamily: `"${family}", sans-serif` }}>
                                    Aa Bb Cc
                                </p>
                                <p className="mt-2 truncate text-md text-tertiary" style={{ fontFamily: `"${family}", sans-serif` }}>
                                    The quick brown fox jumps over the lazy dog
                                </p>
                                <p className="mt-1 truncate font-mono text-xs text-quaternary" style={{ fontFamily: `"${family}", sans-serif` }}>
                                    ABCDEFGHIJKLM abcdefghijklm 0123456789
                                </p>
                                {isLocked && (
                                    <p className="mt-2 text-xs text-quaternary">
                                        {family}
                                        {fallbackToHeading ? ` — same as ${thirdFont ? "heading font 1" : "heading"}` : custom ? " (uploaded)" : ""}
                                    </p>
                                )}
                                {!isLocked && fallbackToHeading && (
                                    <p className="mt-2 text-xs text-quaternary">Falls back to {thirdFont ? "heading font 1" : "the heading font"}.</p>
                                )}
                            </>
                        ) : (
                            <p className="mt-3 text-md text-quaternary italic">No font set yet.</p>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

/**
 * The Untitled UI type scale (see type-scale.ts) rendered in the brand's own fonts —
 * heading font for Display sizes (heading 2 for the large ones, when the kit has one),
 * body font for Text sizes. Each row shows px /
 * line-height and the CSS clamp() for fluid sizing; click the code to copy it.
 */
export const TypeScale = ({ fonts, files, heading2 }: { fonts: string; files?: BrandFontFiles; heading2?: string }) => {
    const resolved = resolveRoles(fonts, files, heading2);
    const [copied, setCopied] = useState("");
    const copy = (label: string, value: string) => {
        void navigator.clipboard.writeText(value).then(() => {
            setCopied(label);
            setTimeout(() => setCopied(""), 1200);
        });
    };

    const heading = fontStack(resolved.heading);
    const large = fontStack(resolved.heading2) ?? heading;
    const body = fontStack(resolved.body) ?? heading;

    return (
        <div className="flex flex-col">
            {TYPE_SCALE.map((t) => {
                const clamp = clampFor(t.min, t.px);
                return (
                    <div key={t.label} className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-secondary py-4 last:border-b-0">
                        <div className="w-44 shrink-0">
                            <p className="text-sm font-semibold text-primary">{t.label}</p>
                            <p className="mt-0.5 text-xs text-quaternary tabular-nums">
                                {t.px}px / {t.lh}px{t.ls ? ` · ${t.ls}px` : ""}
                            </p>
                            <button
                                type="button"
                                title={`Copy ${clamp}`}
                                onClick={() => copy(t.label, clamp)}
                                className="mt-1 block max-w-full truncate font-mono text-[10px] text-tertiary transition duration-100 ease-linear hover:text-brand-secondary"
                            >
                                {copied === t.label ? "Copied!" : clamp}
                            </button>
                        </div>
                        <p
                            className="min-w-0 flex-1 truncate text-primary"
                            style={{
                                fontFamily: t.large ? large : t.display ? heading : body,
                                fontSize: t.px,
                                lineHeight: `${t.lh}px`,
                                letterSpacing: t.ls ? `${t.ls}px` : undefined,
                                fontWeight: t.display ? 600 : 400,
                            }}
                        >
                            The quick brown fox
                        </p>
                    </div>
                );
            })}
        </div>
    );
};
