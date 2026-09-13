/**
 * The help centre's and the reporting form's building blocks, measured against the
 * Figma file "Reporting System" (key rdig9bGu5N0KogiBW8H2CF) component by component.
 *
 * ── WHERE THE NUMBERS COME FROM ─────────────────────────────────────────────
 * Every height, padding, gap, radius, border, colour and text style here is read from
 * the component's node tree in that file (TopBar, Button, Status/Pill, Field/Select,
 * Field/Textarea, Field/Upload, File/Thumbnail, Priority/Chip, Priority/Legend, Banner)
 * and from the screen frames for the pieces that are not components (the filter chips,
 * the cards, the eyebrow, the reference, the marker dot, the chevron). An automated
 * proof holds the built pages against those trees node for node, so a number that
 * differs from the file is a bug, not a preference.
 *
 * ── TOKENS ──────────────────────────────────────────────────────────────────
 * Colours are the `--hc-*` custom properties of src/styles/help-centre.css (generated
 * from the file's "HGM Portal Tokens" collection: light on `.hc`, dark on `.dark-mode
 * .hc`). Type is the nine `hc-t-*` utilities from the same stylesheet. Nothing here is
 * a literal hex or a Tailwind palette class, so a colour can only be wrong in the
 * token file.
 *
 * ── STROKES ARE BORDERS ─────────────────────────────────────────────────────
 * A Figma stroke drawn INSIDE a frame does not move the frame's children; a CSS border
 * (box-sizing border-box) does. So wherever the file says padding 24 with a 1px inside
 * stroke, the element says padding 23px plus a 1px border, and the content lands where
 * the file has it. That is why the paddings below are odd numbers.
 *
 * ── ICONS ───────────────────────────────────────────────────────────────────
 * The SVG paths are the file's own exports (src/assets/help/*.svg holds the originals),
 * inlined with their stroke bound to `currentColor` so they take the token colour of
 * the theme they are in; the exported files carry the Dark hex baked in.
 *
 * ── THE DOTS ────────────────────────────────────────────────────────────────
 * The 8px marker and priority dots are painted as spans with a background rather than
 * as the exported SVG circles: same geometry, but a CSS-painted box is what the parity
 * proof can see, and an empty span needs no aria-hidden to be silent.
 *
 * House style: no em or en dashes anywhere.
 */
import { type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { cx } from "@/utils/cx";

/* ── Icons ───────────────────────────────────────────────────────────────── */

type IconProps = { className?: string };

/** logo/gem, 22x22, two strokes in brand/gold (1.65 and 1.283). */
export const GemIcon = ({ className }: IconProps) => (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true" focusable="false" className={cx("block shrink-0 text-(--hc-brand-gold)", className)}>
        <path d="M6.41667 3.66667H15.5833L19.25 8.25L11 18.3333L2.75 8.25L6.41667 3.66667Z" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
        <path d="M2.75 8.25H19.25M9.16667 3.66667L7.33333 8.25L11 18.3333L14.6667 8.25L12.8333 3.66667" stroke="currentColor" strokeWidth="1.28333" strokeLinejoin="round" />
    </svg>
);

/** icon/chevron-down, 20x20, stroke 1.667. */
export const ChevronDownIcon = ({ className }: IconProps) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false" className={cx("block shrink-0", className)}>
        <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

/** icon/upload, 28x28, stroke 2.1. */
export const UploadIcon = ({ className }: IconProps) => (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true" focusable="false" className={cx("block shrink-0", className)}>
        <path
            d="M14 18.6667V9.33333M18.0833 13.4167L14 9.33333L9.91667 13.4167M4.66667 19.25C3.5638 18.6999 2.6896 17.7794 2.19716 16.6497C1.70472 15.5199 1.62544 14.2529 1.97318 13.0705C2.32093 11.8882 3.07355 10.8659 4.09923 10.1826C5.12492 9.49935 6.35828 9.19871 7.58333 9.33333C8.16934 7.90553 9.2108 6.71143 10.5457 5.93678C11.8806 5.16213 13.4341 4.85036 14.9645 5.04998C16.4949 5.2496 17.9165 5.94941 19.008 7.04055C20.0995 8.1317 20.7998 9.55299 21 11.0833C21.9532 11.2748 22.8229 11.7592 23.4874 12.4689C24.152 13.1786 24.5783 14.0781 24.7068 15.0419C24.8353 16.0056 24.6596 16.9854 24.2042 17.8445C23.7488 18.7035 23.0364 19.3988 22.1667 19.8333"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

/** icon/x, 16x16, stroke 1.333. */
export const XIcon = ({ className }: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false" className={cx("block shrink-0", className)}>
        <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" />
    </svg>
);

/** icon/error, 20x20: a 1.5 circle and a 1.667 exclamation. */
export const ErrorIcon = ({ className }: IconProps) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false" className={cx("block shrink-0", className)}>
        <path d="M10 17.5C14.1421 17.5 17.5 14.1421 17.5 10C17.5 5.85786 14.1421 2.5 10 2.5C5.85786 2.5 2.5 5.85786 2.5 10C2.5 14.1421 5.85786 17.5 10 17.5Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 6.66667V10.8333M10 13.3333H10.0083" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" />
    </svg>
);

/** icon/success, 20x20: the circle and a 1.667 tick. */
export const SuccessIcon = ({ className }: IconProps) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false" className={cx("block shrink-0", className)}>
        <path d="M10 17.5C14.1421 17.5 17.5 14.1421 17.5 10C17.5 5.85786 14.1421 2.5 10 2.5C5.85786 2.5 2.5 5.85786 2.5 10C2.5 14.1421 5.85786 17.5 10 17.5Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7.08333 10.4167L9.16667 12.5L12.9167 8.33333" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

/** icon/info, 20x20: the circle and an i. */
export const InfoIcon = ({ className }: IconProps) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false" className={cx("block shrink-0", className)}>
        <path d="M10 17.5C14.1421 17.5 17.5 14.1421 17.5 10C17.5 5.85786 14.1421 2.5 10 2.5C5.85786 2.5 2.5 5.85786 2.5 10C2.5 14.1421 5.85786 17.5 10 17.5Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 9.16667V13.3333M10 6.66667H10.0083" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" />
    </svg>
);

