"""Builds check-bank.json and the review copy for the Industry Acumen check.

Every numeric answer is computed here from the item's own inputs, never typed,
and the validator at the bottom fails the build if any rule in the plan is broken.
Run: python3 build_check_bank.py
"""
import json, re

# ---------------------------------------------------------------- tiers (from ref_dictionary-v2-253.json, 1 Oct)
A = """adr-average-daily-rate ancillary-revenue comp-set denial flow-through noi-net-operating-income regret
revenue-management-the-function revpar-revenue-per-available-room orphan-night rate-parity metasearch booking-curve
effective-otb lead-time pace transient-vs-group cap-rate first-party-data cannibalization capi-conversions-api
cpm-cost-per-mille effective-commission-ec incrementality utm crm-tools guest-messaging-tools
rate-shopping-and-market-intelligence-tools the-tools-map upsell-tools""".split()
B = """boutique capture-rate ebitda flagged occupancy the-profit-ladder dynamic-pricing overbooking package-rate rack-rate
rate-fence rate-plan rate-shopping resort-fee-amenity-fee soft-dates airbnb-host-only-vs-split-fee booking-com-genius
channel-mix crs-central-reservation-system changeover-day date-classes drive-market-vs-fly-market feeder-market
midweek-gap otb-on-the-books pickup search-vs-discovery-demand shoulder-season slow-season flag franchise
keys-rooms-and-units room-type who-you-are-talking-to cancellation-rate guest-lifetime-value pre-arrival-sequence
repeat-rate review-score attribution-window blended-cpb click-vs-view-through cpa cpb-cost-per-booking
creative-fatigue-index deliverability email-click-rate email-open-rate frequency hold-rate hook-rate impressions
incremental-cpb landing-page-conversion-rate pixel reach retargeting-vs-prospecting roas-return-on-ad-spend
otas-and-niche-marketplaces opportunity-cost""".split()
assert len(A) == 30 and len(B) == 60
TIER = {**{s: "A" for s in A}, **{s: "B" for s in B}}

def m(n):  # money
    return f"${n:,.2f}".replace(".00", "") if n != int(n) else f"${int(n):,}"
def pct(x, d=1):
    s = f"{x:.{d}f}".rstrip("0").rstrip(".")
    return s + "%"

items = []
def add(**kw):
    items.append(kw)

ILL = "All figures are illustrative."

# ================================================================ CORE — word problems (each blank is its own term)
def wp_month(rooms, nights, sold, room_rev, spa, fnb, other, bookings, ota_comm, ad_spend, cancelled, ly_room_rev, month):
    avail = rooms * nights
    total = room_rev + spa + fnb + other
    occ = sold / avail * 100
    adr = room_rev / sold
    revpar = room_rev / avail
    anc = total - room_rev
    table = [
        ["Rooms (keys)", f"{rooms}"], ["Nights in the month", f"{nights}"],
        ["Room nights sold (after cancellations)", f"{sold:,}"],
        ["Room nights cancelled before arrival", f"{cancelled}"],
        ["Bookings", f"{bookings:,}"],
        ["Room revenue", m(room_rev)], ["Spa revenue", m(spa)], ["Restaurant and bar revenue", m(fnb)],
    ] + ([["Activities and retail revenue", m(other)]] if other else []) + [
        ["Total revenue", m(total)],
        ["OTA commission paid", m(ota_comm)], ["Meta ad spend", m(ad_spend)],
        [f"Room revenue, {month} last year", m(ly_room_rev)],
    ]
    return {
        "prompt": f"An owner sends you their {month} numbers. Work out the four figures below. Not every row is needed. {ILL}",
        "table": table,
        "blanks": [
            {"id": "occ", "term": "occupancy", "label": "Occupancy", "answer": round(occ, 1), "unit": "%", "tolerance": 0.5,
             "explanation": f"Rooms sold ÷ rooms available: {sold:,} ÷ ({rooms} × {nights} = {avail:,}) = {pct(occ)}. Cancelled nights are already out of the sold figure."},
            {"id": "adr", "term": "adr-average-daily-rate", "label": "ADR", "answer": round(adr, 2), "unit": "$", "tolerance": 0.5,
             "explanation": f"Room revenue ÷ rooms sold: {m(room_rev)} ÷ {sold:,} = {m(round(adr,2))}. Spa and restaurant revenue never go into ADR, and bookings aren't room nights."},
            {"id": "revpar", "term": "revpar-revenue-per-available-room", "label": "RevPAR", "answer": round(revpar, 2), "unit": "$", "tolerance": 0.5,
             "explanation": f"Room revenue ÷ rooms available: {m(room_rev)} ÷ {avail:,} = {m(round(revpar,2))} (check: ADR × occupancy)."},
            {"id": "anc", "term": "ancillary-revenue", "label": "Ancillary revenue", "answer": anc, "unit": "$", "tolerance": 0.5,
             "explanation": f"Everything beyond the room: {m(total)} total − {m(room_rev)} room revenue = {m(anc)}."},
        ],
    }

add(id="wp-month", type="wordproblem", variants=[
    dict(id="wp-month-v1", **wp_month(60, 30, 1350, 418500, 54000, 81000, 0, 540, 36450, 8000, 60, 370000, "April")),
    dict(id="wp-month-v2", **wp_month(80, 30, 1560, 390000, 36000, 84000, 30000, 624, 42900, 6500, 75, 352000, "November")),
])

