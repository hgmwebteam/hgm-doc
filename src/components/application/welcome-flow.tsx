import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy01, Image01, Mail01, Monitor01, Phone01, SearchSm, Settings01, XClose } from "@untitledui/icons";
import { AnimatePresence, motion } from "motion/react";
import { supabase } from "@/lib/supabase";
import { ClientFeedbackBox, type ClientFeedbackProps, ClientFeedbackReview } from "@/pages/client/dashboard/client-feedback";
import { flowFeedbackSlot } from "@/pages/client/dashboard/suggestions-model";
import { cx } from "@/utils/cx";

/**
 * Welcome Email Flow — the nine-email welcome sequence inside each client
 * dashboard (side-menu section). The nine steps are fixed (`FLOW_STEPS`, E1
 * Welcome → E9 Concierge) and each slot shows whichever finished email exists
 * for it: pasted HTML, then Pooja's finished email from `email_wf_emails` (her
 * `week` is the step), then — for the first three slots only — the built-in
 * editable template from the original Canva structure (2026-07-03). A slot
 * with none of those shows a "not ready yet" card. Persists to welcome_flows.
 *
 * Mobile (390px) and desktop (600px) previews render side by side, each under
 * an inbox-style header with the subject line and preview text (2026-09-10).
 *
 * Editing UX (WYSIWYG, 2026-07-03): the email preview IS the editor —
 * double-click any text to edit it in place; buttons and images carry a ✎ pen
 * that opens a small popover with the name + link + Save; list sections get
 * inline “+ Add” / “×” controls. No forms, no panels. The HTML copied into
 * GoHighLevel is always rendered clean (no editing chrome). Both previews are
 * editable; a text edit in one is mirrored into the other without a reload.
 */

/* ── Types ───────────────────────────────────────────────────────── */

type FeatureItem = { image_url: string; image_link: string; heading: string };
type ListingItem = { image_url: string; image_link: string; title: string; subheading: string; text: string; cta_text: string; cta_url: string };
type Testimonial = { image_url: string; quote: string; guest: string; property: string };

interface FlowEmail {
    key: string;
    label: string;
    subject: string;
    hero: { heading: string; subheading: string; code: string; image_url: string; image_link: string; body: string; cta_text: string; cta_url: string };
    intro?: { heading: string; body: string };
    features?: { pill: string; heading: string; sub: string; items: FeatureItem[] };
    personal?: { image_url: string; body: string; signature: string; cta_text: string; cta_url: string };
    listings?: { pill: string; heading: string; sub: string; items: ListingItem[] };
    testimonials?: { pill: string; heading: string; sub: string; items: Testimonial[] };
    final_cta?: { heading: string; cta_text: string; cta_url: string };
}

interface FlowSettings {
    brand_color: string;
    heading_font: string;
    logo_url: string;
}

export interface WelcomeFlowData {
    settings: FlowSettings;
    waits: string[];
    emails: FlowEmail[];
    /** Finished HTML emails delivered by Pooja (the AI email technician), one per slot
     *  0–8 (shown as Email 1–9). A filled slot REPLACES the built-in template for that
     *  tab: the file renders verbatim and Copy HTML exports it byte-for-byte, so what
     *  the client approves is exactly what lands in GHL. Optional: older rows predate it. */
    customHtml?: (string | null)[];
}

/* ── The nine steps ──────────────────────────────────────────────── */

/** The welcome flow's nine emails, in send order. Pooja's pipeline stamps each
 *  finished email with its `week` (1–9); the dashboard shows that step as E1–E9.
 *  The names match her template set (31–39), so the tabs read the same here as
 *  in her preview. */
export const FLOW_STEPS = [
    { key: "welcome", name: "Welcome" },
    { key: "itinerary", name: "Itinerary" },
    { key: "reviews", name: "Reviews" },
    { key: "destination", name: "Destination" },
    { key: "guest-story", name: "Guest story" },
    { key: "book-direct", name: "Book direct" },
    { key: "midweek", name: "Midweek" },
    { key: "booking-nudge", name: "Booking nudge" },
    { key: "concierge", name: "Concierge" },
] as const;

/** "E2 Itinerary" — the tab label for a 0-based slot. */
export const stepLabel = (slot: number) => `E${slot + 1} ${FLOW_STEPS[slot]?.name ?? ""}`.trim();

/** Subject line of a finished HTML email, read from its <title> (entities decoded
 *  without executing anything). Empty when the file has none. */
const htmlTitle = (html: string) => {
    const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    if (!m) return "";
    const t = document.createElement("textarea");
    t.innerHTML = m[1];
    return t.value.replace(/\s+/g, " ").trim();
};

/* ── Seed (Lagom Retreat example from the Canva file, with placeholders) ── */

const seedFlow = (clientName: string): WelcomeFlowData => {
    const name = clientName || "[brand name]";
    return {
        settings: { brand_color: "#5A7B4F", heading_font: "Georgia, 'Times New Roman', serif", logo_url: "" },
        waits: ["1 day", "1 day"],
        emails: [
            {
                key: "promo",
                label: "Email 1 · Promotion",
                subject: "Claim $100 Off or 10% Off",
                hero: {
                    heading: "Claim Your $150 Off",
                    subheading: "",
                    code: "WELCOME150",
                    image_url: "",
                    image_link: "",
                    body: "Your first stay comes with a little gift — book 2 nights or more and save. Don't wait, the offer expires soon.",
                    cta_text: "Redeem your offer",
                    cta_url: "",
                },
                intro: {
                    heading: `Discover Your Next Dream Vacation with ${name}`,
                    body:
                        `Welcome to ${name}, a [location] sanctuary designed for rest, reconnection, and the quiet beauty of nature.\n\n` +
                        "Whether for a solo reset, romantic escape, or family getaway, it's the perfect place to slow down and recharge. " +
                        "Enjoy [promotion — e.g. $150 off] stays of 3+ nights with code [promocode].",
                },
                features: {
                    pill: "Amenities",
                    heading: "What We Offer",
                    sub: "A few of the touches that make your stay special.",
                    items: [
                        { image_url: "", image_link: "", heading: "Heading — 8 words max" },
                        { image_url: "", image_link: "", heading: "Heading — 8 words max" },
                        { image_url: "", image_link: "", heading: "Heading — 8 words max" },
                        { image_url: "", image_link: "", heading: "Heading — 8 words max" },
                    ],
                },
                personal: {
                    image_url: "",
                    body:
                        'Escape the noise and embrace the art of "just right". Whether you are seeking a romantic reset, a solo recharge, ' +
                        `or a place to unplug with family, ${name} is your perfect space to rest and reconnect.\n\n` +
                        "Book now and SAVE $150 on your stay of 3 nights or more — use code WELCOME150 at checkout.\n\nWe can't wait to welcome you.",
                    signature: `Warmly,\nThe ${name} Team`,
                    cta_text: "Redeem $150 OFF",
                    cta_url: "",
                },
            },
            {
                key: "reminder",
                label: "Email 2 · Reminder",
                subject: "Reminder — your welcome gift is waiting",
                hero: {
                    heading: "Enjoy $150 Off",
                    subheading: "Your First Stay",
                    code: "WELCOME150",
                    image_url: "",
                    image_link: "",
                    body: `Welcome to ${name}. As a thank you for joining us, enjoy $150 off your first stay of 3 nights or more with code WELCOME150.`,
                    cta_text: "Redeem [discount] OFF →",
                    cta_url: "",
                },
                listings: {
                    pill: "Our Listings",
                    heading: "Explore Our Cabins",
                    sub: "Explore our handpicked selection of top-tier properties available now.",
                    items: [
                        {
                            image_url: "",
                            image_link: "",
                            title: "Listing/Category 1",
                            subheading: "Sub heading — e.g. guest no., total listings",
                            text: "Short description of this listing or category.",
                            cta_text: "View Listings →",
                            cta_url: "",
                        },
                        {
                            image_url: "",
                            image_link: "",
                            title: "Listing/Category 2",
                            subheading: "Sub heading — e.g. guest no., total listings",
                            text: "Short description of this listing or category.",
                            cta_text: "View Listings →",
                            cta_url: "",
                        },
                        {
                            image_url: "",
                            image_link: "",
                            title: "Listing/Category 3",
                            subheading: "Sub heading — e.g. guest no., total listings",
                            text: "Short description of this listing or category.",
                            cta_text: "View Listings →",
                            cta_url: "",
                        },
                    ],
                },
            },
            {
                key: "lastchance",
                label: "Email 3 · Last Chance",
                subject: "Last chance — your offer ends soon",
                hero: {
                    heading: "Time is Running Out",
                    subheading: "",
                    code: "WELCOME150",
                    image_url: "",
                    image_link: "",
                    body: "Your chance to save on an unforgettable getaway is ending soon! Use code WELCOME150 at checkout to get $150 off your first booking of 3 nights or more.",
                    cta_text: "Redeem [discount] OFF",
                    cta_url: "",
                },
                testimonials: {
                    pill: "Testimonials",
                    heading: "Hear from Our Guests",
                    sub: `Don't just take our word for it. See what our guests are saying about their escape with ${name}.`,
                    items: [
                        {
                            image_url: "",
                            quote: "The Stargazer was beautifully designed with thoughtful touches. It was the ultimate lone getaway to relax and recharge.",
                            guest: "Guest Name",
                            property: "Property name",
                        },
                        {
                            image_url: "",
                            quote: "The Stargazer was beautifully designed with thoughtful touches. I am looking forward to making this a yearly refresh.",
                            guest: "Guest Name",
                            property: "Property name",
                        },
                    ],
                },
                final_cta: { heading: "Now, it's your turn to make memories.", cta_text: "Redeem [discount] OFF", cta_url: "" },
            },
        ],
    };
};