/** icon/spinner, 20x20, a three-quarter arc at 2.083, turning (hc-spin). */
export const SpinnerIcon = ({ className }: IconProps) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false" className={cx("hc-spin block shrink-0", className)}>
        <path
            d="M10 2.5C8.51664 2.5 7.06659 2.93987 5.83322 3.76398C4.59985 4.58809 3.63856 5.75943 3.0709 7.12987C2.50325 8.50032 2.35472 10.0083 2.64411 11.4632C2.9335 12.918 3.64781 14.2544 4.6967 15.3033C5.74559 16.3522 7.08197 17.0665 8.53682 17.3559C9.99168 17.6453 11.4997 17.4968 12.8701 16.9291C14.2406 16.3614 15.4119 15.4001 16.236 14.1668C17.0601 12.9334 17.5 11.4834 17.5 10"
            stroke="currentColor"
            strokeWidth="2.08333"
            strokeLinecap="round"
        />
    </svg>
);

/* ── The frame ───────────────────────────────────────────────────────────── */

/**
 * The page. Carries the `hc` scope (so every `--hc-*` token resolves), paints bg/page
 * to the bottom of the viewport, and owns the landmarks the build notes ask for: a skip
 * link first in the tab order, a `header` holding the TopBar, and one `main`.
 *
 * The screens own everything inside `main`: the 1040 column at 200 on 1440, the 560
 * form column at 440, the 16px gutters at 390, and the body's top padding.
 */
export const HelpFrame = ({ topBar, children, className }: { topBar: ReactNode; children: ReactNode; className?: string }) => (
    <div className={cx("hc min-h-dvh bg-(--hc-bg-page)", className)}>
        <a
            href="#main"
            className="hc-t-label-field sr-only rounded-(--hc-radius-lg) bg-(--hc-bg-brand-solid) px-4 py-2 text-(--hc-text-primary_on-brand) focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2"
        >
            Skip to content
        </a>
        <header>{topBar}</header>
        <main id="main" tabIndex={-1}>
            {children}
        </main>
    </div>
);

/* ── TopBar ──────────────────────────────────────────────────────────────── */

/**
 * One breadcrumb segment. Every segment but the last links somewhere; the last is where
 * the person is. `onClick` is for a segment whose destination is the current URL with a
 * momentary state on top (the success card on the help home): the link still navigates,
 * and the caller clears the state.
 */
export type Crumb = { label: string; to?: string; onClick?: () => void };

export type TopBarProps = {
    /**
     * The breadcrumb, first segment to last, with the gem in front of it. The frames
     * draw two segments ("HiddenGem Media / Reporting System"); the client's help centre
     * draws its whole path ("Dashboard / Help Center / Requests / REQ-2418") by the
     * owner's rule (13 Sep 2026: never a dead end for the client). Every segment but the
     * last is a link, the last is in the brand colour. When the trail will not fit the
     * bar, the segments between the first and the last fold into one "…" button that
     * unfolds them in place; nothing is dropped and nothing scrolls out of sight.
     */
    crumbs: Crumb[];
    /**
     * The one text node on the right, in body/helper: "Stay on 30a  ·  Marcus Webb" or
     * "Signed in as Leshan". Rendered white-space: pre, so the two spaces either side of
     * the dot survive. Hidden below 640px, as the 390 frames have no right-hand text.
     * Empty: nothing is rendered there.
     */
    right: string;
    /** The one letter in the avatar. */
    initial: string;
    /** Names the avatar "Account, {accountName}" (build notes). */
    accountName: string;
    /**
     * What the avatar opens. The build notes call it a control, not decoration; the
     * frame gives it no destination, so it is a small menu: who is signed in, the
     * links the caller passes, and Sign out. Without this it is a plain badge.
     */
    menu?: { email: string; links?: Array<{ label: string; to: string }>; onSignOut: () => void };
};

/**
 * The file's TopBar component: 64 tall, bg/page with a 1px border/secondary below,
 * 24 of padding at every width (the 390 frames keep 24: the brand sits at x=24 and the
 * avatar ends at 366), the brand on the left and the account on the right.
 *
 * Brand: the gem at 22, then three separate text nodes in label/field with 8 between
 * them: "HiddenGem Media" (text/primary), "/" (text/tertiary), the app name
 * (fg/brand-primary). The whole brand is one link back to the dashboard. The slash is
 * NOT aria-hidden: the frame draws it as a text node and the proof reads it as one.
 *
 * Account: the right-hand text (body/helper, text/secondary), 8, then the 32px avatar:
 * bg/brand-primary fill, a 1px fg/brand-primary border (the file binds the avatar
 * stroke to fg/brand-primary, not border/brand; in Light they differ), radius full,
 * the initial in caption/meta text/primary.
 */