def wp_ads(spend, impr, reach, link, allclicks, leads, bookings, rev, pixel_roas):
    cpm = spend / impr * 1000; freq = impr / reach; cpb = spend / bookings; ec = spend / rev * 100
    return {
        "prompt": f"Here's one month of a resort's Meta ads. No promo codes or discounts were used. Work out the four figures below. Not every row is needed. {ILL}",
        "table": [["Ad spend", m(spend)], ["Impressions", f"{impr:,}"], ["Reach (people)", f"{reach:,}"],
                  ["Link clicks", f"{link:,}"], ["All clicks", f"{allclicks:,}"], ["Leads (email sign-ups)", f"{leads}"],
                  ["Direct bookings attributed to the ads", f"{bookings}"], ["Value of those bookings", m(rev)],
                  ["Pixel ROAS Meta reports", f"{pixel_roas}"]],
        "blanks": [
            {"id": "cpm", "term": "cpm-cost-per-mille", "label": "CPM", "answer": round(cpm, 2), "unit": "$", "tolerance": 0.05,
             "explanation": f"(Ad spend ÷ impressions) × 1,000: ({m(spend)} ÷ {impr:,}) × 1,000 = {m(round(cpm,2))}. Per thousand impressions, not per thousand people."},
            {"id": "freq", "term": "frequency", "label": "Frequency", "answer": round(freq, 2), "unit": "", "tolerance": 0.05,
             "explanation": f"Impressions ÷ reach: {impr:,} ÷ {reach:,} = {round(freq,2)}."},
            {"id": "cpb", "term": "cpb-cost-per-booking", "label": "CPB (cost per booking)", "answer": round(cpb, 2), "unit": "$", "tolerance": 0.5,
             "explanation": f"Ad spend ÷ attributed bookings: {m(spend)} ÷ {bookings} = {m(round(cpb,2))}. Leads aren't bookings."},
            {"id": "ec", "term": "effective-commission-ec", "label": "Effective commission", "answer": round(ec, 1), "unit": "%", "tolerance": 0.5,
             "explanation": f"Cost of winning the bookings ÷ their value: {m(spend)} ÷ {m(rev)} = {pct(ec)}. A percentage of booking value, so it sits on one line with an OTA's commission."},
        ],
    }

add(id="wp-ads", type="wordproblem", variants=[
    dict(id="wp-ads-v1", **wp_ads(4800, 400000, 160000, 3200, 5600, 120, 16, 40000, 9.1)),
    dict(id="wp-ads-v2", **wp_ads(7500, 500000, 250000, 6000, 8000, 180, 30, 75000, 11.4)),
])

# ================================================================ CORE — standalone numeric
def flow(ty_rev, ly_rev, ty_rooms, ly_rooms, ty_gop, ly_gop, ty_noi, ly_noi, ty_occ, ly_occ, month):
    ft = (ty_gop - ly_gop) / (ty_rev - ly_rev) * 100
    return {"prompt": f"An owner compares {month} with {month} last year. What was the flow-through on the extra revenue? Answer as a percentage. Not every row is needed. {ILL}",
            "table": [["", "This year", "Last year"], ["Total revenue", m(ty_rev), m(ly_rev)], ["Room revenue", m(ty_rooms), m(ly_rooms)],
                      ["GOP", m(ty_gop), m(ly_gop)], ["NOI", m(ty_noi), m(ly_noi)], ["Occupancy", f"{ty_occ}%", f"{ly_occ}%"]],
            "answer": round(ft, 1), "unit": "%", "tolerance": 0.5,
            "explanation": f"Change in GOP ÷ change in total revenue: ({m(ty_gop)} − {m(ly_gop)}) ÷ ({m(ty_rev)} − {m(ly_rev)}) = {m(ty_gop-ly_gop)} ÷ {m(ty_rev-ly_rev)} = {pct(ft)}. NOI and room revenue aren't the flow-through inputs."}
add(id="flow-through", type="numeric", term="flow-through", variants=[
    dict(id="flow-through-v1", **flow(820000, 700000, 560000, 490000, 268000, 232000, 180000, 160000, 78, 72, "June")),
    dict(id="flow-through-v2", **flow(1250000, 1100000, 830000, 760000, 410000, 377000, 290000, 275000, 81, 77, "August")),
])

def noi(gop, fee, tax, ins, interest, dep, extra_label, extra):
    v = gop - fee - tax - ins
    return {"prompt": f"From a lodge's annual P&L, what is NOI? Not every line is needed. {ILL}",
            "table": [["GOP", m(gop)], ["Management company fee", m(fee)], ["Property tax", m(tax)], ["Insurance", m(ins)],
                      ["Mortgage interest", m(interest)], ["Depreciation", m(dep)], [extra_label, m(extra)]],
            "answer": v, "unit": "$", "tolerance": 0.5,
            "explanation": f"GOP − management fees − fixed charges (property tax and insurance): {m(gop)} − {m(fee)} − {m(tax)} − {m(ins)} = {m(v)}. Interest and depreciation come off below NOI."}
add(id="noi", type="numeric", term="noi-net-operating-income", variants=[
    dict(id="noi-v1", **noi(310000, 45000, 28000, 17000, 40000, 22000, "Room revenue", 640000)),
    dict(id="noi-v2", **noi(485000, 60000, 41000, 24000, 75000, 38000, "Spa revenue", 120000)),
])

def eotb(month, nonref, ref, cancel, stly, adr, pickup):
    v = nonref + ref * (1 - cancel / 100)
    return {"prompt": f"For {month}, an owner sends you this. What is the effective OTB, as a percentage of the month's nights? Not every row is needed. {ILL}",
            "table": [["On the books, non-refundable", f"{nonref}% of nights"], ["On the books, refundable", f"{ref}% of nights"],
                      ["Refundable bookings that usually cancel", f"{cancel}%"], ["On the books same time last year", f"{stly}%"],
                      ["ADR on the books", m(adr)], ["Pickup in the last 7 days", f"{pickup} room nights"]],
            "answer": round(v, 1), "unit": "%", "tolerance": 0.5,
            "explanation": f"Only refundable bookings are weighted: {nonref}% + {ref}% × (1 − {cancel/100:.2f}) = {nonref}% + {pct(ref*(1-cancel/100))} = {pct(v)}. Non-refundable bookings count in full."}
add(id="effective-otb", type="numeric", term="effective-otb", variants=[
    dict(id="effective-otb-v1", **eotb("August", 50, 40, 25, 82, 310, 46)),
    dict(id="effective-otb-v2", **eotb("October", 30, 40, 20, 66, 245, 28)),
])

def cap(price, noi_v, gop, rev, debt_label, debt):
    v = noi_v / price * 100
    return {"prompt": f"A buyer offers to buy a resort. What cap rate is the offer? Not every row is needed. {ILL}",
            "table": [["Offer price", m(price)], ["NOI, last twelve months", m(noi_v)], ["GOP, last twelve months", m(gop)],
                      ["Total revenue, last twelve months", m(rev)], [debt_label, m(debt)]],
            "answer": round(v, 1), "unit": "%", "tolerance": 0.05,
            "explanation": f"NOI ÷ price: {m(noi_v)} ÷ {m(price)} = {pct(v)}. GOP comes before the owner's fixed costs, so it isn't what a buyer prices on."}
add(id="cap-rate", type="numeric", term="cap-rate", variants=[
    dict(id="cap-rate-v1", **cap(17500000, 1225000, 1850000, 4200000, "Mortgage balance", 6000000)),
    dict(id="cap-rate-v2", **cap(22500000, 1800000, 2700000, 5600000, "Annual loan payments", 1100000)),
])

