import { useEffect, useState } from "react";

/**
 * Web Team → Landing Page → Client Asset Collection: the Media Collection Form, inside the
 * dashboard.
 *
 * The form is the standalone `media-collection-form.html` beside this file, copied verbatim
 * and shown in an iframe — not a port. It is ~3,900 lines of self-contained CSS and vanilla
 * JS (resets on `html`/`body`/`*`, native `<dialog>`s, document-level listeners,
 * `location.reload()` to start over) posting to a Google Apps Script web app that saves a new
 * client's landing-page photos and text to Drive. Its own window keeps all of that away from
 * the portal's theme and shortcuts, and keeps the file replaceable: to update the form, copy
 * the new file over under the same name (it is in `.prettierignore`, so a format pass never
 * rewrites it). Never edit it here.
 *
 * Deliberately unsandboxed: it is our own file at our own origin, `allow-scripts` plus
 * `allow-same-origin` would give no isolation anyway, and a partial sandbox silently breaks
 * its `_blank` links, the Maps and Instagram embeds, `showModal()` or the reload. Its
 * localStorage keys (`mc-*`) share the portal's origin and collide with nothing.
 *
 * Loaded with `?raw` through a dynamic import so the 335 KB string is a chunk fetched on
 * first open, not part of the dashboard bundle. The form stays light in dark mode by its own
 * `<meta name="color-scheme" content="light">`; that is the form's choice, not a bug here.
 * Switching dashboard tabs unmounts the frame and drops unsent entries — the same as closing
 * the standalone page — and an upload in flight gets no `beforeunload` prompt then (only a
 * real refresh or close fires it inside a frame); Save draft is the form's own answer to that.
 */
export const AssetCollectionContent = () => {
    const [html, setHtml] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        import("./media-collection-form.html?raw")
            .then((m) => {
                if (!cancelled) setHtml(m.default);
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        // bg-white rather than bg-primary on purpose: the form is light in both modes, and this
        // only shows around the spinner and for the instant before the document paints.
        <div className="flex h-full flex-1 flex-col overflow-hidden rounded-lg bg-white shadow-sm">
            {failed ? (
                <div className="flex flex-1 items-center justify-center p-6">
                    <p className="text-sm text-tertiary">The form didn't load. Check your connection and reload the page.</p>
                </div>
            ) : html === null ? (
                <div className="flex flex-1 items-center justify-center">
                    <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent opacity-60" />
                </div>
            ) : (
                <iframe srcDoc={html} title="Client Asset Collection" className="min-h-0 w-full flex-1 border-0" />
            )}
        </div>
    );
};
