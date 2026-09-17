/**
 * Put the PORTAL project's current service_role key on the docs-hgm site.
 *
 * WHY THIS EXISTS. Every help-centre Function calls verifyCaller, which calls
 * portalDb() with SUPABASE_SERVICE_ROLE_KEY. The value deployed today is
 * refused by the portal project (401 "Invalid API key"), so every client gets
 * "Not authorised." no matter who they are. The end-to-end proof reports it as
 * its first failure.
 *
 * It reads the key from Supabase and writes it to Netlify. The value is never
 * printed, never written to a file, and never passed on a command line.
 *
 * It also probes the key against the portal project BEFORE deploying it. The
 * last time this variable was changed, it was changed on the strength of a
 * probe against a MASK - Netlify returns a short placeholder for a variable
 * flagged secret - and a working credential was replaced with a broken one.
 * Proving the key first is what stops that happening twice.
 *
 *   node scripts/set-portal-service-key.mjs
 *
 * Needs SUPABASE_ACCESS_TOKEN and NETLIFY_ACCESS_TOKEN in the environment.
 */
const PORTAL_REF = "iymhjrmmgwrxdggcvmjn";
const SITE = "docs-hgm";

/** Exactly what Netlify's "all contexts" covers, named explicitly. */
const CONTEXTS = ["production", "deploy-preview", "branch-deploy", "dev"];

const need = (n) => {
    const v = process.env[n];
    if (!v) throw new Error(`${n} is not set in the environment`);
    return v;
};

const supabaseToken = need("SUPABASE_ACCESS_TOKEN");
const netlifyToken = need("NETLIFY_ACCESS_TOKEN");

const keysRes = await fetch(`https://api.supabase.com/v1/projects/${PORTAL_REF}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${supabaseToken}` },
});
if (!keysRes.ok) throw new Error(`Supabase refused the key listing: HTTP ${keysRes.status}`);
const keys = await keysRes.json();
const serviceKey = keys.find((k) => k.name === "service_role")?.api_key;
if (!serviceKey) throw new Error("the portal project has no service_role key");

const probe = await fetch(`https://${PORTAL_REF}.supabase.co/rest/v1/dashboard_pages?select=slug&limit=1`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
});
if (!probe.ok) throw new Error(`the key Supabase returned does not work against the portal project: HTTP ${probe.status}`);
console.log("the key works against the portal project (HTTP 200) - deploying it");

const sitesRes = await fetch("https://api.netlify.com/api/v1/sites?filter=all", {
    headers: { Authorization: `Bearer ${netlifyToken}` },
});
if (!sitesRes.ok) throw new Error(`Netlify refused the site listing: HTTP ${sitesRes.status}`);
const sites = await sitesRes.json();
const site = sites.find((s) => s.name === SITE);
if (!site) throw new Error(`no Netlify site called ${SITE} on this account`);

const url = `https://api.netlify.com/api/v1/accounts/${site.account_slug}/env/SUPABASE_SERVICE_ROLE_KEY?site_id=${site.id}`;

// READ THE VARIABLE'S OWN SHAPE FIRST, and resend it.
//
// PATCH would be the smaller change, but it refuses context "all" (422), and
// this variable is set on "all". So it has to be PUT, which REPLACES the whole
// variable - and a PUT that omits is_secret or scopes does not leave them
// alone, it clears them. Silently un-secreting a service key is not a cosmetic
// slip: a secret variable reads back as a 20-character MASK through the API,
// and that mask has already been probed once in this project as though it were
// the value, on the strength of which a working credential was overwritten
// with a broken one. Hence: read, then resend what was there.
const existing = await fetch(url, { headers: { Authorization: `Bearer ${netlifyToken}` } });
if (!existing.ok) throw new Error(`could not read the variable before replacing it: HTTP ${existing.status}`);
const current = await existing.json();
console.log(`existing variable: is_secret=${current.is_secret}, scopes=${JSON.stringify(current.scopes)}`);

const put = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${netlifyToken}`, "content-type": "application/json" },
    body: JSON.stringify({
        key: "SUPABASE_SERVICE_ROLE_KEY",
        scopes: current.scopes ?? ["builds", "functions", "runtime"],
        is_secret: current.is_secret ?? true,
        // NOT "all". Netlify no longer accepts that for a secret variable
        // ("Secrets are not allowed to have 'All contexts' context"), and this
        // one is a legacy row still set that way - so it cannot be rewritten
        // without naming the contexts. These four ARE what "all" meant, so the
        // surface is unchanged; only the row's shape is brought up to date.
        values: CONTEXTS.map((context) => ({ context, value: serviceKey })),
    }),
});
if (!put.ok) throw new Error(`Netlify refused the update: HTTP ${put.status} ${(await put.text()).slice(0, 200)}`);

// Confirm the SHAPE survived. The value cannot be confirmed here - it is secret
// and comes back masked - so it is confirmed by exercising the deployed
// function instead, which is what reporting-system-proof does.
const after = await (await fetch(url, { headers: { Authorization: `Bearer ${netlifyToken}` } })).json();
if (after.is_secret !== true) throw new Error("the variable is no longer marked secret - fix that before deploying");
const contextsNow = (after.values ?? []).map((v) => v.context).sort();
for (const c of CONTEXTS) {
    if (!contextsNow.includes(c)) throw new Error(`the ${c} context did not survive the write - the site would fall back to nothing there`);
}
console.log(`after: is_secret=${after.is_secret}, scopes=${JSON.stringify(after.scopes)}, contexts=${contextsNow.join(",")}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY updated on ${SITE}. Redeploy for it to take effect.`);
