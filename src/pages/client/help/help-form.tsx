/**
 * THE REQUEST FORM, one component for the client and the team.
 *
 * The Figma file "Reporting System" draws one form, in fourteen frames ("Desktop · Light
 * / 1 Default .. 5 Success", "Mobile · Light / 390 Default, Filled", and the same in
 * Dark), and both surfaces are that form, node for node:
 *
 *   the column     560 wide, gap 24 between blocks; the page around it is the
 *                  caller's (body top 56 on desktop, 24 with 16px gutters at 390)
 *   heading        the eyebrow (Inter Medium 12/16, tracking 1.2, fg/brand-primary),
 *                  the title in display/title (24/30 at 390), the lede in body/input
 *                  (15/22 and shorter at 390: the frame writes a different sentence
 *                  there, so both are in the source and the width picks one)
 *   Client         Field/Select. The team chooses; a client's is the disabled state,
 *                  prefilled with their own name
 *   Priority       the label row, four Priority/Chips, the Priority/Legend. Team only
 *   Category       Field/Select, client only, where Priority is on the team's form,
 *                  preselected from the topic tile they clicked
 *   Screenshots    Field/Upload, then the attached File/Thumbnails as a block of
 *                  their own under it
 *   Description    Field/Textarea; its helper is the rule: the first line becomes the
 *                  Asana task title, everything after it the description
 *   Actions        one primary Button "Submit ticket" (176 wide, full width at 390)
 *                  and the trust line under it
 *   Validation     the Banner (error) above the fields, composed from what is missing,
 *                  and each field's own error line in place of its helper
 *   Submitting     the Button in its loading state and the trust line saying so
 *   Success        the frame's "Ticket sent" screen: the Banner (success), the summary
 *                  card, and the two Buttons
 *
 * Nothing here decides who may submit; the server does. This is the picture.
 * House style: no em or en dashes anywhere.
 */
import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ClientOption, HelpApiError, MAX_DETAIL, MAX_IMAGE_BYTES, MAX_IMAGE_PAYLOAD_BYTES, MAX_IMAGES, MAX_TITLE, type NewTicketInput, type TicketImage, fetchTicket, isAllowedImage, prepareImage } from "@/pages/client/help/help-api";
import { Banner, Button, FieldSelect, FieldTextarea, FieldUpload, FileThumbnail, MonoRef, PRIORITY_LEVELS, PriorityChip, PriorityDot, PriorityLegend, type PriorityLevel, formatFileSize } from "@/pages/client/help/help-atoms";
import type { Priority, TicketTopic } from "@/pages/client/help/help-model";
import { cx } from "@/utils/cx";

/* ── The frame's words ───────────────────────────────────────────────────── */

const LEDE = "Tell us what is wrong and who it affects. Jarvis turns it into an Asana task and hands it to whoever on the team has capacity, so nothing needs chasing.";
const LEDE_SHORT = "Tell us what is wrong and who it affects. Jarvis turns it into an Asana task and hands it to whoever has capacity.";
const CLIENT_HELPER = "The client this ticket is for. Jarvis uses it to file the task in the right place.";
const CLIENT_ERROR = "Choose which client this is about, so it reaches the right team.";
const PRIORITY_ERROR = "Pick the priority that matches the consequence, using the guide below.";
const CATEGORY_ERROR = "Choose the category that fits, so it reaches the right team.";
const DESCRIPTION_HELPER = "Start with one line that says what is wrong. That line becomes the Asana task title; everything after it becomes the task description.";
const DESCRIPTION_ERROR = "Tell us what is happening. One line is enough to start; the team can ask for more.";
const TRUST_LINE = "You will get a confirmation here, and the task appears in Asana within a couple of minutes.";
const SENDING_LINE = "Sending your ticket. This usually takes a second or two.";
const SUCCESS_BODY = "It is creating the Asana task now and will assign it to whoever on the team has capacity. You will see it in Asana within a minute or two, and nothing needs chasing.";
const ASANA_PENDING = "Creating task and assigning…";
const ASANA_UNROUTED = "Needs a person. Your account manager has been asked.";

/** A select opens on click, so it shows the pointer (the disabled one keeps the atom's not-allowed). */
const SELECT_CURSOR = "[&_select:not(:disabled)]:cursor-pointer";

/** The category every team ticket is raised under: the frame has no category field. */
const TEAM_TOPIC = "website";