/* ── Email HTML renderer (email-safe tables + inline styles) ─────── */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const nl2br = (s: string) => esc(s).replace(/\n/g, "<br/>");
/** Only sane link schemes make it into hrefs (incl. the HTML exported to GHL). */
const safeHref = (u: string) => {
    const t = (u || "").trim();
    return !t ? "#" : /^(https?:|mailto:|tel:|\/|#)/i.test(t) ? t : "#";
};
const linkWrap = (inner: string, href: string) =>
    href ? `<a href="${esc(safeHref(href))}" target="_blank" style="text-decoration:none;">${inner}</a>` : inner;
/** Settings values are interpolated into style/script blocks — whitelist hard. */
const safeColor = (c: string) => (/^[#a-zA-Z0-9(),.%\s-]{1,40}$/.test(c) ? c : "#5A7B4F");
const safeFont = (f: string) => (f || "").replace(/["<>&{}\\;]/g, "").slice(0, 80) || "Georgia, serif";

/**
 * Render one email. `interactive` adds the in-app WYSIWYG hooks (double-click
 * text editing, ✎ pens on buttons/images, add/remove on list items) — the HTML
 * copied into GoHighLevel is always rendered clean.
 */
export function emailHtml(email: FlowEmail, settings: FlowSettings, interactive = false): string {
    const ia = interactive;
    const brand = safeColor(settings.brand_color || "#5A7B4F");
    const serif = safeFont(settings.heading_font || "Georgia, serif");
    const sans = "Arial, Helvetica, sans-serif";

    /** data attributes for a double-click-editable text node */
    const ed = (path: string, ml = false) => (ia ? ` data-edit="${path}"${ml ? ` data-edit-ml="1"` : ""}` : "");
    /** ✎ pen badge (buttons / images / logo) */
    const pen = (kind: string, path: string, hasLink: boolean) =>
        ia ? `<span class="hgm-pen" data-kind="${kind}" data-path="${esc(path)}" data-haslink="${hasLink ? "1" : "0"}">&#9998;</span>` : "";
    /** × remove badge + wrapper for list items */
    const itemWrap = (inner: string, listPath: string, i: number) =>
        ia ? `<div style="position:relative;">${inner}<span class="hgm-x" data-remove="${listPath}.${i}">&#215;</span></div>` : inner;
    const addBtn = (listPath: string, label: string) => (ia ? `<div class="hgm-add" data-add="${listPath}">+ ${esc(label)}</div>` : "");

    const card = (inner: string) =>
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;margin:0 0 16px 0;"><tr><td style="padding:28px 24px;">${inner}</td></tr></table>`;
    const btn = (text: string, url: string, path: string) => {
        if (!text && !ia) return "";
        return (
            `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:18px auto 0;"><tr>` +
            `<td style="position:relative;background:${brand};border-radius:10px;">` +
            `<a href="${esc(safeHref(url))}" target="_blank" style="display:inline-block;padding:12px 32px;font-family:${sans};font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">${esc(text || "Button")}</a>` +
            pen("btn", path, true) +
            `</td></tr></table>`
        );
    };
    /** image (or edit-mode placeholder) with pen */
    const imgBlock = (url: string, link: string, alt: string, path: string, opts?: { radius?: number; height?: number; hasLink?: boolean }) => {
        const radius = opts?.radius ?? 12;
        const hasLink = opts?.hasLink ?? true;
        const core = url
            ? linkWrap(`<img src="${esc(url)}" alt="${esc(alt)}" width="100%" style="display:block;width:100%;border-radius:${radius}px;" />`, ia ? "" : link)
            : ia
              ? `<div style="height:${opts?.height ?? 140}px;background:#e7ebe2;border-radius:${radius}px;text-align:center;line-height:${opts?.height ?? 140}px;font:bold 12px ${sans};color:#8a9284;">Add image</div>`
              : "";
        if (!core) return "";
        return ia ? `<div style="position:relative;">${core}${pen("img", path, hasLink)}</div>` : core;
    };
    const circleImg = (url: string, path: string, size: number) => {
        const core = url
            ? `<img src="${esc(url)}" alt="" width="${size}" height="${size}" style="border-radius:50%;object-fit:cover;" />`
            : ia
              ? `<div style="display:inline-block;width:${size}px;height:${size}px;border-radius:50%;background:#e7ebe2;text-align:center;line-height:${size}px;font:bold 10px ${sans};color:#8a9284;">photo</div>`
              : "";
        if (!core) return "";
        return ia ? `<span style="position:relative;display:inline-block;">${core}${pen("img", path, false)}</span>` : core;
    };
    const pill = (text: string, path: string) =>
        text || ia
            ? `<div style="text-align:center;margin-bottom:10px;"><span${ed(path)} style="display:inline-block;background:#f2f2ef;border-radius:999px;padding:5px 16px;font-family:${sans};font-size:12px;color:#666;">${esc(text)}</span></div>`
            : "";
    const h2 = (text: string, path: string) =>
        `<h2${ed(path)} style="margin:0 0 8px;font-family:${serif};font-size:24px;font-weight:600;color:#1f2a1d;text-align:center;">${esc(text)}</h2>`;
    const subTxt = (text: string, path: string) =>
        text || ia
            ? `<p${ed(path)} style="margin:0 0 18px;font-family:${sans};font-size:14px;line-height:1.6;color:#666;text-align:center;">${esc(text)}</p>`
            : "";

    const parts: string[] = [];

    // Hero
    const h = email.hero;
    const logoHtml = settings.logo_url
        ? `<div style="text-align:center;margin-bottom:14px;"><span style="position:relative;display:inline-block;"><img src="${esc(settings.logo_url)}" alt="Logo" height="40" style="height:40px;" />${pen("logo", "__logo", false)}</span></div>`
        : ia
          ? `<div style="text-align:center;margin-bottom:14px;"><span style="position:relative;display:inline-block;background:#e7ebe2;border-radius:8px;padding:8px 22px;font:bold 12px ${sans};color:#8a9284;">LOGO${pen("logo", "__logo", false)}</span></div>`
          : "";
    parts.push(
        card(
            logoHtml +
                `<h1${ed("hero.heading")} style="margin:0 0 6px;font-family:${serif};font-size:30px;font-weight:600;color:#1f2a1d;text-align:center;">${esc(h.heading)}</h1>` +
                (h.subheading || ia
                    ? `<p${ed("hero.subheading")} style="margin:0 0 10px;font-family:${sans};font-size:16px;color:#333;text-align:center;">${esc(h.subheading)}</p>`
                    : "") +
                (h.code || ia
                    ? `<div style="text-align:center;margin:12px 0;"><span style="display:inline-block;background:#f1f3ee;border-radius:999px;padding:7px 18px;font-family:${sans};font-size:13px;color:#333;">Use code <b${ed("hero.code")} style="color:#b98a00;">${esc(h.code)}</b> at checkout.</span></div>`
                    : "") +
                `<div style="margin:14px 0 0;">${imgBlock(h.image_url, h.image_link, h.heading, "hero")}</div>` +
                `<p${ed("hero.body", true)} style="margin:18px 0 0;font-family:${sans};font-size:14px;line-height:1.7;color:#333;text-align:center;">${nl2br(h.body)}</p>` +
                btn(h.cta_text, h.cta_url, "hero"),
        ),
    );

    // Intro (email 1)
    if (email.intro) {
        parts.push(
            card(
                h2(email.intro.heading, "intro.heading") +
                    `<p${ed("intro.body", true)} style="margin:10px 0 0;font-family:${sans};font-size:14px;line-height:1.7;color:#333;">${nl2br(email.intro.body)}</p>`,
            ),
        );
    }

    // Features / Amenities (email 1)
    if (email.features) {
        const f = email.features;
        const rows = f.items
            .map((it, i) =>
                itemWrap(
                    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8f3;border-radius:12px;margin:0 0 10px;"><tr>` +
                        `<td width="72" style="padding:10px;">${imgBlock(it.image_url, it.image_link, it.heading, `features.items.${i}`, { radius: 8, height: 64 }) || ""}</td>` +
                        `<td style="padding:10px 14px;"><span${ed(`features.items.${i}.heading`)} style="font-family:${sans};font-size:14px;font-weight:bold;color:#1f2a1d;">${esc(it.heading)}</span></td></tr></table>`,
                    "features.items",
                    i,
                ),
            )
            .join("");
        parts.push(
            card(
                pill(f.pill, "features.pill") +
                    h2(f.heading, "features.heading") +
                    subTxt(f.sub, "features.sub") +
                    rows +
                    addBtn("features.items", "Add amenity"),
            ),
        );
    }

    // Listings (email 2)
    if (email.listings) {
        const l = email.listings;
        const cards = l.items
            .map((it, i) =>
                itemWrap(
                    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafbf8;border:1px solid #eceee8;border-radius:14px;margin:0 0 14px;"><tr><td style="padding:14px;">` +
                        imgBlock(it.image_url, it.image_link, it.title, `listings.items.${i}`) +
                        `<h3${ed(`listings.items.${i}.title`)} style="margin:12px 0 2px;font-family:${serif};font-size:18px;font-weight:600;color:#1f2a1d;">${esc(it.title)}</h3>` +
                        `<p${ed(`listings.items.${i}.subheading`)} style="margin:0 0 6px;font-family:${sans};font-size:12px;color:#888;">${esc(it.subheading)}</p>` +
                        `<p${ed(`listings.items.${i}.text`, true)} style="margin:0;font-family:${sans};font-size:14px;line-height:1.6;color:#444;">${nl2br(it.text)}</p>` +
                        btn(it.cta_text, it.cta_url, `listings.items.${i}`) +
                        `</td></tr></table>`,
                    "listings.items",
                    i,
                ),
            )
            .join("");
        parts.push(
            card(
                pill(l.pill, "listings.pill") +
                    h2(l.heading, "listings.heading") +
                    subTxt(l.sub, "listings.sub") +
                    cards +
                    addBtn("listings.items", "Add listing"),
            ),
        );
    }

    // Personal touch (email 1)
    if (email.personal) {
        const p = email.personal;
        parts.push(
            card(
                `<div style="text-align:center;margin-bottom:16px;">${circleImg(p.image_url, "personal", 120)}</div>` +
                    `<p${ed("personal.body", true)} style="margin:0;font-family:${sans};font-size:14px;line-height:1.7;color:#333;">${nl2br(p.body)}</p>` +
                    `<p${ed("personal.signature", true)} style="margin:16px 0 0;font-family:${sans};font-size:14px;line-height:1.7;color:#333;">${nl2br(p.signature)}</p>` +
                    btn(p.cta_text, p.cta_url, "personal"),
            ),
        );
    }

    // Testimonials (email 3)
    if (email.testimonials) {
        const t = email.testimonials;
        const cards = t.items
            .map((it, i) =>
                itemWrap(
                    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8f3;border-radius:14px;margin:0 0 14px;"><tr><td style="padding:20px;text-align:center;">` +
                        circleImg(it.image_url, `testimonials.items.${i}`, 72) +
                        `<div style="margin:8px 0 6px;font-size:16px;color:#f0a800;letter-spacing:2px;">★★★★★</div>` +
                        `<p style="margin:0 0 10px;font-family:${sans};font-size:14px;line-height:1.7;color:#333;">"<span${ed(`testimonials.items.${i}.quote`, true)}>${nl2br(it.quote)}</span>"</p>` +
                        `<p style="margin:0;font-family:${sans};font-size:13px;font-weight:bold;color:${brand};"><span${ed(`testimonials.items.${i}.guest`)}>${esc(it.guest)}</span> — <span${ed(`testimonials.items.${i}.property`)}>${esc(it.property)}</span></p>` +
                        `<p style="margin:6px 0 0;font-family:${sans};font-size:11px;color:#999;">✓ Verified review</p>` +
                        `</td></tr></table>`,
                    "testimonials.items",
                    i,
                ),
            )
            .join("");
        parts.push(
            card(
                pill(t.pill, "testimonials.pill") +
                    h2(t.heading, "testimonials.heading") +
                    subTxt(t.sub, "testimonials.sub") +
                    cards +
                    addBtn("testimonials.items", "Add review"),
            ),
        );
    }

    // Final CTA (email 3)
    if (email.final_cta) {
        parts.push(card(h2(email.final_cta.heading, "final_cta.heading") + btn(email.final_cta.cta_text, email.final_cta.cta_url, "final_cta")));
    }

    const interactiveExtras = ia
        ? `<style>
[data-edit]{border-radius:4px;}
[data-edit]:hover{outline:1.5px dashed ${brand};outline-offset:2px;cursor:text;}
[data-edit][contenteditable="true"]{outline:2px solid ${brand};outline-offset:2px;background:#fffdf2;}
.hgm-pen{position:absolute;top:-10px;right:-10px;width:24px;height:24px;background:${brand};color:#fff;border-radius:999px;text-align:center;line-height:24px;font:13px ${sans};cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.35);z-index:9;}
.hgm-pen:hover{transform:scale(1.12);}
.hgm-x{position:absolute;top:-8px;left:-8px;width:22px;height:22px;background:#d92d20;color:#fff;border-radius:999px;text-align:center;line-height:20px;font:bold 14px ${sans};cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.35);z-index:9;opacity:0;transition:opacity .12s;}
div:hover>.hgm-x{opacity:1;}
.hgm-add{border:1.5px dashed #b9c2b0;border-radius:10px;padding:9px;text-align:center;color:#8a9284;font:bold 12px ${sans};cursor:pointer;margin-top:4px;}
.hgm-add:hover{border-color:${brand};color:${brand};}
</style>` +
          `<script>(function(){
var K=${JSON.stringify(email.key)};
var send=function(m){m.k=K;parent.postMessage(m,'*')};
document.addEventListener('click',function(e){
  var pen=e.target.closest('.hgm-pen');
  if(pen){e.preventDefault();e.stopPropagation();var r=pen.getBoundingClientRect();
    send({hgm:'pen',kind:pen.getAttribute('data-kind'),path:pen.getAttribute('data-path'),haslink:pen.getAttribute('data-haslink')==='1',x:r.left,y:r.bottom});return;}
  var x=e.target.closest('.hgm-x');
  if(x){e.preventDefault();e.stopPropagation();send({hgm:'remove',path:x.getAttribute('data-remove')});return;}
  var ad=e.target.closest('.hgm-add');
  if(ad){e.preventDefault();send({hgm:'add',path:ad.getAttribute('data-add')});return;}
  var a=e.target.closest('a');
  if(a){e.preventDefault();}
  send({hgm:'bg'});
},true);
document.addEventListener('dblclick',function(e){
  var el=e.target.closest('[data-edit]');if(!el)return;
  e.preventDefault();el.setAttribute('data-orig',el.innerHTML);el.setAttribute('contenteditable','true');el.focus();
  var sel=window.getSelection(),rg=document.createRange();rg.selectNodeContents(el);sel.removeAllRanges();sel.addRange(rg);
});
document.addEventListener('keydown',function(e){
  var el=e.target&&e.target.closest?e.target.closest('[data-edit]'):null;
  if(!el||el.getAttribute('contenteditable')!=='true')return;
  if(e.key==='Enter'&&!el.hasAttribute('data-edit-ml')){e.preventDefault();el.blur();}
  if(e.key==='Escape'){el.innerHTML=el.getAttribute('data-orig')||el.innerHTML;el.setAttribute('data-cancel','1');el.blur();}
},true);
document.addEventListener('blur',function(e){
  var el=e.target;if(!el||!el.getAttribute||el.getAttribute('contenteditable')!=='true')return;
  el.removeAttribute('contenteditable');
  if(el.getAttribute('data-cancel')){el.removeAttribute('data-cancel');return;}
  send({hgm:'text',path:el.getAttribute('data-edit'),ml:el.hasAttribute('data-edit-ml'),value:el.innerText});
},true);
var st;window.addEventListener('scroll',function(){clearTimeout(st);st=setTimeout(function(){send({hgm:'scroll',y:window.scrollY})},80)});
window.addEventListener('message',function(e){var d=e.data;if(!d)return;
  if(d.hgm==='scrollTo'){window.scrollTo(0,d.y);return;}
  if(d.hgm==='setText'&&typeof d.path==='string'&&/^[a-zA-Z0-9_.]+$/.test(d.path)){
    var el=document.querySelector('[data-edit="'+d.path+'"]');
    if(el&&el.getAttribute('contenteditable')!=='true'){el.innerText=d.value||'';}
  }
});
})();</script>`
        : "";

    return (
        `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(email.subject)}</title></head>` +
        `<body style="margin:0;padding:0;background:#eef0ec;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0ec;"><tr><td align="center" style="padding:28px 12px;">` +
        `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">` +
        `<tr><td>${parts.join("")}</td></tr>` +
        `</table></td></tr></table>${interactiveExtras}</body></html>`
    );
}

/* ── Path helpers (edit messages address fields by dot-path) ─────── */

/* eslint-disable @typescript-eslint/no-explicit-any */
// Paths come from postMessage — whitelist segments hard (no __proto__/constructor/etc).
const SAFE_SEG = /^(?!__proto__$|constructor$|prototype$)[a-zA-Z0-9_]+$/;
const safePath = (path: string) => path.length > 0 && path.split(".").every((k) => SAFE_SEG.test(k));
const getByPath = (obj: any, path: string): any => (safePath(path) ? path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj) : undefined);
const setByPath = (obj: any, path: string, val: unknown) => {
    if (!safePath(path)) return;
    const keys = path.split(".");
    const last = keys.pop()!;
    const target = keys.reduce((o, k) => (o == null ? o : o[k]), obj);
    if (target != null && typeof target === "object") target[last] = val;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const NEW_ITEMS: Record<string, () => unknown> = {
    "features.items": () => ({ image_url: "", image_link: "", heading: "New amenity" }),
    "listings.items": () => ({
        image_url: "",
        image_link: "",
        title: "New listing",
        subheading: "",
        text: "Short description.",
        cta_text: "View Listings →",
        cta_url: "",
    }),
    "testimonials.items": () => ({ image_url: "", quote: "New review", guest: "Guest Name", property: "Property name" }),
};

/* ── Small primitives ────────────────────────────────────────────── */

/* ── Client feedback ─────────────────────────────────────────────── */

/** Client feedback wiring — now shared with the Landing page, see client-feedback.tsx. */
export type FlowFeedbackProps = ClientFeedbackProps;

/** The two previews, in display order — mobile first. */
const DEVICES = [
    { id: "mobile", label: "Mobile", width: 390, icon: Phone01 },
    { id: "desktop", label: "Desktop", width: 600, icon: Monitor01 },
] as const;

const inputCls =
    "w-full rounded-lg border border-secondary bg-primary px-2.5 py-1.5 text-sm text-primary placeholder:text-placeholder outline-none transition duration-100 ease-linear focus:border-brand focus:ring-1 focus:ring-brand";

const Field = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <label className="block">
        <span className="mb-1 block text-[11px] font-semibold tracking-wide text-quaternary uppercase">{label}</span>
        <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </label>
);

/** ✎ popover state — “change the name, attach a link, save”. */
interface PenState {
    kind: "btn" | "img" | "logo";
    path: string;
    emailKey: string; // which email the pen belongs to (survives tab races)
    hasLink: boolean;
    a: string; // name / image URL / logo URL
    b: string; // link
    x: number;
    y: number;
}

/* ── Main section component ──────────────────────────────────────── */

export const WelcomeFlowSection = ({
    slug,
    clientName,
    isLocked,
    isTemplate,
    isTeam = false,
    feedback,
}: {
    slug?: string;
    clientName: string;
    isLocked: boolean;
    isTemplate: boolean;
    /** A signed-in team member is looking — shows the GoHighLevel toolbar and internal
     *  wording. A client never sees "Copy HTML for GHL" or where an email came from. */
    isTeam?: boolean;
    /** Client feedback wiring — omit (or mode "off") and the section shows no feedback UI. */
    feedback?: FlowFeedbackProps;
}) => {
    const [flow, setFlow] = useState<WelcomeFlowData>(() => seedFlow(clientName));
    const [tab, setTab] = useState(0);
    const [copied, setCopied] = useState(false);
    const [penPop, setPenPop] = useState<PenState | null>(null);
    const [brandOpen, setBrandOpen] = useState(false);
    // GHL Media Library picker — images arrive via the ghl-media Edge Function
    // (team-gated) so the Private Integration tokens never reach the browser.
    const [ghlPicker, setGhlPicker] = useState<{
        images: { name: string; url: string }[];
        loading: boolean;
        error: string;
        query: string;
        offset: number;
        hasMore: boolean;
    } | null>(null);
    // rev bumps re-render the iframe (structure changed); plain text edits happen
    // in place inside the iframe and only sync state — no reload, no flicker.
    const [rev, setRev] = useState(0);
    const hydratedRef = useRef(false);
    // Two previews of the same document — mobile (390) and desktop (600) — both
    // editable. Messages are matched to whichever frame sent them.
    const mobileRef = useRef<HTMLIFrameElement | null>(null);
    const desktopRef = useRef<HTMLIFrameElement | null>(null);
    const frames = () => [mobileRef.current, desktopRef.current].filter((f): f is HTMLIFrameElement => !!f);
    const previewWrapRef = useRef<HTMLDivElement | null>(null);
    const scrollYRef = useRef(0);
    const flowRef = useRef(flow);
    const tabRef = useRef(tab);
    const brandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    flowRef.current = flow;
    tabRef.current = tab;

    // Load the saved flow for this client.
    useEffect(() => {
        if (!slug || isTemplate) {
            hydratedRef.current = true;
            return;
        }
        supabase
            .from("welcome_flows")
            .select("data")
            .eq("slug", slug)
            .maybeSingle()
            .then(({ data: row, error }) => {
                const d = row?.data as WelcomeFlowData | undefined;
                if (!error && d && Array.isArray(d.emails) && d.emails.length === 3) {
                    setFlow(d);
                    setRev((r) => r + 1);
                }
                hydratedRef.current = true;
            });
    }, [slug, isTemplate]);

    /** Pooja's finished emails, straight from the email_wf_emails table — keyed by slot.
     *  Her `week` (1–9) is the step in the flow, so it maps to slot 0–8; `position` is
     *  the fallback for rows that predate it (in practice it is always 1). Read-only
     *  here: her pipeline owns those rows, so fixes happen there, not in this editor.
     *  Matched by client name (case-insensitive) because her table has no dashboard
     *  slug. Rows arrive oldest-first so a regenerated email replaces the earlier one. */
    const [dbEmails, setDbEmails] = useState<Record<number, { html: string; subject: string; preview: string }>>({});
    useEffect(() => {
        const name = clientName.trim();
        if (!name || isTemplate) return;
        supabase
            .from("email_wf_emails")
            .select("position, week, subject_line, preview_text, rendered_html")
            .ilike("client_name", name)
            .order("updated_at", { ascending: true })
            .then(({ data, error }) => {
                if (error || !data?.length) return;
                const next: Record<number, { html: string; subject: string; preview: string }> = {};
                for (const r of data) {
                    const slot = Number(r.week ?? r.position) - 1;
                    if (slot >= 0 && slot < FLOW_STEPS.length && r.rendered_html) {
                        next[slot] = { html: r.rendered_html, subject: r.subject_line ?? "", preview: r.preview_text ?? "" };
                    }
                }
                setDbEmails(next);
                setRev((r) => r + 1);
            });
    }, [clientName, isTemplate]);

    // Debounced autosave while editing.
    useEffect(() => {
        if (!hydratedRef.current || !slug || isTemplate || isLocked) return;
        const t = setTimeout(() => {
            supabase
                .from("welcome_flows")
                .upsert({ slug, client_name: clientName, data: flow, updated_at: new Date().toISOString() }, { onConflict: "slug" })
                .then(({ error }) => {
                    if (error) console.error("[welcome flow autosave]", error);
                });
        }, 800);
        return () => clearTimeout(t);
    }, [flow, slug, isTemplate, isLocked, clientName]);

    const patch = (mutator: (draft: WelcomeFlowData) => void, structural = false) => {
        setFlow((prev) => {
            const next = JSON.parse(JSON.stringify(prev)) as WelcomeFlowData;
            mutator(next);
            return next;
        });
        if (structural) setRev((r) => r + 1);
    };

    // WYSIWYG messages from the preview iframe. Every message carries the email
    // key it was rendered for (m.k), so a blur racing a tab switch can never
    // write into the wrong email — we resolve the target by key, not by tab.
    useEffect(() => {
        const onMsg = (e: MessageEvent) => {
            const src = frames().find((f) => f.contentWindow === e.source);
            if (!src) return;
            const m = e.data as {
                hgm?: string;
                k?: string;
                path?: string;
                value?: string;
                ml?: boolean;
                kind?: string;
                haslink?: boolean;
                x?: number;
                y?: number;
            };
            if (!m?.hgm) return;
            const emailIdx = flowRef.current.emails.findIndex((em) => em.key === m.k);

            if (m.hgm === "bg") {
                setPenPop(null);
                setBrandOpen(false);
                return;
            }
            if (m.hgm === "scroll") {
                // Ignore trailing scroll reports from a previous email's document.
                if (emailIdx === tabRef.current) scrollYRef.current = m.y ?? 0;
                return;
            }
            if (emailIdx < 0) return;

            if (m.hgm === "text" && m.path) {
                const raw = m.value ?? "";
                const value = m.ml ? raw.replace(/\n+$/, "") : raw.replace(/\s*\n\s*/g, " ").trim();
                patch((d) => setByPath(d.emails[emailIdx], m.path!, value));
                // Mirror the edit into the other preview so both frames agree without a reload.
                if (safePath(m.path)) {
                    for (const f of frames()) if (f !== src) f.contentWindow?.postMessage({ hgm: "setText", path: m.path, value }, "*");
                }
                return;
            }
            if (m.hgm === "remove" && m.path) {
                const listPath = m.path.split(".").slice(0, -1).join(".");
                const idx = Number(m.path.split(".").pop());
                setPenPop(null); // any open pen may point at a now-shifted index
                patch((d) => {
                    const list = getByPath(d.emails[emailIdx], listPath) as unknown[] | undefined;
                    if (Array.isArray(list) && Number.isInteger(idx) && idx >= 0 && idx < list.length) list.splice(idx, 1);
                }, true);
                return;
            }
            if (m.hgm === "add" && m.path) {
                const make = NEW_ITEMS[m.path];
                patch((d) => {
                    const list = getByPath(d.emails[emailIdx], m.path!) as unknown[] | undefined;
                    if (Array.isArray(list) && make) list.push(make());
                }, true);
                return;
            }
            if (m.hgm === "pen" && m.path && m.kind) {
                const email = flowRef.current.emails[emailIdx];
                let a = "";
                let b = "";
                if (m.kind === "logo") {
                    a = flowRef.current.settings.logo_url;
                } else if (m.kind === "btn") {
                    const obj = getByPath(email, m.path) as { cta_text?: string; cta_url?: string } | undefined;
                    a = obj?.cta_text ?? "";
                    b = obj?.cta_url ?? "";
                } else {
                    const obj = getByPath(email, m.path) as { image_url?: string; image_link?: string } | undefined;
                    a = obj?.image_url ?? "";
                    b = obj?.image_link ?? "";
                }
                const wrap = previewWrapRef.current;
                // The frame's offsets are relative to the preview area (its offsetParent),
                // so the popover lands under the pen in whichever frame was clicked.
                const rawX = src.offsetLeft + (m.x ?? 0) - 130;
                const rawY = src.offsetTop + (m.y ?? 0) + 8;
                // Real clamps: keep the ~288px-wide popover inside the preview area.
                const maxX = (wrap?.clientWidth ?? 800) - 300;
                const maxY = (wrap?.clientHeight ?? 800) - 290;
                setPenPop({
                    kind: m.kind as PenState["kind"],
                    path: m.path,
                    emailKey: m.k ?? "",
                    hasLink: !!m.haslink && m.kind !== "logo",
                    a,
                    b,
                    x: Math.max(8, Math.min(rawX, maxX)),
                    y: Math.max(8, Math.min(rawY, maxY)),
                });
            }
        };
        window.addEventListener("message", onMsg);
        return () => window.removeEventListener("message", onMsg);
    }, []);

    /* ── GHL image picker ── */
    const fetchGhlImages = async (query: string, offset: number, append: boolean) => {
        setGhlPicker((p) => (p ? { ...p, loading: true, error: "", query, offset } : p));
        const { data, error } = await supabase.functions.invoke("ghl-media", { body: { client: clientName, query, offset } });
        let message = "";
        if (error) {
            message = "Couldn't load images — are you signed in with your @hiddengem.media account?";
            const ctx = (error as { context?: Response }).context;
            if (ctx && typeof ctx.json === "function") {
                try {
                    message = ((await ctx.json()) as { error?: string }).error ?? message;
                } catch {
                    /* keep the generic message */
                }
            }
        }
        setGhlPicker((p) => {
            if (!p) return p;
            if (message) return { ...p, loading: false, error: message };
            const files = ((data as { files?: { name: string; url: string }[] })?.files ?? []).filter((f) => f.url);
            return {
                ...p,
                loading: false,
                images: append ? [...p.images, ...files] : files,
                hasMore: !!(data as { hasMore?: boolean })?.hasMore,
            };
        });
    };
    const openGhlPicker = () => {
        setGhlPicker({ images: [], loading: true, error: "", query: "", offset: 0, hasMore: false });
        void fetchGhlImages("", 0, false);
    };
    const pickGhlImage = (url: string) => {
        setPenPop((p) => (p ? { ...p, a: url } : p));
        setGhlPicker(null);
    };

    const savePen = () => {
        if (!penPop) return;
        patch((d) => {
            if (penPop.kind === "logo") {
                d.settings.logo_url = penPop.a.trim();
                return;
            }
            const email = d.emails.find((em) => em.key === penPop.emailKey);
            const obj = email ? (getByPath(email, penPop.path) as Record<string, string> | undefined) : undefined;
            if (!obj) return;
            if (penPop.kind === "btn") {
                obj.cta_text = penPop.a;
                obj.cta_url = penPop.b.trim();
            } else {
                obj.image_url = penPop.a.trim();
                if ("image_link" in obj || penPop.hasLink) obj.image_link = penPop.b.trim();
            }
        }, true);
        setPenPop(null);
    };

    const customs = flow.customHtml ?? [];
    const dbEmail = dbEmails[tab];
    /** The built-in editable template for this slot — only the first three have one. */
    const builtIn: FlowEmail | undefined = flow.emails[tab];
    /** What fills this step, by precedence: pasted HTML → Pooja's finished email →
     *  built-in template → nothing yet. */
    const source: "pasted" | "finished" | "template" | "empty" = customs[tab] ? "pasted" : dbEmail ? "finished" : builtIn ? "template" : "empty";
    /** The finished HTML for this tab; an uploaded file wins over the table row. */
    const custom = customs[tab] || dbEmail?.html || null;
    const hasContent = source !== "empty";
    /** Steps that hold a finished email (Pooja's or pasted) — the flow's real progress. */
    const finishedCount = FLOW_STEPS.filter((_, i) => !!customs[i] || !!dbEmails[i]).length;
    /** Whether the flow holds anything a client could comment on — a finished email or one
     *  of the built-in templates. Gates the feedback rail, which is flow-level and so can't
     *  use `hasContent` (that one is about the tab in front of you). */
    const flowHasAnything = finishedCount > 0 || flow.emails.length > 0;
    /** Inbox header — what the recipient sees before opening. */
    const subject = source === "pasted" ? htmlTitle(customs[tab]!) : source === "finished" ? dbEmail!.subject : (builtIn?.subject ?? "");
    const previewText = source === "finished" ? dbEmail!.preview : "";

    /* ── Client feedback on the flow ──
       One note per person for all nine emails, not one per tab, so none of this depends on
       `tab`. The box and the team's list are the shared ones; this only decides whether
       they appear. Legacy per-email rows still arrive in `items` and are labelled with the
       email they were written about. */
    const fb = feedback && feedback.mode !== "off" ? feedback : null;
    // Recompute only on tab switch / structural change / lock toggle — inline text
    // edits keep the iframe document alive so typing never flickers. dbEmails isn't a
    // dep because loading it bumps rev.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const previewHtml = useMemo((): string | null => {
        const c = (flowRef.current.customHtml ?? [])[tab] || dbEmails[tab]?.html;
        if (c) return c;
        const em = flowRef.current.emails[tab];
        return em ? emailHtml(em, flowRef.current.settings, !isLocked) : null;
    }, [tab, rev, isLocked]);

    /** Store (or clear) a finished HTML file for a slot; trailing empty slots are
     *  trimmed so removed tabs disappear again. */
    const setCustom = (slot: number, html: string | null) =>
        patch((d) => {
            const list = (d.customHtml = d.customHtml ?? []);
            while (list.length <= slot) list.push(null);
            list[slot] = html;
            while (list.length && !list[list.length - 1]) list.pop();
        }, true);

    const onPickHtml = (slot: number) => async (e: ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        const text = await f.text();
        if (!text.trim()) return;
        setCustom(slot, text);
        setTab(slot);
        setPenPop(null);
    };

    /* Paste-HTML panel — the second way in besides a file: which slot it's aimed at,
       and the pasted code until Save. */
    const [pasteFor, setPasteFor] = useState<number | null>(null);
    const [pasteText, setPasteText] = useState("");
    const savePaste = () => {
        if (pasteFor === null || !pasteText.trim()) return;
        setCustom(pasteFor, pasteText);
        setTab(pasteFor);
        setPasteFor(null);
        setPasteText("");
        setPenPop(null);
    };

    const restoreScroll = () => {
        if (isLocked) return;
        setTimeout(() => {
            for (const f of frames()) f.contentWindow?.postMessage({ hgm: "scrollTo", y: scrollYRef.current }, "*");
        }, 30);
    };

    const copyHtml = () => {
        const html = custom ?? (builtIn ? emailHtml(builtIn, flow.settings) : "");
        if (!html) return;
        navigator.clipboard.writeText(html).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        });
    };

    /** Brand & timing changes re-render the preview, debounced so typing stays smooth. */
    const brandPatch = (mutator: (d: WelcomeFlowData) => void) => {
        patch(mutator);
        if (brandTimer.current) clearTimeout(brandTimer.current);
        brandTimer.current = setTimeout(() => setRev((r) => r + 1), 500);
    };

    /* ── The client's feedback rail ──
       Sits beside the previews so a note can be written while the emails are on screen,
       and stays put as the tabs change: one note covers the whole flow, so a client who
       has something to say about E2 and E6 writes it once and sends once. Sending again
       replaces it, and the team reads it in the review card above. Null for the team and
       for a viewer who can't send. */
    const fbRail =
        fb && flowHasAnything ? (
            <aside className="w-full shrink-0 empty:hidden @min-[1012px]:sticky @min-[1012px]:top-4 @min-[1012px]:w-[340px]">
                <ClientFeedbackBox feedback={fb} placeholder="Your feedback on the welcome emails…" />
            </aside>
        ) : null;

    return (
        <div>
            {/* Heading */}
            <div>
                <h2 className="text-display-xs font-semibold text-primary md:text-display-sm">Welcome Email Flow</h2>
                <p className="mt-1.5 text-md text-tertiary">
                    Nine emails, one a week from the day a lead signs up.{" "}
                    {isTeam ? "Review each one, then copy it into GoHighLevel." : "Have a look at each one and tell us what you think."}
                    {finishedCount > 0 && finishedCount < FLOW_STEPS.length && ` ${finishedCount} of ${FLOW_STEPS.length} are finished so far.`}
                </p>
            </div>

            {/* Step tabs — always all nine, always on one line: the row scrolls sideways
                rather than wrapping when the column is too narrow for all of them. A step
                with nothing in it yet is drawn dashed. */}
            <div className="-mx-1 mt-6 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-1 pb-1">
                {FLOW_STEPS.map((step, i) => {
                    const filled = !!customs[i] || !!dbEmails[i] || i < flow.emails.length;
                    return (
                        <button
                            key={step.key}
                            type="button"
                            title={filled ? undefined : "Not ready yet"}
                            onClick={() => {
                                setTab(i);
                                scrollYRef.current = 0;
                                setPenPop(null);
                            }}
                            className={cx(
                                "shrink-0 rounded-lg border px-3 py-2 text-sm font-semibold whitespace-nowrap transition duration-100 ease-linear",
                                tab === i
                                    ? "border-transparent bg-brand-solid text-white"
                                    : filled
                                      ? "border-secondary bg-primary text-secondary hover:bg-secondary_hover"
                                      : "border-dashed border-secondary bg-primary text-quaternary hover:text-secondary",
                            )}
                        >
                            E{i + 1} {step.name}
                        </button>
                    );
                })}
            </div>
            <p className="mt-2 text-xs text-quaternary">{tab === 0 ? "Sent when the lead signs up" : `Sent in week ${tab + 1}`}</p>

            {/* Team review — every open client note on the flow, read and closed here. A note
                written before the box was combined names the email it was about. */}
            {fb?.mode === "review" && (
                <div className="mt-4">
                    <ClientFeedbackReview
                        feedback={fb}
                        labelFor={(s) => (Number.isInteger(flowFeedbackSlot(s.field_key)) ? `on ${stepLabel(flowFeedbackSlot(s.field_key))}` : null)}
                    />
                </div>
            )}

            {/* Table-sourced email — subject/preview from Pooja's row; edits happen in her pipeline. */}
            {dbEmail && !customs[tab] && (
                <div className="mt-4 rounded-xl bg-secondary px-4 py-3">
                    <p className="text-sm text-tertiary">
                        <span className="font-semibold text-secondary">Subject:</span> {dbEmail.subject || "—"}
                    </p>
                    {dbEmail.preview && <p className="mt-0.5 text-xs text-quaternary">Preview text: {dbEmail.preview}</p>}
                    {!isLocked && (
                        <p className="mt-1 text-xs text-quaternary">
                            Loaded from the email designer's table (week {tab + 1}) — to change it, update the row there; this page always shows the latest
                            version.
                        </p>
                    )}
                </div>
            )}

            {/* Finished-HTML bar — this tab shows an uploaded file, not the built-in editor. */}
            {customs[tab] && !isLocked && (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-secondary px-4 py-3">
                    <p className="min-w-0 flex-1 text-sm text-tertiary">
                        <span className="font-semibold text-secondary">Finished HTML email</span> — delivered by Pooja and shown exactly as it will send. The
                        built-in editor is off for this tab.
                    </p>
                    <label className="cursor-pointer text-sm font-semibold text-brand-secondary hover:underline">
                        Replace file
                        <input type="file" accept=".html,.htm" className="hidden" onChange={onPickHtml(tab)} />
                    </label>
                    <button
                        type="button"
                        onClick={() => {
                            setPasteText(customs[tab] ?? "");
                            setPasteFor(tab);
                        }}
                        className="text-sm font-semibold text-brand-secondary hover:underline"
                    >
                        Paste HTML
                    </button>
                    <button
                        type="button"
                        onClick={() => setCustom(tab, null)}
                        className="text-sm font-semibold text-tertiary transition duration-100 ease-linear hover:text-error-primary"
                    >
                        Remove
                    </button>
                </div>
            )}

            {/* Edit toolbar — built-in emails only; a finished HTML file isn't edited here. */}
            {!isLocked && source === "template" && (
                <div className="mt-4 flex flex-wrap items-end gap-3">
                    <div className="min-w-64 flex-1">
                        <Field label="Subject line" value={builtIn?.subject ?? ""} onChange={(v) => patch((d) => void (d.emails[tab].subject = v))} />
                    </div>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setBrandOpen((o) => !o)}
                            className={cx(
                                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ring-1 transition duration-100 ease-linear",
                                brandOpen ? "bg-brand-solid text-white ring-transparent" : "bg-primary text-secondary ring-secondary hover:bg-secondary_hover",
                            )}
                        >
                            <Settings01 className="size-4" aria-hidden="true" />
                            Brand
                        </button>
                        <AnimatePresence>
                            {brandOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.12 }}
                                    className="absolute right-0 z-30 mt-1.5 flex w-72 flex-col gap-2.5 rounded-xl bg-primary p-3.5 shadow-lg ring-1 ring-secondary"
                                >
                                    <Field
                                        label="Brand color (buttons)"
                                        value={flow.settings.brand_color}
                                        onChange={(v) => brandPatch((d) => void (d.settings.brand_color = v))}
                                        placeholder="#5A7B4F"
                                    />
                                    <Field
                                        label="Heading font (brand font)"
                                        value={flow.settings.heading_font}
                                        onChange={(v) => brandPatch((d) => void (d.settings.heading_font = v))}
                                        placeholder="Georgia, serif"
                                    />
                                    <Field
                                        label="Logo URL"
                                        value={flow.settings.logo_url}
                                        onChange={(v) => brandPatch((d) => void (d.settings.logo_url = v))}
                                        placeholder="https://…"
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            )}

            {/* Even a built-in tab can be replaced by a finished email — file or pasted code. */}
            {!isLocked && source === "template" && (
                <p className="mt-3 text-sm text-tertiary">
                    Replace this email with finished HTML:{" "}
                    <label className="cursor-pointer font-semibold text-brand-secondary hover:underline">
                        Upload file
                        <input type="file" accept=".html,.htm" className="hidden" onChange={onPickHtml(tab)} />
                    </label>{" "}
                    ·{" "}
                    <button
                        type="button"
                        onClick={() => {
                            setPasteText("");
                            setPasteFor(tab);
                        }}
                        className="font-semibold text-brand-secondary hover:underline"
                    >
                        Paste HTML
                    </button>
                </p>
            )}

            {/* Paste-HTML panel */}
            {!isLocked && pasteFor !== null && (
                <div className="mt-4 rounded-xl bg-primary p-4 ring-1 ring-secondary">
                    <p className="text-sm font-semibold text-primary">Paste the email's HTML — it becomes Email {pasteFor + 1}</p>
                    <textarea
                        rows={6}
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        placeholder="<!DOCTYPE html>…"
                        spellCheck={false}
                        className="mt-2 w-full resize-y rounded-lg bg-secondary px-3 py-2 font-mono text-xs text-primary ring-1 ring-secondary outline-none focus:ring-brand"
                    />
                    <div className="mt-2 flex items-center gap-3">
                        <button
                            type="button"
                            onClick={savePaste}
                            disabled={!pasteText.trim()}
                            className="rounded-lg bg-brand-solid px-3.5 py-2 text-sm font-semibold text-white transition duration-100 ease-linear hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Use this HTML
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setPasteFor(null);
                                setPasteText("");
                            }}
                            className="text-sm font-semibold text-tertiary transition duration-100 ease-linear hover:text-secondary"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {!isLocked && source === "template" && (
                <p className="mt-3 text-sm text-tertiary">
                    <span className="font-semibold text-secondary">Double-click</span> any text in the email to edit it · click the{" "}
                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-brand-solid text-[11px] text-white">✎</span> on buttons and
                    images to change the name and link.
                </p>
            )}

            {/* ── Preview = the editor. Mobile and desktop side by side, mobile first;
                   they wrap onto two rows when the column is too narrow for both.

                   The previews and the client's feedback rail share a row as soon as there
                   is width for both. The test is a container query, not a viewport
                   breakpoint: the side menu is draggable, so only the column's real width
                   can decide. Narrower than that and the rail drops underneath, where the
                   composer used to live. The rail sits outside the ready/not-ready split
                   so it stays put on every tab — one note covers the whole flow. ── */}
            <div className="@container mt-4">
                <div className={cx("flex flex-col gap-4", fbRail && "@min-[1012px]:flex-row @min-[1012px]:items-start")}>
                    <div className="flex min-w-0 flex-1 flex-col">
                        {!hasContent ? (
                            <div className="flex flex-col items-center rounded-2xl border border-dashed border-secondary bg-secondary px-6 py-14 text-center">
                                <Mail01 className="size-6 text-fg-quaternary" aria-hidden="true" />
                                <p className="mt-3 text-md font-semibold text-primary">{stepLabel(tab)} isn't ready yet</p>
                                <p className="mt-1 max-w-md text-sm text-tertiary">
                                    {isLocked
                                        ? "This email is still being designed. It will show up here as soon as it's finished."
                                        : "The email designer fills this step automatically when the finished email lands. To place one now, upload the HTML file or paste the code."}
                                </p>
                                {!isLocked && (
                                    <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                                        <label className="cursor-pointer rounded-lg bg-brand-solid px-3.5 py-2 text-sm font-semibold text-white transition duration-100 ease-linear hover:opacity-90">
                                            Upload HTML file
                                            <input type="file" accept=".html,.htm" className="hidden" onChange={onPickHtml(tab)} />
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPasteText("");
                                                setPasteFor(tab);
                                            }}
                                            className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-secondary ring-1 ring-secondary transition duration-100 ease-linear hover:bg-secondary_hover"
                                        >
                                            Paste HTML
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col rounded-2xl ring-1 ring-secondary">
                                {/* Team toolbar — where this email came from and the GoHighLevel export.
                                    Clients get the previews alone; both are internal. */}
                                {isTeam && (
                                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-2xl border-b border-secondary bg-primary px-3 py-2">
                                        <p className="px-1 text-xs text-tertiary">
                                            <span className="font-semibold text-secondary">{stepLabel(tab)}</span>
                                            {" · "}
                                            {source === "pasted"
                                                ? "pasted HTML"
                                                : source === "finished"
                                                  ? "finished HTML from the email designer"
                                                  : "built-in template"}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={copyHtml}
                                            className="flex items-center gap-1.5 rounded-lg bg-brand-solid px-3 py-1.5 text-xs font-semibold text-white transition duration-100 ease-linear hover:opacity-90"
                                        >
                                            {copied ? <Check className="size-3.5" /> : <Copy01 className="size-3.5" />}
                                            {copied ? "Copied!" : "Copy HTML for GHL"}
                                        </button>
                                    </div>
                                )}

                                <div
                                    ref={previewWrapRef}
                                    className={cx(
                                        "relative flex flex-wrap items-start justify-center gap-6 rounded-b-2xl bg-tertiary p-4 md:p-6",
                                        !isTeam && "rounded-t-2xl",
                                    )}
                                    onClick={() => {
                                        setBrandOpen(false);
                                        setPenPop(null);
                                    }}
                                >
                                    {DEVICES.map((d) => (
                                        <figure key={d.id} className="flex max-w-full flex-col" style={{ width: d.width }}>
                                            <figcaption className="mb-2 flex items-center gap-1.5 px-0.5 text-[11px] font-semibold tracking-wide text-quaternary uppercase">
                                                <d.icon className="size-3.5" aria-hidden="true" />
                                                {d.label}
                                                <span className="font-normal tracking-normal normal-case">{d.width}px</span>
                                            </figcaption>
                                            {/* The "device" stays a light surface in both themes on purpose — the
                                            email inside assumes one — so its inbox header uses fixed colours
                                            rather than theme tokens, exactly like the white iframe below it. */}
                                            <div className="overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-secondary">
                                                <div className="border-b border-[#e9eaeb] bg-[#f7f7f8] px-5 py-4 text-left">
                                                    <p className="text-sm font-semibold text-[#181d27]">{subject || "No subject line yet"}</p>
                                                    {previewText && <p className="mt-0.5 text-sm text-[#535862]">{previewText}</p>}
                                                </div>
                                                <iframe
                                                    ref={d.id === "mobile" ? mobileRef : desktopRef}
                                                    title={`${stepLabel(tab)} — ${d.label} preview`}
                                                    srcDoc={previewHtml ?? ""}
                                                    sandbox={isLocked || custom ? "" : "allow-scripts"}
                                                    onLoad={restoreScroll}
                                                    className="block w-full bg-white"
                                                    style={{ height: isLocked ? 640 : 780, border: "0" }}
                                                />
                                            </div>
                                        </figure>
                                    ))}

                                    {/* ✎ popover — change the name, attach a link, save */}
                                    <AnimatePresence>
                                        {penPop && !isLocked && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95, y: 4 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.97, y: 4 }}
                                                transition={{ duration: 0.12 }}
                                                className="absolute z-30 flex w-72 flex-col gap-2.5 rounded-xl bg-primary p-3.5 shadow-lg ring-1 ring-secondary"
                                                style={{ left: penPop.x, top: penPop.y }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs font-bold tracking-wide text-quaternary uppercase">
                                                        {penPop.kind === "btn" ? "Edit button" : penPop.kind === "logo" ? "Edit logo" : "Edit image"}
                                                    </p>
                                                    <button
                                                        type="button"
                                                        title="Close"
                                                        onClick={() => setPenPop(null)}
                                                        className="text-fg-quaternary hover:text-fg-secondary"
                                                    >
                                                        <XClose className="size-4" aria-hidden="true" />
                                                    </button>
                                                </div>
                                                <Field
                                                    label={
                                                        penPop.kind === "btn"
                                                            ? "Name"
                                                            : penPop.kind === "logo"
                                                              ? "Logo image URL"
                                                              : "Image URL (from GoHighLevel)"
                                                    }
                                                    value={penPop.a}
                                                    onChange={(v) => setPenPop((p) => (p ? { ...p, a: v } : p))}
                                                    placeholder={penPop.kind === "btn" ? "Button text" : "https://…"}
                                                />
                                                {penPop.hasLink && (
                                                    <Field
                                                        label="Link"
                                                        value={penPop.b}
                                                        onChange={(v) => setPenPop((p) => (p ? { ...p, b: v } : p))}
                                                        placeholder="https://…"
                                                    />
                                                )}
                                                {penPop.kind !== "btn" && !isTemplate && clientName.trim() && (
                                                    <button
                                                        type="button"
                                                        onClick={openGhlPicker}
                                                        className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-secondary ring-1 ring-secondary transition duration-100 ease-linear hover:bg-secondary_hover"
                                                    >
                                                        <Image01 className="size-4" aria-hidden="true" />
                                                        Browse GoHighLevel images
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={savePen}
                                                    className="mt-0.5 rounded-lg bg-brand-solid px-3 py-2 text-sm font-semibold text-white transition duration-100 ease-linear hover:opacity-90"
                                                >
                                                    Save
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}
                    </div>
                    {fbRail}
                </div>
            </div>

            {/* GHL Media Library picker — click a thumbnail to fill the pen popover's URL */}
            <AnimatePresence>
                {ghlPicker && (
                    <motion.div
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 py-8"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onMouseDown={(e) => e.target === e.currentTarget && setGhlPicker(null)}
                    >
                        <motion.div
                            className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-primary shadow-2xl ring-1 ring-secondary"
                            initial={{ opacity: 0, scale: 0.95, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.97, y: 8 }}
                            transition={{ type: "spring", stiffness: 300, damping: 26 }}
                        >
                            <div className="flex items-center gap-3 border-b border-secondary px-5 py-3.5">
                                <div className="min-w-0 flex-1">
                                    <h3 className="truncate text-md font-semibold text-primary">GoHighLevel images — {clientName}</h3>
                                    <p className="text-xs text-tertiary">Newest first, straight from the client's Media Library. Click one to use it.</p>
                                </div>
                                <div className="relative w-56 shrink-0">
                                    <SearchSm
                                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-quaternary"
                                        aria-hidden="true"
                                    />
                                    <input
                                        type="text"
                                        value={ghlPicker.query}
                                        placeholder="Search, then press Enter"
                                        onChange={(e) => setGhlPicker((p) => (p ? { ...p, query: e.target.value } : p))}
                                        onKeyDown={(e) => e.key === "Enter" && void fetchGhlImages(ghlPicker.query, 0, false)}
                                        className="w-full rounded-lg border border-secondary bg-primary py-2 pr-3 pl-9 text-sm text-primary outline-none placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand"
                                    />
                                </div>
                                <button
                                    type="button"
                                    title="Close"
                                    onClick={() => setGhlPicker(null)}
                                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-quaternary hover:bg-secondary hover:text-fg-secondary"
                                >
                                    <XClose className="size-5" aria-hidden="true" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-5">
                                {ghlPicker.error ? (
                                    <p className="rounded-xl bg-error-primary px-4 py-3 text-sm text-error-primary">{ghlPicker.error}</p>
                                ) : ghlPicker.images.length === 0 && !ghlPicker.loading ? (
                                    <p className="py-10 text-center text-sm text-tertiary">
                                        {ghlPicker.query.trim()
                                            ? `No images match “${ghlPicker.query.trim()}”.`
                                            : "No images in this client's Media Library yet."}
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                                        {ghlPicker.images.map((img) => (
                                            <button
                                                key={img.url}
                                                type="button"
                                                onClick={() => pickGhlImage(img.url)}
                                                title={img.name}
                                                className="group flex flex-col overflow-hidden rounded-xl ring-1 ring-secondary transition duration-100 ease-linear hover:ring-2 hover:ring-brand"
                                            >
                                                <span className="aspect-square w-full overflow-hidden bg-secondary">
                                                    <img
                                                        src={img.url}
                                                        alt={img.name}
                                                        loading="lazy"
                                                        className="size-full object-cover transition duration-200 group-hover:scale-105"
                                                        draggable={false}
                                                    />
                                                </span>
                                                <span className="truncate px-2 py-1.5 text-left text-xs text-tertiary">{img.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {ghlPicker.loading && (
                                    <div className="flex items-center justify-center py-8">
                                        <span className="size-5 animate-spin rounded-full border-2 border-brand border-t-transparent opacity-70" />
                                    </div>
                                )}
                                {!ghlPicker.loading && !ghlPicker.error && ghlPicker.hasMore && (
                                    <button
                                        type="button"
                                        onClick={() => void fetchGhlImages(ghlPicker.query, ghlPicker.offset + 24, true)}
                                        className="mt-4 w-full rounded-lg border border-secondary bg-primary px-3 py-2 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:bg-secondary_hover"
                                    >
                                        Load more
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
