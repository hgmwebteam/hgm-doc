import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Mail01, Monitor01, Phone01, RefreshCw01 } from "@untitledui/icons";
import { FLOW_STEPS, type WelcomeFlowData, emailHtml, stepLabel } from "@/components/application/welcome-flow";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { supabase } from "@/lib/supabase";
import { TeamGate } from "@/pages/team/dashboard-screen";

/** Welcome-flow slots the editor can show: E1–E9 (stored 0–8). */
const SLOT_COUNT = FLOW_STEPS.length;

/** Where a slot's HTML came from. The welcome-flow editor resolves a slot as
 *  pasted -> finished -> built-in template, so `RANK` mirrors that precedence
 *  and lets this page mark which version the team actually sees. */
type Source = "pasted" | "finished" | "template";

const RANK: Record<Source, number> = { pasted: 3, finished: 2, template: 1 };

const SOURCE_LABEL: Record<Source, string> = {
    pasted: "Pasted HTML",
    finished: "Finished HTML",
    template: "Built-in template",
};

const SOURCE_COLOR: Record<Source, "brand" | "success" | "gray"> = {
    pasted: "brand",
    finished: "success",
    template: "gray",
};

interface PreviewEmail {
    client: string;
    /** 0-based slot; shown as Email slot+1. */
    slot: number;
    source: Source;
    subject: string;
    preview: string;
    html: string;
}

const keyOf = (e: PreviewEmail) => `${e.client}|${e.slot}|${e.source}`;