# ================================================================ CORE — buckets (each chip its own term)
BOX = ["CRM", "Guest messaging", "Rate shopping and market intelligence", "Upsell"]
add(id="tools-buckets", type="buckets", variants=[
    {"id": "tools-buckets-v1", "prompt": "Sort each vendor into the box for what it does.", "boxes": BOX,
     "chips": [{"text": "Cendyn", "term": "crm-tools", "box": "CRM"},
               {"text": "Duve", "term": "guest-messaging-tools", "box": "Guest messaging"},
               {"text": "Lighthouse (formerly OTA Insight)", "term": "rate-shopping-and-market-intelligence-tools", "box": "Rate shopping and market intelligence"},
               {"text": "Oaky", "term": "upsell-tools", "box": "Upsell"}],
     "explanation": "Cendyn holds guest data for marketing; Duve messages guests before and during the stay; Lighthouse watches comp-set rates; Oaky sells paid upgrades."},
    {"id": "tools-buckets-v2", "prompt": "Sort each job into the kind of tool that does it.", "boxes": BOX,
     "chips": [{"text": "Keeps past guests' stay history so you can email them an anniversary offer", "term": "crm-tools", "box": "CRM"},
               {"text": "Texts the guest two days before arrival with directions and the door code", "term": "guest-messaging-tools", "box": "Guest messaging"},
               {"text": "Shows what the resorts nearby are charging each night", "term": "rate-shopping-and-market-intelligence-tools", "box": "Rate shopping and market intelligence"},
               {"text": "Offers a paid suite upgrade by email three days before check-in", "term": "upsell-tools", "box": "Upsell"}],
     "explanation": "Guest records live in a CRM; one-to-one stay messages are guest messaging; competitors' prices are rate shopping; paid upgrades are upsell."},
])

# ================================================================ MCQ helper
def mcq(id, term, v1, v2, kind="scenario"):
    vs = []
    for i, (prompt, options, answer, expl) in enumerate((v1, v2), 1):
        vs.append({"id": f"{id}-v{i}", "prompt": prompt, "options": options, "answer": answer, "explanation": expl})
    add(id=id, type=kind, term=term, variants=vs)

# ================================================================ CORE — scenario MCQ
mcq("tools-map", "the-tools-map",
    ("An owner says: \"When I change a price in one place, it updates on Booking.com and Expedia within minutes.\" Which part of their stack is doing that?",
     ["Channel manager", "PMS", "Booking engine", "CRM"], "Channel manager",
     "The channel manager pushes rates and availability out to the OTAs. The PMS runs the property; the booking engine takes direct bookings."),
    ("An owner says: \"Guests book on our own website through the little calendar on the Stay page.\" Which part of their stack is that?",
     ["Booking engine", "Channel manager", "PMS", "Metasearch"], "Booking engine",
     "The booking engine takes direct bookings on the owner's own site. One vendor, such as Cloudbeds, can supply all three core pieces."))

mcq("comp-set", "comp-set",
    ("An owner says: \"When I check how we're doing, I look at the three other lakeside resorts within an hour of us — same kind of guest, same price band.\" What is she describing?",
     ["Comp set", "Feeder market", "Rate shopping", "Channel mix"], "Comp set",
     "A comp set is the group of properties an owner benchmarks against. Feeder markets are where guests come from."),
    ("An STR report says a resort filled better than the group of properties it benchmarks against. What is that group called?",
     ["Comp set", "Date classes", "Flagged properties", "OTB"], "Comp set",
     "The comp set is the basis of every index on an STR report."))

mcq("denial", "denial",
    ("An owner says: \"We were full every Saturday in July and still had people calling who we couldn't fit in.\" What are those callers?",
     ["Denials", "Regrets", "Orphan nights", "Pickup"], "Denials",
     "A denial is demand that tried to book and couldn't because the date was sold out. In a regret the room was available."),
    ("A booking engine logged 140 searches for New Year's Eve after the resort sold out. What are those searches?",
     ["Denials", "Regrets", "Cancellations", "Soft dates"], "Denials",
     "Searches that hit no availability are denials, the evidence an owner can use for raising the rate on those dates."))

mcq("regret", "regret",
    ("Hundreds of people looked at a resort's September weekends on the booking page and left without booking. Rooms were still open. What is that?",
     ["Regret", "Denial", "Orphan night", "Cannibalization"], "Regret",
     "Regret is demand that looked and left while rooms were available, usually on price. A denial is when the date is sold out."),
    ("An owner says: \"Lots of people check our holiday week, see the $650 rate and leave. We still have cabins.\" What is that?",
     ["Regret", "Denial", "Pace", "Rate parity"], "Regret",
     "They could have booked and chose not to, which is regret, and it points to price."))

mcq("rm-function", "revenue-management-the-function",
    ("An owner says: \"Pricing here? That's me on Sunday nights with a spreadsheet, plus a firm in Toronto that checks in every quarter.\" What is she describing?",
     ["Revenue management (the function)", "Dynamic pricing", "Rate shopping", "Comp set"], "Revenue management (the function)",
     "Revenue management is the job itself. At this ICP it's often the owner, a part-timer or an outside firm."),
    ("A GM says: \"Our outside firm decides our pricing strategy; Wheelhouse moves the rates day to day.\" Which pair is right?",
     ["The firm does revenue management; Wheelhouse is dynamic pricing", "The firm does dynamic pricing; Wheelhouse is revenue management",
      "Both are rate shopping", "The firm is the comp set; Wheelhouse is the channel manager"],
     "The firm does revenue management; Wheelhouse is dynamic pricing",
     "Revenue management is the job; dynamic pricing is one tool it may use."))

mcq("orphan-night", "orphan-night",
    ("An owner says: \"One booking checks out on the 14th and the next checks in on the 15th, so the night of the 14th is empty. With our two-night minimum, nobody can book it.\" What is the night of the 14th?",
     ["An orphan night", "A soft date", "A denial", "A changeover day"], "An orphan night",
     "A single night stranded between two bookings, often hard to sell because of the property's own minimum stay."),
    ("Cabin 4 is booked Friday to Sunday and again Monday to Thursday. Sunday night is empty, and there's a two-night minimum. What is Sunday night?",
     ["An orphan night", "Regret", "A shoulder season night", "A soft date"], "An orphan night",
     "It's a short gap the minimum-stay rule makes hard to sell. Relaxing min LOS for that date is often the fix."))

