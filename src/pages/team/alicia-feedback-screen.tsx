import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Clock, Flag05, Image01, LayoutAlt01, MessageSmileCircle, Plus, Trash01, XClose } from "@untitledui/icons";
import { AppShell, CollapsedTopBar, IconRail, RailBottom, useNavCollapsed } from "@/components/application/icon-rail";
import { PriorityFlag, priorityRank, type QuestionPriority } from "@/components/application/priority-flag";
import { ImageLightbox } from "@/components/shared-assets/image-lightbox";
import { compressImageFile } from "@/utils/compress-image";
import { BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { TextArea } from "@/components/base/textarea/textarea";
import { useAuthUser } from "@/hooks/use-auth-user";
import { readSopPage, writeSopPage } from "@/lib/db-sync";
import { TeamGate } from "@/pages/team/dashboard-screen";
import { cx } from "@/utils/cx";

/**
 * /alicia-feedback — the running record of what Alicia asks for and what we did
 * about it.
 *
 * Alicia works in this page herself — the composer at the top is hers, for the
 * things she remembers after a call. That is why the copy addresses her directly
 * and never refers to her in the third person.
 *
 * Behind TeamGate, which admits any @hiddengem.media Google account, so she
 * needs no separate share link or password of her own. The gate also accepts the
 * team password, for the day sign-in is inconvenient.
 *
 * One `sop_pages` row (slug `alicia-feedback`) holds every entry, saved through
 * the same debounce-the-whole-blob pattern /questions uses. There is no second
 * store — an entry that only lived in this tab would be lost the moment the tab
 * closed, which defeats the point of writing it down.
 */

const SLUG = "alicia-feedback";

type Status = "open" | "done";
type Entry = {
    id: string;
    /** ISO date (YYYY-MM-DD) — the day it was asked, not the day it was recorded. */
    date: string;
    /** What was asked, in her words wherever we have them. */
    ask: string;
    /** What we actually did about it. Empty while it's still open. */
    did: string;
    status: Status;
    /** Email of whoever added it, when they were signed in. Blank for the seeded
     *  entries and for anyone who came through the team password. */
    by?: string;
    /** High / Medium / Low, set by clicking the flag. Unset is normal, not an
     *  error — most requests never need ranking. */
    priority?: QuestionPriority;
    /** Screenshots of the finished result, so Alicia can see the outcome instead of
     *  reading a description of it. Compressed to WebP data URLs by
     *  compressImageFile before they ever reach the row — this table stores base64,
     *  so an uncompressed screenshot would bloat every future read of the page. */
    images?: string[];
};
/** Loose row payload: keep any other keys a future version of this page adds. */
type PageData = { entries?: Entry[] } & Record<string, unknown>;

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Seeded on first load only, when the row doesn't exist yet — today's asks, as
 * they were made. Written straight to Supabase so the record survives the tab;
 * after that the row is the source of truth and this constant is never read
 * again, so editing an entry here changes nothing.
 */
const SEED: Entry[] = [
    {
        id: "seed-step4",
        date: "2026-09-02",
        ask: "What should we include in the onboarding dashboard? And add resources — step 4.",
        did: "Journey steps can now carry sub-items. Step 4 asks for the two things the post-Kick-off email asks for: join the Google Chat group, and upload photos/video to the content folder. Step 5 (Onboarding Call) gained a booking button and the pre-call checklist. The three URLs are per-client, edited together in a team-only Onboarding links block in Overview.",
        status: "done",
    },
    {
        id: "seed-facebook",
        date: "2026-09-02",
        ask: "For the client, we need them to be logged into their Facebook page so that they can add us as a user, but we do not want their specific Facebook login. We just need to make sure that they are logged in to their Facebook.",
        did: "The pre-call checklist reads “Logged in to your business page, so you can add us as a user. We never ask for your Facebook password.” The onboarding form's Facebook credential question stays removed — same wording rule applied to Instagram, TikTok and Domain, which say “logged in” rather than asking for a password.",
        status: "done",
    },
    {
        id: "seed-calendly",
        date: "2026-09-02",
        ask: "How should the Onboarding Call booking link be sourced? (Asked for a recommendation.)",
        did: "Recommended and built a per-client field with no shared fallback: the email's link is the AM's own (calendly.com/alicia-hiddengem/onboarding), so one hardcoded URL would route every client to the same person, and deriving it from the `am` column needs a name→URL table maintained forever. Blank is safe — the client reads “Your Account Manager will send you a booking link”, the team reads “No booking link set”.",
        status: "done",
    },
    {
        id: "seed-html",
        date: "2026-09-02",
        ask: "Give me the HTML of step no. 4.",
        did: "Delivered a self-contained HTML preview of the step-4 card (light + dark), matching the shipped component.",
        status: "done",
    },
    {
        id: "seed-thispage",
        date: "2026-09-02",
        ask: "Record whatever I ask today on a page called Alicia-feedback.",
        did: "This page. Entries save to Supabase (sop_pages / alicia-feedback) as you type.",
        status: "done",
    },
];

export const AliciaFeedbackScreen = () => {
    const [entries, setEntries] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(true);
    const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
    const [draft, setDraft] = useState("");
    const [lightbox, setLightbox] = useState<string | null>(null);
    const { user } = useAuthUser();
    const { collapsed: navCollapsed, toggle: toggleNav } = useNavCollapsed();
    /** Every other key on the row, preserved so a save never drops what it didn't write. */
    const otherKeys = useRef<Record<string, unknown>>({});
    /**
     * The latest entries, readable synchronously. Every mutation below computes from
     * this rather than from the `entries` render closure: `addImages` reads it AFTER
     * awaiting compression, so a closure snapshot there would be seconds stale and
     * would silently overwrite whatever was typed while the image compressed. The
     * same staleness loses one of two updates landing in the same tick.
     */
    const entriesRef = useRef<Entry[]>([]);
    const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => {
        let alive = true;
        readSopPage(SLUG)
            .then((row) => {
                if (!alive) return;
                const data = (row?.data ?? {}) as PageData;
                const { entries: stored, ...rest } = data;
                otherKeys.current = rest;
                entriesRef.current = Array.isArray(stored) ? stored : SEED;
                setEntries(entriesRef.current);
                setLoading(false);
            })
            .catch(() => {
                // readSopPage throws when the row is missing — that's the first visit.
                // Seed it and write immediately, so today's asks aren't held in a tab.
                if (!alive) return;
                entriesRef.current = SEED;
                setEntries(SEED);
                setLoading(false);
                void writeSopPage(SLUG, { entries: SEED }).catch(() => setSaveState("error"));
            });
        return () => {
            alive = false;
        };
    }, []);

    /** Whole-blob debounced save, matching /questions. */
    const commit = (next: Entry[]) => {
        entriesRef.current = next;
        setEntries(next);
        setSaveState("saving");
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            writeSopPage(SLUG, { ...otherKeys.current, entries: next })
                .then(() => setSaveState("idle"))
                .catch(() => setSaveState("error"));
        }, 800);
    };

    const patch = (id: string, p: Partial<Entry>) => commit(entriesRef.current.map((e) => (e.id === id ? { ...e, ...p } : e)));
    const remove = (id: string) => commit(entriesRef.current.filter((e) => e.id !== id));
    /** The composer only files an entry that actually says something — a blank row
     *  in a shared log is noise someone else has to clean up. */
    const submitDraft = () => {
        const ask = draft.trim();
        if (!ask) return;
        commit([{ id: crypto.randomUUID(), date: today(), ask, did: "", status: "open", by: user?.email ?? "" }, ...entriesRef.current]);
        setDraft("");
    };

    const open = entries.filter((e) => e.status === "open").length;

    /* Display order IS the stored order. There is no automatic sort: Alicia can move
       any request up or down, and a sort that re-ran on every render would undo her
       arrangement the moment she made it. "Sort by priority" below is a one-press
       action instead — it rewrites the order once, and her moves stick after it. */
    const move = (id: string, dir: -1 | 1) => {
        const list = entriesRef.current;
        const i = list.findIndex((e) => e.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= list.length) return;
        const next = [...list];
        [next[i], next[j]] = [next[j], next[i]];
        commit(next);
    };

    /** High → Medium → Low → unset, keeping the current order within each rank. */
    const sortByPriority = () =>
        commit([...entriesRef.current].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)));

    /* Screenshots of the result. compressImageFile is mandatory here — the row is
       base64 in Supabase, and a raw 4MB screenshot would be re-downloaded in full
       every time anyone opened this page. */
    const addImages = async (id: string, files: FileList | null) => {
        if (!files?.length) return;
        setSaveState("saving");
        try {
            const urls = await Promise.all([...files].map((f) => compressImageFile(f)));
            const entry = entriesRef.current.find((e) => e.id === id);
            patch(id, { images: [...(entry?.images ?? []), ...urls] });
        } catch {
            setSaveState("error");
        }
    };

    const removeImage = (id: string, url: string) => {
        const entry = entriesRef.current.find((e) => e.id === id);
        patch(id, { images: (entry?.images ?? []).filter((u) => u !== url) });
    };

    /* The two per-entry fields. `ring-primary`, not `ring-secondary`, to match the house
       TextArea the composer uses — on a `bg-secondary` card in dark mode a secondary ring
       measures 1.18:1 against it, which is not a visible edge. Primary is the standard
       this design system uses for a field boundary everywhere else. */
    const field =
        "w-full resize-y rounded-lg bg-primary px-3 py-2 text-sm text-primary shadow-xs ring-1 ring-primary outline-none transition duration-100 ease-linear ring-inset placeholder:text-placeholder focus:ring-2 focus:ring-brand";

    return (
        <TeamGate>
            <AppShell
                className="flex flex-col"
                rail={!navCollapsed && <IconRail activeDept="docs" bottom={<RailBottom editing={false} onToggleEditing={() => {}} />} />}
                breadcrumb={[{ label: "Dashboard", to: "/dashboard", icon: LayoutAlt01 }, { label: "Alicia feedback" }]}
            >
                {navCollapsed && <CollapsedTopBar title="Alicia feedback" onExpand={toggleNav} />}
                <div className="flex min-h-0 flex-1 bg-secondary p-2">
                    <main className="flex-1 overflow-x-hidden overflow-y-auto rounded-lg bg-primary shadow-sm">
                        <div className="mx-auto flex max-w-[840px] flex-col gap-8 px-6 py-10 pb-24 md:px-10">
                            <div>
                                <div className="flex items-center gap-3">
                                    <span className="flex size-11 items-center justify-center rounded-xl bg-utility-brand-50 text-utility-brand-700">
                                        <MessageSmileCircle className="size-5" aria-hidden="true" />
                                    </span>
                                    <div className="min-w-0">
                                        <h1 className="text-display-xs font-semibold text-primary">Alicia feedback</h1>
                                        <p className="text-sm text-tertiary">{loading ? "Loading…" : `${entries.length} recorded · ${open} still open`}</p>
                                    </div>
                                </div>
                                <p className="mt-4 text-md text-pretty text-tertiary">
                                    Everything you've asked for, and what we did about it. Remember something later? Add it below — it lands at the top of the
                                    list and we pick it up from there. Everything saves as you type; there is no Save button.
                                </p>
                            </div>

                            {/* Alicia's composer. One box, one button: the thing she does most often
                                is add a request she just remembered, so that is the only thing this
                                asks of her. Date and status are filled in for her, and "what we did"
                                stays empty until we've actually done it. */}
                            <div className="rounded-2xl bg-secondary p-4 ring-1 ring-secondary sm:p-5">
                                <TextArea
                                    label="Remembered something? Add it here."
                                    aria-label="Add a request"
                                    rows={3}
                                    value={draft}
                                    isDisabled={loading}
                                    placeholder="e.g. the Onboarding Call checklist should mention installing Zoom before the call"
                                    onChange={setDraft}
                                    onKeyDown={(ev) => {
                                        // Enter files it, Shift+Enter is a new line. A request is usually
                                        // one sentence, and reaching for the mouse for every one of them
                                        // is how a log stops getting used.
                                        if (ev.key === "Enter" && !ev.shiftKey) {
                                            ev.preventDefault();
                                            submitDraft();
                                        }
                                    }}
                                    textAreaClassName="min-h-24"
                                />
                                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                    <span className="text-xs text-quaternary">Enter to add · Shift + Enter for a new line</span>
                                    <div className="flex items-center gap-3">
                                        <span className={cx("text-xs", saveState === "error" ? "text-error-primary" : "text-quaternary")}>
                                            {saveState === "saving"
                                                ? "Saving…"
                                                : saveState === "error"
                                                  ? "Couldn't save — your last edit is not stored. Check your connection."
                                                  : "Saved"}
                                        </span>
                                        <Button size="sm" iconLeading={Plus} onClick={submitDraft} isDisabled={loading || !draft.trim()}>
                                            Add
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {loading ? (
                                <div className="flex h-48 items-center justify-center">
                                    <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent opacity-60" />
                                </div>
                            ) : entries.length === 0 ? (
                                <p className="rounded-2xl bg-secondary px-5 py-8 text-center text-sm text-tertiary ring-1 ring-secondary">
                                    Nothing recorded yet. Add the first one in the box above.
                                </p>
                            ) : (
                                <>
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <p className="text-sm text-tertiary">
                                            The order is yours — move anything up or down with the arrows.
                                        </p>
                                        <Button size="sm" color="secondary" iconLeading={Flag05} onClick={sortByPriority}>
                                            Sort by priority
                                        </Button>
                                    </div>
                                    <ul className="grid list-none gap-4 p-0">
                                    {entries.map((e, i) => (
                                        <li
                                            key={e.id}
                                            className="rounded-2xl bg-primary p-5 shadow-xs ring-1 ring-secondary transition duration-100 ease-linear"
                                        >
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                                {/* Position in the list, so an ask can be pointed at by number in a
                                                    call. The newest sits at 1, which means numbers shift down when
                                                    something new is added — the number names a place in the list,
                                                    not the entry itself. */}
                                                <span className="font-mono text-sm font-semibold text-quaternary tabular-nums">
                                                    {String(i + 1).padStart(2, "0")}
                                                </span>
                                                <PriorityFlag value={e.priority} onChange={(v) => patch(e.id, { priority: v })} />
                                                {e.status === "done" ? (
                                                    <BadgeWithDot color="success" size="sm" type="pill-color">
                                                        Done
                                                    </BadgeWithDot>
                                                ) : (
                                                    <BadgeWithDot color="brand" size="sm" type="pill-color">
                                                        Open
                                                    </BadgeWithDot>
                                                )}
                                                <input
                                                    type="date"
                                                    value={e.date}
                                                    onChange={(ev) => patch(e.id, { date: ev.target.value })}
                                                    className="rounded-lg bg-primary px-2 py-1 font-mono text-xs text-tertiary ring-1 ring-secondary outline-none focus:ring-brand"
                                                />
                                                {e.by && (
                                                    <span className="truncate text-xs text-quaternary" title={e.by}>
                                                        added by {e.by.split("@")[0]}
                                                    </span>
                                                )}
                                                <div className="ml-auto flex items-center gap-2">
                                                    {/* Reordering. Disabled at the ends rather than hidden, so the
                                                        controls don't move around as a card travels the list. */}
                                                    <Button
                                                        size="sm"
                                                        color="tertiary"
                                                        iconLeading={ArrowUp}
                                                        onClick={() => move(e.id, -1)}
                                                        isDisabled={i === 0}
                                                        aria-label={`Move request ${i + 1} up`}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        color="tertiary"
                                                        iconLeading={ArrowDown}
                                                        onClick={() => move(e.id, 1)}
                                                        isDisabled={i === entries.length - 1}
                                                        aria-label={`Move request ${i + 1} down`}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        color="secondary"
                                                        iconLeading={e.status === "done" ? Clock : Check}
                                                        onClick={() => patch(e.id, { status: e.status === "done" ? "open" : "done" })}
                                                    >
                                                        {e.status === "done" ? "Reopen" : "Mark done"}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        color="tertiary-destructive"
                                                        iconLeading={Trash01}
                                                        onClick={() => remove(e.id)}
                                                        aria-label="Delete this entry"
                                                    />
                                                </div>
                                            </div>

                                            <div className="mt-4 grid gap-4">
                                                <label className="grid gap-1.5">
                                                    <span className="text-xs font-semibold tracking-wide text-quaternary uppercase">The ask</span>
                                                    <textarea
                                                        rows={2}
                                                        value={e.ask}
                                                        placeholder="What was asked, in the words it was asked in"
                                                        onChange={(ev) => patch(e.id, { ask: ev.target.value })}
                                                        className={field}
                                                    />
                                                </label>
                                                <label className="grid gap-1.5">
                                                    <span className="text-xs font-semibold tracking-wide text-quaternary uppercase">What we did</span>
                                                    <textarea
                                                        rows={3}
                                                        value={e.did}
                                                        placeholder="Leave empty while it's still open"
                                                        onChange={(ev) => patch(e.id, { did: ev.target.value })}
                                                        className={field}
                                                    />
                                                </label>

                                                {/* The result, shown rather than described. Thumbnails open full
                                                    size in the lightbox; the remove button only appears on hover
                                                    so the strip stays calm when it's just being looked at. */}
                                                <div className="grid gap-2">
                                                    <span className="text-xs font-semibold tracking-wide text-quaternary uppercase">
                                                        The result
                                                    </span>
                                                    {(e.images?.length ?? 0) > 0 && (
                                                        <ul className="flex list-none flex-wrap gap-2 p-0">
                                                            {e.images!.map((url, n) => (
                                                                <li key={url.slice(-40)} className="group relative">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setLightbox(url)}
                                                                        className="block size-24 overflow-hidden rounded-lg ring-1 ring-secondary transition duration-100 ease-linear hover:ring-brand"
                                                                    >
                                                                        <img
                                                                            src={url}
                                                                            alt={`Result ${n + 1} for request ${i + 1}`}
                                                                            className="size-full object-cover"
                                                                        />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeImage(e.id, url)}
                                                                        aria-label={`Remove result image ${n + 1}`}
                                                                        className="absolute -top-1.5 -right-1.5 hidden size-6 place-items-center rounded-full bg-primary text-fg-quaternary shadow-sm ring-1 ring-secondary transition duration-100 ease-linear group-hover:grid hover:text-fg-error-secondary"
                                                                    >
                                                                        <XClose className="size-3.5" aria-hidden="true" />
                                                                    </button>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                    <label className="w-fit cursor-pointer">
                                                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-secondary shadow-xs ring-1 ring-primary transition duration-100 ease-linear ring-inset hover:bg-primary_hover">
                                                            <Image01 className="size-4 text-fg-quaternary" aria-hidden="true" />
                                                            {(e.images?.length ?? 0) > 0 ? "Add another" : "Add a screenshot"}
                                                        </span>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            multiple
                                                            className="sr-only"
                                                            onChange={(ev) => {
                                                                void addImages(e.id, ev.target.files);
                                                                // Let the same file be picked again after a removal.
                                                                ev.target.value = "";
                                                            }}
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    </main>
                </div>
                <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} alt="Result screenshot" />
            </AppShell>
        </TeamGate>
    );
};
