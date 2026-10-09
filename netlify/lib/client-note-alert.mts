import type { SupabaseClient } from "@supabase/supabase-js";
import { sectionForKey } from "../../src/pages/client/dashboard/suggestions-model.ts";
import { isStaffEmail } from "./staff.mts";
import { FORM_SUBMISSION_CC, accountManagerEmail } from "./team-emails.mts";

/**
 * Tells the team a client left a note on their dashboard: one email to the client's Account
 * Manager and one message in the team's Google Chat space. Called by the three functions a
 * client's note passes through — dashboard-suggestions (create), landing-page-review
 * (request_changes) and pinned-stories-review (comment) — AFTER the row is saved. One call,
 * one alert, however many items the call carried.
 *
 * Best-effort and bounded, the mirrorToEmailTable way: the note is already saved and is what
 * the team reviews on Home, so nothing here may turn the client's send into an error. It
 * never throws, never rejects, and each call out gives up after ALERT_TIMEOUT_MS. It is
 * awaited, not fired and forgotten, because a Netlify function can be frozen the moment it
 * responds and an un-awaited promise may never run.
 *
 * Each channel is its own switch: email goes when RESEND_API_KEY and RESEND_FROM are set
 * (the same pair form-submitted uses), Chat when TEAM_CHAT_WEBHOOK_URL is (an incoming
 * webhook on the space: Apps & integrations → Webhooks; the URL is the secret). Neither set
 * is a logged no-op.
 *
 * What it is told is the leak guard: the slug, the client's email, the dashboard's
 * client_name and the items. Nothing else from dashboard_pages.data — which carries
 * share_password — is passed in, so nothing else can reach an inbox or a chat room.
 *
 * The AM is found the only way the data links them (form-submitted.mts): the `clients` row
 * whose `link` ends in /{slug} → `clients.am` → team-emails.mts. With no AM the note goes to
 * FORM_SUBMISSION_CC, as the forms do. A staff address never alerts: a teammate on a test
 * dashboard's allowlist is not a client writing in.
 */

const SITE = "https://hgmportal.com";
/** The client is waiting on their send, so the alert gets a budget, not the invocation. */
export const ALERT_TIMEOUT_MS = 4_000;
/** How much of a note the email shows; the link has the rest. */
export const EMAIL_CLIP = 500;
/** Chat is a glance: shorter, and at most CHAT_ITEMS before "and k more". */
export const CHAT_CLIP = 280;
export const CHAT_ITEMS = 8;
/** Google Chat refuses a text message past 4,096 characters; keep a margin. */
export const CHAT_MAX = 3_800;

export interface ClientNoteItem {
    /** dashboard_suggestions.field_key, or a synthetic key under a known prefix
     *  ("landingPage.review", "pinnedStories.review") so one table decides the section. */
    key: string;
    /** dashboard_suggestions.field_label, or the calling function's own label. May be "". */
    label: string;
    /** What the client wrote. Clipped by the builder, never logged. */
    text: string;
}

export interface ClientNoteEvent {
    /** "{base}-dashboard", already shape-checked by the caller. */
    slug: string;
    /** The client's email, already validated against the dashboard's allowlist. */
    by: string;
    /** dashboard_pages.client_name — the fallback when the clients row is missing. */
    dashboardClientName: string;
    items: ClientNoteItem[];
}

