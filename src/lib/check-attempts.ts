import { supabase } from "@/lib/supabase";
import type { AnswerRow, CheckMode, PlanEntry, TermStatus } from "@/pages/team/dictionary/check/check-model";

/**
 * Every Supabase call the Industry Acumen check makes, in one place, so the table names,
 * columns and error handling live together. Tables, policies and the reasons for them:
 * supabase/migrations/20261001120000_dictionary_check.sql.
 *
 * Row-level security already limits every read to the signed-in person's own rows; the
 * `user_id` filters below say so again, so a policy mistake could never show one person
 * someone else's check.
 *
 * Every function throws on failure. Callers show it ("Not saved yet", "Couldn't load your
 * check"), so a swallowed error here would read as a save that worked.
 */

export type CheckAttempt = {
    id: string;
    mode: CheckMode;
    bank_version: string;
    plan: PlanEntry[];
    started_at: string;
    completed_at: string | null;
    score_pct: number | null;
    grade: string | null;
    missed_count: number | null;
};

export type CheckAnswer = AnswerRow & { answered_at: string };

const ATTEMPT_COLUMNS = "id, mode, bank_version, plan, started_at, completed_at, score_pct, grade, missed_count";

/** Every sitting the person has, open one included, newest first. */
export async function listAttempts(userId: string): Promise<CheckAttempt[]> {
    const { data, error } = await supabase.from("check_attempts").select(ATTEMPT_COLUMNS).eq("user_id", userId).order("started_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as CheckAttempt[];
}

/** The person's current status per term: their latest answer to each, from finished sittings only. */
export async function listTermStatus(userId: string): Promise<TermStatus[]> {
    const { data, error } = await supabase.from("check_term_status").select("term_slug, correct, item_id, variant_id, answered_at").eq("user_id", userId);
    if (error) throw error;
    return (data ?? []) as TermStatus[];
}

/** One sitting's answers, oldest first, so the last row per term is the one that counts. */
export async function listAnswers(userId: string, attemptId: string): Promise<CheckAnswer[]> {
    const { data, error } = await supabase
        .from("check_answers")
        .select("item_id, variant_id, term_slug, correct, answered_at")
        .eq("user_id", userId)
        .eq("attempt_id", attemptId)
        .order("answered_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as CheckAnswer[];
}

/** Starts a sitting. The database fills in who and when; a second open sitting is refused. */
export async function startAttempt(input: { mode: CheckMode; bankVersion: string; plan: PlanEntry[] }): Promise<CheckAttempt> {
    const { data, error } = await supabase
        .from("check_attempts")
        .insert({ mode: input.mode, bank_version: input.bankVersion, plan: input.plan })
        .select(ATTEMPT_COLUMNS)
        .single();
    if (error) throw error;
    return data as CheckAttempt;
}

/** "Start again": removes an open sitting and its answers. A finished one can't be removed. */
export async function discardAttempt(attemptId: string): Promise<void> {
    const { error } = await supabase.from("check_attempts").delete().eq("id", attemptId).is("completed_at", null);
    if (error) throw error;
}

/**
 * "Reset your results": removes every sitting the person has, finished ones included, and their
 * answers with them (ON DELETE CASCADE). Finished sittings can only be removed once
 * supabase/migrations/20261006120000_check_reset.sql is in place; without it the database skips
 * them silently, so this returns how many sittings are left, and anything above 0 means the reset
 * didn't go through.
 */
export async function resetAttempts(userId: string): Promise<number> {
    const { error } = await supabase.from("check_attempts").delete().eq("user_id", userId);
    if (error) throw error;
    return (await listAttempts(userId)).length;
}

/** Adds answer rows to an open sitting. Answers are never edited: a changed answer is a newer row. */
export async function saveAnswers(attemptId: string, rows: AnswerRow[]): Promise<void> {
    if (!rows.length) return;
    const { error } = await supabase.from("check_answers").insert(rows.map((r) => ({ ...r, attempt_id: attemptId })));
    if (error) throw error;
}

/**
 * Finishes a sitting with the score it leaves the person with. Returns false if it was
 * already finished (another tab got there first), which callers treat as done.
 */
export async function finishAttempt(attemptId: string, result: { score_pct: number; grade: string; missed_count: number }): Promise<boolean> {
    const { data, error } = await supabase
        .from("check_attempts")
        .update({ ...result, completed_at: new Date().toISOString() })
        .eq("id", attemptId)
        .is("completed_at", null)
        .select("id");
    if (error) throw error;
    return (data ?? []).length > 0;
}