mcq("rate-parity", "rate-parity",
    ("An owner asks: \"Why can't I just put my rooms $20 cheaper on my own site than on Booking.com?\" Which term is most likely behind the answer?",
     ["Rate parity", "Rate fence", "Package rate", "Cannibalization"], "Rate parity",
     "Rate parity is a contractual commitment not to undercut an OTA's rate on your own site."),
    ("An Expedia contract says the public price on the owner's own site can't be lower than Expedia's. What is that clause?",
     ["Rate parity", "Rack rate", "Rate plan", "Metasearch"], "Rate parity",
     "That's rate parity. With it in place, owners compete on value-adds rather than a cheaper price."))

mcq("metasearch", "metasearch",
    ("A guest searched a resort's name on Google, saw its own rate next to Expedia's and Booking.com's, and clicked through to book direct. Where was she comparing?",
     ["Metasearch", "Rate shopping", "The tools map", "OTAs and niche marketplaces"], "Metasearch",
     "Metasearch compares rates and passes the guest on to a booking channel. It doesn't take the booking itself."),
    ("Trivago sent a resort 40 clicks last month, but every booking happened on Booking.com or the resort's own site. What is Trivago here?",
     ["Metasearch", "An OTA", "A CRS", "A booking engine"], "Metasearch",
     "Metasearch sites compare and pass the guest on; OTAs take the booking."))

mcq("booking-curve", "booking-curve",
    ("An owner says: \"Wedding weekends fill from January, but our summer leisure guests mostly book in the last six weeks.\" What are you comparing when you look at those two shapes?",
     ["Booking curves", "Pace", "Pickup", "OTB"], "Booking curves",
     "A booking curve is the shape reservations build in ahead of a stay date, and it differs by segment."),
    ("A chart line starts at 0% booked 120 days out and climbs to 92% on arrival day, steepest in the last three weeks. What is the line?",
     ["A booking curve", "Pace", "Effective OTB", "Date classes"], "A booking curve",
     "The shape over time for one stay date is the booking curve. Pace compares that shape with last year or target."))

mcq("lead-time", "lead-time",
    ("An owner says: \"Most of our leisure guests book about 21 days before they arrive.\" What is the 21 days?",
     ["Lead time", "Pace", "Pickup", "Shoulder season"], "Lead time",
     "Lead time is how far ahead of arrival a booking is made."),
    ("A guest first saw a resort on Instagram on February 19, booked on March 1, and arrives April 15 for a three-night stay. What's the lead time?",
     ["45 days", "55 days", "3 nights", "31 days"], "45 days",
     "Lead time runs from booking to arrival: March 1 to April 15 is 45 days. The Instagram date and length of stay don't count."), kind="mcq")

mcq("pace", "pace",
    ("An owner says: \"Today we're 58% booked for October. This time last year we were 51%.\" What is she reading?",
     ["Pace", "Pickup", "Effective OTB", "Occupancy %"], "Pace",
     "Pace compares bookings for a future date against last year or target. Here October is 7 percentage points ahead."),
    ("An owner says: \"We picked up 12 bookings this week.\" You ask: \"And how does that compare with this time last year?\" What are you asking about?",
     ["Pace", "Pickup", "The booking curve", "OTB"], "Pace",
     "Pickup is the raw count of new bookings; pace is how the position compares with last year or target."))

mcq("transient-group", "transient-vs-group",
    ("This July a lodge had 34 couples booking on their own through its site, plus one wedding that took 20 rooms under a contract. Which split is this?",
     ["Transient vs group", "Channel mix", "Drive vs fly market", "Feeder market"], "Transient vs group",
     "Individual bookings versus contracted blocks: two different businesses inside one property."),
    ("A wedding party's guests each book separately, but their rooms come out of a 20-room block in the couple's contract. Which is it?",
     ["Group — the rooms come from a contracted block", "Transient — each guest booked separately", "Neither — it's a buyout", "Both, half and half"],
     "Group — the rooms come from a contracted block",
     "If the rooms come from a contracted block, it's group business, however the guests book."))

mcq("first-party-data", "first-party-data",
    ("An owner says: \"When a guest books on our site we get their email and can invite them back next spring. With Expedia bookings we can't.\" What does the direct booking give her?",
     ["First-party data", "CAPI", "UTM tracking", "Rate parity"], "First-party data",
     "First-party data is guest data the property owns outright, which is most of why direct matters."),
    ("Which of these is the property's own first-party data?",
     ["Emails collected through its own booking engine", "Guest details Booking.com holds about its guests", "Meta's audience size estimates", "A comp set's occupancy from STR"],
     "Emails collected through its own booking engine",
     "Data the property collects and owns is first-party. What an OTA holds about its guests isn't, even if the owner can see some of it."))

mcq("cannibalization", "cannibalization",
    ("A resort sent a 15%-off code to its email list and got 40 bookings. Most were repeat guests who book that week every year anyway. What's the worry?",
     ["Cannibalization", "Incrementality", "Regret", "A rate fence"], "Cannibalization",
     "Cannibalization is taking bookings you'd have had anyway. Incrementality is the test for it."),
    ("An owner says: \"Our Genius discount brings in lots of bookings, but plenty of them are guests who'd have found us on Booking.com anyway.\" What is she describing?",
     ["Cannibalization", "Channel mix", "First-party data", "Attribution window"], "Cannibalization",
     "The numbers look like growth, but revenue has only moved around, at a higher cost."))

mcq("capi", "capi-conversions-api",
    ("Meta's reporting misses some bookings because some guests' browsers block the pixel. What sends the booking events from the server instead?",
     ["CAPI", "UTM", "The pixel", "The attribution window"], "CAPI",
     "CAPI sends events server-side, so they survive the browser blocking the pixel. The two run together."),
    ("A resort's pixel report shows browser events but zero server events. What's missing?",
     ["CAPI", "The pixel", "UTM tags", "First-party data"], "CAPI",
     "Browser events with no server events means no CAPI connection."))

mcq("incrementality", "incrementality",
    ("A resort switched off prospecting ads in one region for two weeks and compared bookings with a similar region where the ads kept running. What was it testing?",
     ["Incrementality", "Cannibalization", "Attribution window", "Frequency"], "Incrementality",
     "A holdout like this tests whether the ads caused the bookings, which is incrementality."),
    ("Meta says the ads drove 30 bookings. The owner asks: \"Would those people have booked anyway?\" What is the owner's question about?",
     ["Incrementality", "ROAS", "Click vs view-through", "CPM"], "Incrementality",
     "Attribution says which ad a booking followed; incrementality says whether the ad caused it."))

