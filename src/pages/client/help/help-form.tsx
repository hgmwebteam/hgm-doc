/**
 * THE REQUEST FORM, one component for the client and the team.
 *
 * The Figma's Screens page - "Desktop / 1 Default, 2 Filled, 3 Validation,
 * 4 Submitting, 5 Success" and "Mobile / 390" - is the only form in the file,
 * and both surfaces follow it exactly so a client and a colleague are looking at
 * the same thing:
 *
 *   the column     560 wide, centred, 24 between blocks
 *   heading        eyebrow in caption/meta, the title in display/title, a lede
 *                  in body/input
 *   Client         Field/Select - the team picks; a client's is fixed and named
 *                  in the lede instead
 *   Topic          Field/Select - the team picks; a client arrived here from a
 *                  topic tile, so it is the eyebrow
 *   Priority       Priority/Chip over Priority/Legend - the team only
 *   Screenshots    Field/Upload: the dashed drop zone, the cloud, "Drop
 *                  screenshots here, or browse"
 *   Description    Field/Textarea, and its helper is the rule: the first line
 *                  becomes the title, everything after it the description
 *   Property, Needed by
 *                  two optional fields the file does not carry. Kept because
 *                  the brain reads needed_by as the task's due date when the
 *                  topic has no turnaround - drop it and every ticket routes
 *                  with no date - and property goes into the task notes
 *   Actions        Cancel and the primary, right-aligned, the trust line under
 *                  them right-aligned too
 *   Validation     the Banner, kind=error, above the form, and each field's
 *                  own line under it
 *
 * Nothing here decides who may submit; the server does. This is the picture.
 */
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Image01, UploadCloud02, XClose } from "@untitledui-pro/icons/line";
import { type ClientOption, HelpApiError, MAX_DETAIL, MAX_IMAGES, MAX_PROPERTY, MAX_TITLE, type NewTicketInput, type TicketImage, prepareImages } from "@/pages/client/help/help-api";
import { PRIORITIES, type Priority, type TicketTopic, todayIsoDay } from "@/pages/client/help/help-model";
import { ErrorNote, FOCUS, PrimaryButton, T } from "@/pages/client/help/help-requests-screen";
import { cx } from "@/utils/cx";

/* ── field atoms, per the Figma's Field/* components ────────────────────── */

/** 48 tall, body/input (16px, so iOS does not zoom), a hairline in border/primary, radius/lg, the brand focus ring. */
export const fieldClass = (invalid?: boolean) =>
    cx("w-full rounded-lg bg-primary px-3.5 py-3 text-primary ring-1 outline-none placeholder:text-tertiary focus:ring-2 focus:ring-brand", T.body, invalid ? "ring-error" : "ring-primary");

/** The label row: label/field left, "Required" or "Optional" in caption/meta right. */
export const LabelRow = ({ htmlFor, children, optional }: { htmlFor: string; children: React.ReactNode; optional?: boolean }) => (
    <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className={cx(T.label, "text-secondary")}>
            {children}
        </label>
        <span className={cx(T.caption, "text-tertiary")}>{optional ? "Optional" : "Required"}</span>
    </div>
);

/** The helper under a field, or the field's own error in its place. */
const Helper = ({ id, error, children }: { id: string; error?: string; children: React.ReactNode }) => (
    <p id={id} className={cx(T.helper, error ? "text-red-700" : "text-tertiary")} role={error ? "alert" : undefined}>
        {error || children}
    </p>
);

/** The Figma's Banner: icon, title in label/field, body in body/helper, on a tint with a hairline in its colour. */
export const Banner = ({ kind, title, body }: { kind: "error" | "success" | "info"; title: string; body: string }) => (
    <div
        role={kind === "error" ? "alert" : "status"}
        className={cx(
            "flex items-start gap-3 rounded-[10px] px-4 py-3 ring-1",
            kind === "error" && "bg-red-50 ring-red-600",
            kind === "success" && "bg-green-50 ring-green-700",
            kind === "info" && "bg-brand-primary ring-brand",
        )}
    >
        <span
            aria-hidden="true"
            className={cx(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ring-[1.8px]",
                kind === "error" ? "text-red-700 ring-red-600" : kind === "success" ? "text-green-800 ring-green-700" : "text-fg-brand-primary ring-brand",
            )}
        >
            <span className={cx(T.caption, "leading-none")}>{kind === "error" ? "!" : kind === "success" ? "✓" : "i"}</span>
        </span>
        <div className="min-w-0 flex-1">
            <p className={cx(T.label, "text-primary")}>{title}</p>
            <p className={cx(T.helper, "mt-1 text-pretty text-secondary")}>{body}</p>
        </div>
    </div>
);

