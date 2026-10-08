> The handoff record for the vendor icons, kept next to the sort brief like `PROMPT.md`. Nothing here
> is read by the app. In the portal the icons are `public/vendor-icons/128/<slug>.png` and
> `public/vendor-icons/512/<slug>.png`, and the manifest (this file's `logos.json`) is
> `src/data/vendor-icons.json`: a copy of the Claude project's `vendor-icons-manifest.json`, replaced whole,
> never edited here. See `docs/dictionary-tools.md`. The `claude/…` paths below are the Claude project's.

# Industry Acumen: vendor icons (tools slides, tool check, tool practice, sort page)

Written 5 October 2026 by Claude for Kyle. Read this first if you are building anything that shows a vendor's icon: the session 2 tools slides, the hgmportal tool check and tool practice pages, or the sort page.

## Status

- 44 vendor icons are finished and share one design. They replace the two-letter monograms on the eight tools slides (slides 36 to 43 of the session 2 deck).
- Kyle identified every icon himself. Six matches were corrected on 5 October (below).
- One icon is still unconfirmed: **Mews** (a pink tile with a three-ellipse mark). Mews' own site shows a black wordmark. Kyle to look at it by eye. [NEEDS INPUT: Kyle]
- The icons are not yet confirmed to be in the full session 2 deck. The project's deck JSON already carries a `logo` path on every card (see "Two logo sets" below), so this is a file swap and a rebuild, not a JSON change.

## What is in the project

The project stores text files only, so the images are packed into one JSON file and unpacked by a script.

| File | What it is |
|---|---|
| `claude/vendor-icons-512.b64.json` | All 44 icons as base64 PNG, 512 by 512 px, `{slug: base64}`. Palette-quantised to 256 colours to keep the file under half a megabyte; at 512 px the loss is not visible. |
| `claude/vendor-icons-manifest.json` | The manifest. `card_name_to_slug` maps a vendor name exactly as written on the deck's tools slides to a slug. Each vendor entry has display name, alt text, tile type, background colour, tool categories, the slides it appears on, and a confidence flag. |
| `claude/vendor_icons_unpack.py` | Writes `logos/` (512 px), `logos-128/` (128 px), `logos.json`, and with `--deck-names` a `deck/` folder named the way the session 2 build expects. |
| `claude/vendor_icons_make_tiles.py` | Reference only. The tile maker, with the source-image-to-vendor table in its header. The 45 source images are not stored here. |
| `claude/logo_map.json` | Pre-existing: vendor name to the deck build's file path (hyphenated names such as `oracle-opera-cloud.png`). Different naming from the slugs below; do not mix the two. |

To get the files out (any Claude Code session or local checkout with the project files):

```
python3 claude/vendor_icons_unpack.py --out vendor-icons --deck-names
```

That gives `vendor-icons/logos/<slug>.png`, `vendor-icons/logos-128/<slug>.png`, `vendor-icons/logos.json` and `vendor-icons/deck/<deck-name>.png` (45 files; Amadeus is written twice because the deck lists iHotelier and Demand360 separately). It needs Pillow.

## Slugs (the 44 icons)

airdna, akia, amadeus, atomize, beyond, canary, cendyn, cloudbeds, derbysoft, duetto, duve, enso, gohighlevel, google, guesty, hostaway, hubspot, ideas, keydata, kipsu, klaviyo, lighthouse, littlehotelier, lodgify, mailchimp, mews, newbook, nor1, oaky, oracle, plusgrade, pricelabs, rategain, revinate, rmscloud, roompricegenie, sabre, siteminder, staah, str, upsellguru, webrezpro, wheelhouse, whistle.

Look the slug up from the vendor name, never by guessing: `logos.json["card_name_to_slug"]["Oracle OPERA Cloud"]` is `oracle`. The map covers every name on the deck's tools slides and in the sort cards v2.0 (including "Sabre SynXis", "Amadeus iHotelier", "Amadeus Demand360", "STR, part of CoStar", "Nor1", "UpsellGuru"). The v1.0 sort cards used "SynXis (Sabre)" and "Nor1 (Oracle)"; those two spellings are not in the map, so use v2.0.

## The design rule (so new icons match)

Every icon is a 512 px rounded square, corner radius about 17% of the width. The mark is re-centred and scaled into the same safe area on every tile: symbols about 58% of a colour tile and 68% of a white tile; round marks about 72% and 80%; wordmarks at most 74% wide and 40% tall. Where the supplied icon had a brand-colour background, the tile uses it (brand-colour tile). Where the mark sat on white, the tile is white with a hairline grey border (white tile), so it still reads on a white card and in dark mode. To add a vendor later: crop to the mark, scale it into that safe area, put it on the brand colour (or white with the border), round the corners.

## Corrections of 5 October

My first pass matched six supplied images to the wrong vendors, by elimination. Kyle supplied the right match for each. They were swaps among images he had already sent, not new artwork.

- Cendyn: the black infinity loop
- Beyond: the dark teal house with the light teal price tag
- PriceLabs: the coral circle with white `<>` chevrons
- SiteMinder: the blue slanted S
- RMS Cloud: the blue gradient circular S (its source has a faint pale-blue fade behind it, flattened to white)
- Oracle OPERA Cloud: the teal tile with a white cloud and service bell

The manifest records these as `identified (supplied by Kyle)`. Mews is the only entry still marked `check by eye`. All other matches were made by looking at the images and checking vendor image results, because the upload order did not follow Kyle's list.

## Two logo sets: decide before rebuilding the deck

The project's session 2 build log (`claude/sessions_industry-acumen-deck-s2-build.md`, 5 October, afternoon) says the deck's 45 logo PNGs were extracted from tool slides Kyle sent, kept in `renderer/assets/logos/`, and mapped by `claude/logo_map.json`. That set is not stored in the project, and I have not seen it. The icons in this file are a separate, normalised set made the same day from the images Kyle then uploaded individually: same size, padding and corner radius on every tile.

If the normalised set is the one to ship, unpack with `--deck-names` into `renderer/assets/logos/` (it overwrites the older files by name) and rebuild. If the older set is already uniform, keep it and use this pack only for the portal. [NEEDS INPUT: Kyle]

The renderer needs nothing new: the project's `claude/hgm-training-1.5.0.patch` already draws a square PNG filling the whole tile and fits a non-square mark on the neutral tile. All 44 icons here are square. The extra 1.5.1 patch I produced in the chat is therefore not needed and is not stored.

## Using the icons in the hgmportal pages

The icons are static files on HGM's own origin, so the sort page's "no calls after load, nothing stored or sent" rule still holds. Put them at something like `/assets/vendor-icons/` and keep the file names. For the sort page and the tool check, add one field to each card in the data file rather than changing the code that draws it:

```json
{"vendor": "Mews", "box": "pms", "logo": "mews"}
```

Fill it from the manifest, and fail loudly on any card with no match.

Where the icon goes:

- Sort page, rounds 1 and 2: icon on the left of each vendor card, name beside it, 40 px on a phone. The card must still read at 16 px text on a 360 px screen.
- Sort page, round 3: show the suite's icon large above its box (96 px).
- Tool practice mode (flashcards): icon on the front with the name hidden for a recognition question, then name and box on the back. Keep a second card type with the name shown, since the aim is to link the brand to its box.
- Tool check: icon next to the name, not instead of it, so a question about a box is never also a test of eyesight. The weakest-tool list at the end can show the icon beside each name.
- `?present` view: the 512 px files. Everywhere else: the 128 px files.

Accessibility: when the vendor name is printed next to the icon, give the image `alt=""` so a screen reader does not say it twice. When the icon is on its own, use the `alt` text from the manifest ("Mews logo"). Do not rely on the icon colour to mark a right or wrong answer.

A prompt to paste into Claude Code:

> `claude/vendor_icons_unpack.py` unpacks 44 vendor icons from the project. Run it with `--out vendor-icons`, then copy `logos/` and `logos-128/` to `/assets/vendor-icons/` on the Netlify site. In `industry-acumen-sort-cards.json`, add a `logo` field to every vendor card and every round 3 suite, filled from `logos.json["card_name_to_slug"]` using the card's `vendor` name. Add to `check-cards.js` a rule that every card has a `logo` that resolves to a file, and fail loudly otherwise. Show the icon at 40 px beside the vendor name on each card (`alt=""`, because the name is printed beside it), and at 96 px above the suite box in round 3. Use the 128 px file for the small sizes and the 512 px file for `?present`. Keep everything static: no new network calls, nothing stored. Do not change any wording. Then do the same for the tool check and tool practice pages.

## Notes on specific icons

- IDeaS and Atomize came as banners with a tagline underneath ("A SAS company", "A Mews company"). The tagline is cropped off. Atomize now says it is a Mews company; the Atomize card on the deck may be stale. [VERIFY]
- STR, part of CoStar uses CoStar's pentagon mark.
- Google uses the Google Shopping tag mark Kyle supplied. If it ever leaves an internal page, follow Google's brand rules.
- Amadeus has one icon, used for Amadeus iHotelier and Amadeus Demand360.
- Kipsu, UpsellGuru and Plusgrade came from small source images. They look fine at 128 px; check them at 512 px in the presenter view.
- The Cendyn mark is wide and thin, so it looks a little small beside the other white tiles. Same sizing rule as every other tile; enlarge if wanted.
- These are the vendors' trademarks, used only to identify their products on internal training pages. Do not use them on client-facing material or in marketing.

## Not stored here

The 45 source images (Kyle has them in the chat uploads), the eight-slide preview deck, and the contact sheet. The preview deck was only a check; the real slides come from the full deck build. If a contact sheet is wanted, `vendor_icons_unpack.py` plus a few lines of Pillow will make one.