export interface ClientNoteMessages {
    subject: string;
    text: string;
    html: string;
    chat: string;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const clip = (s: string, max: number) => {
    const t = s.trim();
    return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The line the team reads for one item: for a document edit the section and the field
 *  (Home's rule), otherwise the item's own label — "Welcome email 3 · feedback",
 *  "Pinned post 03 · Lake view" — or the section's name when it has none. */
const headingOf = (item: ClientNoteItem) => {
    const s = sectionForKey(item.key);
    const label = item.label.trim();
    if (s.anchor === "foundation") return label ? `${s.label} · ${label}` : s.label;
    return label || s.label;
};

/** Pure: the subject, the email bodies and the Chat text for one event. Pinned by
 *  client-note-alert.check.mts, so change the wording there too. */
export const buildClientNoteMessages = (
    ev: Pick<ClientNoteEvent, "slug" | "by" | "items">,
    ctx: { clientName: string; amFirstName: string | null },
): ClientNoteMessages => {
    const n = ev.items.length;
    const sections = ev.items.map((i) => sectionForKey(i.key));
    const first = sections[0] ?? sectionForKey("");
    const same = sections.every((s) => s.anchor === first.anchor);
    const what = n === 1 ? first.label : same ? plural(n, first.label) : `${n} dashboard notes`;
    const subject = `${ctx.clientName} · ${what}`;
    const home = `${SITE}/home`;
    const greeting = `Hi ${ctx.amFirstName || "team"},`;
    const count = n === 1 ? "a note" : `${n} notes`;

    const entries = ev.items.map((item, i) => ({
        heading: headingOf(item),
        text: item.text.trim() || "(cleared)",
        link: `${SITE}/${ev.slug}#${sections[i]!.anchor}`,
    }));

    const text = [
        greeting,
        "",
        `${ctx.clientName} (${ev.by}) left ${count} on their dashboard.`,
        "",
        ...entries.flatMap((e) => [e.heading, clip(e.text, EMAIL_CLIP), e.link, ""]),
        `Everything waiting for the team: ${home}`,
    ].join("\n");

    const html = [
        `<p>${escapeHtml(greeting)}</p>`,
        `<p><strong>${escapeHtml(ctx.clientName)}</strong> (${escapeHtml(ev.by)}) left ${count} on their dashboard.</p>`,
        ...entries.map(
            (e) =>
                `<p><strong>${escapeHtml(e.heading)}</strong><br>${escapeHtml(clip(e.text, EMAIL_CLIP)).replace(/\n/g, "<br>")}<br><a href="${e.link}">Open this section</a></p>`,
        ),
        `<p><a href="${home}">Everything waiting for the team</a></p>`,
    ].join("\n");

    // Chat: each note sits in a code fence so Chat's *_~ markup can't restyle a client's
    // words, and a backtick inside it is swapped for ' so the fence stays balanced. Items
    // are added while they fit under CHAT_MAX, never cut mid-fence, then "and k more".
    const fence = (s: string) => "```\n" + s.replace(/`/g, "'") + "\n```";
    const header = `*${ctx.clientName}* · ${what} · by ${ev.by}`;
    const footer = (k: number) => `_and ${k} more · <${home}|Home>_`;
    const lines = [header];
    let used = header.length;
    let shown = 0;
    for (const e of entries) {
        if (shown >= CHAT_ITEMS) break;
        const block = `*${e.heading}* · <${e.link}|Open>\n${fence(clip(e.text, CHAT_CLIP))}`;
        const left = entries.length - shown - 1;
        if (used + 1 + block.length + (left > 0 ? 1 + footer(left).length : 0) > CHAT_MAX) break;
        lines.push(block);
        used += 1 + block.length;
        shown++;
    }
    const rest = entries.length - shown;
    if (rest > 0) lines.push(footer(rest));
    const chat = lines.join("\n");

    return { subject, text, html, chat };
};

type Outcome = boolean | "skipped";
type ClientRow = { name: string | null; am: string | null };

const reason = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Never throws, never rejects; bounded by ALERT_TIMEOUT_MS per channel (the two run in parallel). */
export const alertClientNote = async (db: SupabaseClient, ev: ClientNoteEvent): Promise<void> => {
    try {
        const resendKey = process.env.RESEND_API_KEY;
        const from = process.env.RESEND_FROM;
        const chatUrl = process.env.TEAM_CHAT_WEBHOOK_URL;
        const emailOn = !!resendKey && !!from;
        const chatOn = !!chatUrl;
        if (!emailOn && !chatOn) {
            console.warn("[client-note-alert] not configured — set RESEND_API_KEY + RESEND_FROM and/or TEAM_CHAT_WEBHOOK_URL in Netlify");
            return;
        }
        if (ev.items.length === 0) return;
        if (isStaffEmail(ev.by)) return;

        const base = ev.slug.replace(/-dashboard$/, "");
        let client: ClientRow | null = null;
        try {
            // Links are stored as "/{base}-dashboard"; match the tail so a full URL typed into the field still counts.
            const { data } = await db.from("clients").select("name, am").ilike("link", `%/${ev.slug}`).limit(1);
            client = (data?.[0] as ClientRow | undefined) ?? null;
        } catch (err) {
            console.warn("[client-note-alert] clients lookup failed", reason(err));
        }
        const clientName = (client?.name || ev.dashboardClientName || base).trim();
        const amEmail = accountManagerEmail(client?.am);
        if (!amEmail) console.warn(`[client-note-alert] ${ev.slug}: no AM email (client row ${client ? "found" : "missing"}, am="${client?.am ?? ""}")`);
        const to = amEmail ? [amEmail] : FORM_SUBMISSION_CC;
        const amFirstName = (amEmail && (client?.am ?? "").trim().split(/\s+/)[0]) || null;

        const msg = buildClientNoteMessages(ev, { clientName, amFirstName });

        const sendEmail = async (): Promise<Outcome> => {
            if (!emailOn) return "skipped";
            try {
                const res = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ from, to, subject: msg.subject, text: msg.text, html: msg.html }),
                    signal: AbortSignal.timeout(ALERT_TIMEOUT_MS),
                });
                if (res.ok) return true;
                console.error("[client-note-alert] Resend failed", res.status, (await res.text().catch(() => "")).slice(0, 200));
                return false;
            } catch (err) {
                console.error("[client-note-alert] Resend could not be reached", reason(err));
                return false;
            }
        };

        const sendChat = async (): Promise<Outcome> => {
            if (!chatOn) return "skipped";
            try {
                const res = await fetch(chatUrl!, {
                    method: "POST",
                    headers: { "Content-Type": "application/json; charset=UTF-8" },
                    body: JSON.stringify({ text: msg.chat }),
                    signal: AbortSignal.timeout(ALERT_TIMEOUT_MS),
                });
                if (res.ok) return true;
                // Status only: the body could echo the webhook's own identifiers.
                console.error("[client-note-alert] Google Chat failed", res.status);
                return false;
            } catch (err) {
                console.error("[client-note-alert] Google Chat could not be reached", reason(err));
                return false;
            }
        };

        const [email, chat] = await Promise.all([sendEmail(), sendChat()]);
        console.log(`[client-note-alert] sent ${ev.slug} items=${ev.items.length} email=${email} chat=${chat}`);
    } catch (err) {
        console.error("[client-note-alert] failed", reason(err));
    }
};