mcq("utm", "utm",
    ("Every link in a resort's October newsletter ends with ?utm_source=newsletter&utm_campaign=fall-escape. What are those tags called?",
     ["UTM tags", "Pixel events", "CAPI events", "Promo codes"], "UTM tags",
     "UTMs are link tags that make traffic traceable, so a booking can be traced back to the newsletter."),
    ("A guest clicks a UTM-tagged Instagram link, leaves, and comes back three days later by typing the resort's web address. Does the UTM credit the booking to Instagram?",
     ["No — the tag is on the link, not the person", "Yes — UTMs follow the guest for seven days", "Yes, as long as the pixel fired", "Only on mobile"],
     "No — the tag is on the link, not the person",
     "A UTM tags the link. If someone comes back by typing the address, the UTM doesn't follow them."), kind="mcq")

# ================================================================ REFERENCE — calculation MCQ (extra numbers on purpose)
mcq("capture-rate", "capture-rate",
    (f"Last month a lodge had 1,000 rooms occupied and 2,000 in-house guest nights. Its restaurant served 1,500 dinner covers: 700 to in-house guests and 800 to locals. Restaurant revenue was $63,000. What was the dinner capture rate? {ILL}",
     ["35%", "75%", "70%", "47%"], "35%",
     "Covers from in-house guests ÷ in-house guests: 700 ÷ 2,000 = 35%. Locals don't count, and it divides by guests, not rooms."),
    (f"A resort had 1,600 rooms occupied and 3,200 in-house guest nights last month. Its restaurant served 2,000 breakfast covers, 1,280 of them to in-house guests. What was the breakfast capture rate? {ILL}",
     ["40%", "64%", "80%", "62.5%"], "40%",
     "1,280 in-house covers ÷ 3,200 in-house guests = 40%."), kind="mcq")

mcq("pickup", "pickup",
    (f"Labour Day weekend: last Monday a lodge had 31 units on the books; today it has 39. Two cancellations this week are already reflected in today's number. It has 50 units. What was the pickup? {ILL}",
     ["8 units", "10 units", "11 units", "39 units"], "8 units",
     "OTB today − OTB at the last reading: 39 − 31 = 8. The 50 units and the cancellations (already in today's figure) don't change it."),
    (f"For a holiday week, a resort had 120 room nights on the books at the last reading and has 141 now, out of 200 available. ADR on the books is $280. What was the pickup? {ILL}",
     ["21 room nights", "59 room nights", "141 room nights", "70.5%"], "21 room nights",
     "141 − 120 = 21. What's left to sell (59) is a different number."), kind="mcq")

mcq("cancellation-rate", "cancellation-rate",
    (f"Last quarter a resort took 640 bookings, 400 of them through OTAs. 48 were cancelled before arrival and 12 more were no-shows. What was the cancellation rate? {ILL}",
     ["7.5%", "9.4%", "12%", "1.9%"], "7.5%",
     "Cancelled bookings ÷ total bookings: 48 ÷ 640 = 7.5%. No-shows are a separate measure, and the OTA count is a distractor."),
    (f"A lodge took 900 bookings last year, 300 of them direct. 81 were cancelled and 18 were no-shows. What was the cancellation rate? {ILL}",
     ["9%", "11%", "27%", "2%"], "9%",
     "81 ÷ 900 = 9%."), kind="mcq")

mcq("repeat-rate", "repeat-rate",
    (f"A resort hosted 1,500 guests on 600 bookings last year. 270 of the guests had stayed before, and its email list has 4,000 subscribers. What was the repeat rate? {ILL}",
     ["18%", "45%", "6.75%", "40%"], "18%",
     "Returning guests ÷ total guests: 270 ÷ 1,500 = 18%. Bookings and the email list aren't part of it."),
    (f"A lodge hosted 2,000 guests on 800 bookings. 240 guests had stayed before. What was the repeat rate? {ILL}",
     ["12%", "30%", "40%", "8.3%"], "12%",
     "240 ÷ 2,000 = 12%."), kind="mcq")

mcq("roas", "roas-return-on-ad-spend",
    (f"A month of Meta ads: spend $5,000, 400,000 impressions, 14 attributed bookings worth $35,000. The resort's total revenue that month was $210,000. What was the ROAS? {ILL}",
     ["7", "42", "$357", "14%"], "7",
     "Attributed revenue ÷ ad spend: $35,000 ÷ $5,000 = 7. Total revenue isn't attributed revenue; $357 is the cost per booking."),
    (f"A month of Meta ads: spend $9,000, attributed booking revenue $54,000, 18 attributed bookings. Room revenue for the month was $300,000. What was the ROAS? {ILL}",
     ["6", "33.3", "$500", "17%"], "6",
     "$54,000 ÷ $9,000 = 6."), kind="mcq")

mcq("incremental-cpb", "incremental-cpb",
    (f"Meta spend was $8,000 for 32 attributed bookings. A holdout test suggests 20 of them wouldn't have happened without the ads. What is the incremental CPB? {ILL}",
     ["$400", "$250", "$667", "$160"], "$400",
     "Spend ÷ bookings that wouldn't have happened without the ads: $8,000 ÷ 20 = $400. $250 is the blended CPB."),
    (f"Meta spend was $12,000 for 40 attributed bookings. A holdout suggests 24 were incremental. What is the incremental CPB? {ILL}",
     ["$500", "$300", "$750", "$1,000"], "$500",
     "$12,000 ÷ 24 = $500, higher than the $300 blended figure, as it usually is."), kind="mcq")

mcq("blended-cpb", "blended-cpb",
    (f"Total Meta spend was $10,000 for 40 attributed bookings. A holdout suggests 28 were incremental, and one ad set spent $2,000 of the total for 4 bookings. What is the blended CPB? {ILL}",
     ["$250", "$357", "$500", "$200"], "$250",
     "Total spend ÷ all attributed bookings: $10,000 ÷ 40 = $250. $357 is incremental; $500 is one ad set."),
    (f"Total Meta spend was $6,600 for 22 attributed bookings worth $55,000. What is the blended CPB? {ILL}",
     ["$300", "$2,500", "12%", "$333"], "$300",
     "$6,600 ÷ 22 = $300."), kind="mcq")

