import { useEffect, useState } from "react";
import { BarChart01, ChevronDown, CursorClick01, LayersThree01, Sliders01, Type01 } from "@untitledui-pro/icons/line";
import { TextFx } from "@/components/marketing/text-effects/text-fx";
import { Reveal } from "@/components/shared-assets/reveal";
import {
    BlurUp,
    Counter,
    DesktopPage,
    Disclosure,
    EasingLab,
    FamilyStage,
    FrameBench,
    HouseLab,
    LaptopFrame,
    NativeDialog,
    ParallaxLayers,
    PhoneFrame,
    PinStage,
    ReplayScope,
    ScatterStage,
    ScrubStage,
    SharedElementGrid,
    ShowcaseStage,
    SkeletonDemo,
    SnapGallery,
    SpiralStage,
    ViewTransitionTabs,
} from "@/pages/team/animation-parts";
import { cx } from "@/utils/cx";

/**
 * /animation — the motion reference, ported from the HiddenGem marketing site
 * and rebuilt on this project's committed device bezels (/test's pattern).
 *
 * EVERY NUMBER ON THIS PAGE WAS MEASURED, not remembered. On 29 August 2026 the
 * live stylesheets and scripts of six pages across four companies were fetched
 * and counted — apple.com, two Apple product pages, linear.app, stripe.com and
 * aman.com, about 5MB of CSS and 7MB of JS. Section 28 carries the tallies.
 *
 * THE ORDER IS SMALLEST TO LARGEST, on purpose. Hover before entrance, entrance
 * before pinned section, pinned section before scrubbed film — because that is
 * the order of how often each one is needed, and the opposite of the order in
 * which they are exciting to build.
 *
 * Team-internal, like /test: registered in main.tsx, not linked from anywhere.
 */

/* -------------------------------------------------------------------------- */
/* Local primitives                                                            */
/* -------------------------------------------------------------------------- */

const Container = ({ className, children }: { className?: string; children: React.ReactNode }) => (
    <div className={cx("mx-auto w-full max-w-5xl px-5 sm:px-6", className)}>{children}</div>
);

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
    <p className="font-mono text-xs tracking-[0.14em] text-brand-secondary uppercase">{children}</p>
);

const SectionHeading = ({ className, children }: { className?: string; children: React.ReactNode }) => (
    <h2 className={cx("max-w-[26ch] text-display-sm font-semibold text-primary", className)}>{children}</h2>
);

/** The three committed screenshot pairs — the page's entire asset library. */
const SHOTS = {
    metapixel: { shot: "metapixel", img: "/device-mockups/screen-metapixel-light.jpg", title: "Meta Pixel guide", route: "/metapixel" },
    form: { shot: "brand-vision-form", img: "/device-mockups/screen-brand-vision-form-light.jpg", title: "Brand Vision Form", route: "/brand-vision-form" },
    popup: { shot: "popup", img: "/device-mockups/screen-popup-light.jpg", title: "Popup guide", route: "/popup" },
};

/* -------------------------------------------------------------------------- */
/* Section 01 · Easing and duration                                            */
/* -------------------------------------------------------------------------- */

