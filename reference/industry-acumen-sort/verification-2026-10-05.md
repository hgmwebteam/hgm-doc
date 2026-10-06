---
title: Session 2 tools slides — vendor check, 5 Oct 2026
status: "findings for Kyle; nothing in the data files has been changed"
method: "One researcher per vendor (44 in all) read the vendor's own website and recorded, for each of the eight boxes, whether the vendor sells that job as core, as an add-on, only through a partner, or not at all, with quotes and URLs. A second agent tried to refute the researcher only where the researcher found the slides wrong or could not tell. That was 2 vendors, Google and Mews (both found wrong; none came back 'could not tell'), and both second checks re-fetched every cited page, matched every quote and agreed. For the other 42 the first check stands alone, a trim Kyle chose on 6 Oct to keep the cost down."
---

# The tools slides: what the vendors' own sites say

Kyle asked for the tools training to teach what the session 2 tools slides (slides 36 to 43) say each
vendor falls under, "but verify please". This is that check, for all 44 vendors.

Nothing in the data files has been changed. The slides' boxes are in `src/data/vendor-icons.json` and
the game's answers are in `src/data/industry-acumen-sort-cards.json`. Both are copies of the Claude
project's masters, so fix the masters, then copy them in. Until then the tools training
(`/dictionary/tools/practice`) shows the slides' boxes as they are, wrong ones included.

Three words used throughout:

- **Core**: sold under the vendor's own name, in its main product or plans.
- **Add-on**: sold by the vendor for an extra fee, or under a sister brand it owns.
- **Partner-only**: the vendor connects to another company's product for that job.

In the tables, "rate shopping" is short for the box "Rate shopping and market intelligence".

## The short version

Of the 44: **18 right, 24 right but incomplete, 2 wrong** (Google and Mews). None came back "could
not tell".

| Tool                           | The slides say                                                            | Verified (core; then add-on)                                                                                                                   | Verdict           | What to change                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| AirDNA                         | Rate shopping                                                             | Dynamic pricing, rate shopping; add-on: PMS, channel manager, booking engine, guest messaging (all through Uplisting, sold under its own name) | Right, incomplete | **Add dynamic pricing** (Adapt, since 1 Sep 2026). Leave Uplisting's jobs off AirDNA.                                     |
| Akia                           | Guest messaging                                                           | Guest messaging, upsell; add-on: CRM                                                                                                           | Right, incomplete | **Add upsell** (every plan) **and CRM** (a paid module).                                                                  |
| Amadeus (iHotelier, Demand360) | Booking engine, rate shopping                                             | Booking engine, rate shopping (Demand360 is market data), CRM; add-on: channel manager, upsell                                                 | Right, incomplete | **Add CRM** (its Guest Management System).                                                                                |
| Atomize                        | Dynamic pricing                                                           | Dynamic pricing                                                                                                                                | Right             | **Rename: it is now Mews RMS, part of Mews.**                                                                             |
| Beyond                         | Dynamic pricing                                                           | Dynamic pricing, rate shopping; add-on: booking engine                                                                                         | Right, incomplete | **Add rate shopping** (Insights, every plan).                                                                             |
| Canary Technologies            | Guest messaging, upsell                                                   | Guest messaging, upsell                                                                                                                        | Right             | None.                                                                                                                     |
| Cendyn                         | CRM                                                                       | Channel manager (through its CRS), booking engine, dynamic pricing, CRM; guest messaging unclear                                               | Right, incomplete | **Add channel manager, booking engine and dynamic pricing.**                                                              |
| Cloudbeds                      | PMS, channel manager, booking engine, dynamic pricing, rate shopping, CRM | PMS, channel manager, booking engine, guest messaging, upsell; add-on: dynamic pricing, rate shopping, CRM                                     | Right, incomplete | **Add guest messaging and upsell.** The game's round 3 needs fixing (section 4).                                          |
| DerbySoft                      | Channel manager                                                           | Channel manager; dynamic pricing unclear                                                                                                       | Right             | None.                                                                                                                     |
| Duetto                         | Dynamic pricing                                                           | Dynamic pricing                                                                                                                                | Right             | None.                                                                                                                     |
| Duve                           | Guest messaging, upsell                                                   | Guest messaging (Pro plan), upsell (Premium plan)                                                                                              | Right             | None.                                                                                                                     |
| Enso Connect                   | Guest messaging, upsell                                                   | CRM, guest messaging, upsell                                                                                                                   | Right, incomplete | **Add CRM** (in the base subscription).                                                                                   |
| GoHighLevel                    | CRM                                                                       | Booking engine (Rentals, since 24 Jun 2026), CRM, guest messaging                                                                              | Right, incomplete | **Add guest messaging.** It is now sold as HighLevel.                                                                     |
| Google                         | Rate shopping                                                             | None of the eight: it is metasearch                                                                                                            | **Wrong**         | **Take it off rate shopping.** Give it a metasearch label or drop it.                                                     |
| Guesty                         | PMS, channel manager, guest messaging                                     | PMS, channel manager, booking engine, CRM, guest messaging; add-on: dynamic pricing, rate shopping (limited), upsell                           | Right, incomplete | **Add booking engine and CRM.**                                                                                           |
| Hostaway                       | Channel manager                                                           | PMS, channel manager, booking engine, CRM (a basic guest book), guest messaging, upsell; add-on: dynamic pricing                               | Right, incomplete | **Teach it as a PMS first. Add PMS, booking engine, dynamic pricing, guest messaging and upsell.**                        |
| HubSpot                        | CRM                                                                       | CRM, guest messaging (generic, not for hotels)                                                                                                 | Right             | None. Teach it as CRM only.                                                                                               |
| IDeaS                          | Dynamic pricing                                                           | Dynamic pricing; add-on: rate shopping                                                                                                         | Right             | None.                                                                                                                     |
| KeyData                        | Rate shopping                                                             | Rate shopping                                                                                                                                  | Right             | None.                                                                                                                     |
| Kipsu                          | Guest messaging                                                           | Guest messaging                                                                                                                                | Right             | None.                                                                                                                     |
| Klaviyo                        | CRM                                                                       | CRM; add-on: guest messaging (SMS)                                                                                                             | Right             | None.                                                                                                                     |
| Lighthouse                     | Rate shopping                                                             | Channel manager and booking engine (both for small independents), dynamic pricing, rate shopping; add-on: PMS, guest messaging, upsell         | Right, incomplete | **Add channel manager, booking engine and dynamic pricing.**                                                              |
| Little Hotelier                | PMS                                                                       | PMS, channel manager, booking engine, rate shopping (Pro plan), upsell (booking extras); add-on: dynamic pricing, guest messaging              | Right, incomplete | **Add channel manager and booking engine** (every plan).                                                                  |
| Lodgify                        | Channel manager, booking engine                                           | PMS, channel manager, booking engine, dynamic pricing (top plans, powered by Beyond), guest messaging, upsell (booking extras)                 | Right, incomplete | **Add PMS and guest messaging.**                                                                                          |
| Mailchimp                      | CRM                                                                       | CRM; add-on: guest messaging (SMS, replies only)                                                                                               | Right             | None.                                                                                                                     |
| Mews                           | PMS, booking engine, CRM, guest messaging, upsell                         | PMS, channel manager, booking engine, dynamic pricing, rate shopping (inside its RMS), guest messaging, upsell                                 | **Wrong**         | **Drop CRM. Add channel manager and dynamic pricing.**                                                                    |
| Newbook                        | PMS                                                                       | PMS, channel manager, booking engine, dynamic pricing, CRM (basic), guest messaging, upsell                                                    | Right, incomplete | **Add channel manager and booking engine.** It is now Storable Newbook.                                                   |
| Nor1                           | Upsell                                                                    | Upsell                                                                                                                                         | Right             | None. Oracle owns it.                                                                                                     |
| Oaky                           | Upsell                                                                    | Upsell                                                                                                                                         | Right             | None for the box. It now goes by Oaky by Plusgrade.                                                                       |
| Oracle OPERA Cloud             | PMS                                                                       | PMS; add-on: channel manager, CRM, upsell                                                                                                      | Right, incomplete | **Add channel manager and upsell**, taught by their own names (OPERA Cloud Distribution, Nor1).                           |
| Plusgrade                      | Upsell                                                                    | Upsell                                                                                                                                         | Right             | None. It owns Oaky.                                                                                                       |
| PriceLabs                      | Dynamic pricing                                                           | Dynamic pricing, rate shopping                                                                                                                 | Right, incomplete | **Add rate shopping.**                                                                                                    |
| RateGain                       | Channel manager, rate shopping                                            | Channel manager, booking engine, rate shopping, upsell (inside its booking engine); add-on: CRM, guest messaging (both sold as Sojern)         | Right, incomplete | **Add booking engine** (UNO Booking Engine).                                                                              |
| Revinate                       | CRM                                                                       | CRM, upsell (as email campaigns); add-on: guest messaging                                                                                      | Right, incomplete | **Add guest messaging** (Revinate Chat).                                                                                  |
| RMS Cloud                      | PMS                                                                       | PMS, channel manager, booking engine, dynamic pricing (rules), guest messaging, upsell; add-on: CRM                                            | Right, incomplete | **Add channel manager and booking engine.** It is now branded "RMS".                                                      |
| RoomPriceGenie                 | Dynamic pricing                                                           | Dynamic pricing, rate shopping (it only feeds its own prices)                                                                                  | Right             | None.                                                                                                                     |
| Sabre SynXis                   | Booking engine                                                            | Channel manager, booking engine; add-on: upsell (all now sold by Aven Hospitality)                                                             | Right, incomplete | **Rename: SynXis, by Aven Hospitality (formerly Sabre), with Aven's logo. Add channel manager**, and upsell as an add-on. |
| SiteMinder                     | Channel manager, booking engine                                           | Channel manager, booking engine, rate shopping (Plus plan); add-on: dynamic pricing, guest messaging, upsell                                   | Right, incomplete | **Add rate shopping.** The game's round 3 needs fixing (section 4).                                                       |
| STAAH                          | Channel manager, booking engine                                           | Channel manager, booking engine, dynamic pricing, guest messaging (Booking.com inbox only); add-on: rate shopping                              | Right, incomplete | **Add dynamic pricing.**                                                                                                  |
| STR (CoStar)                   | Rate shopping                                                             | Rate shopping (the market-intelligence half only)                                                                                              | Right             | **Don't teach the box's job line for it**: it shows aggregated benchmarks, never a competitor's price.                    |
| UpsellGuru                     | Upsell                                                                    | Upsell                                                                                                                                         | Right             | None. The 2 Oct site warning is still open.                                                                               |
| WebRezPro                      | PMS, booking engine                                                       | PMS, booking engine, dynamic pricing (basic rules), upsell (booking extras)                                                                    | Right             | None.                                                                                                                     |
| Wheelhouse                     | Dynamic pricing                                                           | Dynamic pricing, rate shopping                                                                                                                 | Right, incomplete | **Add rate shopping.**                                                                                                    |
| Whistle                        | Guest messaging                                                           | Guest messaging, upsell                                                                                                                        | Right, incomplete | **Add upsell. Rename: it is now Cloudbeds Guest Experience.**                                                             |

**What matters most**

- **Two slide boxes are wrong, and both were double-checked.** Google isn't a rate shopper: it is
  metasearch, which none of the eight boxes covers. Mews isn't a CRM: it keeps guest profiles but
  leaves marketing to other companies' CRMs. The tools training teaches both today, because it shows
  the slides as they are.
- **Three names are out of date.** Sabre no longer owns SynXis (Aven Hospitality does), Atomize is now
  Mews RMS, and Whistle is now Cloudbeds Guest Experience. Section 5 has the other renames and owners.
- **The gap that matters most for an account manager**: six all-in-one rental and park systems sit
  under too few boxes. Hostaway is only under channel manager. Little Hotelier, Newbook and RMS Cloud
  are only under PMS. Guesty has no booking engine and Lodgify no PMS. Each of the six holds the
  bookings and runs the property's own "Book now" page.
- **The game.** The six clashes are settled in section 4. Round 3 still needs re-thinking: all three
  suites sell most of the eight jobs. Several cards in rounds 1 and 2 mark a right answer wrong, most
  clearly Lodgify (PMS), Newbook (booking engine) and Mews (channel manager, dynamic pricing) in round
  1, and GoHighLevel (guest messaging) and Whistle (upsell) in round 2.
- **The Mews icon is genuine.** Keep the pink tile (section 6).

## Where the slides are wrong

Two slide boxes are for jobs the vendor doesn't do. Both were checked twice, and both agents agreed.

### Google: not a rate shopper

- Google sells hotels visibility, not hotel software. Google Hotels is the search where travellers
  compare prices and click out to book. Properties appear there through Hotel Center, as paid Hotel
  Ads or free booking links. That is metasearch.