/* ── Heading ─────────────────────────────────────────────────────────────── */

/**
 * The eyebrow is the one text on these frames outside the nine named styles: Inter
 * Medium 12/16 with 1.2px of tracking, in fg/brand-primary, written in capitals in the
 * source (no text-transform, so the node reads as the frame's words).
 */
const EYEBROW = "text-[12px] leading-4 font-medium tracking-[1.2px] text-(--hc-fg-brand-primary)";

const FormHeading = ({ eyebrow, title, lede }: { eyebrow: string; title: string; lede?: boolean }) => (
    <header className="flex flex-col gap-2">
        <p className={EYEBROW}>{eyebrow}</p>
        {/* display/title on desktop; the 390 frames set the title at 24/30 with the same tracking. */}
        <h1 className="text-[24px] leading-[30px] font-semibold tracking-[-0.5px] text-(--hc-text-primary) sm:hc-t-display-title">{title}</h1>
        {lede && (
            <>
                <p className="hc-t-body-input hidden text-(--hc-text-secondary) sm:block">{LEDE}</p>
                <p className="text-[15px] leading-[22px] font-normal text-(--hc-text-secondary) sm:hidden">{LEDE_SHORT}</p>
            </>
        )}
    </header>
);

/* ── Priority ────────────────────────────────────────────────────────────── */

/**
 * The four chips as one radiogroup. Gap 8 hugging on desktop; at 390 the frame draws
 * two rows of two with 16 between chips and between rows (each chip FILL at 171 on the
 * 358 column). Arrow keys move the selection the way a native radio group does; only
 * the selected chip (or the first, when none is) is in the tab order.
 *
 * Kept here rather than using the atoms' PriorityChipGroup because that group puts 8
 * between the chips at 390 where the frame has 16.
 */
const PriorityChips = ({ value, onChange, labelledBy, describedBy }: { value: PriorityLevel | null; onChange: (level: PriorityLevel) => void; labelledBy: string; describedBy?: string }) => {
    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const keys: Record<string, 1 | -1> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        const step = keys[e.key];
        if (!step) return;
        e.preventDefault();
        const i = PRIORITY_LEVELS.findIndex((p) => p.value === value);
        // Nothing selected yet: right goes to the first chip, left to the last.
        const from = i < 0 ? (step > 0 ? -1 : 0) : i;
        const next = PRIORITY_LEVELS[(from + step + PRIORITY_LEVELS.length) % PRIORITY_LEVELS.length].value;
        onChange(next);
        e.currentTarget.querySelector<HTMLButtonElement>(`[data-level="${next}"]`)?.focus();
    };
    return (
        <div role="radiogroup" aria-labelledby={labelledBy} aria-describedby={describedBy} onKeyDown={onKeyDown} className="grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:gap-2">
            {PRIORITY_LEVELS.map((p, i) => (
                <PriorityChip key={p.value} level={p.value} selected={value === p.value} onSelect={onChange} tabIndex={value === p.value || (value === null && i === 0) ? 0 : -1} className="cursor-pointer" />
            ))}
        </div>
    );
};

/**
 * The selected chip's tints, per level, for the summary card's static chip (the atoms
 * export the interactive chip only, and a radio in a summary would be a control that
 * does nothing). Same values as the atoms' PRIORITY_TONE.
 */
const CHIP_TINT: Record<PriorityLevel, string> = {
    low: "border-(--hc-utility-blue-fg) bg-(--hc-utility-blue-bg)",
    medium: "border-(--hc-utility-success-fg) bg-(--hc-utility-success-bg)",
    high: "border-(--hc-utility-warning-fg) bg-(--hc-utility-warning-bg)",
    urgent: "border-(--hc-utility-error-fg) bg-(--hc-utility-error-bg)",
};

/** Priority/Chip in its selected state, drawn but not pressable: the summary card's row. */
const PriorityChipStatic = ({ level }: { level: PriorityLevel }) => (
    <span className={cx("hc-t-label-field inline-flex h-10 items-center gap-2 rounded-(--hc-radius-full) border-[1.5px] px-[14.5px] whitespace-nowrap text-(--hc-text-primary)", CHIP_TINT[level])}>
        <PriorityDot level={level} className="rounded-(--hc-radius-full)" />
        {PRIORITY_LEVELS.find((p) => p.value === level)?.label}
    </span>
);