/**
 * Priority/Chip over Priority/Legend. Single-select chips, 40 tall (44 on a phone), radius
 * full, an 8px colour dot and the label; the selected one takes its tint and a 1.5 ring in
 * its colour. The legend under them is one line per level, "so people pick by
 * consequence, not by mood".
 */
export const PriorityField = ({ value, onChange, required, error }: { value: Priority | null; onChange: (p: Priority | null) => void; required?: boolean; error?: string }) => (
    <fieldset className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
            <legend className={cx(T.label, "text-secondary")}>Priority</legend>
            <span className={cx(T.caption, "text-tertiary")}>{required ? "Required" : "Optional"}</span>
        </div>
        <div role="radiogroup" aria-label="Priority" aria-invalid={!!error} className="flex flex-wrap gap-2">
            {PRIORITIES.map((p) => {
                const on = value === p.key;
                return (
                    <button
                        key={p.key}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => onChange(on && !required ? null : p.key)}
                        className={cx(
                            "inline-flex h-11 items-center gap-2 rounded-full px-4 ring-1 transition duration-100 ease-linear motion-reduce:transition-none sm:h-10",
                            T.label,
                            FOCUS,
                            on ? cx(p.chip, "text-primary ring-[1.5px]") : "bg-primary text-secondary ring-primary hover:bg-primary_hover",
                        )}
                    >
                        <span aria-hidden="true" className={cx("size-2 rounded-full", p.dot)} />
                        {p.label}
                    </button>
                );
            })}
        </div>
        {error && (
            <p className={cx(T.helper, "text-red-700")} role="alert">
                {error}
            </p>
        )}
        <ul className="flex flex-col gap-1.5">
            {PRIORITIES.map((p) => (
                <li key={p.key} className={cx("flex items-start gap-2 text-tertiary", T.helper)}>
                    <span aria-hidden="true" className={cx("mt-[5px] size-2 shrink-0 rounded-full", p.dot)} />
                    <span>
                        <span className="text-secondary">{p.label}:</span> {p.meaning}
                    </span>
                </li>
            ))}
        </ul>
    </fieldset>
);

/** "1.2 MB", from the base64 that will be sent. What the wire carries, not the original file. */
const sizeLabel = (b64: string): string => {
    const bytes = Math.round((b64.length * 3) / 4);
    return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
};

/* ── the form ────────────────────────────────────────────────────────────── */

export interface RequestFormProps {
    /** Who is filling it in. The team picks a client and a priority; a client's is fixed. */
    mode: "client" | "team";
    /** The team's client list. */
    clients?: ClientOption[];
    /** The topics to offer (team), or the one the client chose (client). */
    topics: TicketTopic[];
    fixedTopic?: TicketTopic;
    /** For the lede: who this is raised for and by. */
    clientName: string;
    email: string;
    /** Called with the fields; the caller owns the API call so the server's gate stays theirs. */
    onSubmit: (input: NewTicketInput & { slug: string }) => Promise<{ reference: string }>;
    onCreated: (reference: string, slug: string, sent: { title: string; priority: Priority | null }) => void;
    /** The team form loads its topics per client; this asks for them. */
    onClientChange?: (slug: string) => void;
    /** The client's own slug, when mode is client. */
    slug?: string;
}