- Google has no tool that tracks what nearby properties charge. Hotel Center's one price report checks
  the property's own price against other sites selling the same room. It sits in a tab called "Free
  booking link price parity", and its first bucket reads "Only price shown: Your price was the only
  one shown for the itinerary." ([answer 10474165](https://support.google.com/hotelprices/answer/10474165))
- Its free market tools for hotels are offline. Hotel Insights has redirected elsewhere since 2024,
  and Destination Insights has been gone since late 2025.
- Since April 2026 a signed-in traveller can "track prices for individual hotels". That's a shopper's
  deal alert, not a rate shopper.
- HGM's own dictionary already files Google Hotel Ads under metasearch: "Google Hotel Ads, Tripadvisor,
  Trivago — rate comparison that passes traffic on to a booking channel."

**What to do:** take Google off slide 40. No other box fits, so either give it a metasearch label of
its own or drop it from the tools slides. The manifest can't hold a vendor with no box
(`vendor-icons.check.ts` fails on one), so in the data the fix is to remove Google from the manifest.

### Mews: not a CRM

- Mews keeps the data a CRM would use: "Understand your guests. Bring stay history, preferences and
  spend together into a single 360° guest profile."
  ([hotel-guest-management-software](https://www.mews.com/en/products/hotel-guest-management-software))
- But it sells no tool for marketing to past guests. Its own guide, "Hotel CRM: everything you need to
  know and the 15 best providers in 2027" (24 May 2026), lists 15 other companies' CRMs, leaves Mews
  off, and tells hotels to "connect Mews PMS to the CRM of your choice".
  ([blog/hotel-crm](https://www.mews.com/en/blog/hotel-crm))
- The 2 Oct check called this borderline. The verifier found the blog post, which settles it.

**What to do:** take CRM off Mews (slide 41). Add channel manager (slide 37) and dynamic pricing
(slide 39), which Mews now sells itself.

### Right box, but teach it with care

- **STR (CoStar)** fits only the market-intelligence half of its box: "No, STR reports aggregated data
  only." It never shows what one competitor charges and tracks no future prices. So the box's job
  line, "Watches what nearby properties charge, date by date", is wrong for STR. Teach it as
  benchmarking: how a hotel's occupancy, average rate and RevPAR compare with an anonymous group of
  competitors.
- **Amadeus**: the slides' rate shopping is Demand360, which is forward-looking market data ("View your
  forward-looking ADR and RevPAR rank compared to your competitive set for the next 30 and 90 days.").
  Amadeus' competitor price checker is RevenueStrategy360.
- **AirDNA and KeyData** track vacation-rental listings, not hotel rates. That's the right data for
  HGM's rental clients, and the wrong data for a hotel.

### Right box, out-of-date name

- **Sabre SynXis**: Sabre sold it. It is now SynXis, by Aven Hospitality, and the Sabre logo belongs to
  a company that no longer owns it.
- **Atomize**: now Mews RMS, powered by Atomize. atomize.com redirects to Mews.
- **Whistle**: now Cloudbeds Guest Experience, and not sold on its own.

## Where the slides leave something out

These are boxes a vendor sells as core, under its own name, that the slides leave out. Each rests on
one researcher's check, so give them a second look before they're taught (section 8 lists them).

Which of them matter is a judgment, not a finding. It's made from what HGM does: the booking engine is
the "Book now" page HGM's campaigns send people to, the CRM holds the list a campaign markets to, and
the PMS is where every booking lives.

### These matter for an account manager

| Tool            | What the slides leave out                                                     | Why it matters                                                                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hostaway        | PMS, booking engine, guest messaging, upsell                                  | It calls itself "a property management system and channel manager". Its booking website comes free with every subscription, and its Guest Book is where a client's past guests and marketing opt-ins live. |
| Guesty          | Booking engine, CRM                                                           | "The Guesty Booking Engine powers the checkout experience on your website." On a client's own site, "Book now" may be Guesty's checkout. Its CRM, in every plan, sends email campaigns.                    |
| Lodgify         | PMS, guest messaging                                                          | It calls itself the "#1 short-term rental PMS since 2012", so a Lodgify client's bookings and guest messages live there.                                                                                   |
| Little Hotelier | Channel manager, booking engine                                               | Both come with every plan, even the cheapest.                                                                                                                                                              |
| Newbook         | Channel manager, booking engine                                               | Both come with both packages. Newbook also sells parks their websites and managed ads (below).                                                                                                             |
| RMS Cloud       | Channel manager, booking engine                                               | Both are listed under "Includes as standard".                                                                                                                                                              |
| Lighthouse      | Dynamic pricing; channel manager and booking engine at small independents     | Its automated pricing is in every independent-hotel plan. A small hotel on its Plus or Complete plan gets its channel manager and "Book now" page from Lighthouse.                                         |
| Cendyn          | Booking engine, channel manager (through its CRS), dynamic pricing (Guestrev) | A Cendyn hotel's booking engine may be Cendyn's too.                                                                                                                                                       |
| RateGain        | Booking engine                                                                | RateGain now bundles its UNO Booking Engine into the "UNO Direct Stack".                                                                                                                                   |
| Enso Connect    | CRM                                                                           | Its base subscription keeps a profile for every guest, with stays and lifetime spend, and sends email, SMS or WhatsApp campaigns from it.                                                                  |
| Amadeus         | CRM (its Guest Management System)                                             | Guest profiles and email marketing for Amadeus hotels.                                                                                                                                                     |
| GoHighLevel     | Guest messaging                                                               | Every HighLevel account has two-way texting and website chat. HGM's own LeadConnector chat widget is this product.                                                                                         |

### Worth knowing, lower stakes

- **AirDNA**: dynamic pricing (Adapt, $20 per listing per month, since 1 Sep 2026).
- **Akia** and **Whistle**: upsell.
- **Beyond**, **PriceLabs** and **Wheelhouse**: rate shopping (comp sets and market data).
- **SiteMinder**: rate shopping (its Plus plan tracks up to 10 competitors).
- **STAAH**: dynamic pricing (rules in STAAH Max, and STAAH RMS).
- **Cloudbeds**: guest messaging (the former Whistle, in the Experience plan) and upsell (one-click
  upsells in the booking engine).
- **Mews**: channel manager and dynamic pricing (with the CRM fix above).
- **Sabre SynXis (Aven)**: channel manager (its OTA Distribution is sold as a "Hotel Channel
  Manager"). Aven sells to "enterprise chains to larger independent properties", so HGM will meet it
  less often.

### Sold, but best not taught under that box

- **HubSpot**: website chat, WhatsApp and SMS, but generic, not for hotels. Teach it as CRM only.
- **RoomPriceGenie**: it tracks 10 competitors and local Airbnbs, but only to set its own prices. Its
  help centre says it is "not comparing price to price".
- **GoHighLevel**: Rentals (24 Jun 2026), a booking page that shares availability only through iCal.
- **Revinate**: upsell offers, but as a type of email campaign, not a product.
- **RateGain**: upsells inside its booking engine.
- **Mews**: competitor-rate tracking (up to 5 competitors) inside Mews RMS.
- **Smaller built-in features** of the all-in-one systems: booking extras (Lodgify, Little Hotelier,
  WebRezPro), rule-based pricing (WebRezPro, RMS Cloud, Newbook), a guest inbox and upsells (Newbook,
  RMS Cloud), an inbox for Booking.com guests only (STAAH), a basic guest book (Hostaway, Newbook),
  and Lodgify's pricing, which Beyond powers.

### Paid add-ons the slides leave out

- **Akia**: CRM. This one matters: email and SMS marketing to past guests, which Akia promotes heavily.
- **Beyond**: booking engine (Signal, a branded booking website). This one matters too: a client's
  booking site may be a Signal site.
- **Amadeus**: channel manager (iHotelier Channel Manager, formerly OTA Sync) and pre-arrival upsells
  (in its Guest Management System).
- **Guesty**: dynamic pricing (PriceOptimizer), upsell (Guest App Upsells) and a limited competitor
  comparison.
- **Hostaway**: dynamic pricing.
- **IDeaS**: competitor-rate analytics (Rate Data Advantage), which works on top of a rate shopper.
- **Klaviyo** and **Mailchimp**: text messaging, built for marketing.
- **Lighthouse**: Reservation Management (it does a PMS's job, top plan only) and KITT, an AI
  receptionist that answers guests and upsells.
- **Little Hotelier**: dynamic pricing (Dynamic Revenue Plus), and guest messaging with pre-arrival
  upsell offers (Guest Engagement).
- **Oracle OPERA Cloud**: channel manager (OPERA Cloud Distribution), CRM (loyalty and marketing) and
  upsell (Nor1, which has its own card).
- **RateGain**: CRM and guest messaging, sold under the Sojern name.
- **Revinate**: guest messaging (Revinate Chat). The researcher suggests adding it.
- **RMS Cloud**: CRM (an email marketing module).
- **Sabre SynXis (Aven)**: upsell (Retailing).
- **SiteMinder**: dynamic pricing (Dynamic Revenue Plus), and guest messaging and upsell (Guest
  Engagement).
- **STAAH**: rate shopping (RateSTalk).
- **AirDNA**: Uplisting's PMS, channel manager, booking widget and messaging. Uplisting is sold under
  its own name, so file those jobs under Uplisting, not AirDNA.

### Outside the eight boxes, close to HGM's own work

- **Newbook** sells its own websites and a done-for-you digital marketing service: managed Google and
  Meta ads, with GA4, Tag Manager and Meta Pixel tracking. It sells this to the same parks HGM works
  with.
- **DerbySoft** sells metasearch, Google PPC and OTA-ad management.
- **Aven Hospitality** lists Digital Marketing and GDS Marketing among its services.
- **Lighthouse** sells website personalisation (Lighthouse Direct, from The Hotels Network).
- **Google**: its own third-party rates for hotel ads "will be unavailable after September 30, 2026".
  A property now needs its own price feed, through an integration partner or a Hotel Center account,
  to keep hotel ads running.

## The game

The game marks by the card list. `vendor-icons.check.ts` compares each card's accepted boxes (its box
plus `also`, or a suite's `does`) with the slides' boxes for that vendor. It compares whole sets, so a
box the round doesn't have still counts. It finds six clashes. They're settled first, then every card
is checked against the evidence.

One consequence for every fix below: a box added to the slides for a vendor that's in the game opens a
new clash, unless the card's `also` (or the suite's `does`) changes with it. Boxes from outside a round
can go in `also` without changing any mark. The RateGain card already does this: it lists channel
manager in round 2, which has no channel-manager box.

### The six clashes, settled

#### 1. Cloudbeds, round 3

- Only the slides say dynamic pricing, rate shopping and CRM. Only the game says guest messaging.
- Evidence: Cloudbeds sells all eight jobs. PMS, channel manager, booking engine, guest messaging and
  upsell come with its plans (guest messaging from the Experience plan). Dynamic pricing and rate
  shopping (Cloudbeds RMS, launched 15 Sep 2026) and CRM (Guest Marketing CRM) are paid add-ons.
- **Ruling: both lists are right about what they include. The game is wrong to use dynamic pricing,
  rate shopping, CRM and upsell as distractors**, because Cloudbeds sells every one.
- Fix: add guest messaging and upsell to the slides. No box is a true distractor for Cloudbeds, so
  this suite needs a different question (see "One rule for paid add-ons" below).

#### 2. SiteMinder, round 3

- Only the game says PMS.
- Evidence: the SiteMinder product connects to another company's PMS: "Already have a PMS or RMS
  solution? With over 350 reliable 2-way PMS and RMS connections, your systems will run in perfect
  sync, no matter which solution you use." The PMS is Little Hotelier, a separately branded product
  from the same company, SiteMinder Limited, with its own entry on slide 36.
- **Ruling: the slides are right. Take PMS out of SiteMinder's `does`**, or make it a distractor with
  a note that names Little Hotelier. This reverses the 2 Oct call, which asked only whether SiteMinder
  owns Little Hotelier. It does, but a client "on SiteMinder" keeps its reservations in another PMS.
  The ruling is a judgment, made on one researcher's check.
- Also: three of its four distractors are paid add-ons it sells (dynamic pricing through Dynamic
  Revenue Plus; guest messaging and upsell through Guest Engagement). Only CRM holds. Rate shopping,
  which comes with the SiteMinder Plus plan, is in neither list.

#### 3. Mews, round 3

- Only the slides say CRM, guest messaging and upsell.
- Evidence (checked twice): Mews sells no CRM; its own guide sends hotels to other companies' CRMs. It
  does sell upsells, guest messaging (since 1 Oct 2026), a channel manager (powered by SiteMinder,
  since 27 May 2026) and dynamic pricing (Mews RMS, the former Atomize).
- **Ruling: the slides are right on guest messaging and upsell, and wrong on CRM. The game is right
  that CRM is a distractor, and wrong on channel manager, dynamic pricing and upsell.** Its note, "The
  channel manager and the pricing come from somewhere else", is false today.
- Fix: `does` = PMS, booking engine, channel manager, dynamic pricing, guest messaging, upsell.
  Distractor = CRM. Don't use rate shopping as a distractor: Mews RMS tracks up to 5 competitors'
  rates. The verifier's warning: with one distractor left, this round is close to a giveaway.

#### 4. Mews, round 1

- Only the slides say CRM, guest messaging and upsell.
- Evidence: the card's PMS and booking engine are right. Round 1 has no CRM, guest messaging or upsell
  box, so those three change no marks. But round 1 does have channel manager and dynamic pricing, and
  Mews sells both, so the card marks two right answers wrong.
- **Ruling: the game's answers are right but incomplete. The slides are wrong on CRM.**
- Fix: add channel manager and dynamic pricing to the card's `also`, and to the slides. Listing guest
  messaging and upsell in `also` too would quiet the check without changing a mark. The alternative
  both agents give: accept PMS only, and say in the note that it's Mews' main product.

#### 5. Newbook, round 1

- Only the game says channel manager.
- Evidence: "Our Channel Manager is an integral part of the software", in both of Newbook's packages.
- **Ruling: the game is right. The slides leave it out.**
- Fix: add channel manager and booking engine to the slides. Add booking engine to the card's `also`:
  Newbook's "Online Booking System" is in both packages, so a booking-engine answer is now marked wrong
  though it's true. Its pricing is built in too (occupancy rules), so accept dynamic pricing as well,
  or at least don't count it as a mistake.

#### 6. Amadeus iHotelier, round 1

- Only the slides say rate shopping.
- Evidence: iHotelier is the booking engine. The slides' rate shopping is Demand360, a different
  Amadeus product with no card in the game. The manifest gives both deck cards one entry, which is
  where the clash comes from.
- **Ruling: both are right.** No mark changes, because round 1 has no rate-shopping box.
- To quiet the check, the manifest would need iHotelier and Demand360 as two entries sharing the
  icon. Separately, Amadeus sells iHotelier Channel Manager (formerly OTA Sync) for an extra fee.
  Whether a channel-manager answer counts depends on the add-on rule below; the 2 Oct check
  recommended accepting it.

### Every card, round by round

**Round 1, "The four systems"** (PMS, channel manager, booking engine, dynamic pricing)

| Card               | The game accepts                     | Supported                             | Marked wrong, though it sells it                                             | The note                                                              |
| ------------------ | ------------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Mews               | PMS; also booking engine             | Both                                  | **Channel manager, dynamic pricing**                                         | **Out of date**: it undersells Mews                                   |
| Oracle OPERA Cloud | PMS                                  | Yes                                   | Channel manager, as a paid add-on (keep PMS only, as the researcher advises) | **Half wrong**: Hyatt chose it, but IHG only approved it as an option |
| Newbook            | PMS; also channel manager            | Both                                  | **Booking engine**; dynamic pricing (built-in rules)                         | Accurate; add its own booking engine and the name Storable Newbook    |
| SiteMinder         | Channel manager; also booking engine | Both                                  | Dynamic pricing, as a paid add-on                                            | Accurate                                                              |
| STAAH              | Channel manager; also booking engine | Both                                  | Dynamic pricing (rules in STAAH Max, and STAAH RMS)                          | Too narrow: it sells to hotel groups and vacation rentals too         |
| DerbySoft          | Channel manager                      | Yes                                   | None (dynamic pricing unclear)                                               | Too narrow: Property Connector is for independents                    |
| Sabre SynXis       | Booking engine                       | Yes, but **Sabre no longer sells it** | Channel manager (Aven's "Hotel Channel Manager")                             | **Wrong on ownership**                                                |
| Amadeus iHotelier  | Booking engine                       | Yes                                   | Channel manager, as a paid add-on                                            | Accurate but narrow                                                   |
| Lodgify            | Booking engine; also channel manager | Both                                  | **PMS**; dynamic pricing (top plans, powered by Beyond)                      | **Wrong framing**: it is rental software, not a website               |
| Wheelhouse         | Dynamic pricing                      | Yes                                   | None                                                                         | Accurate                                                              |
| PriceLabs          | Dynamic pricing                      | Yes                                   | None                                                                         | Accurate but thin: it now sells to hotels and campgrounds too         |
| IDeaS              | Dynamic pricing                      | Yes                                   | None                                                                         | Half right: it sells to independents and campgrounds too              |

Lodgify: channel manager is arguably the safer main answer. It's in every plan, while the cheapest
plan has no website.

**Round 2, "Around the guest and the market"** (rate shopping, CRM, guest messaging, upsell)

| Card                | The game accepts                    | Supported | Marked wrong, though it sells it                                              | The note                                                               |
| ------------------- | ----------------------------------- | --------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Lighthouse          | Rate shopping                       | Yes       | Guest messaging and upsell through KITT, a paid side product (leave them out) | Accurate                                                               |
| RateGain            | Rate shopping; also channel manager | Both      | Upsell, inside its booking engine (the researcher says keep it wrong)         | Accurate; could name the booking engine                                |
| AirDNA              | Rate shopping                       | Yes       | None                                                                          | Accurate                                                               |
| Revinate            | CRM                                 | Yes       | Guest messaging (Revinate Chat, sold separately)                              | Accurate                                                               |
| Cendyn              | CRM                                 | Yes       | Guest messaging: unclear (section 7)                                          | Thin                                                                   |
| GoHighLevel         | CRM                                 | Yes       | **Guest messaging** (every account)                                           | Accurate; keep its second sentence                                     |
| Duve                | Guest messaging; also upsell        | Both      | None                                                                          | Narrow: messaging and upsells are only on its higher plans             |
| Canary Technologies | Guest messaging; also upsell        | Both      | None                                                                          | Slightly off: upsells are a separate product                           |
| Whistle             | Guest messaging                     | Yes       | **Upsell** (its upsell store)                                                 | **Out of date**: it is now Cloudbeds Guest Experience                  |
| Oaky                | Upsell                              | Yes       | None                                                                          | **Overstates**: it isn't "still sold as Oaky" but as Oaky by Plusgrade |
| Nor1                | Upsell                              | Yes       | None                                                                          | Accurate; OPERA is its main pairing, not its only one                  |
| UpsellGuru          | Upsell                              | Yes       | None                                                                          | Accurate                                                               |

If the slides add guest messaging for Revinate, accept it on this card too, or the check reports a new
clash.

**Round 3, "One suite, many jobs"**

| Suite      | Its `does`                                                                  | Distractors that hold | Distractors it sells                                          | Sold, but in neither list                                                |
| ---------- | --------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Cloudbeds  | PMS, channel manager, booking engine, guest messaging: all right            | None                  | **Dynamic pricing, rate shopping, CRM** (add-ons), **upsell** | None                                                                     |
| Mews       | PMS, booking engine: right                                                  | CRM                   | **Channel manager, dynamic pricing, upsell**                  | **Guest messaging** (and rate tracking, which shouldn't be a distractor) |
| SiteMinder | Channel manager, booking engine: right. **PMS: no**, it's Little Hotelier's | CRM                   | **Dynamic pricing, guest messaging, upsell** (add-ons)        | Rate shopping (Plus plan)                                                |

The three notes: Cloudbeds' "Sold as one suite" overstates it, since it sells plans plus add-ons, but
its closing "Ask" is right. Mews' second sentence is false. SiteMinder's "a small-property PMS through
Little Hotelier" is true of the company, not of the product.

### One rule for paid add-ons

The researchers kept core and add-on apart for every box. The game doesn't yet: Cloudbeds' slides
count its paid add-ons, while round 3 treats the same add-ons as jobs it doesn't do. Pick one rule and
use it everywhere:

- **A paid add-on counts.** Simple, and true to what vendors sell. But round 3 then has almost nothing
  to sort: Cloudbeds has no distractor left, and Mews and SiteMinder have only CRM.
- **Only the base plan counts.** Then the add-ons become the lesson in the note ("Cloudbeds sells
  pricing and a CRM too, as paid add-ons, so ask what they've switched on"). This is option 1 in the
  2 Oct report.

The 2 Oct report's other options still stand: swap in suites with a narrow scope, or ship rounds 1
and 2 without round 3. Today's evidence makes round 3 harder to keep as it is. Mews' guest messaging,
launched 1 Oct 2026, is a sixth job for that suite.

### Notes to rewrite

The researchers' wording unless marked "drafted here".

- **Mews, round 1** (the verifier's): "Mews' main product is its PMS. It now sells most of the stack
  itself: booking engine, upsells, revenue management (it bought Atomize in 2024), a channel manager
  powered by SiteMinder (May 2026) and guest messaging (October 2026). CRM still comes from partners."
- **Mews, round 3**: drop "The channel manager and the pricing come from somewhere else". The round 1
  wording works here too.
- **Cloudbeds, round 3** (drafted here): "Sold in plans, plus paid add-ons: the PMS in every plan,
  channel manager and booking engine from the One plan, guest messaging from Experience, and pricing,
  rate tracking and a CRM as add-ons. So 'we're on Cloudbeds' still doesn't tell you what they use it
  for. Ask."
- **SiteMinder, round 3**: "A channel manager that also sells a booking engine and competitor-rate
  insights, with paid add-ons for pricing (Dynamic Revenue Plus) and for guest messaging and upsells
  (Guest Engagement). Its PMS for small properties is a separate product, Little Hotelier."
- **Sabre SynXis** (renamed "SynXis, by Aven Hospitality (formerly Sabre)"): "Aven Hospitality's
  booking engine (formerly Sabre), sitting on its SynXis central reservation system."
- **Oracle OPERA Cloud**: "The PMS Hyatt chose for its hotels worldwide, and one of the PMS options IHG
  approves for its hotels. Worth recognising at a resort that came from a brand."
- **Lodgify**: "Vacation-rental software (PMS): syncs Airbnb, Vrbo and Booking.com, runs the
  property's own booking website, and puts guest messages in one inbox."
- **Newbook** (drafted here): "From the campground and holiday-park world, where many glamping stacks
  start. Now Storable Newbook, with its own channel manager and booking engine built in."
- **DerbySoft**: "Connects hotels to 500+ OTAs and other channels: chains through their reservation
  system, independents through Property Connector."
- **STAAH** (drafted here): "A channel manager (STAAH Max) for independents, hotel groups and vacation
  rentals; it also sells its own booking engine (SwiftBook)."
- **IDeaS**: "A hotel revenue-management system (RMS) that sets room prices automatically: best known
  with chains, but also sold to independents, resorts and campgrounds."
- **Whistle**: "Bought by Cloudbeds in 2022; now sold as Cloudbeds Guest Experience."
- **Oaky**: "Now owned by Plusgrade and sold as Oaky by Plusgrade; Plusgrade plans to fold it into one
  upsell suite."
- **Canary Technologies**: "Texts with guests and sells them upgrades and extras; also does mobile
  check-in."
- **Duve**: "A guest app and online check-in platform with a messaging inbox and upsells built in."
- **Cendyn**: "A hotel CRM; it also sells a booking engine, central reservations and revenue
  management."
- **RateGain**: "Sells rate shopping (Navigator) plus the UNO channel manager and booking engine; owns
  Sojern since 2025."
- Optional: AirDNA (mention Adapt), PriceLabs (mention hotels and campgrounds).

### Verify flags and sources

In this repo's copy of the card list, seven entries still carry `verify: true`, so the game won't play:
DerbySoft, Amadeus iHotelier and Lodgify (round 1), AirDNA, GoHighLevel and UpsellGuru (round 2), and
the SiteMinder suite (round 3). Each now has evidence from the vendor's own site:

- DerbySoft: https://www.derbysoft.com/property-connector/
- Amadeus iHotelier: https://www.amadeus-hospitality.com/solutions/reservations-and-guest-management/ihotelier-booking-engine/
- Lodgify: https://www.lodgify.com/ and https://www.lodgify.com/vacation-rental-channel-manager/
- AirDNA: https://www.airdna.co/property-manager and https://www.airdna.co/short-term-rental-comps
  (the researcher's choice; set `checked` to 2026-10-05)
- GoHighLevel: https://www.gohighlevel.com/crm
- UpsellGuru: https://upsellguru.com/pre-arrival-upselling/, only if sources are never shown to
  players (the 2 Oct site warning is still open)
- SiteMinder suite: fix its `does` first. https://www.siteminder.com/channel-manager/ also shows its
  PMS connections.

Cards that cite a third party or a stale page, with the vendor's own page to use instead:

- Sabre SynXis (a Sabre investor release): https://www.avenhospitality.com/solutions/booking-engine
- Wheelhouse (hoteltechreport.com): https://www.usewheelhouse.com/pricing
- PriceLabs (hoteltechreport.com): https://hello.pricelabs.co/dynamic-pricing/
- IDeaS (epic-rev.com): https://ideas.com/revenue-management-for-hospitality/
- Lighthouse (hospitalitynet.org): Lighthouse's own copy of the same release,
  https://www.mylighthouse.com/resources/blog/ota-insight-rebrands-as-lighthouse-to-illuminate-new-capabilities-and-launch-of-a-unified-commercial-platform
- RateGain (hoteltechreport.com): https://rategain.com/hotels/rate-intelligence/
- Revinate (hoteltechreport.com): https://www.revinate.com/hotel-software/cdp/
- Whistle and the Cloudbeds suite (phocuswire.com): https://www.cloudbeds.com/guest-engagement-software/
- Oaky (oaky.com, now one frozen page, and hoteltechnologynews.com): no stable page of its own turned
  up in this check.

## Names and owners

| Tool                         | Call it now                                             | Owner or parent                                                                                 | Worth knowing                                                                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AirDNA                       | AirDNA                                                  | AirDNA, LLC; backed by Alpine Investors since 2022                                              | Its FAQ says it is "independent and not owned by Airbnb". It owns Uplisting (2024) and Arrivalist (2023).                                                                                                                         |
| Amadeus iHotelier, Demand360 | Same                                                    | Amadeus Hospitality; both came with TravelClick (2018)                                          | The iHotelier admin login is still portal.travelclick.com. Rate360 is now RevenueStrategy360, and OTA Sync is now iHotelier Channel Manager. Amadeus no longer sells a PMS.                                                       |
| Atomize                      | Mews RMS, powered by Atomize                            | Mews (Nov 2024)                                                                                 | atomize.com redirects to Mews.                                                                                                                                                                                                    |
| Beyond                       | Beyond                                                  | No parent named                                                                                 | Formerly Beyond Pricing; the site is still beyondpricing.com. Its channel manager, Relay, is gone.                                                                                                                                |
| Canary Technologies          | Same                                                    | No parent named                                                                                 | Calls itself a "Guest Management System" and "#1 Hospitality Management System". Neither means PMS. Bought OpenKey's assets (mobile keys) in Feb 2026.                                                                            |
| Cendyn                       | Same                                                    | Backed by Accel-KKR and Haveli Investments                                                      | Its CRS came from Pegasus (2022), Guestrev from Rainmaker (2019) and Knowland in 2024. Older pages call the CRM "eInsight CRM".                                                                                                   |
| Cloudbeds                    | Same                                                    | No parent named                                                                                 | Whistle is now Cloudbeds Guest Experience. Its pricing tool went from PIE to Revenue Intelligence to Cloudbeds RMS (15 Sep 2026); PIE help articles are still online.                                                             |
| DerbySoft                    | Same                                                    | Majority-owned by Juniper Group (Vela Software, part of Constellation Software) since June 2026 | Still run as DerbySoft. Property Connector is its channel manager for independents.                                                                                                                                               |
| Duetto                       | Same                                                    | GrowthCurve (2024)                                                                              | Owns HotStats (2025) and MiceRate (2024). Its pricing engine is GameChanger.                                                                                                                                                      |
| GoHighLevel                  | HighLevel                                               | HighLevel LLC, "a subsidiary of GoHighLevel Inc."                                               | "LeadConnector" on a site, phone or app means HighLevel. "High Level Software" is an unrelated channel manager.                                                                                                                   |
| Google                       | Google Hotels; Hotel Center                             | Google                                                                                          | Hotel ads lose Google's own third-party rates after 30 Sep 2026 (section 3).                                                                                                                                                      |
| Guesty                       | Same                                                    | Investor-backed (KKR, Apax Digital and others)                                                  | Plans: Lite, Pro, Enterprise. Bought Rentals United (2024) and Smily, formerly BookingSync (Sep 2026). AirDNA's Adapt plugs into it.                                                                                              |
| Hostaway                     | Same                                                    | Investor-backed (General Atlantic, PSG)                                                         | Valued at $1B (Oct 2025). Builds everything in-house.                                                                                                                                                                             |
| HubSpot                      | Same; its CRM is "Smart CRM"                            | Public company (NYSE: HUBS)                                                                     | "Revenue Hub" (formerly Commerce Hub) is billing, not revenue management.                                                                                                                                                         |
| IDeaS                        | IDeaS G3 RMS                                            | SAS (since 2008)                                                                                | Spelled "IDeaS". The manifest's note says "IDeAS".                                                                                                                                                                                |
| KeyData                      | KeyData                                                 | KeyData Dashboard, Inc.                                                                         | Formerly Key Data Dashboard; the old domain redirects. Pamlico Capital lists it as a 2024 investment (on Pamlico's site, not KeyData's).                                                                                          |
| Kipsu                        | Kipsu Engage FCX (the messaging product)                | No parent named                                                                                 | Bought Lodgistics (Apr 2025), now Kipsu Exceed FCX.                                                                                                                                                                               |
| Klaviyo                      | Same                                                    | Public company (NYSE: KVYO)                                                                     | Now calls itself "the autonomous B2C CRM".                                                                                                                                                                                        |
| Lighthouse                   | Same                                                    | KKR led a growth investment (Nov 2024)                                                          | Formerly OTA Insight, until 9 Nov 2023. Bought Stardekk and Cubilis (2024), HQ revenue (2024), The Hotels Network (2025) and Hotelrank.ai (2026). Old product names such as Rate Insight and Parity Insight redirect to new ones. |
| Little Hotelier              | Same                                                    | SiteMinder Limited                                                                              | A separate product from SiteMinder itself. Relaunched as an "all-new Little Hotelier" on 1 Oct 2025.                                                                                                                              |
| Lodgify                      | Same                                                    | No parent named                                                                                 | New logo since 12 May 2026. Its dynamic pricing is powered by Beyond Pricing.                                                                                                                                                     |
| Mailchimp                    | Intuit Mailchimp                                        | Intuit (2021)                                                                                   | Mandrill is now Mailchimp Transactional.                                                                                                                                                                                          |
| Mews                         | Same; pitched as "Mews OS"                              | No parent named                                                                                 | Bought Atomize (2024), and Flexkeeping, Clarity and DataChat (2025). Its channel manager is a partnership with SiteMinder, not a purchase.                                                                                        |
| Newbook                      | Storable Newbook                                        | Storable (May 2024)                                                                             | Renamed in Nov 2025, as part of Storable RV & Camping. The site is still newbook.cloud.                                                                                                                                           |
| Nor1                         | OPERA Cloud Guest Engagement and Merchandising          | Oracle (deal announced 18 Nov 2020)                                                             | nor1.com redirects to Oracle. "Nor1" is still fair to teach, as Oracle's upsell product.                                                                                                                                          |
| Oaky                         | Oaky by Plusgrade                                       | Plusgrade (Oct 2025)                                                                            | Plusgrade plans to merge it into one upsell suite, so the name may change again.                                                                                                                                                  |
| Oracle OPERA Cloud           | Same                                                    | Oracle Hospitality                                                                              | Older hotels may still run OPERA 5. Wyndham has more than 2,100 properties on OPERA Cloud.                                                                                                                                        |
| Plusgrade                    | Same                                                    | Investors include General Atlantic and CDPQ (per CDPQ, not Plusgrade)                           | Owns Oaky, UpStay ("UpStay, now Plusgrade Hospitality") and Points. Plusgrade and Oaky are now one company.                                                                                                                       |
| RateGain                     | Same: UNO for distribution, Navigator for rate shopping | Listed in India                                                                                 | Owns Sojern (Nov 2025, still sold under its own name) and Adara.                                                                                                                                                                  |
| Revinate                     | Same                                                    | No parent named                                                                                 | "Ivy" now means its AI layer (16 Jun 2026); its guest messaging is Revinate Chat. NAVIS is now Revinate Reservation Sales.                                                                                                        |
| RMS Cloud                    | RMS                                                     | Advent Partners invested (Feb 2024)                                                             | In hotel tech "RMS" usually means revenue management system. This RMS is a PMS.                                                                                                                                                   |
| Sabre SynXis                 | SynXis, by Aven Hospitality                             | TPG (Jul 2025)                                                                                  | Renamed Aven Hospitality on 27 Jan 2026. Sabre is now just one of the GDSs Aven connects to.                                                                                                                                      |
| SiteMinder                   | Same                                                    | SiteMinder Limited (ASX: SDR)                                                                   | Also sells Little Hotelier. Its booking engine was TheBookingButton; Guest Engagement came from GuestJoy.                                                                                                                         |
| STAAH                        | STAAH, an Access company                                | The Access Group (Dec 2024)                                                                     | A sister business to SHR. Products: STAAH Max, SwiftBook, STAAH RMS.                                                                                                                                                              |
| STR                          | CoStar with STR Benchmark                               | CoStar Group (2019)                                                                             | str.com redirects to CoStar. With vacation-rental clients, "STR" usually means short-term rental.                                                                                                                                 |
| WebRezPro                    | Same                                                    | World Web Technologies Inc. (Calgary)                                                           | "Pulse – AI Guest Marketing" sits in its menu, but Pulse is a separate company.                                                                                                                                                   |
| Wheelhouse                   | Same                                                    | No parent named                                                                                 | Search for "usewheelhouse": other companies share the name. Its CEO founded Beyond Pricing.                                                                                                                                       |
| Whistle                      | Cloudbeds Guest Experience                              | Cloudbeds (Jun 2022)                                                                            | whistle.com now lands on a pet GPS tracker.                                                                                                                                                                                       |

No rename, sale or parent company turned up for Akia, Duve, Enso Connect, PriceLabs, RoomPriceGenie or
UpsellGuru. That is an absence of evidence, not a check of company filings. Duve bought Easyway (2024)
and raised a $60M Series B (Feb 2026). RoomPriceGenie took a $75M investment from Five Elms Capital
(Feb 2025).

## The Mews icon

Both agents agree: **the pink tile is genuine and current. Keep it.** The manifest's note ("not seen
on Mews' own site") is wrong, so Mews can be marked identified.

- On mews.com the pink tile is the site icon (`/favicon.svg`): a rounded square in #FF83DA with a black
  mark of three joined vertical ellipses, small to large from left to right. It also appears as a
  28 px badge (alt text "Mews Icon (Pink)") beside "Hospitality Management System" in the homepage
  hero.
- The bare black mark sits in the pink announcement bar for the new channel manager. It is white on
  black in the footer, and the share image is pink with the black mark.
- The header logo is a black "MEWS" wordmark in wide capitals. Of Mews' four apps, only Mews Events
  uses the pink tile. The staff app, Mews Operations, is black with the white wordmark; Mews Kiosk is
  slate with the wordmark and a "KIOSK" badge; Mews Digital Key is black with a white key.
- So account managers will see the black wordmark at least as often as the pink tile.
- One detail is unconfirmed. The researcher saw a pink "Ask Belle" chat button with the mark; the
  verifier found no such button in the page source. It is probably loaded by a script.

Other icons the evidence touches:

- **Sabre**: the tile is Sabre's red mark (#CE301A), which now belongs to Sabre Corporation, the GDS
  company that no longer owns SynXis. Aven's own logo is a charcoal "AVEN" wordmark with an accent
  stroke over the A, above "HOSPITALITY" in spaced capitals. Light and dark PNG and SVG versions are at
  avenhospitality.com/media-kit.
- **Newbook**: the Storable hexagon matches what Newbook shows today. It is the site's browser icon,
  and the header reads "Storable RV & Camping" in the US and "Storable | Newbook" in Australia, New
  Zealand and the UK.
- **STR**: str.com lands on a CoStar page that shows only the CoStar logo, so the CoStar mark is right.
- **Oaky**: oaky.com shows an orange tile with the same "Oaky" script as the kit, now with "by
  Plusgrade" underneath.
- **Lodgify**: the tile has the new May 2026 mark, but the kit's yellow (#FCF675) is paler than the
  site's (#EEE427).
- **Atomize**: the kit cropped an "A Mews company" tagline. The product is now sold as Mews RMS.

## Not settled

### Where the agents disagreed

Nowhere. Both second checks (Google and Mews) agreed with the researcher on every box and on the
verdict. They corrected citations and framing:

- **Google.** Cite answer 14919056 for the end of Business Profile chat; the cited 14919062 redirects
  there. Hotel Insights went in 2024 (it redirected to Destination Insights by 17 May 2024); only
  Destination Insights went offline between Sep and Nov 2025. That Hotel Center's comparison with
  "similar hotels" uses impressions, clicks and click-through rate rather than competitors' rates is
  the researcher's inference, though none of the 135 Hotel Center Help articles mentions competitor
  rates. Google Ads' Insights page is live market data, but about search demand, not prices. Book on
  Google for hotels closed on 25 May 2022 (from Hospitality Net, a third party).
- **Mews.** Mews owns Flexkeeping ("Flexkeeping joined Mews" in September 2025); it isn't an outside
  partner. Channel manager, pricing and guest messaging are proven for the Mews Pro plan only. The
  pricing page lists no features for Mews Core, so a Core customer may get less or pay extra. Upsell
  is slightly overstated: bookable services are add-ons, and automatic offers need Automations (Pro
  only, or an add-on). Booking-engine and kiosk upgrades still make it core.

### Where the vendor's own site couldn't be fully read

- **Cendyn.** cendyn.com blocked automated reading, so everything comes from Internet Archive copies:
  its menu as of 4 Oct 2026, and product pages from Dec 2024 to Dec 2025. Guest messaging is unclear.
  The Dec 2025 CRM page sells marketing and transactional email and SMS, but a March 2025 version
  claimed "two-way communication through email, SMS, WhatsApp". Check the live page in a browser
  before teaching it either way.
- **Oaky.** oaky.com is one frozen page, so several boxes rest on archive copies from May to July 2026.
  Plusgrade's demo form returned 403, so it's unknown whether new hotels are still sold the product
  under the Oaky name.
- **UpsellGuru.** Read with WebFetch only, which strips scripts. The 2 Oct warning (a hidden, scrambled
  script on every page) is neither confirmed nor cleared. Keep the site's link away from players until
  someone checks it in a browser.
- **Google.** One cited page is gone: answer 14280291, the dictionary's source for Hotel Ads, now says
  "This page doesn't exist in Google Ads Help." Fix that link in the dictionary's master.

### Open points inside a single check

- **DerbySoft**: a Sept 2024 DerbySoft blog post claims built-in dynamic pricing. No current product
  page backs it, so it's left out.
- **Little Hotelier**: its pricing table shows Dynamic Revenue Plus as unavailable on the Basics plan,
  but the Dynamic Revenue Plus page says it "can be added onto any existing Little Hotelier plan".
- **AirDNA**: its pricing FAQ still describes a "Host" plan that bundles Uplisting, but the plan cards
  don't show one.
- **Atomize**: whether a hotel outside Mews can still buy it new isn't stated.
- **STAAH**: the researcher infers that STAAH RMS is The Access Group's RMS sold under the STAAH name,
  because their help articles are almost word for word the same. Nothing states it.
- **Klaviyo**: its deal for the team and technology of Agency, an AI start-up (announced 5 Aug 2026),
  was due to close in Q3 2026. The close isn't confirmed.

### Where this check and the 2 Oct check differ

- **SiteMinder's PMS (round 3).** 2 Oct kept PMS in its `does`, because Little Hotelier belongs to
  SiteMinder Limited. Today's researcher recommends taking it out, because the SiteMinder product
  connects to another company's PMS. Both checks agree on the facts; they differ on what the card
  should teach. This report sides with the slides (section 4), on one researcher's check.
- **Mews' CRM.** 2 Oct called it borderline. Today it is settled as partner-only, checked twice, on
  Mews' own CRM guide.
- **The Mews channel manager's date.** 2 Oct found it "officially live since 19 Aug 2026". Today both
  agents date the launch to 27 May 2026. Mews sells it today either way.

## Suggested boxes

One list per vendor: the researcher's, or for Google and Mews, the boxes researcher and verifier agree
on (they agree on both). The ids are the card list's, in slide order.

```json
{
    "airdna": ["dynamic-pricing", "rate-shopping"],
    "akia": ["crm", "guest-messaging", "upsell"],
    "amadeus": ["booking-engine", "rate-shopping", "crm"],
    "atomize": ["dynamic-pricing"],
    "beyond": ["dynamic-pricing", "rate-shopping"],
    "canary": ["guest-messaging", "upsell"],
    "cendyn": ["channel-manager", "booking-engine", "dynamic-pricing", "crm"],
    "cloudbeds": ["pms", "channel-manager", "booking-engine", "dynamic-pricing", "rate-shopping", "crm", "guest-messaging", "upsell"],
    "derbysoft": ["channel-manager"],
    "duetto": ["dynamic-pricing"],
    "duve": ["guest-messaging", "upsell"],
    "enso": ["crm", "guest-messaging", "upsell"],
    "gohighlevel": ["crm", "guest-messaging"],
    "google": [],
    "guesty": ["pms", "channel-manager", "booking-engine", "crm", "guest-messaging"],
    "hostaway": ["pms", "channel-manager", "booking-engine", "dynamic-pricing", "guest-messaging", "upsell"],
    "hubspot": ["crm"],
    "ideas": ["dynamic-pricing"],
    "keydata": ["rate-shopping"],
    "kipsu": ["guest-messaging"],
    "klaviyo": ["crm"],
    "lighthouse": ["channel-manager", "booking-engine", "dynamic-pricing", "rate-shopping"],
    "littlehotelier": ["pms", "channel-manager", "booking-engine"],
    "lodgify": ["pms", "channel-manager", "booking-engine", "guest-messaging"],
    "mailchimp": ["crm"],
    "mews": ["pms", "channel-manager", "booking-engine", "dynamic-pricing", "guest-messaging", "upsell"],
    "newbook": ["pms", "channel-manager", "booking-engine"],
    "nor1": ["upsell"],
    "oaky": ["upsell"],
    "oracle": ["pms", "channel-manager", "upsell"],
    "plusgrade": ["upsell"],
    "pricelabs": ["dynamic-pricing", "rate-shopping"],
    "rategain": ["channel-manager", "booking-engine", "rate-shopping"],
    "revinate": ["crm", "guest-messaging"],
    "rmscloud": ["pms", "channel-manager", "booking-engine"],
    "roompricegenie": ["dynamic-pricing"],
    "sabre": ["channel-manager", "booking-engine", "upsell"],
    "siteminder": ["channel-manager", "booking-engine", "rate-shopping"],
    "staah": ["channel-manager", "booking-engine", "dynamic-pricing"],
    "str": ["rate-shopping"],
    "upsellguru": ["upsell"],
    "webrezpro": ["pms", "booking-engine"],
    "wheelhouse": ["dynamic-pricing", "rate-shopping"],
    "whistle": ["guest-messaging", "upsell"]
}
```

Google's empty list means none of the eight boxes. The manifest can't hold that as it stands
(`vendor-icons.check.ts` fails on a vendor with no box), so in the data it means removing Google.

Checked twice: Mews gains channel manager and dynamic pricing and loses CRM, and Google loses rate
shopping.

**Worth a second look before they're taught.** These additions rest on one researcher's check. Paid
add-ons are marked, since a base-plan-only rule would leave them off.

- AirDNA: dynamic pricing
- Akia: upsell; CRM (add-on)
- Amadeus: CRM
- Beyond: rate shopping
- Cendyn: channel manager, booking engine, dynamic pricing
- Cloudbeds: guest messaging, upsell
- Enso Connect: CRM
- GoHighLevel: guest messaging
- Guesty: booking engine, CRM
- Hostaway: PMS, booking engine, guest messaging, upsell; dynamic pricing (add-on)
- Lighthouse: channel manager, booking engine, dynamic pricing
- Little Hotelier: channel manager, booking engine
- Lodgify: PMS, guest messaging
- Newbook: channel manager, booking engine
- Oracle OPERA Cloud: channel manager (add-on), upsell (add-on, as Nor1)
- PriceLabs: rate shopping
- RateGain: booking engine
- Revinate: guest messaging (add-on)
- RMS Cloud: channel manager, booking engine
- Sabre SynXis: channel manager; upsell (add-on)
- SiteMinder: rate shopping
- STAAH: dynamic pricing
- Wheelhouse: rate shopping
- Whistle: upsell

Look first at the ones that change what an account manager is told about a client's "Book now" page:
Hostaway, Guesty, Little Hotelier, Newbook, RMS Cloud, Lighthouse, Cendyn and RateGain.

## The evidence, vendor by vendor

Quotes are from the vendors' own pages as the researchers fetched them for this check. Where a page
was read from an archive copy, the link says so. Pages of an owner or buyer count as the vendor's own
where the vendor's site now redirects there (Atomize to Mews, Whistle to Cloudbeds, Sabre to Aven,
Nor1 to Oracle).

### AirDNA: right, add dynamic pricing

- Rate shopping, for vacation rentals: "Pacing Insights & Comp Calendar: See what your comps are
  charging — and when they’re booked" (Property Manager plan), and "See how you compare to booked and
  available rates in your comp set." Its data covers rentals on Airbnb, Vrbo and Booking.com, not
  hotel rates. ([property-manager](https://www.airdna.co/property-manager),
  [comps](https://www.airdna.co/short-term-rental-comps))
- Dynamic pricing, since 1 Sep 2026, at $20 per listing per month: "Adapt is AirDNA’s AI-native dynamic
  pricing tool, built on our short-term rental data. It reprices your listing daily as demand, events,
  and competition shift". ([airdna.co](https://www.airdna.co/))
- It owns Uplisting (bought 2024), sold under Uplisting's own name: "Uplisting is a property management
  system (PMS) and channel manager that helps short-term rental operators manage bookings, sync
  calendars, automate messaging, and streamline daily operations."
  ([property-manager](https://www.airdna.co/property-manager),
  [uplisting.io](https://www.uplisting.io/property-management-software/direct-booking-platform))

### Akia: right, add upsell and CRM

- Guest messaging: "Akia answers up to 90% of guest texts and messages herself. She makes the booking,
  files the request, and updates the reservation."
  ([guest-messaging](https://www.akia.com/agents/guest-messaging))
- Upsell, in every plan: "A guest asks about arriving early. Akia checks that the room is free, quotes
  your price, and takes the payment in the same thread." ([upsells](https://www.akia.com/platform/upsells))
- CRM, a paid module: "Akia keeps one profile for every guest, then works the relationship for you. She
  runs your campaigns and gathers the feedback that keeps guests coming back."
  ([crm](https://www.akia.com/platform/crm))
- Not a PMS or booking engine. It reads the property's PMS ("Everything you collect flows back to your
  PMS."), and its chatbot sends shoppers to the property's own booking engine. Its comp-set feature
  compares reviews, not prices. ([digital-check-in](https://www.akia.com/platform/digital-check-in),
  [reputation](https://www.akia.com/platform/reputation))

### Amadeus (iHotelier, Demand360): right, add CRM

- Booking engine: "The iHotelier Booking Engine helps hotels capture demand directly on their website,
  reducing reliance on OTAs and high commission costs."
  ([ihotelier-booking-engine](https://www.amadeus-hospitality.com/solutions/reservations-and-guest-management/ihotelier-booking-engine/))
- Rate shopping, the market-data half: Demand360 lets a hotel "View your forward-looking ADR and RevPAR
  rank compared to your competitive set for the next 30 and 90 days." Amadeus' competitor price
  checker is RevenueStrategy360.
  ([demand360](https://www.amadeus-hospitality.com/solutions/business-intelligence/demand360/))
- CRM: "Amadeus Guest Management System (GMS) brings guest data together in one place, enabling hotels
  to deliver more personalized experiences that build loyalty over time." GMS also sells pre-arrival
  upsells.
  ([guest-management-system](https://www.amadeus-hospitality.com/solutions/reservations-and-guest-management/guest-management-system/))
- Channel manager, for an extra fee: its terms list iHotelier OTA Sync, now iHotelier Channel Manager,
  among services "for an additional fee".
  ([terms](https://www.amadeus-hospitality.com/legal/mssa/product/ihotelier/))
- No PMS any more: "Amadeus Cloud PMS (formerly known as Enterprise Lodging System Per Room) retired as
  of January 12, 2024". No guest texting either: GMS sends email only.
  ([lifecycle-policy](https://www.amadeus-hospitality.com/lifecycle-policy/))

### Atomize: right, but it is now Mews RMS

- "Relax knowing your prices are always right. Mews RMS, powered by Atomize, adapts to demand
  automatically, freeing your team from manual updates and guesswork."
  ([dynamic-pricing-automation](https://www.mews.com/en/products/dynamic-pricing-automation))
- atomize.com now redirects to Mews' revenue management page.
- Not a rate shopper. Its competitor view comes from Lighthouse: "It shows your and your competitors'
  prices on the OTAs (primarily from Booking.com) and is provided by Lighthouse."
  ([help.mews.com](https://help.mews.com/s/article/Why-is-my-Atomize-price-different-from-those-on-the-competitor-pricing-card-in-the-overview-dashboard))

### Beyond: right, add rate shopping

- Dynamic pricing: "Beyond's algorithm does the heavy lifting, adjusting your prices every day based on
  real demand signals in your market."
  ([dynamic-pricing](https://beyondpricing.com/products/dynamic-pricing))
- Rate shopping and market data, in every plan: Insights gives "Real-time market data to track trends,
  benchmark competitors, and grow your revenue." / "Any plan, including Free". Each listing's Market
  Insights tab shows what similar listings and local hotels charge.
  ([plans](https://beyondpricing.com/plans),
  [market insights](https://support.beyondpricing.com/en_us/how-do-i-use-the-market-insights-tab-to-understand-demand-trends-in-my-market-rk4VuSoS_))
- Booking engine, a paid add-on: "Signal is Beyond's direct booking engine: a branded, SEO-optimized
  website that converts your traffic into confirmed stays, without the commission cut."
  ([signal](https://beyondpricing.com/products/signal))
- Not a channel manager any more: Relay, launched in 2021, is gone, and its page redirects to the
  integrations page.

### Canary Technologies: right

- Guest messaging: "Canary’s Guest Messaging lets you easily communicate with guests in their preferred
  method: text messaging." ([guest-messaging](https://www.canarytechnologies.com/products/guest-messaging))
- Upsell, a product of its own (Dynamic Upsells, in the Advanced bundle, not the Core bundle): "Canary
  Upsells intelligently offers add-ons and amenities to guests from the time of booking through
  checkout." ([hotel-upsells](https://www.canarytechnologies.com/products/hotel-upsells))
- Not a PMS, despite its "#1 Hospitality Management System" tagline: "Canary’s Guest Experience
  Platform has deep integrations with all major property management systems".
  ([guest-experience-platform](https://www.canarytechnologies.com/guest-experience-platform))

### Cendyn: right, add channel manager, booking engine and dynamic pricing

- Read from archive copies: cendyn.com blocked automated reading (a Cloudflare 403, also in a headless
  browser), so every quote is from an Internet Archive copy of Cendyn's own pages.
- CRM: "Cendyn CRM is a centralized customer relationship management platform designed specifically
  for the hospitality industry."
  ([crm, Dec 2025 copy](https://web.archive.org/web/20251212174207/https://www.cendyn.com/crm/))
- Booking engine: "Cendyn Booking Engine is a high-impact direct booking engine that converts lookers
  into bookers with its responsive, powerful, intuitive, and elegant design."
  ([booking-engine, Dec 2025 copy](https://web.archive.org/web/20251217173350/https://www.cendyn.com/booking-engine/))
- Channel manager's job, through Cendyn CRS (the former Pegasus CRS). It is sold as a central
  reservations system "for enterprise customers" and sends rates and availability straight to the
  OTAs. ([crs, Dec 2025 copy](https://web.archive.org/web/20251212170442/https://www.cendyn.com/crs/))
- Dynamic pricing: "Guestrev analyzes internal data, market supply, and customer demand to calculate the
  ideal rate for rooms". ([guestrev, Dec 2025 copy](https://web.archive.org/web/20251217033134/https://www.cendyn.com/guestrev/))
- Not rate shopping: Rate Match checks the hotel's own OTA prices. "Cendyn Rate Match automatically
  shops your hotel’s stay dates in real time, mimicking your guests’ searches".
  ([rate-match, Dec 2024 copy](https://web.archive.org/web/20241212085659/https://www.cendyn.com/rate-match/))

### Cloudbeds: right, add guest messaging and upsell

- PMS, "available with every plan". Channel manager from the One plan up: "Cloudbeds Channel Manager
  syncs your rates and availability across every channel in real time." The entry Flex plan says
  instead: "Use your preferred CRS or channel manager partner." ([pricing](https://www.cloudbeds.com/pricing/),
  [channel-manager](https://www.cloudbeds.com/channel-manager/))
- Guest messaging, in the Experience plan: "Centralize email, SMS, WhatsApp, social media, and chats
  from OTAs including Booking.com, Expedia, Airbnb, VRBO, Agoda, and Ctrip." This is the former
  Whistle. ([guest-engagement-software](https://www.cloudbeds.com/guest-engagement-software/))
- Upsell: "Effortlessly offer one-click upsells and add-ons, from room upgrades to local experiences."
  ([booking-engine](https://www.cloudbeds.com/booking-engine/))
- Paid add-ons: Cloudbeds RMS (launched 15 Sep 2026) lets "Autopilot act when it spots an opportunity
  within limits you set" and shows "what the compset is charging, all on the same calendar". Guest
  Marketing CRM offers "smart email campaigns, guest profiles, and more profitability from every
  stay". ([revenue-management-system](https://www.cloudbeds.com/revenue-management-system/),
  [hotel-crm-solution](https://www.cloudbeds.com/hotel-crm-solution/))

### DerbySoft: right

- Channel manager: "Enables properties to connect to 500+ channels and manage Rates, Availability, and
  Inventory across channels on one platform through their PMS." Property Connector, its version for
  independents, is "Designed for individual hotels and small groups".
  ([derbysoft.com](https://www.derbysoft.com/), [property-connector](https://www.derbysoft.com/property-connector/))
- Not rate shopping: it monitors the hotel's own rates for parity ("Monitor hotel rates across
  distribution channels, uncover discrepancies and potential leakage").
  ([exchange](https://www.derbysoft.com/exchange-2/))
- Dynamic pricing is unclear. A Sept 2024 blog post claims "The platform’s intelligent pricing
  algorithm dynamically adjusts the rate of each room based on market trends, competitor pricing, and
  historical data", but no current product page offers pricing.
  ([blog](https://www.derbysoft.com/resources/blog/maximizing-profits-tips-for-selecting-the-right-channel-management-system-for-your-independent-property/))
- Upsells and Airbnb/Vrbo guest messaging come only through partners (ROOMDEX, BnBerry).

### Duetto: right

- "Goodbye guesswork. GameChanger uses Open Pricing to set the best possible room rate, then pushes it
  live across every channel in seconds." ([gamechanger](https://www.duettocloud.com/en-us/platform/gamechanger))
- Everything else comes through partners. "RateGain has been named a Preferred Partner of Duetto" for
  the channel manager (16 Jun 2026). Its partner page lists rate shoppers (Lighthouse, RateGain,
  eRevMax, Amadeus), Revinate for CRM and Oaky by Plusgrade for upsells.
  ([press release](https://www.duettocloud.com/en-us/press-releases/rategain-and-duetto-partner-to-power-autonomous-real-time-revenue-optimization-for-hotels-worldwide),
  [partners](https://www.duettocloud.com/en-us/partners/technology))
- HotStats, bought in 2025, compares a hotel's monthly profit and loss with its peers. That isn't
  competitors' prices by date, so it doesn't add rate shopping.

### Duve: right

- Guest messaging (from the Pro plan): "Email, SMS, WhatsApp, in-app chat, and OTA messages from Airbnb
  and Booking.com land in a single hub instead of five logins and a personal phone."
  ([guest-communication](https://duve.com/guest-communication-for-hospitality/))
- Upsell (from the Premium plan): "a pre-arrival email a few days out, a room upgrade prompt during
  online check-in, browsing in the Guest App mid-stay, a scheduled message for late checkout on the
  last night". ([upsells](https://duve.com/customized-upsells-platform-for-hotels/))
- Not a PMS: "Duve is not a PMS. It does not run rates, inventory or the reservation ledger." Its entry
  plan is online check-in and a guest app, which fit no box. ([llm-info](https://duve.com/llm-info/))

### Enso Connect: right, add CRM

- Guest messaging: "Bring Airbnb, Booking.com, WhatsApp, SMS, email and phone into one inbox - with
  EnsoAI answering, resolving, and keeping every thread moving around the clock."
  ([ensoconnect.com](https://ensoconnect.com/))
- Upsell: "Use our upsell builder to craft upsells that guests can purchase at anytime before or during
  their stay." ([upsells](https://ensoconnect.com/features/upsells))
- CRM, in the same subscription: "Every stay assembles a complete guest profile automatically, ready to
  segment, automate, and market from data the operator already owns."
  ([hospitality-crm](https://ensoconnect.com/features/hospitality-crm))
- Not a PMS: "Enso Connect is the guest-experience layer that sits on top of your PMS".
  ([what-is-enso-connect](https://ensoconnect.com/company/what-is-enso-connect))

### GoHighLevel: right, add guest messaging

- CRM: "The Agency CRM designed for you". It holds leads and an email list. It holds guests' stays
  only if someone imports them. ([crm](https://www.gohighlevel.com/crm))
- Guest messaging: "The Conversation Manager is included with every HighLevel account and acts as your
  central communication hub." It covers texts, website chat, WhatsApp, social messages and calls.
  HGM's LeadConnector chat widget is this product.
  ([unified-conversations](https://www.gohighlevel.com/post/unified-conversations))
- Booking engine, new and not suggested for the slides: Rentals (24 Jun 2026) has a "dedicated
  public-facing booking page that displays your listings, categories, pricing and availability in
  real-time", but shares availability only through iCal.
  ([rentals](https://help.gohighlevel.com/support/solutions/articles/155000006649-rentals-overview-how-to-get-started))
- Not upsell: its "one click upsells" are extra offers at checkout in a sales funnel.
  ([one-click-upsells](https://www.gohighlevel.com/post/one-click-upsells))

### Google: wrong (checked twice)

- Not a rate shopper: see section 2. The key page is Hotel Center's price report, which checks parity
  for the property itself. ([answer 10474165](https://support.google.com/hotelprices/answer/10474165))
- Not a channel manager or booking engine: "Work with a connectivity partner to send your real-time
  rates and availability to Google." / "If you click a booking link, you go to the partner website to
  complete your booking." ([answer 9144336](https://support.google.com/hotelprices/answer/9144336),
  [answer 6276008](https://support.google.com/travel/answer/6276008))
- No guest messaging: "As of July 31, 2024, the chat and call history features are no longer available
  in your Business Profile." ([answer 14919056](https://support.google.com/business/answer/14919056))
- Not dynamic pricing: the only thing Google automates is the ad bid ("Target ROAS (Return on ad
  spend): Optimize your bid and maximize conversion value based on real-time data.").
  ([answer 9238461](https://support.google.com/hotelprices/answer/9238461))
- The verifier fetched all 16 cited pages and matched all 26 quotes word for word. Its corrections are
  in section 7.

### Guesty: right, add booking engine and CRM

- PMS and channel manager, in every plan: "Manage one property or hundreds on an AI PMS built to
  automate tasks, sync listings across 70+ channels and maximize revenue." ([guesty.com](https://www.guesty.com/),
  [channel-manager](https://www.guesty.com/features/channel-manager/))
- Booking engine, in every plan: "The Guesty Booking Engine powers the checkout experience on your
  website." ([direct-reservations](https://www.guesty.com/features/direct-reservations/))
- CRM, in every plan: "Segment your audiences and conduct email campaigns that cultivate repeat
  customers." ([crm](https://www.guesty.com/features/crm/))
- Guest messaging: "It consolidates messages from Airbnb, Vrbo, Booking.com, email, SMS, and WhatsApp
  into one AI-powered inbox." ([unified-inbox](https://www.guesty.com/features/unified-inbox/))
- Paid add-ons: PriceOptimizer (dynamic pricing, with a weekly and monthly competitor comparison that
  isn't date-by-date rate shopping) and Guest App Upsells.
  ([priceoptimizer](https://www.guesty.com/features/guesty-priceoptimizer/),
  [upsells help](https://help.guesty.com/hc/en-gb/articles/38659478074909-Understanding-the-difference-between-Guest-App-Upsells-and-Booking-Engine-upsells))

### Hostaway: right, but teach it as a PMS first

- "Hostaway is a property management system and channel manager built to drive more bookings and
  automate manual tasks." ([features](https://www.hostaway.com/features/))
- Booking engine: "Hostaway's Booking Website is included at no extra cost with your Hostaway
  subscription." ([direct-booking](https://www.hostaway.com/features/direct-booking/))
- Guest messaging: "See every conversation from every channel — Airbnb, Vrbo, Booking.com, Google,
  email, SMS, and WhatsApp — side by side in a single inbox."
  ([communication](https://www.hostaway.com/features/communication/))
- Upsell, through its guest portal: "Offer tasteful, timely upsells at key moments in the guest
  journey." ([marketing](https://www.hostaway.com/features/marketing/))
- Its own dynamic pricing costs extra each month, per listing. Its Guest Book holds the past-guest
  list: "Guest information for all staying guests will be added to the Guest Book and can be used for
  marketing purposes." ([dynamic-pricing](https://www.hostaway.com/features/dynamic-pricing/),
  [guest book](https://support.hostaway.com/hc/en-us/articles/4403156649371-Reservations-Guest-Book))

### HubSpot: right

- "HubSpot's free CRM unifies all your customer data on one platform, with AI that makes it easy to
  understand." It is a general CRM: it knows a guest's stays and spend only once the PMS is connected,
  through connectors other companies build. ([crm](https://www.hubspot.com/products/crm))
- Its own hotel guide keeps the PMS separate: "Unlike a property management system (PMS), which manages
  operational tasks such as reservations, room assignments, check-ins, housekeeping, and billing, a
  CRM focuses on guest relationships." ([blog](https://blog.hubspot.com/marketing/best-crm-for-hotels))
- Generic messaging: "With HubSpot's shared inbox, you'll get free tools to integrate communications
  from live chat, SMS, WhatsApp, social media channels, Facebook Messenger, chatbots, team email, and
  more." It doesn't know when a stay starts, so teach HubSpot as CRM only.
  ([conversations](https://www.hubspot.com/products/crm/conversations))
- Name traps: Revenue Hub is "Quote, bill, and collect — all through HubSpot.", not revenue
  management. "Channels" in HubSpot means messaging channels. ([revenue](https://www.hubspot.com/products/revenue))

### IDeaS: right

- "IDeaS uses superior analytics that determine optimal pricing and inventory controls for key products
  by room type". ([revenue-management-for-hospitality](https://ideas.com/revenue-management-for-hospitality/))
- Rate Data Advantage (Jan 2026, an add-on for G3 RMS clients) "enhances your existing rate shopping
  process" rather than replacing a rate shopper. Competitor rates come mainly from partner rate
  shoppers such as Lighthouse. ([rate-data-advantage](https://ideas.com/rate-data-advantage/))
- Not only for big chains: it also sells to boutique and independent hotels and to "an RV park,
  campground, or cabin rentals", and it quotes AutoCamp.
- No PMS, channel manager, booking engine, CRM, messaging or upsell of its own; all come through
  partners. ([integration-partners](https://ideas.com/about/partners/integration-partners/))

### KeyData: right

- Rate shopping and market data for vacation rentals: "See the final advertised price on a booked
  property as well as advertised pricing for nights still available."
  ([custom-comp-sets](https://www.keydata.co/prodata/custom-comp-sets))
- Not a pricing tool: "No. KeyData is not a pricing tool. Pricing tools automate rate adjustments."
  ([prodata](https://www.keydata.co/products/prodata))
- It reads reservations from the client's PMS and sells no PMS, channel manager, booking engine, CRM,
  messaging or upsell. ([integrations](https://www.keydata.co/company/integrations))

### Kipsu: right

- "Hotel texting reduces guest anxiety to speak up about their stay while providing an easy way to
  contact you before, during, and after their stay." Since April 2025 the product is called Kipsu
  Engage FCX. ([engage](https://www.kipsu.com/solution/engage))
- "Kipsu integrates with most leading CRM, PMS, ticketing, and other key platforms."
  ([enterprise](https://www.kipsu.com/enterprise))
- No upsells: it handles early arrivals as coordination, not as a paid early check-in. Its other
  products (Exceed FCX for operations, Events FCX for event teams) fit no box.

### Klaviyo: right

- "Klaviyo is the AI-first CRM built for B2C brands." For hotels it holds stays and spend once the PMS
  is connected: "When you integrate with Cloudbeds, Klaviyo will sync all historic reservation and
  guest data." ([cloudbeds data reference](https://help.klaviyo.com/hc/en-us/articles/39406875083035))
- Texts cost extra and are built for marketing ("Day-of check-in: A text the morning of arrival with a
  mobile check-in link, directions, parking info, and/or check-in time."). Upgrade offers go out from
  Klaviyo, but the sale happens in the PMS.
  ([hotel enablement guide](https://help.klaviyo.com/hc/en-us/articles/48920041574811))

### Lighthouse: right, add channel manager, booking engine and dynamic pricing

- Rate shopping: "Rate shopping with live shop" / "Eliminate stale data with live rate shops delivered
  directly from OTAs and your Brand.com." ([pricing](https://www.mylighthouse.com/platform/pricing))
- Dynamic pricing, in every independent-hotel plan: "365 days of the most profitable rates for your
  hotel, automated". ([pricing-optimization](https://www.mylighthouse.com/platform/pricing-optimization))
- Channel manager and booking engine for small independents (Plus and Complete plans, from Stardekk and
  Cubilis): "Maximize visibility & eliminate overbooking with synchronized availability across 200+
  channels" and "Reduce commission with a high-converting booking engine for your website".
  ([channel-management](https://www.mylighthouse.com/platform/channel-management),
  [direct-bookings](https://www.mylighthouse.com/platform/direct-bookings))
- Paid extras: Reservation Management does a PMS's job in the top plan. KITT, an AI receptionist for
  groups and chains, answers guests and "Cross-sells upgrades and services".
  ([kitt](https://www.mylighthouse.com/platform/kitt-ai-receptionist))

### Little Hotelier: right, add channel manager and booking engine

- PMS: "Little Hotelier’s property management system helps you simplify your daily operations, manage
  check-ins, allocate rooms, communicate with your guests and drive more bookings".
  ([property-management-system](https://www.littlehotelier.com/property-management-system/))
- Channel manager, in every plan: "Instant updates keep your rates and availability in-sync across all
  your booking channels." ([channel-manager](https://www.littlehotelier.com/channel-manager/))
- Booking engine, in every plan: "Watch your revenue grow by taking commission-free bookings directly
  through your own website, social media channels or by creating a direct booking webpage."
  ([hotel-booking-engine](https://www.littlehotelier.com/hotel-booking-engine/))
- With the Pro plan: "Track the rates of up to 10 competitors and see how your own prices appear across
  all online listings." Paid add-ons: Dynamic Revenue Plus (pricing) and Guest Engagement (an inbox
  and pre-arrival upsell offers). CRM comes only through other companies' apps in its App Store.
  ([reporting-insights](https://www.littlehotelier.com/reporting-insights/),
  [guest-engagement](https://www.littlehotelier.com/guest-engagement/))

### Lodgify: right, add PMS and guest messaging

- PMS: its homepage says "#1 short-term rental PMS since 2012". ([lodgify.com](https://www.lodgify.com/))
- Channel manager, in every plan: "We connect via API to Airbnb, Vrbo, Booking.com and Expedia."
  ([channel-manager](https://www.lodgify.com/vacation-rental-channel-manager/))
- Booking engine, from the Starter plan up (the Basic plan has no website): "Your website comes with a
  built-in booking engine that handles availability, pricing and reservations automatically. Guests
  book directly with you." ([get-direct-bookings](https://www.lodgify.com/get-direct-bookings/))
- Guest messaging, in every plan: "Lodgify's unified inbox brings every conversation into one view."
  ([unified-inbox](https://www.lodgify.com/unified-inbox/))
- Its dynamic pricing (top two plans) is "powered by our partner Beyond Pricing". Its extras are
  booking add-ons only: "Add-ons apply only to your website and are not sent to any OTAs."
  ([dynamic pricing help](https://help.lodgify.com/hc/en-us/articles/27708018390172-Use-Dynamic-Pricing-to-dynamically-optimize-your-nightly-pricing))

### Mailchimp: right

- "Get to know your audience and find new ways to market to them when you use Mailchimp for customer
  relationship management (CRM)." It holds stays and spend only if they are imported or synced from
  the PMS. ([features/crm](https://mailchimp.com/features/crm/))
- SMS is a paid marketing add-on: "SMS marketing is available as an add-on for all paid Mailchimp
  plans". Its inbox can only answer a guest's text (up to 3 replies in 7 days), never start one.
  ([sms](https://mailchimp.com/solutions/sms-marketing-tools/))

### Mews: wrong on CRM (checked twice)

- PMS and booking engine: "Our hotel PMS powers more than 15,000 properties around the world. And
  counting." / "With your booking engine fully integrated with your PMS, there's no extra software, no
  integrations to manage, and lower total costs."
  ([property-management-system](https://www.mews.com/en/property-management-system),
  [booking-engine](https://www.mews.com/en/products/booking-engine))
- Channel manager, since 27 May 2026: "Powered by SiteMinder. Built into Mews. Manage 400+ channels from
  the operating system your property already runs on." It is a partnership; SiteMinder stays a
  separate company. ([mews-channel-manager](https://www.mews.com/en/products/mews-channel-manager))
- Dynamic pricing: "Mews RMS, powered by Atomize, adapts to demand automatically". It tracks
  competitors too: "You can add up to 5 competitors."
  ([dynamic-pricing-automation](https://www.mews.com/en/products/dynamic-pricing-automation),
  [compset help](https://help.mews.com/s/article/How-to-edit-your-competitor-settings-compset-in-Mews-RMS))
- Guest messaging, since 1 Oct 2026: "Because Guest Messaging is part of Mews, there's no third-party
  tool to set up or integration to maintain."
  ([hotel-guest-messaging](https://www.mews.com/en/product/hotel-guest-messaging))
- Upsell: "From kiosks to QR codes and upgrades to meeting spaces, Mews makes upselling effortless and
  built in at every stage of the journey." ([upsells](https://www.mews.com/en/products/upsells))
- Not a CRM: see section 2. The verifier fetched every cited page and found every quote word for word.
  Its caveats are in section 7.

### Newbook: right, add channel manager and booking engine

- PMS: "Streamline your operations, boost profitability, and deliver unforgettable guest experiences
  with Newbook’s cloud-based hospitality property management system."
  ([property-management-software](https://www.newbook.cloud/our-platform/property-management-software/))
- Channel manager, in both packages: "Our Channel Manager is an integral part of the software".
  ([channel-manager](https://www.newbook.cloud/our-platform/channel-manager/))
- Booking engine, in both packages: "Save on third-party costs while your guests enjoy a fully-branded
  booking experience, directly on your website."
  ([online-booking-system](https://www.newbook.cloud/our-platform/online-booking-system/))
- Also built in: occupancy-based pricing ("Not only will your rates rise with demand, they will
  automatically reduce in slow periods"), an inbox ("Unify messages from email, SMS, Airbnb, and
  Booking.com in a single timeline."), extras sold through the booking engine, and basic guest
  marketing. It has no rate shopper of its own.
  ([dynamic-pricing](https://www.newbook.cloud/features/dynamic-pricing/),
  [unified-inbox](https://www.newbook.cloud/features/newbook-unified-inbox/))
- Its site says "94% of our customers are RV Parks, campgrounds and glamping resorts".

### Nor1: right

- "Present personalized offers that a guest is most likely to say yes to, including room upgrades,
  attributes, amenities, merchandise, and services."
  ([nor1-hotel-upsell](https://www.oracle.com/hospitality/nor1-hotel-upsell/))
- It plugs into a PMS rather than being one: "Nor1 can connect to the OPERA CLOUD PMS using the OHIP
  interface." Infor HMS, QuoHotel, Agilysys LMS and Hilton's CRS are validated too.
  ([docs](https://docs.oracle.com/en/industries/hospitality/nor1-cloud/norug/ch_validated_full_2way_interface_integrations_with_nor1.htm))
- No booking engine of its own: it puts its upgrade offer "on the partner’s Internet Booking Engine
  (IBE) and transaction emails".
  ([connectivity](https://docs.oracle.com/en/industries/hospitality/nor1-cloud/norig/ch_learn_more_about_nor1_connectivity.htm))

### Oaky: right, now Oaky by Plusgrade

- "Oaky is the hotel upsell software purpose-built for hotel chains to maximize TRevPAR with
  personalized offers and effortless automation." ([oaky.com](https://www.oaky.com/))
- Plusgrade bought it ("We have acquired Oaky", 6 Oct 2025). oaky.com is now one frozen page whose
  links go to Plusgrade's acquisition post, and Plusgrade plans "a single upselling suite".
- Its PMS, revenue management, CRM and chat links are other companies' products. Several boxes were
  read from archive copies, since oaky.com no longer has those pages.
  ([integrations, May 2026 copy](https://web.archive.org/web/20260510235908/https://oaky.com/en/integrations))

### Oracle OPERA Cloud: right, add channel manager and upsell by name

- PMS: the page heading is "Cloud PMS—OPERA Cloud".
  ([hotel-pms-software](https://www.oracle.com/hospitality/hotel-property-management/hotel-pms-software/))
- Channel manager, paid: "OPERA Cloud Distribution is an add-on solution for OPERA Cloud Property
  Management and OPERA Cloud Central customers."
  ([datasheet](https://www.oracle.com/a/ocom/docs/industries/hospitality/distribution-cloud-service-products-ds.pdf))
- Upsell, paid: Nor1, sold as "OPERA Cloud Guest Engagement and Merchandising".
  ([nor1-hotel-upsell](https://www.oracle.com/hospitality/nor1-hotel-upsell/))
- Its own booking engines are retired: "Oracle Hospitality Web Booking Engine Cloud Service / Retired
  Part #: B81346". Pricing, rate shopping and guest messaging come from partners.
  ([service descriptions](https://www.oracle.com/contracts/docs/hosp_retail_cloud_service_2511377.pdf))
- For the game's note: "Hyatt (NYSE: H) has chosen the Oracle OPERA Cloud hospitality platform as the
  property management system (PMS) for its global hotel portfolio." IHG only approved it: "With this
  approval, Oracle joins IHG’s exclusive list of approved property management systems".

### Plusgrade: right

- "Provide hotel guests with the option to bid on or purchase premium room upgrades through a seamless,
  white-label user experience." It also sells StayExtend (early check-in, late check-out, extra
  nights) and StayPlus (extras). ([hospitality](https://www.plusgrade.com/industries/hospitality/))
- It connects to the hotel's systems rather than selling them: "Our solution integrates with top-tier
  Property Management Systems (PMS), booking engines, and channel management systems to automate your
  upselling initiatives and elevate guest satisfaction."
  ([integrations](https://www.plusgrade.com/industries/hospitality/integrations/))
- Its loyalty products (from Points) are for chains' loyalty programmes and fit no box.

### PriceLabs: right, add rate shopping

- "Prices and minimum stays are recalculated daily and synced automatically to Airbnb, Vrbo, or 160+
  PMSs." ([dynamic-pricing](https://hello.pricelabs.co/dynamic-pricing/))
- Rate shopping is included: "Dynamic pricing, market data, rate shopping, and reporting — included. No
  premium tiers for core features". It can "Automatically track publicly available data on up to 350
  nearby hotels and short-term rentals." ([hotel](https://hello.pricelabs.co/hotel/))
- Not a channel manager: "Being a revenue management tool, availability is not set/altered in
  PriceLabs." ([availability help](https://help.pricelabs.co/portal/en/kb/articles/availability-management))

### RateGain: right, add booking engine

- Channel manager: "Distribute rates and inventory across 400+ channels in just 2 minutes from a single
  dashboard." ([uno channel manager](https://uno.rategain.com/hotel-channel-manager/))
- Rate shopping: "Most accurate rate shopping across 1100+ sources".
  ([rate-intelligence](https://rategain.com/hotels/rate-intelligence/))
- Booking engine: "Industry's First AI-Native Booking Engine Built to Drive More Direct Bookings", sold
  in the "UNO Direct Stack". It can "Embed upsell flows directly into your UNO Booking Engine".
  ([uno booking engine](https://uno.rategain.com/hotel-booking-engine/))
- Not dynamic pricing: "Navigator isn’t replacing anything— just making your existing systems
  smarter—feeding them cleaner data, sharper forecasts, and real-world context."
- CRM and guest messaging come from Sojern, which RateGain has owned since 6 Nov 2025 and still sells
  under its own name.
  ([guest-marketing-suite](https://www.sojern.com/solutions/guest-experience/guest-marketing-suite),
  [ai-concierge](https://www.sojern.com/solutions/guest-experience/ai-concierge))

### Revinate: right, add guest messaging

- CRM, which Revinate calls a customer data platform: "Revinate Core is a hotel customer data platform
  that pulls those scattered pieces into a single, clean profile for every guest."
  ([cdp](https://www.revinate.com/hotel-software/cdp/))
- Guest messaging, sold as a separate product: "Guests access a secure Chat session via a link sent
  through SMS and/or email. From booking confirmation through seven days post-checkout, your guests
  have a direct line to your property." ([virtual-concierge](https://www.revinate.com/hotel-software/virtual-concierge/))
- Upsells are a type of campaign: "Offer room upgrades, early check-in, and more with automated
  pre-arrival Upsell emails." ([email-marketing](https://www.revinate.com/hotel-software/email-marketing/))
- No booking engine, PMS, channel manager, pricing tool or rate shopper: "No, Reservation Sales is not
  a booking engine." ([reservation-sales](https://www.revinate.com/hotel-software/reservation-sales/))

### RMS Cloud: right, add channel manager and booking engine

- PMS: "RMS is a cloud-native property management platform trusted by over 6,000 hotels, motels,
  holiday parks, campgrounds, and serviced apartments across 70+ countries."
  ([rmscloud.com](https://www.rmscloud.com/))
- Channel manager, standard: "Connect to the world’s biggest OTAs with just a few clicks with RMS
  native, built-in channel manager."
  ([channel-manager](https://www.rmscloud.com/features/hotel-channel-manager-software))
- Booking engine, standard: "More direct revenue for you. Less commission for OTAs. Better experiences
  for your guests." ([booking-engine](https://www.rmscloud.com/features/booking-engine-software))
- Also standard: rule-based pricing ("Automatically update pricing based on occupancy, timing, or
  seasonality"), guest chat by SMS, email and portal, and add-ons sold in the booking engine. Email
  marketing is a paid module, and rate shopping comes only through partners.
  ([revenue-management](https://www.rmscloud.com/features/hotel-revenue-management-software),
  [guest-portal](https://www.rmscloud.com/features/guest-portal-software))

### RoomPriceGenie: right

- "RoomPriceGenie is a self-service, cloud-based revenue management system that automatically sets and
  updates hotel room prices based on real-time data." ([ai-info](https://roompricegenie.com/ai-info/))
- It tracks "your 10 biggest competitors" and "hundreds of local AirBnBs", but only to set its own
  prices. Its help centre says it is "not comparing price to price". ([product](https://roompricegenie.com/product/))
- Its own scope line: "Not a full-service hotel management platform — focused specifically on pricing
  and revenue management".

### Sabre SynXis: right box, wrong owner

- Sabre sold the business to TPG (closed 7 Jul 2025). It relaunched on 27 Jan 2026 as Aven Hospitality,
  "formerly Sabre Hospitality Solutions", and sabrehospitality.com now redirects to
  avenhospitality.com.
- Booking engine: "From first click to confirmed stay, Aven Hospitality Booking Engine delivers the
  seamless, consumer-grade experience guests expect, on any device."
  ([booking-engine](https://www.avenhospitality.com/solutions/booking-engine))
- Channel manager: its OTA Distribution page is titled "Hotel Channel Manager | Aven Hospitality - OTA
  Distribution". ([OTA](https://www.avenhospitality.com/solutions/OTA))
- Upsell, sold separately as Retailing: "Use hotel ancillary revenue software to offer personalized
  recommendations, merchandise, and room upgrades."
  ([retailing](https://www.avenhospitality.com/solutions/retailing))
- No PMS now: "While Nuvola and SynXis Property Hub are no longer featured within our active solution
  lineup, we remain fully committed to supporting existing customers who use these products today."
  ([faq](https://www.avenhospitality.com/faq))

### SiteMinder: right, add rate shopping

- Channel manager, in every plan: "Your bookings will surge with connections to over 450 distribution
  channels, including the GDS." ([channel-manager](https://www.siteminder.com/channel-manager/))
- Booking engine, in the SiteMinder Plus plan: "SiteMinder’s #1 ranked Booking Engine brings demand
  right to your front door." ([hotel-booking-engine](https://www.siteminder.com/hotel-booking-engine/))
- Rate shopping, in the SiteMinder Plus plan: "Competitor rates insights" and "Rate parity insights",
  for up to 10 competitors. ([business-intelligence](https://www.siteminder.com/hotel-business-intelligence/))
- Not a PMS: its channel manager connects to the hotel's own (section 4, clash 2).
- Paid add-ons: Dynamic Revenue Plus, which gives "data-driven pricing recommendations", and Guest
  Engagement, which brings "email, SMS, WhatsApp, Booking.com, and Airbnb" into one place and sends
  upsell offers "prior-to and during their stay".
  ([dynamic-revenue-plus](https://www.siteminder.com/dynamic-revenue-plus/),
  [guest-engagement](https://www.siteminder.com/guest-engagement/))

### STAAH: right, add dynamic pricing

- Channel manager: "Maximize Your Reach with the Best Hotel Channel Manager: Connect to 2,000+ Channels
  Worldwide with Zero Commission on Bookings." ([channel-manager](https://www.staah.com/channel-manager/))
- Booking engine (SwiftBook): "Convert website visitors into guests with a seamless, commission-free
  booking experience". ([booking-engine](https://www.staah.com/booking-engine/))
- Dynamic pricing, inside the channel manager: "Implement per-room Dynamic Pricing based on seasons and
  demand. Rates auto-update on all connected channels, including booking engine and OTAs, following
  your set dynamic rules." It also sells STAAH RMS. ([staah-rms](https://www.staah.com/staah-rms/))
- Not a PMS: "STAAH is built purely for distribution". Competitor rates are a paid add-on: "RateSTalk
  is a competitor rate checker available as an add-on for properties using STAAH Instant or MAX
  Channel Manager."
  ([ratestalk help](https://help-staah.theaccessgroup.com/en/articles/12179190-ratestalk-in-staah-max-to-monitor-competitor-pricing))

### STR (CoStar): right box, wrong job line

- "Benchmarking is the process of comparing and analyzing your property or portfolio's performance
  against the competition." ([faqs](https://www.costar.com/products/str-benchmark/resources/faqs))
- Not a rate shopper: "No, STR reports aggregated data only." It never shows one competitor's price and
  tracks no future prices.
- Hotels send it their own figures: "This data is submitted straight from the source: chain
  headquarters, management companies, owners and directly from independent hotels."
- str.com now redirects to CoStar's "CoStar with STR Benchmark" page, and CoStar's FAQ calls it "a
  premium feature" of its product. ([str-benchmark](https://www.costar.com/products/str-benchmark))

### UpsellGuru: right

- "Guests receive a branded email with upgrade options. They can bid for room upgrades within a set
  price range." ([pre-arrival-upselling](https://upsellguru.com/pre-arrival-upselling/))
- Its "Dynamic Pricing Engine" prices upgrade offers, not room rates: "Maximize profit with intelligent
  pricing, driven by smart algorithms that determine the ideal price for every upgrade."
  ([features](https://upsellguru.com/features/))
- Its messaging, PMS and CRM links are other companies' systems.
  ([integrations](https://upsellguru.com/integrations/))
- Read with WebFetch only; the key quotes came back the same on two fetches. The site looks rarely
  updated (newest blog post 27 Mar 2025).

### WebRezPro: right

- "Our cloud PMS handles everything from the front desk to the back office, with a commission-free
  booking engine, guest self check-in, yield management, and integrated accounting."
  ([webrezpro.com](https://webrezpro.com/))
- Booking engine: "With WebRezPro PMS, you get a fully integrated, commission-free reservation system
  that turns your website into a direct booking machine."
  ([hotel-booking-engine](https://webrezpro.com/hotel-booking-engine/))
- No channel manager: properties that want one or two big OTAs "connect WebRezPro to those channels via
  separate OTA interfaces", and wider distribution goes through partners.
  ([blog](https://webrezpro.com/booking-channel-interface-works-webrezpro-pms/))
- The trap: "Pulse – AI Guest Marketing" sits in its own Features menu, but Pulse is a separate company
  that WebRezPro integrated on 1 Sep 2026.

### Wheelhouse: right, add rate shopping

- "Wheelhouse offers two products, our flagship product, Dynamic Pricing and our new offering, Dynamic
  Sets." ([pricing](https://www.usewheelhouse.com/pricing))
- Market data: "Each view includes a set of neighborhood data series so you can compare your pricing
  and booking pace against your neighborhood without any manual setup." Dynamic Sets ($12.99 a set a
  month) shows each nearby listing's nightly asking rate.
  ([neighborhood prices help](https://help.usewheelhouse.com/en/articles/14009220-how-to-view-the-neighborhood-prices-pacing))
- Pricing only: "We only focus on the pricing aspect of your listing and make dynamic changes over
  time." ([help](https://help.usewheelhouse.com/en/articles/1194620-is-wheelhouse-a-central-reservations-system))

### Whistle: right, add upsell; now Cloudbeds Guest Experience

- Cloudbeds bought Whistle (announced 27 Jun 2022) and sells it as Cloudbeds Guest Experience, in its
  Experience plan. trywhistle.com is a frozen 2022 page.
- Guest messaging: "Centralize email, SMS, WhatsApp, social media, and chats from OTAs including
  Booking.com, Expedia, Airbnb, VRBO, Agoda, and Ctrip."
  ([guest-engagement-software](https://www.cloudbeds.com/guest-engagement-software/))
- Upsell: "Cloudbeds Guest Experience Upsell allows you to send guests a link to purchase a product or
  service from the Cloudbeds Guest Experience store."
  ([upsell help](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/8700069705115-Configure-Cloudbeds-Guest-Experience-Upsell-Products-Categories-and-Design))
- Don't confuse it with whistle.com, which now lands on Tractive, a pet GPS tracker.
