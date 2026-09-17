import { createClient } from "@supabase/supabase-js";
import { type LoginToWrite, NOT_CONFIGURED, findOrCreateClientVault, opClient, readOnePasswordEnv, vaultTitleFor, writeLogin } from "../lib/onepassword.mts";

/**
 * Onboarding Form → 1Password. The one place a client's passwords are ever handled.
 *
 * The passwords a client types in the Account Setup section never reach Supabase. The
 * form holds them in component state only — out of the autosaved draft — and posts them
 * here on submit; this function writes them into the client's own 1Password vault and
 * they exist nowhere else afterwards. Everything else about those questions (username,
 * @handle, which PMS, which domain host) is an ordinary answer and stays in the row.
 *
 * That split is the whole point. `client_onboarding_pages` is readable by `anon` under
 * its RLS policies, and the anon key ships in the public bundle, so anything written
 * there should be treated as readable by anyone who has the form's URL. Usernames and
 * platform names are an acceptable loss; passwords are not.
 *
 * WHAT THE BROWSER IS TRUSTED FOR: the slug and the passwords, nothing else. Titles,
 * usernames, handles, platform names and the client's name are all read back out of the
 * row server-side, the same way pinned-stories-review.mts reads identity from the
 * dashboard row rather than from the request. A caller who forges a payload can write a
 * password into a vault for a slug that already exists — they cannot invent an item
 * title, reach another client's vault, or make the vault set grow.
 *
 * POST (JSON):
 *   { slug: "acme-onboarding", secrets: { pmsLogin: "…", domainLogin: "…" } }
 * →  { ok: true, vault: "Acme (acme-onboarding)", written: 2, created: true }
 */

/**
 * The credential questions, mirroring the `credentials: true` questions in
 * client-onboarding-form-page.tsx. Deliberately a second copy rather than an import: the
 * form module pulls in React and the whole SECTIONS tree, and this list is the security
 * boundary — the set of item titles a request is allowed to produce. It should change
 * only when someone means to change it.
 */
const CREDENTIAL_FIELDS: { field: string; title: string; platformField?: string; website?: string }[] = [
    { field: "instagramLogin", title: "Instagram", website: "https://instagram.com" },
    { field: "tiktokLogin", title: "TikTok", website: "https://tiktok.com" },
    { field: "pmsLogin", title: "Property Management System", platformField: "pms" },
    { field: "domainLogin", title: "Domain Host", platformField: "domainPlatform" },
];

/** Known sign-in pages, so the saved item autofills instead of just sitting there. */
const PLATFORM_SITES: Record<string, string> = {
    guesty: "https://app.guesty.com",
    hostaway: "https://dashboard.hostaway.com",
    hospitable: "https://my.hospitable.com",
    ownerrez: "https://secure.ownerreservations.com",
    lodgify: "https://app.lodgify.com",
    streamline: "https://web.streamlinevrs.com",
    godaddy: "https://sso.godaddy.com",
    namecheap: "https://www.namecheap.com/myaccount/login",
    squarespace: "https://account.squarespace.com",
    wix: "https://users.wix.com/signin",
    cloudflare: "https://dash.cloudflare.com/login",
    hostinger: "https://hpanel.hostinger.com",
};

const MAX_SECRET = 500;

export default async (req: Request) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        return Response.json({ error: "Not configured — SUPABASE_SERVICE_ROLE_KEY is missing in Netlify." }, { status: 500 });
    }
    const env = readOnePasswordEnv();
    if (!env) return Response.json({ error: NOT_CONFIGURED }, { status: 500 });

    let body: Record<string, unknown>;
    try {
        body = (await req.json()) as Record<string, unknown>;
    } catch {
        return Response.json({ error: "Bad request." }, { status: 400 });
    }

    const slug = String(body.slug ?? "").trim();
    if (!slug || slug.length > 120 || !/^[a-z0-9-]+-onboarding$/.test(slug)) return Response.json({ error: "Bad slug." }, { status: 400 });

    const secrets = (body.secrets ?? {}) as Record<string, unknown>;
    if (typeof secrets !== "object" || Array.isArray(secrets)) return Response.json({ error: "Bad request." }, { status: 400 });

    // The row is the source of truth for everything except the passwords themselves —
    // and its existence is what stops this endpoint from minting vaults for made-up slugs.
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: row, error: rowErr } = await admin.from("client_onboarding_pages").select("client_name, data").eq("slug", slug).maybeSingle();
    if (rowErr) return Response.json({ error: "Could not load the form." }, { status: 500 });
    if (!row) return Response.json({ error: "Not found." }, { status: 404 });

    const answers = (((row.data ?? {}) as Record<string, unknown>).answers ?? {}) as Record<string, string>;
    const answer = (key: string) => String(answers[key] ?? "").trim();

    const logins: LoginToWrite[] = [];
    for (const spec of CREDENTIAL_FIELDS) {
        const password = String(secrets[spec.field] ?? "").trim();
        if (!password) continue;
        if (password.length > MAX_SECRET) return Response.json({ error: "That password is too long." }, { status: 400 });

        const platform = spec.platformField ? answer(spec.platformField) : "";
        const website = spec.website ?? PLATFORM_SITES[platform.toLowerCase().replace(/\s+/g, "")];
        logins.push({
            // The platform the client picked is the useful half of the title ("Guesty"
            // beats "Property Management System" when you are looking at ten vaults), but
            // the generic name stays so an item is still findable when they typed nothing.
            title: platform ? `${platform} (${spec.title})` : spec.title,
            username: answer(`${spec.field}__user`),
            password,
            website,
            handle: answer(`${spec.field}__handle`) || undefined,
        });
    }

    if (!logins.length) return Response.json({ ok: true, written: 0, skipped: "no logins to save" });

    try {
        const client = await opClient(env);
        const title = vaultTitleFor(String(row.client_name ?? ""), slug);
        const vault = await findOrCreateClientVault(client, env, title);
        for (const login of logins) await writeLogin(client, vault.id, login);
        return Response.json({ ok: true, vault: title, written: logins.length, created: vault.created });
    } catch (err) {
        // Never echo the error body back to the browser or into the log line with the
        // payload anywhere near it — an SDK error can quote the request it was given.
        console.error("[onboarding-credentials] 1Password write failed", err instanceof Error ? err.message : "unknown error");
        return Response.json({ error: "Couldn't save your logins to our password manager. Please try again." }, { status: 502 });
    }
};
