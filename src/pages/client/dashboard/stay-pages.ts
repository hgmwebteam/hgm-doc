import { FOCUS_PROPERTY_MAX } from "@/pages/client/dashboard/dashboard-model";

/**
 * Which of a site's pages are individual stays.
 *
 * Section 11 of the Master Brand Document is the client's whole sitemap — the home page,
 * About, Contact and, on a portfolio site, one page per cabin. Section 8 (Focus properties)
 * wants exactly that last group and nothing else, one drafted entry per page.
 *
 * The test is the PARENT path segment, not a word anywhere in the URL. On every portfolio
 * site the stays sit under one folder — /properties/coach-house, /cabins/wild-blue — and
 * that folder is what separates a listing from the pages beside it: /properties is the index
 * of them, /about-the-property is a story page, and matching "propert" anywhere would take
 * both. Pages two or more levels down are still stays (/en/properties/wild-blue), because
 * only the segment directly above the page is read.
 *
 * Pure and exported so the rule is checkable in one place — see stay-pages.check.ts.
 */

/** The folder names a stay lives under. Singular and plural, since sites use both. */
const STAY_PARENT =
    /^(propert(y|ies)|stays?|cabins?|cottages?|chalets?|lodges?|villas?|homes?|houses?|rentals?|listings?|rooms?|suites?|units?|accommodations?|accomodations?)$/i;

/** Pages under a stay folder that are not a stay: the folder's own index and its plumbing. */
const NOT_A_STAY = /^(index|all|search|availability|book(ing)?|enquir|inquir|contact|terms|faq)/i;

export type PageLink = { page: string; url: string };

/**
 * The individual stay pages in a link table, in the order they were listed.
 *
 * Capped because this drives one page fetch and one model call each, and because focus
 * properties are a selection — the handful a client is marketed on, not their whole
 * portfolio. Which five is the account manager's call, made by editing section 11. Rows
 * with no usable URL are skipped rather than guessed at.
 */
/* The same number as the section it fills — a walk that drafted six entries into a
   five-card section would be drafting one of them into nowhere. */
export const STAY_PAGE_MAX = FOCUS_PROPERTY_MAX;

export const stayPageLinks = (links: readonly PageLink[], max = STAY_PAGE_MAX): PageLink[] => {
    const out: PageLink[] = [];
    const seen = new Set<string>();
    for (const l of links) {
        let u: URL;
        try {
            u = new URL(l.url.trim());
        } catch {
            continue;
        }
        if (u.protocol !== "http:" && u.protocol !== "https:") continue;
        const segments = u.pathname.split("/").filter(Boolean);
        if (segments.length < 2) continue;
        if (!STAY_PARENT.test(segments[segments.length - 2])) continue;
        if (NOT_A_STAY.test(segments[segments.length - 1])) continue;
        const key = u.href.replace(/\/+$/, "").toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ page: l.page.trim(), url: u.href });
        if (out.length >= max) break;
    }
    return out;
};