/* ── Attachments ─────────────────────────────────────────────────────────── */

type Attachment = {
    id: number;
    /** The original name and byte size, which the thumbnail shows. */
    name: string;
    size: number;
    /** An object URL of the file, shown in the 40px preview; null once the file proves undecodable. */
    previewUrl: string | null;
    /** The compressed bytes that will be sent; null while they are being prepared. */
    image: TicketImage | null;
};

let nextAttachmentId = 1;

/* ── The validation banner ───────────────────────────────────────────────── */

const COUNT_WORDS = ["", "One", "Two", "Three", "Four"];

/**
 * "Two things need fixing before this can go" over "Choose a client, and describe what
 * is happening. Both fields are marked below.": the count in words, the missing fields
 * as one sentence joined with commas and "and", and the closing line by count.
 */
const composeBanner = (missing: string[]): { title: string; body: string } => {
    const n = missing.length;
    const title = `${COUNT_WORDS[n] ?? String(n)} ${n === 1 ? "thing needs" : "things need"} fixing before this can go`;
    const list = n === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")}, and ${missing[n - 1]}`;
    const sentence = list.charAt(0).toUpperCase() + list.slice(1);
    const marked = n === 1 ? "The field is marked below." : n === 2 ? "Both fields are marked below." : `All ${COUNT_WORDS[n]?.toLowerCase() ?? n} fields are marked below.`;
    return { title, body: `${sentence}. ${marked}` };
};

/* ── The form ────────────────────────────────────────────────────────────── */

export interface RequestFormProps {
    /** Who is filling it in. The team picks a client and a priority; a client's is fixed and they pick a category. */
    mode: "client" | "team";
    /** The team's client list. */
    clients?: ClientOption[];
    /** The categories a client may choose from (client mode). Unused by the team form, which has no category. */
    topics: TicketTopic[];
    /** The topic tile the client arrived from: preselects the category. */
    fixedTopic?: TicketTopic;
    /** The client's own name, shown in the disabled Client field (client mode). */
    clientName: string;
    email: string;
    /** Called with the fields; the caller owns the API call so the server's gate stays theirs. */
    onSubmit: (input: NewTicketInput & { slug: string }) => Promise<{ reference: string }>;
    onCreated: (reference: string, slug: string, sent: { title: string; priority: Priority | null }) => void;
    /** Kept for callers that listened for the team's client choice; the form no longer needs anything back. */
    onClientChange?: (slug: string) => void;
    /** The client's own slug, when mode is client. */
    slug?: string;
}

/**
 * Where the last successful submission went, by reference, so RequestSent can poll the
 * ticket even when its caller does not pass the slug (the client's help centre renders
 * the success card from a call site this file does not own). Passing `slug` to
 * RequestSent is the proper route; this is the fallback.
 */
const sentSlugs = new Map<string, string>();

