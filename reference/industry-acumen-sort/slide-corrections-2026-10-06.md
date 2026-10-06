---
title: "For the Claude project: the tools answer key, the game and the slides, 6 Oct 2026"
status: "Applied in the portal on 6 Oct 2026 (card list 3.0, manifest 1.3). Everything under 'What the Claude project needs to do' is still to do there."
---

# For the Claude project: the tools, as the portal now has them

Kyle found the tools flashcards, the session 2 slides and Sort the stack telling players different
things about the same vendor. The game had taken the 5 Oct vendor check
(`verification-2026-10-05.md`), the flashcards had kept the slides' boxes, and the deck predates both.
The portal now has one answer per vendor, the training and the game read it, and
`vendor-icons.check.ts` fails if they ever disagree again. This file is everything the Claude project
needs to catch up.

## Send these to the Claude project

| File in the portal                               | Replaces in the Claude project                                                                                          |
| :----------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| `src/data/industry-acumen-sort-cards.json` (3.0) | The card list master (`claude/sessions_industry-acumen-master.md`, Part 3, practice 6, and whatever generates the JSON) |
| `src/data/vendor-icons.json` (1.3)               | `vendor-icons-manifest.json` (1.0)                                                                                      |
| This file                                        | The to-do list for the deck master and the Client Tech Stack Guide                                                      |

Until the masters have them, a new copy from the Claude project would undo all of this, so the portal
compares any new copy before replacing.

## The rule

