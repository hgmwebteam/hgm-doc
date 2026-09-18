/*
 * Supabase migration (run once in SQL editor):
 *
 * create table if not exists owner_onboarding (
 *   session_id  text        primary key,
 *   credentials jsonb       default '{}'::jsonb,
 *   checklist   jsonb       default '{}'::jsonb,
 *   notes       jsonb       default '{}'::jsonb,
 *   updated_at  timestamptz default now()
 * );
 * alter table owner_onboarding enable row level security;
 * create policy "allow_all" on owner_onboarding for all using (true) with check (true);
 */

import { useEffect, useRef, useState } from "react";
import { Building07, CheckDone01, CloudBlank02, CreditCard01, Database01, Download01, Globe01, Mail01, Shield01, Users01 } from "@untitledui/icons";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { AppShell } from "@/components/application/icon-rail";
import { VideoAttach, VideoEmbed } from "@/components/application/video-block";
import { useTheme } from "@/providers/theme-provider";
import { compressImageFile } from "@/utils/compress-image";
import { cx } from "@/utils/cx";
import { supabase, type OwnerGuideMeta } from "@/lib/supabase";
import { readSopPage, writeSopPage } from "@/lib/db-sync";
import { dbLogger } from "@/lib/db-logger";
import { useEditShortcuts } from "@/hooks/use-edit-shortcuts";
import { useAuthUser } from "@/hooks/use-auth-user";

// ── Types ─────────────────────────────────────────────────────────

type LensPos = { x: number; y: number };
type SaveStatus = "idle" | "saving" | "saved" | "error" | "empty";
type CredSection = "none" | "pms" | "netlify" | "hosting" | "supabase" | "resend" | "stripe" | "domain" | "cloudflare" | "overview";

interface StepImage { id: string; src: string; lensPos?: LensPos }
interface Instruction { id?: string; text: string; image?: string; lensPos?: LensPos; locked?: boolean }

interface StepData {
    title: string;
    description: string;
    instructions: Instruction[];
    benefits?: string[];
    checklistLabels: [string, string][];
    images: StepImage[];
    video?: string;
    credSection: CredSection;
}

type Creds = Record<string, string>;
type Checklist = Record<string, boolean>;
type Notes = Record<string, string>;
interface OwnerData { credentials: Creds; checklist: Checklist; notes: Notes }

/**
 * Credential sections that render the uniform "Account User name + Password" form.
 * Includes the legacy section ids ("hosting", "stripe") used by guide content
 * saved before the simplification, so existing client guides keep their forms.
 */
const CRED_FORM_SECTIONS = ["pms", "netlify", "hosting", "supabase", "resend", "stripe", "domain", "cloudflare"];

/** User-resizable side menu — width persists per browser via localStorage. */
const SIDEBAR_WIDTH_KEY = "hgm_owner_sidebar_width";
const SIDEBAR_DEFAULT_WIDTH = 280;
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 440;

/** Some clients run more than one Stripe account (separate properties/brands).
 * Account 1 keeps the original unsuffixed keys for backward compatibility;
 * accounts 2+ append `_N`. */
const MAX_STRIPE_ACCOUNTS = 20;
const stripeKeys = (n: number) => ({
    pk: n === 1 ? "stripe_publishable_key" : `stripe_publishable_key_${n}`,
    sk: n === 1 ? "stripe_secret_key" : `stripe_secret_key_${n}`,
    wh: n === 1 ? "stripe_webhook_secret" : `stripe_webhook_secret_${n}`,
    // Title + note only ever get exposed in the UI for accounts 2+ (managed via
    // the "Additional Stripe accounts" popup) — account 1 stays a plain, unlabeled
    // primary account in the sidebar — but every account gets the same key shape.
    title: n === 1 ? "stripe_title" : `stripe_title_${n}`,
    note: n === 1 ? "stripe_note" : `stripe_note_${n}`,
});

/** Each service stores a `${section}_username` and `${section}_password` — except
 * Stripe, which stores per-account `stripe_publishable_key(_N)`, `stripe_secret_key(_N)`
 * and `stripe_webhook_secret(_N)` instead (API keys, not a login). */
function sectionFilledIn(credentials: Creds, sec: string): boolean {
    if (sec === "stripe") {
        for (let n = 1; n <= MAX_STRIPE_ACCOUNTS; n++) {
            const k = stripeKeys(n);
            if (credentials[k.pk]?.trim() || credentials[k.sk]?.trim() || credentials[k.wh]?.trim()) return true;
        }
        return false;
    }
    return !!(credentials[`${sec}_username`]?.trim() || credentials[`${sec}_password`]?.trim());
}

const CONTENT_KEY = "hgm_owner_content_v2";
const GUIDE_CONTENT_SLUG = "owner-guide-content";
/** The "Owner Guide Snapshot" — a protected Supabase copy of the complete
    9-step template (all services incl. PMS/Domain/Cloudflare). The revert button on
    the template restores from this row after steps get deleted by accident. */
const SNAPSHOT_SLUG = "owner-guide-content-snapshot";
const SESSION_KEY = "hgm_owner_session";

const uid = () => Math.random().toString(36).slice(2, 9);

function getOrCreateSession(): string {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
        id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : [uid(), uid(), uid()].join("-");
        localStorage.setItem(SESSION_KEY, id);
    }
    return id;
}

// ── Seed content ──────────────────────────────────────────────────

/**
 * Service steps added through the editor default to credSection "none", so they
 * never render a credential form. Infer the real section from the step title so
 * every service (incl. Resend / Cloudflare) shows the Account-login form.
 */
function inferSection(s: StepData): CredSection {
    if (s.credSection && s.credSection !== "none") return s.credSection;
    const t = (s.title ?? "").toLowerCase();
    if (/resend/.test(t)) return "resend";
    if (/cloudflare/.test(t)) return "cloudflare";
    if (/netlify/.test(t)) return "netlify";
    if (/supabase/.test(t)) return "supabase";
    if (/stripe/.test(t)) return "stripe";
    if (/\bpms\b|property management/.test(t)) return "pms";
    if (/domain|registrar/.test(t)) return "domain";
    return s.credSection ?? "none";
}

/** Convert legacy string instructions (and missing arrays) into the {text, image} shape. */
function normalizeSteps(steps: StepData[]): StepData[] {
    return steps.map((s) => ({
        ...s,
        credSection: inferSection(s),
        images: s.images ?? [],
        instructions: ((s.instructions ?? []) as (string | Instruction)[]).map((ins) =>
            typeof ins === "string"
                ? { id: uid(), text: ins }
                : { id: ins.id ?? uid(), text: ins.text ?? "", image: ins.image, lensPos: ins.lensPos, locked: ins.locked },
        ),
    }));
}

function seedContent(): StepData[] {
    return normalizeSteps([
        {
            title: "Welcome & Roles",
            credSection: "none",
            description: "This guide collects the logins for the handful of accounts that power your booking website. You — the business owner — own every account: your PMS, hosting, database, email, domain, and DNS. Your developer is only given access to configure them, never ownership.",
            benefits: [
                "You stay in control — every account is registered under your own name and email",
                "Secure by design — your logins are stored privately and can be changed at any time",
                "No lock-in — your developer can be swapped without ever losing an account",
            ],
            instructions: [
                "Confirm the accounts you'll need: PMS, Netlify, Supabase, Resend, your domain registrar, and Cloudflare",
                "Make sure each account is registered under your own business email so you keep full ownership",
                "Work through each step and enter the account user name and password so your developer can connect them",
            ],
            checklistLabels: [
                ["Confirm roles and accounts", "You'll own the PMS, Netlify, Supabase, Resend, domain, and Cloudflare accounts"],
                ["Gather your logins", "You have the user name and password ready for each account"],
            ],
            images: [],
        },
        {
            title: "Property Management System (PMS)",
            credSection: "pms",
            description: "Your PMS (Guesty, Hostaway, Lodgify, Hostfully, Smoobu, etc.) syncs availability, rates, and reservations to your direct booking website. Enter the account username and password you use to log in.",
            instructions: [
                "Open the login page for your PMS provider",
                "Enter the account user name (usually your email) and password you sign in with below",
                "Save — your developer uses this to connect the integration",
            ],
            checklistLabels: [
                ["Locate your PMS account login", "You know the account user name and password"],
                ["Enter and save your PMS login", "User name and password saved"],
            ],
            images: [],
        },
        {
            title: "Netlify Hosting",
            credSection: "netlify",
            description: "Netlify hosts your website code and serves the live site. Enter the account username and password you use to sign in at app.netlify.com.",
            instructions: [
                "Open app.netlify.com and find the account you sign in with",
                "Enter that user name (email) and password below",
                "Save — your developer uses this to manage deployments",
            ],
            checklistLabels: [
                ["Locate your Netlify account login", "You know the account user name and password"],
                ["Enter and save your Netlify login", "User name and password saved"],
            ],
            images: [],
        },
        {
            title: "Supabase Database",
            credSection: "supabase",
            description: "Supabase is the secure backend that stores your property details, reservations, and listing photos. Enter the account username and password you use to sign in at supabase.com.",
            instructions: [
                "Open supabase.com and find the account you sign in with",
                "Enter that user name (email) and password below",
                "Save — your developer uses this to manage your database",
            ],
            checklistLabels: [
                ["Locate your Supabase account login", "You know the account user name and password"],
                ["Enter and save your Supabase login", "User name and password saved"],
            ],
            images: [],
        },
        {
            title: "Resend Email",
            credSection: "resend",
            description: "Resend sends the transactional emails for your site — booking confirmations, lead notifications, and receipts. Enter the account username and password you use to sign in at resend.com.",
            instructions: [
                "Open resend.com and find the account you sign in with",
                "Enter that user name (email) and password below",
                "Save — your developer uses this to send emails from your domain",
            ],
            checklistLabels: [
                ["Locate your Resend account login", "You know the account user name and password"],
                ["Enter and save your Resend login", "User name and password saved"],
            ],
            images: [],
        },
        {
            title: "Domain Registrar",
            credSection: "domain",
            description: "Your domain registrar is where your web address is registered (GoDaddy, Namecheap, Google Domains, etc.). Enter the account username and password you use to sign in there.",
            instructions: [
                "Open the login page for the registrar where your domain is registered",
                "Enter the account user name (email) and password you sign in with below",
                "Save — your developer uses this to point the domain to your site",
            ],
            checklistLabels: [
                ["Locate your registrar account login", "You know the account user name and password"],
                ["Enter and save your registrar login", "User name and password saved"],
            ],
            images: [],
        },
        {
            title: "Cloudflare",
            credSection: "cloudflare",
            description: "Cloudflare manages your DNS and CDN — keeping the site fast and secure. Enter the account username and password you use to sign in at dash.cloudflare.com.",
            instructions: [
                "Open dash.cloudflare.com and find the account you sign in with",
                "Enter that user name (email) and password below",
                "Save — your developer uses this to manage DNS and security",
            ],
            checklistLabels: [
                ["Locate your Cloudflare account login", "You know the account user name and password"],
                ["Enter and save your Cloudflare login", "User name and password saved"],
            ],
            images: [],
        },
        {
            title: "Overview",
            credSection: "overview",
            description: "Review all the credentials you have entered. When everything looks correct, click Save — the guide will lock and all values will be partially hidden for security.",
            instructions: [],
            checklistLabels: [],
            images: [],
        },
    ] as unknown as StepData[]);
}

function loadContent(cacheKey: string): StepData[] {
    try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
            const d = JSON.parse(raw) as StepData[];
            if (Array.isArray(d) && d.length) return normalizeSteps(d);
        }
    } catch {}
    return seedContent();
}

