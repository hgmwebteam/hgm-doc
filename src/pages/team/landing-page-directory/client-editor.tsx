import { useRef, useState } from "react";
import { Plus, XClose } from "@untitledui/icons";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { cx } from "@/utils/cx";
import {
    type AlertRule,
    CHANNELS,
    type ChannelKey,
    DESIGNS,
    type DirectoryClient,
    type DirectoryProperty,
    type EditorTab,
    type Hosting,
    STAYS_SLUG,
    clientSlug,
    derivedFor,
    inferDomain,
    isDomain,
    isLegacy,
    issuesFor,
    linkOf,
    normDomain,
    normalizeUrl,
    propsOf,
    showUrl,
    slugOf,
    todayIso,
} from "./directory-model";
import { ConfirmButton, DirectoryModal, FAST, Field, PillRadio, Segmented, foldProps, inputClass, invalidInputClass } from "./directory-ui";

type LinkField = { value: string; manual: boolean };
/** A property row in the form: its own key, so removing one from the middle animates the right one out. */
type PropertyRow = DirectoryProperty & { key: string };

/** Each channel link starts as the one the domain implies; a saved link that differs is a
 *  hand-set override and stays put when the domain changes. */
const initialLinks = (c: DirectoryClient | undefined, domain: string) => {
    const out = {} as Record<ChannelKey, LinkField>;
    for (const ch of CHANNELS) {
        const derived = derivedFor(domain, ch.key, !!c && isLegacy(c));
        const v = c ? linkOf(c, ch.key) : "";
        out[ch.key] = { value: v || derived, manual: !!(v && v !== derived) };
    }
    return out;
};

const TABS: { id: EditorTab; label: string }[] = [
    { id: "details", label: "Details" },
    { id: "links", label: "Links" },
    { id: "status", label: "Status" },
];

/**
 * Add or edit one client. Three tabs: who they are, their links, and whether the page is live.
 * The channel links follow the domain until one is typed over; that one is kept as an override.
 */