const EasingSection = () => (
    <section id="easing" className="scroll-mt-20 py-20 md:py-28">
        <Container>
            <Eyebrow>Section 01</Eyebrow>
            <SectionHeading className="mt-4">Two decisions, eight demonstrations</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                Every transition is a curve and a duration. Apple ships hundreds of transitions on six curves, and one of the six does most of the work — the
                restraint is the technique. Press run and watch them race; the differences are obvious in motion and invisible on paper.
            </p>

            <EasingLab />

            <p className="mt-10 max-w-[62ch] text-sm text-tertiary">
                The three curves worth keeping are now tokens in <code className="font-mono text-xs text-secondary">src/styles/theme.css</code> —{" "}
                <code className="font-mono text-xs text-secondary">ease-enter</code>, <code className="font-mono text-xs text-secondary">ease-state</code> and{" "}
                <code className="font-mono text-xs text-secondary">ease-overshoot</code> — so they are Tailwind utilities anywhere on the site. Durations
                deliberately got no tokens: Tailwind v4 already takes <code className="font-mono text-xs text-secondary">duration-320</code>, and a second
                naming layer would only be one more thing to keep in sync.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 02 · Hover and state                                                */
/* -------------------------------------------------------------------------- */

/**
 * The most-used motion on any site. NO JAVASCRIPT IN THIS SECTION AT ALL — CSS
 * transitions on a hover and a focus state, so the entire demonstration ships
 * as markup.
 */
const states = [
    {
        ms: "100ms · linear",
        klass: "duration-100 ease-linear",
        note: "Our current house rule. Fine on colour. On a card that lifts, it reads as a mechanism rather than an object.",
    },
    {
        ms: "240ms · ease-state",
        klass: "duration-240 ease-state",
        note: "The component tier. Slow enough to be seen, fast enough that a pointer sweeping the grid never queues up behind it.",
    },
    {
        ms: "1000ms · ease-state",
        klass: "duration-1000 ease-state",
        note: "Cinematic timing on a hover. Sweep across all three and this one is still finishing after you have left — the failure mode.",
    },
];

const StateSection = () => (
    <section id="state" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 02</Eyebrow>
            <SectionHeading className="mt-4">Hover, focus, and the 3am rule</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                Ninety percent of a site&rsquo;s motion is this: something under a pointer changing state. Three identical cards on three timings — sweep across
                them left to right, then tab through them. The third one is still moving after you have gone.
            </p>

            <ul className="mt-12 grid gap-6 md:grid-cols-3">
                {states.map((state) => (
                    <li key={state.ms}>
                        <div
                            tabIndex={0}
                            // Focus is not an afterthought: a keyboard user gets
                            // the same state change as a pointer user, on the
                            // same timing.
                            className={`group flex h-40 flex-col justify-between rounded-2xl border border-secondary bg-secondary p-5 transition hover:-translate-y-1.5 hover:border-brand hover:bg-primary focus-visible:-translate-y-1.5 focus-visible:border-brand focus-visible:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${state.klass}`}
                        >
                            <span aria-hidden="true" className="size-2 rotate-45 bg-brand-solid" />
                            <span className="font-mono text-xs text-secondary">{state.ms}</span>
                        </div>
                        <p className="mt-4 text-sm text-tertiary">{state.note}</p>
                    </li>
                ))}
            </ul>

            <p className="mt-10 max-w-[62ch] text-sm text-tertiary">
                These three do not check <code className="font-mono text-xs text-secondary">prefers-reduced-motion</code>, and that is a judgement rather than
                an oversight: a 6px lift under the pointer is not what the setting is for, and stripping every hover from a site makes it feel broken to the
                people who asked for less motion. The setting is aimed at large travel, parallax, and anything that moves without being asked — sections 03
                through 06 on this page, all of which honour it.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 03 · Enter on view                                                  */
/* -------------------------------------------------------------------------- */

const entrances = [
    { ...SHOTS.metapixel, caption: "First", note: "0ms" },
    { ...SHOTS.form, caption: "Second", note: "80ms" },
    { ...SHOTS.popup, caption: "Third", note: "160ms" },
];

const EnterSection = () => (
    <section id="enter" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 03</Eyebrow>
            <SectionHeading className="mt-4">Entrances, 80ms apart</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                /test&rsquo;s three phones, arriving instead of appearing. The stagger is 80ms because every duration on this page is a multiple of 80 — a
                stagger off the scale lands the third item on a beat the first two never used, and the row stops reading as one gesture.
            </p>
        </Container>

        <div className="mt-14 flex snap-x snap-mandatory gap-6 overflow-x-auto px-5 pb-4 lg:justify-center lg:gap-10 lg:overflow-visible lg:px-6">
            {entrances.map((item, index) => (
                // The site's own Reveal, not a new one. It already does
                // once-only fade-up with a delay and drops to a static div under
                // reduced motion — a second copy would have been exactly the
                // mistake this page argues against.
                <Reveal key={item.title} delay={index * 0.08} className="w-[210px] shrink-0 snap-center sm:w-[240px] lg:w-[268px]">
                    <figure className="flex flex-col items-center">
                        <PhoneFrame label={item.title} shot={item.shot} className="w-full" />

                        <figcaption className="mt-6 text-center">
                            <span className="block text-md font-semibold text-primary">{item.caption}</span>
                            <span className="mt-1 block font-mono text-sm text-tertiary">delay {item.note}</span>
                        </figcaption>
                    </figure>
                </Reveal>
            ))}
        </div>

        <Container>
            <p className="mt-12 max-w-[62ch] text-sm text-tertiary">
                One number worth knowing about <code className="font-mono text-xs text-secondary">Reveal</code>: it runs 500ms on{" "}
                <code className="font-mono text-xs text-secondary">cubic-bezier(0.22, 1, 0.36, 1)</code> — a hard deceleration close to Stripe&rsquo;s measured{" "}
                <code className="font-mono text-xs text-secondary">0.25, 1, 0.5, 1</code>, and harder than the{" "}
                <code className="font-mono text-xs text-secondary">0.2</code> Apple uses for entrances. Changing it touches every page that reveals anything, so
                it is a decision to make deliberately rather than a line to slip into a diff.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 04 · Text entrances                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Four effects from `TextFx`, which the project already owns and which CLAUDE.md
 * is explicit about: extend its variants map, never hand-roll split text. This
 * section is here so the choice between them can be made by looking rather than
 * by reading five variant names in a type union.
 */
const textEffects = [
    { effect: "fade-up" as const, line: "Cabins that book themselves", note: "Words rise half a line. The default, and the one that is never wrong." },
    { effect: "mask-rise" as const, line: "Every room, every season", note: "Words rise from behind a clipped edge. Editorial. Wants a big type size." },
    {
        effect: "blur-in" as const,
        line: "Shot on location, always",
        note: "Per character, focus pulling in. Photographic — and the one filter effect that is sanctioned.",
    },
    {
        effect: "scramble" as const,
        line: "Direct bookings, up 40%",
        note: "Characters settle out of noise. Use on a number or a claim, once per page at most.",
    },
];

const TextSection = () => (
    <section id="text" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 04</Eyebrow>
            <SectionHeading className="mt-4">Headlines that arrive</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                Four presets from the project&rsquo;s own <code className="font-mono text-md text-secondary">TextFx</code>, side by side, so the choice can be
                made by eye. Each fires once when it reaches the reading line and renders as plain static text under reduced motion.
            </p>

            <ul className="mt-14 flex flex-col gap-12">
                {textEffects.map((item) => (
                    <li key={item.effect} className="border-t border-secondary pt-8">
                        <span className="font-mono text-xs tracking-[0.08em] text-quaternary uppercase">{item.effect}</span>

                        <h3 className="mt-3 text-display-sm font-semibold text-primary md:text-display-md">
                            <TextFx effect={item.effect}>{item.line}</TextFx>
                        </h3>

                        <p className="mt-4 max-w-[62ch] text-sm text-tertiary">{item.note}</p>
                    </li>
                ))}
            </ul>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 05 · Body copy                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The section that says no. Every paragraph on four homepages plus Apple's most
 * animated product page was checked for a live transition or animation:
 * apple.com 0 of 33, apple.com/iphone-17-pro 1 of 369, stripe.com 4 of 65,
 * linear.app 0 of 30, aman.com 0 of 39. The technique exists on those sites, is
 * applied to headings, and is deliberately withheld from body copy.
 */
const COPY =
    "A cabin does not sell itself on a price list. It sells on the ten seconds someone spends looking at a photograph of the light coming through the trees at four in the afternoon, and on whether the booking button is where their thumb already is.";

const sentences = COPY.split(/(?<=\.)\s+/);
const wordCount = COPY.split(" ").length;

/** Settle time in ms: the last unit's delay plus its own duration. */
const settles = {
    block: 500,
    sentence: (sentences.length - 1) * 120 + 500,
    word: (wordCount - 1) * 70 + 500,
};

const ParagraphSection = () => (
    <section id="copy" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 05</Eyebrow>
            <SectionHeading className="mt-4">Body copy does not animate</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                Not a preference — a count. Across five pages there are 536 paragraphs and five of them carry any motion at all, while 36 of 205 headings on one
                of those pages do. The same companies that animate a headline refuse to animate the sentence under it.
            </p>

            <div className="mt-12">
                <ReplayScope label="Replay all three">
                    <ul className="mt-8 grid gap-10 lg:grid-cols-3 lg:gap-x-8">
                        <li>
                            <span className="font-mono text-xs tracking-[0.08em] text-quaternary uppercase">Block · settles {settles.block}ms</span>
                            {/* The site's own Reveal, used exactly as it is on
                                every other page: one element, one entrance. */}
                            <Reveal className="mt-4">
                                <p className="text-md text-tertiary">{COPY}</p>
                            </Reveal>
                            <p className="mt-4 text-sm text-secondary">Correct. The paragraph is one object and arrives as one.</p>
                        </li>

                        <li>
                            <span className="font-mono text-xs tracking-[0.08em] text-quaternary uppercase">Per sentence · settles {settles.sentence}ms</span>
                            {/* A <div>, NOT A <p>: Reveal renders a motion.div,
                                and a div inside a p is invalid HTML the browser
                                repairs by closing the paragraph early. */}
                            <div className="mt-4 text-md text-tertiary">
                                {sentences.map((sentence, index) => (
                                    // Reveal again, one per sentence, 120ms
                                    // apart. No new component: a stagger is a
                                    // delay, and the project already had both.
                                    <Reveal key={sentence} delay={index * 0.12}>
                                        <span>{sentence} </span>
                                    </Reveal>
                                ))}
                            </div>
                            <p className="mt-4 text-sm text-secondary">Defensible for a two-sentence lede. Past that it reads as buffering.</p>
                        </li>

                        <li>
                            <span className="font-mono text-xs tracking-[0.08em] text-quaternary uppercase">Per word · settles {settles.word}ms</span>
                            <p className="mt-4 text-md text-tertiary">
                                {/* TextFx pointed at body copy — which is the
                                    thing not to do, demonstrated with the real
                                    component rather than described. */}
                                <TextFx effect="fade-up" splitBy="word">
                                    {COPY}
                                </TextFx>
                            </p>
                            <p className="mt-4 text-sm text-secondary">
                                The anti-pattern. {wordCount} words at 70ms is {(settles.word / 1000).toFixed(1)} seconds before the last one exists.
                            </p>
                        </li>
                    </ul>
                </ReplayScope>
            </div>

            <p className="mt-12 max-w-[62ch] text-sm text-tertiary">
                There is a reading-speed argument underneath this. A heading is scanned in one fixation, so a 350ms settle is invisible. A paragraph is read
                left to right at roughly four words a second, and the reader arrives at word six while word six is still fading in. Motion on body copy does not
                decorate the reading — it competes with it, and it loses in a way the visitor experiences as the site being slow.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 06 · Section seams                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Sections do not animate either. Live count of elements carrying a transition
 * or animation — apple.com/iphone-17-pro 0 of 20 sections, linear.app 0 of 8,
 * stripe.com 1 of 15, aman.com 1 of 26. What separates sections is COLOUR, NOT
 * MOTION: Apple runs black, black, black, then #f5f5f7; Aman runs transparent
 * then #e6e2db. A hard cut between two static blocks.
 *
 * THE SOURCE SITE flips a whole token palette for its light island. This
 * project deliberately has no section-inverting mode (the whole app themes at
 * once), so the seam here is the project-native version: `bg-brand-section`
 * with the `*_on-brand` text tokens, which the theme already re-maps for dark
 * mode. Same device, no new machinery.
 */
const SeamSection = () => (
    <section id="seams" className="scroll-mt-20 border-t border-secondary">
        <div className="py-20 md:py-28">
            <Container>
                <Eyebrow>Section 06</Eyebrow>
                <SectionHeading className="mt-4">Sections do not animate either</SectionHeading>
                <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                    Two of 69 sections across four homepages carry any motion. What separates one section from the next is a hard colour cut between static
                    blocks — and half of every card grid inside them moving. Scroll into the brand band below: nothing animated, and the page still changed.
                </p>
            </Container>
        </div>

        {/* A real seam, not a mock of one: `bg-brand-section` is this theme's
            section-contrast surface, and the `*_on-brand` text tokens re-map
            with it in dark mode, so no child needs a mode variant. */}
        <div className="bg-brand-section py-20 md:py-28">
            <Container>
                <p className="font-mono text-xs tracking-[0.14em] text-tertiary_on-brand uppercase">The seam</p>
                <h3 className="mt-3 max-w-[24ch] text-display-sm font-semibold text-primary_on-brand">
                    No transition ran between the last section and this one.
                </h3>
                <p className="mt-5 max-w-[62ch] text-lg text-tertiary_on-brand">
                    The canvas changed at a hard edge, the type flipped to its on-brand tokens with it, and nothing moved. It reads as a chapter break because a
                    cut is what a chapter break is.
                </p>

                <ul className="mt-12 grid gap-6 md:grid-cols-3">
                    {[
                        { n: "0 / 20", what: "Apple product-page sections animated" },
                        { n: "272 / 580", what: "list items on that same page animated" },
                        { n: "0 / 197", what: "Aman list items animated — only its photographs move" },
                    ].map((stat) => (
                        <li key={stat.n} className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/20">
                            <span className="block font-mono text-display-xs font-semibold text-white">{stat.n}</span>
                            <span className="mt-3 block text-sm text-secondary_on-brand">{stat.what}</span>
                        </li>
                    ))}
                </ul>
            </Container>
        </div>

        <div className="py-20 md:py-28">
            <Container>
                <p className="max-w-[62ch] text-sm text-tertiary">
                    And back again, the same way. The budget a section-entrance animation would have spent goes into the card grid instead, which is where every
                    site measured actually spends it — about half of every list, and none of the containers.
                </p>
            </Container>
        </div>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 07 · Pin and scrub                                                  */
/* -------------------------------------------------------------------------- */

const ScrubSection = () => (
    <section id="scrub" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 07</Eyebrow>
            <SectionHeading className="mt-4">Pin and scrub, not fly-in</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                The single most transferable thing on apple.com. The section sticks to the viewport and the frame inside it is driven by scroll{" "}
                <em className="text-secondary not-italic">position</em> — so it runs backwards when you scroll back up, and it stops where you stop. A reveal
                that merely fires on entry can do neither, which is why fast scrollers so often watch one finish on an empty screen.
            </p>
        </Container>

        <PinStage>
            {/* TWO DEVICES, ONE PIN — art direction rather than scaling. The
                laptop is 1723×1005, so at 390px wide it renders 204px tall
                inside an 844px stage: nine tenths of a pinned screen holding
                air. A portrait phone at the same width fills it. */}
            <div className="mx-auto w-[min(62vw,320px)] sm:hidden">
                <PhoneFrame label="Booking" shot={SHOTS.form.shot} />
            </div>

            <div className="hidden sm:block">
                <LaptopFrame label="Website">
                    <DesktopPage />
                </LaptopFrame>
            </div>
        </PinStage>

        <Container>
            <p className="mt-10 max-w-[62ch] text-sm text-tertiary">
                280vh of wrapper is the timeline; the sticky child is what stays on screen while it plays. No scroll listener and no rAF loop —{" "}
                <code className="font-mono text-xs text-secondary">useScroll</code> returns a motion value, so scrolling never re-renders React. With reduced
                motion on, the tall wrapper disappears entirely and the frame renders finished and still: three screens of empty scroll for an effect that is
                not running would be worse than no effect at all.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 08 · The family shot                                                */
/* -------------------------------------------------------------------------- */

const FamilySection = () => (
    <section id="family" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        {/* A SECTION-SCOPED STICKY BAR, so the headline slides under something
            on the way past. Apple's equivalent is a 72px bar at page level that
            every section scrolls beneath — the layering is most of why their
            screenshots read as depth. `backdrop-blur` rather than a solid fill:
            the apple.com homepage carries 95 backdrop-filter declarations, and
            this is what they are for. */}
        <div className="sticky top-0 z-20 mb-10 flex justify-center px-5">
            <div className="flex items-center gap-4 rounded-full border border-secondary bg-primary/70 py-2 pr-2 pl-5 backdrop-blur-md">
                <span className="text-sm font-semibold text-primary">Three phones</span>
                <span className="rounded-full bg-brand-solid px-3 py-1 text-xs font-semibold text-white">Scroll</span>
            </div>
        </div>

        <Container>
            <Eyebrow>Section 08</Eyebrow>
            <SectionHeading className="mt-4">The family shot</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                Rebuilt from apple.com/iphone-17-pro&rsquo;s &ldquo;All in the family&rdquo; block by sampling its transforms as it crossed the viewport, rather
                than from what it looks like. The outer two start 100px further apart, the middle one starts 40% oversized, all three start 200px low — and it
                is finished while the row is still a third of the way down the screen. One departure from the original: ours resolves to three phones the same
                size.
            </p>
        </Container>

        <FamilyStage
            left={<PhoneFrame label={SHOTS.metapixel.title} shot={SHOTS.metapixel.shot} />}
            middle={<PhoneFrame label={SHOTS.form.title} shot={SHOTS.form.shot} />}
            right={<PhoneFrame label={SHOTS.popup.title} shot={SHOTS.popup.shot} />}
        />

        <Container>
            <p className="mt-16 max-w-[62ch] text-sm text-tertiary">
                Two things the screenshots of it lie about. The outer phones look tilted in 3D — they are not: every transform measured was a plain 2D matrix
                with zero rotation, and the angle is baked into two separately art-directed photographs. And the section looks pinned — it is not: it has zero
                sticky elements, and the depth comes from a page-level bar it scrolls under.
            </p>
            <p className="mt-5 max-w-[62ch] text-sm text-tertiary">
                Which makes this the cheapest scroll effect on the page. No tall wrapper, no pin, no extra viewport heights — the section is its natural height
                and the motion happens on the way past. Sections 07 and 09 cost 580vh between them to do less.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 09 · Scrubbed film                                                  */
/* -------------------------------------------------------------------------- */

const FilmSection = () => (
    <section id="film" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 09</Eyebrow>
            <SectionHeading className="mt-4">Film the visitor scrubs</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                What an Apple product page is actually made of: the footage is not playing. Its{" "}
                <code className="font-mono text-md text-secondary">currentTime</code> is written from scroll position, so the visitor is dragging a playhead
                with their thumb. There are 19 separate writes to <code className="font-mono text-md text-secondary">.currentTime</code> on
                apple.com/macbook-pro.
            </p>
        </Container>

        <ScrubStage>
            <PhoneFrame label="Leaf shadows">
                {/* THE REPO'S ONE COMMITTED CLIP, unmodified — the sign-in
                    backdrop's leaf-shadow loop. No `autoPlay`, no `loop`, no
                    `controls`, because nothing here ever plays. `preload="auto"`
                    is right for once: a scrub needs the whole file, not the
                    first frame, and this section is 300vh of warning that it is
                    coming. The file is encoded for playback (sparse keyframes),
                    so it will stutter — which is the lesson, demonstrated. */}
                <video
                    src="/hgm video/Tree-Leaves-Shadow-Overlay-02-4k-Video-Loop.webm"
                    poster="/hgm video/leaf-shadow-poster.webp"
                    muted
                    playsInline
                    preload="auto"
                    className="size-full object-cover"
                />
            </PhoneFrame>
        </ScrubStage>

        <Container>
            <p className="mt-10 max-w-[62ch] text-sm text-tertiary">
                It will stutter, and that is the lesson rather than a bug. Seeking is not playing: every seek decodes forward from the nearest keyframe, and a
                file authored for playback carries one every few seconds. Apple&rsquo;s scrubbed clips are encoded with keyframes on nearly every frame, which
                is why theirs are enormous and this one is half a megabyte. Budget the encode, or do not promise the technique.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 10 · Horizontal galleries                                           */
/* -------------------------------------------------------------------------- */

const galleryItems = [
    { label: SHOTS.metapixel.title, shot: SHOTS.metapixel.shot, note: "Client-facing setup guide, captured at 390×844" },
    { label: SHOTS.form.title, shot: SHOTS.form.shot, note: "The intake form hosts fill before a shoot" },
    { label: SHOTS.popup.title, shot: SHOTS.popup.shot, note: "Website popup setup, same capture rig" },
    { label: "Owner guide", shot: undefined, note: "Nine steps, per-client copies, capture owed" },
    { label: "Client dashboard", shot: undefined, note: "The big one. Capture owed" },
];

const GallerySection = () => (
    <section id="gallery" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 10</Eyebrow>
            <SectionHeading className="mt-4">The one thing every Pro page has</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                apple.com/macbook-pro and apple.com/ipad-pro each carry exactly three horizontal galleries, overflowing their container by between 1.9x and
                5.4x. Both pages are 34 screens tall and have almost nothing else moving — 56 scroll-linked elements on one, 9 on the other. This is where the
                length goes.
            </p>
        </Container>

        <div className="mt-12">
            <SnapGallery label="Six pages, one row — drag it, wheel it, tab into it and use the arrow keys">
                {galleryItems.map((item) => (
                    // Wide enough to actually overflow: six at 300px overflow
                    // 1440 by 1.37x, and the ratio climbs on its own as the
                    // screen narrows.
                    <figure key={item.label} className="w-[240px] shrink-0 snap-center sm:w-[300px]">
                        <PhoneFrame label={item.label} shot={item.shot} className="w-full" />
                        <figcaption className="mt-5">
                            <span className="block text-md font-semibold text-primary">{item.label}</span>
                            <span className="mt-1 block text-sm text-tertiary">{item.note}</span>
                        </figcaption>
                    </figure>
                ))}
            </SnapGallery>
        </div>

        <Container>
            <p className="mt-14 max-w-[62ch] text-sm text-tertiary">
                Measured on their container: <code className="font-mono text-xs text-secondary">overflow-x: scroll</code> and{" "}
                <code className="font-mono text-xs text-secondary">scroll-snap-type: x mandatory</code>. No rAF, no library, no hijacking of the vertical scroll
                — the browser does the physics and the OS does the momentum. The only JavaScript above is the paddle buttons and knowing when to disable them,
                because that is the part the platform does not give you.
            </p>
            <p className="mt-5 max-w-[62ch] text-sm text-tertiary">
                The accessibility half matters more than the motion. A bare overflow container cannot be reached by keyboard at all; adding{" "}
                <code className="font-mono text-xs text-secondary">tabIndex</code> and a label makes the arrow keys work with no handler of ours. The phone row
                in section 03 already snaps — what it never offered is a way to move it without a gesture.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 11 · Stacked cards                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The largest scroll-linked group on apple.com/macbook-pro is its cards — and
 * it is CSS, not motion. Each card is `position: sticky` with a `top` that
 * steps down by one card-header's height. No scroll listener, no progress
 * value, and nothing for reduced motion to switch off: this is layout, not
 * animation.
 */
const stackCards = [
    { n: "01", title: "Shoot", body: "Two days on location. Reels, stills, and the drone plate we use for the hero." },
    { n: "02", title: "Cut", body: "Nine verticals from the same shoot, each one built for where it lands." },
    { n: "03", title: "Publish", body: "Scheduled against the booking calendar, not against a content calendar." },
    { n: "04", title: "Measure", body: "Direct bookings attributed back to the reel that earned them." },
];

const StackSection = () => (
    <section id="stack" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 11</Eyebrow>
            <SectionHeading className="mt-4">Cards that stack, with no JavaScript</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                The biggest scroll-linked group on the MacBook Pro page is its cards — 16 of the 56 elements that move at all. They are not animated: each is{" "}
                <code className="font-mono text-md text-secondary">position: sticky</code> at a <code className="font-mono text-md text-secondary">top</code>{" "}
                one step lower than the last, so each parks and the next slides over it.
            </p>

            {/* The step is 4.5rem per card — the height of the header strip left
                visible on the one underneath. On a browser that ignores sticky
                this degrades to a plain list of cards that still reads in order. */}
            <ul className="mt-14">
                {stackCards.map((card, index) => (
                    <li
                        key={card.n}
                        className="sticky"
                        style={{ top: `calc(4rem + ${index * 4.5}rem)`, marginBottom: index === stackCards.length - 1 ? 0 : "1.5rem" }}
                    >
                        <div className="rounded-3xl border border-secondary bg-secondary p-8 md:p-10">
                            <div className="flex items-baseline gap-4">
                                <span className="font-mono text-sm text-brand-secondary">{card.n}</span>
                                <h3 className="text-display-xs font-semibold text-primary">{card.title}</h3>
                            </div>
                            <p className="mt-4 max-w-[52ch] text-md text-tertiary">{card.body}</p>
                        </div>
                    </li>
                ))}
            </ul>

            <p className="mt-16 max-w-[62ch] text-sm text-tertiary">
                Best value on this page. Section 07 spends 280vh of scroll and section 09 spends 300vh; this spends nothing beyond the height of its own content
                and ships no JavaScript at all. When a technique can be layout instead of motion, it should be.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 12 · Parallax                                                       */
/* -------------------------------------------------------------------------- */

const ParallaxSection = () => (
    <section id="parallax" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 12</Eyebrow>
            <SectionHeading className="mt-4">Depth from two different rates</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                The one technique here that is not measured off anyone, and worth saying so plainly: no parallax was found on any Apple page surveyed. Their
                depth comes from art direction and Aman&rsquo;s from photography. It is here because a lodge frame has real foreground and real distance in it.
            </p>

            <div className="mt-14">
                <ParallaxLayers
                    back={
                        <span aria-hidden="true" className="text-[7rem] leading-none font-semibold text-quaternary/25 sm:text-[11rem]">
                            HIDDEN
                        </span>
                    }
                    middle={
                        <div className="w-[190px] sm:w-[230px]">
                            <PhoneFrame label={SHOTS.metapixel.title} shot={SHOTS.metapixel.shot} />
                        </div>
                    }
                    front={
                        <div>
                            <span className="font-mono text-xs tracking-[0.14em] text-quaternary uppercase">Front layer · 0px</span>
                            <p className="mt-2 max-w-[36ch] text-md text-secondary">Back moves 80px, middle 40px, front nothing. A 2:1:0 ratio.</p>
                        </div>
                    }
                />
            </div>

            <p className="mt-10 max-w-[62ch] text-sm text-tertiary">
                The rates are the whole design. Past about 100px on the back layer it stops reading as depth and starts reading as a misaligned page — the eye
                knows how far a distant object should shift when you move your head, and it is not far. Everything moves on{" "}
                <code className="font-mono text-xs text-secondary">transform</code> only, so the layers composite rather than relayout, and reduced motion
                renders them flat and stacked.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 13 · Counters                                                       */
/* -------------------------------------------------------------------------- */

const stats: { to: number; prefix?: string; suffix?: string; label: string; note: string }[] = [
    { to: 41, suffix: "%", label: "More direct bookings", note: "Twelve months, one property, against the previous year." },
    { to: 9, label: "Verticals per shoot", note: "One two-day shoot, nine cuts, each sized for where it lands." },
    { to: 24, prefix: "0:", label: "Seconds per reel", note: "The length that still gets watched to the end." },
];

const CounterSection = () => (
    <section id="counters" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 13</Eyebrow>
            <SectionHeading className="mt-4">Numbers that settle</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                The one place a 1000ms duration is allowed on a triggered animation — and it breaks this page&rsquo;s own rule on purpose. A counter is not a
                transition between two states; it is the reading of a quantity, and the eye needs time to watch the digits move or the number just arrives late.
            </p>

            <ul className="mt-14 grid gap-10 sm:grid-cols-3">
                {stats.map((stat) => (
                    <li key={stat.label}>
                        <span className="block text-display-lg font-semibold text-brand-secondary">
                            <Counter to={stat.to} prefix={stat.prefix} suffix={stat.suffix} />
                        </span>
                        <span className="mt-3 block text-md font-semibold text-primary">{stat.label}</span>
                        <span className="mt-1 block text-sm text-tertiary">{stat.note}</span>
                    </li>
                ))}
            </ul>

            <p className="mt-12 max-w-[62ch] text-sm text-tertiary">
                Under 600ms it reads as a glitch rather than a count. It fires once — a statistic that re-counts every time it crosses the viewport turns a
                claim into a slot machine. And the digits are <code className="font-mono text-xs text-secondary">tabular-nums</code>, without which a settling
                number visibly jitters its own container as the glyph widths change. Reduced motion prints the value, which was the content all along.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 14 · View transitions                                               */
/* -------------------------------------------------------------------------- */

const assetGroups = [
    { name: "Guides", items: ["Meta Pixel setup — 12 steps", "Popup setup — 8 steps", "Owner guide — 9 steps"] },
    { name: "Forms", items: ["Brand Vision Form", "Client onboarding", "Host onboarding"] },
    { name: "Email", items: ["Booking confirmation", "Pre-arrival guide", "Post-stay thank you"] },
];

const TransitionSection = () => (
    <section id="transitions" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 14</Eyebrow>
            <SectionHeading className="mt-4">Animating across a DOM change</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                The only technique on this page that Linear uses and Apple does not: linear.app carries five{" "}
                <code className="font-mono text-md text-secondary">view-transition</code> references, against zero on all three Apple pages measured. Every
                other transition here animates an element that stays put. This one animates between two different sets of elements.
            </p>

            <div className="mt-12">
                <ViewTransitionTabs groups={assetGroups} />
            </div>

            <p className="mt-12 max-w-[62ch] text-sm text-tertiary">
                The browser snapshots the old state, applies the new one, and crossfades — so nothing has to stay mounted and no library has to diff anything.
                It is feature-detected rather than polyfilled: where <code className="font-mono text-xs text-secondary">startViewTransition</code> is missing
                the list still changes, instantly and without an error. That is the correct failure for a progressive enhancement, and it is why this is three
                lines instead of a dependency.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 15 · Loading                                                        */
/* -------------------------------------------------------------------------- */

const LoadingSection = () => (
    <section id="loading" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 15</Eyebrow>
            <SectionHeading className="mt-4">Waiting well</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                The motion nobody puts in a brief, and the only one on this page with a measurable job: making a wait feel shorter than it is. Skeletons hold
                the shape of what is coming, so when the content lands nothing jumps — the layout was already right and only the pixels changed.
            </p>

            <div className="mt-12">
                <SkeletonDemo />
            </div>

            <p className="mt-12 max-w-[62ch] text-sm text-tertiary">
                The sweep is 1.6s and <em className="text-secondary not-italic">linear</em>, which is the one place on this site a mechanical feel is correct:
                eased motion reads as an object sliding past, and a skeleton is the opposite of an object. Faster than about 1.2s and it reads as urgency —
                exactly the wrong feeling to hand someone who is already waiting. A spinner cannot reserve the layout, which is the whole argument against one.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 16 · Overshoot                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The curve section 01 tokenised and then warned about, finally used correctly —
 * and with no JavaScript at all. A checkbox drives it: `sr-only` on the input,
 * so the real control is still the thing a screen reader and a keyboard get.
 */
const toggles = [
    {
        id: "t-1",
        label: "Publish to Instagram",
        curve: "ease-overshoot",
        klass: "ease-overshoot",
        note: "Correct. A 20px knob overshooting 4px reads as physical.",
    },
    { id: "t-2", label: "Publish to TikTok", curve: "ease-state", klass: "ease-state", note: "Also fine, and duller. This is the safe default." },
];

const OvershootSection = () => (
    <section id="overshoot" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 16</Eyebrow>
            <SectionHeading className="mt-4">Overshoot, used correctly</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                Section 01 tokenised <code className="font-mono text-md text-secondary">ease-overshoot</code> and then warned about it — Apple used that curve
                seven times on a page with hundreds of transitions, all on small elements. Here is the size of element it is for. Flip both and the difference
                is a few pixels of travel past the target.
            </p>

            <ul className="mt-12 flex flex-col gap-6">
                {toggles.map((toggle) => (
                    <li key={toggle.id} className="flex flex-wrap items-center gap-x-6 gap-y-3">
                        {/* A real checkbox, visually hidden: keyboard, screen
                            reader and form semantics come free because the
                            control is an input rather than a div pretending.
                            `group-has-[:checked]:` rather than `peer-checked:`,
                            because Tailwind's `peer-*` compiles to a sibling
                            selector that cannot reach the knob nested inside
                            the track. */}
                        <label htmlFor={toggle.id} className="group flex cursor-pointer items-center gap-4">
                            <input id={toggle.id} type="checkbox" className="peer sr-only" />
                            <span className="flex h-7 w-12 shrink-0 items-center rounded-full bg-quaternary p-1 transition-colors duration-240 group-has-[:checked]:bg-brand-solid peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-ring">
                                <span
                                    className={`size-5 rounded-full bg-primary transition-transform duration-240 group-has-[:checked]:translate-x-5 ${toggle.klass}`}
                                />
                            </span>
                            <span className="text-md text-primary">{toggle.label}</span>
                        </label>
                        <span className="font-mono text-xs text-quaternary">{toggle.curve}</span>
                        <span className="w-full text-sm text-tertiary sm:w-auto">{toggle.note}</span>
                    </li>
                ))}
            </ul>

            <p className="mt-12 max-w-[62ch] text-sm text-tertiary">
                The rule is about absolute distance, not proportion. A 20px knob overshooting by 4px looks like a switch with a spring in it; a 400px card
                overshooting by the same 20% travels 80px past where it belongs and looks like a bug. That is the entire content of &ldquo;small elements
                only&rdquo;, and it is why the token exists but is used twice on this whole page.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 17 · Disclosure                                                     */
/* -------------------------------------------------------------------------- */

const faqs = [
    { q: "How long is a shoot?", a: "Two days on location for a full set — nine verticals, a stills library, and the drone plate for the hero." },
    { q: "Who owns the footage?", a: "You do, outright, including the raw files. We keep a licence to show the work in a portfolio and nothing else." },
    {
        q: "What if the weather turns?",
        a: "The schedule carries a reserve day. Blue hour and rain both shoot well; flat grey light is the only thing we move for.",
    },
];

const DisclosureSection = () => (
    <section id="disclosure" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 17</Eyebrow>
            <SectionHeading className="mt-4">Animating to a height nobody knows</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                <code className="font-mono text-md text-secondary">height: auto</code> is not animatable — the browser cannot interpolate towards a number it
                will only compute at the end, so a naive transition on an open panel does precisely nothing. The fix is a grid row going from{" "}
                <code className="font-mono text-md text-secondary">0fr</code> to <code className="font-mono text-md text-secondary">1fr</code>, which can.
            </p>

            <div className="mt-12 max-w-[62ch]">
                {faqs.map((faq) => (
                    <Disclosure key={faq.q} summary={faq.q}>
                        {faq.a}
                    </Disclosure>
                ))}
            </div>

            <p className="mt-12 max-w-[62ch] text-sm text-tertiary">
                This page already uses the trick: the contents rail on the left collapses its groups exactly this way. Native{" "}
                <code className="font-mono text-xs text-secondary">details</code>/<code className="font-mono text-xs text-secondary">summary</code> is the
                better answer whenever the animation is not worth a component. The panel here is <code className="font-mono text-xs text-secondary">inert</code>{" "}
                while closed rather than <code className="font-mono text-xs text-secondary">hidden</code>, because{" "}
                <code className="font-mono text-xs text-secondary">hidden</code> cannot transition and leaving it plain puts invisible links in the tab order.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 18 · Marquee                                                        */
/* -------------------------------------------------------------------------- */

const clientNames = ["Cedar & Ash", "Riverbend Cabins", "The Barrel House", "Northlight Lodge", "Fernhollow", "Stonewater Retreat"];

const MarqueeSection = () => (
    <section id="marquee" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 18</Eyebrow>
            <SectionHeading className="mt-4">The only loop that never stops</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                Every other animation on this page has an end. A marquee does not, which makes it the one that has to justify itself hardest — and the reason it
                earns a place is that a client list reads as longer when it moves than when it sits still.
            </p>
        </Container>

        {/* NOT A NEW COMPONENT: `animate-marquee` is already a theme token in
            theme.css at 60s linear. The track is duplicated and the copy is
            aria-hidden — the animation translates one full track width and
            restarts; without a second copy the row would visibly empty before
            it looped. The mask is an alpha gradient: the #000 in it is an
            opacity value, not a colour. */}
        <div className="mt-12 flex overflow-hidden border-y border-secondary [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)] py-6">
            {[false, true].map((isDuplicate) => (
                <ul
                    key={String(isDuplicate)}
                    aria-hidden={isDuplicate || undefined}
                    className="flex shrink-0 animate-marquee items-center gap-16 pr-16 motion-reduce:animate-none"
                >
                    {clientNames.map((name) => (
                        <li key={name} className="flex items-center gap-16 text-sm font-semibold tracking-[0.16em] whitespace-nowrap text-quaternary uppercase">
                            {name}
                            <span aria-hidden="true" className="size-1 shrink-0 rotate-45 bg-brand-solid/40" />
                        </li>
                    ))}
                </ul>
            ))}
        </div>

        <Container>
            <p className="mt-12 max-w-[62ch] text-sm text-tertiary">
                60 seconds for one pass, which is slow enough to read a name at a glance and far too slow to feel like it is demanding attention. It is{" "}
                <em className="text-secondary not-italic">linear</em> for the same reason the skeleton in section 15 is: an eased loop has a visible seam where
                it restarts. And <code className="font-mono text-xs text-secondary">motion-reduce:animate-none</code> leaves a static row of names, which is a
                complete client list either way.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 19 · Overlays                                                       */
/* -------------------------------------------------------------------------- */

const OverlaySection = () => (
    <section id="overlay" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 19</Eyebrow>
            <SectionHeading className="mt-4">The element that does the hard part for you</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                A modal&rsquo;s animation is the least of it. Open this one and the browser puts it in the top layer above everything regardless of z-index,
                paints a backdrop, moves focus in, traps it there, binds Escape, and marks the rest of the page inert — all from{" "}
                <code className="font-mono text-md text-secondary">showModal()</code>.
            </p>

            <div className="mt-12">
                <NativeDialog label="Open the booking dialog">
                    <h3 className="text-display-xs font-semibold text-primary">Two days, nine cuts</h3>
                    <p className="mt-4 text-md text-tertiary">
                        Tab around. Focus cannot leave this dialog, Escape closes it, and when it closes the button that opened it is focused again.
                    </p>
                </NativeDialog>
            </div>

            <p className="mt-12 max-w-[62ch] text-sm text-tertiary">
                Every one of those behaviours is something hand-rolled modals routinely get wrong, which is why this component is thirty lines rather than three
                hundred. The one thing it does not do reliably is <em className="text-secondary not-italic">return</em> focus, so the opener is remembered and
                refocused on close — without that a keyboard user is dropped at the top of the document on every dismissal.
            </p>
            <p className="mt-5 max-w-[62ch] text-sm text-tertiary">
                The entrance needs two newer CSS features, because a dialog goes from <code className="font-mono text-xs text-secondary">display: none</code>{" "}
                straight into the top layer and <code className="font-mono text-xs text-secondary">display</code> is not animatable:{" "}
                <code className="font-mono text-xs text-secondary">@starting-style</code> declares the state to animate from, and{" "}
                <code className="font-mono text-xs text-secondary">allow-discrete</code> holds <code className="font-mono text-xs text-secondary">display</code>{" "}
                and <code className="font-mono text-xs text-secondary">overlay</code> across it. Where either is missing the dialog still opens correctly with
                no animation.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 20 · Images arriving                                                */
/* -------------------------------------------------------------------------- */

const posters = [
    { src: SHOTS.metapixel.img, alt: "Meta Pixel guide, captured at 390×844" },
    { src: SHOTS.form.img, alt: "Brand Vision Form, same capture rig" },
    { src: SHOTS.popup.img, alt: "Popup guide, same capture rig" },
];

const ImageSection = () => (
    <section id="images" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 20</Eyebrow>
            <SectionHeading className="mt-4">A photograph arriving</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                The transition a media company should care about more than any pinned laptop. Three real captures, each clearing its blur on its own{" "}
                <code className="font-mono text-md text-secondary">load</code> event rather than on a timer — a fixed delay either uncovers an image that has
                not arrived or holds a blur over one that has.
            </p>

            <ul className="mt-14 grid gap-6 sm:grid-cols-3">
                {posters.map((poster) => (
                    <li key={poster.src}>
                        <BlurUp src={poster.src} alt={poster.alt} />
                    </li>
                ))}
            </ul>

            <p className="mt-12 max-w-[62ch] text-sm text-tertiary">
                On a fast connection the second failure is the one that happens, and it makes a quick site feel slow. There is a subtler bug in the same shape:
                an image already in cache can finish loading before React attaches the handler, so{" "}
                <code className="font-mono text-xs text-secondary">onLoad</code> never fires and the blur never clears — checking{" "}
                <code className="font-mono text-xs text-secondary">complete</code> on mount is what covers it.
            </p>
            <p className="mt-5 max-w-[62ch] text-sm text-tertiary">
                One honest caveat: the placeholder here is the same file blurred, which is fine for a demonstration and wrong for production. The real version
                ships a tiny base64 preview (an LQIP) so the placeholder costs almost nothing — worth remembering in this project especially, where client
                uploads already travel as base64 through <code className="font-mono text-xs text-secondary">compressImageFile()</code>.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 21 · What the wrong property costs                                  */
/* -------------------------------------------------------------------------- */

const PerfSection = () => (
    <section id="perf" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 21</Eyebrow>
            <SectionHeading className="mt-4">What the wrong property costs</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                Every rule on this page says animate <code className="font-mono text-md text-secondary">transform</code> and{" "}
                <code className="font-mono text-md text-secondary">opacity</code>. This section measures why, on your machine, right now: 600 boxes moved both
                ways for two seconds each, reported as a median and a worst frame.
            </p>

            <div className="mt-12">
                <FrameBench />
            </div>

            <p className="mt-12 max-w-[62ch] text-sm text-tertiary">
                <code className="font-mono text-xs text-secondary">left</code> is a layout property: changing it forces the browser to recompute geometry,
                repaint and composite every frame, on the main thread. <code className="font-mono text-xs text-secondary">transform</code> is a compositor
                property — the layer already exists and only its matrix changes, so the work can leave the main thread entirely. The markup in both runs is
                identical; one line differs.
            </p>
            <p className="mt-5 max-w-[62ch] text-sm text-tertiary">
                Run each twice before believing either number. Measured on a 120Hz Mac the two came out within half a millisecond, and the order flipped between
                runs — whichever property was measured first was the slower one. That is warm-up cost, not a result, and reporting it as one would have been the
                easiest way to make this page dishonest.
            </p>
            <p className="mt-5 max-w-[62ch] text-sm text-tertiary">
                Which is the more useful lesson: on fast hardware this rule is unfalsifiable. The cost is invisible on the machine a designer owns and obvious
                on the phone a guest is holding in a cabin with one bar of signal. Throttle the CPU 6x in DevTools and the gap appears — and that phone is the
                device every number on this page is ultimately for.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 22 · Shared elements                                                */
/* -------------------------------------------------------------------------- */

const shots = [
    { id: "metapixel", src: SHOTS.metapixel.img, title: SHOTS.metapixel.title, note: "The client-facing setup guide. Captured at 390×844 off the live route." },
    { id: "form", src: SHOTS.form.img, title: SHOTS.form.title, note: "The intake form hosts fill before a shoot. Same capture rig." },
    { id: "popup", src: SHOTS.popup.img, title: SHOTS.popup.title, note: "Website popup setup. Same capture rig, same viewport." },
];

const SharedSection = () => (
    <section id="shared" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 22</Eyebrow>
            <SectionHeading className="mt-4">Animating a layout change without animating layout</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                Section 21 says never animate a layout property. Which leaves an obvious objection: what if the thing that changes{" "}
                <em className="text-secondary not-italic">is</em> the layout? A thumbnail becoming a full-width panel changes width, height and position at
                once. Open one of these.
            </p>

            <div className="mt-12">
                <SharedElementGrid items={shots} />
            </div>

            <p className="mt-12 max-w-[62ch] text-sm text-tertiary">
                The technique is FLIP, and it is thirty years old: measure the box <em className="text-secondary not-italic">first</em>, apply the change so the
                browser computes the <em className="text-secondary not-italic">last</em> box, then <em className="text-secondary not-italic">invert</em> — apply
                a transform that makes the element look like it never moved — and <em className="text-secondary not-italic">play</em> that transform away. The
                layout change happens in a single frame. Every frame after it is a transform, which is exactly what section 21 asks for.
            </p>
            <p className="mt-5 max-w-[62ch] text-sm text-tertiary">
                <code className="font-mono text-xs text-secondary">layoutId</code> is motion&rsquo;s implementation of it, which is why this is twenty lines:
                two elements sharing an id are treated as one object in two places. That is a different job from section 14&rsquo;s View Transitions, and the
                distinction is worth keeping — View Transitions crossfade a snapshot <em className="text-secondary not-italic">across</em> a DOM change, where
                the old element is gone. FLIP keeps one element mounted and moves it. Replacement versus travel.
            </p>
            <p className="mt-5 max-w-[62ch] text-sm text-tertiary">
                It expands in place rather than opening over the page, deliberately. An overlay would need everything section 19&rsquo;s native{" "}
                <code className="font-mono text-xs text-secondary">&lt;dialog&gt;</code> gives away for free — top layer, focus trap, Escape, inert background —
                and hand-rolling those is precisely how modals go wrong. As a disclosure,{" "}
                <code className="font-mono text-xs text-secondary">aria-expanded</code> on a real button is the whole story.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 23 · The deck that comes apart                                      */
/* -------------------------------------------------------------------------- */

const scatterPosters = [SHOTS.metapixel.img, SHOTS.form.img, SHOTS.popup.img];

const ScatterSection = () => (
    <section id="scatter" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 23</Eyebrow>
            <SectionHeading className="mt-4">The deck that comes apart</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                Rebuilt from a Framer template — &ldquo;Tedy Scroll Animation&rdquo; by Framer University — by measuring it rather than watching it. Eight tiles
                start stacked exactly on top of one another in the centre of the frame, then fan out and shrink as you scroll, uncovering the line underneath.
            </p>
        </Container>

        <ScatterStage
            posters={scatterPosters}
            headline={
                <>
                    <span className="block text-display-md font-semibold text-primary md:text-display-lg">Nine cuts. One shoot.</span>
                    <span className="mt-4 block text-lg text-tertiary">Everything a lodge needs for a season, filmed in two days.</span>
                </>
            }
        />

        <Container>
            <p className="mt-14 max-w-[62ch] text-sm text-tertiary">
                The trick is that there is no arrangement to begin with. All eight tiles are the same square with the same radius, sitting at{" "}
                <code className="font-mono text-xs text-secondary">transform: none</code> on the same centre point — the opening frame is one card with seven
                hidden behind it. What reads as a composition assembling is a single pile coming apart.
            </p>
            <p className="mt-5 max-w-[62ch] text-sm text-tertiary">
                And every value is <strong className="font-semibold text-secondary">linear</strong>. Sampled every 190px of scroll, the largest tile ran 1.000,
                0.985, 0.890, 0.795, 0.700, 0.606, 0.510 — a straight line to three decimals, with its horizontal travel on the same ramp. That is right rather
                than lazy: in a scrub the visitor&rsquo;s own scroll is the easing curve, and a second curve on top makes the tiles feel like they are resisting
                the finger. Compare section 08, where Apple <em className="text-secondary not-italic">does</em> ease a scrub — because there the motion runs
                past on its own rather than tracking a thumb.
            </p>
            <p className="mt-5 max-w-[62ch] text-sm text-tertiary">
                The headline is the only thing off that ramp: it holds at nothing until roughly 72% through the pin, then arrives over the last quarter, so the
                deck has nearly finished clearing before the words appear. Two things wanting attention in the same moment is the usual way this effect is got
                wrong.
            </p>
            <p className="mt-5 max-w-[62ch] text-sm text-tertiary">
                One honest gap: the original has eight distinct photographs and we have three page captures, cycled. A real build wants eight — the repetition
                is visible once you look for it, and no amount of motion hides a thin asset library.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 24 · Staggered columns                                              */
/* -------------------------------------------------------------------------- */

/**
 * Rebuilt from a second Framer template ("Decora") after measuring what its
 * stats row actually does. Every column is `position: sticky` at the SAME
 * `top`; the only difference is the height of the box each one sits in. The row
 * is bottom-aligned, so a taller box starts higher up the page and its sticky
 * child reaches the line at a different moment. The stagger is a column of
 * numbers in the markup — no JavaScript, no scroll listener, no progress value.
 */
const columnStats = [
    { value: "150", label: "Reels delivered" },
    { value: "9", label: "Cuts per shoot" },
    { value: "4.9", label: "Client rating" },
    { value: "41%", label: "More direct bookings" },
    { value: "+10", label: "Lodges on the roster" },
];

const ColumnSection = () => (
    <section id="columns" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 24</Eyebrow>
            <SectionHeading className="mt-4">A stagger made of box heights</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                Five columns that seem to move at five different rates as you scroll past. They do not move at all: each is{" "}
                <code className="font-mono text-md text-secondary">position: sticky</code> at the same{" "}
                <code className="font-mono text-md text-secondary">top</code>, and the only thing that differs is the height of the box around it.
            </p>
        </Container>

        {/* `items-end` is what turns a height difference into a time
            difference. Below md the stagger is dropped and the stats become a
            plain two-column grid: the effect needs five columns side by side to
            read as a diagonal. */}
        <Container>
            <div className="mt-14 hidden items-end border-t border-secondary md:flex">
                {columnStats.map((stat, index) => (
                    <div key={stat.label} style={{ height: `${10 + index * 9.5}rem` }} className="flex-1 border-r border-secondary first:border-l">
                        <div className="sticky top-[30vh] px-5 py-6">
                            <span className="block text-sm text-tertiary">{stat.label}</span>
                            <span className="mt-3 block text-display-sm font-semibold text-primary tabular-nums lg:text-display-md">{stat.value}</span>
                        </div>
                    </div>
                ))}
            </div>

            <ul className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-secondary bg-border-secondary md:hidden">
                {columnStats.map((stat) => (
                    <li key={stat.label} className="bg-primary px-5 py-6">
                        <span className="block text-sm text-tertiary">{stat.label}</span>
                        <span className="mt-2 block text-display-xs font-semibold text-primary tabular-nums">{stat.value}</span>
                    </li>
                ))}
            </ul>

            <p className="mt-14 max-w-[62ch] text-sm text-tertiary">
                Measured on the original: box heights of 153, 305, 458, 610 and 763px — an arithmetic series stepping by 152.5px — with every column sticky at{" "}
                <code className="font-mono text-xs text-secondary">top: 300px</code>. At one scroll position their tops read 983, 836, 683, 531 and 378: a
                straight line with a 151px step, which is the box step rather than any motion curve.
            </p>
            <p className="mt-5 max-w-[62ch] text-sm text-tertiary">
                Which makes the step the entire design. Too small and the five arrive together and it reads as nothing; too large and the last column is still
                waiting after the first has gone. There is nothing here for reduced motion to disable, because nothing is animating — the columns are held in
                place by layout, the same way section 11&rsquo;s cards are.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 25 · The spiral                                                     */
/* -------------------------------------------------------------------------- */

const SpiralSection = () => (
    <section id="spiral" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 25</Eyebrow>
            <SectionHeading className="mt-4">One thing turning, not ten things moving</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                Rebuilt from a third Framer template — &ldquo;Spiral 3D Scroll Animation&rdquo; — and the measurement collapses it to almost nothing. A single
                column carries the entire effect: its <code className="font-mono text-md text-secondary">rotateY</code> sweeps 163 degrees while it rises. Every
                card inside is static.
            </p>
        </Container>

        <SpiralStage posters={scatterPosters} />

        <Container>
            <p className="mt-14 max-w-[62ch] text-sm text-tertiary">
                The measured geometry is the whole thing. The axis is 865&times;755 with <code className="font-mono text-xs text-secondary">preserve-3d</code>,
                carrying five arms of 865&times;151 stacked at top 0, 151, 302, 453 and 604 — a 151px step — rotated 0, 45, 90, 135 and 180 degrees. Each arm
                holds one 320&times;215 card at <code className="font-mono text-xs text-secondary">left: -161</code>, itself turned 90 degrees.
            </p>
            <p className="mt-5 max-w-[62ch] text-sm text-tertiary">
                The arm is a <em className="text-secondary not-italic">radius</em>, not a row. Its origin is its centre, so a card at &minus;161 sits about
                433px out — one arm&rsquo;s reach. Rotating the arm swings the card around the axis; stacking the arms 151px apart and turning each an extra 45
                degrees is what makes a helix instead of a carousel. The card&rsquo;s own 90 degrees faces it outward along that radius, so its world angle is
                the arm&rsquo;s plus 90. They meet the viewer one after another with no per-card timing anywhere.
            </p>
            <p className="mt-5 max-w-[62ch] text-sm text-tertiary">
                Only the axis animates — <code className="font-mono text-xs text-secondary">rotateY</code> measured at &minus;77, &minus;48, &minus;4, +41 and
                +86 degrees across the pin while it translated from +310px to &minus;343px. Every arm and card angle is static.
            </p>
            <p className="mt-5 max-w-[62ch] text-sm text-tertiary">
                <strong className="font-semibold text-secondary">A correction worth keeping.</strong> The first build of this section claimed the template used
                no perspective, and built an argument on it. That was wrong:{" "}
                <code className="font-mono text-xs text-secondary">getComputedStyle().perspective</code> reads{" "}
                <code className="font-mono text-xs text-secondary">none</code> because the perspective is applied as a{" "}
                <em className="text-secondary not-italic">function</em> inside the transform —{" "}
                <code className="font-mono text-xs text-secondary">perspective(1200px) translateY(…) rotateY(…)</code> — not as the CSS property. Checking one
                and concluding about the other is exactly the kind of measurement error this page is supposed to catch.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 26 · Destination showcase                                           */
/* -------------------------------------------------------------------------- */

const places = [
    {
        name: "Riverside",
        blurb: "Barrel sauna on the bank, late-morning sun",
        src: "/hgm video/leaf-shadow-poster.webp",
        card: SHOTS.metapixel.img,
        tint: "bg-brand-solid/50",
        position: "20% 30%",
    },
    {
        name: "Autumn",
        blurb: "Deer on the slope, cabin exterior, peak colour",
        src: "/hgm video/leaf-shadow-poster.webp",
        card: SHOTS.form.img,
        tint: "bg-secondary-solid/60",
        position: "80% 20%",
    },
    {
        name: "Turndown",
        blurb: "A-frame interior, rose petals, candlelight",
        src: "/hgm video/leaf-shadow-poster.webp",
        card: SHOTS.popup.img,
        tint: "bg-brand-solid/35",
        position: "60% 80%",
    },
    {
        name: "Winter",
        blurb: "Snow plate, blue hour, wood smoke",
        src: "/hgm video/leaf-shadow-poster.webp",
        card: SHOTS.metapixel.img,
        tint: "bg-secondary-solid/40",
        position: "10% 70%",
    },
];

const ShowcaseSection = () => (
    <section id="showcase" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 26</Eyebrow>
            <SectionHeading className="mt-4">Four properties, one section</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                Rebuilt from a Framer travel template, and the most directly useful thing on this page for a lodge client: a pinned stage that walks through a
                list of places, changing the background, the card and the name together. One section instead of four — then re-cut against the luxury benchmark
                in section 27, because the template&rsquo;s own motion is louder than the work it is selling.
            </p>
        </Container>

        <ShowcaseStage places={places} />

        <Container>
            <p className="mt-14 max-w-[62ch] text-sm text-tertiary">
                The measured shape: a wrapper 5.1 viewports tall with a single sticky child one viewport high — 3488px of scroll driving one screen — and the
                card&rsquo;s content changing four times across it, so each destination owns about a quarter of the scroll.
            </p>
            <p className="mt-5 max-w-[62ch] text-sm text-tertiary">
                The part worth stealing is the name. It looks like a word being replaced; it is a <em className="text-secondary not-italic">vertical list</em>{" "}
                sliding behind a one-row window. The template stacks four 120px rows separated by 120px gaps inside a 120px mask, so one step is 240px — a row{" "}
                <em className="text-secondary not-italic">plus a gap</em>, not a row. That is why the window is empty at the midpoint of every slide: the name
                leaves, then the next arrives, rather than the two cross-dissolving.
            </p>
            <p className="mt-5 max-w-[62ch] text-sm text-tertiary">
                Re-measured in a headless browser at 40 scroll positions, the belt rests at 0, &minus;240, &minus;480 and &minus;720 and nowhere else — and each
                slide between them is dead linear. This build does not copy that, deliberately: a linear scrub leaves the name half gone whenever a visitor
                stops mid-slide, and they will, because nearly half the pin is slide. Deriving a discrete index and transitioning on the change reads the same
                with no half-states — the scroll picks the name, the transition moves it. The backgrounds have no readable half-state, so they stay scrubbed.
            </p>
            <p className="mt-5 max-w-[62ch] text-sm text-tertiary">
                Five changes came from measuring aman.com, which animates 14 of its 18 images and nothing else on three easing declarations: only the photograph
                moves; <code className="font-mono text-xs text-secondary">cubic-bezier(0.19, 1, 0.22, 1)</code> replaces the template&rsquo;s curve; slower —
                900ms for the name step, 700ms for the crossfade; the name appears once rather than four times; and less chrome — no drop shadow, a lighter
                scrim, a hairline index rather than dots.
            </p>
            <p className="mt-5 max-w-[62ch] text-sm text-tertiary">
                One honest adaptation in this port: the repo owns exactly one landscape plate, so all four backgrounds share it under different token washes,
                and the cards carry page captures. The choreography — one <code className="font-mono text-xs text-secondary">scrollYProgress</code> read by all
                three layers so they cannot drift — is what the section demonstrates. The template also ships zero{" "}
                <code className="font-mono text-xs text-secondary">prefers-reduced-motion</code> blocks, so that path is ours: with the setting on, the tall
                wrapper disappears and the first destination renders finished and still.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 27 · Four houses                                                    */
/* -------------------------------------------------------------------------- */

const HouseSection = () => (
    <section id="houses" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 27</Eyebrow>
            <SectionHeading className="mt-4">Four houses disagree</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                A page that only measures Apple produces a site that copies Apple — and Apple&rsquo;s answer is built for a company selling one object at a time
                with a film crew attached. Three more, counted the same way on the same day. The fastest and the slowest are 240ms apart on the same gesture.
            </p>

            <HouseLab />

            <p className="mt-10 max-w-[62ch] text-sm text-tertiary">
                Aman is the one to argue with, because it is the closest to our clients: a luxury travel brand whose entire homepage carries{" "}
                <em className="text-secondary not-italic">three</em> easing declarations, no video, and nothing driven by scroll. Its position is that the
                photograph is the content and motion should get out of its way. On a page of lodge photography that may be a better answer than Apple&rsquo;s,
                and this page is not neutral about it — sections 07 and 09 are Apple&rsquo;s school, and they cost 580vh of scroll between them.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 28 · The measurements                                               */
/* -------------------------------------------------------------------------- */

const sites = [
    {
        site: "Apple",
        pages: "apple.com, /iphone-17-pro, /macbook-pro",
        curve: "cubic-bezier(0.4, 0, 0.6, 1)",
        ms: "320ms",
        scroll: "19–25 sticky elements, 81–106 rAF calls, 0 CSS timelines",
        rm: "27–61",
    },
    {
        site: "Linear",
        pages: "linear.app",
        curve: "cubic-bezier(0.32, 0.72, 0, 1)",
        ms: "160ms",
        scroll: "None. 0 sticky, 0 IntersectionObserver, View Transitions API instead",
        rm: "41",
    },
    {
        site: "Stripe",
        pages: "stripe.com",
        curve: "cubic-bezier(0.25, 1, 0.5, 1)",
        ms: "300ms",
        scroll: "None narrative. Its 9 CSS scroll timelines are nav plumbing, not storytelling",
        rm: "70",
    },
    {
        site: "Aman",
        pages: "aman.com",
        curve: "cubic-bezier(0.19, 1, 0.22, 1)",
        ms: "400ms",
        scroll: "None to speak of. 2 sticky, 3 easing declarations on the page",
        rm: "54",
    },
];

/**
 * Animated = carries a live CSS transition or animation at rest, counted after
 * scrolling the full document so lazy sections had mounted. "—" is a column
 * that was not present in a comparable form on that page.
 */
const elementTally = [
    { page: "apple.com", p: "0 / 33", h: "—", li: "—", sec: "—" },
    { page: "apple.com/iphone-17-pro", p: "1 / 369", h: "36 / 205", li: "272 / 580", sec: "0 / 20" },
    { page: "stripe.com", p: "4 / 65", h: "7 / 57", li: "36 / 60", sec: "1 / 15" },
    { page: "linear.app", p: "0 / 30", h: "0 / 16", li: "0 / 57", sec: "0 / 8" },
    { page: "aman.com", p: "0 / 39", h: "0 / 35", li: "0 / 197", sec: "1 / 26" },
];

/**
 * The Pro-page survey: every element snapshotted at five scroll positions and
 * diffed, so "scroll-linked" means the transform, opacity or background
 * actually changed as the page moved — not that a class name suggested it might.
 */
const proPages = [
    { page: "apple.com/macbook-pro", screens: "34.3", linked: "56", sticky: "19", galleries: "3 (1.9x, 2.6x, 3.7x)", themes: "14 dark / 17 light" },
    { page: "apple.com/ipad-pro", screens: "34.4", linked: "9", sticky: "29", galleries: "3 (2.3x, 3.7x, 5.4x)", themes: "11 dark / 0 light" },
    { page: "apple.com/iphone-17-pro", screens: "—", linked: "—", sticky: "25", galleries: "—", themes: "black then #f5f5f7" },
];

const rules = [
    "Two curves carry a site. ease-enter for arrivals, ease-state for everything already on screen.",
    "Stay on 100 / 160 / 240 / 320 / 400. Reserve 1000 for scroll-driven only — never for a click.",
    "Overshoot is for small elements. Apple used it 7 times on a page with hundreds of transitions.",
    "Pin and scrub beats fly-in, and costs 280vh. Spend it where the content earns it, not per section.",
    "Reduced motion is per component: kill the movement, keep the end state. Stripe writes 70 such blocks.",
    "Video: no autoplay attribute, preload deliberately, poster carries it. Scrubbing needs a re-encode.",
    "Art-direct per breakpoint. Apple ships 526 picture/source[media] elements rather than scaling one crop.",
    "Never animate body copy. Reveal the block; five of 536 paragraphs measured carry any motion at all.",
    "Sections do not animate — 2 of 69 do. A hard colour cut is the seam. Spend the budget on the card grid.",
    "Horizontal galleries are native: overflow-x plus scroll-snap. Three per Pro page, and no library on any of them.",
    "A 34-screen page moves 9 to 56 elements. Length is content, not motion — the two are not the same budget.",
];

const FindingsSection = () => (
    <section id="numbers" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 28</Eyebrow>
            <SectionHeading className="mt-4">What was actually measured</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                Six pages, four companies, one day — 29 August 2026. Live stylesheets and first-party scripts fetched and counted: roughly 5MB of CSS and 7MB of
                JS. The signature curve is the most-declared one on the page; the duration is the modal value, not an average. A snapshot, not a standard — but
                evidence, which most house-style arguments are not.
            </p>

            {/* The tables scroll inside their own container rather than letting
                the page scroll sideways — five columns of prose do not fit at
                360px. */}
            <div className="-mx-5 mt-12 overflow-x-auto px-5 md:mx-0 md:px-0">
                <table className="w-full min-w-[52rem] border-collapse text-left">
                    <thead>
                        <tr className="border-b border-secondary">
                            {["Site", "Signature curve", "Modal", "Scroll technique", "RM blocks"].map((head) => (
                                <th key={head} scope="col" className="py-3 pr-6 text-xs font-semibold tracking-[0.08em] text-secondary uppercase">
                                    {head}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sites.map((row) => (
                            <tr key={row.site} className="border-b border-secondary align-top">
                                <td className="py-4 pr-6">
                                    <span className="block text-sm font-semibold text-primary">{row.site}</span>
                                    <span className="mt-1 block font-mono text-xs text-quaternary">{row.pages}</span>
                                </td>
                                <td className="py-4 pr-6 font-mono text-xs text-tertiary">{row.curve}</td>
                                <td className="py-4 pr-6 font-mono text-xs text-tertiary">{row.ms}</td>
                                <td className="py-4 pr-6 text-sm text-tertiary">{row.scroll}</td>
                                <td className="py-4 pr-6 font-mono text-xs text-tertiary">{row.rm}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <h3 className="mt-16 text-sm font-semibold tracking-[0.08em] text-secondary uppercase">What actually moves, by element</h3>
            <p className="mt-4 max-w-[62ch] text-sm text-tertiary">
                Every element on each page tested for a live transition or animation, after scrolling the whole document so lazy sections mounted. The pattern
                holds across all five pages and is the clearest result on this page: the card grid moves, the prose does not.
            </p>

            <div className="-mx-5 mt-8 overflow-x-auto px-5 md:mx-0 md:px-0">
                <table className="w-full min-w-[46rem] border-collapse text-left">
                    <thead>
                        <tr className="border-b border-secondary">
                            {["Page", "Paragraphs", "Headings", "List items", "Sections"].map((head) => (
                                <th key={head} scope="col" className="py-3 pr-6 text-xs font-semibold tracking-[0.08em] text-secondary uppercase">
                                    {head}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {elementTally.map((row) => (
                            <tr key={row.page} className="border-b border-secondary align-top">
                                <td className="py-4 pr-6 font-mono text-xs text-primary">{row.page}</td>
                                <td className="py-4 pr-6 font-mono text-xs text-tertiary">{row.p}</td>
                                <td className="py-4 pr-6 font-mono text-xs text-tertiary">{row.h}</td>
                                <td className="py-4 pr-6 font-mono text-xs text-tertiary">{row.li}</td>
                                <td className="py-4 pr-6 font-mono text-xs text-tertiary">{row.sec}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <h3 className="mt-16 text-sm font-semibold tracking-[0.08em] text-secondary uppercase">The Pro pages, surveyed</h3>
            <p className="mt-4 max-w-[62ch] text-sm text-tertiary">Two 34-screen pages, and between them 65 moving elements and six horizontal galleries.</p>

            <div className="-mx-5 mt-8 overflow-x-auto px-5 md:mx-0 md:px-0">
                <table className="w-full min-w-[50rem] border-collapse text-left">
                    <thead>
                        <tr className="border-b border-secondary">
                            {["Page", "Screens", "Scroll-linked", "Sticky", "Galleries", "Themes"].map((head) => (
                                <th key={head} scope="col" className="py-3 pr-6 text-xs font-semibold tracking-[0.08em] text-secondary uppercase">
                                    {head}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {proPages.map((row) => (
                            <tr key={row.page} className="border-b border-secondary align-top">
                                <td className="py-4 pr-6 font-mono text-xs text-primary">{row.page}</td>
                                <td className="py-4 pr-6 font-mono text-xs text-tertiary">{row.screens}</td>
                                <td className="py-4 pr-6 font-mono text-xs text-tertiary">{row.linked}</td>
                                <td className="py-4 pr-6 font-mono text-xs text-tertiary">{row.sticky}</td>
                                <td className="py-4 pr-6 font-mono text-xs text-tertiary">{row.galleries}</td>
                                <td className="py-4 pr-6 font-mono text-xs text-tertiary">{row.themes}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <h3 className="mt-16 text-sm font-semibold tracking-[0.08em] text-secondary uppercase">What we take</h3>
            <ul className="mt-6 flex max-w-[70ch] flex-col gap-4">
                {rules.map((rule) => (
                    <li key={rule} className="flex gap-4">
                        <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rotate-45 bg-brand-solid" />
                        <span className="text-md text-tertiary">{rule}</span>
                    </li>
                ))}
            </ul>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section 29 · Distance decay                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The one general technique worth taking from the Traavellio template: it
 * staggers BOTH delay and distance. Parsed out of its appear animations, the
 * hero ladder's travel runs 40, 21, 20, 10 — four points that fit a 0.7
 * geometric decay (40, 28, 20, 14, 10). A constant distance makes the LAST item
 * the most conspicuous, because by the time it moves it is the only thing still
 * moving and it travels just as far as the first did. Decaying the travel makes
 * the row read as one gesture settling — the wave loses energy, the way waves
 * do. It costs one prop: `Reveal` already takes `y`.
 */
const decaySteps = [
    { step: "Discovery call", flat: 40, decay: 40 },
    { step: "Location scout", flat: 40, decay: 28 },
    { step: "Shoot day", flat: 40, decay: 20 },
    { step: "Edit and grade", flat: 40, decay: 14 },
    { step: "Delivery", flat: 40, decay: 10 },
];

const DecayColumn = ({ mode }: { mode: "flat" | "decay" }) => (
    <ul className="mt-6 space-y-3">
        {decaySteps.map((item, index) => (
            // Same delay ladder on both sides. The ONLY difference between the
            // two columns is the number in `y`, which is the point — a second
            // changed variable would make the comparison worth nothing.
            <Reveal key={item.step} delay={index * 0.08} y={item[mode]}>
                <li className="flex items-center justify-between rounded-xl border border-secondary bg-secondary px-5 py-4">
                    <span className="text-md font-semibold text-primary">{item.step}</span>
                    <span className="font-mono text-xs text-tertiary">
                        {index * 80}ms &middot; {item[mode]}px
                    </span>
                </li>
            </Reveal>
        ))}
    </ul>
);

const DecaySection = () => (
    <section id="decay" className="scroll-mt-20 border-t border-secondary py-20 md:py-28">
        <Container>
            <Eyebrow>Section 29</Eyebrow>
            <SectionHeading className="mt-4">The stagger that runs out of distance</SectionHeading>
            <p className="mt-5 max-w-[62ch] text-lg text-tertiary">
                Two identical ladders, 80ms apart, 500ms each. The left one travels 40px every time. The right one travels 40, 28, 20, 14 and 10 — the same
                wave, losing energy. Press both and watch the last row: on the left it is the loudest thing in the column, on the right it barely arrives.
            </p>

            <div className="mt-12 grid gap-10 lg:grid-cols-2">
                <div>
                    <ReplayScope label="Replay — constant 40px">
                        <DecayColumn mode="flat" />
                    </ReplayScope>
                    <p className="mt-5 text-sm text-tertiary">
                        What the site ships today, with the amplitude turned up so the difference is visible &mdash;{" "}
                        <code className="font-mono text-xs text-secondary">Reveal</code>&rsquo;s real default is a constant 24px. Five items, five equal
                        journeys, and the eye is dragged back down the column for the last one.
                    </p>
                </div>

                <div>
                    <ReplayScope label="Replay — 40px decaying to 10px">
                        <DecayColumn mode="decay" />
                    </ReplayScope>
                    <p className="mt-5 text-sm text-tertiary">
                        The same delays, each distance 0.7 of the one above it. The row still arrives in order, but it settles instead of finishing &mdash; and
                        nothing about the markup, the duration or the easing changed.
                    </p>
                </div>
            </div>

            <p className="mt-12 max-w-[62ch] text-sm text-tertiary">
                Measured off the template&rsquo;s hero ladder: y &minus;40, 21, 20, then 10 for all three trailing items, across nine animations sharing two
                easing curves. Four points fit a 0.7 decay well enough to be worth copying and not well enough to be worth calling a law &mdash; the shape is
                theirs, the exponent is ours.
            </p>
            <p className="mt-5 max-w-[62ch] text-sm text-tertiary">
                Their ladder settles at <strong className="font-semibold text-secondary">1.9 seconds</strong>. Ours settles at 820ms, because 1000ms on this
                site is scroll-driven only and a first paint that is still assembling after a second and a half has stopped being an entrance. Reduced motion is{" "}
                <code className="font-mono text-xs text-secondary">Reveal</code>&rsquo;s own: both columns render as plain static lists, which is a complete
                five-step process either way.
            </p>
        </Container>
    </section>
);

/* -------------------------------------------------------------------------- */
/* Section rail                                                                */
/* -------------------------------------------------------------------------- */

/**
 * One icon per family — the source page's own assignment (its rail keys were
 * sliders / type / layers / cursor / bar-chart), mapped onto this project's
 * installed icon set.
 */
const RAIL_ICONS: Record<string, React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>> = {
    Fundamentals: Sliders01,
    Entrances: Type01,
    Scroll: LayersThree01,
    Interface: CursorClick01,
    Evidence: BarChart01,
};

/**
 * The source page's exact grouping. Thematic, not numeric — Distance decay
 * (29) belongs with the entrances, the four Framer rebuilds (23–26) with
 * scroll — so the numbers stay in page order inside each group.
 */
const railItems = [
    { id: "easing", name: "Easing and duration", family: "Fundamentals" },
    { id: "state", name: "Hover and focus", family: "Fundamentals" },
    { id: "enter", name: "Staggered entrances", family: "Entrances" },
    { id: "text", name: "Headlines", family: "Entrances" },
    { id: "copy", name: "Body copy", family: "Entrances" },
    { id: "seams", name: "Section seams", family: "Entrances" },
    { id: "scrub", name: "Pin and scrub", family: "Scroll" },
    { id: "family", name: "The family shot", family: "Scroll" },
    { id: "film", name: "Scrubbed film", family: "Scroll" },
    { id: "gallery", name: "Snap galleries", family: "Scroll" },
    { id: "stack", name: "Stacked cards", family: "Scroll" },
    { id: "parallax", name: "Parallax depth", family: "Scroll" },
    { id: "counters", name: "Counters", family: "Interface" },
    { id: "transitions", name: "View transitions", family: "Interface" },
    { id: "loading", name: "Loading states", family: "Interface" },
    { id: "overshoot", name: "Overshoot", family: "Interface" },
    { id: "disclosure", name: "Disclosure height", family: "Interface" },
    { id: "marquee", name: "Marquee", family: "Interface" },
    { id: "overlay", name: "Overlays", family: "Interface" },
    { id: "images", name: "Images arriving", family: "Interface" },
    { id: "perf", name: "Cost of the wrong property", family: "Interface" },
    { id: "shared", name: "Shared elements", family: "Interface" },
    { id: "scatter", name: "Scatter deck", family: "Scroll" },
    { id: "columns", name: "Staggered columns", family: "Scroll" },
    { id: "spiral", name: "The spiral", family: "Scroll" },
    { id: "showcase", name: "Destination showcase", family: "Scroll" },
    { id: "houses", name: "Four houses", family: "Evidence" },
    { id: "numbers", name: "The measurements", family: "Evidence" },
    { id: "decay", name: "Distance decay", family: "Entrances" },
].map((item, index) => ({ ...item, number: String(index + 1).padStart(2, "0") }));

const FAMILIES = [...new Set(railItems.map((item) => item.family))];

/** One fixed-width right-aligned mono slot, so counts read as a column. */
const countClasses = "w-4 shrink-0 text-right font-mono text-[0.625rem] tabular-nums text-tertiary";

/** The gutter every child row hangs its label off. */
const gutterClasses = "w-4 shrink-0 font-mono text-[0.625rem] leading-5 tabular-nums";

/**
 * The contents rail, xl and up — the source site's BackdropNav grammar on this
 * project's tokens: an identity block, collapsible family groups (icon, title,
 * right-aligned count, chevron), children hung off a hairline connector, and
 * the active item marked by a brand segment in the gutter. An
 * IntersectionObserver watches a band near the top of the viewport so the
 * highlighted entry is whatever is crossing the reading line, and the group
 * holding it re-opens if it was collapsed. Below xl the rail is simply absent
 * — this is a desktop working document.
 */
const SectionRail = () => {
    const [active, setActive] = useState(railItems[0].id);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) setActive(entry.target.id);
                }
            },
            // A band from 15% to 30% down the viewport: the section crossing
            // the reading line wins, not the one filling most of the screen.
            { rootMargin: "-15% 0px -70% 0px" },
        );
        for (const item of railItems) {
            const el = document.getElementById(item.id);
            if (el) observer.observe(el);
        }
        return () => observer.disconnect();
    }, []);

    // Scrolling into a collapsed group re-opens it: a rail whose highlight is
    // hidden inside a closed group is a rail lying about where you are.
    useEffect(() => {
        const family = railItems.find((item) => item.id === active)?.family;
        if (family) setCollapsed((prev) => (prev[family] ? { ...prev, [family]: false } : prev));
    }, [active]);

    return (
        <nav aria-label="Sections" className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-secondary bg-secondary xl:flex">
            <div className="flex shrink-0 items-center gap-3 border-b border-secondary px-4 py-5">
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-solid">
                    <span className="size-2.5 rotate-45 bg-primary" />
                </span>
                <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-primary">Animation</span>
                    <span className="block truncate font-mono text-[0.625rem] tracking-[0.14em] text-tertiary uppercase">{railItems.length} sections</span>
                </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                {FAMILIES.map((family) => {
                    const inFamily = railItems.filter((item) => item.family === family);
                    const Icon = RAIL_ICONS[family];
                    const isCollapsed = collapsed[family] === true;
                    const holdsActive = inFamily.some((item) => item.id === active);

                    return (
                        <div key={family} className="mt-0.5 first:mt-0">
                            {/* The family is a heading you can close, not a
                                destination — it gets the hover fill and the
                                brand icon of an active row, never a link. */}
                            <button
                                type="button"
                                onClick={() => setCollapsed((prev) => ({ ...prev, [family]: !isCollapsed }))}
                                aria-expanded={!isCollapsed}
                                aria-controls={`rail-${family}`}
                                className={cx(
                                    "group/row flex w-full items-center gap-2.5 rounded-lg py-2 pr-2 pl-2.5 text-sm outline-focus-ring transition duration-100 ease-linear focus-visible:outline-2 focus-visible:-outline-offset-2",
                                    holdsActive
                                        ? "bg-primary font-medium text-primary shadow-xs ring-1 ring-secondary"
                                        : "text-secondary group-hover/row:text-primary hover:bg-secondary_hover",
                                )}
                            >
                                <Icon aria-hidden="true" className={cx("size-4 shrink-0", holdsActive ? "text-fg-brand-primary" : "text-fg-quaternary")} />
                                <span className="flex-1 truncate text-left">{family}</span>
                                {/* Collapsing hides the highlighted item, so the group says it holds it. */}
                                {isCollapsed && holdsActive && <span aria-hidden="true" className="size-1 shrink-0 rotate-45 bg-border-brand" />}
                                <span className={countClasses}>{inFamily.length}</span>
                                <ChevronDown
                                    aria-hidden="true"
                                    className={cx(
                                        "size-4 shrink-0 text-fg-quaternary transition-transform duration-100 ease-linear",
                                        isCollapsed && "-rotate-90",
                                    )}
                                />
                            </button>

                            {/* The 0fr/1fr grid trick — section 17's own fix,
                                because `height: auto` is not animatable.
                                `inert` keeps a closed group's links out of the
                                tab order while still letting it transition. */}
                            <div
                                className={cx(
                                    "grid transition-[grid-template-rows] duration-160 ease-state motion-reduce:transition-none",
                                    isCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
                                )}
                            >
                                {/* `border-l` plus `ml-4` is the connector every
                                    dashboard rail draws: it ties the children to
                                    the group they belong to. The active entry
                                    turns its own segment brand — a 2px rule in
                                    the gutter reads from further away than a
                                    tinted row. */}
                                <ul id={`rail-${family}`} inert={isCollapsed} className="ml-4 flex flex-col overflow-hidden border-l border-primary">
                                    {inFamily.map((item) => {
                                        const isActive = active === item.id;

                                        return (
                                            <li key={item.id} className="relative">
                                                {isActive && (
                                                    <span aria-hidden="true" className="absolute inset-y-1 -left-px w-0.5 rounded-full bg-border-brand" />
                                                )}
                                                <a
                                                    href={`#${item.id}`}
                                                    aria-current={isActive ? "true" : undefined}
                                                    className={cx(
                                                        "flex items-start gap-2 rounded-md py-1.5 pr-2 pl-3 text-sm outline-focus-ring transition duration-100 ease-linear focus-visible:outline-2 focus-visible:-outline-offset-2",
                                                        isActive ? "font-medium text-primary" : "text-tertiary hover:bg-secondary_hover hover:text-primary",
                                                    )}
                                                >
                                                    <span aria-hidden="true" className={cx(gutterClasses, isActive ? "text-brand-secondary" : "text-tertiary")}>
                                                        {item.number}
                                                    </span>
                                                    {/* Wraps to a second line rather than cutting a word in half. */}
                                                    <span className="line-clamp-2 leading-5">{item.name}</span>
                                                </a>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="shrink-0 border-t border-secondary px-4 py-4">
                <p className="font-mono text-[0.625rem] tracking-[0.14em] text-tertiary uppercase">Team-internal · unlisted</p>
            </div>
        </nav>
    );
};

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export const AnimationScreen = () => (
    <main className="min-h-dvh bg-primary xl:pl-60">
        <SectionRail />

        <div className="border-b border-secondary bg-secondary py-10">
            <Container>
                <p className="font-mono text-xs tracking-[0.14em] text-quaternary uppercase">Animation</p>
                <h1 className="mt-2 text-display-xs font-semibold text-primary">Motion, measured</h1>
                <p className="mt-3 max-w-[62ch] text-md text-tertiary">
                    Twenty-nine sections built on this project&rsquo;s committed device frames, ordered smallest gesture to largest. Every number counted off
                    live stylesheets from Apple, Linear, Stripe and Aman rather than remembered — including where those four flatly disagree. Ported from the
                    HiddenGem marketing site; team-internal, not linked from anywhere.
                </p>
            </Container>
        </div>

        <EasingSection />
        <StateSection />
        <EnterSection />
        <TextSection />
        <ParagraphSection />
        <SeamSection />
        <ScrubSection />
        <FamilySection />
        <FilmSection />
        <GallerySection />
        <StackSection />
        <ParallaxSection />
        <CounterSection />
        <TransitionSection />
        <LoadingSection />
        <OvershootSection />
        <DisclosureSection />
        <MarqueeSection />
        <OverlaySection />
        <ImageSection />
        <PerfSection />
        <SharedSection />
        <ScatterSection />
        <ColumnSection />
        <SpiralSection />
        <ShowcaseSection />
        <HouseSection />
        <FindingsSection />
        <DecaySection />
    </main>
);