mcq("hook-rate", "hook-rate",
    (f"A Reel had 200,000 impressions, 50,000 three-second plays, 15,000 ThruPlays and 2,400 link clicks. Using the dictionary's formula, what was the hook rate? {ILL}",
     ["25%", "30%", "7.5%", "1.2%"], "25%",
     "3-second plays ÷ impressions: 50,000 ÷ 200,000 = 25%. 30% is the hold rate."),
    (f"A video ad had 120,000 impressions, 42,000 three-second plays and 10,500 ThruPlays. What was the hook rate? {ILL}",
     ["35%", "25%", "8.75%", "4×"], "35%",
     "42,000 ÷ 120,000 = 35%."), kind="mcq")

mcq("hold-rate", "hold-rate",
    (f"A video ad had 150,000 impressions, 36,000 three-second plays, 9,000 ThruPlays and 1,800 link clicks. Using the dictionary's formula, what was the hold rate? {ILL}",
     ["25%", "24%", "6%", "20%"], "25%",
     "ThruPlays ÷ 3-second plays: 9,000 ÷ 36,000 = 25%. 24% is the hook rate."),
    (f"A Reel had 80,000 impressions, 20,000 three-second plays and 8,000 ThruPlays. What was the hold rate? {ILL}",
     ["40%", "25%", "10%", "2.5×"], "40%",
     "8,000 ÷ 20,000 = 40%."), kind="mcq")

mcq("email-click-rate", "email-click-rate",
    (f"A newsletter was sent to 12,500 people. 12,000 were delivered, 5,400 were opened and 360 people clicked. What was the click rate? {ILL}",
     ["3%", "2.9%", "6.7%", "45%"], "3%",
     "Clicks ÷ delivered emails: 360 ÷ 12,000 = 3%."),
    (f"An email went to 8,400 people. 8,000 were delivered, 3,600 opened and 200 clicked. What was the click rate? {ILL}",
     ["2.5%", "2.4%", "5.6%", "45%"], "2.5%",
     "200 ÷ 8,000 = 2.5%."), kind="mcq")

mcq("lp-conversion", "landing-page-conversion-rate",
    (f"A landing page got 6,200 ad clicks, 5,000 sessions, 7,800 page views and 350 sign-ups. What was the landing-page conversion rate? {ILL}",
     ["7%", "5.6%", "4.5%", "14.3%"], "7%",
     "Conversions ÷ sessions: 350 ÷ 5,000 = 7%. Ad clicks and page views aren't sessions."),
    (f"A landing page had 2,400 sessions, 3,100 page views and 216 sign-ups. What was the conversion rate? {ILL}",
     ["9%", "7%", "11%", "70%"], "9%",
     "216 ÷ 2,400 = 9%."), kind="mcq")

mcq("channel-mix", "channel-mix",
    (f"A resort took 600 bookings last year: 150 direct, 270 through Booking.com, 120 through Expedia and 60 by phone. Booking.com charged $97,000 in commission. What share of bookings came through Booking.com? {ILL}",
     ["45%", "25%", "65%", "35%"], "45%",
     "Bookings by channel ÷ total bookings: 270 ÷ 600 = 45%."),
    (f"A lodge took 800 bookings: 280 direct, 320 Booking.com, 160 Expedia and 40 Airbnb. What share came through OTAs? {ILL}",
     ["65%", "60%", "35%", "40%"], "65%",
     "(320 + 160 + 40) ÷ 800 = 65%. Airbnb counts as an OTA."), kind="mcq")

mcq("cpa", "cpa",
    (f"A campaign's conversion is a newsletter sign-up. It spent $2,400, got 3,000 clicks, 120 sign-ups and 6 bookings. What was the CPA? {ILL}",
     ["$20", "$0.80", "$400", "$5"], "$20",
     "Ad spend ÷ conversions, where the conversion is the sign-up: $2,400 ÷ 120 = $20."),
    (f"A lead campaign spent $3,600 for 150 leads and 9 bookings. The defined conversion is a lead. What was the CPA? {ILL}",
     ["$24", "$400", "$0.04", "$16.67"], "$24",
     "$3,600 ÷ 150 = $24."), kind="mcq")

# ================================================================ REFERENCE — ordering
add(id="profit-ladder", type="ordering", term="the-profit-ladder", variants=[
    {"id": "profit-ladder-v1", "prompt": "Put the profit ladder in order, from the top of the P&L down.",
     "steps": ["Total revenue", "Departmental and undistributed costs come off", "GOP", "Management fees and fixed charges come off", "NOI"],
     "explanation": "Revenue → GOP (after departmental and undistributed costs) → NOI (after management fees and fixed charges)."},
    {"id": "profit-ladder-v2", "prompt": f"Put these lines from a lodge's P&L in order, top to bottom. {ILL}",
     "steps": ["$900,000 total revenue", "$310,000 GOP", "$215,000 NOI", "$140,000 after loan interest and depreciation"],
     "explanation": "Each rung is smaller than the one above. Debt and depreciation come off below NOI."},
])

# ================================================================ REFERENCE — matching (definitions pulled by slug)
MASK_EXTRA = {"overbooking": ["overbook"], "keys-rooms-and-units": ["keys"], "date-classes": ["date class"],
              "otb-on-the-books": ["on the books", "OTB"]}
def match(id, terms):
    add(id=id, type="matching", terms=terms, mask_extra={t: MASK_EXTRA[t] for t in terms if t in MASK_EXTRA}, variants=[
        {"id": f"{id}-v1", "prompt": "Match each term to its definition.", "match_on": "gloss"},
        {"id": f"{id}-v2", "prompt": "Match each term to the line you'd say on a call. The term is blanked in each line.", "match_on": "usage"},
    ])
match("match-rates", ["rack-rate", "rate-plan", "rate-fence", "package-rate", "resort-fee-amenity-fee", "overbooking"])
match("match-property", ["boutique", "flagged", "franchise", "keys-rooms-and-units", "room-type", "crs-central-reservation-system"])
match("match-demand", ["changeover-day", "date-classes", "feeder-market", "shoulder-season", "slow-season", "otb-on-the-books"])
match("match-marketing", ["impressions", "reach", "pixel", "deliverability", "email-open-rate", "attribution-window"])

# ================================================================ REFERENCE — true/false
def tf(id, term, s1, a1, e1, s2, a2, e2):
    add(id=id, type="truefalse", term=term, variants=[
        {"id": f"{id}-v1", "statement": s1, "answer": a1, "explanation": e1},
        {"id": f"{id}-v2", "statement": s2, "answer": a2, "explanation": e2}])
