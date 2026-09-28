import { useEffect, useRef, useState } from "react";
import { DotsGrid, Edit01, Plus } from "@untitledui/icons";
import { AnimatePresence, Reorder, motion, useDragControls } from "motion/react";
import { Button } from "@/components/base/buttons/button";
import { Select } from "@/components/base/select/select";
import { cx } from "@/utils/cx";
import { type DirectoryPrompt, type PromptSection, newId } from "./directory-model";
import { ConfirmButton, CopyButton, DirectoryModal, Eyebrow, FAST, Field, SOFT, inputClass, invalidInputClass } from "./directory-ui";

/** Prompt text beyond this height is clipped behind a "Show full prompt" toggle. */
const CLAMP_PX = 224;

const PromptCard = ({ prompt, editing, onEdit }: { prompt: DirectoryPrompt; editing: boolean; onEdit: () => void }) => {
    const pre = useRef<HTMLPreElement>(null);
    const [long, setLong] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        const el = pre.current;
        if (el) setLong(el.scrollHeight > CLAMP_PX + 2);
    }, [prompt.text]);

    const clipped = long && !expanded;
    return (
        <motion.article
            layout="position"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4, transition: FAST }}
            transition={SOFT}
            className="overflow-hidden rounded-xl border border-secondary bg-primary"
        >
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
                <div className="min-w-0">
                    <h3 className="text-md font-semibold text-primary">{prompt.title}</h3>
                    {prompt.use && <p className="mt-0.5 text-sm text-tertiary">{prompt.use}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    {editing && (
                        <button
                            type="button"
                            onClick={onEdit}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-secondary bg-primary px-2.5 text-xs font-medium text-secondary shadow-xs transition duration-100 ease-linear hover:bg-secondary"
                        >
                            <Edit01 className="size-3.5" aria-hidden="true" />
                            Edit
                        </button>
                    )}
                    <CopyButton text={prompt.text} label="Copy prompt" />
                </div>
            </div>
            <div className="border-t border-secondary bg-secondary">
                {/* The clip opens and closes on max-height, as the original page did: no measuring race on first paint. */}
                <div className="relative">
                    <pre
                        ref={pre}
                        className={cx(
                            "m-0 overflow-hidden px-5 py-4 font-mono text-[13px] leading-[21px] whitespace-pre-wrap text-secondary transition-[max-height] duration-[360ms] ease-[cubic-bezier(.2,.8,.2,1)]",
                            expanded ? "max-h-[1200px]" : "max-h-56",
                        )}
                    >
                        {prompt.text}
                    </pre>
                    <span
                        aria-hidden="true"
                        className={cx(
                            "pointer-events-none absolute inset-x-0 bottom-0 h-16 transition-opacity duration-200",
                            clipped ? "opacity-100" : "opacity-0",
                        )}
                        style={{ background: "linear-gradient(transparent, var(--color-bg-secondary))" }}
                    />
                </div>
                {long && (
                    <div className="flex justify-center border-t border-secondary py-2">
                        <button type="button" onClick={() => setExpanded((v) => !v)} className="text-xs font-medium text-brand-secondary hover:underline">
                            {expanded ? "Show less" : "Show full prompt"}
                        </button>
                    </div>
                )}
            </div>
        </motion.article>
    );
};

