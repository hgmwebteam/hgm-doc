import { CRM_COLUMNS, crmClientName, pushCrmCells } from "../lib/crm-sheet.mts";
import { accessTokenFrom, isDashboardSlug, portalDb, verifyStaff } from "../lib/reporting.mts";

/**
 * Mirrors a team member's dashboard save into the CRM sheet. Called by src/lib/crm-sheet.ts after
 * the save has landed, with only the cells that save changed.
 *
 * Staff only: the sheet is the team's, and a client's browser has no business writing it. The
 * cells are checked against CRM_COLUMNS and the client is resolved here from the slug, so a caller
 * can move one of five known columns on one real client's row and nothing else.
 */
export default async (req: Request) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    let body: { slug?: unknown; cells?: unknown };
    try {
        body = await req.json();
    } catch {
        return Response.json({ error: "Bad request." }, { status: 400 });
    }

    try {
        const gate = await verifyStaff(accessTokenFrom(req, body));
        if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status });

        const slug = String(body.slug ?? "").trim();
        if (!isDashboardSlug(slug)) return Response.json({ error: "Bad slug." }, { status: 400 });

        const raw = body.cells && typeof body.cells === "object" ? (body.cells as Record<string, unknown>) : {};
        const cells = Object.fromEntries(
            Object.entries(raw).filter(([k, v]) => CRM_COLUMNS.has(k) && typeof v === "string" && v.length <= 40),
        ) as Record<string, string>;
        if (!Object.keys(cells).length) return Response.json({ ok: true, written: [] });

        const db = portalDb();
        const base = slug.slice(0, -"-dashboard".length);
        const { data: row } = await db.from("dashboard_pages").select("client_name").eq("slug", slug).maybeSingle();
        if (!row) return Response.json({ error: "Not found." }, { status: 404 });

        const result = await pushCrmCells(await crmClientName(db, base, row.client_name ?? ""), cells);
        return Response.json(result, { status: result.ok || result.error === "not-configured" ? 200 : 502 });
    } catch (err) {
        console.error("[crm-sync]", err);
        return Response.json({ error: "Not configured." }, { status: 500 });
    }
};