tf("ebitda", "ebitda",
   "On a current USALI P&L, the line owners still call NOI is labelled EBITDA.", True, "USALI renamed the old Net Operating Income line EBITDA; owners and buyers still say NOI.",
   "EBITDA is calculated before management fees come off.", False, "EBITDA is GOP − management fees − fixed charges, so the fees are already off.")
tf("genius", "booking-com-genius",
   "Booking.com Genius trades a discount for Genius members in exchange for more visibility on Booking.com.", True, "That's the deal: a member discount for more visibility.",
   "A property can join Genius without offering Genius members a discount.", False, "A property opts in by offering Genius members a discount.")
tf("airbnb-fee", "airbnb-host-only-vs-split-fee",
   "Under Airbnb's host-only fee, the whole service fee is charged to the host instead of being split with the guest.", True, "The split fee shares it; the host-only (single) fee puts all of it on the host.",
   "Airbnb is moving all hosts onto the split fee.", False, "It's the other way: Airbnb is moving all hosts to the single, host-only fee.")
tf("flag", "flag",
   "A property that operates under a chain's brand carries a flag.", True, "The flag is the chain brand; to be flagged is to carry one.",
   "Carrying a flag means a property is independent.", False, "A flag is a chain brand, the opposite of independent.")
tf("review-score", "review-score",
   "A property's review score affects where it ranks on OTAs.", True, "Review scores feed ranking and rate power on every OTA.",
   "Review scores matter on Google and Tripadvisor but have no effect on OTA ranking.", False, "They feed OTA ranking too.")
tf("glv", "guest-lifetime-value",
   "Guest lifetime value counts what a guest is worth across every stay, not just one booking.", True, "That's the definition, and why winning a guest the first time can justify a higher cost.",
   "Guest lifetime value is the value of a guest's first booking.", False, "It's their value across every stay.")
tf("otas-niche", "otas-and-niche-marketplaces",
   "Hipcamp and Glamping Hub are niche marketplaces, sitting alongside big OTAs like Booking.com and Expedia.", True, "Both are niche marketplaces in the same category as the big OTAs.",
   "Mr & Mrs Smith is a channel manager.", False, "Mr & Mrs Smith is a niche marketplace (owned by Hyatt since 2023), not a channel manager.")
tf("click-view", "click-vs-view-through",
   "A view-through booking followed someone seeing an ad without clicking it.", True, "Click-through followed a click; view-through followed only a view.",
   "In HGM's decision maths, view-through bookings count the same as click-through ones.", False, "HGM's decision maths uses 7-day click only; view-through is context.")

# ================================================================ REFERENCE — scenario MCQ
mcq("dynamic-pricing", "dynamic-pricing",
    ("An owner says: \"Our rates now change automatically every night depending on how fast dates are filling. We set it up through PriceLabs.\" What is this?",
     ["Dynamic pricing", "Rate shopping", "A rate fence", "Revenue management (the function)"], "Dynamic pricing",
     "Rates moving automatically with demand is dynamic pricing, the category PriceLabs and Wheelhouse sit in."),
    ("Wheelhouse raised a cabin's Saturday rate by $40 overnight because the weekend was filling fast. What kind of tool is Wheelhouse?",
     ["Dynamic pricing", "CRM", "Rate shopping", "Channel manager"], "Dynamic pricing",
     "Wheelhouse moves rates with demand. It doesn't create demand; it prices what's already there."))
mcq("rate-shopping", "rate-shopping",
    ("An owner says: \"Every Monday I check what the three resorts down the road are charging for the next month.\" What is she doing?",
     ["Rate shopping", "Building a comp set", "Dynamic pricing", "Reading pace"], "Rate shopping",
     "Watching what the comp set charges is rate shopping. The comp set is the group she watches."),
    ("A GM pays for a tool that emails him competitors' nightly rates every morning. What activity is it doing for him?",
     ["Rate shopping", "Pickup reporting", "Dynamic pricing", "Metasearch"], "Rate shopping",
     "It automates rate shopping. Useful context, as long as it isn't the only thing setting the price."))
mcq("soft-dates", "soft-dates",
    ("The first two weeks of November are pacing 15 percentage points behind last year. Going on the pacing alone, what are those dates?",
     ["Soft dates", "Shoulder season", "Orphan nights", "Denials"], "Soft dates",
     "Dates pacing below target or last year are soft dates, the best place to aim promotions."),
    ("You have $3,000 of ad budget for the next six weeks. Where does it usually do the most good?",
     ["On the soft dates — the ones pacing below target", "On the dates that are already sold out", "Spread evenly across every date", "On the peak weekends"],
     "On the soft dates — the ones pacing below target", "Soft dates are the nights the property most needs help filling. Peak sells itself."))
mcq("drive-fly", "drive-market-vs-fly-market",
    ("An owner says: \"Most of our guests drive up from Toronto, Kitchener and Hamilton, and they book about two weeks out.\" What is the lodge mainly?",
     ["A drive market", "A fly market", "A comp set", "A shoulder season"], "A drive market",
     "Guests arriving by car make it a drive market, which usually means shorter lead times and nearby targeting."),
    ("A resort's guests mostly fly in from Calgary and Vancouver and book three months ahead. What is it mainly?",
     ["A fly market", "A drive market", "Transient", "A soft date"], "A fly market",
     "Guests arriving by plane make it a fly market, with longer lead times and a wider radius."))
mcq("midweek-gap", "midweek-gap",
    ("Weekends are 90% full all summer, but Monday to Thursday sit at 40%. What is this pattern?",
     ["The midweek gap", "Slow season", "Orphan nights", "Changeover days"], "The midweek gap",
     "A structural soft spot at nearly every property in this ICP."),
    ("A glamping owner says: \"Every single week it's the same — Tuesday and Wednesday nights are empty.\" What is she describing?",
     ["The midweek gap", "Orphan nights", "Regret", "Shoulder season"], "The midweek gap",
     "A weekly, structural soft spot is the midweek gap; orphan nights are one-off gaps between bookings."))