const PromptEditor = ({
    prompt,
    sectionId,
    sections,
    onClose,
    onSave,
    onDelete,
}: {
    prompt?: DirectoryPrompt;
    sectionId: string;
    sections: PromptSection[];
    onClose: () => void;
    onSave: (prompt: DirectoryPrompt, sectionId: string) => Promise<void>;
    onDelete?: () => Promise<void>;
}) => {
    const [title, setTitle] = useState(prompt?.title ?? "");
    const [use, setUse] = useState(prompt?.use ?? "");
    const [text, setText] = useState(prompt?.text ?? "");
    const [section, setSection] = useState(sectionId);
    const [errors, setErrors] = useState<{ title?: string; text?: string; form?: string }>({});
    const [busy, setBusy] = useState(false);
    const items = sections.map((s) => ({ id: s.id, label: s.title, supportingText: `${s.prompts.length} prompt${s.prompts.length === 1 ? "" : "s"}` }));

    const submit = async () => {
        const errs: typeof errors = {};
        if (!title.trim()) errs.title = "Give the prompt a title.";
        if (!text.trim()) errs.text = "The prompt text is empty.";
        if (errs.title || errs.text) {
            setErrors(errs);
            return;
        }
        const rec: DirectoryPrompt = { id: prompt?.id ?? newId(title, "prompt"), title: title.trim(), text: text.replace(/\s+$/, "") };
        if (use.trim()) rec.use = use.trim();
        setBusy(true);
        setErrors({});
        try {
            await onSave(rec, section);
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

    return (
        <DirectoryModal
            title={prompt ? "Edit prompt" : "Add prompt"}
            subtitle="Saved to the prompt library for everyone."
            onClose={onClose}
            width="max-w-2xl"
            footer={
                <>
                    <div>
                        {prompt && onDelete && (
                            <ConfirmButton label="Delete prompt" armedLabel="Delete for everyone?" onConfirm={() => void remove()} disabled={busy} />
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button size="md" color="secondary" onClick={onClose} isDisabled={busy}>
                            Cancel
                        </Button>
                        <Button size="md" onClick={() => void submit()} isLoading={busy} showTextWhileLoading>
                            {prompt ? "Save changes" : "Add prompt"}
                        </Button>
                    </div>
                </>
            }
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Title" error={errors.title}>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => {
                            setTitle(e.target.value);
                            if (errors.title) setErrors((er) => ({ ...er, title: undefined }));
                        }}
                        placeholder="e.g. Channel landing pages"
                        autoFocus
                        aria-label="Title"
                        aria-invalid={!!errors.title}
                        className={cx(inputClass, errors.title && invalidInputClass)}
                    />
                </Field>
                <Select label="Section" items={items} selectedKey={section} onSelectionChange={(key) => key != null && setSection(String(key))}>
                    {(item) => (
                        <Select.Item id={item.id} supportingText={item.supportingText}>
                            {item.label}
                        </Select.Item>
                    )}
                </Select>
            </div>
            <Field label="What it's for" optional className="mt-4">
                <input
                    type="text"
                    value={use}
                    onChange={(e) => setUse(e.target.value)}
                    placeholder="One line so the team knows when to use it"
                    aria-label="What it's for"
                    className={inputClass}
                />
            </Field>
            <Field label="Prompt" error={errors.text} className="mt-4">
                <textarea
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value);
                        if (errors.text) setErrors((er) => ({ ...er, text: undefined }));
                    }}
                    rows={10}
                    placeholder="Paste or write the prompt"
                    aria-label="Prompt"
                    aria-invalid={!!errors.text}
                    className={cx(inputClass, "min-h-[220px] resize-y font-mono text-[13px] leading-[21px]", errors.text && invalidInputClass)}
                />
            </Field>
            {errors.form && (
                <p className="mt-4 text-sm text-error-primary" role="alert">
                    {errors.form}
                </p>
            )}
        </DirectoryModal>
    );
};

const SectionEditor = ({
    section,
    sections,
    onClose,
    onSave,
    onDelete,
}: {
    section?: PromptSection;
    sections: PromptSection[];
    onClose: () => void;
    onSave: (title: string) => Promise<void>;
    onDelete?: () => Promise<void>;
}) => {
    const [title, setTitle] = useState(section?.title ?? "");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const n = section?.prompts.length ?? 0;

    const submit = async () => {
        const t = title.trim();
        if (!t) {
            setError("Give the section a name.");
            return;
        }
        if (sections.some((s) => s.title.toLowerCase() === t.toLowerCase() && s.id !== section?.id)) {
            setError("A section with this name already exists.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            await onSave(t);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not save. Try again in a moment.");
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!onDelete) return;
        setBusy(true);
        try {
            await onDelete();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not delete. Try again in a moment.");
            setBusy(false);
        }
    };

    return (
        <DirectoryModal
            title={section ? "Rename section" : "Add section"}
            subtitle="Sections group related prompts on the Prompts page."
            onClose={onClose}
            width="max-w-md"
            footer={
                <>
                    <div>
                        {section && onDelete && (
                            <ConfirmButton
                                label="Delete section"
                                armedLabel={n ? `Delete with its ${n} prompt${n === 1 ? "" : "s"}?` : "Delete section?"}
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
                            {section ? "Save" : "Add section"}
                        </Button>
                    </div>
                </>
            }
        >
            <Field label="Section name" error={error}>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                        setTitle(e.target.value);
                        if (error) setError("");
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") void submit();
                    }}
                    placeholder="e.g. Video prompts"
                    autoFocus
                    aria-label="Section name"
                    aria-invalid={!!error}
                    className={cx(inputClass, error && invalidInputClass)}
                />
            </Field>
        </DirectoryModal>
    );
};