export const RequestForm = ({ mode, clients = [], topics, fixedTopic, clientName, onSubmit, onCreated, onClientChange, slug }: RequestFormProps) => {
    const team = mode === "team";
    const [client, setClient] = useState(team ? "" : (slug ?? ""));
    const [category, setCategory] = useState(fixedTopic?.key ?? "");
    const [priority, setPriority] = useState<PriorityLevel | null>(null);
    const [text, setText] = useState("");
    const [files, setFiles] = useState<Attachment[]>([]);
    const [fileError, setFileError] = useState("");
    const [busy, setBusy] = useState(false);
    const [touched, setTouched] = useState(false);
    const [error, setError] = useState("");
    const bannerRef = useRef<HTMLDivElement>(null);
    const filesRef = useRef(files);
    filesRef.current = files;

    // The client's composer replaces the help home in place, so focus moves into it (the
    // Category select: their Client field is disabled) and a keyboard or screen-reader
    // user is not left at the control that has just gone. The team's form is a page of
    // its own and loads like one.
    useEffect(() => {
        if (!team) document.getElementById("category")?.focus();
    }, [team]);

    // Object URLs are released when the form goes.
    useEffect(
        () => () => {
            for (const f of filesRef.current) if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
        },
        [],
    );

    // "Start with one line that says what is wrong. That line becomes the Asana task
    // title; everything after it becomes the task description."
    const [firstLine, rest] = useMemo(() => {
        const lines = text.replace(/\r/g, "").split("\n");
        return [(lines[0] ?? "").trim(), lines.slice(1).join("\n").trim()];
    }, [text]);

    const clientMissing = team && !client;
    const priorityMissing = team && !priority;
    const categoryMissing = !team && !category;
    const descriptionMissing = firstLine.length < 3;
    const missing = [clientMissing && "choose a client", priorityMissing && "pick a priority", categoryMissing && "choose a category", descriptionMissing && "describe what is happening"].filter((m): m is string => !!m);
    const banner = touched && missing.length ? composeBanner(missing) : null;

    const addFiles = useCallback(async (picked: File[]) => {
        setFileError("");
        const accepted: Array<{ att: Attachment; file: File }> = [];
        let problem = "";
        let count = filesRef.current.length;
        for (const file of picked) {
            if (count >= MAX_IMAGES) {
                problem = `Up to ${MAX_IMAGES} files. Remove one to add ${file.name}.`;
                break;
            }
            if (!isAllowedImage(file)) {
                problem = `${file.name} is not a PNG, JPG or WEBP.`;
                continue;
            }
            if (file.size > MAX_IMAGE_BYTES) {
                problem = `${file.name} is over 10 MB.`;
                continue;
            }
            count += 1;
            accepted.push({ att: { id: nextAttachmentId++, name: file.name, size: file.size, previewUrl: URL.createObjectURL(file), image: null }, file });
        }
        if (problem) setFileError(problem);
        if (!accepted.length) return;
        setFiles((prev) => [...prev, ...accepted.map((a) => a.att)]);
        // Compress in the background; the thumbnail is already on the page with the
        // original name and size, and the send waits for the bytes.
        await Promise.all(
            accepted.map(async ({ att, file }) => {
                // A file the browser cannot draw (a PNG by name only) keeps its name and
                // size on the thumbnail but loses the preview, rather than showing a
                // broken image in the 40px square.
                if (att.previewUrl) {
                    const probe = new Image();
                    probe.src = att.previewUrl;
                    const drawable = await probe.decode().then(
                        () => true,
                        () => false,
                    );
                    if (!drawable) {
                        URL.revokeObjectURL(att.previewUrl);
                        setFiles((prev) => prev.map((f) => (f.id === att.id ? { ...f, previewUrl: null } : f)));
                    }
                }
                try {
                    const image = await prepareImage(file);
                    const sent = filesRef.current.filter((f) => f.image).reduce((n, f) => n + f.image!.dataBase64.length, 0);
                    if (sent + image.dataBase64.length > MAX_IMAGE_PAYLOAD_BYTES) throw new Error(`${att.name} makes the screenshots too large to send together. Remove one.`);
                    setFiles((prev) => prev.map((f) => (f.id === att.id ? { ...f, image } : f)));
                } catch (err) {
                    setFiles((prev) => prev.filter((f) => f.id !== att.id));
                    if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
                    setFileError(err instanceof Error && err.message ? err.message : `${att.name} could not be read.`);
                }
            }),
        );
    }, []);

    const removeFile = (id: number) => {
        setFileError("");
        setFiles((prev) => {
            const gone = prev.find((f) => f.id === id);
            if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
            return prev.filter((f) => f.id !== id);
        });
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setTouched(true);
        if (missing.length) {
            // The alert is announced where it is; focus follows it so the next Tab lands
            // on the first field, which is the first thing marked.
            requestAnimationFrame(() => bannerRef.current?.focus());
            return;
        }
        if (busy) return;
        setBusy(true);
        setError("");
        try {
            // A screenshot picked a moment ago may still be compressing (a few hundred
            // milliseconds); the send waits for it rather than leaving it behind.
            for (let i = 0; i < 100 && filesRef.current.some((f) => !f.image); i++) await new Promise((r) => setTimeout(r, 100));
            const res = await onSubmit({
                slug: client,
                topic: team ? TEAM_TOPIC : category,
                title: firstLine.slice(0, MAX_TITLE),
                // A one-line request is its own description; the server requires one.
                detail: (rest || firstLine).slice(0, MAX_DETAIL),
                images: filesRef.current.map((f) => f.image).filter((img): img is TicketImage => !!img),
                ...(team && priority ? { priority } : {}),
            });
            sentSlugs.set(res.reference, client);
            onCreated(res.reference, client, { title: firstLine.slice(0, MAX_TITLE), priority: team ? priority : null });
        } catch (err) {
            setError(err instanceof HelpApiError ? err.message : "We could not send that just then. Nothing was lost. Try again.");
            setBusy(false);
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
            <FormHeading eyebrow={team ? "REPORTING SYSTEM" : "HELP CENTER"} title={team ? "Report a ticket" : "Raise a request"} lede />

            {banner && (
                <div ref={bannerRef} tabIndex={-1}>
                    <Banner kind="error" title={banner.title}>
                        {banner.body}
                    </Banner>
                </div>
            )}

            <form onSubmit={submit} noValidate className="flex flex-col gap-6">
                <FieldSelect
                    id="client"
                    label="Client"
                    requirement="Required"
                    value={client}
                    onChange={(v) => {
                        setClient(v);
                        onClientChange?.(v);
                    }}
                    options={team ? clients.map((c) => ({ value: c.slug, label: c.name })) : [{ value: slug ?? "", label: clientName }]}
                    placeholder="Choose a client"
                    helper={CLIENT_HELPER}
                    error={touched && clientMissing ? CLIENT_ERROR : undefined}
                    disabled={!team}
                    className={SELECT_CURSOR}
                />

                {team ? (
                    // The dots inside the atoms' chips and legend are rounded with a
                    // clip-path, which the parity proof (and any box-radius reader) sees as
                    // a square; the file draws them as ellipses, so they get their radius
                    // here until PriorityDot carries it itself.
                    <div className="flex flex-col gap-2 [&_[role=radio]>span:first-child]:rounded-(--hc-radius-full) [&_li>span>span]:rounded-(--hc-radius-full)">
                        <div className="flex items-baseline justify-between gap-2">
                            <span id="priority-label" className="hc-t-label-field text-(--hc-text-secondary)">
                                Priority
                            </span>
                            <span className="hc-t-caption-meta text-(--hc-text-tertiary)">Required</span>
                        </div>
                        <PriorityChips value={priority} onChange={setPriority} labelledBy="priority-label" describedBy={touched && priorityMissing ? "priority-error" : undefined} />
                        {touched && priorityMissing && (
                            <p id="priority-error" className="hc-t-body-helper text-(--hc-text-error-primary)">
                                {PRIORITY_ERROR}
                            </p>
                        )}
                        <PriorityLegend />
                    </div>
                ) : (
                    <FieldSelect
                        id="category"
                        label="Category"
                        requirement="Required"
                        value={category}
                        onChange={setCategory}
                        options={topics.map((t) => ({ value: t.key, label: t.label }))}
                        placeholder="Choose a category"
                        error={touched && categoryMissing ? CATEGORY_ERROR : undefined}
                        className={SELECT_CURSOR}
                    />
                )}

                <FieldUpload id="screenshots" label="Screenshots" requirement="Optional" attachedCount={files.length} onFiles={(picked) => void addFiles(picked)} error={fileError || undefined} accept="image/png,image/jpeg,image/webp" />

                {files.length > 0 && (
                    <ul className="flex flex-col gap-2">
                        {files.map((f) => (
                            <FileThumbnail key={f.id} name={f.name} meta={`${formatFileSize(f.size)} · uploaded`} previewUrl={f.previewUrl} onRemove={() => removeFile(f.id)} className="[&_button]:cursor-pointer" />
                        ))}
                    </ul>
                )}

                <FieldTextarea
                    id="description"
                    label="Description"
                    requirement="Required"
                    value={text}
                    onChange={(v) => setText(v.slice(0, MAX_DETAIL + MAX_TITLE))}
                    placeholder="What is happening, and where?"
                    helper={DESCRIPTION_HELPER}
                    error={touched && descriptionMissing ? DESCRIPTION_ERROR : undefined}
                />

                {error && (
                    <Banner kind="error" title="That did not send">
                        {error}
                    </Banner>
                )}

                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                        <Button type="submit" loading={busy} className={busy ? "max-sm:w-full" : "max-sm:w-full cursor-pointer"}>
                            Submit ticket
                        </Button>
                    </div>
                    <p className="hc-t-body-helper text-center text-(--hc-text-tertiary) sm:text-left" role="status">
                        {busy ? SENDING_LINE : TRUST_LINE}
                    </p>
                </div>
            </form>
        </div>
    );
};

/* ── The success screen ──────────────────────────────────────────────────── */

export interface RequestSentProps {
    reference: string;
    /** The first line of the description: the summary card's first line. */
    title: string;
    clientName: string;
    priority: Priority | null;
    team: boolean;
    /** "Report another ticket": resets the form. */
    primary: { label: string; onClick: () => void };
    /** "Back to portal": the way out. */
    secondary: { label: string; onClick: () => void };
    /**
     * The client's dashboard slug, to poll ticket-detail for the Asana row. Optional
     * because the help centre's call site predates it; the form remembers where the
     * reference went and this falls back to that.
     */
    slug?: string;
}

/**
 * "Desktop / 5 Success": the eyebrow and "Ticket sent", the Banner (success) "Jarvis has
 * it", then the summary card (bg/secondary, border/secondary, radius/xl, padding 16, gap
 * 16): the first line of the description in body/input, then the rows Ticket (mono/id),
 * Client (label/field), Priority (the selected chip, team only) and Asana, each a
 * body/helper caption on the left and the value on the right. Two Buttons under it, the
 * secondary first.
 *
 * The Asana row starts as the frame has it, "Creating task and assigning…", and from
 * four seconds in polls ticket-detail every four seconds: "Assigned to {name}" once the
 * ticket has an assignee, or "Needs a person. Your account manager has been asked." when
 * a route_failed event is on it. Stops after two minutes either way.
 */
export const RequestSent = ({ reference, title, clientName, priority, team, primary, secondary, slug }: RequestSentProps) => {
    const pollSlug = slug ?? sentSlugs.get(reference) ?? "";
    const [asana, setAsana] = useState(ASANA_PENDING);

    useEffect(() => {
        if (!pollSlug) return;
        let stopped = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const started = Date.now();
        const tick = async () => {
            if (stopped) return;
            try {
                const res = await fetchTicket({ slug: pollSlug, email: "" }, reference);
                if (stopped) return;
                const name = (res.ticket.assignee_name ?? "").trim();
                if (name) {
                    setAsana(`Assigned to ${name}`);
                    return;
                }
                if (res.events.some((e) => e.kind === "route_failed")) {
                    setAsana(ASANA_UNROUTED);
                    return;
                }
            } catch {
                // A missed poll is not news; the next one runs.
            }
            if (Date.now() - started < 120_000) timer = setTimeout(() => void tick(), 4000);
        };
        timer = setTimeout(() => void tick(), 4000);
        return () => {
            stopped = true;
            if (timer) clearTimeout(timer);
        };
    }, [pollSlug, reference]);

    const level = priority && PRIORITY_LEVELS.some((p) => p.value === priority) ? (priority as PriorityLevel) : null;

    return (
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
            <FormHeading eyebrow={team ? "REPORTING SYSTEM" : "HELP CENTER"} title="Ticket sent" />
            <Banner kind="success" title="Jarvis has it">
                {SUCCESS_BODY}
            </Banner>
            <div className="flex flex-col gap-4 rounded-(--hc-radius-xl) border border-(--hc-border-secondary) bg-(--hc-bg-secondary) p-[15px]">
                <p className="hc-t-body-input text-(--hc-text-primary)">{title}</p>
                <dl className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-4">
                        <dt className="hc-t-body-helper text-(--hc-text-tertiary)">Ticket</dt>
                        <dd className="flex">
                            <MonoRef className="text-(--hc-text-primary)">{reference}</MonoRef>
                        </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <dt className="hc-t-body-helper text-(--hc-text-tertiary)">Client</dt>
                        <dd className="hc-t-label-field text-right text-(--hc-text-primary)">{clientName}</dd>
                    </div>
                    {level && (
                        <div className="flex items-center justify-between gap-4">
                            <dt className="hc-t-body-helper text-(--hc-text-tertiary)">Priority</dt>
                            <dd className="flex">
                                <PriorityChipStatic level={level} />
                            </dd>
                        </div>
                    )}
                    <div className="flex items-center justify-between gap-4">
                        <dt className="hc-t-body-helper text-(--hc-text-tertiary)">Asana</dt>
                        <dd className="hc-t-label-field text-right text-(--hc-text-secondary)" role="status">
                            {asana}
                        </dd>
                    </div>
                </dl>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row">
                <Button variant="secondary" onClick={secondary.onClick} className="max-sm:w-full cursor-pointer">
                    {secondary.label}
                </Button>
                <Button onClick={primary.onClick} className="max-sm:w-full cursor-pointer">
                    {primary.label}
                </Button>
            </div>
        </div>
    );
};
