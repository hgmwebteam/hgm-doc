/**
 * The Website Setup Guide section's model: the accounts it asks for, the defaults an older
 * row is merged over, the progress the side menu and the journey read, and the call that
 * saves a client's answers.
 *
 * No React here so the Netlify function's sanitiser and this file can be kept in step by
 * reading them side by side (netlify/functions/website-setup.mts mirrors ACCOUNT_IDS and
 * the field caps below — change both together).
 */
import type { WebsiteSetup } from "@/lib/supabase";

export type { WebsiteSetup };

/**
 * The shared master template of the owner guide. Team-only: the OwnerGuideScreen's
 * TemplateGate turns anyone without an @hiddengem.media session away, so this link is
 * only ever rendered for the team. A client is shown their OWN guide (/owner-guide/{slug})
 * once the team has created it.
 */
export const OWNER_GUIDE_TEMPLATE_URL = "https://hgmportal.com/owner-guide";

export const NETLIFY_SIGNUP_URL = "https://app.netlify.com/signup";

export type WebsiteSetupAccountId = "supabase" | "resend" | "stripe" | "pms" | "domain" | "cloudflare";

/**
 * Everything the AI website needs the client to own, in the order the owner guide walks
 * them. Netlify is not in this list on purpose — it is required of every client, opted in
 * or not, and has its own card above the AI website question.
 *
 * `valueLabel` names the ONE non-secret thing we collect per service. Passwords and API
 * keys are handed over in the client's password-gated owner guide, never here — the
 * dashboard row is readable with the public anon key.
 */
export const SETUP_ACCOUNTS: {
    id: WebsiteSetupAccountId;
    name: string;
    what: string;
    valueLabel: string;
    valuePlaceholder: string;
    /** Where to create the account. Absent when the client already has one (PMS, registrar). */
    signupUrl?: string;
    signupLabel?: string;
}[] = [
    {
        id: "supabase",
        name: "Supabase",
        what: "The database behind your site — it stores your property details, reservations and photos.",
        valueLabel: "Account email",
        valuePlaceholder: "you@yourbusiness.com",
        signupUrl: "https://supabase.com/dashboard/sign-up",
        signupLabel: "Create a Supabase account",
    },
    {
        id: "resend",
        name: "Resend",
        what: "Sends your booking confirmations, enquiry notifications and receipts from your own domain.",
        valueLabel: "Account email",
        valuePlaceholder: "you@yourbusiness.com",
        signupUrl: "https://resend.com/signup",
        signupLabel: "Create a Resend account",
    },
    {
        id: "stripe",
        name: "Stripe",
        what: "Takes guest payments directly, so bookings pay out to your own bank account.",
        valueLabel: "Account email",
        valuePlaceholder: "you@yourbusiness.com",
        signupUrl: "https://dashboard.stripe.com/register",
        signupLabel: "Create a Stripe account",
    },
    {
        id: "pms",
        name: "Property management system",
        what: "Guesty, Hostaway, Lodgify, Hostfully, Smoobu or similar — it syncs availability, rates and reservations to the site.",
        valueLabel: "Which PMS do you use, and the login email?",
        valuePlaceholder: "Hostaway — you@yourbusiness.com",
    },
    {
        id: "domain",
        name: "Domain registrar",
        what: "Where your web address is registered — GoDaddy, Namecheap, Squarespace Domains, Cloudflare Registrar and the like.",
        valueLabel: "Which registrar, and the login email?",
        valuePlaceholder: "Namecheap — you@yourbusiness.com",
    },
    {
        id: "cloudflare",
        name: "Cloudflare",
        what: "Manages your DNS and keeps the site fast and protected. Free plan is all you need.",
        valueLabel: "Account email",
        valuePlaceholder: "you@yourbusiness.com",
        signupUrl: "https://dash.cloudflare.com/sign-up",
        signupLabel: "Create a Cloudflare account",
    },
];

export const ACCOUNT_IDS = SETUP_ACCOUNTS.map((a) => a.id);

export const DEFAULT_WEBSITE_SETUP: WebsiteSetup = {
    netlify_email: "",
    netlify_password: "",
    ai_website: "",
    accounts: {},
    domain: "",
    notes: "",
};

/** Merge whatever an older row holds over the defaults, so no field is ever undefined. */
export const mergeWebsiteSetup = (partial?: Partial<WebsiteSetup> | null): WebsiteSetup => ({
    ...DEFAULT_WEBSITE_SETUP,
    ...partial,
    accounts: { ...(partial?.accounts ?? {}) },
});

export const accountState = (setup: WebsiteSetup, id: WebsiteSetupAccountId) => setup.accounts[id] ?? { value: "", done: false };

/** Netlify counts as done once both the login email and password are filled in — no tick box. */
export const netlifyDone = (setup: WebsiteSetup) => Boolean(setup.netlify_email.trim() && setup.netlify_password.trim());

/**
 * What the section still needs from the client, as a count the menu badge and the journey
 * step can print.
 *
 * Netlify is always one item. The six AI-website accounts join the total only once the
 * client has said yes — before that, or after a no, a client who never wanted a website is
 * not shown as five-sixths unfinished. `complete` is therefore also the journey step's
 * done state, and it is derived rather than ticked so it can never contradict the count
 * beside it.
 */
export const websiteSetupProgress = (setup: WebsiteSetup) => {
    const items: boolean[] = [netlifyDone(setup)];
    if (setup.ai_website === "yes") for (const id of ACCOUNT_IDS) items.push(accountState(setup, id).done);
    const done = items.filter(Boolean).length;
    return { done, total: items.length, complete: done === items.length };
};

/* ── Client saves ─────────────────────────────────────────────────────────
   A client is `anon` to Supabase and has no UPDATE grant on dashboard_pages, so their
   answers go through the function, which holds the service-role key and writes this one
   key only. Same shape as the suggestions wrapper: a non-JSON answer (the dev server with
   no functions behind it, a proxy error page) throws instead of passing as success. */

const ENDPOINT = "/.netlify/functions/website-setup";

export const saveWebsiteSetup = async (slug: string, email: string, setup: WebsiteSetup): Promise<void> => {
    let res: Response;
    try {
        res = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, email, setup }) });
    } catch {
        throw new Error("Couldn't reach the server — check your connection and try again.");
    }
    const text = await res.text();
    let json: Record<string, unknown> = {};
    if (text) {
        try {
            json = JSON.parse(text) as Record<string, unknown>;
        } catch {
            throw new Error(`The server didn't answer properly (${res.status}). Your answers weren't saved — please try again.`);
        }
    }
    if (!res.ok) throw new Error(String(json.error ?? `Request failed (${res.status})`));
};
