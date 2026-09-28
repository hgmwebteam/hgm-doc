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
 *   Category       Field/Select, client only, preselected from the topic tile they
 *                  clicked
 *   Priority       the label row, four Priority/Chips, the Priority/Legend. Everyone
 *                  sets one (owner, 13 Sep 2026)
 *   Files          Field/Upload, then the attached File/Thumbnails as a block of their
 *                  own under it. Images, PDF, Word, Excel, CSV or text, 25 MB each, up to
 *                  10 (request-rules.ts). Each file uploads the moment it is picked,
 *                  straight to storage (help-api.ts uploadTicketFile), two at a time
 *   Description    Field/Textarea; its helper is the rule: the first line becomes the
 *                  Asana task title, everything after it the description
 *   Pages          the pages the request is about: up to 10 address rows, "Add another
 *                  URL" under them (owner, 28 Sep 2026)
 *   Completion     one address that gets the completion email, only while the switch
 *     email        (completion-email-mode.ts) lets this person be offered one
 *   Actions        one primary Button "Submit ticket" (176 wide, full width at 390)
 *                  and the trust line under it
 *   Validation     the Banner (error) above the fields, composed from what is missing,
 *                  and each field's own error line in place of its helper
 *   Submitting     the Button in its loading state and the trust line saying so (and
 *                  that it is waiting for files still uploading)
 *   Success        the frame's "Ticket sent" screen: the Banner (success), the summary
 *                  card (with the files, pages and completion email it carried), and the
 *                  two Buttons. No delivery estimate on it (owner, 28 Sep 2026); the
 *                  pills and the legend keep theirs
 *
 * Pages and Completion email sit after Description so the only thing that moves in the
 * Figma frames is Actions. Nothing here decides who may submit; the server does. This is
 * the picture. House style: no em or en dashes anywhere.
 */
