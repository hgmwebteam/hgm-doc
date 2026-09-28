import { WelcomeFlowSection } from "@/components/application/welcome-flow";
import { Aurora, Halftone, RakingLight, Ridgeline, Weave } from "@/components/shared-assets/backdrops";

/**
 * `/test` — three iPhone bezels holding real captures of our own client-facing pages.
 *
 * The bezels in `public/device-mockups/` are extracted from the shared Figma exports in
 * `~/Documents/For_You_Claude/device-bezels/` (base64 PNGs inside .svg wrappers, not vector),
 * resized to ~2x their render width and cropped to the opaque bounding box so the image box
 * and the device are the same rectangle. The screen is a true cut-out — alpha 0 at its centre —
 * so the screenshot sits BEHIND the frame and the frame's own edge and reflections fall over it.
 *
 * `screen` is that cut-out measured off the cropped bitmap as percentages, so it holds at any
 * rendered size. Derived by scanning the alpha channel: a row at mid-height for left/right, a
 * column at 25% width for top/bottom (25% keeps the Dynamic Island out of the scan).
 */

type Mockup = {
    /** Bezel file in `public/device-mockups/`, without the extension. */
    bezel: string;
    /** Device name, shown under the frame. */
    device: string;
    /** Cropped bitmap dimensions — drives the wrapper's aspect ratio. */
    px: [number, number];
    /** Screen cut-out as a percentage of the cropped bitmap. */
    screen: { left: number; top: number; width: number; height: number };
    /** Screenshot pair in `public/device-mockups/`, as `screen-{shot}-{light|dark}.jpg`. */
    shot: string;
    /** Route the screenshot was taken on. */
    route: string;
    /** Short caption — these frames are ~220px wide at md, so it has to stay on one line. */
    label: string;
};

const MOCKUPS: Mockup[] = [
    {
        bezel: "iphone-17-pro-silver",
        device: "iPhone 17 Pro",
        px: [626, 1290],
        screen: { left: 4.313, top: 1.86, width: 91.374, height: 96.279 },
        shot: "metapixel",
        route: "/metapixel",
        label: "Meta Pixel guide",
    },
    {
        bezel: "iphone-16",
        device: "iPhone 16",
        px: [618, 1260],
        screen: { left: 5.178, top: 2.302, width: 89.644, height: 95.397 },
        shot: "brand-vision-form",
        route: "/brand-vision-form",
        label: "Brand Vision Form",
    },
    {
        bezel: "iphone-air-space-black",
        device: "iPhone Air",
        px: [636, 1313],
        screen: { left: 4.088, top: 1.676, width: 91.824, height: 96.649 },
        shot: "popup",
        route: "/popup",
        label: "Popup guide",
    },
];

/**
 * Percentage corner radius, so it tracks the frame at every size. The horizontal and vertical
 * halves are given separately (`x% / y%`) because a single percentage is resolved per axis and
 * would ellipse the corner on a 1:2.06 box. ~4.7% of the screen's width is the display radius on
 * a real iPhone; the vertical figure is the same physical distance expressed against the height.
 */
const screenRadius = ({ px, screen }: Mockup) => {
    const w = (px[0] * screen.width) / 100;
    const h = (px[1] * screen.height) / 100;
    const r = w * 0.047;
    return `${((r / w) * 100).toFixed(2)}% / ${((r / h) * 100).toFixed(2)}%`;
};

const DeviceMockup = (m: Mockup) => (
    <li className="flex flex-col items-center">
        <div className="relative w-full max-w-[280px]" style={{ aspectRatio: `${m.px[0]} / ${m.px[1]}` }}>
            {/* The screen, behind the frame. */}
            <div
                className="absolute overflow-hidden bg-primary"
                style={{
                    left: `${m.screen.left}%`,
                    top: `${m.screen.top}%`,
                    width: `${m.screen.width}%`,
                    height: `${m.screen.height}%`,
                    borderRadius: screenRadius(m),
                }}
            >
                <img src={`/device-mockups/screen-${m.shot}-light.jpg`} alt="" className="size-full object-cover object-top dark:hidden" />
                <img src={`/device-mockups/screen-${m.shot}-dark.jpg`} alt="" className="hidden size-full object-cover object-top dark:block" />
            </div>
            {/* Decorative frame: the meaning is in the caption below, not in the bezel. */}
            <img src={`/device-mockups/${m.bezel}.png`} alt="" className="pointer-events-none relative z-10 size-full drop-shadow-xl select-none" />
        </div>

        <p className="mt-6 text-sm font-semibold text-primary">{m.label}</p>
        <p className="mt-1 font-mono text-xs text-brand-secondary">{m.route}</p>
        <p className="mt-1 text-xs text-quaternary">{m.device}</p>
    </li>
);