export function EmailPreviewScreen() {
    const [emails, setEmails] = useState<PreviewEmail[]>([]);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [error, setError] = useState("");
    const [wide, setWide] = useState(true);
    const [onlyInUse, setOnlyInUse] = useState(true);

    const load = useCallback(async () => {
        setStatus("loading");
        setError("");

        const [finished, flows] = await Promise.all([
            supabase
                .from("email_wf_emails")
                .select("client_name, position, week, subject_line, preview_text, preview_html, rendered_html")
                .order("updated_at", { ascending: true }),
            supabase.from("welcome_flows").select("slug, client_name, data"),
        ]);

        if (finished.error || flows.error) {
            setError(finished.error?.message || flows.error?.message || "Could not load emails");
            setStatus("error");
            return;
        }

        const list: PreviewEmail[] = [];

        for (const row of finished.data ?? []) {
            // Pooja's `week` is the step (1–9); `position` only for rows that predate it.
            const slot = Number(row.week ?? row.position) - 1;
            // The automation's latest save; rendered_html lags until the email is re-baked.
            const html = row.preview_html || row.rendered_html;
            if (!html || slot < 0 || slot >= SLOT_COUNT) continue;
            list.push({
                client: (row.client_name ?? "").trim() || "Unnamed client",
                slot,
                source: "finished",
                subject: row.subject_line ?? "",
                preview: row.preview_text ?? "",
                html,
            });
        }

        for (const row of flows.data ?? []) {
            const flow = row.data as WelcomeFlowData | null;
            if (!flow) continue;
            const client = (row.client_name ?? row.slug ?? "").trim() || "Unnamed client";

            (flow.customHtml ?? []).forEach((html, slot) => {
                if (!html || slot >= SLOT_COUNT) return;
                list.push({ client, slot, source: "pasted", subject: flow.emails?.[slot]?.subject ?? "", preview: "", html });
            });

            (flow.emails ?? []).forEach((email, slot) => {
                if (slot >= SLOT_COUNT) return;
                // A malformed stored email shouldn't take the whole page down.
                try {
                    list.push({ client, slot, source: "template", subject: email.subject ?? "", preview: "", html: emailHtml(email, flow.settings) });
                } catch {
                    /* skip this slot */
                }
            });
        }

        setEmails(list);
        setStatus("ready");
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const { groups, inUse } = useMemo(() => {
        // Winner per client+slot, by the editor's own precedence.
        const best = new Map<string, PreviewEmail>();
        for (const e of emails) {
            const k = `${e.client}|${e.slot}`;
            const cur = best.get(k);
            if (!cur || RANK[e.source] > RANK[cur.source]) best.set(k, e);
        }
        const inUse = new Set([...best.values()].map(keyOf));

        const shown = onlyInUse ? emails.filter((e) => inUse.has(keyOf(e))) : emails;

        const byClient = new Map<string, PreviewEmail[]>();
        for (const e of shown) byClient.set(e.client, [...(byClient.get(e.client) ?? []), e]);

        const groups = [...byClient.entries()]
            .map(([client, items]) => ({
                client,
                items: items.sort((a, b) => a.slot - b.slot || RANK[b.source] - RANK[a.source]),
                // Gaps are measured against every source, not just the filtered view.
                missing: Array.from({ length: SLOT_COUNT }, (_, i) => i).filter((i) => !emails.some((e) => e.client === client && e.slot === i)),
            }))
            .sort((a, b) => a.client.localeCompare(b.client));

        return { groups, inUse };
    }, [emails, onlyInUse]);

    return (
        <TeamGate>
            <main className="min-h-screen bg-primary px-4 py-10 md:px-8">
                <div className="mx-auto flex max-w-container flex-col gap-8">
                    <header className="flex flex-col gap-5">
                        <div className="flex flex-col gap-2">
                            <h1 className="text-display-sm font-semibold text-primary">Welcome flow email preview</h1>
                            <p className="max-w-3xl text-md text-tertiary">
                                Every welcome-flow email this site can render, grouped by client. Finished and pasted HTML render exactly as they will in
                                GoHighLevel; built-in templates render through the same code the editor previews with.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                            <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
                                <Button size="sm" color={wide ? "primary" : "tertiary"} iconLeading={Monitor01} onClick={() => setWide(true)}>
                                    600px
                                </Button>
                                <Button size="sm" color={wide ? "tertiary" : "primary"} iconLeading={Phone01} onClick={() => setWide(false)}>
                                    375px
                                </Button>
                            </div>
                            <Checkbox
                                label="Only what the editor uses"
                                isSelected={onlyInUse}
                                onChange={setOnlyInUse}
                                hint="Off shows every version of a slot, including ones a higher-precedence source overrides"
                            />
                            <Button size="sm" color="secondary" iconLeading={RefreshCw01} onClick={() => void load()}>
                                Reload
                            </Button>
                        </div>
                    </header>

                    {status === "loading" && <p className="text-md text-tertiary">Loading emails…</p>}

                    {status === "error" && (
                        <div className="flex items-start gap-3 rounded-xl bg-error-primary p-4 ring-1 ring-error">
                            <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-fg-error-secondary" />
                            <div className="flex flex-col gap-1">
                                <p className="text-md font-semibold text-primary">Could not load emails</p>
                                <p className="text-sm text-tertiary">{error}</p>
                            </div>
                        </div>
                    )}

                    {status === "ready" && groups.length === 0 && (
                        <div className="flex flex-col items-center gap-3 rounded-xl bg-secondary px-6 py-16 text-center">
                            <Mail01 aria-hidden="true" className="size-6 text-fg-quaternary" />
                            <p className="text-md font-semibold text-primary">No emails found</p>
                            <p className="max-w-md text-sm text-tertiary">
                                Nothing in email_wf_emails or welcome_flows yet. Locally this is expected without a .env.local pointing at Supabase.
                            </p>
                        </div>
                    )}

                    {status === "ready" &&
                        groups.map((group) => (
                            <section key={group.client} className="flex flex-col gap-4">
                                <div className="flex flex-wrap items-center gap-3 border-b border-secondary pb-3">
                                    <h2 className="text-lg font-semibold text-primary">{group.client}</h2>
                                    <Badge color="gray" size="sm">
                                        {group.items.length} shown
                                    </Badge>
                                    {group.missing.length > 0 && (
                                        <span className="text-sm text-tertiary">Missing {group.missing.map((i) => `E${i + 1}`).join(", ")}</span>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-6">
                                    {group.items.map((e) => (
                                        <figure key={keyOf(e)} className="flex flex-col gap-3">
                                            <figcaption className="flex flex-col gap-2" style={{ maxWidth: wide ? 600 : 375 }}>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-md font-semibold text-primary">{stepLabel(e.slot)}</span>
                                                    <Badge color={SOURCE_COLOR[e.source]} size="sm">
                                                        {SOURCE_LABEL[e.source]}
                                                    </Badge>
                                                    {!onlyInUse && inUse.has(keyOf(e)) && (
                                                        <Badge color="blue" size="sm">
                                                            In use
                                                        </Badge>
                                                    )}
                                                </div>
                                                {e.subject && <p className="text-sm text-secondary">{e.subject}</p>}
                                                {e.preview && <p className="text-xs text-tertiary">{e.preview}</p>}
                                            </figcaption>
                                            {/* The email's own HTML assumes a light background, so this canvas stays
                                                white in both themes on purpose — the page chrome around it themes. */}
                                            <iframe
                                                title={`${group.client} — ${stepLabel(e.slot)} (${SOURCE_LABEL[e.source]})`}
                                                srcDoc={e.html}
                                                sandbox=""
                                                loading="lazy"
                                                className="h-[680px] rounded-xl border-0 bg-white ring-1 ring-secondary"
                                                style={{ width: wide ? 600 : 375 }}
                                            />
                                        </figure>
                                    ))}
                                </div>
                            </section>
                        ))}
                </div>
            </main>
        </TeamGate>
    );
}