function saveContent(steps: StepData[], cacheKey: string) {
    try { localStorage.setItem(cacheKey, JSON.stringify(steps)); } catch {}
}

function emptyOwner(): OwnerData { return { credentials: {}, checklist: {}, notes: {} }; }

// ── Supabase helpers ──────────────────────────────────────────────

async function dbLoad(sessionId: string): Promise<OwnerData> {
    try {
        const { data, error } = await supabase
            .from("owner_onboarding")
            .select("credentials, checklist, notes")
            .eq("session_id", sessionId)
            .maybeSingle();
        if (error || !data) return emptyOwner();
        return {
            credentials: (data.credentials as Creds) ?? {},
            checklist: (data.checklist as Checklist) ?? {},
            notes: (data.notes as Notes) ?? {},
        };
    } catch { return emptyOwner(); }
}

async function dbSave(sessionId: string, data: OwnerData): Promise<boolean> {
    try {
        const { error } = await supabase
            .from("owner_onboarding")
            .upsert({
                session_id: sessionId,
                credentials: data.credentials,
                checklist: data.checklist,
                notes: data.notes,
                updated_at: new Date().toISOString(),
            }, { onConflict: "session_id" });
        return !error;
    } catch { return false; }
}

// ── Masking (for locked overview) ────────────────────────────────

function maskHalf(val: string): string {
    if (!val) return "—";
    if (val.length <= 6) return "••••••••";
    const show = Math.ceil(val.length / 2);
    return val.slice(0, show) + "•".repeat(val.length - show);
}

// ── Image magnifier ───────────────────────────────────────────────

const LENS = 72, ZOOM = 1.3;