export const TopBar = ({ crumbs, right, initial, accountName, menu }: TopBarProps) => {
    const navRef = useRef<HTMLElement>(null);
    // The trail folds when it would not fit the bar (a phone showing "Dashboard /
    // Help Center / Requests / REQ-2418"): the first and last segments stay and the
    // ones between become one "…" button that unfolds them in place, wrapping to a
    // second line inside the 64px bar. Nothing is dropped and nothing scrolls out of
    // sight. Measured, not counted: three segments fit at 390 for "Requests" and do
    // not for "Raise a request".
    const [folded, setFolded] = useState(false);
    const [unfolded, setUnfolded] = useState(false);
    const [fit, setFit] = useState(0); // bumped when the bar's width or its font may have changed
    const trail = JSON.stringify(crumbs.map((c) => c.label));
    useLayoutEffect(() => {
        setFolded(false);
        setUnfolded(false);
    }, [trail]);
    useLayoutEffect(() => {
        const nav = navRef.current;
        const last = nav?.querySelector<HTMLElement>("[aria-current=page]");
        if (!nav || !last || folded || unfolded || crumbs.length < 3) return;
        // The last segment truncates rather than overflow, so the bar's own
        // scroll width never says the trail is too long; ask the last segment how
        // wide it wants to be.
        const needed = last.offsetLeft + last.scrollWidth - nav.offsetLeft;
        if (needed > nav.clientWidth + 1) setFolded(true);
    }, [trail, fit, folded, unfolded, crumbs.length]);
    useEffect(() => {
        const remeasure = () => {
            setFolded(false);
            setUnfolded(false);
            setFit((n) => n + 1);
        };
        // Only a change of width can change what fits. A phone fires resize as its
        // address bar comes and goes while scrolling; that must not refold a trail
        // the person has just opened.
        let width = window.innerWidth;
        const onResize = () => {
            if (window.innerWidth === width) return;
            width = window.innerWidth;
            remeasure();
        };
        window.addEventListener("resize", onResize);
        // Inter arrives after the first layout (display=swap): measure again in it.
        let live = true;
        document.fonts?.ready.then(() => {
            if (live) remeasure();
        });
        return () => {
            live = false;
            window.removeEventListener("resize", onResize);
        };
    }, []);
    useEffect(() => {
        if (unfolded) navRef.current?.querySelector<HTMLElement>("[data-crumb='1']")?.focus();
    }, [unfolded]);

    const hidden = folded && !unfolded ? crumbs.slice(1, -1) : [];
    const shown = hidden.length ? [crumbs[0], crumbs[crumbs.length - 1]] : crumbs;
    const segment = (c: Crumb, last: boolean, index: number) => {
        const colour = last ? "text-(--hc-fg-brand-primary)" : "text-(--hc-text-primary)";
        return c.to && !last ? (
            <Link to={c.to} onClick={c.onClick} data-crumb={index} className={cx("hc-t-label-field relative shrink-0 rounded-(--hc-radius-sm) after:absolute after:inset-x-0 after:-inset-y-2.5 after:content-[''] hover:underline", colour)}>
                {c.label}
            </Link>
        ) : (
            <span aria-current={last ? "page" : undefined} className={cx("hc-t-label-field", last ? "min-w-0 truncate" : "shrink-0", colour)}>
                {c.label}
            </span>
        );
    };
    const slash = <span className="hc-t-label-field shrink-0 text-(--hc-text-tertiary)">/</span>;
    return (
        <div className="relative flex h-16 items-center justify-between gap-4 border-b border-(--hc-border-secondary) bg-(--hc-bg-page) px-6">
            <nav ref={navRef} aria-label="Breadcrumb" className={cx("flex min-h-6 min-w-0 flex-1 items-center gap-2 whitespace-nowrap", unfolded && "flex-wrap")}>
                {crumbs.length > 0 && crumbs[0].to ? (
                    <Link to={crumbs[0].to} className="relative flex h-6 shrink-0 items-center gap-2 rounded-(--hc-radius-sm) after:absolute after:inset-x-0 after:-inset-y-2.5 after:content-['']" aria-label={`${crumbs[0].label} (home)`}>
                        <GemIcon />
                    </Link>
                ) : (
                    <GemIcon />
                )}
                {shown.map((c, i) => {
                    const last = i === shown.length - 1;
                    const index = last ? crumbs.length - 1 : i;
                    return (
                        <span key={`${c.label}-${index}`} className="contents">
                            {i > 0 && slash}
                            {i > 0 && hidden.length > 0 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setUnfolded(true)}
                                        aria-label={`Show ${hidden.length === 1 ? "the step" : `the ${hidden.length} steps`} between ${crumbs[0].label} and ${c.label}: ${hidden.map((h) => h.label).join(", ")}`}
                                        className="hc-t-label-field relative shrink-0 cursor-pointer rounded-(--hc-radius-sm) px-1 text-(--hc-text-primary) after:absolute after:inset-x-0 after:-inset-y-2.5 after:content-[''] hover:underline"
                                    >
                                        …
                                    </button>
                                    {slash}
                                </>
                            )}
                            {segment(c, last, index)}
                        </span>
                    );
                })}
            </nav>
            <div className="flex shrink-0 items-center gap-2">
                {right && <span className="hc-t-body-helper hidden whitespace-pre text-(--hc-text-secondary) sm:inline">{right}</span>}
                {menu ? (
                    <AccountMenu initial={initial} accountName={accountName} {...menu} />
                ) : (
                    <span
                        role="img"
                        aria-label={`Account, ${accountName}`}
                        className="hc-t-caption-meta flex size-8 shrink-0 items-center justify-center rounded-(--hc-radius-full) border border-(--hc-fg-brand-primary) bg-(--hc-bg-brand-primary) text-(--hc-text-primary)"
                    >
                        {initial}
                    </span>
                )}
            </div>
        </div>
    );
};

/**
 * The avatar as a control: a button that opens a small card under it with who is
 * signed in, the caller's links and Sign out. Closed, it is pixel for pixel the
 * frame's avatar. Escape and a click outside close it.
 */
