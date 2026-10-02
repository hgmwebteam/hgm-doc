---
title: Sort the stack — vendor check, 2 Oct 2026
status: findings for Kyle and Nicole; nothing in the data file has been changed
method: each entry checked against the vendor's own website by one researcher, then re-checked by an independent second agent trying to refute it (quotes re-fetched and string-matched); 18 agents, 0 failures
---

# Sort the stack: what the vendors' own sites say

The data file (`src/data/industry-acumen-sort-cards.json`) is a copy of the Claude project's master,
so nothing has been edited here. Fix the master, then copy it in. The game refuses to play while any
entry is `verify: true`, which is working as intended.

## The short version

| Entry                             | Box                                                                                         | Note                             | What to change                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| DerbySoft (r1)                    | Right: channel manager                                                                      | Mostly right                     | Optional: "hotel chains" is the vendor's own wording, not "larger hotels"                   |
| Amadeus iHotelier (r1)            | Right: booking engine                                                                       | Right, incomplete                | **Add `channel-manager` to also**: Amadeus sells "iHotelier Channel Manager"                |
| Lodgify (r1)                      | Right: booking engine                                                                       | Partly                           | **Add `pms` to also**: Lodgify calls itself "#1 short-term rental PMS"                      |
| AirDNA (r2)                       | Right: rate shopping and market intelligence                                                | Right                            | Optional: it launched Adapt (dynamic pricing) on 1 Sep 2026, but round 2 has no pricing box |
| GoHighLevel (r2)                  | Right: CRM                                                                                  | Right                            | Decide on `guest-messaging` as an also: it sells two-way SMS and web chat                   |
| UpsellGuru (r2)                   | Right: upsell                                                                               | Right                            | None for the card; **don't link to upsellguru.com** (see below)                             |
| SiteMinder suite (r3)             | Its 3 jobs are right; **Little Hotelier is SiteMinder's PMS** (the flagged question passes) | Right, incomplete                | **3 of its 4 distractors are things it sells**                                              |
| Cloudbeds suite (r3), not flagged | Its 4 jobs are right                                                                        | Right                            | **It sells all 4 distractors**: no wrong answer is left                                     |
| Mews suite (r3), not flagged      | Its 2 jobs are right                                                                        | **Second sentence is now false** | **3 of its 4 distractors are things it sells**                                              |

Two round-1 cards that weren't flagged are affected by the same findings:

- **Mews** (box `pms`, also `booking-engine`). Mews now sells its own channel manager and its own
  pricing, and round 1 has both boxes. Add `channel-manager` and `dynamic-pricing` to also, or a
  right answer is marked wrong. Its note also understates it.
- **SiteMinder** (box `channel-manager`, also `booking-engine`). It sells Dynamic Revenue Plus, and
  a PMS through Little Hotelier, and round 1 has both boxes. Consider `dynamic-pricing` (and `pms`) as also.

**Round 3 needs re-thinking, not tweaking.** Its premise, that distractors are "the jobs the suite does
not do", no longer holds for these three suites in 2026: each sells most of the eight jobs, many as
paid add-ons. The decision is a content call, and the options are below.

## Round 3: the options

1. **Re-author it around "core vs add-on".** Players drag in what the suite is _known for_ (what's in
   the base plan), and the add-ons become the lesson in the note: "Cloudbeds sells pricing and a CRM
   too, as paid add-ons, so ask what they've switched on." That keeps the point of the round, that
   "we're on Cloudbeds" doesn't tell you what they use it for.
2. **Swap in suites with a genuinely narrow scope**, where the distractors are true.
3. **Drop round 3 for now** and ship rounds 1 and 2 (with the also fixes above).

Whichever you choose, the master's notes for Mews (and the "since it bought Whistle" line for
Cloudbeds, which is fine) need a look.

## The evidence, entry by entry

Quotes are from the vendors' own pages, fetched 2 Oct 2026. Some sites block plain fetches
(Cloudflare); those were read in a headless browser.

### DerbySoft: box right, note mostly right

