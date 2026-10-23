/**
 * /log's Releases: every change in the build you are looking at, read from git when that build
 * ran (vite.config.ts runs `git log --first-parent` and hands the result to this module through
 * `define`). So the list is exactly what is live on the host serving it, with no token, no
 * table and nothing to keep in step: a merged PR shows here once the deploy carrying it is the
 * one serving the page.
 *
 * The repository is public, so titles and authors are already published on GitHub; carrying
 * them in a lazily loaded chunk discloses nothing new. No imports on purpose: vite.config.ts
 * loads this file under Node before any alias exists.
 */

export interface Release {
    /** Short commit hash. */
    sha: string;
    /** The PR's title for a merge or squash, else the commit's subject. */
    title: string;
    /** The PR number when the commit names one. */
    pr: number | null;
    author_name: string;
    /** Lower-cased, so it matches a dashboard update's author_email for the Who filter. */
    author_email: string;
    /** Committer date: when GitHub merged it, for a PR. ISO 8601 with the committer's offset. */
    at: string;
}

/** What vite.config.ts asks git for: unit- and record-separated, so a commit message can hold anything. */
export const GIT_LOG_FORMAT = "%h%x1f%an%x1f%ae%x1f%cI%x1f%s%x1f%b%x1e";

/** A merge that only brought main into a branch (or a branch into itself): nothing of its own went live. */
const SYNC_MERGE = /^Merge (branch|remote-tracking branch|origin\/)/;
/** GitHub's "Create a merge commit": the PR title is the body's first line. */
const PR_MERGE = /^Merge pull request #(\d+) from /;
/** GitHub's "Squash and merge": the PR title with " (#57)" on the end. */
const SQUASH_PR = /\s\(#(\d+)\)$/;

export const parseGitLog = (raw: string): Release[] => {
    const out: Release[] = [];
    for (const record of raw.split("\x1e")) {
        const [sha, name = "", email = "", at = "", subject = "", body = ""] = record.replace(/^\n+/, "").split("\x1f");
        if (!sha || !at || SYNC_MERGE.test(subject)) continue;
        const merged = PR_MERGE.exec(subject);
        const squashed = merged ? null : SQUASH_PR.exec(subject);
        const title = merged
            ? (body
                  .split("\n")
                  .map((line) => line.trim())
                  .find(Boolean) ?? subject)
            : squashed
              ? subject.slice(0, squashed.index)
              : subject;
        const pr = merged ?? squashed;
        out.push({ sha, title, pr: pr ? Number(pr[1]) : null, author_name: name, author_email: email.toLowerCase(), at });
    }
    return out;
};

declare const __PORTAL_RELEASES__: Release[] | undefined;

/** This build's releases, newest first. Empty under Node and in a build that had no git history to read. */
export const RELEASES: Release[] = typeof __PORTAL_RELEASES__ === "undefined" ? [] : __PORTAL_RELEASES__;
