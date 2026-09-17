import type { User } from "@supabase/supabase-js";

/**
 * Who counts as HiddenGem staff, decided ONCE, server-side.
 *
 * ── WHY A DOMAIN TEST ALONE IS NOT ENOUGH HERE ─────────────────────────────
 * The portal's Supabase project has disable_signup FALSE and the email provider
 * on (read off the auth config 12 Sep 2026). Anyone on the internet can register
 * "anything@hiddengem.media" against it. What stops that account getting a
 * session is mailer_autoconfirm FALSE: sign-in is refused until the confirmation
 * link in that mailbox is clicked (tested the same day: "Email not confirmed"
 * before, a token after). So a bare domain test would rest on one checkbox in a
 * dashboard nobody in either repo owns, and would silently become "type any
 * staff address and read every client's request history" the day it moved.
 *
 * The three tests below rest on the user record inside the token instead:
 *
 *   1. the domain, parsed the way the platform's staff-domain.ts parses it -
 *      exact match on everything after the LAST @, so x@hiddengem.media.evil.com
 *      and x@sub.hiddengem.media both fail;
 *   2. email_confirmed_at set - the account has proved it can read that mailbox;
 *   3. the Google provider - the portal's only sign-in anywhere is
 *      signInWithOAuth({ provider: "google" }), and all 12 staff accounts carry
 *      app_metadata.providers ["google"] (measured 12 Sep 2026). Google will not
 *      issue an identity for a Workspace address the person does not control,
 *      and app_metadata can only be written with the service key, so a
 *      self-registered email account cannot claim it.
 *
 * Together they do not depend on disable_signup at all.
 *
 * ── WHY THIS FILE AND NOT SIX endsWith CALLS ───────────────────────────────
 * The portal already tests for team in several screens with
 * email.endsWith("@hiddengem.media"). Those decide what a browser SHOWS; this
 * decides what a server RETURNS, and it is the only copy that grants anything.
 */

export const STAFF_EMAIL_DOMAINS: readonly string[] = (process.env.STAFF_EMAIL_DOMAINS ?? "hiddengem.media")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);

/** The domain half only. Exported so the proof can pin the parse. */
export const isStaffEmail = (email: string | null | undefined): boolean => {
    const e = (email ?? "").trim().toLowerCase();
    const at = e.lastIndexOf("@");
    if (at < 1 || at === e.length - 1) return false;
    if (e.slice(0, at).includes("@")) return false;
    return STAFF_EMAIL_DOMAINS.includes(e.slice(at + 1));
};

/** All three tests, against the auth user the token resolved to. */
export const isStaffUser = (user: Pick<User, "email" | "email_confirmed_at" | "app_metadata"> | null | undefined): boolean => {
    if (!user) return false;
    if (!isStaffEmail(user.email)) return false;
    if (!user.email_confirmed_at) return false;
    const providers: unknown = user.app_metadata?.providers;
    const provider: unknown = user.app_metadata?.provider;
    const viaGoogle = (Array.isArray(providers) && providers.includes("google")) || provider === "google";
    return viaGoogle;
};