/** One section and its prompts. In edit mode the grip drags it into a new place; arrow keys on the grip do the same. */
const SectionCard = ({
    section,
    editing,
    onMove,
    onDrop,
    onRename,
    onAddPrompt,
    onEditPrompt,
}: {
    section: PromptSection;
    editing: boolean;
    onMove: (delta: -1 | 1) => void;
    onDrop: () => void;
    onRename: () => void;
    onAddPrompt: () => void;
    onEditPrompt: (prompt: DirectoryPrompt) => void;
}) => {
    const controls = useDragControls();
    return (
        <Reorder.Item
            data-pop
            as="section"
            value={section}
            dragListener={false}
            dragControls={controls}
            onDragEnd={onDrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: FAST }}
            transition={SOFT}
            whileDrag={{ scale: 1.01, zIndex: 5, boxShadow: "0 30px 70px -24px rgba(0, 0, 0, 0.35)" }}
            className="relative rounded-2xl border border-secondary bg-primary p-6 shadow-xs"
        >
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-secondary pb-5">
                <div className="flex items-center gap-2">
                    {editing && (
                        <button
                            type="button"
                            aria-label={`Reorder ${section.title}. Drag it, or use the arrow keys.`}
                            title="Drag to reorder"
                            onPointerDown={(e) => {
                                e.preventDefault();
                                controls.start(e);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                                    e.preventDefault();
                                    onMove(e.key === "ArrowUp" ? -1 : 1);
                                }
                            }}
                            className="-ml-2 flex h-10 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-quaternary transition duration-100 ease-linear hover:bg-secondary hover:text-primary active:cursor-grabbing"
                        >
                            <DotsGrid className="size-4" aria-hidden="true" />
                        </button>
                    )}
                    <div>
                        <Eyebrow>Section</Eyebrow>
                        <h3 className="mt-1 flex items-center gap-2 text-xl font-semibold text-primary">
                            {section.title}
                            {editing && (
                                <button
                                    type="button"
                                    aria-label={`Rename ${section.title}`}
                                    onClick={onRename}
                                    className="flex size-7 items-center justify-center rounded-md text-quaternary transition duration-100 ease-linear hover:bg-secondary hover:text-primary"
                                >
                                    <Edit01 className="size-3.5" aria-hidden="true" />
                                </button>
                            )}
                        </h3>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-tertiary">
                        {section.prompts.length} prompt{section.prompts.length === 1 ? "" : "s"}
                    </span>
                    {editing && (
                        <Button size="sm" iconLeading={Plus} onClick={onAddPrompt}>
                            Add prompt
                        </Button>
                    )}
                </div>
            </div>
            <div className="mt-5 flex flex-col gap-4">
                <AnimatePresence initial={false}>
                    {section.prompts.length ? (
                        section.prompts.map((p) => <PromptCard key={p.id} prompt={p} editing={editing} onEdit={() => onEditPrompt(p)} />)
                    ) : (
                        <motion.p
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={FAST}
                            className="text-sm text-tertiary"
                        >
                            No prompts in this section yet.
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>
        </Reorder.Item>
    );
};

/**
 * The prompt library: sections of prompts the team pastes into their tools, each a click from
 * the clipboard. In edit mode prompts and sections can be added, changed and deleted, and a
 * section drags into a new place by its grip, the others sliding out of the way.
 */
