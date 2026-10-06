---
title: Session 2 tools slides, the training and the game — one answer per vendor, 6 Oct 2026
status: "Applied in the portal on 6 Oct 2026 (card list 2.2, manifest 1.2). The slide changes below still have to be made in the Claude project's deck master."
---

# One answer per vendor

Kyle found the tools training, the session 2 slides and Sort the stack telling players different
things about the same vendor. The cause: on 6 Oct the game took the 5 Oct vendor check
(`verification-2026-10-05.md`), but the training kept the slides' boxes, and the deck still predates
both. Now the training and the game read one table, and `vendor-icons.check.ts` fails if they ever
disagree again (`boxClashes` in `src/pages/team/dictionary/tools/vendor-icons.ts`).

## The rule

A box counts for a vendor when **the vendor sells that job to properties under its own name, in a plan
or as a paid add-on**. A partner's product the vendor connects to doesn't count, and nor does a sister
company sold under another brand (Little Hotelier for SiteMinder, Uplisting for AirDNA, Sojern for
RateGain, Lighthouse's competitor rates inside Mews RMS).

Where a box needed a line drawn, the line is the box's own job:

- **Booking engine**: the "Book now" on the property's own site that writes the booking into the PMS.
  GoHighLevel's Rentals page syncs only by iCal (and is in beta), so it doesn't count.
- **Dynamic pricing**: rates that move automatically. Rules a PMS applies by occupancy count (Newbook,
  RMS Cloud, WebRezPro, STAAH); per-channel rate rules a person sets don't (DerbySoft).
- **Rate shopping and market intelligence**: the property can look at competitors' prices or the
  market itself. A pricing engine that only uses them inside (RoomPriceGenie) doesn't count, and
  nor does a parity check of the property's own rates (DerbySoft, Cendyn Rate Match).
- **CRM**: a guest list the property can segment and send campaigns to. Guest profiles or an
  exportable guest book alone don't count (Mews, Hostaway).
- **Guest messaging**: a two-way inbox reaching guests on their own channels (SMS, WhatsApp, email,
  chat). Marketing texts the business can only reply to don't count (Klaviyo, Mailchimp), and nor do
  OTA message threads relayed inside a channel manager (STAAH).
- **Upsell**: paid upgrades or extras offered to a guest after booking (pre-arrival offers, a guest
  portal or app, check-in). Extras offered only inside the booking flow don't count (RateGain's UNO,
  Lighthouse's KITT).

## The answer key

What each vendor is known for comes first on the training card. In the game it's the box the card is
dealt into. Everything else it sells is accepted as "also right". Amadeus has one entry for two
products, iHotelier (booking engine) and Demand360 (rate shopping). Its game card is iHotelier only,
so that card accepts booking engine and channel manager.

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
| HubSpot             | CRM                           | Guest messaging                                                                               |
| IDeaS               | Dynamic pricing               | —                                                                                             |
| KeyData             | Rate shopping                 | —                                                                                             |
| Kipsu               | Guest messaging               | —                                                                                             |
| Klaviyo             | CRM                           | —                                                                                             |
| Lighthouse          | Rate shopping                 | PMS, Channel manager, Booking engine, Dynamic pricing                                         |
| Little Hotelier     | PMS                           | Channel manager, Booking engine, Dynamic pricing, Rate shopping, Guest messaging, Upsell      |
| Lodgify             | Booking engine                | PMS, Channel manager, Dynamic pricing, Guest messaging, Upsell                                |
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
| WebRezPro           | PMS                           | Booking engine, Dynamic pricing, Upsell                                                       |
| Wheelhouse          | Dynamic pricing               | Rate shopping                                                                                 |
| Whistle             | Guest messaging               | Upsell                                                                                        |

## What changed in the game

Four answers that were marked wrong are now right. No answer that was right became wrong.

- Round 1: **Oracle OPERA Cloud** in Channel manager (OPERA Cloud Distribution, an add-on). The 2.1
  call left it out as "a separate product", but it is sold under the OPERA Cloud name. **Sabre
  SynXis** in Channel manager: Aven's channel manager runs from the SynXis CRS. 2.1 had held this back
  with the rename.
- Round 2: **Revinate** in Upsell (pre-arrival upgrade emails; the guest requests and staff approve)
  and **Whistle** in Upsell (the Cloudbeds Guest Experience store).
- Notes rewritten to say what else each vendor sells, for the cards whose boxes changed: Oracle,
  Newbook, SiteMinder, STAAH, SynXis, Lodgify, Wheelhouse, PriceLabs, Lighthouse, RateGain, AirDNA,
  Revinate, Cendyn and Whistle. Oracle's note no longer says IHG chose OPERA Cloud (IHG only approves
  it), and SynXis' note no longer calls it Sabre's.