/** Exported for the client dashboard's Netlify guide pop-up, which shows the same screenshots read-only. */
export const ImageMagnifier = ({ src, editing, lensPos, onLensPosChange, onRemove }: {
    src: string; editing: boolean; lensPos?: LensPos;
    onLensPosChange?: (p: LensPos) => void; onRemove?: () => void;
}) => {
    const imgRef = useRef<HTMLImageElement>(null);
    const lbImgRef = useRef<HTMLImageElement>(null);
    const [dims, setDims] = useState({ w: 0, h: 0 });
    const [lbDims, setLbDims] = useState({ w: 0, h: 0 });
    const [lightbox, setLightbox] = useState(false);
    const [pos, setPos] = useState<LensPos>(lensPos ?? { x: 0.5, y: 0.5 });
    const posRef = useRef(pos);
    const drag = useRef<"thumb" | "lb" | null>(null);

    const applyPos = (p: LensPos) => { setPos(p); posRef.current = p; };
    const computePos = (el: HTMLImageElement | null, cx: number, cy: number) => {
        const r = el?.getBoundingClientRect();
        if (!r?.width) return;
        applyPos({ x: Math.max(0, Math.min(1, (cx - r.left) / r.width)), y: Math.max(0, Math.min(1, (cy - r.top) / r.height)) });
    };

    useEffect(() => {
        const mv = (e: MouseEvent) => {
            if (drag.current === "thumb") computePos(imgRef.current, e.clientX, e.clientY);
            else if (drag.current === "lb") computePos(lbImgRef.current, e.clientX, e.clientY);
        };
        const up = () => { if (drag.current) onLensPosChange?.(posRef.current); drag.current = null; };
        window.addEventListener("mousemove", mv);
        window.addEventListener("mouseup", up);
        return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
    }, []);

    useEffect(() => {
        if (!lightbox) return;
        const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(false); };
        window.addEventListener("keydown", esc);
        return () => window.removeEventListener("keydown", esc);
    }, [lightbox]);

    const lensStyle = (w: number, h: number): React.CSSProperties => ({
        position: "absolute", width: LENS, height: LENS,
        left: pos.x * w - LENS / 2, top: pos.y * h - LENS / 2,
        borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.9)",
        boxShadow: "0 0 0 1.5px rgba(0,0,0,0.18),0 3px 12px rgba(0,0,0,0.25)",
        backgroundImage: `url(${src})`,
        backgroundSize: `${w * ZOOM}px ${h * ZOOM}px`,
        backgroundPosition: `${-(pos.x * w * ZOOM - LENS / 2)}px ${-(pos.y * h * ZOOM - LENS / 2)}px`,
        backgroundRepeat: "no-repeat",
    });

    return (
        <>
            <div className="relative select-none">
                <img ref={imgRef} src={src} alt="reference"
                    className="block w-full cursor-zoom-in rounded-xl"
                    onLoad={() => { if (imgRef.current) setDims({ w: imgRef.current.offsetWidth, h: imgRef.current.offsetHeight }); }}
                    draggable={false} onClick={() => setLightbox(true)}
                />
                {dims.w > 0 && (
                    <div style={{ ...lensStyle(dims.w, dims.h), cursor: editing ? "grab" : "default" }}
                        onClick={e => e.stopPropagation()}
                        onMouseDown={editing ? e => { e.preventDefault(); drag.current = "thumb"; computePos(imgRef.current, e.clientX, e.clientY); } : undefined}
                    />
                )}
                {editing && onRemove && (
                    <button type="button" onClick={onRemove}
                        className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-lg bg-black/70 text-white hover:bg-black/90">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                )}
            </div>
            <AnimatePresence>
                {lightbox && (
                    <motion.div onClick={() => setLightbox(false)}
                        className="fixed inset-0 z-50 flex cursor-zoom-out justify-center overflow-y-auto bg-black/80 px-4 py-16 backdrop-blur-sm sm:px-10"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}>
                        {/* Full-width instead of shrink-to-fit — tall reference screenshots
                            stay readable and the overlay scrolls instead of squashing them
                            down to fit the viewport height. */}
                        <motion.div className="relative h-fit w-full max-w-5xl select-none" onClick={e => e.stopPropagation()}
                            initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 26 }}>
                            <img ref={lbImgRef} src={src} alt="full" className="block w-full rounded-xl shadow-2xl"
                                onLoad={() => { if (lbImgRef.current) setLbDims({ w: lbImgRef.current.offsetWidth, h: lbImgRef.current.offsetHeight }); }}
                                draggable={false}
                            />
                            {lbDims.w > 0 && (
                                <div style={{ ...lensStyle(lbDims.w, lbDims.h), cursor: "grab" }}
                                    onMouseDown={e => { e.preventDefault(); drag.current = "lb"; computePos(lbImgRef.current, e.clientX, e.clientY); }}
                                />
                            )}
                        </motion.div>
                        <button type="button" onClick={() => setLightbox(false)}
                            className="fixed right-6 top-6 flex size-10 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

/** One "step-by-step instruction" row — reordered via up/down arrows (not drag,
    which felt glitchy for this list). */
const InstructionRow = ({
    ins,
    index,
    isFirst,
    isLast,
    editing,
    onChangeText,
    onDelete,
    onToggleLock,
    onMoveUp,
    onMoveDown,
    onImageChange,
    onLensPosChange,
    onRemoveImage,
}: {
    ins: Instruction;
    index: number;
    isFirst: boolean;
    isLast: boolean;
    editing: boolean;
    onChangeText: (val: string) => void;
    onDelete: () => void;
    onToggleLock: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onLensPosChange: (p: LensPos) => void;
    onRemoveImage: () => void;
}) => {
    return (
        <div className="rounded-xl border border-secondary bg-primary px-4 py-3.5">
            <div className="flex items-start gap-3.5">
                {editing && (
                    <div className="mt-0.5 flex shrink-0 flex-col">
                        <button type="button"
                            title="Move up"
                            disabled={isFirst}
                            onClick={onMoveUp}
                            className="flex size-6 items-center justify-center rounded-md text-fg-quaternary transition hover:bg-primary_hover hover:text-fg-secondary disabled:cursor-not-allowed disabled:opacity-30">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
                        </button>
                        <button type="button"
                            title="Move down"
                            disabled={isLast}
                            onClick={onMoveDown}
                            className="flex size-6 items-center justify-center rounded-md text-fg-quaternary transition hover:bg-primary_hover hover:text-fg-secondary disabled:cursor-not-allowed disabled:opacity-30">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                        </button>
                    </div>
                )}
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[14px] font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                    {index + 1}
                </span>
                {editing ? (
                    <textarea value={ins.text}
                        onChange={e => onChangeText(e.target.value)}
                        rows={2} className="flex-1 resize-y bg-transparent text-[15px] leading-relaxed text-secondary outline-none"
                    />
                ) : (
                    <p className="flex-1 text-[15px] leading-relaxed text-secondary">{ins.text}</p>
                )}
                {editing && (
                    <button type="button"
                        title={ins.locked ? "Unlock instruction (allow delete)" : "Lock instruction (protect from delete)"}
                        onClick={onToggleLock}
                        className={cx(
                            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md transition",
                            ins.locked ? "text-brand-600 hover:bg-brand-50 dark:text-brand-400" : "text-fg-quaternary hover:bg-primary_hover hover:text-fg-secondary",
                        )}>
                        {ins.locked ? (
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                        ) : (
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 7.5-2" /></svg>
                        )}
                    </button>
                )}
                {editing && !ins.locked && (
                    <button type="button"
                        title="Delete instruction"
                        onClick={onDelete}
                        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-fg-quaternary transition hover:bg-error-primary hover:text-fg-error-primary">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                    </button>
                )}
            </div>

            {/* Per-instruction reference image with magnify circle — same left/right
                inset as the card's own padding, so it doesn't look off-center */}
            {ins.image ? (
                <div className="mt-3">
                    <ImageMagnifier
                        src={ins.image}
                        editing={editing}
                        lensPos={ins.lensPos}
                        onLensPosChange={onLensPosChange}
                        onRemove={onRemoveImage}
                    />
                </div>
            ) : editing ? (
                <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-primary px-3 py-1.5 text-[12px] font-medium text-tertiary transition hover:border-brand hover:text-brand-700">
                    <input type="file" accept="image/*" className="hidden" onChange={onImageChange} />
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                    Add image
                </label>
            ) : null}
        </div>
    );
};

// ── Credential field helpers ──────────────────────────────────────

const CredField = ({ label, placeholder, value, onChange }: {
    label: string; placeholder?: string; value: string; onChange: (v: string) => void;
}) => (
    <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-quaternary">{label}</label>
        <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? ""}
            className="w-full rounded-xl border border-secondary bg-primary px-3.5 py-2.5 text-[14px] text-primary outline-none transition duration-100 ease-linear focus:border-brand focus:ring-1 focus:ring-brand placeholder:text-placeholder"
        />
    </div>
);

const SecretField = ({ label, placeholder, value, onChange }: {
    label: string; placeholder?: string; value: string; onChange: (v: string) => void;
}) => {
    const [show, setShow] = useState(false);
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-quaternary">{label}</label>
            <div className="relative">
                <input type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? ""}
                    className="w-full rounded-xl border border-secondary bg-primary py-2.5 pl-3.5 pr-12 text-[14px] text-primary outline-none transition duration-100 ease-linear focus:border-brand focus:ring-1 focus:ring-brand placeholder:text-placeholder"
                />
                <button type="button" onClick={() => setShow(s => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 flex size-7 items-center justify-center rounded-lg bg-error-solid text-white transition hover:opacity-80">
                    {show
                        ? <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" /></svg>
                        : <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    }
                </button>
            </div>
        </div>
    );
};

const SaveActions = ({ status, label, onSave, onClear }: {
    status: SaveStatus; label: string; onSave: () => void; onClear: () => void;
}) => (
    <div className="flex items-center gap-3 pt-2">
        <button type="button" onClick={onSave} disabled={status === "saving"}
            className={cx(
                "rounded-xl px-5 py-2.5 text-[14px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50",
                status === "saved" ? "bg-success-solid" : "bg-brand-solid",
            )}>
            {status === "saving" ? "Saving…" : status === "saved" ? "✓ Saved!" : `Save ${label}`}
        </button>
        <button type="button" onClick={onClear}
            className="rounded-xl border border-error px-5 py-2.5 text-[14px] font-semibold text-error-primary transition hover:bg-error-primary">
            Clear
        </button>
        {status === "error" && <span className="text-[13px] text-error-primary">Save failed — check connection</span>}
        {status === "empty" && <span className="text-[13px] text-warning-primary">Fill in the form before saving</span>}
    </div>
);

// ── Overview credential row ───────────────────────────────────────

const OverviewRow = ({ label, value, locked }: { label: string; value: string; locked: boolean }) => (
    <div className="flex items-start justify-between gap-4 border-b border-secondary py-2.5 last:border-0">
        <span className="shrink-0 text-[12px] font-semibold uppercase tracking-[0.05em] text-quaternary">{label}</span>
        <span className={cx("text-right font-mono text-[13px] break-all", value ? "text-primary" : "text-placeholder")}>
            {/* On screen, locked values are masked (anti shoulder-surfing only — the full
                value is in this page's data regardless). The printed PDF is the team's
                credentials record, so print swaps in the full value. */}
            <span className={cx(locked && !!value && "print:hidden")}>{!value ? "—" : locked ? maskHalf(value) : value}</span>
            {locked && !!value && <span className="hidden print:inline">{value}</span>}
        </span>
    </div>
);

const OverviewSection = ({ num, title, label, icon: Icon, rows, locked }: { num: number; title: string; label?: string; icon?: typeof Database01; rows: { label: string; value: string }[]; locked: boolean }) => {
    const hasAny = rows.some(r => r.value);
    // Skip the subtitle when it's just a repeat of the heading (e.g. "Cloudflare" / "Cloudflare").
    const showSubtitle = !!label && title.trim().toLowerCase() !== label.trim().toLowerCase();
    return (
        <div className="overflow-hidden rounded-2xl border border-secondary bg-primary shadow-xs">
            <div className="flex items-center gap-3 border-b border-secondary px-4 py-3">
                {/* step number badge — matches the numbered sidebar so it's easy to cross-check */}
                <span className={cx(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold tabular-nums ring-1 ring-inset transition",
                    hasAny ? "bg-utility-green-50 text-utility-green-700 ring-utility-green-200" : "bg-secondary text-quaternary ring-secondary",
                )}>
                    {num}
                </span>
                {Icon && (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
                        <Icon className="size-4" aria-hidden="true" />
                    </span>
                )}
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-primary">{label || title}</p>
                    {showSubtitle && <p className="truncate text-[11px] text-quaternary">{title}</p>}
                </div>
                {hasAny
                    ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-utility-green-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-utility-green-700">
                        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                        Submitted
                    </span>
                    : <span className="shrink-0 rounded-full bg-tertiary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-quaternary">Empty</span>
                }
            </div>
            <div className="px-4">
                {rows.map((r, i) => <OverviewRow key={i} label={r.label} value={r.value} locked={locked} />)}
            </div>
        </div>
    );
};

// ── Sidebar ───────────────────────────────────────────────────────

const CRED_SECTION_LABEL: Record<CredSection, string> = {
    none: "", pms: "PMS", netlify: "Netlify", hosting: "Netlify", supabase: "Supabase", resend: "Resend", stripe: "Stripe", domain: "Domain", cloudflare: "Cloudflare", overview: "Overview",
};

/** Small service icon shown to the left of each step's title (page header). */
const STEP_ICON: Record<CredSection, typeof Database01> = {
    none: Users01, pms: Building07, netlify: CloudBlank02, hosting: CloudBlank02, supabase: Database01,
    resend: Mail01, stripe: CreditCard01, domain: Globe01, cloudflare: Shield01, overview: CheckDone01,
};

const Sidebar = ({
    steps, credentials, visited, currentStep, editing,
    onSelect, onMoveStep, onDeleteStep, onAddStep, onNavigateOverview,
    isTemplate, hiddenSteps, onToggleStepHidden,
    canShare, sharePassword, showSharePw, onToggleSharePw, onCopyShareLink, shareCopied,
    canCreate, onCreate, showTemplateHint, onDismissTemplateHint,
}: {
    steps: StepData[];
    credentials: Creds;
    visited: Set<number>;
    currentStep: number;
    editing: boolean;
    onSelect: (i: number) => void;
    onMoveStep: (from: number, dir: -1 | 1) => void;
    /** Template only — actually deletes the step for everyone. */
    onDeleteStep: (i: number) => void;
    onAddStep: () => void;
    onNavigateOverview: () => void;
    /** True only for the bare /owner-guide master template. */
    isTemplate: boolean;
    /** credSections this specific client guide has hidden — always empty for the template. */
    hiddenSteps: string[];
    /** Client guides only — hides/restores a step for THIS client without touching the template. */
    onToggleStepHidden: (credSection: string) => void;
    /** Share controls (password + copy link) only apply to a real client guide. */
    canShare: boolean;
    sharePassword: string | null;
    showSharePw: boolean;
    onToggleSharePw: () => void;
    onCopyShareLink: () => void;
    shareCopied: boolean;
    /** "Create Owner Guide" action — team / template only. */
    canCreate: boolean;
    onCreate: () => void;
    /** Template hint — nested in-flow above the bottom controls so it aligns with the
     * sidebar's own width/padding instead of floating as a fixed-position popup. */
    showTemplateHint: boolean;
    onDismissTemplateHint: () => void;
}) => {
    const { theme, setTheme } = useTheme();
    const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    // Resizable width — drag the handle on the right edge; persists per browser.
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
        return saved >= SIDEBAR_MIN_WIDTH && saved <= SIDEBAR_MAX_WIDTH ? saved : SIDEBAR_DEFAULT_WIDTH;
    });
    const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!dragRef.current) return;
            const next = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, dragRef.current.startWidth + (e.clientX - dragRef.current.startX)));
            setSidebarWidth(next);
        };
        const onUp = () => {
            if (!dragRef.current) return;
            dragRef.current = null;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            setSidebarWidth(w => { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w)); return w; });
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    }, []);

    const startResize = (e: React.MouseEvent) => {
        e.preventDefault();
        dragRef.current = { startX: e.clientX, startWidth: sidebarWidth };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    };

    const resetWidth = () => {
        setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(SIDEBAR_DEFAULT_WIDTH));
    };

    // Progress = filled credential forms out of total forms (excluding steps this client has hidden).
    const formSteps = steps.filter(s => CRED_FORM_SECTIONS.includes(s.credSection) && !hiddenSteps.includes(s.credSection));
    const filledForms = formSteps.filter(s => sectionFilledIn(credentials, s.credSection)).length;
    const progress = formSteps.length === 0 ? 0 : Math.round((filledForms / formSteps.length) * 100);

    // A step's status once it's been visited (clicked past via Next).
    const stepStatus = (i: number): "done" | "missing" | "todo" => {
        if (!visited.has(i)) return "todo";
        const sec = steps[i].credSection;
        if (CRED_FORM_SECTIONS.includes(sec) && !sectionFilledIn(credentials, sec)) return "missing";
        return "done";
    };

    // Hiding a step for this client renumbers the ones after it (matches how many
    // are actually visible), instead of leaving a gap at the raw array index.
    const isHiddenAt = (idx: number) => {
        const sec = steps[idx]?.credSection;
        return !isTemplate && sec !== "none" && sec !== "overview" && hiddenSteps.includes(sec);
    };
    const visiblePosition = (idx: number) => steps.filter((_, j) => j < idx && !isHiddenAt(j)).length;

    const overviewIdx = steps.findIndex(s => s.credSection === "overview");

    return (
        <div className="relative flex h-full shrink-0 print:hidden" style={{ width: sidebarWidth }}>
        <aside className="flex h-full w-full flex-col overflow-hidden rounded-lg bg-primary shadow-sm">
            {/* header */}
            <div className="flex items-center border-b border-secondary px-5 py-4">
                <img src={isDark ? "/hgm logo/LOGO ON Dark.svg" : "/hgm logo/Logo ON LIGHT.svg"}
                    alt="HiddenGem Media" className="h-14" draggable={false} />
            </div>

            {/* progress */}
            <div className="border-b border-secondary px-5 py-4">
                <div className="mb-2 flex items-center justify-between">
                    <p className="text-[12px] font-semibold text-secondary">Ai Website Setup</p>
                    <span className="text-[12px] font-bold text-brand-600">{progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-tertiary">
                    <div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
            </div>

            {/* step list */}
            <motion.div
                className="flex-1 overflow-y-auto px-3 py-3"
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.05 } } }}
            >
                {steps.map((s, i) => {
                    const active = i === currentStep;
                    const status = stepStatus(i);
                    const isOverview = s.credSection === "overview";
                    const hasLabel = s.credSection !== "none" && s.credSection !== "overview" && !!CRED_SECTION_LABEL[s.credSection];
                    // A client guide can hide a step it doesn't need (e.g. no Cloudflare
                    // account) — Welcome/Review are never hideable, and this never applies
                    // to the template itself. Hidden steps only ever show up while editing
                    // (dimmed, with a Restore action) so they're never "gone forever" by accident.
                    const canHide = !isTemplate && s.credSection !== "none" && s.credSection !== "overview";
                    const hidden = canHide && hiddenSteps.includes(s.credSection);
                    if (hidden && !editing) return null;
                    return (
                        <motion.div key={i}
                            variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } } }}
                            className={cx(
                            "group relative flex items-center gap-2 rounded-[9px] px-2 py-2 pl-[11px] transition-colors duration-100 ease-linear",
                            !hidden && (active ? "bg-brand-50 dark:bg-brand-950/40" : "hover:bg-secondary"),
                        )}>
                            <span className={cx(
                                "absolute left-0 top-[7px] bottom-[7px] w-[3px] rounded-r-[3px] transition duration-100",
                                active ? "bg-brand-600 opacity-100" : "opacity-0",
                            )} />

                            {/* step icon / number — the dim goes on this inner button, NOT the
                                motion.div row: the entrance animation ends at opacity:1 as an
                                inline style, which would silently override any opacity class
                                set on the row itself. */}
                            <button type="button" onClick={() => onSelect(i)} disabled={hidden}
                                className={cx("flex items-center gap-2.5 flex-1 min-w-0 text-left disabled:cursor-not-allowed", hidden && "opacity-40")}>
                                <span className={cx(
                                    "flex size-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition",
                                    isOverview ? (active ? "bg-brand-600 text-white" : "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300") :
                                    status === "done" ? "bg-success-solid text-white" :
                                    status === "missing" ? "bg-error-solid text-white" :
                                    active ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300" : "bg-secondary text-quaternary",
                                )}>
                                    {isOverview
                                        ? <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>
                                        : status === "done"
                                            ? <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                                            : visiblePosition(i)
                                    }
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className={cx("truncate text-[13px] font-semibold", hidden ? "text-tertiary line-through" : active ? "text-primary" : "text-secondary")}>
                                        {hasLabel ? CRED_SECTION_LABEL[s.credSection] : s.title}
                                    </p>
                                    {hasLabel && (
                                        <p className="truncate text-[10.5px] text-quaternary">{hidden ? "Hidden for this client" : s.title}</p>
                                    )}
                                </div>
                            </button>

                            {/* edit controls */}
                            {editing && hidden ? (
                                <button type="button" title="Restore for this client" onClick={() => onToggleStepHidden(s.credSection)}
                                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-quaternary transition hover:bg-secondary hover:text-brand-600">
                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" /></svg>
                                </button>
                            ) : editing && (
                                <div className="flex shrink-0 items-center gap-0.5">
                                    <button type="button" title="Move up" onClick={() => onMoveStep(i, -1)} disabled={i === 0}
                                        className="flex size-6 items-center justify-center rounded-md text-quaternary transition hover:bg-secondary hover:text-primary disabled:opacity-20">
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 15l-6-6-6 6" /></svg>
                                    </button>
                                    <button type="button" title="Move down" onClick={() => onMoveStep(i, 1)} disabled={i === steps.length - 1}
                                        className="flex size-6 items-center justify-center rounded-md text-quaternary transition hover:bg-secondary hover:text-primary disabled:opacity-20">
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
                                    </button>
                                    {canHide ? (
                                        <button type="button" title="Hide from this client" onClick={() => onToggleStepHidden(s.credSection)}
                                            className="flex size-6 items-center justify-center rounded-md text-quaternary transition hover:bg-secondary hover:text-primary">
                                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                        </button>
                                    ) : (
                                        <button type="button" title="Delete step" onClick={() => onDeleteStep(i)}
                                            className="flex size-6 items-center justify-center rounded-md text-quaternary transition hover:bg-error-primary hover:text-error-primary">
                                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                                        </button>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    );
                })}

                {/* add step button */}
                {editing && (
                    <button type="button" onClick={onAddStep}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-[9px] border border-dashed border-primary py-2.5 text-[13px] font-semibold text-tertiary transition duration-100 ease-linear hover:border-brand hover:bg-brand-50 hover:text-brand-700">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                        Add Step
                    </button>
                )}

                {/* overview shortcut (edit mode only) */}
                {editing && overviewIdx !== -1 && (
                    <button type="button" onClick={onNavigateOverview}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-[9px] bg-brand-50 px-3 py-2.5 text-[13px] font-semibold text-brand-700 transition duration-100 ease-linear hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>
                        View Client Overview
                    </button>
                )}
            </motion.div>

            {/* template hint — nested between the step list and the "Create Owner Guide"
                button it refers to, so it aligns with the sidebar's own width/padding
                instead of floating as a fixed-position popup. */}
            <AnimatePresence>
                {showTemplateHint && (
                    <motion.div
                        className="mx-3 mb-3 overflow-hidden rounded-xl border border-secondary bg-primary p-4 shadow-sm"
                        initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98, height: 0, marginBottom: 0, padding: 0 }}
                        transition={{ type: "spring", stiffness: 320, damping: 26 }}>
                        <div className="flex items-start gap-3">
                            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950/40">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                            </span>
                            <div className="flex-1">
                                <p className="text-[13px] font-semibold text-primary">Master template</p>
                                <p className="mt-0.5 text-[12.5px] leading-relaxed text-tertiary">This is the master template. Use <span className="font-semibold text-secondary">Create Owner Guide</span> below to make a private copy to share with a client.</p>
                            </div>
                            <button type="button" onClick={onDismissTemplateHint} title="Dismiss"
                                className="flex size-6 shrink-0 items-center justify-center rounded-md text-quaternary transition hover:bg-secondary hover:text-secondary">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* bottom controls: share password, copy link, theme toggle */}
            <div className="flex flex-col gap-2 border-t border-secondary p-3">
                {canShare && sharePassword && (
                    <div className="flex items-center justify-between gap-1.5 rounded-lg border border-secondary bg-secondary px-2.5 py-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-quaternary">Password</span>
                        <div className="flex items-center gap-1.5">
                            <code className="text-[12px] text-primary">{showSharePw ? sharePassword : "••••••"}</code>
                            <button type="button" onClick={onToggleSharePw} title={showSharePw ? "Hide" : "Show"}
                                className="flex size-6 items-center justify-center rounded-md text-tertiary hover:bg-primary hover:text-primary">
                                <EyeIcon off={!showSharePw} />
                            </button>
                        </div>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    {canShare && (
                        <button type="button" onClick={onCopyShareLink}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-secondary bg-primary px-3 py-2 text-[12px] font-semibold text-secondary transition hover:bg-secondary hover:text-primary">
                            {shareCopied ? "Link copied!" : "Copy share link"}
                        </button>
                    )}
                    {canCreate && (
                        <button type="button" onClick={onCreate}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-solid px-3 py-2 text-[12px] font-semibold text-white transition hover:opacity-90">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                            Create Owner Guide
                        </button>
                    )}
                    <button type="button" onClick={() => setTheme(isDark ? "light" : "dark")}
                        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                        className={cx(
                            "flex size-9 shrink-0 items-center justify-center rounded-lg border border-secondary bg-primary text-secondary transition duration-100 ease-linear hover:bg-secondary hover:text-primary",
                            !canShare && !canCreate && "ml-auto",
                        )}>
                        {isDark
                            ? <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
                            : <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>}
                    </button>
                </div>
            </div>
        </aside>

        {/* Resize handle — drag to widen/narrow, double-click to reset */}
        <div
            onMouseDown={startResize}
            onDoubleClick={resetWidth}
            title="Drag to resize — double-click to reset"
            className="group absolute -right-2 top-0 z-10 flex h-full w-4 cursor-col-resize items-center justify-center"
        >
            <div className="h-10 w-1 rounded-full bg-quaternary opacity-0 transition duration-100 ease-linear group-hover:opacity-100" />
        </div>
        </div>
    );
};