A box counts for a vendor when **the vendor sells that job to properties under its own name, in a plan
or as a paid add-on**. A partner's product the vendor connects to doesn't count, and nor does a sister
company sold under another brand (Little Hotelier for SiteMinder, Uplisting for AirDNA, Sojern for
RateGain, Lighthouse's competitor rates inside Mews RMS).

Where a box needed a line drawn, the line is the box's own job:

- **Booking engine**: the "Book now" on the property's own site that writes the booking into the PMS.
  GoHighLevel's Rentals page syncs only by iCal (and is in beta), so it doesn't count.
- **Dynamic pricing**: rates that move automatically. Rules a PMS applies by occupancy count (Newbook,
  RMS Cloud, STAAH); per-channel rate rules a person sets don't (DerbySoft).
- **Rate shopping and market intelligence**: the property can look at competitors' prices or the
  market itself (benchmarking counts: STR, KeyData, Demand360). A pricing engine that only uses
  competitors' rates inside (RoomPriceGenie) doesn't count, and nor does a parity check of the
  property's own rates (DerbySoft, Cendyn Rate Match).
- **CRM**: a guest list the property can segment and send campaigns to. Guest profiles or an
  exportable guest book alone don't count (Mews, Hostaway).
- **Guest messaging**: a two-way inbox reaching guests on their own channels (SMS, WhatsApp, email,
  chat). Marketing texts the business can only reply to don't count (Klaviyo, Mailchimp), and nor do
  OTA message threads relayed inside a channel manager (STAAH).
- **Upsell**: paid upgrades or extras offered to a guest after booking (pre-arrival offers, a guest
  portal or app, check-in). Extras offered only inside the booking flow don't count (RateGain's UNO,
  Lighthouse's KITT).

**The Client Tech Stack Guide (v2.1) wins where it differs.** It left out four boxes that rested on
thin evidence, and Kyle chose the guide, so the portal dropped them too: WebRezPro's dynamic pricing,
Lodgify's upsell, Lighthouse's PMS (its "Reservation Management") and HubSpot's guest messaging. The
guide's tags and the portal now agree on every vendor.

## The answer key (manifest 1.3)

"Known for" comes first on the flashcard; everything else it sells is "Also sells", and the game
accepts all of them as right. Amadeus is one entry for two products, iHotelier (booking engine) and
Demand360 (rate shopping); the game's iHotelier card accepts booking engine and channel manager, and
its Demand360 card rate shopping only.

| Vendor              | Known for                     | Also sells                                                                                    |
| ------------------- | ----------------------------- | --------------------------------------------------------------------------------------------- |
| AirDNA              | Rate shopping                 | Dynamic pricing                                                                               |
| Akia                | Guest messaging               | CRM, Upsell                                                                                   |
| Amadeus             | Booking engine, Rate shopping | Channel manager, CRM, Upsell                                                                  |
| Atomize             | Dynamic pricing               | —                                                                                             |
| Beyond              | Dynamic pricing               | Booking engine, Rate shopping                                                                 |
| Canary Technologies | Guest messaging               | Upsell                                                                                        |
| Cendyn              | CRM                           | Channel manager, Booking engine, Dynamic pricing                                              |
| Cloudbeds           | PMS                           | Channel manager, Booking engine, Dynamic pricing, Rate shopping, CRM, Guest messaging, Upsell |
| DerbySoft           | Channel manager               | —                                                                                             |
| Duetto              | Dynamic pricing               | —                                                                                             |
| Duve                | Guest messaging               | Upsell                                                                                        |
| Enso Connect        | Guest messaging               | CRM, Upsell                                                                                   |
| GoHighLevel         | CRM                           | Guest messaging                                                                               |
| Guesty              | PMS                           | Channel manager, Booking engine, Dynamic pricing, CRM, Guest messaging, Upsell                |
| Hostaway            | PMS                           | Channel manager, Booking engine, Dynamic pricing, Guest messaging, Upsell                     |
| HubSpot             | CRM                           | —                                                                                             |
| IDeaS               | Dynamic pricing               | —                                                                                             |
| KeyData             | Rate shopping                 | —                                                                                             |
| Kipsu               | Guest messaging               | —                                                                                             |
| Klaviyo             | CRM                           | —                                                                                             |
| Lighthouse          | Rate shopping                 | Channel manager, Booking engine, Dynamic pricing                                              |
| Little Hotelier     | PMS                           | Channel manager, Booking engine, Dynamic pricing, Rate shopping, Guest messaging, Upsell      |
| Lodgify             | Booking engine                | PMS, Channel manager, Dynamic pricing, Guest messaging                                        |
| Mailchimp           | CRM                           | —                                                                                             |
| Mews                | PMS                           | Channel manager, Booking engine, Dynamic pricing, Guest messaging, Upsell                     |
| Newbook             | PMS                           | Channel manager, Booking engine, Dynamic pricing, CRM, Guest messaging, Upsell                |
| Nor1                | Upsell                        | —                                                                                             |
| Oaky                | Upsell                        | —                                                                                             |
| Oracle OPERA Cloud  | PMS                           | Channel manager, Upsell                                                                       |
| Plusgrade           | Upsell                        | —                                                                                             |
| PriceLabs           | Dynamic pricing               | Rate shopping                                                                                 |
| RateGain            | Rate shopping                 | Channel manager, Booking engine                                                               |
| Revinate            | CRM                           | Guest messaging, Upsell                                                                       |
| RMS Cloud           | PMS                           | Channel manager, Booking engine, Dynamic pricing, CRM, Guest messaging, Upsell                |
| RoomPriceGenie      | Dynamic pricing               | —                                                                                             |
| Sabre               | Booking engine                | Channel manager                                                                               |
| SiteMinder          | Channel manager               | Booking engine, Dynamic pricing, Rate shopping, Guest messaging, Upsell                       |
| STAAH               | Channel manager               | Booking engine, Dynamic pricing, Rate shopping                                                |
| STR (CoStar)        | Rate shopping                 | —                                                                                             |
| UpsellGuru          | Upsell                        | —                                                                                             |
| WebRezPro           | PMS                           | Booking engine, Upsell                                                                        |
| Wheelhouse          | Dynamic pricing               | Rate shopping                                                                                 |
| Whistle             | Guest messaging               | Upsell                                                                                        |

## The game (card list 3.0): no two runs the same

Every box is now a **pool**. Each run deals three cards from each box's pool and three of round 3's
six suites, so the cards and suites change every time. A pool takes any vendor that sells the job, so
a suite can be dealt as a channel manager (Guesty, Cloudbeds); it's right in every box it sells.

| Round | Box                                   | Pool | Vendors                                                                                                                                                                                                                 |
| :---- | :------------------------------------ | :--- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | PMS                                   | 6    | Mews · Oracle OPERA Cloud · Newbook · RMS Cloud · Little Hotelier · Hostaway                                                                                                                                            |
| 1     | Channel manager                       | 6    | SiteMinder · STAAH · DerbySoft · RateGain · Guesty · Cloudbeds                                                                                                                                                          |
| 1     | Booking engine                        | 5    | Sabre SynXis · Amadeus iHotelier · Lodgify · WebRezPro · Beyond                                                                                                                                                         |
| 1     | Dynamic pricing                       | 6    | Wheelhouse · PriceLabs · IDeaS · Duetto · RoomPriceGenie · Atomize                                                                                                                                                      |
| 2     | Rate shopping and market intelligence | 5    | Lighthouse · AirDNA · KeyData · STR, part of CoStar · Amadeus Demand360                                                                                                                                                 |
| 2     | CRM                                   | 6    | Revinate · Cendyn · GoHighLevel · HubSpot · Mailchimp · Klaviyo                                                                                                                                                         |
| 2     | Guest messaging                       | 6    | Duve · Canary Technologies · Whistle · Akia · Enso Connect · Kipsu                                                                                                                                                      |
| 2     | Upsell                                | 4    | Oaky · Nor1 · UpsellGuru · Plusgrade                                                                                                                                                                                    |
| 3     | Suites (deals 3)                      | 6    | Cloudbeds (not: none) · SiteMinder (not: PMS, CRM) · Mews (not: CRM) · Little Hotelier (not: CRM) · Newbook (not: Rate shopping) · Revinate (not: PMS, Channel manager, Booking engine, Dynamic pricing, Rate shopping) |

- **New cards** (notes from the 5 Oct check, sources the vendors' own pages): RMS Cloud, Little
  Hotelier, Hostaway, Guesty, Cloudbeds, WebRezPro, Beyond, Duetto, RoomPriceGenie, Atomize, KeyData,
  STR, Amadeus Demand360, HubSpot, Mailchimp, Klaviyo, Akia, Enso Connect, Kipsu, Plusgrade. **New
  suites**: Little Hotelier, Newbook, Revinate. **RateGain** moved to round 1's channel-manager pool.
- **Rate shopping's job line** is now "Shows what nearby properties charge, and how the market is
  doing", so it's true for the benchmarking tools too.
- **Answers that changed** since 2.1: Oracle OPERA Cloud and Sabre SynXis are right in Channel manager,
  Revinate and Whistle in Upsell. No answer that was right became wrong.
- **The tools check.** On `/dictionary/tools/review` a finished run gets a results page
  (`/dictionary/tools/review/results`): a score and grade on the terms check's scale, the tools to
  refresh on, links to practise just those, and a reset. It's kept in the player's browser only, so
  slide 44's "Nothing leaves your device" is still true.

## What the Claude project needs to do

### The deck master (session 2)

Required, because the slides contradict the training and the game:

- **Slide 40, Rate shopping**: take **Google** off. Google Hotels is metasearch (slide 5), not a rate
  shopper. Replace it with PriceLabs ("Market data and rate shopping come with its pricing tool"), as
  the guide does.
- **Slide 41, CRM**: take **Mews** off. Mews keeps guest profiles but sells no CRM; its own guide tells
  hotels to connect the CRM of their choice. Replace it with Enso Connect, as the guide does. The trap
  can go in the footer: "Mews keeps guest profiles, but connects to a CRM rather than being one."
- **Slide 46, The stack, sorted**: every run is now dealt from the pools above, so no fixed answer
  slide matches what a player gets. Either show each box's pool ("PMS: any of Mews, OPERA, Newbook, RMS
  Cloud, Little Hotelier, Hostaway"), or replace the slide with "Your answers are on your results
  page". At minimum, round 3's answers are wrong today: Cloudbeds does all eight jobs; SiteMinder six
  (not PMS: that's Little Hotelier; not CRM); Mews six (not CRM).
- **Slide 37, SiteMinder tile**: "with a booking engine and a small-property PMS beside it" reads as
  SiteMinder selling a PMS, which the game marks wrong. Use the guide's wording: "A channel manager
  first, with a booking engine; its small-property PMS is a separate product, Little Hotelier."
- **Slide 36, Oracle OPERA Cloud tile**: "Hyatt and IHG run it" overstates IHG. Use the guide's: "The
  big-brand PMS: Hyatt chose it, and IHG approves it."
- **Slide 38, Sabre SynXis tile**: "Sabre's booking engine" is wrong on owner since 2025. The guide's
  wording works without the parked rename: "SynXis's booking engine (sold by Sabre until 2025), on its
  central reservation system (CRS)."

Worth doing, so a tile says what the flashcard will:

- **Slide 36, footer**: add Newbook, Guesty and Hostaway to the suites that "also sit in the channel
  manager and booking engine boxes".
- **Slide 37, Hostaway**: teach it as a PMS first, as the guide does.
- **Slide 39, Atomize**: now sold as Mews RMS, part of Mews.
- **Slide 40, Lighthouse**: it also sells pricing and, for small independents, a channel manager and
  booking engine.
- **Slide 41, GoHighLevel**: "with texting and chat built in".
- **Slide 48** already matches the portal ("Tool check and tool practice"): the buttons now read "Take
  the tools check" and "Practise the tools".

### The Client Tech Stack Guide (v2.1)

Its tags match the portal. A few lines of text are out of date or unchecked:

- **Cloudbeds (dynamic pricing)**: "A pricing tool inside the suite (PIE, its price intelligence
  engine)". PIE became Revenue Intelligence and then **Cloudbeds RMS** (launched 15 Sep 2026); PIE help
  articles are still online.
- **RateGain**: "its channel manager is RezGain". RateGain sells its channel manager as part of
  **UNO** today (uno.rategain.com/hotel-channel-manager); worth checking whether RezGain is still a
  name owners hear.
- **Beyond**: "Called Beyond Pricing until 2021". The 5 Oct check found it formerly Beyond Pricing (the
  site is still beyondpricing.com) but no date; check the year before keeping it.
- **"Key Data"**: the company writes it **KeyData** (formerly Key Data Dashboard).
- **Amadeus**: the guide shows iHotelier and Demand360 as separate tiles, by product; the flashcard is
  one card for Amadeus, which also sells a CRM and pre-arrival upsells (its Guest Management System).
  Both are right; just know why they differ.

### Still parked (Kyle)

- The renames: SynXis to Aven Hospitality, Whistle to Cloudbeds Guest Experience, Oaky to Oaky by
  Plusgrade.

## Outside the tools, noticed in passing

- **Slide 49** says "What the team sees is how we did as a group, and which terms need another look."
  The portal has no group view: each person sees only their own results, and CLAUDE.md says not to
  add a cross-person view without asking. Either cut the line or ask Kyle about a group view.
- **The three PDFs** (the dictionary, the call cheat sheet and the Client Tech Stack Guide) are now on
  `/dictionary` under Resources. Those files are public (the portal's repository is public, and anyone
  with a link can open them), though their footers say "Internal". Kyle chose to publish them as they
  are; a future version could drop the "Internal" footer, or the portal could move them behind sign-in.