- Round 3 is unchanged: Cloudbeds does all eight, SiteMinder six (PMS and CRM wrong), Mews six (CRM
  wrong; rate shopping stays out of its tray).

## Slide changes for the deck master

Required, because the slides now contradict the training and the game:

- **Slide 40, Rate shopping**: take **Google** off. Google Hotels is metasearch (slide 5), not a rate
  shopper. A replacement that sells it: PriceLabs ("Market data and rate shopping come with its pricing
  tool") or SiteMinder (competitor-rate insights in its Plus plan).
- **Slide 41, CRM**: take **Mews** off. Mews keeps guest profiles but sells no CRM; its own guide tells
  hotels to connect the CRM of their choice. A replacement: Guesty or Enso Connect (both sell segments
  and campaigns). The trap could go in the slide's footer: "Mews keeps guest profiles, but connects to
  a CRM rather than being one."
- **Slide 46, The stack, sorted, Round 3**: the answers are out of date.
    - Cloudbeds: all eight jobs (pricing, rate shopping and CRM are paid add-ons).
    - SiteMinder: channels, engine, pricing, rate shopping, messaging, upsell. Not PMS (that's Little
      Hotelier) and not CRM.
    - Mews: PMS, channels, engine, pricing, messaging, upsell. Not CRM.
- **Slide 37, SiteMinder tile**: "with a booking engine and a small-property PMS beside it" reads as
  SiteMinder selling a PMS, which the game marks wrong. Suggested: "A channel manager first, with a
  booking engine; its small-property PMS is a separate product, Little Hotelier."
- **Slide 36, Oracle OPERA Cloud tile**: "Hyatt and IHG run it" overstates IHG. Suggested: "The
  big-brand PMS: Hyatt chose it, and IHG approves it."
- **Slide 38, Sabre SynXis tile**: "Sabre's booking engine" is wrong on owner since 2025. Kyle has
  parked the renames, but the tile can say "SynXis's booking engine (sold by Sabre until 2025)".

Worth doing, so a tile says what the training card will:

- **Slide 36, footer**: add Newbook, Guesty and Lodgify to the suites that "also sit in the channel
  manager and booking engine boxes".
- **Slide 37, Hostaway**: the training now teaches it as a PMS first (with channel manager, booking
  engine, pricing, messaging and upsells).
- **Slide 39, Atomize**: now sold as Mews RMS, part of Mews.
- **Slide 40, Lighthouse**: it also sells pricing and, for small independents, a channel manager,
  booking engine and reservation management.
- **Slide 41, GoHighLevel**: "with texting and chat built in", which the training lists as guest
  messaging.

## Thin evidence, so check before a slide says it

- **Lodgify, upsell**: its sales page says guests see add-ons "in their guest app", but the help
  centre only describes add-ons at checkout. The guest app is on the Ultimate plan only.
- **Lighthouse, PMS**: sold as "Reservation Management" in the Complete plan, never called a PMS.
- **HubSpot, guest messaging**: live chat is in every plan; SMS and WhatsApp need paid hubs.
- **WebRezPro, dynamic pricing**: rules on its own availability only; market-driven pricing comes
  through partners.
- **Cendyn**: its site blocks automated reading, so the channel manager (through its CRS) and the
  absence of guest messaging rest on Dec 2025 archive copies.

## Outside the tools, noticed in passing

- **Slide 49** says "What the team sees is how we did as a group, and which terms need another look."
  The portal has no group view: the check shows each person only their own results, and CLAUDE.md
  says not to add a cross-person view without asking.