// ── Create-guide popup ────────────────────────────────────────────

/** Fixed product suffix appended to every owner-guide share link. */
const LINK_SUFFIX = "aiwebsite";

const CreateGuideModal = ({ open, onClose, onCreated }: {
    open: boolean; onClose: () => void; onCreated: (slug: string) => void;
}) => {
    const [clientName, setClientName] = useState("");
    const [password, setPassword] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const slugify = (s: string) =>
        s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

    const reset = () => { setClientName(""); setPassword(""); setShowPw(false); setError(""); };

    const submit = async () => {
        const name = clientName.trim();
        if (!name || saving) { if (!name) setError("Enter a client name."); return; }
        setSaving(true); setError("");
        const base = slugify(name) || "client";
        // Link is auto-built from the client name with a fixed product suffix,
        // e.g. "FLOHOM" → flohom-aiwebsite.
        const slug = `${base}-${LINK_SUFFIX}`;

        try {
            // 1. Create owner_guides metadata (with timeout, non-blocking fallback)
            const metaPromise = supabase.from("owner_guides").insert({
                slug, client_name: name, share_password: password.trim() || null,
            });
            const metaTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Metadata save timed out")), 8000)
            );
            try {
                await Promise.race([metaPromise, metaTimeout]);
                dbLogger.success(`Guide metadata created`);
            } catch (metaErr) {
                console.warn("[owner_guides insert timeout/fail — continuing]", metaErr);
                // Continue anyway — guide content is what matters
            }

            // 2. Copy master guide content to client slug (using fallback logic)
            try {
                const masterData = await readSopPage(GUIDE_CONTENT_SLUG);
                if (masterData?.data) {
                    await writeSopPage(slug, masterData.data);
                    dbLogger.success(`Guide content copied to ${slug}`);
                }
            } catch (contentErr) {
                console.warn("[copy guide content]", contentErr);
                // Don't fail if content copy fails — guide can be empty initially
            }

            // 3. Unlock the new guide for the creator so the share-password gate is skipped.
            try { sessionStorage.setItem(`og_unlock_${slug}`, "1"); } catch {}

            setSaving(false);
            reset();
            onCreated(slug);
        } catch (err) {
            console.error("[create guide]", err);
            setError("Could not create: " + (err instanceof Error ? err.message : "unknown error"));
            setSaving(false);
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 py-8"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
                    onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
                    <motion.div className="w-full max-w-md rounded-2xl bg-primary p-6 shadow-2xl ring-1 ring-secondary"
                        initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
                        transition={{ type: "spring", stiffness: 300, damping: 26 }}>
                        <h3 className="text-md font-semibold text-primary">Create owner guide for a client</h3>
                        <p className="mt-1 text-sm text-tertiary">A private copy is created from this template. Share the link and password with your client.</p>

                        <div className="mt-4 flex flex-col gap-4">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-secondary">Client name <span className="text-error-primary">*</span></label>
                                <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Sunset Villas" autoFocus
                                    className="w-full rounded-lg border border-secondary px-3 py-2 text-sm text-primary placeholder:text-placeholder outline-none transition focus:border-brand focus:ring-1 focus:ring-brand" />
                                {clientName.trim() && (
                                    <p className="mt-1.5 text-xs text-tertiary">
                                        Link: <span className="font-mono text-secondary">/owner-guide/{slugify(clientName) || "client"}-{LINK_SUFFIX}</span>
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-secondary">Share password <span className="font-normal text-quaternary">(client enters this to view)</span></label>
                                <div className="relative">
                                    <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Set a password to share"
                                        className="w-full rounded-lg border border-secondary py-2 pl-3 pr-11 text-sm text-primary placeholder:text-placeholder outline-none transition focus:border-brand focus:ring-1 focus:ring-brand" />
                                    <button type="button" onClick={() => setShowPw(s => !s)} title={showPw ? "Hide" : "Show"}
                                        className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-tertiary hover:bg-secondary hover:text-primary">
                                        <EyeIcon off={!showPw} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {error && <p className="mt-3 text-xs text-error-primary">{error}</p>}

                        <div className="mt-5 flex gap-3">
                            <button type="button" onClick={onClose} disabled={saving} className="flex-1 rounded-lg border border-secondary px-4 py-2 text-sm font-semibold text-secondary transition hover:bg-secondary disabled:opacity-50">Cancel</button>
                            <button type="button" onClick={submit} disabled={saving} className="flex-1 rounded-lg bg-brand-solid px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40">
                                {saving ? "Creating…" : "Create guide"}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// Eye / eye-off icon (reused for password visibility toggles).
const EyeIcon = ({ off }: { off?: boolean }) =>
    off
        ? <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" /></svg>
        : <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;

/** Blocks the master template from anyone outside the HGM team — clients only
    ever see their own private guide copy (/owner-guide/:slug), never this one. */
const TemplateGate = ({ signedIn }: { signedIn: boolean }) => {
    const [signingIn, setSigningIn] = useState(false);
    const signIn = async () => {
        setSigningIn(true);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: window.location.href, queryParams: { prompt: "select_account" } },
        });
        if (error) setSigningIn(false);
    };
    return (
        <main className="flex min-h-dvh flex-col items-center justify-center bg-secondary px-4 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-950/40">
                <Shield01 className="size-7 text-fg-brand-primary" aria-hidden="true" />
            </div>
            <h1 className="mt-5 text-display-xs font-semibold text-primary">Team only</h1>
            <p className="mt-2 max-w-sm text-sm text-tertiary">
                {signedIn
                    ? "This master template is private to the HiddenGem Media team. Your account doesn't have access."
                    : "This master template is private. Sign in with your @hiddengem.media account to open it."}
            </p>
            {!signedIn && (
                <button type="button" onClick={signIn} disabled={signingIn}
                    className="mt-6 flex items-center justify-center gap-2.5 rounded-lg border border-secondary bg-primary px-4 py-2.5 text-sm font-semibold text-primary transition duration-100 ease-linear hover:bg-secondary_hover disabled:opacity-50">
                    {signingIn ? (
                        <span className="size-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                    ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" /><path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 6.68 9.14 4.75 12 4.75z" /></svg>
                    )}
                    Sign in with Google
                </button>
            )}
        </main>
    );
};

// ── Main screen ───────────────────────────────────────────────────

export const OwnerGuideScreen = () => {
    const { slug } = useParams<{ slug: string }>();
    const navigateTo = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const isTemplate = !slug;
    // Credentials are keyed by the guide slug for client guides, or the local
    // session for the template preview. Deliberately NOT a useState: `/owner-guide`
    // and `/owner-guide/:slug` render the same component type, so React Router
    // doesn't remount on navigation between them (e.g. right after creating a new
    // guide) — a useState initializer would freeze on the first slug it ever saw
    // and every save would silently go to the wrong session_id.
    const sessionId = slug ?? getOrCreateSession();

    // Each client guide owns its own COPY of the step content (created by the
    // Create Owner Guide flow under sop_pages slug = guide slug). The screen
    // reads/writes that copy — never the shared template — so retitling or
    // editing a client's guide can't leak into the template or other clients,
    // and template edits can't rewrite guides that already exist (RULE No.1).
    const contentSlug = slug ?? GUIDE_CONTENT_SLUG;
    const contentKey = slug ? `${CONTENT_KEY}_${slug}` : CONTENT_KEY;

    const mainRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const lockKey = `hgm_owner_locked_${sessionId}`;
    const [steps, setSteps] = useState<StepData[]>(() => loadContent(contentKey));
    const [ownerData, setOwnerData] = useState<OwnerData>(emptyOwner);
    const [meta, setMeta] = useState<OwnerGuideMeta | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    // Template hint toast — appears top-right ~2s after the master template loads.
    const [showTemplateToast, setShowTemplateToast] = useState(false);
    const [showSharePw, setShowSharePw] = useState(false);
    const [shareCopied, setShareCopied] = useState(false);
    // Share-password gate: locked out until the client enters the password
    // (the team bypasses via sessionStorage when opening from the dashboard).
    const [gateOpen, setGateOpen] = useState(false);
    const [gateInput, setGateInput] = useState("");
    const [gateError, setGateError] = useState(false);
    const [locked, setLocked] = useState(() => {
        const s = localStorage.getItem(lockKey);
        return s !== null ? s === "true" : true;
    });
    const [loading, setLoading] = useState(true);
    const [currentStep, setCurrentStep] = useState(0);
    const [visited, setVisited] = useState<Set<number>>(new Set());
    const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
    // How many Stripe accounts are expanded (clients with more than one Stripe
    // account, e.g. separate properties/brands) — account 1 is always inline in
    // the sidebar; accounts 2+ live in the "Additional Stripe accounts" popup.
    const [stripeAccountsShown, setStripeAccountsShown] = useState(1);
    const [showStripeAccountsModal, setShowStripeAccountsModal] = useState(false);
    const [overviewSaveStatus, setOverviewSaveStatus] = useState<SaveStatus>("idle");
    const [showComplete, setShowComplete] = useState(false);
    // Editing is HGM-team only: the lock toggle is hidden from clients, and a
    // signed-in @hiddengem.media Supabase session is required to enter edit mode.
    // The master template (no slug) additionally requires team sign-in just to
    // VIEW it at all — clients only ever see their own private guide copy.
    const { user: authUser, loading: authLoading } = useAuthUser();
    const isTeam = !!authUser?.email && authUser.email.toLowerCase().endsWith("@hiddengem.media");

    const editing = isTeam && !locked;

    // Shift+E toggles the lock, Shift+S locks — team members only (edits save on change).
    useEditShortcuts({ enabled: isTeam, onToggle: () => setLocked((v) => !v), onSave: () => setLocked(true) });

    const contentHydrated = useRef(false);
    // Counts setSteps calls made by HYDRATION so the publish effect can skip
    // them — merely VIEWING a guide must never write content back to the DB
    // (the old echo-write rewrote rows on every page load, incl. submitted
    // client guides — a RULE No.1 hazard and a race between open tabs).
    const skipPublish = useRef(0);

    useEffect(() => {
        dbLoad(sessionId).then(data => {
            setOwnerData(data);
            setLoading(false);
        });
    }, [sessionId]);

    // Load the guide's client name + share password, and apply the gate.
    useEffect(() => {
        if (!slug) { setMeta(null); setGateOpen(false); return; }
        supabase
            .from("owner_guides")
            .select("*")
            .eq("slug", slug)
            .maybeSingle()
            .then(({ data }) => {
                const row = (data as OwnerGuideMeta | null) ?? null;
                setMeta(row);
                const unlocked = (() => { try { return sessionStorage.getItem(`og_unlock_${slug}`) === "1"; } catch { return false; } })();
                if (row?.share_password && !unlocked) setGateOpen(true);
            });
    }, [slug]);

    // Show the template hint toast 2 seconds after the master template opens.
    useEffect(() => {
        if (!isTemplate) return;
        const t = setTimeout(() => setShowTemplateToast(true), 2000);
        return () => clearTimeout(t);
    }, [isTemplate]);

    // Auto-open the create modal when arriving via /owner-guide?create=1.
    useEffect(() => {
        if (isTemplate && searchParams.get("create") === "1") {
            setCreateOpen(true);
            searchParams.delete("create");
            setSearchParams(searchParams, { replace: true });
        }
    }, [isTemplate, searchParams, setSearchParams]);

    const submitGate = () => {
        if (gateInput === (meta?.share_password ?? "")) {
            try { sessionStorage.setItem(`og_unlock_${slug}`, "1"); } catch {}
            setGateOpen(false); setGateError(false); setGateInput("");
        } else {
            setGateError(true);
        }
    };

    const copyShareLink = () => {
        const url = `${window.location.origin}/owner-guide/${slug}`;
        navigator.clipboard.writeText(url).then(() => { setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); });
    };

    // Load this page's OWN step content: the template row for /owner-guide, the
    // guide's own copied row for /owner-guide/:slug. Legacy guides created before
    // per-guide copies existed fall back to the template's content once — the
    // publish effect below then materializes their own copy on first save.
    // Re-runs when contentSlug changes because template → new guide navigation
    // does NOT remount this component (same route element).
    useEffect(() => {
        contentHydrated.current = false;
        let cancelled = false;
        const apply = (data: unknown) => {
            if (cancelled || !data || !Array.isArray(data) || !data.length) return false;
            const norm = normalizeSteps(data as StepData[]);
            skipPublish.current += 1; // hydration, not a user edit — don't publish it back
            setSteps(norm);
            saveContent(norm, contentKey);
            return true;
        };
        (async () => {
            try {
                const row = await readSopPage(contentSlug);
                apply(row?.data);
            } catch (err) {
                if (slug) {
                    try {
                        const master = await readSopPage(GUIDE_CONTENT_SLUG);
                        apply(master?.data);
                    } catch (err2) {
                        dbLogger.error(`Failed to load guide content from Supabase`, err2 as Error);
                    }
                } else {
                    dbLogger.error(`Failed to load guide content from Supabase`, err as Error);
                }
            } finally {
                if (!cancelled) contentHydrated.current = true;
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contentSlug]);

    // Debounced publish of step content after edits — to this page's own row
    // (template OR the guide's copy), never anyone else's. contentSlug is read
    // from the closure of the render where `steps` changed, so a pending write
    // scheduled on the template can't land on a guide navigated to mid-debounce.
    useEffect(() => {
        if (!contentHydrated.current) return;
        // Hydration-driven setSteps must not round-trip to the DB — only real
        // edits publish. Viewing a guide is now strictly read-only.
        if (skipPublish.current > 0) {
            skipPublish.current -= 1;
            return;
        }
        const t = setTimeout(() => {
            writeSopPage(contentSlug, steps)
                .then(() => { dbLogger.success(`Guide content published`); })
                .catch((err) => { dbLogger.error(`Failed to save guide content`, err); });
        }, 800);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [steps]);

    useEffect(() => { localStorage.setItem(lockKey, String(locked)); }, [locked, lockKey]);

    // Steps this specific client guide has hidden (e.g. no Cloudflare account) — never
    // touches the shared master template or any other client's guide. Only applies to
    // real client guides, never the template itself.
    const hiddenSteps = isTemplate ? [] : (meta?.hidden_steps ?? []);
    const isStepHidden = (i: number) => {
        const sec = steps[i]?.credSection;
        return !!sec && sec !== "none" && sec !== "overview" && hiddenSteps.includes(sec);
    };
    // Matches the Sidebar's own renumbering — hiding a step shifts the numbers after
    // it down instead of leaving a gap at the raw array index.
    const visiblePosition = (idx: number) => steps.filter((_, j) => j < idx && !isStepHidden(j)).length;
    const toggleStepHidden = async (credSection: string) => {
        if (isTemplate || !slug) return;
        const next = hiddenSteps.includes(credSection) ? hiddenSteps.filter(s => s !== credSection) : [...hiddenSteps, credSection];
        setMeta(m => (m ? { ...m, hidden_steps: next } : m));
        const { error } = await supabase.from("owner_guides").update({ hidden_steps: next }).eq("slug", slug);
        if (error) dbLogger.error(`Failed to save hidden_steps for ${slug}`, error);
    };

    const navigate = (i: number) => {
        let target = Math.max(0, Math.min(steps.length - 1, i));
        const dir = target >= currentStep ? 1 : -1;
        while (isStepHidden(target) && target > 0 && target < steps.length - 1) target += dir;
        if (isStepHidden(target)) {
            const fallback = steps.findIndex((_, idx) => !isStepHidden(idx));
            if (fallback !== -1) target = fallback;
        }
        setCurrentStep(target);
        mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    };

    // ── Content updaters ────────────────────────────────────────

    const updateField = (idx: number, field: keyof StepData, val: unknown) => {
        setSteps(prev => {
            const next = prev.map((s, i) => i === idx ? { ...s, [field]: val } : s);
            saveContent(next, contentKey);
            return next;
        });
    };

    const updateInstruction = (si: number, ii: number, val: string) => {
        setSteps(prev => {
            const next = prev.map((s, i) => i !== si ? s : { ...s, instructions: s.instructions.map((ins, j) => j === ii ? { ...ins, text: val } : ins) });
            saveContent(next, contentKey);
            return next;
        });
    };

    const patchInstruction = (si: number, ii: number, patch: Partial<Instruction>) => {
        setSteps(prev => {
            const next = prev.map((s, i) => i !== si ? s : { ...s, instructions: s.instructions.map((ins, j) => j === ii ? { ...ins, ...patch } : ins) });
            saveContent(next, contentKey);
            return next;
        });
    };

    const deleteInstruction = (si: number, ii: number) => {
        setSteps(prev => {
            const step = prev[si];
            if (step.instructions[ii]?.locked) return prev; // protected — unlock before deleting
            const next = prev.map((s, i) => i !== si ? s : { ...s, instructions: s.instructions.filter((_, j) => j !== ii) });
            saveContent(next, contentKey);
            return next;
        });
    };

    const toggleInstructionLock = (si: number, ii: number) => {
        patchInstruction(si, ii, { locked: !steps[si].instructions[ii]?.locked });
    };

    const moveInstruction = (si: number, ii: number, dir: -1 | 1) => {
        setSteps(prev => {
            const list = prev[si].instructions;
            const target = ii + dir;
            if (target < 0 || target >= list.length) return prev;
            const reordered = [...list];
            [reordered[ii], reordered[target]] = [reordered[target], reordered[ii]];
            const next = prev.map((s, i) => i !== si ? s : { ...s, instructions: reordered });
            saveContent(next, contentKey);
            return next;
        });
    };

    const handleInstructionImage = (si: number, ii: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        void compressImageFile(file).then((img) => patchInstruction(si, ii, { image: img }));
        e.target.value = "";
    };

    const updateBenefit = (si: number, bi: number, val: string) => {
        setSteps(prev => {
            const next = prev.map((s, i) => i !== si || !s.benefits ? s : { ...s, benefits: s.benefits.map((b, j) => j === bi ? val : b) });
            saveContent(next, contentKey);
            return next;
        });
    };

    // ── Step management ──────────────────────────────────────────

    const moveStep = (from: number, dir: -1 | 1) => {
        const to = from + dir;
        if (to < 0 || to >= steps.length) return;
        setSteps(prev => {
            const next = [...prev];
            [next[from], next[to]] = [next[to], next[from]];
            saveContent(next, contentKey);
            if (currentStep === from) setCurrentStep(to);
            else if (currentStep === to) setCurrentStep(from);
            return next;
        });
    };

    const deleteStep = (i: number) => {
        if (steps.length <= 1) return;
        // Deleting here edits the shared master template — it disappears for every
        // client guide, so make absolutely sure before proceeding.
        if (!window.confirm("Are you sure you want to delete this step?\n\nThis is the master TEMPLATE — once removed, the step (and its instructions/screenshots) disappears for every client guide and you won't be able to undo it.")) return;
        setSteps(prev => {
            const next = prev.filter((_, idx) => idx !== i);
            saveContent(next, contentKey);
            return next;
        });
        if (currentStep >= i) setCurrentStep(Math.max(0, currentStep - 1));
    };

    // Restore the template's steps from the protected "Owner Guide Snapshot"
    // (all 9 steps incl. PMS/Domain/Cloudflare) — the escape hatch after an
    // accidental template edit/delete.
    const revertToSnapshot = async () => {
        if (!window.confirm("Revert to the Owner Guide Snapshot?\n\nThis replaces the template's current steps with the protected full 9-step version. Client credentials are not affected.")) return;
        try {
            const row = await readSopPage(SNAPSHOT_SLUG);
            if (row?.data && Array.isArray(row.data) && row.data.length) {
                const norm = normalizeSteps(row.data as StepData[]);
                setSteps(norm);
                saveContent(norm, contentKey);
                setCurrentStep(0);
            } else {
                alert("Owner Guide Snapshot not found — nothing was changed.");
            }
        } catch (err) {
            dbLogger.error("Failed to load the Owner Guide Snapshot", err as Error);
            alert("Couldn't load the Owner Guide Snapshot — nothing was changed.");
        }
    };

    const addStep = () => {
        const newStep: StepData = {
            title: "New Step",
            description: "Describe what this step involves.",
            instructions: [{ text: "First instruction" }],
            checklistLabels: [["Complete this step", "Criteria for completion"]],
            images: [],
            credSection: "none",
        };
        setSteps(prev => {
            const next = [...prev.slice(0, currentStep + 1), newStep, ...prev.slice(currentStep + 1)];
            saveContent(next, contentKey);
            return next;
        });
        navigate(currentStep + 1);
    };

    const navigateToOverview = () => {
        const idx = steps.findIndex(s => s.credSection === "overview");
        if (idx !== -1) navigate(idx);
    };

    // ── Image handlers ───────────────────────────────────────────

    const addImage = (si: number, src: string) => {
        setSteps(prev => {
            const next = prev.map((s, i) => i !== si ? s : { ...s, images: [...s.images, { id: uid(), src }] });
            saveContent(next, contentKey);
            return next;
        });
    };

    const removeImage = (si: number, imgId: string) => {
        setSteps(prev => {
            const next = prev.map((s, i) => i !== si ? s : { ...s, images: s.images.filter(img => img.id !== imgId) });
            saveContent(next, contentKey);
            return next;
        });
    };

    const updateLensPos = (si: number, imgId: string, lensPos: LensPos) => {
        setSteps(prev => {
            const next = prev.map((s, i) => i !== si ? s : { ...s, images: s.images.map(img => img.id === imgId ? { ...img, lensPos } : img) });
            saveContent(next, contentKey);
            return next;
        });
    };

    const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        void compressImageFile(file).then((img) => addImage(currentStep, img));
        e.target.value = "";
    };

    // ── Credential handlers ──────────────────────────────────────

    const cred = (k: string) => ownerData.credentials[k] ?? "";
    const setCred = (k: string, v: string) => setOwnerData(prev => ({ ...prev, credentials: { ...prev.credentials, [k]: v } }));

    // Always render at least as many Stripe account blocks as have saved data
    // (e.g. reopening a guide with 3 saved accounts shows all 3), plus however
    // many the user has expanded via "+ Add another" this session.
    const highestFilledStripeAccount = (() => {
        let n = 1;
        for (let i = 2; i <= MAX_STRIPE_ACCOUNTS; i++) {
            const k = stripeKeys(i);
            if (cred(k.pk) || cred(k.sk) || cred(k.wh)) n = i;
        }
        return n;
    })();
    const stripeAccountsToRender = Math.max(stripeAccountsShown, highestFilledStripeAccount);

    const StatusBadge = ({ sec }: { sec: string }) => {
        const filled = sectionFilledIn(ownerData.credentials, sec);
        return (
            <span className={cx(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                filled ? "bg-utility-green-50 text-utility-green-700" : "bg-secondary text-quaternary",
            )}>
                <span className={cx("size-1.5 rounded-full", filled ? "bg-success-solid" : "bg-quaternary")} />
                {filled ? "Filled" : "Empty"}
            </span>
        );
    };

    const signalStatus = (key: string, ok: boolean) => {
        setSaveStatus(s => ({ ...s, [key]: ok ? "saved" : "error" }));
        setTimeout(() => setSaveStatus(s => ({ ...s, [key]: "idle" })), ok ? 3000 : 5000);
    };

    const doSave = async (key: string) => {
        // Nothing entered → don't pretend it saved.
        if (!sectionFilledIn(ownerData.credentials, key)) {
            setSaveStatus(s => ({ ...s, [key]: "empty" }));
            setTimeout(() => setSaveStatus(s => ({ ...s, [key]: "idle" })), 3000);
            return;
        }
        setSaveStatus(s => ({ ...s, [key]: "saving" }));
        const ok = await dbSave(sessionId, ownerData);
        signalStatus(key, ok);
    };

    const doClear = async (_key: string, clearKeys: string[]) => {
        const cleared = { ...ownerData.credentials };
        clearKeys.forEach(k => { cleared[k] = ""; });
        const next: OwnerData = { ...ownerData, credentials: cleared };
        setOwnerData(next);
        await dbSave(sessionId, next);
    };

    // ── Overview save & lock ─────────────────────────────────────

    const handleOverviewSave = async () => {
        setOverviewSaveStatus("saving");
        const ok = await dbSave(sessionId, ownerData);
        if (ok) {
            setLocked(true);
            setOverviewSaveStatus("saved");
        } else {
            setOverviewSaveStatus("error");
            setTimeout(() => setOverviewSaveStatus("idle"), 5000);
        }
    };

    const step = steps[currentStep] ?? steps[0];
    const formSteps = steps.filter(s => CRED_FORM_SECTIONS.includes(s.credSection) && !hiddenSteps.includes(s.credSection));
    const filledForms = formSteps.filter(s => sectionFilledIn(ownerData.credentials, s.credSection)).length;
    // Visible step count/position for this client (hidden steps don't count) — the
    // template always shows the raw count since nothing is ever hidden there.
    const visibleStepCount = steps.filter((_, idx) => !isStepHidden(idx)).length;
    const visibleStepPosition = steps.slice(0, currentStep + 1).filter((_, idx) => !isStepHidden(idx)).length;

    // Steps with step-by-step instructions (Netlify, Supabase, Resend, Stripe, Cloudflare) get
    // a sticky credential column beside the scrolling body, so the form is always reachable
    // without scrolling past the instructions. PMS and Domain have no instructions to scroll
    // alongside, so their form just stays inline in a single column.
    const showSplitLayout = !loading && CRED_FORM_SECTIONS.includes(step.credSection) && step.instructions.length > 0;

    const stepBody = (
        <motion.div key={`body-${currentStep}`}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
            {/* description */}
            <section className="mb-6 rounded-2xl border border-secondary bg-primary p-6 shadow-md transition-shadow duration-200 hover:shadow-xl">
                {editing ? (
                    <textarea value={step.description}
                        onChange={e => updateField(currentStep, "description", e.target.value)}
                        rows={3}
                        className="w-full resize-y bg-transparent text-[16px] leading-relaxed text-secondary outline-none"
                    />
                ) : (
                    <p className="text-[16px] leading-relaxed text-secondary">{step.description}</p>
                )}

                {step.benefits && (
                    <div className="mt-4 flex flex-col gap-2.5">
                        {step.benefits.map((b, i) => (
                            <div key={i} className="flex items-start gap-3">
                                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success-solid">
                                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                                </span>
                                {editing ? (
                                    <input type="text" value={b}
                                        onChange={e => updateBenefit(currentStep, i, e.target.value)}
                                        className="flex-1 bg-transparent text-[16px] font-medium text-primary outline-none border-b border-transparent focus:border-brand"
                                    />
                                ) : (
                                    <p className="text-[16px] font-medium text-primary">{b}</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* instructions */}
            {step.instructions.length > 0 && (
                <section className="mb-6">
                    <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-quaternary">Step-by-Step Instructions</h2>
                    <div className="flex flex-col gap-3">
                        {step.instructions.map((ins, i) => (
                            <InstructionRow
                                key={ins.id ?? i}
                                ins={ins}
                                index={i}
                                isFirst={i === 0}
                                isLast={i === step.instructions.length - 1}
                                editing={editing}
                                onChangeText={(val) => updateInstruction(currentStep, i, val)}
                                onDelete={() => deleteInstruction(currentStep, i)}
                                onToggleLock={() => toggleInstructionLock(currentStep, i)}
                                onMoveUp={() => moveInstruction(currentStep, i, -1)}
                                onMoveDown={() => moveInstruction(currentStep, i, 1)}
                                onImageChange={(e) => handleInstructionImage(currentStep, i, e)}
                                onLensPosChange={(p) => patchInstruction(currentStep, i, { lensPos: p })}
                                onRemoveImage={() => patchInstruction(currentStep, i, { image: undefined, lensPos: undefined })}
                            />
                        ))}
                        {editing && (
                            <button type="button"
                                onClick={() => updateField(currentStep, "instructions", [...step.instructions, { id: uid(), text: "New instruction" }])}
                                className="flex items-center gap-2 rounded-xl border border-dashed border-primary py-2.5 text-[13px] font-medium text-tertiary transition hover:border-brand hover:text-brand-700">
                                <span className="flex-1 text-center">+ Add instruction</span>
                            </button>
                        )}
                    </div>
                </section>
            )}

            {/* images */}
            {(step.images.length > 0 || editing) && (
                <section className="mb-6">
                    {step.images.length > 0 && (
                        <div className="mb-3 flex flex-col gap-3">
                            {step.images.map(img => (
                                <ImageMagnifier key={img.id} src={img.src} editing={editing}
                                    lensPos={img.lensPos}
                                    onLensPosChange={p => updateLensPos(currentStep, img.id, p)}
                                    onRemove={() => removeImage(currentStep, img.id)}
                                />
                            ))}
                        </div>
                    )}
                    {editing && (
                        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-primary bg-primary py-6 text-[13px] font-medium text-tertiary transition hover:border-brand hover:bg-brand-50 hover:text-brand-700">
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                            Add reference image
                        </label>
                    )}
                </section>
            )}

            {/* tutorial video */}
            {(step.video || editing) && (
                <section className="mb-6">
                    {editing ? (
                        <VideoAttach value={step.video} onChange={(url) => updateField(currentStep, "video", url)} />
                    ) : (
                        step.video && <VideoEmbed url={step.video} className="mt-4" />
                    )}
                </section>
            )}
        </motion.div>
    );

    /* ── Credential form — uniform Account User name + Password per service,
        except Stripe (API key pair, not a login — see below) ── */
    const credentialForm = !loading && CRED_FORM_SECTIONS.includes(step.credSection) && (() => {
        const sec = step.credSection;

        if (sec === "stripe") {
            const primary = stripeKeys(1);
            const extraAccountCount = stripeAccountsToRender - 1;
            const allKeys = Array.from({ length: stripeAccountsToRender }, (_, i) => i + 1).flatMap(n => Object.values(stripeKeys(n)));
            return (
                <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-md transition-shadow duration-200 hover:shadow-xl">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <h2 className="text-[15px] font-bold text-primary">Stripe Keys and Webhook</h2>
                        <StatusBadge sec={sec} />
                    </div>
                    <div className="flex flex-col gap-4">
                        <p className="rounded-lg bg-secondary px-4 py-3 text-[13px] text-tertiary">Enter your Stripe Publishable and Secret Keys (Developers → API Keys) and the Signing Secret from the webhook you create for this site.</p>
                        <CredField label="Publishable Key" placeholder="pk_live_…" value={cred(primary.pk)} onChange={v => setCred(primary.pk, v)} />
                        <SecretField label="Secret Key" placeholder="sk_live_…" value={cred(primary.sk)} onChange={v => setCred(primary.sk, v)} />
                        <SecretField label="Webhook Signing Secret" placeholder="whsec_…" value={cred(primary.wh)} onChange={v => setCred(primary.wh, v)} />

                        {/* Multiple accounts (separate properties/brands) are managed in a
                            popup — keeps this sidebar card short even with several added. */}
                        <button type="button"
                            onClick={() => setShowStripeAccountsModal(true)}
                            className="flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-primary px-3 py-2 text-[12.5px] font-semibold text-tertiary transition hover:border-brand hover:bg-brand-50 hover:text-brand-700">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                            {extraAccountCount > 0 ? `Manage additional accounts (${extraAccountCount})` : "Add another Stripe account"}
                        </button>

                        <SaveActions status={saveStatus[sec] ?? "idle"} label="Stripe Keys" onSave={() => doSave(sec)} onClear={() => doClear(sec, allKeys)} />
                    </div>
                </section>
            );
        }

        const uKey = `${sec}_username`;
        const pKey = `${sec}_password`;
        return (
            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-md transition-shadow duration-200 hover:shadow-xl">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-[15px] font-bold text-primary">Enter your account login</h2>
                    <StatusBadge sec={sec} />
                </div>
                <div className="flex flex-col gap-4">
                    <p className="rounded-lg bg-secondary px-4 py-3 text-[13px] text-tertiary">Enter the account user name and password you use to sign in to this service.</p>
                    <CredField label="Account User name" placeholder="you@email.com" value={cred(uKey)} onChange={v => setCred(uKey, v)} />
                    <SecretField label="Password" placeholder="Account password" value={cred(pKey)} onChange={v => setCred(pKey, v)} />
                    <SaveActions status={saveStatus[sec] ?? "idle"} label="Login" onSave={() => doSave(sec)} onClear={() => doClear(sec, [uKey, pKey])} />
                </div>
            </section>
        );
    })();

    // Shared Back/Next controls — rendered right under the credential form on split-
    // layout steps (Netlify/Supabase/Resend/Stripe/Cloudflare) so they're reachable
    // without scrolling past a long instructions list, and at the bottom of the page
    // for single-column steps (PMS/Domain/Overview) where the body is already short.
    const backNextButtons = (
        <div className="mt-6 flex items-center justify-between">
            <button type="button" onClick={() => navigate(currentStep - 1)} disabled={currentStep === 0}
                className="flex items-center gap-2 rounded-xl border border-secondary bg-primary px-5 py-2.5 text-[14px] font-semibold text-secondary transition hover:bg-secondary disabled:pointer-events-none disabled:opacity-30">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
                Back
            </button>
            {currentStep < steps.length - 1 ? (
                <button type="button" onClick={() => { setVisited(v => new Set(v).add(currentStep)); navigate(currentStep + 1); }}
                    className="flex items-center gap-2 rounded-xl bg-primary-solid px-5 py-2.5 text-[14px] font-semibold text-white transition hover:opacity-90">
                    Next
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </button>
            ) : (
                <button type="button" onClick={() => setShowComplete(true)}
                    className="flex items-center gap-2 rounded-xl bg-success-solid px-5 py-2.5 text-[14px] font-semibold text-white transition hover:opacity-90">
                    Complete Onboarding 🎉
                </button>
            )}
        </div>
    );

    // The master template is HGM-team only — clients never land here; they only
    // ever see their own guide at /owner-guide/:slug.
    if (isTemplate && !authLoading && !isTeam) return <TemplateGate signedIn={!!authUser} />;

    return (
        <AppShell className="flex gap-2 bg-secondary p-2">
            <Sidebar
                steps={steps} credentials={ownerData.credentials} visited={visited}
                currentStep={currentStep} editing={editing}
                onSelect={navigate} onMoveStep={moveStep}
                onDeleteStep={deleteStep} onAddStep={addStep}
                isTemplate={isTemplate} hiddenSteps={hiddenSteps} onToggleStepHidden={toggleStepHidden}
                onNavigateOverview={navigateToOverview}
                canShare={!isTemplate && !!meta}
                sharePassword={meta?.share_password ?? null}
                showSharePw={showSharePw}
                onToggleSharePw={() => setShowSharePw(s => !s)}
                onCopyShareLink={copyShareLink}
                shareCopied={shareCopied}
                canCreate={isTeam && isTemplate}
                onCreate={() => setCreateOpen(true)}
                showTemplateHint={isTemplate && showTemplateToast}
                onDismissTemplateHint={() => setShowTemplateToast(false)}
            />

            <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden rounded-lg bg-[#FDFDFD] shadow-sm scroll-smooth dark:bg-primary print:overflow-visible print:bg-primary print:shadow-none">
                {/* Client guide header — name only; share controls live in the sidebar. */}
                {!isTemplate && meta && (
                    <div className="border-b border-secondary bg-primary px-8 py-3.5">
                        <div className="mx-auto max-w-[760px]">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-quaternary">Owner guide for</p>
                            <p className="truncate text-[15px] font-bold text-primary">{meta.client_name}</p>
                        </div>
                    </div>
                )}

                <motion.div key={currentStep} className={cx("mx-auto px-8 pb-24", showSplitLayout || step.credSection === "overview" ? "max-w-[1160px]" : "max-w-[760px]")}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>

                    {/* Step header — sticky so the title/progress/icon stay visible while
                        scrolling a long instructions list. Background matches <main> so
                        the body content doesn't show through as it scrolls underneath.
                        On the Overview step the outer container is wider (so the body
                        below can spread out), but the header itself stays pinned to the
                        original narrower width via this inner max-w wrapper. */}
                    <div className="sticky top-0 z-10 bg-[#FDFDFD] pt-9 dark:bg-primary print:static">
                        <div className={step.credSection === "overview" ? "mx-auto max-w-[760px]" : undefined}>
                            {/* breadcrumb + quick back/next — lets users move between steps
                                without scrolling to the bottom of a long instructions list. */}
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-[12px] font-medium text-quaternary">
                                    <span>Step {visibleStepPosition} of {visibleStepCount}</span>
                                    <span>·</span>
                                    <span>{filledForms} of {formSteps.length} forms filled</span>
                                </div>
                                <div className="flex items-center gap-1.5 print:hidden">
                                    <button type="button" onClick={() => navigate(currentStep - 1)} disabled={currentStep === 0} title="Back"
                                        className="flex size-7 items-center justify-center rounded-lg border border-secondary text-secondary transition hover:bg-secondary disabled:pointer-events-none disabled:opacity-30">
                                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
                                    </button>
                                    <button type="button"
                                        onClick={() => {
                                            if (currentStep < steps.length - 1) { setVisited(v => new Set(v).add(currentStep)); navigate(currentStep + 1); }
                                            else setShowComplete(true);
                                        }}
                                        title={currentStep < steps.length - 1 ? "Next" : "Complete Onboarding"}
                                        className="flex size-7 items-center justify-center rounded-lg border border-secondary text-secondary transition hover:bg-secondary">
                                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
                                    </button>
                                </div>
                            </div>

                            {/* title */}
                            <div className="mb-4 flex items-center gap-3">
                                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
                                    {(() => { const Icon = STEP_ICON[step.credSection]; return <Icon className="size-5" aria-hidden="true" />; })()}
                                </span>
                                {editing ? (
                                    <input type="text" value={step.title}
                                        onChange={e => updateField(currentStep, "title", e.target.value)}
                                        className="w-full border-0 bg-transparent text-[32px] font-bold leading-10 tracking-tight text-primary outline-none"
                                    />
                                ) : (
                                    <h1 className="text-[32px] font-bold leading-10 tracking-tight text-primary">{step.title}</h1>
                                )}
                            </div>

                            <hr className="mb-6 border-secondary" />
                        </div>
                    </div>

                    {/* ── Overview step ── */}
                    {step.credSection === "overview" ? (
                        <>
                            <div className="mb-6 flex items-start justify-between gap-4">
                                <p className="text-[15px] leading-relaxed text-secondary">{step.description}</p>
                                {/* Team-only — clients never see this. Uses the browser's print
                                    dialog (Save as PDF) rather than a PDF library, so the exported
                                    copy always matches whatever's on screen. */}
                                {isTeam && (
                                    <button type="button" onClick={() => window.print()}
                                        className="flex shrink-0 items-center gap-2 rounded-xl border border-secondary bg-primary px-4 py-2.5 text-[13px] font-semibold text-secondary transition hover:bg-secondary print:hidden">
                                        <Download01 className="size-4" aria-hidden="true" />
                                        Download PDF
                                    </button>
                                )}
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="size-5 animate-spin rounded-full border-2 border-secondary border-t-brand-600" />
                                    <span className="ml-3 text-[14px] text-tertiary">Loading…</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    {steps
                                        .map((s, idx) => ({ s, num: visiblePosition(idx) })) // matches the sidebar's own renumbering when steps are hidden
                                        .filter(({ s }) => CRED_FORM_SECTIONS.includes(s.credSection) && !hiddenSteps.includes(s.credSection))
                                        .map(({ s, num }) => (
                                            <OverviewSection key={s.credSection} num={num} title={s.title} label={CRED_SECTION_LABEL[s.credSection]} icon={STEP_ICON[s.credSection]} locked={locked} rows={
                                                s.credSection === "stripe"
                                                    ? Array.from({ length: MAX_STRIPE_ACCOUNTS }, (_, i) => i + 1)
                                                        .filter(n => n === 1 || cred(stripeKeys(n).pk) || cred(stripeKeys(n).sk) || cred(stripeKeys(n).wh))
                                                        .flatMap(n => {
                                                            const k = stripeKeys(n);
                                                            const prefix = n === 1 ? "" : `Account ${n} — `;
                                                            return [
                                                                ...(n === 1 ? [] : [{ label: `${prefix}Title`, value: cred(k.title) }]),
                                                                { label: `${prefix}Publishable Key`, value: cred(k.pk) },
                                                                { label: `${prefix}Secret Key`, value: cred(k.sk) },
                                                                { label: `${prefix}Webhook Signing Secret`, value: cred(k.wh) },
                                                                ...(n === 1 ? [] : [{ label: `${prefix}Note`, value: cred(k.note) }]),
                                                            ];
                                                        })
                                                    : [
                                                        { label: "Account User name", value: cred(`${s.credSection}_username`) },
                                                        { label: "Password", value: cred(`${s.credSection}_password`) },
                                                    ]
                                            } />
                                        ))}

                                    <div className="mt-2 rounded-2xl border border-secondary bg-primary p-6 text-center shadow-md transition-shadow duration-200 hover:shadow-xl lg:col-span-2">
                                        {locked ? (
                                            <>
                                                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-success-secondary">
                                                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-success-primary"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
                                                </div>
                                                <p className="mb-1 text-[16px] font-bold text-primary">Submission Locked</p>
                                                <p className="mb-4 text-[13px] text-tertiary">Your credentials are saved and partially hidden for security. Click the unlock button (bottom-right) to make changes.</p>
                                                <span className="inline-flex items-center gap-2 rounded-xl border border-success-primary/30 bg-success-primary/5 px-5 py-2.5 text-[14px] font-semibold text-success-primary">
                                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                                                    Locked
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <p className="mb-1 text-[16px] font-bold text-primary">Ready to submit?</p>
                                                <p className="mb-4 text-[13px] text-tertiary">Click Save to lock your submission. Values will be partially hidden and your developer will be able to retrieve them securely.</p>
                                                <button type="button" onClick={handleOverviewSave}
                                                    disabled={overviewSaveStatus === "saving"}
                                                    className="rounded-xl bg-primary-solid px-8 py-3 text-[15px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
                                                    {overviewSaveStatus === "saving" ? "Saving…" : overviewSaveStatus === "saved" ? "✓ Saved & Locked!" : "Save"}
                                                </button>
                                                {overviewSaveStatus === "error" && <p className="mt-3 text-[13px] text-error-primary">Save failed — check your connection</p>}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : showSplitLayout ? (
                        /* ── Regular step, split: scrolling body + sticky credential column ── */
                        <div className="flex items-stretch gap-8">
                            <div className="min-w-0 flex-1">{stepBody}</div>
                            <div className="w-[424px] shrink-0">
                                {/* top-[135px] clears the sticky step header (breadcrumb +
                                    icon + title + hr, ~127px tall) above it, so this column
                                    sticks just below the header instead of hiding underneath
                                    it. Caps at the viewport so a tall form (e.g. several
                                    Stripe accounts) scrolls within itself instead of being
                                    cut off. Padded on the sides/bottom so the card's shadow
                                    (incl. the hover:shadow-xl bump) has room instead of being
                                    clipped by this container's own overflow-y-auto edge — top
                                    padding stays minimal so the card lines up with the body
                                    column instead of sitting noticeably lower. */}
                                <div className="sticky top-[135px] max-h-[calc(100vh-11rem)] overflow-y-auto px-8 pt-2 pb-8">
                                    {credentialForm}
                                    {backNextButtons}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* ── Regular step, single column (PMS / Domain — no instructions to
                            scroll alongside, so the form just stays inline) ── */
                        <>
                            {stepBody}
                            {credentialForm}
                        </>
                    )}

                    {/* Split-layout steps already have Back/Next right under the credential
                        form (inside the sticky column above) — no need to repeat them here. */}
                    {!showSplitLayout && backNextButtons}
                </motion.div>
            </main>

            {/* floating revert-to-snapshot — template only, sits above the lock */}
            {isTeam && isTemplate && (
                <button type="button" onClick={revertToSnapshot}
                    title="Revert to Owner Guide Snapshot"
                    className="fixed bottom-[72px] right-5 z-40 flex size-11 items-center justify-center rounded-full bg-primary text-quaternary shadow-lg ring-1 ring-secondary transition duration-100 ease-linear hover:bg-secondary hover:text-secondary print:hidden">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                </button>
            )}

            {/* floating lock/unlock — HGM team only */}
            {isTeam && (
                <button type="button" onClick={() => setLocked(l => !l)}
                    title={locked ? "Unlock editing" : "Lock editing"}
                    className={cx(
                        "fixed bottom-5 right-5 z-40 flex size-11 items-center justify-center rounded-full shadow-lg ring-1 transition duration-100 ease-linear print:hidden",
                        editing ? "bg-brand-600 ring-brand-600 text-white hover:bg-brand-700" : "bg-primary ring-secondary text-quaternary hover:bg-secondary hover:text-secondary",
                    )}>
                    {locked ? (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
                    ) : (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 017.5-1.9" /></svg>
                    )}
                </button>
            )}

            {/* completion modal */}
            <AnimatePresence>
                {showComplete && (
                    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm" onClick={() => setShowComplete(false)}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}>
                        <motion.div className="w-full max-w-sm rounded-2xl bg-primary p-8 text-center shadow-2xl" onClick={e => e.stopPropagation()}
                            initial={{ scale: 0.9, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 8 }}
                            transition={{ type: "spring", stiffness: 320, damping: 26 }}>
                            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-success-secondary text-4xl">🎉</div>
                            <h2 className="mb-2 text-[22px] font-bold text-primary">Onboarding Complete!</h2>
                            <p className="mb-6 text-[14px] leading-relaxed text-tertiary">Your PMS, Netlify, Supabase, Resend, domain, and Cloudflare logins are saved securely for your developer to configure.</p>
                            <button type="button" onClick={() => setShowComplete(false)}
                                className="w-full rounded-xl bg-success-solid py-3 text-[15px] font-semibold text-white transition hover:opacity-90">
                                Done
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* create-guide popup */}
            <CreateGuideModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(s) => { setCreateOpen(false); navigateTo(`/owner-guide/${s}`); }} />

            {/* Stripe accounts popup — every account (starting with the primary,
                Account 1) side by side in a grid, so clients with several Stripe
                accounts (separate properties/brands) get room to manage them all. */}
            <AnimatePresence>
                {showStripeAccountsModal && (
                    <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 py-8"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
                        onMouseDown={e => { if (e.target === e.currentTarget) setShowStripeAccountsModal(false); }}>
                        <motion.div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl bg-primary shadow-2xl ring-1 ring-secondary"
                            initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
                            transition={{ type: "spring", stiffness: 300, damping: 26 }}>
                            <div className="flex items-center justify-between gap-3 border-b border-secondary px-6 py-4">
                                <div>
                                    <h3 className="text-md font-semibold text-primary">Stripe accounts</h3>
                                    <p className="mt-0.5 text-sm text-tertiary">For clients with more than one Stripe account — e.g. separate properties or brands.</p>
                                </div>
                                <button type="button" onClick={() => setShowStripeAccountsModal(false)} title="Close"
                                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-tertiary transition hover:bg-secondary hover:text-primary">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto px-6 py-5">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {Array.from({ length: stripeAccountsToRender }, (_, i) => i + 1).map(n => {
                                        const k = stripeKeys(n);
                                        const isLast = n === stripeAccountsToRender;
                                        return (
                                            <div key={n} className="flex flex-col rounded-xl border border-secondary bg-secondary p-4">
                                                <div className="mb-3 flex items-center justify-between gap-2">
                                                    <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-quaternary">
                                                        Account {n}{n === 1 && " (primary)"}
                                                    </span>
                                                    {n > 1 && isLast && (
                                                        <button type="button"
                                                            onClick={() => {
                                                                doClear("stripe", [k.pk, k.sk, k.wh, k.title, k.note]);
                                                                setStripeAccountsShown(s => Math.max(1, Math.min(s, stripeAccountsToRender) - 1));
                                                            }}
                                                            className="text-[11px] font-semibold text-error-primary transition hover:underline">
                                                            Remove
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-3">
                                                    <CredField label="Title" placeholder="e.g. Sunset Villas — main property" value={cred(k.title)} onChange={v => setCred(k.title, v)} />
                                                    <CredField label="Publishable Key" placeholder="pk_live_…" value={cred(k.pk)} onChange={v => setCred(k.pk, v)} />
                                                    <SecretField label="Secret Key" placeholder="sk_live_…" value={cred(k.sk)} onChange={v => setCred(k.sk, v)} />
                                                    <SecretField label="Webhook Signing Secret" placeholder="whsec_…" value={cred(k.wh)} onChange={v => setCred(k.wh, v)} />
                                                    <div className="flex flex-col gap-1.5">
                                                        <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-quaternary">Note</label>
                                                        <textarea rows={2} value={cred(k.note)} onChange={e => setCred(k.note, e.target.value)}
                                                            placeholder="Optional — what's this account for?"
                                                            className="w-full flex-1 resize-none rounded-xl border border-secondary bg-primary px-3.5 py-2.5 text-[14px] text-primary outline-none transition duration-100 ease-linear focus:border-brand focus:ring-1 focus:ring-brand placeholder:text-placeholder"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {stripeAccountsToRender < MAX_STRIPE_ACCOUNTS && (
                                        <button type="button"
                                            onClick={() => setStripeAccountsShown(Math.min(MAX_STRIPE_ACCOUNTS, stripeAccountsToRender + 1))}
                                            className="flex min-h-[200px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary text-[13px] font-semibold text-tertiary transition hover:border-brand hover:bg-brand-50 hover:text-brand-700">
                                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                                            Add another account
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 border-t border-secondary px-6 py-4">
                                <button type="button" onClick={() => setShowStripeAccountsModal(false)}
                                    className="rounded-lg border border-secondary px-4 py-2 text-sm font-semibold text-secondary transition hover:bg-secondary">
                                    Close
                                </button>
                                <button type="button"
                                    onClick={() => { doSave("stripe"); setShowStripeAccountsModal(false); }}
                                    className="rounded-lg bg-brand-solid px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
                                    Save
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* share-password gate */}
            <AnimatePresence>
                {gateOpen && (
                    <motion.div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                        <motion.div className="w-full max-w-sm rounded-2xl bg-primary p-7 text-center shadow-2xl ring-1 ring-secondary"
                            initial={{ opacity: 0, scale: 0.94, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
                            transition={{ type: "spring", stiffness: 300, damping: 26 }}>
                            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950/40">
                                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
                            </div>
                            <h2 className="text-[18px] font-bold text-primary">{meta?.client_name ?? "Owner guide"}</h2>
                            <p className="mt-1 text-[13px] text-tertiary">Enter the password your team shared with you to view this guide.</p>
                            <input type="password" value={gateInput} autoFocus
                                onChange={e => { setGateInput(e.target.value); setGateError(false); }}
                                onKeyDown={e => { if (e.key === "Enter") submitGate(); }}
                                placeholder="Password"
                                className={cx(
                                    "mt-4 w-full rounded-lg border px-3 py-2.5 text-sm text-primary placeholder:text-placeholder outline-none transition focus:ring-1",
                                    gateError ? "border-error focus:border-error focus:ring-error" : "border-secondary focus:border-brand focus:ring-brand",
                                )} />
                            {gateError && <p className="mt-2 text-[12px] text-error-primary">Incorrect password.</p>}
                            <button type="button" onClick={submitGate}
                                className="mt-4 w-full rounded-lg bg-brand-solid py-2.5 text-sm font-semibold text-white transition hover:opacity-90">
                                View guide
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </AppShell>
    );
};