export const PromptLibrary = ({
    sections,
    editing,
    onChange,
}: {
    sections: PromptSection[];
    editing: boolean;
    onChange: (next: PromptSection[]) => Promise<void>;
}) => {
    const [promptEditor, setPromptEditor] = useState<{ prompt?: DirectoryPrompt; sectionId: string } | null>(null);
    const [sectionEditor, setSectionEditor] = useState<{ section?: PromptSection } | null>(null);
    // The order on screen while a section is being dragged; it becomes the saved order on drop.
    const [order, setOrder] = useState(sections);
    useEffect(() => setOrder(sections), [sections]);

    const clone = () => sections.map((s) => ({ ...s, prompts: s.prompts.map((p) => ({ ...p })) }));

    const savePrompt = async (rec: DirectoryPrompt, targetId: string) => {
        const next = clone();
        const fromId = promptEditor?.sectionId;
        let fromIndex = -1;
        for (const s of next) {
            if (s.id === fromId) fromIndex = s.prompts.findIndex((p) => p.id === rec.id);
            s.prompts = s.prompts.filter((p) => p.id !== rec.id);
        }
        const dest = next.find((s) => s.id === targetId) ?? next[0];
        if (!dest) return;
        // An edited prompt keeps its place in its section; a moved or new one goes to the end.
        if (promptEditor?.prompt && targetId === fromId && fromIndex >= 0) dest.prompts.splice(fromIndex, 0, rec);
        else dest.prompts.push(rec);
        await onChange(next);
        setPromptEditor(null);
    };

    const deletePrompt = async () => {
        const id = promptEditor?.prompt?.id;
        if (!id) return;
        const next = clone();
        for (const s of next) s.prompts = s.prompts.filter((p) => p.id !== id);
        await onChange(next);
        setPromptEditor(null);
    };

    const saveSection = async (title: string) => {
        const next = clone();
        const current = sectionEditor?.section;
        if (current) {
            const s = next.find((x) => x.id === current.id);
            if (s) s.title = title;
        } else next.push({ id: newId(title, "section"), title, prompts: [] });
        await onChange(next);
        setSectionEditor(null);
    };

    const deleteSection = async () => {
        const current = sectionEditor?.section;
        if (!current) return;
        await onChange(sections.filter((s) => s.id !== current.id));
        setSectionEditor(null);
    };

    const move = async (index: number, delta: -1 | 1) => {
        const j = index + delta;
        if (j < 0 || j >= sections.length) return;
        const next = clone();
        const [s] = next.splice(index, 1);
        next.splice(j, 0, s);
        await onChange(next);
    };

    /** A drop that changed the order saves it; one back where it started saves nothing. */
    const drop = () => {
        const same = order.length === sections.length && order.every((s, i) => s.id === sections[i].id);
        if (!same) void onChange(order);
    };

    return (
        <div className="flex flex-col gap-5">
            <div data-pop className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <Eyebrow>Prompts</Eyebrow>
                    <h2 className="mt-1 text-2xl font-semibold text-primary">Prompt library</h2>
                </div>
                {editing && (
                    <Button size="md" color="secondary" iconLeading={Plus} onClick={() => setSectionEditor({})}>
                        Add section
                    </Button>
                )}
            </div>

            {sections.length === 0 && <p className="text-sm text-tertiary">No sections yet. Unlock editing to add one.</p>}

            <Reorder.Group as="div" axis="y" values={order} onReorder={setOrder} className="flex flex-col gap-5">
                <AnimatePresence initial={false}>
                    {order.map((section, index) => (
                        <SectionCard
                            key={section.id}
                            section={section}
                            editing={editing}
                            onMove={(delta) => void move(index, delta)}
                            onDrop={drop}
                            onRename={() => setSectionEditor({ section })}
                            onAddPrompt={() => setPromptEditor({ sectionId: section.id })}
                            onEditPrompt={(p) => setPromptEditor({ prompt: p, sectionId: section.id })}
                        />
                    ))}
                </AnimatePresence>
            </Reorder.Group>

            <AnimatePresence>
                {promptEditor && (
                    <PromptEditor
                        key={promptEditor.prompt?.id ?? "new-prompt"}
                        prompt={promptEditor.prompt}
                        sectionId={promptEditor.sectionId}
                        sections={sections}
                        onClose={() => setPromptEditor(null)}
                        onSave={savePrompt}
                        onDelete={promptEditor.prompt ? deletePrompt : undefined}
                    />
                )}
                {sectionEditor && (
                    <SectionEditor
                        key={sectionEditor.section?.id ?? "new-section"}
                        section={sectionEditor.section}
                        sections={sections}
                        onClose={() => setSectionEditor(null)}
                        onSave={saveSection}
                        onDelete={sectionEditor.section && sections.length > 1 ? deleteSection : undefined}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};
