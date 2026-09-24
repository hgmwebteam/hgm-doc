import { useEffect, useState } from "react";
import { AlertCircle, Check, MagicWand01, Zap } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { supabase } from "@/lib/supabase";
import {
    AUTOMATION_FIELDS,
    AUTOMATION_GROUPS,
    type AutomationBranding,
    EMPTY_AUTOMATION_BRANDING,
    type FieldSpec,
    type PrefillSource,
    automationBrandingFilled,
    mergeAutomationBranding,
    prefillAutomationBranding,
} from "@/pages/client/dashboard/automation-branding";
import { cx } from "@/utils/cx";

/**
 * The team-only Automation branding card at the foot of the Brand Kit.
 *
 * It has its own table and its own Save for the same reason the Landing page does: this is
 * a feed for other systems, not a field on the client's document, and a client-facing save
 * path should never carry internal data. The row lives in `automation_branding`, whose
 * policies admit @hiddengem.media only — so a client who somehow reached this component
 * would get an empty read and a refused write, on top of the caller's own `isTeam` gate.
 *
 * The model, the field list and the prefill rules live in automation-branding.ts.
 */

const inputCls =
    "w-full rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary outline-none transition duration-100 ease-linear placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand";

/** A hex the native colour input will accept, or null — "" and "Sage green" are both fine
 *  to store and neither can drive a swatch. */
const asHex = (v: string) => (/^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim() : null);

const Field = ({ spec, value, onChange }: { spec: FieldSpec; value: string; onChange: (v: string) => void }) => {
    const hex = asHex(value);
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-secondary">{spec.label}</span>
            {spec.kind === "area" ? (
                <textarea
                    rows={4}
                    value={value}
                    placeholder={spec.placeholder}
                    onChange={(e) => onChange(e.target.value)}
                    className={cx(inputCls, "resize-y")}
                />
            ) : spec.kind === "color" ? (
                <span className="flex items-center gap-2">
                    {/* The swatch IS the picker — a preview square beside a colour input is
                        two things showing the same value. */}
                    <input
                        type="color"
                        aria-label={`${spec.label} colour picker`}
                        value={hex ?? "#000000"}
                        onChange={(e) => onChange(e.target.value)}
                        className="size-9 shrink-0 cursor-pointer rounded-lg border border-secondary bg-primary p-1"
                    />
                    <input type="text" value={value} placeholder="#000000" onChange={(e) => onChange(e.target.value)} className={cx(inputCls, "font-mono")} />
                </span>
            ) : (
                <input type="text" value={value} placeholder={spec.placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls} />
            )}
            {spec.hint && <span className="mt-1 block text-xs text-quaternary">{spec.hint}</span>}
        </label>
    );
};

export const AutomationBrandingCard = ({
    slug,
    clientName,
    prefillFrom,
    editorEmail,
}: {
    slug?: string;
    clientName: string;
    /** The brand kit and document fields the prefill button reads. */
    prefillFrom: PrefillSource;
    /** Stamped on the row so the next person knows who filled it. */
    editorEmail: string;
}) => {
    const [value, setValue] = useState<AutomationBranding>(EMPTY_AUTOMATION_BRANDING);
    const [state, setState] = useState<"loading" | "idle" | "saving" | "saved" | "error">("loading");
    const [error, setError] = useState("");
    /** What is in the table, so Save knows whether anything actually changed. State, not a
     *  ref: a successful save leaves `value` untouched and only moves this, so anything
     *  derived from it has to re-render off it — as a ref it went stale and the card sat
     *  there looking like the click had done nothing. */
    const [saved, setSaved] = useState<AutomationBranding>(EMPTY_AUTOMATION_BRANDING);

    useEffect(() => {
        if (!slug) return;
        let live = true;
        void supabase
            .from("automation_branding")
            .select("*")
            .eq("slug", slug)
            .maybeSingle()
            .then(({ data, error: readErr }) => {
                if (!live) return;
                if (readErr) {
                    setState("error");
                    setError(readErr.message);
                    return;
                }
                const row = mergeAutomationBranding(data);
                setSaved(row);
                setValue(row);
                setState("idle");
            });
        return () => {
            live = false;
        };
    }, [slug]);

    const dirty = AUTOMATION_FIELDS.some((f) => value[f.key] !== saved[f.key]);
    const filled = automationBrandingFilled(value);

    const set = (key: keyof AutomationBranding, v: string) => {
        setValue((prev) => ({ ...prev, [key]: v }));
        setState((s) => (s === "saved" ? "idle" : s));
    };

    const save = async () => {
        if (!slug) return;
        setState("saving");
        setError("");
        const { error: writeErr } = await supabase.from("automation_branding").upsert(
            {
                slug,
                client_name: clientName.trim(),
                ...value,
                updated_by: editorEmail,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "slug" },
        );
        if (writeErr) {
            setState("error");
            setError(writeErr.message);
            return;
        }
        setSaved(value);
        setState("saved");
    };

    return (
        <section className="bg-secondary_subtle mt-10 rounded-2xl border border-secondary p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <Zap className="size-4 text-fg-brand-primary" aria-hidden="true" />
                        <h3 className="text-md font-semibold text-primary">Automation branding</h3>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary">Internal</span>
                    </div>
                    <p className="mt-1.5 max-w-2xl text-sm text-tertiary">
                        What the reel, carousel and email automations read for {clientName.trim() || "this client"} — the fields that used to be typed into
                        three spreadsheets. The client never sees this.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-quaternary">
                        {filled} of {AUTOMATION_FIELDS.length} filled
                    </span>
                    <Button
                        size="sm"
                        color="secondary"
                        iconLeading={MagicWand01}
                        onClick={() => setValue((prev) => prefillAutomationBranding(prev, prefillFrom))}
                        isDisabled={state === "loading"}
                    >
                        Fill from brand kit
                    </Button>
                </div>
            </div>

            {state === "loading" ? (
                <p className="mt-6 text-sm text-tertiary">Loading…</p>
            ) : (
                <div className="mt-6 flex flex-col gap-6">
                    {AUTOMATION_GROUPS.map((group) => (
                        <div key={group.id}>
                            <p className="text-sm font-semibold text-primary">{group.title}</p>
                            <p className="mt-0.5 text-xs text-quaternary">{group.note}</p>
                            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {group.fields.map((spec) => (
                                    <div key={spec.key} className={spec.kind === "area" ? "sm:col-span-2 lg:col-span-3" : undefined}>
                                        <Field spec={spec} value={value[spec.key]} onChange={(v) => set(spec.key, v)} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                    size="sm"
                    color="primary"
                    onClick={() => void save()}
                    isDisabled={!slug || !dirty || state === "loading"}
                    isLoading={state === "saving"}
                    showTextWhileLoading
                >
                    Save automation fields
                </Button>
                {state === "saved" && (
                    <span className="flex items-center gap-1.5 text-sm text-success-primary">
                        <Check className="size-4" aria-hidden="true" />
                        Saved — the automations pick this up on their next run.
                    </span>
                )}
                {state === "error" && (
                    <span className="flex items-center gap-1.5 text-sm text-error-primary">
                        <AlertCircle className="size-4" aria-hidden="true" />
                        {error || "Could not save."}
                    </span>
                )}
                {!slug && <span className="text-sm text-quaternary">Save the dashboard once before filling this in.</span>}
            </div>
        </section>
    );
};