import { type ComponentProps, type FormEvent, type KeyboardEvent, type Ref, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "react-router";
import { COMPLETION_EMAIL_MODE } from "@/pages/client/help/completion-email-mode";
import { type ClientOption, HelpApiError, MAX_DETAIL, MAX_TITLE, type NewTicketInput, fetchTicket, prepareUploadBlob, requestUploadUrls, uploadTicketFile } from "@/pages/client/help/help-api";
import { Banner, Button, FieldInput, FieldNote, FieldSelect, FieldTextarea, FieldUpload, FileThumbnail, LabelRow, MonoRef, PRIORITY_LEVELS, PriorityChip, PriorityDot, PriorityLegend, type PriorityLevel, RemoveButton, TextInput, formatFileSize } from "@/pages/client/help/help-atoms";
import { type Priority, type Ticket, type TicketFile, type TicketTopic, displayUrl, isTeamAddress } from "@/pages/client/help/help-model";
import { MAX_FILES, MAX_FILE_BYTES, MAX_URLS, cleanNotifyEmail, cleanUrl, cleanUrls, completionEmailOpen, fileCountError, fileSizeError, fileTypeError, fileTypeFor, fileUploadFailed, isEmailShape, uploadTypeFor } from "@/pages/client/help/request-rules";
import { cx } from "@/utils/cx";

/* ── The frame's words ───────────────────────────────────────────────────── */

const LEDE = "Tell us what is wrong and who it affects. Jarvis turns it into an Asana task and hands it to whoever on the team has capacity, so nothing needs chasing.";
const LEDE_SHORT = "Tell us what is wrong and who it affects. Jarvis turns it into an Asana task and hands it to whoever has capacity.";
// A client reads client words: Jarvis and Asana are the team's tools, not theirs.
const CLIENT_LEDE = "Tell us what is wrong and where. It goes straight to the team responsible, and you can follow it here.";
const CLIENT_DESCRIPTION_HELPER = "Start with one line that says what is wrong. That line becomes the request's title; everything after it is the detail.";
const CLIENT_TRUST_LINE = "You will get a confirmation here, and the request appears in your list straight away.";
const CLIENT_SENDING_LINE = "Sending your request. This usually takes a second or two.";
/** With an address the success card says where the completion email goes; without, today's promise. The address is the one the SERVER stored, so the promise only appears when the switch let it be stored. */
const clientSuccessBody = (completionEmail: string | null | undefined): string =>
    completionEmail
        ? `It is on its way to the team responsible. You will see who has it here, and a completion email goes to ${completionEmail} when it is done.`
        : "It is on its way to the team responsible. You will see who has it here, and your account manager will confirm when it is done.";
const CLIENT_OWNER_PENDING = "Assigning…";
const TITLE_TOO_LONG = "Keep the first line under 140 characters; the rest can go on the next line.";
const CLIENT_HELPER = "The client this ticket is for. Jarvis uses it to file the task in the right place.";
const OWN_CLIENT_HELPER = "Your account. Requests you raise here go on your own list.";
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
const WAITING_FOR_FILES = "Waiting for your files to finish uploading.";
const PAGES_HELPER = "The pages this is about. Up to 10.";
const EMAIL_HELPER = "One email goes here when the work is completed.";

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

const FormHeading = ({ eyebrow, title, lede, titleRef }: { eyebrow: string; title: string; lede?: "team" | "client"; titleRef?: Ref<HTMLHeadingElement> }) => (
    <header className="flex flex-col gap-2">
        <p className={EYEBROW}>{eyebrow}</p>
        {/* display/title on desktop; the 390 frames set the title at 24/30 with the same tracking.
            Focusable so a submit can hand focus to the outcome (build notes). */}
        <h1 ref={titleRef} tabIndex={-1} className="text-[24px] leading-[30px] font-semibold tracking-[-0.5px] text-(--hc-text-primary) outline-none sm:hc-t-display-title">
            {title}
        </h1>
        {lede === "team" && (
            <>
                <p className="hc-t-body-input hidden text-(--hc-text-secondary) sm:block">{LEDE}</p>
                <p className="text-[15px] leading-[22px] font-normal text-(--hc-text-secondary) sm:hidden">{LEDE_SHORT}</p>
            </>
        )}
        {lede === "client" && <p className="text-[15px] leading-[22px] font-normal text-(--hc-text-secondary) sm:hc-t-body-input">{CLIENT_LEDE}</p>}
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
        <div role="radiogroup" aria-required="true" aria-labelledby={labelledBy} aria-describedby={describedBy} onKeyDown={onKeyDown} className="grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:gap-2">
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

/** Priority/Chip in its selected state, drawn but not pressable: the summary card's row. The level alone: the success card carries no delivery estimate (owner, 28 Sep 2026). */
const PriorityChipStatic = ({ level }: { level: PriorityLevel }) => (
    <span className={cx("hc-t-label-field inline-flex h-10 items-center gap-2 rounded-(--hc-radius-full) border-[1.5px] px-[14.5px] whitespace-nowrap text-(--hc-text-primary)", CHIP_TINT[level])}>
        <PriorityDot level={level} className="rounded-(--hc-radius-full)" />
        <span>{PRIORITY_LEVELS.find((p) => p.value === level)?.label}</span>
    </span>
);

/* ── Attachments ─────────────────────────────────────────────────────────── */

type Attachment = {
    id: number;
    /** The original name and byte size, which the thumbnail shows. */
    name: string;
    size: number;
    /** An object URL of an image, shown in the 40px preview; null for a document, or once an image proves undecodable. */
    previewUrl: string | null;
    /** A document's type label (PDF, DOCX), shown where an image's preview would be. */
    badge: string | null;
    /** On the list while it uploads; "uploaded" once the bytes are in storage. A failed upload leaves the list. */
    status: "uploading" | "uploaded";
    /** From ticket-upload-url: what ticket-create is sent. */
    fileId: string | null;
};

/**
 * Upload progress, kept OUT of the form's state: it changes many times a second, and in state
 * every change would re-render the whole form. Each row reads its own value through
 * useSyncExternalStore, so a change re-renders that row alone, and listeners hear at most
 * one change per animation frame.
 */
const createProgressStore = () => {
    const values = new Map<number, number>();
    const listeners = new Set<() => void>();
    let frame: number | null = null;
    return {
        get: (id: number): number | null => values.get(id) ?? null,
        set(id: number, fraction: number) {
            values.set(id, fraction);
            if (frame !== null) return;
            frame = requestAnimationFrame(() => {
                frame = null;
                for (const l of listeners) l();
            });
        },
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        stop() {
            if (frame !== null) cancelAnimationFrame(frame);
            frame = null;
        },
    };
};
type ProgressStore = ReturnType<typeof createProgressStore>;

/** One attached file, reading its own upload progress. */
const UploadRow = ({ store, fileKey, ...props }: { store: ProgressStore; fileKey: number } & Omit<ComponentProps<typeof FileThumbnail>, "progress">) => {
    const progress = useSyncExternalStore(
        store.subscribe,
        () => store.get(fileKey),
        () => null,
    );
    return <FileThumbnail {...props} progress={progress} />;
};

let nextAttachmentId = 1;

/** One page address row. The id keeps focus and errors on the right row as rows come and go. */
type PageRow = { id: number; value: string };
let nextPageId = 1;
const pageInputId = (id: number) => `page-${id}`;

/** Uploads run two at a time, so ten large files do not all fight for one connection. */
const UPLOADS_AT_ONCE = 2;
/** The longest a submit waits for files still uploading before it gives up on them. */
const UPLOAD_WAIT_MS = 10 * 60_000;

/* ── The validation banner ───────────────────────────────────────────────── */

const COUNT_WORDS = ["", "One", "Two", "Three", "Four", "Five", "Six"];

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
    // Three or more missing: the shorter form, no Oxford comma, and "below" closes it.
    // Three fit the banner's one line (492px at 13px), which the validation frame pins;
    // four to six (a page address or the email address wrong as well) wrap, which the frame
    // never draws.
    if (n >= 3) return { title, body: `${missing.slice(0, -1).map((m, i) => (i === 0 ? m.charAt(0).toUpperCase() + m.slice(1) : m)).join(", ")} and ${missing[n - 1]} below.` };
    const marked = n === 1 ? "The field is marked below." : "Both fields are marked below.";
    return { title, body: `${sentence}. ${marked}` };
};

/* ── The form ────────────────────────────────────────────────────────────── */

/** What the server says it stored besides the words: the success card shows exactly this, never what was typed. */
export interface SentExtras {
    urls: string[];
    /** The completion email address, when the server stored one (the switch decides). */
    notifyEmail: string | null;
    /** The stored file names, oldest first. */
    files: string[];
}

/** ticket-create's answer as the success card reads it. `files` may be missing from an older function. */
export const sentExtrasFrom = (res: { ticket: Ticket; files?: TicketFile[] }): SentExtras => ({
    urls: Array.isArray(res.ticket.urls) ? res.ticket.urls : [],
    notifyEmail: res.ticket.notify_email ?? null,
    files: (res.files ?? []).map((f) => f.name),
});

export interface RequestFormProps {
    /** Who is filling it in. The team picks a client; a client's is fixed and they pick a category. */
    mode: "client" | "team";
    /** The team's client list. */
    clients?: ClientOption[];
    /** The categories a client may choose from (client mode). Unused by the team form, which has no category. */
    topics: TicketTopic[];
    /** The topic tile the client arrived from: preselects the category. */
    fixedTopic?: TicketTopic;
    /** The client's own name, shown in the disabled Client field (client mode). */
    clientName: string;
    /** The signed-in address. A client's prefills the Completion email field; the staff composer's carries " (HiddenGem Media)", which is not an address, so staff start empty. */
    email: string;
    /** Whether the person at the screen is staff: the team form always is; in a client's help centre, a staff member viewing it. Decides whether the completion email field exists while the switch is "staff". */
    viewerIsStaff?: boolean;
    /** Called with the fields; the caller owns the API call so the server's gate stays theirs. */
    onSubmit: (input: NewTicketInput & { slug: string }) => Promise<{ reference: string; stored?: SentExtras }>;
    onCreated: (reference: string, slug: string, sent: { title: string; priority: Priority | null } & Partial<SentExtras>) => void;
    /** Kept for callers that listened for the team's client choice; the form no longer needs anything back. */
    onClientChange?: (slug: string) => void;
    /** "Report another ticket": the form mounts again and the first field takes focus. */
    focusFirstField?: boolean;
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const RequestForm = ({ mode, clients = [], topics, fixedTopic, clientName, email, viewerIsStaff, onSubmit, onCreated, onClientChange, slug, focusFirstField }: RequestFormProps) => {
    const team = mode === "team";
    const emailOpen = completionEmailOpen(COMPLETION_EMAIL_MODE, team || !!viewerIsStaff);
    const [client, setClient] = useState(team ? "" : (slug ?? ""));
    const [category, setCategory] = useState(fixedTopic?.key ?? "");
    const [priority, setPriority] = useState<PriorityLevel | null>(null);
    const [text, setText] = useState("");
    const [files, setFiles] = useState<Attachment[]>([]);
    const [fileError, setFileError] = useState("");
    const [pages, setPages] = useState<PageRow[]>(() => [{ id: nextPageId++, value: "" }]);
    const [pagesBlurred, setPagesBlurred] = useState<ReadonlySet<number>>(() => new Set());
    // A client's own address is the default most would choose: the email is about their
    // own request. Never a staff member's, and never the composer's display string.
    const [notify, setNotify] = useState(() => (!team && isEmailShape(email.trim()) && !isTeamAddress(email) ? email.trim().toLowerCase() : ""));
    const [notifyBlurred, setNotifyBlurred] = useState(false);
    const [busy, setBusy] = useState(false);
    const [waitingForFiles, setWaitingForFiles] = useState(false);
    const [touched, setTouched] = useState(false);
    const [error, setError] = useState("");
    const bannerRef = useRef<HTMLDivElement>(null);
    const formTitleRef = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        if (!focusFirstField) return;
        // The team's first field is the client select; a client's is the category.
        const first = document.getElementById(mode === "team" ? "client" : "category") as HTMLElement | null;
        (first ?? formTitleRef.current)?.focus();
        // Once, on mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const filesRef = useRef(files);
    const [fileNews, setFileNews] = useState("");
    filesRef.current = files;

    // One upload id per form session: the first grant mints it and every later file joins
    // it, so a request's files sit under one upload. The grants are asked for one after
    // another (each is quick) so the second file never starts a second upload id; the
    // bytes then go up two at a time.
    const uploadIdRef = useRef<string | null>(null);
    const grantChainRef = useRef<Promise<unknown>>(Promise.resolve());
    const queueRef = useRef<{ active: number; waiting: Array<() => Promise<void>> }>({ active: 0, waiting: [] });
    const mountedRef = useRef(true);
    // The files still on the list, by id, updated the moment one is added or removed (the
    // state catches up a render later, and an upload job may start before that render).
    const liveIdsRef = useRef(new Set<number>());
    // Upload progress lives outside state (createProgressStore): each row reads its own.
    const progressStore = useMemo(createProgressStore, []);

    // The client's composer replaces the help home in place, so focus moves into it (the
    // Category select: their Client field is disabled) and a keyboard or screen-reader
    // user is not left at the control that has just gone. The team's form is a page of
    // its own and loads like one.
    useEffect(() => {
        if (!team) document.getElementById("category")?.focus();
    }, [team]);

    // Object URLs are released when the form goes, and nothing still uploading may write
    // to a form that is no longer there.
    useEffect(
        () => () => {
            mountedRef.current = false;
            progressStore.stop();
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

    // The first page row that holds something that is not a web address.
    const pageProblem = useMemo(() => {
        for (const row of pages) {
            if (!row.value.trim()) continue;
            const checked = cleanUrl(row.value);
            if (!checked.ok) return { id: row.id, error: checked.error };
        }
        return null;
    }, [pages]);
    // Shown once the row has been left, or the form has been sent: never while typing.
    const pagesError = pageProblem && (touched || pagesBlurred.has(pageProblem.id)) ? pageProblem.error : undefined;
    const notifyChecked = cleanNotifyEmail(notify);
    const emailProblem = emailOpen && !notifyChecked.ok ? notifyChecked.error : "";
    const emailError = emailProblem && (touched || notifyBlurred) ? emailProblem : undefined;

    const clientMissing = team && !client;
    // Everyone picks a priority now (owner, 13 Sep 2026); the legend says what each means.
    const priorityMissing = !priority;
    const categoryMissing = !team && !category;
    const descriptionMissing = firstLine.length < 3;
    // The server keeps 140 characters of the first line as the title; rather than cut a
    // sentence mid-word on the way out, the form says so and waits.
    const titleTooLong = firstLine.length > MAX_TITLE;
    // In the order the fields sit on the form: the team's has no category, the client's
    // has category above priority, so the banner reads down the page either way. Pages and
    // the email address are optional: they are only named when what was typed is wrong.
    const missing = [
        clientMissing && "choose a client",
        categoryMissing && "choose a category",
        priorityMissing && "pick a priority",
        (descriptionMissing || titleTooLong) && "describe what is happening",
        pageProblem && "check the page address",
        emailProblem && "check the email address",
    ].filter((m): m is string => !!m);
    const banner = touched && missing.length ? composeBanner(missing) : null;

    /** Runs upload jobs, at most UPLOADS_AT_ONCE at a time. */
    const enqueue = useCallback((job: () => Promise<void>) => {
        const q = queueRef.current;
        q.waiting.push(job);
        const pump = () => {
            while (q.active < UPLOADS_AT_ONCE && q.waiting.length) {
                const next = q.waiting.shift()!;
                q.active += 1;
                void next().finally(() => {
                    q.active -= 1;
                    pump();
                });
            }
        };
        pump();
    }, []);

    /** A grant for one file, in turn with every other grant, so all share the first upload id. */
    const grantFor = useCallback(
        (file: { name: string; mime: string; bytes: number }) => {
            const job = grantChainRef.current.then(async () => {
                const res = await requestUploadUrls(team ? null : (slug ?? null), uploadIdRef.current, [file]);
                uploadIdRef.current = res.upload_id;
                const grant = res.files[0];
                if (!grant) throw new HelpApiError(0, fileUploadFailed(file.name));
                return { ...grant, bucket: res.bucket };
            });
            grantChainRef.current = job.catch(() => undefined);
            return job;
        },
        [team, slug],
    );

    const dropAttachment = (id: number, message: string) => {
        liveIdsRef.current.delete(id);
        if (!mountedRef.current) return;
        const gone = filesRef.current.find((f) => f.id === id);
        if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
        setFiles((prev) => prev.filter((f) => f.id !== id));
        if (gone) setFileError(message);
    };

    const addFiles = useCallback(
        (picked: File[]) => {
            setFileError("");
            const accepted: Array<{ att: Attachment; file: File; type: NonNullable<ReturnType<typeof fileTypeFor>> }> = [];
            let problem = "";
            let count = filesRef.current.length;
            for (const file of picked) {
                // The name decides what a file is (a HEIC from Chrome on Windows has no type),
                // then the count and the size.
                const type = fileTypeFor(file.name, file.type);
                if (!type) {
                    problem = fileTypeError(file.name);
                    continue;
                }
                if (count >= MAX_FILES) {
                    problem = fileCountError(file.name);
                    break;
                }
                if (file.size > MAX_FILE_BYTES) {
                    problem = fileSizeError(file.name);
                    continue;
                }
                count += 1;
                const image = type.kind === "image";
                accepted.push({
                    att: { id: nextAttachmentId++, name: file.name, size: file.size, previewUrl: image ? URL.createObjectURL(file) : null, badge: image ? null : type.label, status: "uploading", fileId: null },
                    file,
                    type,
                });
            }
            if (problem) setFileError(problem);
            if (!accepted.length) return;
            setFileNews(accepted.length === 1 ? `${accepted[0].att.name} added. Uploading.` : `${accepted.length} files added. Uploading.`);
            for (const a of accepted) liveIdsRef.current.add(a.att.id);
            setFiles((prev) => [...prev, ...accepted.map((a) => a.att)]);

            for (const { att, file, type } of accepted) {
                enqueue(async () => {
                    // Removed before its turn came: nothing to upload.
                    if (!liveIdsRef.current.has(att.id)) return;
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
                        if (!drawable && mountedRef.current) {
                            URL.revokeObjectURL(att.previewUrl);
                            setFiles((prev) => prev.map((f) => (f.id === att.id ? { ...f, previewUrl: null } : f)));
                        }
                    }
                    try {
                        const blob = await prepareUploadBlob(file, type);
                        // The same decision ticket-upload-url makes, from the bytes about to go.
                        if (!uploadTypeFor(file.name, blob.type)) throw new HelpApiError(0, fileTypeError(file.name));
                        const grant = await grantFor({ name: file.name, mime: blob.type, bytes: blob.size });
                        if (!liveIdsRef.current.has(att.id)) return;
                        // A failure names the file as its row does (the picked name), not the
                        // stored one: "photo.png did not upload", never "photo.webp".
                        await uploadTicketFile({ ...grant, name: att.name }, blob, (sent, total) => {
                            if (total > 0) progressStore.set(att.id, sent / total);
                        });
                        if (!mountedRef.current) return;
                        setFiles((prev) => prev.map((f) => (f.id === att.id ? { ...f, status: "uploaded", fileId: grant.file_id } : f)));
                        setFileNews(`${att.name} uploaded.`);
                    } catch (err) {
                        dropAttachment(att.id, err instanceof HelpApiError && err.message ? err.message : fileUploadFailed(att.name));
                    }
                });
            }
        },
        // dropAttachment only touches refs and setters.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [enqueue, grantFor, progressStore],
    );

    const removeFile = (id: number) => {
        setFileError("");
        const list = filesRef.current;
        const at = list.findIndex((f) => f.id === id);
        const gone = list[at];
        liveIdsRef.current.delete(id);
        if (gone) setFileNews(`${gone.name} removed.`);
        if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
        setFiles((prev) => prev.filter((f) => f.id !== id));
        // Focus follows the list: the next file's remove button, else the drop zone's
        // input, so a keyboard user is never dropped on the page body.
        const next = list[at + 1] ?? list[at - 1];
        setTimeout(() => {
            const target = next ? (document.querySelector(`[data-file-id="${next.id}"] button`) as HTMLElement | null) : (document.getElementById("files") as HTMLElement | null);
            target?.focus();
        }, 0);
    };

    const setPage = (id: number, value: string) => setPages((prev) => prev.map((p) => (p.id === id ? { ...p, value } : p)));
    const addPage = () => {
        if (pages.length >= MAX_URLS) return;
        const id = nextPageId++;
        setPages((prev) => [...prev, { id, value: "" }]);
        setTimeout(() => document.getElementById(pageInputId(id))?.focus(), 0);
    };
    const removePage = (id: number) => {
        const at = pages.findIndex((p) => p.id === id);
        const next = pages[at + 1] ?? pages[at - 1];
        setPages((prev) => prev.filter((p) => p.id !== id));
        // Focus stays in the list: the row that took this one's place, else the one before.
        setTimeout(() => (next ? document.getElementById(pageInputId(next.id)) : document.getElementById("add-page"))?.focus(), 0);
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
            // A file picked a moment ago may still be uploading; the send waits for it
            // rather than leaving it behind, and says so.
            const started = Date.now();
            if (filesRef.current.some((f) => f.status !== "uploaded")) setWaitingForFiles(true);
            while (filesRef.current.some((f) => f.status !== "uploaded") && Date.now() - started < UPLOAD_WAIT_MS) await sleep(200);
            setWaitingForFiles(false);
            const stuck = filesRef.current.find((f) => f.status !== "uploaded");
            if (stuck) {
                removeFile(stuck.id);
                throw new HelpApiError(0, fileUploadFailed(stuck.name));
            }
            const uploaded = filesRef.current.filter((f) => f.fileId);
            const cleaned = cleanUrls(pages.map((p) => p.value));
            const address = emailOpen && notifyChecked.ok ? notifyChecked.email : null;
            const res = await onSubmit({
                slug: client,
                topic: team ? TEAM_TOPIC : category,
                title: firstLine.slice(0, MAX_TITLE),
                // A one-line request is its own description; the server requires one.
                detail: (rest || firstLine).slice(0, MAX_DETAIL),
                ...(priority ? { priority } : {}),
                ...(cleaned.ok && cleaned.urls.length ? { urls: cleaned.urls } : {}),
                ...(address ? { notify_email: address } : {}),
                ...(uploaded.length && uploadIdRef.current ? { upload_id: uploadIdRef.current, files: uploaded.map((f) => ({ file_id: f.fileId! })) } : {}),
            });
            sentSlugs.set(res.reference, client);
            onCreated(res.reference, client, { title: firstLine.slice(0, MAX_TITLE), priority, ...(res.stored ?? {}) });
        } catch (err) {
            setWaitingForFiles(false);
            setError(err instanceof HelpApiError ? err.message : "We could not send that just then. Nothing was lost. Try again.");
            setBusy(false);
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
            <FormHeading eyebrow={team ? "REPORTING SYSTEM" : "HELP CENTER"} title={team ? "Report a ticket" : "Raise a request"} lede={team ? "team" : "client"} titleRef={formTitleRef} />

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
                    aria-required
                    value={client}
                    onChange={(v) => {
                        setClient(v);
                        onClientChange?.(v);
                    }}
                    options={team ? clients.map((c) => ({ value: c.slug, label: c.name })) : [{ value: slug ?? "", label: clientName }]}
                    placeholder="Choose a client"
                    helper={team ? CLIENT_HELPER : OWN_CLIENT_HELPER}
                    error={touched && clientMissing ? CLIENT_ERROR : undefined}
                    disabled={!team}
                    className={SELECT_CURSOR}
                />

                {!team && (
                    <FieldSelect
                        id="category"
                        label="Category"
                        requirement="Required"
                        aria-required
                        value={category}
                        onChange={setCategory}
                        options={topics.map((t) => ({ value: t.key, label: t.label }))}
                        placeholder="Choose a category"
                        error={touched && categoryMissing ? CATEGORY_ERROR : undefined}
                        className={SELECT_CURSOR}
                    />
                )}
                {/* Priority, for the team and the client alike (owner, 13 Sep 2026: "I do not see
                    this part"). The dots inside the atoms' chips and legend are rounded with a clip-path,
                    which the parity proof (and any box-radius reader) sees as a square; the file draws
                    them as ellipses, so they get their radius here until PriorityDot carries it itself. */}
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

                <FieldUpload id="files" label="Files" requirement="Optional" attachedCount={files.length} onFiles={addFiles} error={fileError || undefined} />

                {/* Adds, uploads and removes are announced here; the list itself stays as drawn. */}
                <p aria-live="polite" className="sr-only">
                    {fileNews}
                </p>
                {files.length > 0 && (
                    <ul className="flex flex-col gap-2" aria-label="Attached files">
                        {files.map((f) => (
                            <UploadRow
                                key={f.id}
                                store={progressStore}
                                fileKey={f.id}
                                name={f.name}
                                meta={`${formatFileSize(f.size)} · ${f.status === "uploaded" ? "uploaded" : "uploading"}`}
                                previewUrl={f.previewUrl}
                                badge={f.badge ?? undefined}
                                busy={f.status !== "uploaded"}
                                onRemove={() => removeFile(f.id)}
                                className="[&_button]:cursor-pointer"
                                data-file-id={f.id}
                            />
                        ))}
                    </ul>
                )}

                <FieldTextarea
                    id="description"
                    label="Description"
                    requirement="Required"
                    aria-required
                    value={text}
                    onChange={(v) => setText(v.slice(0, MAX_DETAIL + MAX_TITLE))}
                    placeholder="What is happening, and where?"
                    helper={team ? DESCRIPTION_HELPER : CLIENT_DESCRIPTION_HELPER}
                    error={touched && descriptionMissing ? DESCRIPTION_ERROR : titleTooLong ? TITLE_TOO_LONG : undefined}
                />

                {/* Pages: one row to start, another on request (progressive disclosure), up to
                    ten. The first row's label is the field's; the rest are named by number, and
                    each row can go once there are two. Checked when a row is left, never while
                    typing, and the helper line carries the first wrong row's sentence. */}
                <div role="group" aria-labelledby="pages-label" className="flex flex-col gap-2">
                    <LabelRow id="pages-label" htmlFor={pageInputId(pages[0].id)} label="Pages" requirement="Optional" />
                    {pages.map((row, i) => (
                        // 16 between input and remove button, as on a File/Thumbnail: the
                        // button's 44px target reaches 2 past its 40px box, so targets stay
                        // well over 8 apart.
                        <div key={row.id} className="flex items-center gap-4">
                            <TextInput
                                id={pageInputId(row.id)}
                                type="url"
                                inputMode="url"
                                autoComplete="url"
                                spellCheck={false}
                                placeholder="https://"
                                value={row.value}
                                // The group is "Pages"; each row is its number, so the group
                                // and the first row are not both read as "Pages".
                                aria-label={`Page ${i + 1}`}
                                aria-describedby="pages-note"
                                invalid={!!pagesError && pageProblem?.id === row.id}
                                onChange={(e) => setPage(row.id, e.target.value)}
                                onBlur={() => {
                                    if (row.value.trim()) setPagesBlurred((prev) => new Set(prev).add(row.id));
                                }}
                            />
                            {pages.length > 1 && <RemoveButton label={row.value.trim() ? `Remove ${displayUrl(row.value.trim())}` : `Remove page ${i + 1}`} onClick={() => removePage(row.id)} />}
                        </div>
                    ))}
                    <FieldNote id="pages-note" helper={PAGES_HELPER} error={pagesError} live />
                    {pages.length < MAX_URLS && (
                        <Button id="add-page" variant="secondary" onClick={addPage} className="max-sm:w-full">
                            Add another URL
                        </Button>
                    )}
                </div>

                {emailOpen && (
                    <FieldInput
                        id="notify-email"
                        label="Completion email"
                        requirement="Optional"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        spellCheck={false}
                        placeholder="name@example.com"
                        value={notify}
                        onChange={setNotify}
                        onBlur={() => setNotifyBlurred(!!notify.trim())}
                        helper={EMAIL_HELPER}
                        error={emailError}
                        liveNote
                    />
                )}

                {error && (
                    <Banner kind="error" title="That did not send">
                        {error}
                    </Banner>
                )}

                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                        <Button type="submit" loading={busy} className={busy ? "max-sm:w-full" : "max-sm:w-full cursor-pointer"}>
                            {team ? "Submit ticket" : "Submit request"}
                        </Button>
                    </div>
                    {/* The submitting frame draws the sending line against the right edge of
                        the column on desktop (13:510); the resting trust line sits left. */}
                    <p className={cx("hc-t-body-helper text-center text-(--hc-text-tertiary)", busy ? "sm:text-right" : "sm:text-left")} role="status">
                        {busy ? (waitingForFiles ? WAITING_FOR_FILES : team ? SENDING_LINE : CLIENT_SENDING_LINE) : team ? TRUST_LINE : CLIENT_TRUST_LINE}
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
    /** The stored names of the files the request carries, oldest first. */
    files?: string[];
    /** The pages the request is about, as the server stored them. */
    urls?: string[];
    /** The address the completion email goes to, when the server stored one. */
    completionEmail?: string | null;
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
 *
 * Then what the request carried, each row only when there is something in it: Pages (one
 * address a line), Completion email, Files (one stored name a line). They echo the
 * SERVER's answer rather than the form, so a row can only say what was actually kept. The
 * priority chip carries no delivery estimate here (owner, 28 Sep 2026).
 */
export const RequestSent = ({ reference, title, clientName, priority, team, primary, secondary, slug, files = [], urls = [], completionEmail }: RequestSentProps) => {
    const pollSlug = slug ?? sentSlugs.get(reference) ?? "";
    const [asana, setAsana] = useState(team ? ASANA_PENDING : CLIENT_OWNER_PENDING);
    // Focus lands on the outcome's title so a reader hears it (build notes).
    const sentTitleRef = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        sentTitleRef.current?.focus();
    }, []);

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
                // An owner is an owner even when the staff registry gave no display name:
                // the mailbox stands in, capitalised, rather than waiting two minutes.
                const name = (res.ticket.assignee_name ?? "").trim();
                const mailbox = (res.ticket.assignee_email ?? "").trim().split("@")[0] ?? "";
                const owner = name || (mailbox ? mailbox.charAt(0).toUpperCase() + mailbox.slice(1) : "");
                if (owner || res.ticket.status === "assigned" || res.ticket.status === "in_progress") {
                    setAsana(owner ? `Assigned to ${owner}` : "Assigned to the team");
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
            // Two minutes without an owner: stop pretending the task is being made this
            // second. The account manager is the person who resolves it either way.
            else setAsana((current) => (current === ASANA_PENDING || current === CLIENT_OWNER_PENDING ? "Your account manager will confirm the owner." : current));
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
            <FormHeading eyebrow={team ? "REPORTING SYSTEM" : "HELP CENTER"} title={team ? "Ticket sent" : "Request sent"} titleRef={sentTitleRef} />
            <Banner kind="success" title={team ? "Jarvis has it" : "The team has it"}>
                {team ? SUCCESS_BODY : clientSuccessBody(completionEmail)}
            </Banner>
            <div className="flex flex-col gap-4 rounded-(--hc-radius-xl) border border-(--hc-border-secondary) bg-(--hc-bg-secondary) p-[15px]">
                <p className="hc-t-body-input text-(--hc-text-primary)">{title}</p>
                <dl className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-4">
                        <dt className="hc-t-body-helper text-(--hc-text-tertiary)">{team ? "Ticket" : "Reference"}</dt>
                        <dd className="flex">
                            {/* A client's reference opens the request's own page, where its owner and
                                the team's updates will appear. The team's frame pins plain text. */}
                            {!team && pollSlug ? (
                                <Link
                                    to={`/${pollSlug}/help/requests/${reference}`}
                                    className="hc-hover relative rounded-(--hc-radius-sm) text-(--hc-text-brand-secondary) underline underline-offset-2 after:absolute after:inset-x-0 after:-inset-y-3 after:content-[''] hover:decoration-2"
                                >
                                    <MonoRef className="text-(--hc-text-brand-secondary)">{reference}</MonoRef>
                                    <span className="sr-only">, open the request</span>
                                </Link>
                            ) : (
                                <MonoRef className="text-(--hc-text-primary)">{reference}</MonoRef>
                            )}
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
                        <dt className="hc-t-body-helper text-(--hc-text-tertiary)">{team ? "Asana" : "Owner"}</dt>
                        <dd className="hc-t-label-field text-right text-(--hc-text-secondary)">
                            {/* The live region is the span, so the dd keeps its definition role. Keyed,
                                so the owner's arrival fades in (200ms, not under reduced motion). */}
                            <span role="status">
                                <span key={asana} className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
                                    {asana}
                                </span>
                            </span>
                        </dd>
                    </div>
                    {urls.length > 0 && (
                        <div className="flex items-start justify-between gap-4">
                            <dt className="hc-t-body-helper shrink-0 text-(--hc-text-tertiary)">Pages</dt>
                            <dd className="flex min-w-0 flex-col items-end gap-1">
                                {urls.map((u) => (
                                    <span key={u} className="hc-t-label-field max-w-full break-words text-(--hc-text-primary)">
                                        {displayUrl(u)}
                                    </span>
                                ))}
                            </dd>
                        </div>
                    )}
                    {completionEmail && (
                        <div className="flex items-center justify-between gap-4">
                            <dt className="hc-t-body-helper shrink-0 text-(--hc-text-tertiary)">Completion email</dt>
                            <dd className="hc-t-label-field min-w-0 text-right [overflow-wrap:anywhere] text-(--hc-text-primary)">{completionEmail}</dd>
                        </div>
                    )}
                    {files.length > 0 && (
                        <div className="flex items-start justify-between gap-4">
                            <dt className="hc-t-body-helper shrink-0 text-(--hc-text-tertiary)">Files</dt>
                            <dd className="flex min-w-0 flex-col items-end gap-1">
                                {files.map((name, i) => (
                                    <span key={`${i}-${name}`} className="hc-t-label-field max-w-full break-words text-(--hc-text-primary)">
                                        {name}
                                    </span>
                                ))}
                            </dd>
                        </div>
                    )}
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
