import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import path from "path";
import { defineConfig } from "vite";
import { GIT_LOG_FORMAT, parseGitLog } from "./src/lib/portal-releases.ts";

/**
 * /log's Releases: the history of the commit being built, read once as the build (or dev
 * server) starts. A checkout with no git, or a shallow one (ci.yml's), gives a short or empty
 * list rather than a failed build.
 */
const releases = () => {
    try {
        const raw = execFileSync("git", ["log", "--first-parent", "-n", "300", `--format=${GIT_LOG_FORMAT}`], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
        return parseGitLog(raw);
    } catch {
        return [];
    }
};

export default defineConfig({
    plugins: [react(), tailwindcss()],
    define: {
        __PORTAL_RELEASES__: JSON.stringify(releases()),
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    // Dev only. `netlify dev` would serve the functions itself, but its SPA fallback
    // rewrites every route to /index.html and Vite then tries to import-analyse that as a
    // module, so pages render blank. Running the functions alone (`netlify functions:serve
    // --port 9999`) and proxying to them keeps Vite in charge of the page and still lets
    // /.netlify/functions/* work locally. Production is unaffected — Netlify routes these.
    server: {
        proxy: {
            "/.netlify/functions": "http://localhost:9999",
        },
    },
});