/**
 * The five drawn backdrops, each on its own tile so they can be compared side by
 * side. Every tile is `relative isolate` because the backdrop layers render at
 * `-z-10` — without it they would sit behind the page instead of behind the tile.
 */
const BACKDROPS: { name: string; note: string; render: () => React.ReactNode }[] = [
    {
        name: "Aurora",
        note: "Three wide radial blooms, one brand and two neutral. No texture, no edges — depth rather than pattern. The quietest of the five, and the one that sits under dense copy without competing.",
        render: () => <Aurora />,
    },
    {
        name: "Weave",
        note: "The grid at a 5px pitch, so it stops being a grid and reads as woven cloth. Uses a border token, not a surface one: at this density the surface tokens are too close to the canvas to register.",
        render: () => <Weave />,
    },
    {
        name: "Halftone",
        note: "A dot screen fading out, print-derived. Strong enough to be a picture, so it wants space rather than paragraphs on top of it.",
        render: () => <Halftone />,
    },
    {
        name: "Ridgeline",
        note: "Layered contour bands. The most illustrative of the set — a backdrop for a short heading, not a wall of text.",
        render: () => <Ridgeline />,
    },
    {
        name: "RakingLight",
        note: "A single low-angle sweep, like light across a surface. Directional, so it pairs with content anchored to one side.",
        render: () => <RakingLight />,
    },
];

export const TestScreen = () => (
    <main className="min-h-dvh bg-secondary">
        <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 lg:py-24">
            <header className="max-w-2xl">
                <h1 className="text-display-sm font-semibold text-primary">Device mockups</h1>
                <p className="mt-3 text-md text-pretty text-tertiary">
                    Three of our client-facing pages, captured at 390&times;844 and dropped behind real iPhone frames. The screenshots follow the theme, so this
                    section reads correctly in both light and dark mode.
                </p>
            </header>

            <ul className="mt-12 grid grid-cols-1 justify-items-center gap-12 md:mt-16 md:grid-cols-3 md:items-end md:gap-8 lg:gap-10">
                {MOCKUPS.map((m) => (
                    <DeviceMockup key={m.bezel} {...m} />
                ))}
            </ul>
        </section>

        {/* ── Welcome Flow, as a client sees it ──
            Here so the client-facing feedback rail can be looked at without a client
            dashboard, its share password, or a welcome_flows row: no `slug` is passed, so
            the section renders its built-in template and neither reads nor writes anything.
            `send` is a no-op that resolves — the box shows its "Sent" confirmation, but
            nothing leaves the page, which is the point of previewing it here.

            Its own column, not the max-w-5xl one above: the rail joins the previews at
            1012px of available width, and max-w-5xl is under that, so this section would
            otherwise show the stacked layout and misrepresent the design. 1240px matches
            the real dashboard's content column. */}
        <section className="mx-auto w-full max-w-[1240px] px-4 pb-16 sm:px-6 lg:px-10 lg:pb-24">
            <header className="max-w-2xl">
                <h2 className="text-display-xs font-semibold text-primary">Welcome Flow — client feedback</h2>
                <p className="mt-3 text-md text-pretty text-tertiary">
                    The client&rsquo;s view of the Welcome Email Flow, with the feedback box beside the previews. One note covers all nine emails, so it stays
                    put as you change tabs &mdash; including on the tabs whose email isn&rsquo;t designed yet. Sending is not wired up on this page.
                </p>
            </header>

            <div className="mt-10">
                <WelcomeFlowSection
                    clientName="Lagom Retreat"
                    isLocked
                    isTemplate={false}
                    feedback={{
                        mode: "client",
                        items: [],
                        author: "preview@hgmportal.com",
                        sendFor: async () => undefined,
                        withdraw: async () => undefined,
                        resolve: async () => undefined,
                    }}
                />
            </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6 lg:pb-24">
            <header className="max-w-2xl">
                <h2 className="text-display-xs font-semibold text-primary">Drawn backdrops</h2>
                <p className="mt-3 text-md text-pretty text-tertiary">
                    Ported from the HiddenGem marketing site. All CSS, no imports and no hardcoded colour &mdash; every layer reads a token, so they arrive
                    wearing this project&rsquo;s blue rather than that site&rsquo;s gold, and they re-theme with the page. Flip to dark mode and they follow.
                </p>
            </header>

            <ul className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
                {BACKDROPS.map((b) => (
                    <li key={b.name} className="overflow-hidden rounded-2xl bg-primary ring-1 ring-secondary">
                        <div className="relative isolate flex h-52 items-center justify-center bg-primary">
                            {b.render()}
                            <span className="font-mono text-xs tracking-[0.14em] text-quaternary uppercase">{b.name}</span>
                        </div>
                        <p className="border-t border-secondary px-4 py-3 text-sm text-tertiary">{b.note}</p>
                    </li>
                ))}
            </ul>
        </section>
    </main>
);