export const ClientEditor = ({
    initial,
    existingIds,
    managers,
    initialTab,
    onClose,
    onSave,
    onDelete,
}: {
    initial?: DirectoryClient;
    /** Ids of every other client, for the duplicate-name check. */
    existingIds: string[];
    /** Names offered for the account manager field. */
    managers: string[];
    initialTab?: EditorTab;
    onClose: () => void;
    onSave: (client: DirectoryClient) => Promise<void>;
    onDelete?: () => Promise<void>;
}) => {
    const isEdit = !!initial;
    // A client added before the slug change keeps the old slugs; a new one gets the current set.
    const legacy = !!initial && isLegacy(initial);
    const derive = (d: string, key: ChannelKey) => derivedFor(d, key, legacy);
    const startDomain = initial ? initial.domain || inferDomain(initial) : "";
    const keySeq = useRef(0);
    const nextKey = () => `p${keySeq.current++}`;
    const [tab, setTab] = useState<EditorTab>(initialTab ?? "details");
    const [name, setName] = useState(initial?.name ?? "");
    const [platform, setPlatform] = useState<Hosting>(initial?.platform ?? "GoHighLevel");
    const [manager, setManager] = useState(initial?.manager ?? "");
    const [design, setDesign] = useState(initial?.design ?? "");
    const [doc, setDoc] = useState(initial?.doc ?? "");
    const [upcoming, setUpcoming] = useState(!!initial?.upcoming);
    const [domain, setDomain] = useState(startDomain);
    const [links, setLinks] = useState(() => initialLinks(initial, startDomain));
    const [showLinks, setShowLinks] = useState(() => Object.values(initialLinks(initial, startDomain)).some((l) => l.manual));
    const [stays, setStays] = useState(initial?.stays ?? "");
    const [noStays, setNoStays] = useState(!!initial?.noStays);
    const [properties, setProperties] = useState<PropertyRow[]>(() => (initial ? propsOf(initial) : []).map((p) => ({ ...p, key: nextKey() })));
    const [metaTags, setMetaTags] = useState(!!initial?.metaTags);
    const [live, setLive] = useState(!!initial?.live);
    const [errors, setErrors] = useState<{ name?: string; domain?: string; form?: string }>({});
    const [busy, setBusy] = useState(false);

    const cleanDomain = normDomain(domain);

    // What "needs attention" flags, re-run on the form as typed, so a Fix lands on red fields that
    // clear as they're filled. Only for a saved client: a new one would open red everywhere.
    const missing = isEdit
        ? new Map(
              issuesFor({
                  name,
                  platform,
                  manager,
                  doc: doc.trim(),
                  domain: cleanDomain,
                  ...Object.fromEntries(CHANNELS.filter((ch) => links[ch.key].manual).map((ch) => [ch.key, links[ch.key].value.trim()])),
                  metaTags,
                  live,
                  upcoming,
              }).map((r) => [r.id, r]),
          )
        : new Map<string, AlertRule>();
    const miss = (id: string) => missing.get(id)?.hint;
    const tabMissing = new Set([...missing.values()].map((r) => r.tab));

    const onDomainChange = (v: string) => {
        setDomain(v);
        const d = normDomain(v);
        setLinks((prev) => {
            const next = { ...prev };
            for (const ch of CHANNELS) if (!next[ch.key].manual) next[ch.key] = { value: derive(d, ch.key), manual: false };
            return next;
        });
    };

    const onLinkChange = (key: ChannelKey, v: string) => {
        const derived = derive(cleanDomain, key);
        setLinks((prev) => ({ ...prev, [key]: { value: v, manual: !!(v.trim() && normalizeUrl(v) !== derived) } }));
    };

    const submit = async () => {
        const errs: typeof errors = {};
        const trimmed = name.trim();
        if (!trimmed) errs.name = "Client name is required.";
        else {
            const id = clientSlug(trimmed);
            if (!id) errs.name = "Client name needs at least one letter or number.";
            else if (existingIds.includes(id)) errs.name = "A client with this name already exists.";
        }
        if (domain.trim() && !isDomain(cleanDomain)) errs.domain = "Enter just the domain, like go.yourdomain.com.";
        if (errs.name || errs.domain) {
            setErrors(errs);
            setTab(errs.name ? "details" : "links");
            return;
        }

        // Only what's set is stored, so a saved client reads the same as one typed by hand.
        const next: DirectoryClient = { name: trimmed, platform };
        if (manager.trim()) next.manager = manager.trim();
        if (design) next.design = design;
        const docUrl = normalizeUrl(doc);
        if (docUrl) next.doc = docUrl;
        if (cleanDomain) next.domain = cleanDomain;
        for (const ch of CHANNELS) {
            const v = normalizeUrl(links[ch.key].value);
            if (v && v !== derive(cleanDomain, ch.key)) next[ch.key] = v;
        }
        if (!legacy) next.newSlugs = true;
        const staysUrl = normalizeUrl(stays);
        const derivedStays = cleanDomain ? `https://${cleanDomain}${STAYS_SLUG}` : "";
        if (staysUrl && staysUrl !== derivedStays) next.stays = staysUrl;
        if (noStays) next.noStays = true;
        const props = properties.map((p) => ({ name: p.name.trim(), url: normalizeUrl(p.url) })).filter((p) => p.url);
        if (props.length) next.properties = props;
        if (metaTags) next.metaTags = true;
        if (live) next.live = true;
        if (upcoming) next.upcoming = true;
        if (!initial) next.added = todayIso();
        else if (initial.added) next.added = initial.added;

        setBusy(true);
        setErrors({});
        try {
            await onSave(next);
        } catch (e) {
            setErrors({ form: e instanceof Error ? e.message : "Could not save. Try again in a moment." });
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!onDelete) return;
        setBusy(true);
        try {
            await onDelete();
        } catch (e) {
            setErrors({ form: e instanceof Error ? e.message : "Could not delete. Try again in a moment." });
            setBusy(false);
        }
    };

    const previewRow = (key: ChannelKey, label: string) => {
        const field = links[key];
        const value = field.manual ? normalizeUrl(field.value) : derive(cleanDomain, key);
        return (
            <div key={key} className="grid min-h-8 grid-cols-[96px_minmax(0,1fr)] items-center gap-3 border-b border-secondary last:border-b-0">
                <span className="text-xs font-medium text-secondary">{label}</span>
                <span className={cx("truncate font-mono text-xs", value ? (field.manual ? "text-brand-secondary" : "text-primary") : "text-quaternary")}>
                    {value ? showUrl(value) : `go.yourdomain.com${slugOf(key, legacy)}`}
                </span>
            </div>
        );
    };

    return (
        <DirectoryModal
            title={isEdit ? "Edit client" : "Add client"}
            subtitle={isEdit ? `Update details, links and status for ${initial.name}.` : "Details, links and status for the new client."}
            onClose={onClose}
            width="max-w-2xl"
            footer={
                <>
                    <div>
                        {isEdit && onDelete && (
                            <ConfirmButton
                                label="Delete client"
                                armedLabel={`Delete ${initial.name} for everyone?`}
                                onConfirm={() => void remove()}
                                disabled={busy}
                            />
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button size="md" color="secondary" onClick={onClose} isDisabled={busy}>
                            Cancel
                        </Button>
                        <Button size="md" onClick={() => void submit()} isLoading={busy} showTextWhileLoading>
                            {isEdit ? "Save changes" : "Add client"}
                        </Button>
                    </div>
                </>
            }
        >
            <Segmented
                value={tab}
                onChange={setTab}
                options={TABS.map((t) => ({
                    id: t.id,
                    label: (
                        <span className="inline-flex items-center gap-1.5">
                            {t.label}
                            {tabMissing.has(t.id) && (
                                <>
                                    <span className="size-1.5 rounded-full bg-fg-error-secondary" aria-hidden="true" />
                                    <span className="sr-only">, has missing fields</span>
                                </>
                            )}
                        </span>
                    ),
                }))}
                ariaLabel="Sections"
                fullWidth
                className="mb-5"
            />

            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 6, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.985 }}
                    transition={FAST}
                >
                    {tab === "details" && (
                        <div className="flex flex-col gap-5">
                            <Field label="Client name" error={errors.name}>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value);
                                        if (errors.name) setErrors((er) => ({ ...er, name: undefined }));
                                    }}
                                    placeholder="e.g. Little River Landing"
                                    autoFocus
                                    aria-label="Client name"
                                    aria-invalid={!!errors.name}
                                    className={cx(inputClass, errors.name && invalidInputClass)}
                                />
                            </Field>
                            <div className="grid gap-5 sm:grid-cols-2">
                                <Field label="Hosting">
                                    <PillRadio<Hosting>
                                        value={platform}
                                        onChange={setPlatform}
                                        ariaLabel="Hosting"
                                        options={[
                                            {
                                                id: "GoHighLevel",
                                                label: (
                                                    <>
                                                        <span className="size-2 rounded-full bg-fg-warning-secondary" aria-hidden="true" />
                                                        GoHighLevel
                                                    </>
                                                ),
                                            },
                                            {
                                                id: "Netlify",
                                                label: (
                                                    <>
                                                        <span className="size-2 rounded-full bg-utility-sky-500" aria-hidden="true" />
                                                        Netlify
                                                    </>
                                                ),
                                            },
                                        ]}
                                    />
                                </Field>
                                <Field label="Account manager" error={miss("no-manager")}>
                                    <input
                                        type="text"
                                        list="lpd-manager-names"
                                        value={manager}
                                        onChange={(e) => setManager(e.target.value)}
                                        placeholder="Choose or type a name"
                                        autoComplete="off"
                                        aria-label="Account manager"
                                        aria-invalid={!!miss("no-manager")}
                                        className={cx(inputClass, miss("no-manager") && invalidInputClass)}
                                    />
                                    <datalist id="lpd-manager-names">
                                        {managers.map((m) => (
                                            <option key={m} value={m} />
                                        ))}
                                    </datalist>
                                </Field>
                            </div>
                            <Field label="Design style">
                                <PillRadio
                                    value={design}
                                    onChange={setDesign}
                                    ariaLabel="Design style"
                                    options={[{ id: "", label: "Not set" }, ...DESIGNS.map((d) => ({ id: d.id, label: d.label }))]}
                                />
                            </Field>
                            <Field label="Master brand doc" error={miss("no-doc")}>
                                <input
                                    type="url"
                                    value={doc}
                                    onChange={(e) => setDoc(e.target.value)}
                                    placeholder="https://docs.google.com/document/…"
                                    spellCheck={false}
                                    aria-label="Master brand doc"
                                    aria-invalid={!!miss("no-doc")}
                                    className={cx(inputClass, miss("no-doc") && invalidInputClass)}
                                />
                            </Field>
                            <Field label="Client stage">
                                <div
                                    className={cx(
                                        "rounded-xl border px-4 py-3 transition duration-100 ease-linear",
                                        upcoming ? "border-brand bg-brand-primary_alt" : "border-secondary",
                                    )}
                                >
                                    <Checkbox
                                        size="sm"
                                        isSelected={upcoming}
                                        onChange={setUpcoming}
                                        label="Upcoming client"
                                        hint={
                                            <span className="text-xs">
                                                Checked means onboarding, and the client is listed under Upcoming clients on the overview. Unchecked means
                                                active.
                                            </span>
                                        }
                                    />
                                </div>
                            </Field>
                        </div>
                    )}

                    {tab === "links" && (
                        <div className="flex flex-col gap-5">
                            <Field
                                label="Landing page domain"
                                hint="Channel links and the stays page are built from this domain."
                                error={errors.domain ?? miss("no-domain")}
                            >
                                <input
                                    type="text"
                                    value={domain}
                                    onChange={(e) => {
                                        onDomainChange(e.target.value);
                                        if (errors.domain) setErrors((er) => ({ ...er, domain: undefined }));
                                    }}
                                    onBlur={() => {
                                        if (domain.trim() && cleanDomain !== domain) onDomainChange(cleanDomain);
                                    }}
                                    placeholder="go.yourdomain.com"
                                    autoCapitalize="off"
                                    autoComplete="off"
                                    spellCheck={false}
                                    aria-label="Landing page domain"
                                    aria-invalid={!!(errors.domain || miss("no-domain"))}
                                    className={cx(inputClass, "font-mono text-[13px]", (errors.domain || miss("no-domain")) && invalidInputClass)}
                                />
                            </Field>
                            <div>
                                <div className="mb-1.5 flex items-center justify-between">
                                    <span className="text-sm font-medium text-secondary">Channel links</span>
                                    <button
                                        type="button"
                                        aria-expanded={showLinks}
                                        onClick={() => setShowLinks((v) => !v)}
                                        className="text-xs font-medium text-brand-secondary hover:underline"
                                    >
                                        {showLinks ? "Hide individual links" : "Edit links individually"}
                                    </button>
                                </div>
                                <div className="rounded-lg border border-secondary px-3">{CHANNELS.map((ch) => previewRow(ch.key, ch.label))}</div>
                                <AnimatePresence initial={false}>
                                    {showLinks && (
                                        <motion.div key="links" {...foldProps} className="overflow-hidden">
                                            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-secondary bg-secondary p-3">
                                                {CHANNELS.map((ch) => (
                                                    <label key={ch.key} className="grid items-center gap-2 sm:grid-cols-[96px_minmax(0,1fr)]">
                                                        <span className="text-xs font-medium text-secondary">{ch.label}</span>
                                                        <input
                                                            type="url"
                                                            value={links[ch.key].value}
                                                            onChange={(e) => onLinkChange(ch.key, e.target.value)}
                                                            placeholder={`https://go.yourdomain.com${slugOf(ch.key, legacy)}`}
                                                            spellCheck={false}
                                                            autoComplete="off"
                                                            className={cx(inputClass, "font-mono text-[13px]")}
                                                        />
                                                    </label>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <div>
                                <div className="mb-1.5 flex items-center justify-between gap-3">
                                    <span className="text-sm font-medium text-secondary">
                                        Stays page <span className="font-normal text-quaternary">(optional)</span>
                                    </span>
                                    {/* Some clients have no stays page; ticked, the card stops showing the derived one. */}
                                    <Checkbox size="sm" isSelected={noStays} onChange={setNoStays} label={<span className="text-xs">No stays page</span>} />
                                </div>
                                <input
                                    type="url"
                                    value={stays}
                                    onChange={(e) => setStays(e.target.value)}
                                    placeholder={`https://${cleanDomain || "go.yourdomain.com"}${STAYS_SLUG}`}
                                    spellCheck={false}
                                    autoComplete="off"
                                    disabled={noStays}
                                    aria-label="Stays page"
                                    className={cx(inputClass, "font-mono text-[13px] disabled:cursor-not-allowed disabled:opacity-50")}
                                />
                                <p className="mt-1.5 text-xs text-tertiary">
                                    {noStays ? "Left off this client's card." : `Defaults to the domain plus ${STAYS_SLUG}.`}
                                </p>
                            </div>
                            <div>
                                <div className="mb-1.5 flex items-center justify-between">
                                    <span className="text-sm font-medium text-secondary">Property pages</span>
                                    <button
                                        type="button"
                                        onClick={() => setProperties((p) => [...p, { name: "", url: "", key: nextKey() }])}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-secondary hover:underline"
                                    >
                                        <Plus className="size-3.5" aria-hidden="true" />
                                        Add property
                                    </button>
                                </div>
                                <div className="flex flex-col">
                                    <AnimatePresence initial={false}>
                                        {properties.map((p, i) => (
                                            <motion.div
                                                key={p.key}
                                                layout
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={FAST}
                                                className="overflow-hidden"
                                            >
                                                <div className="grid grid-cols-[minmax(0,1fr)_36px] items-center gap-2 pb-2 sm:grid-cols-[150px_minmax(0,1fr)_36px]">
                                                    <input
                                                        type="text"
                                                        value={p.name}
                                                        onChange={(e) =>
                                                            setProperties((ps) => ps.map((x) => (x.key === p.key ? { ...x, name: e.target.value } : x)))
                                                        }
                                                        placeholder="Property name"
                                                        aria-label={`Property ${i + 1} name`}
                                                        className={cx(inputClass, "col-span-2 sm:col-span-1")}
                                                    />
                                                    <input
                                                        type="url"
                                                        value={p.url}
                                                        onChange={(e) =>
                                                            setProperties((ps) => ps.map((x) => (x.key === p.key ? { ...x, url: e.target.value } : x)))
                                                        }
                                                        placeholder="https://go.yourdomain.com/property"
                                                        spellCheck={false}
                                                        aria-label={`Property ${i + 1} link`}
                                                        className={cx(inputClass, "font-mono text-[13px]")}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setProperties((ps) => ps.filter((x) => x.key !== p.key))}
                                                        aria-label="Remove property"
                                                        className="flex size-9 items-center justify-center rounded-lg text-tertiary transition duration-100 ease-linear hover:bg-secondary hover:text-primary"
                                                    >
                                                        <XClose className="size-4" aria-hidden="true" />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                    {properties.length === 0 && <p className="text-xs text-tertiary">No property pages yet.</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === "status" && (
                        <Field label="Verification">
                            <div className="flex flex-col gap-3">
                                <div
                                    className={cx(
                                        "rounded-xl border px-4 py-3 transition duration-100 ease-linear",
                                        metaTags ? "border-brand bg-brand-primary_alt" : miss("live-no-tags") ? "border-error" : "border-secondary",
                                    )}
                                >
                                    <Checkbox
                                        size="sm"
                                        isSelected={metaTags}
                                        onChange={setMetaTags}
                                        label="Meta tags added"
                                        hint={<span className="text-xs">Tracking pixels and meta tags are installed on the landing page.</span>}
                                    />
                                    {miss("live-no-tags") && (
                                        <p className="mt-2 text-xs text-error-primary" role="alert">
                                            {miss("live-no-tags")}
                                        </p>
                                    )}
                                </div>
                                <div
                                    className={cx(
                                        "rounded-xl border px-4 py-3 transition duration-100 ease-linear",
                                        live ? "border-brand bg-brand-primary_alt" : "border-secondary",
                                    )}
                                >
                                    <Checkbox
                                        size="sm"
                                        isSelected={live}
                                        onChange={setLive}
                                        label="Live"
                                        hint={<span className="text-xs">The landing page is published and reachable.</span>}
                                    />
                                </div>
                            </div>
                        </Field>
                    )}
                </motion.div>
            </AnimatePresence>

            {errors.form && (
                <p className="mt-4 text-sm text-error-primary" role="alert">
                    {errors.form}
                </p>
            )}
        </DirectoryModal>
    );
};