export const RequestForm = ({ mode, clients = [], topics, fixedTopic, clientName, email, onSubmit, onCreated, onClientChange, slug }: RequestFormProps) => {
    const team = mode === "team";
    const [client, setClient] = useState(team ? "" : (slug ?? ""));
    const [topic, setTopic] = useState(fixedTopic?.key ?? "");
    const [priority, setPriority] = useState<Priority | null>(null);
    const [text, setText] = useState("");
    const [property, setProperty] = useState("");
    const [neededBy, setNeededBy] = useState("");
    const [images, setImages] = useState<TicketImage[]>([]);
    const [imageNotes, setImageNotes] = useState<string[]>([]);
    const [preparing, setPreparing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [touched, setTouched] = useState(false);
    const [error, setError] = useState("");
    const firstRef = useRef<HTMLSelectElement | HTMLTextAreaElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // Opening the form moves focus into it, so a keyboard or screen-reader user is not
    // left at the control that has just been replaced.
    useEffect(() => {
        firstRef.current?.focus();
    }, []);
    // The team's topic list arrives after a client is chosen; default to its first.
    useEffect(() => {
        if (!topic && topics[0]) setTopic(topics[0].key);
    }, [topic, topics]);

    // "Start with one line that says what is wrong. That line becomes the Asana task title;
    // everything after it becomes the task description."
    const [firstLine, rest] = useMemo(() => {
        const lines = text.replace(/\r/g, "").split("\n");
        return [(lines[0] ?? "").trim(), lines.slice(1).join("\n").trim()];
    }, [text]);

    const clientError = touched && team && !client ? "Choose the client." : "";
    const priorityError = touched && team && !priority ? "Pick a priority." : "";
    const textError = touched && firstLine.length < 3 ? "Say what is happening. One line is enough." : "";
    const problems = [clientError, priorityError, textError].filter(Boolean).length;
    const ready = (!team || (!!client && !!priority)) && !!topic && firstLine.length >= 3;
    const canSubmit = ready && !busy && !preparing;

    const onPickFiles = async (files: FileList | null) => {
        if (!files?.length) return;
        setPreparing(true);
        const { images: ready, rejected } = await prepareImages([...files]);
        setImages((prev) => [...prev, ...ready].slice(0, MAX_IMAGES));
        setImageNotes(rejected);
        setPreparing(false);
        if (fileRef.current) fileRef.current.value = "";
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setTouched(true);
        if (!canSubmit) return;
        setBusy(true);
        setError("");
        try {
            const res = await onSubmit({
                slug: client,
                topic,
                title: firstLine.slice(0, MAX_TITLE),
                // A one-line request is its own description; the server requires one.
                detail: (rest || firstLine).slice(0, MAX_DETAIL),
                property: property.trim() || undefined,
                needed_by: neededBy || undefined,
                images,
                ...(team && priority ? { priority } : {}),
            });
            onCreated(res.reference, client, { title: firstLine.slice(0, MAX_TITLE), priority: team ? priority : null });
        } catch (err) {
            setError(err instanceof HelpApiError ? err.message : "We could not send that just then. Nothing was lost - try again.");
            setBusy(false);
        }
    };

    // Plain words. Who it is for, in one line; what happens next, in one line.
    const forWhom = team ? clients.find((c) => c.slug === client)?.name || "" : clientName;
    const staffInClient = !team && /\(HiddenGem Media\)$/.test(email);
    const lede = team
        ? "Say what is wrong and which client it is for. The team picks it up from here."
        : staffInClient
          ? `This request is for ${forWhom || "this client"}. It will show in their help centre as raised by HiddenGem Media.`
          : "Tell us what you need. You get a reference straight away, and can follow it here.";

    return (
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
            <header className="flex flex-col gap-2">
                <p className={cx(T.caption, "tracking-[1.2px] text-fg-brand-primary uppercase")}>{team ? "Reporting System" : (fixedTopic?.label ?? "Help Center")}</p>
                <h1 className={cx(T.title, "text-primary")}>{team ? "Report a ticket" : "Raise a request"}</h1>
                <p className={cx(T.body, "text-pretty text-secondary")}>{lede}</p>
            </header>

            {touched && problems > 0 && (
                <Banner
                    kind="error"
                    title={problems === 1 ? "One thing needs fixing before this can go" : `${problems === 2 ? "Two" : "Three"} things need fixing before this can go`}
                    body={[clientError && "choose a client", priorityError && "pick a priority", textError && "describe what is happening"].filter(Boolean).join(", ").replace(/^./, (c) => c.toUpperCase()) + ". The fields are marked below."}
                />
            )}

            <form onSubmit={submit} noValidate className="flex flex-col gap-6">
                {team && (
                    <div className="flex flex-col gap-2">
                        <LabelRow htmlFor="rf-client">Client</LabelRow>
                        <select
                            id="rf-client"
                            ref={firstRef as React.RefObject<HTMLSelectElement>}
                            value={client}
                            onChange={(e) => {
                                setClient(e.target.value);
                                setTopic("");
                                onClientChange?.(e.target.value);
                            }}
                            aria-invalid={!!clientError}
                            aria-describedby="rf-client-help"
                            className={cx(fieldClass(!!clientError), "h-12")}
                        >
                            <option value="">Choose a client</option>
                            {clients.map((c) => (
                                <option key={c.slug} value={c.slug}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                        <Helper id="rf-client-help" error={clientError}>
                            Who this is for.
                        </Helper>
                    </div>
                )}

                {(team || !fixedTopic) && (
                    <div className="flex flex-col gap-2">
                        <LabelRow htmlFor="rf-topic">What is it about?</LabelRow>
                        <select
                            id="rf-topic"
                            ref={!team ? (firstRef as React.RefObject<HTMLSelectElement>) : undefined}
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            disabled={team && !client}
                            aria-describedby="rf-topic-help"
                            className={cx(fieldClass(), "h-12 disabled:opacity-60")}
                        >
                            {topics.length === 0 && <option value="">{team && !client ? "Choose a client first" : "Loading..."}</option>}
                            {topics.map((t) => (
                                <option key={t.key} value={t.key}>
                                    {t.label}
                                </option>
                            ))}
                        </select>
                        <Helper id="rf-topic-help">Each one goes to the team that does it.</Helper>
                    </div>
                )}

                {team && <PriorityField value={priority} onChange={setPriority} required error={priorityError} />}

                <div className="flex flex-col gap-2">
                    <LabelRow htmlFor="rf-images" optional>
                        Screenshots
                    </LabelRow>
                    <label
                        htmlFor="rf-images"
                        className="flex h-[132px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-primary bg-primary px-6 text-center transition duration-100 ease-linear hover:bg-secondary motion-reduce:transition-none"
                    >
                        <UploadCloud02 className="size-7 text-fg-brand-primary" aria-hidden="true" />
                        <span className={cx(T.label, "text-primary")}>{images.length ? "Add another screenshot" : "Drop screenshots here, or browse"}</span>
                        <span className={cx(T.helper, "text-tertiary")}>PNG, JPG or WEBP · shrunk before sending · up to {MAX_IMAGES} files</span>
                    </label>
                    <input id="rf-images" ref={fileRef} type="file" accept="image/*" multiple onChange={(e) => void onPickFiles(e.target.files)} className="sr-only" />
                    {preparing && (
                        <p className={cx(T.helper, "text-tertiary")} role="status">
                            Preparing images...
                        </p>
                    )}
                    {images.length > 0 && (
                        <ul className="flex flex-col gap-2">
                            {images.map((img, i) => (
                                <li key={`${img.name}-${i}`} className="flex items-center gap-3 rounded-[10px] bg-secondary py-2 pr-2 pl-2 ring-1 ring-secondary">
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-tertiary ring-1 ring-secondary">
                                        <Image01 className="size-4" aria-hidden="true" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className={cx("block truncate text-primary", T.helper)}>{img.name}</span>
                                        <span className={cx("block text-tertiary", T.mono)}>
                                            {sizeLabel(img.dataBase64)} &middot; ready
                                        </span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                                        aria-label={`Remove ${img.name}`}
                                        className={cx("flex size-8 shrink-0 items-center justify-center rounded-md text-tertiary hover:bg-primary hover:text-primary", FOCUS)}
                                    >
                                        <XClose className="size-4" aria-hidden="true" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    {imageNotes.length > 0 && (
                        <ul className="flex flex-col gap-1" role="status">
                            {imageNotes.map((note) => (
                                <li key={note} className={cx(T.helper, "text-red-700")}>
                                    {note}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <LabelRow htmlFor="rf-text">Description</LabelRow>
                    <textarea
                        id="rf-text"
                        ref={!team && fixedTopic ? (firstRef as React.RefObject<HTMLTextAreaElement>) : undefined}
                        value={text}
                        onChange={(e) => setText(e.target.value.slice(0, MAX_DETAIL + MAX_TITLE))}
                        rows={7}
                        placeholder="What is happening, and where?"
                        aria-invalid={!!textError}
                        aria-describedby="rf-text-help"
                        className={cx(fieldClass(!!textError), "resize-y")}
                    />
                    <Helper id="rf-text-help" error={textError}>
                        Put what is wrong in the first line. That line is the title; anything after it is the detail.
                    </Helper>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                        <LabelRow htmlFor="rf-property" optional>
                            Which property?
                        </LabelRow>
                        <input id="rf-property" value={property} onChange={(e) => setProperty(e.target.value.slice(0, MAX_PROPERTY))} placeholder="Leave blank if it covers all of them" className={cx(fieldClass(), "h-12")} />
                    </div>
                    <div className="flex flex-col gap-2">
                        <LabelRow htmlFor="rf-needed" optional>
                            Needed by
                        </LabelRow>
                        <input id="rf-needed" type="date" value={neededBy} min={todayIsoDay()} onChange={(e) => setNeededBy(e.target.value)} aria-describedby="rf-needed-help" className={cx(fieldClass(), "h-12")} />
                        <Helper id="rf-needed-help">{team ? "If the client gave a date." : "If you have a date in mind."}</Helper>
                    </div>
                </div>

                {error && <ErrorNote message={error} />}

                {/* The frame: one primary button, left, and the line under it. No Cancel -
                    the way back is the link above the form. While sending, the button shows
                    the spinner and the line says so. */}
                <div className="flex flex-col gap-3">
                    <div>
                        <PrimaryButton type="submit" disabled={busy || preparing} className="w-full sm:w-auto sm:min-w-36" aria-busy={busy}>
                            {busy && <span className="mr-2 size-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" aria-hidden="true" />}
                            {team ? "Submit ticket" : "Send request"}
                        </PrimaryButton>
                    </div>
                    <p className={cx(T.helper, "text-pretty text-tertiary")} role="status">
                        {busy ? "Sending. This usually takes a second or two." : "You will get a reference here straight away."}
                    </p>
                </div>
            </form>
        </div>
    );
};

/* ── the success screen ──────────────────────────────────────────────────── */

/**
 * "Desktop / 5 Success": the eyebrow and "Ticket sent", the Banner kind=success, then a
 * summary card - the title in label/field over four rows (Ticket, Client, Priority, and
 * where it is now), each a caption on the left and the value right-aligned - and two
 * buttons, the quieter one first, left-aligned.
 *
 * The banner says what is true: the request is stored and the team has it. It does not
 * say the Asana task exists, because until a topic has a board it does not.
 */
export const RequestSent = ({
    reference,
    title,
    clientName,
    priority,
    team,
    primary,
    secondary,
}: {
    reference: string;
    title: string;
    clientName: string;
    priority: Priority | null;
    team: boolean;
    primary: { label: string; onClick: () => void };
    secondary: { label: string; onClick: () => void };
}) => {
    const pm = PRIORITIES.find((p) => p.key === priority) ?? null;
    return (
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
            <header className="flex flex-col gap-2">
                <p className={cx(T.caption, "tracking-[1.2px] text-fg-brand-primary uppercase")}>{team ? "Reporting System" : "Help Center"}</p>
                <h1 className={cx(T.title, "text-primary")}>{team ? "Ticket sent" : "Request sent"}</h1>
            </header>
            <Banner kind="success" title="The team has it" body={`${reference} is stored with everything you wrote. You can open it any time to see where it stands.`} />
            <div className="flex flex-col gap-3 rounded-xl bg-primary p-4 ring-1 ring-secondary sm:p-5">
                <p className={cx(T.label, "text-primary")}>{title}</p>
                <dl className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-4">
                        <dt className={cx(T.helper, "text-tertiary")}>{team ? "Ticket" : "Reference"}</dt>
                        <dd className={cx(T.mono, "text-primary")}>{reference}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <dt className={cx(T.helper, "text-tertiary")}>Client</dt>
                        <dd className={cx(T.helper, "font-medium text-primary")}>{clientName}</dd>
                    </div>
                    {pm && (
                        <div className="flex items-center justify-between gap-4">
                            <dt className={cx(T.helper, "text-tertiary")}>Priority</dt>
                            <dd>
                                <span className={cx("inline-flex h-8 items-center gap-2 rounded-full px-3 ring-[1.5px]", T.label, pm.chip, "text-primary")}>
                                    <span aria-hidden="true" className={cx("size-2 rounded-full", pm.dot)} />
                                    {pm.label}
                                </span>
                            </dd>
                        </div>
                    )}
                    <div className="flex items-center justify-between gap-4">
                        <dt className={cx(T.helper, "text-tertiary")}>Status</dt>
                        <dd className={cx(T.helper, "font-medium text-primary")}>Received</dd>
                    </div>
                </dl>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
                <button
                    type="button"
                    onClick={secondary.onClick}
                    className={cx("inline-flex h-12 items-center justify-center rounded-lg bg-primary px-5 text-secondary ring-1 ring-primary hover:bg-primary_hover", T.button, FOCUS)}
                >
                    {secondary.label}
                </button>
                <PrimaryButton onClick={primary.onClick}>{primary.label}</PrimaryButton>
            </div>
        </div>
    );
};
