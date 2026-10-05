import { createClient } from "@supabase/supabase-js";
import { pushCrmCells } from "../lib/crm-sheet.mts";
import { accountManagerEmail } from "../lib/team-emails.mts";

/**
 * Emails a client's assigned Account Manager when they submit one of their two forms — two
 * separate triggers, one email each:
 *   - Onboarding Form      /{base}-onboarding
 *   - Account Access Form  /{base}-access
 * Both live in client_onboarding_pages, one row per form.
 *
 * Called by the form (client-onboarding-form-page.tsx) right after its Submit write lands. The
 * caller is an anonymous client, so it sends nothing but the slug and every fact is re-read here
 * with the service role: the row must really carry `submittedAt`, and that row's `am_notified_at`
 * is claimed (NULL → now) before sending, so a resubmit, a double-click or a replayed request
 * sends nothing more.
 *
 * The AM is found the only way the data links them: "{base}-dashboard" → the `clients` row whose
 * `link` ends in it → `clients.am` (a roster name) → netlify/lib/team-emails.mts.
 *
 * The Account Access email names which logins were shared, NEVER their values: an inbox is not
 * where passwords belong, and the AM reads them on the form's answers page.
 *
 * Needs RESEND_API_KEY and RESEND_FROM (e.g. "HGM Portal <notifications@hgmportal.com>", on a
 * domain verified in Resend) in the Netlify UI.
 */

const SITE = "https://hgmportal.com";

const FORMS = {
    onboarding: { suffix: "-onboarding", title: "Onboarding Form" },
    access: { suffix: "-access", title: "Account Access Form" },
} as const;

/** Mirrors the `credentials: true` questions in client-onboarding-form-page.tsx's ACCESS_SECTIONS. */
const LOGINS: { field: string; label: string; platform?: string }[] = [
    { field: "instagramLogin", label: "Instagram" },
    { field: "tiktokLogin", label: "TikTok" },
    { field: "domainLogin", label: "Domain host", platform: "domainPlatform" },
];

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export default async (req: Request) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;
    if (!supabaseUrl || !serviceKey || !resendKey || !from) {
        console.error("[form-submitted] not configured — needs SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY and RESEND_FROM");
        return Response.json({ error: "Not configured." }, { status: 500 });
    }

    let slug: string;
    try {
        const body = await req.json();
        slug = String(body.slug ?? "").trim();
    } catch {
        return Response.json({ error: "Bad request." }, { status: 400 });
    }
    // "-hostonboarding" (the Brand Vision Form) also ends in "onboarding" — it is not one of these.
    if (!slug || slug.length > 120 || !/^[a-z0-9-]+-(onboarding|access)$/.test(slug) || slug.endsWith("-hostonboarding")) {
        return Response.json({ error: "Bad slug." }, { status: 400 });
    }
    const kind = slug.endsWith(FORMS.access.suffix) ? "access" : "onboarding";
    const form = FORMS[kind];
    const base = slug.slice(0, -form.suffix.length);

    const db = createClient(supabaseUrl, serviceKey);

    const { data: row, error: readErr } = await db.from("client_onboarding_pages").select("client_name, data, am_notified_at").eq("slug", slug).maybeSingle();
    if (readErr || !row) return Response.json({ error: "Not found." }, { status: 404 });

    const data = (row.data ?? {}) as { answers?: Record<string, string>; submittedAt?: string };
    if (!data.submittedAt) return Response.json({ ok: true, sent: false, reason: "not-submitted" });

    // Links are stored as "/{base}-dashboard"; match the tail so a full URL typed into the field still counts.
    const { data: clientRows } = await db.from("clients").select("name, am, link").ilike("link", `%/${base}-dashboard`).limit(1);
    const client = clientRows?.[0];

    // The CRM sheet's "Questionnaire" column is the Onboarding Form. Before the already-sent check,
    // so a resubmit re-asserts it; the write is idempotent and never throws.
    if (kind === "onboarding") await pushCrmCells((client?.name || row.client_name || base).trim(), { Questionnaire: "Complete" });

    if (row.am_notified_at) return Response.json({ ok: true, sent: false, reason: "already-sent" });
    const to = accountManagerEmail(client?.am);
    if (!to) {
        console.warn(`[form-submitted] ${slug}: no AM email (client row ${client ? "found" : "missing"}, am="${client?.am ?? ""}")`);
        return Response.json({ ok: true, sent: false, reason: "no-am-email" });
    }

    // Claim before sending: only the request that flips NULL → now() goes on to send.
    const claimedAt = new Date().toISOString();
    const { data: claimed, error: claimErr } = await db
        .from("client_onboarding_pages")
        .update({ am_notified_at: claimedAt })
        .eq("slug", slug)
        .is("am_notified_at", null)
        .select("slug");
    if (claimErr) {
        console.error("[form-submitted] claim failed", claimErr);
        return Response.json({ error: "Could not save." }, { status: 500 });
    }
    if (!claimed?.length) return Response.json({ ok: true, sent: false, reason: "already-sent" });

    const clientName = (client?.name || row.client_name || base).trim();
    const firstName = (client?.am ?? "").trim().split(/\s+/)[0] || "there";
    const formUrl = `${SITE}/${slug}`;
    const dashboardUrl = `${SITE}/${base}-dashboard`;

    const answers = data.answers ?? {};
    const has = (k: string) => !!(answers[k] ?? "").trim();
    const logins =
        kind === "access"
            ? LOGINS.map((l) => {
                  const platform = l.platform ? (answers[l.platform] ?? "").trim() : "";
                  return { label: platform ? `${l.label} (${platform})` : l.label, shared: has(`${l.field}__user`) || has(`${l.field}__pass`) };
              })
            : [];

    const subject = `${clientName} has submitted their ${form.title}`;
    const text = [
        `Hi ${firstName},`,
        "",
        `${clientName} has submitted their ${form.title}.`,
        ...(logins.length ? ["", "Logins:", ...logins.map((l) => `- ${l.label}: ${l.shared ? "shared" : "not shared"}`)] : []),
        "",
        `Answers: ${formUrl}`,
        `Dashboard: ${dashboardUrl}`,
    ].join("\n");
    const html = `<p>Hi ${escapeHtml(firstName)},</p>
<p><strong>${escapeHtml(clientName)}</strong> has submitted their ${form.title}.</p>
${logins.length ? `<p>Logins:</p><ul>${logins.map((l) => `<li>${escapeHtml(l.label)}: ${l.shared ? "shared" : "not shared"}</li>`).join("")}</ul>` : ""}
<p><a href="${formUrl}">View their answers</a> · <a href="${dashboardUrl}">Open their dashboard</a></p>`;

    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, text, html }),
    });
    if (!res.ok) {
        console.error("[form-submitted] Resend failed", res.status, await res.text().catch(() => ""));
        // Release the claim so the next submit can try again.
        await db.from("client_onboarding_pages").update({ am_notified_at: null }).eq("slug", slug).eq("am_notified_at", claimedAt);
        return Response.json({ error: "Email failed." }, { status: 502 });
    }

    return Response.json({ ok: true, sent: true });
};