const AccountMenu = ({ initial, accountName, email, links = [], onSignOut }: { initial: string; accountName: string; email: string; links?: Array<{ label: string; to: string }>; onSignOut: () => void }) => {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    // Menu keyboard behaviour (build notes: the avatar is a control): the first item
    // takes focus when it opens, arrows move between items, Escape closes and hands
    // focus back to the button, and focus leaving the menu closes it.
    const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    useEffect(() => {
        if (!open) return;
        items()[0]?.focus();
        const onDown = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === "Escape") {
                setOpen(false);
                buttonRef.current?.focus();
                return;
            }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                const list = items();
                if (!list.length) return;
                e.preventDefault();
                const at = list.indexOf(document.activeElement as HTMLElement);
                const next = e.key === "ArrowDown" ? (at + 1) % list.length : (at - 1 + list.length) % list.length;
                list[next].focus();
            }
        };
        const onFocusOut = (e: FocusEvent) => {
            if (rootRef.current && e.relatedTarget && !rootRef.current.contains(e.relatedTarget as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        rootRef.current?.addEventListener("focusout", onFocusOut);
        const root = rootRef.current;
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
            root?.removeEventListener("focusout", onFocusOut);
        };
    }, [open]);
    return (
        <div ref={rootRef} className="relative">
            <button
                ref={buttonRef}
                type="button"
                aria-label={`Account, ${accountName}`}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className="hc-hover hc-t-caption-meta relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-(--hc-radius-full) border border-(--hc-fg-brand-primary) bg-(--hc-bg-brand-primary) text-(--hc-text-primary) after:absolute after:-inset-1.5 after:content-['']"
            >
                {initial}
            </button>
            {open && (
                <div ref={menuRef} role="menu" className="absolute top-10 right-0 z-20 flex w-64 flex-col gap-1 rounded-(--hc-radius-lg) border border-(--hc-border-secondary) bg-(--hc-bg-primary) p-2 shadow-(--hc-elevation-card)">
                    <p className="hc-t-body-helper truncate px-2 py-1.5 text-(--hc-text-tertiary)">{email}</p>
                    {links.map((l) => (
                        <Link key={l.to} role="menuitem" to={l.to} onClick={() => setOpen(false)} className="hc-hover hc-t-label-field cursor-pointer rounded-(--hc-radius-md) px-2 py-2 text-(--hc-text-primary) hover:bg-(--hc-bg-secondary)">
                            {l.label}
                        </Link>
                    ))}
                    <button type="button" role="menuitem" onClick={onSignOut} className="hc-hover hc-t-label-field cursor-pointer rounded-(--hc-radius-md) px-2 py-2 text-left text-(--hc-text-primary) hover:bg-(--hc-bg-secondary)">
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
};

/** "Marcus Webb" -> "M"; "" -> "?". The avatar's letter. */
export const initialOf = (name: string): string => (name.trim()[0] ?? "?").toUpperCase();

/** "Leshan Patterson" -> "Leshan". The name the top bar greets with. */
export const firstNameOf = (name: string): string => name.trim().split(/\s+/)[0] ?? "";

/* ── Button ──────────────────────────────────────────────────────────────── */

type ButtonBase = {
    variant?: "primary" | "secondary";
    /** Shows the spinner before the label and paints bg/brand-solid_hover (state=loading). */
    loading?: boolean;
    /** bg/tertiary with a text/tertiary label, aria-disabled, not interactive (state=disabled). */
    disabled?: boolean;
    /** Full width, where the frame's instance is FILL (the home card, every 390 frame). */
    fill?: boolean;
    className?: string;
    children: ReactNode;
};
export type ButtonProps = ButtonBase & (({ to: string } & { type?: never; onClick?: never }) | ({ to?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled" | "className" | "children">));

/**
 * The file's Button: 48 tall, radius/lg (10), padding 0 24, gap 8, button/label. The
 * frames place it FIXED at 176 wide (the form, the requests heading, the success card)
 * or FILL; 176 is the default and `fill` is the other. A label wider than the content
 * box ("Report another ticket") stays centred and overflows the padding, exactly as the
 * file has it, because the width is fixed rather than hugging.
 *
 *   primary    bg/brand-solid, text/primary_on-brand; hover bg/brand-solid_hover
 *   secondary  bg/secondary, 1px border/primary, text/primary
 *   loading    bg/brand-solid_hover, the spinner then the label, aria-busy
 *   disabled   bg/tertiary, text/tertiary, aria-disabled (the drawn variant)
 *   focus      the 2px border/brand ring 2px outside, from help-centre.css
 *
 * Exactly one primary per view.
 */
export const Button = (props: ButtonProps) => {
    const { variant = "primary", loading = false, disabled = false, fill = false, className, children } = props;
    const base = cx(
        "hc-t-button-label hc-hover inline-flex h-12 w-[176px] shrink-0 items-center justify-center gap-2 rounded-(--hc-radius-lg) whitespace-nowrap",
        // Tailwind v4's preflight leaves a button at the arrow cursor; the owner's
        // rule is that anything clickable shows a pointer (13 Sep 2026).
        !disabled && !loading && "cursor-pointer",
        loading && "cursor-progress",
        fill && "w-full",
        variant === "primary" && !loading && !disabled && "bg-(--hc-bg-brand-solid) px-6 text-(--hc-text-primary_on-brand) hover:bg-(--hc-bg-brand-solid_hover)",
        variant === "primary" && loading && "bg-(--hc-bg-brand-solid_hover) px-6 text-(--hc-text-primary_on-brand)",
        variant === "secondary" && !disabled && "border border-(--hc-border-primary) bg-(--hc-bg-secondary) px-[23px] text-(--hc-text-primary)",
        disabled && "cursor-not-allowed bg-(--hc-bg-tertiary) px-6 text-(--hc-text-tertiary)",
        className,
    );
    const inner = (
        <>
            {loading && <SpinnerIcon />}
            {children}
        </>
    );
    if (props.to !== undefined) {
        return (
            <Link to={props.to} className={base} aria-disabled={disabled || undefined} aria-busy={loading || undefined}>
                {inner}
            </Link>
        );
    }
    const { variant: _v, loading: _l, disabled: _d, fill: _f, className: _c, children: _ch, to: _t, onClick, ...rest } = props;
    void _v;
    void _l;
    void _d;
    void _f;
    void _c;
    void _ch;
    void _t;
    return (
        <button
            type="button"
            {...rest}
            className={base}
            aria-disabled={disabled || undefined}
            aria-busy={loading || undefined}
            onClick={(e) => {
                // aria-disabled rather than the disabled attribute, so the button keeps its
                // place in the tab order and a screen reader can still find and name it.
                if (disabled || loading) {
                    e.preventDefault();
                    return;
                }
                onClick?.(e);
            }}
        >
            {inner}
        </button>
    );
};

/* ── Status/Pill ─────────────────────────────────────────────────────────── */

export type PillTone = "in-progress" | "with-the-team" | "done" | "withdrawn";

const PILL_TONE: Record<PillTone, string> = {
    "in-progress": "bg-(--hc-utility-warning-bg) text-(--hc-utility-warning-fg)",
    "with-the-team": "bg-(--hc-utility-blue-bg) text-(--hc-utility-blue-fg)",
    done: "bg-(--hc-utility-success-bg) text-(--hc-utility-success-fg)",
    withdrawn: "bg-(--hc-bg-tertiary) text-(--hc-text-tertiary)",
};

/**
 * Status/Pill: caption/meta on a full-radius tint, padding 6 by 12, so 28 tall. The
 * label is whatever the caller passes (the frames say "In progress", "Assigned",
 * "Completed", "Withdrawn"); the tone is the variant. Text always carries the state,
 * colour only reinforces it, so no extra accessible name is needed.
 */
export const StatusPill = ({ label, tone, className }: { label: string; tone: PillTone; className?: string }) => (
    <span className={cx("hc-t-caption-meta inline-flex items-center rounded-(--hc-radius-full) px-3 py-1.5 whitespace-nowrap", PILL_TONE[tone], className)}>{label}</span>
);

/* ── Filter chip ─────────────────────────────────────────────────────────── */

/**
 * The requests screen's filter, a toggle button with aria-pressed (build notes). From
 * the frames: 36 tall with padding 8 by 14 on desktop, 44 tall with 12 by 16 at 390,
 * radius full, 1px border, body/helper.
 *
 *   selected   bg/brand-primary, border/brand, text/brand-secondary
 *   otherwise  bg/primary, border/primary, text/secondary
 *   focus      the border thickens to 2px border/brand (the build notes' specimen)
 */
export const FilterChip = ({
    selected,
    children,
    className,
    ...rest
}: { selected: boolean; children: ReactNode; className?: string } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">) => (
    <button
        type="button"
        aria-pressed={selected}
        {...rest}
        className={cx(
            "hc-focus-border hc-hover hc-t-body-helper inline-flex h-11 cursor-pointer items-center rounded-(--hc-radius-full) border px-[15px] whitespace-nowrap sm:h-9 sm:px-[13px]",
            selected
                ? "border-(--hc-border-brand) bg-(--hc-bg-brand-primary) text-(--hc-text-brand-secondary)"
                : "border-(--hc-border-primary) bg-(--hc-bg-primary) text-(--hc-text-secondary) hover:bg-(--hc-bg-primary_hover)",
            "focus-visible:border-2 focus-visible:border-(--hc-border-brand) focus-visible:px-[14px] focus-visible:text-(--hc-text-brand-secondary) sm:focus-visible:px-[12px]",
            className,
        )}
    >
        {children}
    </button>
);

/* ── Card and the small pieces ───────────────────────────────────────────── */

/**
 * The white card every screen is built from: bg/primary, 1px border/secondary,
 * radius/xl (12), elevation/card, padding 24 on desktop and 16 at 390 (23 and 15 plus
 * the border). `flat` drops the shadow for a card that sits inside another.
 */
export const Card = ({ children, className, flat, as: Tag = "div" }: { children: ReactNode; className?: string; flat?: boolean; as?: "div" | "section" | "article" | "ul" | "li" }) => (
    <Tag className={cx("rounded-(--hc-radius-xl) border border-(--hc-border-secondary) bg-(--hc-bg-primary) p-[15px] sm:p-[23px]", !flat && "shadow-(--hc-elevation-card)", className)}>
        {children}
    </Tag>
);

/**
 * caption/meta in text/tertiary. The frames write the eyebrow in capitals in the source
 * ("HELP CENTER", "COMMITTED"), so the caller does too; there is no text-transform here
 * because a transformed node does not read as the frame's words.
 */
export const Eyebrow = ({ children, className, as: Tag = "p" }: { children: ReactNode; className?: string; as?: "p" | "span" | "h2" | "h3" }) => (
    <Tag className={cx("hc-t-caption-meta text-(--hc-text-tertiary)", className)}>{children}</Tag>
);

/** A reference in mono/id, text/tertiary. Monospaced so two are comparable digit by digit. */
export const MonoRef = ({ children, className }: { children: ReactNode; className?: string }) => (
    <span className={cx("hc-t-mono-id whitespace-nowrap text-(--hc-text-tertiary)", className)}>{children}</span>
);

/** The 8px brand dot on a topic tile (fg/brand-primary, radius full). An empty span: nothing to announce. */
export const Marker = ({ className }: { className?: string }) => <span aria-hidden="true" className={cx("inline-block size-2 shrink-0 rounded-(--hc-radius-full) bg-(--hc-fg-brand-primary)", className)} />;

/**
 * The "›" at the end of a tile: a text glyph in heading/section, text/tertiary, not an
 * icon. Not aria-hidden, because the frame draws it as a text node and the parity
 * proof reads it as one; a screen reader treats the glyph as punctuation.
 */
// aria-hidden: decorative, per the build notes, so a tile's accessible name is its label
// alone. The parity proof reads painted text, hidden from readers or not.
export const Chevron = ({ className }: { className?: string }) => <span aria-hidden="true" className={cx("hc-t-heading-section shrink-0 text-(--hc-text-tertiary)", className)}>›</span>;

/* ── Fields ──────────────────────────────────────────────────────────────── */

/** The label row every field starts with: the label in label/field text/secondary, "Required" or "Optional" in caption/meta text/tertiary on the right, baseline-aligned. */
const LabelRow = ({ htmlFor, label, requirement }: { htmlFor: string; label: string; requirement?: "Required" | "Optional" }) => (
    <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="hc-t-label-field text-(--hc-text-secondary)">
            {label}
        </label>
        {requirement && <span className="hc-t-caption-meta text-(--hc-text-tertiary)">{requirement}</span>}
    </div>
);

/** The line under a control: the error in text/error-primary when there is one, else the helper in text/tertiary. Both body/helper. */
const FieldNote = ({ id, helper, error }: { id: string; helper?: string; error?: string }) =>
    error ? (
        <p id={id} className="hc-t-body-helper text-(--hc-text-error-primary)">
            {error}
        </p>
    ) : helper ? (
        <p id={id} className="hc-t-body-helper text-(--hc-text-tertiary)">
            {helper}
        </p>
    ) : null;

export type FieldSelectProps = {
    id?: string;
    label: string;
    requirement?: "Required" | "Optional";
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    /** The first option, with an empty value: "Choose a client". */
    placeholder: string;
    helper?: string;
    error?: string;
    disabled?: boolean;
    className?: string;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "value" | "onChange" | "disabled" | "className" | "children">;

/**
 * Field/Select: a label row, a 48px native select (bg/primary, 1px border/primary,
 * radius/md, padding 0 16, body/input, the chevron-down icon 16 from the right edge),
 * then the helper or error line. Gap 8 between the three.
 *
 *   default   the placeholder in text/tertiary
 *   filled    the value in text/primary
 *   focus     2px border/brand (the padding gives up the extra pixel)
 *   error     border/error, the error line, aria-invalid
 *   disabled  bg/tertiary, text/tertiary
 */
export const FieldSelect = ({ id: givenId, label, requirement, value, onChange, options, placeholder, helper, error, disabled, className, ...rest }: FieldSelectProps) => {
    const autoId = useId();
    const id = givenId ?? autoId;
    const noteId = `${id}-note`;
    return (
        <div className={cx("flex flex-col gap-2", className)}>
            <LabelRow htmlFor={id} label={label} requirement={requirement} />
            <div className="relative">
                <select
                    id={id}
                    {...rest}
                    value={value}
                    disabled={disabled}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={helper || error ? noteId : undefined}
                    onChange={(e) => onChange(e.target.value)}
                    className={cx(
                        "hc-focus-border hc-t-body-input hc-hover block h-12 w-full appearance-none rounded-(--hc-radius-md) border pr-[51px] pl-[15px]",
                        "focus:border-2 focus:border-(--hc-border-brand) focus:pl-[14px]",
                        error ? "border-(--hc-border-error)" : "border-(--hc-border-primary)",
                        disabled ? "cursor-not-allowed bg-(--hc-bg-tertiary) text-(--hc-text-tertiary)" : value ? "cursor-pointer bg-(--hc-bg-primary) text-(--hc-text-primary)" : "cursor-pointer bg-(--hc-bg-primary) text-(--hc-text-tertiary)",
                    )}
                >
                    <option value="" disabled>
                        {placeholder}
                    </option>
                    {options.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute top-[13px] right-[15px] text-(--hc-text-tertiary)" />
            </div>
            <FieldNote id={noteId} helper={helper} error={error} />
        </div>
    );
};

export type FieldTextareaProps = {
    id?: string;
    label: string;
    requirement?: "Required" | "Optional";
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    helper?: string;
    error?: string;
    disabled?: boolean;
    className?: string;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "value" | "onChange" | "disabled" | "className" | "children">;

/**
 * Field/Textarea: the same shell as the select around a 144px textarea (bg/primary,
 * 1px border/primary, radius/md, padding 16, body/input, placeholder text/tertiary).
 *
 * Height follows the frames, which differ by width: the desktop frames keep the
 * control FIXED at 144 and let a long description scroll inside it (the filled frame
 * is 144 tall with five lines in it), while the 390 frames let it HUG its content (the
 * filled 390 frame is 200 tall). So below 640px the box grows with what is typed, from
 * 144 up, which also spares a phone a scroll box inside the page's scroll.
 */
export const FieldTextarea = ({ id: givenId, label, requirement, value, onChange, placeholder, helper, error, disabled, className, ...rest }: FieldTextareaProps) => {
    const autoId = useId();
    const id = givenId ?? autoId;
    const noteId = `${id}-note`;
    const ref = useRef<HTMLTextAreaElement>(null);
    // Below 640px the height follows scrollHeight, from 144 up; at 640px and above the
    // class height (144) stands and the inline height is cleared. An effect, so a value
    // set from outside (a draft restored) sizes the box too, and re-run on resize.
    useEffect(() => {
        const size = () => {
            const el = ref.current;
            if (!el) return;
            if (window.matchMedia("(min-width: 640px)").matches) {
                el.style.height = "";
                return;
            }
            el.style.height = "auto";
            el.style.height = `${Math.max(144, el.scrollHeight)}px`;
        };
        size();
        window.addEventListener("resize", size);
        return () => window.removeEventListener("resize", size);
    }, [value]);
    return (
        <div className={cx("flex flex-col gap-2", className)}>
            <LabelRow htmlFor={id} label={label} requirement={requirement} />
            <textarea
                ref={ref}
                id={id}
                {...rest}
                value={value}
                disabled={disabled}
                placeholder={placeholder}
                aria-invalid={error ? true : undefined}
                aria-describedby={helper || error ? noteId : undefined}
                onChange={(e) => onChange(e.target.value)}
                className={cx(
                    "hc-focus-border hc-t-body-input hc-hover block h-36 w-full resize-none overflow-hidden rounded-(--hc-radius-md) border bg-(--hc-bg-primary) p-[15px] text-(--hc-text-primary) placeholder:text-(--hc-text-tertiary) sm:overflow-y-auto",
                    "focus:border-2 focus:border-(--hc-border-brand) focus:p-[14px]",
                    error ? "border-(--hc-border-error)" : "border-(--hc-border-primary)",
                    disabled && "cursor-not-allowed bg-(--hc-bg-tertiary) text-(--hc-text-tertiary)",
                )}
            />
            <FieldNote id={noteId} helper={helper} error={error} />
        </div>
    );
};

export type FieldUploadProps = {
    id?: string;
    label: string;
    requirement?: "Required" | "Optional";
    /** How many files are attached already: past zero the title reads "Add another screenshot". */
    attachedCount: number;
    /** Called with the files picked or dropped. The caller validates type, size and count. */
    onFiles: (files: File[]) => void;
    /** The rules line under the title. Default: the frame's. */
    rules?: string;
    /** Replaces the rules line in text/error-primary and paints border/error. */
    error?: string;
    accept?: string;
    disabled?: boolean;
    className?: string;
};

/**
 * Field/Upload: a label row and a 128px drop zone (bg/primary, 1px dashed border/primary,
 * radius/lg, padding 0 24, its contents centred with gap 8: the upload icon at 28 in
 * fg/brand-primary, the title in label/field text/primary, the rules in body/helper
 * text/tertiary). The zone is one label around a real, visually hidden
 * `<input type="file" multiple>`, so a click anywhere opens the picker and the input
 * keeps its place in the tab order.
 *
 *   dragover   bg/brand-primary, 2px solid border/brand, rules in text/secondary
 *   error      border/error, the icon and the message in text/error-primary
 *   focus      the halo from help-centre.css (2px page ground, 2px border/brand)
 */
export const FieldUpload = ({
    id: givenId,
    label,
    requirement,
    attachedCount,
    onFiles,
    rules = "PNG, JPG or WEBP · up to 10 MB each · up to 5 files",
    error,
    accept = "image/*",
    disabled,
    className,
}: FieldUploadProps) => {
    const autoId = useId();
    const id = givenId ?? autoId;
    const [over, setOver] = useState(false);
    const title = attachedCount > 0 ? "Add another screenshot" : "Drop screenshots here, or browse";
    const take = useCallback(
        (list: FileList | null) => {
            const files = Array.from(list ?? []);
            if (files.length) onFiles(files);
        },
        [onFiles],
    );
    return (
        <div className={cx("flex flex-col gap-2", className)}>
            <LabelRow htmlFor={id} label={label} requirement={requirement} />
            <label
                htmlFor={id}
                onDragEnter={(e) => {
                    e.preventDefault();
                    if (!disabled) setOver(true);
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    if (!disabled) setOver(true);
                }}
                onDragLeave={(e) => {
                    // Leaving a child fires too; only a departure from the zone itself counts.
                    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                    setOver(false);
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    setOver(false);
                    if (!disabled) take(e.dataTransfer.files);
                }}
                className={cx(
                    "hc-focus-halo hc-hover flex h-32 flex-col items-center justify-center gap-2 rounded-(--hc-radius-lg) border px-[23px]",
                    disabled ? "cursor-not-allowed" : "cursor-pointer",
                    // The stroke is dashed in every state but dragover (the frames; the JSON
                    // dump carries only the stroke's colour).
                    over ? "border-2 border-solid border-(--hc-border-brand) bg-(--hc-bg-brand-primary) px-[22px]" : error ? "border-dashed border-(--hc-border-error) bg-(--hc-bg-primary)" : "border-dashed border-(--hc-border-primary) bg-(--hc-bg-primary)",
                )}
            >
                <input
                    id={id}
                    type="file"
                    accept={accept}
                    multiple
                    disabled={disabled}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={`${id}-rules`}
                    className="sr-only"
                    onChange={(e) => {
                        take(e.target.files);
                        // Reset so the same file can be picked again after a remove.
                        e.target.value = "";
                    }}
                />
                <UploadIcon className={error ? "text-(--hc-text-error-primary)" : "text-(--hc-fg-brand-primary)"} />
                <span className="hc-t-label-field text-center whitespace-nowrap text-(--hc-text-primary)">{title}</span>
                {/* The rules line doubles as the error line, announced when it changes; a
                    60-character file name in an error must wrap, not widen the page. */}
                <span
                    id={`${id}-rules`}
                    aria-live="polite"
                    className={cx("hc-t-body-helper w-full min-w-0 text-center break-words", error ? "text-(--hc-text-error-primary)" : over ? "text-(--hc-text-secondary)" : "text-(--hc-text-tertiary)")}
                >
                    {error ?? rules}
                </span>
            </label>
        </div>
    );
};

/** 1228800 -> "1.2 MB", 860160 -> "840 KB": binary units, as the frame's sizes read. */
export const formatFileSize = (bytes: number): string => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

/**
 * File/Thumbnail: one attached file. 56 tall, bg/tertiary, 1px border/primary,
 * radius/md, padding 0 8, gap 16: the 40px preview (bg/brand-primary, radius/sm), the
 * name in body/helper text/primary over the meta in mono/id text/tertiary (gap 4), and
 * the 40px remove button with the x icon in text/secondary. The remove target is 44
 * even though the button draws at 40 (build notes: nothing under 44).
 */
export const FileThumbnail = ({
    name,
    meta,
    previewUrl,
    onRemove,
    className,
    as: Tag = "li",
    ...rest
}: {
    name: string;
    /** "1.2 MB · uploaded" */
    meta: string;
    previewUrl?: string | null;
    onRemove: () => void;
    className?: string;
    as?: "li" | "div";
    /** Lets a caller find the row again (a remove moves focus to the next one). */
    "data-file-id"?: number | string;
}) => (
    <Tag {...rest} className={cx("flex h-14 items-center gap-4 rounded-(--hc-radius-md) border border-(--hc-border-primary) bg-(--hc-bg-tertiary) px-[7px]", className)}>
        <span className="size-10 shrink-0 overflow-hidden rounded-(--hc-radius-sm) bg-(--hc-bg-brand-primary)">
            {previewUrl && <img src={previewUrl} alt="" className="size-full object-cover" draggable={false} />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="hc-t-body-helper truncate text-(--hc-text-primary)">{name}</span>
            <span className="hc-t-mono-id truncate text-(--hc-text-tertiary)">{meta}</span>
        </span>
        <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${name}`}
            className="hc-hover relative flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-(--hc-radius-sm) text-(--hc-text-secondary) after:absolute after:-inset-0.5 after:content-[''] hover:text-(--hc-text-primary)"
        >
            <XIcon />
        </button>
    </Tag>
);

/* ── Priority ────────────────────────────────────────────────────────────── */

/** The platform's own enum (triage.ts). Do not rename. */
export type PriorityLevel = "low" | "medium" | "high" | "urgent";

export const PRIORITY_LEVELS: ReadonlyArray<{ value: PriorityLevel; label: string; meaning: string }> = [
    // The estimate per urgency is Brandon's note on the file (13 Sep 2026); the owner set
    // Urgent at 24 hours. Low has no set time and says so.
    { value: "low", label: "Low", meaning: "Low: Cosmetic or nice-to-have. Nobody is blocked. No set time; scheduled after the higher priorities." },
    { value: "medium", label: "Medium", meaning: "Medium: Something is wrong but there is a workaround. Fix this week: within 5 working days." },
    { value: "high", label: "High", meaning: "High: A client-facing feature is broken or a client is asking. Fix today: within 1 working day." },
    { value: "urgent", label: "Urgent", meaning: "Urgent: Revenue is stopping: bookings, payments or the site are down. Drop everything: within 24 hours." },
];

/** The dot and the selected chip, per level: utility blue, success, warning, error. */
const PRIORITY_TONE: Record<PriorityLevel, { dot: string; selected: string }> = {
    low: { dot: "bg-(--hc-utility-blue-fg)", selected: "border-(--hc-utility-blue-fg) bg-(--hc-utility-blue-bg)" },
    medium: { dot: "bg-(--hc-utility-success-fg)", selected: "border-(--hc-utility-success-fg) bg-(--hc-utility-success-bg)" },
    high: { dot: "bg-(--hc-utility-warning-fg)", selected: "border-(--hc-utility-warning-fg) bg-(--hc-utility-warning-bg)" },
    urgent: { dot: "bg-(--hc-utility-error-fg)", selected: "border-(--hc-utility-error-fg) bg-(--hc-utility-error-bg)" },
};

/**
 * The 8px priority dot on its own, for a chip, a legend row or a summary. The file
 * draws it as an ELLIPSE; a full border radius is the same circle.
 */
export const PriorityDot = ({ level, className }: { level: PriorityLevel; className?: string }) => (
    <span className={cx("inline-block size-2 shrink-0 rounded-(--hc-radius-full)", PRIORITY_TONE[level].dot, className)} />
);

/**
 * Priority/Chip: 40 tall, radius full, padding 0 16, gap 8, the dot then the label in
 * label/field. Unselected: bg/primary, 1px border/primary, text/secondary. Selected:
 * the level's utility tint, a 1.5px border in the level's utility colour, text/primary.
 * A radio: `role="radio"` with aria-checked, inside a PriorityChipGroup radiogroup.
 * Hugs its label on desktop; the group stretches it to half the row at 390.
 */
export const PriorityChip = ({
    level,
    selected,
    onSelect,
    tabIndex,
    className,
    ...rest
}: { level: PriorityLevel; selected: boolean; onSelect: (level: PriorityLevel) => void; tabIndex?: number; className?: string } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children" | "onClick" | "onSelect" | "tabIndex">) => {
    const meta = PRIORITY_LEVELS.find((p) => p.value === level)!;
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            data-level={level}
            tabIndex={tabIndex}
            onClick={() => onSelect(level)}
            {...rest}
            className={cx(
                "hc-focus-border hc-hover hc-t-label-field inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-(--hc-radius-full) border whitespace-nowrap",
                selected ? cx("border-[1.5px] px-[14.5px] text-(--hc-text-primary)", PRIORITY_TONE[level].selected) : "border-(--hc-border-primary) bg-(--hc-bg-primary) px-[15px] text-(--hc-text-secondary) hover:bg-(--hc-bg-primary_hover)",
                "focus-visible:border-2 focus-visible:border-(--hc-border-brand) focus-visible:px-[14px]",
                className,
            )}
        >
            <PriorityDot level={level} />
            {meta.label}
        </button>
    );
};

/**
 * The four chips as one radiogroup: gap 8, wrapping and hugging on desktop, two to a
 * row at 390 (each chip FILL at 171 on a 358 column). Arrow keys move the selection,
 * the way a native radio group does; only the selected chip (or the first, when none
 * is) is in the tab order.
 */
export const PriorityChipGroup = ({
    value,
    onChange,
    labelledBy,
    className,
}: {
    value: PriorityLevel | null;
    onChange: (level: PriorityLevel) => void;
    /** The id of the "Priority" label. */
    labelledBy?: string;
    className?: string;
}) => {
    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const keys: Record<string, 1 | -1> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        const step = keys[e.key];
        if (!step) return;
        e.preventDefault();
        const i = PRIORITY_LEVELS.findIndex((p) => p.value === value);
        // Nothing selected yet: right goes to the first chip, left to the last.
        const from = i < 0 ? (step > 0 ? -1 : 0) : i;
        const next = PRIORITY_LEVELS[(from + step + PRIORITY_LEVELS.length) % PRIORITY_LEVELS.length].value;
        onChange(next);
        e.currentTarget.querySelector<HTMLButtonElement>(`[data-level="${next}"]`)?.focus();
    };
    return (
        <div role="radiogroup" aria-labelledby={labelledBy} onKeyDown={onKeyDown} className={cx("grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:gap-2", className)}>
            {PRIORITY_LEVELS.map((p, i) => (
                <PriorityChip key={p.value} level={p.value} selected={value === p.value} onSelect={onChange} tabIndex={value === p.value || (value === null && i === 0) ? 0 : -1} />
            ))}
        </div>
    );
};

/**
 * Priority/Legend: the one-line meaning of each level, body/helper text/tertiary, with
 * the level's dot centred in a 8x20 column before it, gap 8 between rows and 8 between
 * dot and text. Shown under the chips so people pick by consequence, not by mood.
 */
export const PriorityLegend = ({ className }: { className?: string }) => (
    <ul className={cx("flex flex-col gap-2", className)}>
        {PRIORITY_LEVELS.map((p) => (
            <li key={p.value} className="flex items-start gap-2">
                <span className="flex h-5 w-2 shrink-0 items-center justify-center">
                    <PriorityDot level={p.value} />
                </span>
                <span className="hc-t-body-helper min-w-0 flex-1 text-(--hc-text-tertiary)">{p.meaning}</span>
            </li>
        ))}
    </ul>
);

/* ── Banner ──────────────────────────────────────────────────────────────── */

export type BannerKind = "error" | "success" | "info";

const BANNER: Record<BannerKind, { box: string; icon: string; Icon: (p: IconProps) => ReactNode }> = {
    error: { box: "border-(--hc-text-error-primary) bg-(--hc-bg-error-primary)", icon: "text-(--hc-text-error-primary)", Icon: ErrorIcon },
    success: { box: "border-(--hc-text-success-primary) bg-(--hc-bg-success-primary)", icon: "text-(--hc-text-success-primary)", Icon: SuccessIcon },
    info: { box: "border-(--hc-fg-brand-primary) bg-(--hc-bg-brand-primary)", icon: "text-(--hc-fg-brand-primary)", Icon: InfoIcon },
};

/**
 * Banner: a form-level message. Radius/lg, padding 16, gap 16: the 20px icon, then the
 * title in label/field text/primary over the body in body/helper text/secondary (gap 8).
 * Error names what is wrong and where (role alert); success says what happens next so
 * nobody wonders whether to chase it (role status).
 */
export const Banner = ({ kind, title, children, className, id }: { kind: BannerKind; title: string; children: ReactNode; className?: string; id?: string }) => {
    const k = BANNER[kind];
    return (
        <div id={id} role={kind === "error" ? "alert" : "status"} className={cx("flex gap-4 rounded-(--hc-radius-lg) border p-[15px]", k.box, className)}>
            <k.Icon className={k.icon} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="hc-t-label-field text-(--hc-text-primary)">{title}</p>
                <p className="hc-t-body-helper text-(--hc-text-secondary)">{children}</p>
            </div>
        </div>
    );
};