- Channel manager is the right box among the eight. DerbySoft's blog calls its product a "channel
  management system". Property Connector "Enables properties to connect to 500+ channels and manage
  Rates, Availability, and Inventory across channels on one platform through their PMS".
  ([property-connector](https://www.derbysoft.com/property-connector/),
  [streamlined-connectivity](https://www.derbysoft.com/streamlined-connectivity/))
- The note says "larger hotels". DerbySoft's main product is for "hotel chains", and Property
  Connector is "Designed for individual hotels and small groups". A fairer note: "Connects hotel
  chains, and independent hotels through Property Connector, to the channels they sell through."
- Since 1 June 2026, Juniper Group (Constellation Software) has owned a majority of DerbySoft, which
  still runs independently. The note doesn't mention ownership, so nothing is wrong.

### Amadeus iHotelier: box right, add channel manager as an also

- The booking engine is confirmed: "The iHotelier Booking Engine helps hotels capture demand directly
  on their website".
  ([ihotelier-booking-engine](https://www.amadeus-hospitality.com/solutions/reservations-and-guest-management/ihotelier-booking-engine/))
- Amadeus' iHotelier terms define "iHotelier OTA Sync" as "a channel management service", later named
  "iHotelier Channel Manager". The suite promises "OTA management through a centralized platform
  integrated with iHotelier CRS and PMS". That is the channel manager's job line, so a player who puts
  it there is right. ([legal terms](https://www.amadeus-hospitality.com/legal/mssa/product/ihotelier/),
  [suite](https://www.amadeus-hospitality.com/solutions/reservations-and-guest-management/ihotelier-suite/))
- The note is true but leaves out the CRS, which Amadeus treats as iHotelier's core.

### Lodgify: box right, add PMS as an also

- Its own homepage says "#1 short-term rental PMS since 2012". The PMS page says "See reservations
  from Airbnb, Vrbo, Booking.com and your direct website in a single view."
  ([lodgify.com](https://www.lodgify.com/),
  [property-management-software](https://www.lodgify.com/property-management-software/))
- The booking engine and channel manager are both confirmed ("Our booking engine can easily be
  embedded on any CMS"; "We connect via API to Airbnb, Vrbo, Booking.com and Expedia").
- The note calls it "a vacation-rental website". It's software that builds the site or adds a booking
  widget to an existing one. Guest messaging (an "AI-powered unified inbox" in every plan) is a fair
  second also.

### AirDNA: box and note right

- "the leading provider of data and analytics for the … short-term rental industry"; "See how you
  compare to booked and available rates in your comp set". ([about](https://www.airdna.co/about),
  [comps](https://www.airdna.co/short-term-rental-comps))
- New since 1 Sep 2026: Adapt, its own dynamic pricing ("Dynamic pricing built on a decade of market
  data"). Round 2 has no pricing box, so the game isn't affected. Mention it in the note if you like.
  ([adapt](https://www.airdna.co/adapt))

### GoHighLevel: box and note right

- "The Agency CRM designed for you" ([crm](https://www.gohighlevel.com/crm)). HGM's use is confirmed
  from this repo: the server-only `ghl_integrations` table, the landing-page directory, the
  LeadConnector chat widget, and the dictionary's own "HGM's own CRM is GoHighLevel".
- It also sells two-way SMS and web chat, and round 2 has a Guest messaging box. Its own
  travel/hospitality playbook says "Install the SMS Webchat Widget on the Travel/Hospitality
  business's website". Decide whether `guest-messaging` is an also.

### UpsellGuru: box and note right

- "Set the range, let guests bid, and everyone wins." ([pre-arrival](https://upsellguru.com/pre-arrival-upselling/))
- **Site warning.** Every upsellguru.com page the researcher downloaded (with scripts not run)
  contains a hidden, scrambled script that loads code from an address kept in a DNS record. That's a
  common sign of a compromised WordPress site, so don't put a link to it in front of players. Its FAQ
  also still shows template text ("[name your actual top integrations here …]").

### SiteMinder suite: the flagged question passes; the distractors don't

- **Little Hotelier is SiteMinder's.** The littlehotelier.com footer reads "© 2026 SiteMinder
  Limited", and SiteMinder's press release calls Little Hotelier "an all-in-one hotel management
  software". So PMS stays in `does`. ([littlehotelier.com](https://www.littlehotelier.com/))
- But it sells three of the four distractors:
    - **Dynamic pricing**: Dynamic Revenue Plus, an optional add-on on the pricing page.
      ([pricing](https://www.siteminder.com/pricing/))
    - **Guest messaging**: Guest Engagement, from its GuestJoy acquisition: "Consolidate your various
      communication channels … email, SMS, WhatsApp, Booking.com, and Airbnb."
    - **Upsell**: Guest Engagement and a hotel upselling tools page.
- It also placed second for "Rate Shopping & Market Intelligence" in the 2026 HotelTechAwards.
  ([news](https://www.siteminder.com/news/hotel-tech-awards-2026/)) Only CRM holds as a distractor.

### Cloudbeds suite: sells all eight jobs

- All four claimed jobs are confirmed, including guest messaging through Cloudbeds Guest Experience
  (formerly Whistle, bought June 2022).
- It also sells:
    - **Dynamic pricing and rate shopping**, both in Cloudbeds RMS: "See what to charge and why, then
      accept it, edit it, or let Autopilot run it" and "what the compset is charging, all on the same
      calendar". ([revenue-management-system](https://www.cloudbeds.com/revenue-management-system/))
    - **CRM**: Guest Marketing CRM, "Unified guest profiles … preferences, bookings, and lifetime spend".
      ([hotel-crm-solution](https://www.cloudbeds.com/hotel-crm-solution/))
    - **Upsell**: one-click upsells in the booking engine, and a guest portal.
- Most of these are paid add-ons, and its Flex plan lets a property "Bring your own distribution".
  That supports the note's "Ask".

### Mews suite: three distractors wrong, note out of date

- **Channel manager**: "Mews Channel Manager, powered by SiteMinder", officially live since 19 Aug 2026
  ("Skip the extra tool and adding a new vendor").
  ([product](https://www.mews.com/en/products/mews-channel-manager),
  [release](https://releases.mews.com/en/access-400-otas-and-other-booking-channels-all-inside-mews-channel-manager-powered-by-siteminder))
- **Dynamic pricing**: Mews bought Atomize on 21 Nov 2024. "Mews RMS is an entirely new fully native
  revenue management solution within Mews, built on Atomize's proven revenue optimization engine",
  and atomize.com now redirects to it. ([press](https://www.mews.com/en/press/mews-acquires-atomize),
  [rms](https://www.mews.com/en/products/revenue-management-system))
- **Upsell**: the booking engine sells "parking, room upgrades, early check-in or late check-out", and
  there's a Mews Upsells product.
- So the note's "The channel manager and the pricing come from somewhere else" is false today. CRM is
  borderline (Mews' Guest Intelligence keeps stay history and spend).