mcq("search-discovery", "search-vs-discovery-demand",
    ("Google search ads catch people already typing \"cabins near Algonquin\". Instagram Reels make people want a trip they weren't planning. Which frame describes the difference?",
     ["Search vs discovery demand", "Retargeting vs prospecting", "Drive vs fly market", "Click vs view-through"], "Search vs discovery demand",
     "Harvesting someone already looking versus creating the want."),
    ("Which kind of demand is HGM mainly built to create?",
     ["Discovery — making people want a stay before they search", "Search — competing on price for people already looking", "Group — contracted blocks", "Metasearch — rate comparison"],
     "Discovery — making people want a stay before they search", "Discovery demand is HGM's reason for existing."))
mcq("who-talking", "who-you-are-talking-to",
    ("The founder who built a lodge and the general manager she hired are both on your call. Why does it matter which of them asks about results?",
     ["They answer for different numbers, so the same update lands differently", "Only the founder can sign off on ad spend", "The GM always prefers OTA bookings", "It doesn't; they want the same report"],
     "They answer for different numbers, so the same update lands differently",
     "Owner, GM, revenue manager and asset manager: four seats, four scorecards."),
    ("Before a call you check whether you'll be speaking with the owner, the GM, the revenue manager or an asset manager. Which dictionary term is this habit?",
     ["Who you are talking to", "Comp set", "Revenue management (the function)", "Feeder market"], "Who you are talking to",
     "Each seat answers for different numbers, so you shape the update to the person."))
mcq("pre-arrival", "pre-arrival-sequence",
    ("Two days before check-in, guests get an email with directions, the dinner menu and an offer to book a spa treatment. What is that email part of?",
     ["The pre-arrival sequence", "Retargeting", "Guest lifetime value", "Review score"], "The pre-arrival sequence",
     "The window where upsell and expectation-setting actually work."),
    ("When is usually the best moment to offer a booked guest a dinner reservation?",
     ["In the pre-arrival sequence, while they're looking forward to the trip", "At checkout", "In the post-stay review request", "Before they've booked"],
     "In the pre-arrival sequence, while they're looking forward to the trip", "Guests are most excited, and most open to extras, before they arrive."))
mcq("creative-fatigue", "creative-fatigue-index",
    ("The same video has run for ten weeks. Frequency is up from 1.8 to 4.2, CTR has halved and CPM is flat. What is most likely telling you to refresh it?",
     ["The creative fatigue index", "Incrementality", "Deliverability", "The attribution window"], "The creative fatigue index",
     "Rising frequency with falling engagement is fatigue: people have seen the ad too often."),
    ("Bookings from an ad slipped. Searches for the area are steady and the audience hasn't changed, but people have now seen the ad six times each. What's the likely cause?",
     ["Creative fatigue", "Soft dates", "Regret", "Cannibalization"], "Creative fatigue",
     "Results slipping because people have seen the same ad too often, not because demand has gone."))
mcq("retarget-prospect", "retargeting-vs-prospecting",
    ("Campaign A shows ads to people who visited the booking page in the last 30 days. Campaign B finds people who've never heard of the lodge. What are A and B?",
     ["A is retargeting; B is prospecting", "A is prospecting; B is retargeting", "A is search; B is discovery", "A is transient; B is group"],
     "A is retargeting; B is prospecting", "Retargeting harvests a warm pool; prospecting builds a new one."),
    ("An owner wants to cut prospecting because retargeting's cost per booking is lower. What's the risk?",
     ["The retargeting pool shrinks because nobody new is coming in", "Retargeting gets more expensive per click right away", "Nothing; retargeting is always better", "Meta will pause the account"],
     "The retargeting pool shrinks because nobody new is coming in", "Prospecting fills the pool retargeting draws from. Cut it and the pool empties."))
mcq("opportunity-cost", "opportunity-cost",
    (f"A retreat group wants the whole lodge for the last week of August at $18,000. Individual guests usually bring in about $26,000 that week. What is the $26,000 you'd give up? {ILL}",
     ["The opportunity cost", "Cannibalization", "Regret", "The rack rate"], "The opportunity cost",
     "The value of the best option you gave up by choosing another."),
    ("You hold your best cabin for a possible wedding party and turn away three couples while you wait. In relation to the hold, what is the revenue those couples would have brought?",
     ["The opportunity cost", "Pickup", "ROAS", "Regret"], "The opportunity cost",
     "Holding the cabin had a price: the bookings you turned away."))

# ================================================================ VALIDATE
def units(it):
    if it["type"] == "wordproblem":
        return [b["term"] for b in it["variants"][0]["blanks"]]
    if it["type"] == "buckets":
        return [c["term"] for c in it["variants"][0]["chips"]]
    if it["type"] == "matching":
        return it["terms"]
    return [it["term"]]

seen = {}
for it in items:
    assert len(it["variants"]) >= 2, it["id"]
    us = units(it)
    for u in us:
        assert u in TIER, (it["id"], u)
        assert u not in seen, f"{u} twice: {seen.get(u)} and {it['id']}"
        seen[u] = it["id"]
        if TIER[u] == "A":
            assert it["type"] not in ("matching", "truefalse"), f"core term {u} in {it['type']}"
    # same terms across variants
    for v in it["variants"]:
        if it["type"] == "wordproblem":
            assert [b["term"] for b in v["blanks"]] == us
            assert len(v["blanks"]) <= 4
        if it["type"] == "buckets":
            assert sorted(c["term"] for c in v["chips"]) == sorted(us)
            for c in v["chips"]: assert c["box"] in v["boxes"]
        if it["type"] in ("mcq", "scenario"):
            assert v["answer"] in v["options"], v["id"]
            assert len(set(v["options"])) == len(v["options"]) == 4, v["id"]
    if it["type"] == "matching":
        assert len(it["terms"]) <= 6
missing = set(TIER) - set(seen)
assert not missing, missing

bank = {"masking_rule": "On matching v2 (usage lines), blank out, case-insensitive and with an optional plural s: the term, the term without any bracketed expansion, each part of a term split on ' / ', its aliases, and the item's mask_extra words for that slug.",
        "version": "1.0.0-draft", "status": "draft — for Nicole and Kyle's read before it replaces the fixture",
        "weights": {"A": 2, "B": 1}, "illustrative_note": "Every figure in the check is illustrative.",
        "items": items}
json.dump(bank, open("../data/check-bank.json", "w"), indent=1, ensure_ascii=False)

# counts
from collections import Counter
types = Counter(it["type"] for it in items)
print("items:", len(items), dict(types))
print("terms:", len(seen), "A:", sum(TIER[u]=="A" for u in seen), "B:", sum(TIER[u]=="B" for u in seen))
print("points:", sum(2 if TIER[u]=="A" else 1 for u in seen))
