"""The HGM document icon set.

One vocabulary of callouts across every SOP, so a reader learns the shapes once
and carries them between documents. Icons are inline SVG — no font, no image
file, no network — and inherit `currentColor`, so each callout tints its own.

Adding a kind here means adding it to `hgm-doc.css` and to the `to_html.py`
stylesheet as well. Do not invent a one-off icon inside a document.
"""

_S = ('<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
      'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" '
      'aria-hidden="true">{}</svg>')

_PATHS = {
    # ── callout kinds ────────────────────────────────────────────────────────
    # the rule you must carry out of this document — HGM's own gem, traced from
    # the wordmark's outer silhouette. The logo's inner "M" is dropped: at 15px
    # it collapses into mud. Flat table, flared shoulders, single point.
    "brand":    '<path d="M6.9 3h10.2L21.8 9 12 21 2.2 9z"/><path d="M2.2 9h19.6"/>',
    # context: why the step is the way it is. Nothing to do.
    "note":     '<circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/>',
    # you can get this wrong; slow down
    "warning":  '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'
                '<path d="M12 9v4"/><path d="M12 17h.01"/>',
    # this breaks the live site, costs money, or cannot be undone
    "critical": '<path d="M4.9 4.9 12 2l7.1 2.9L22 12l-2.9 7.1L12 22l-7.1-2.9L2 12z"/>'
                '<path d="m15 9-6 6M9 9l6 6"/>',
    # the recommended default; what good looks like
    "success":  '<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="m9 11 3 3L22 4"/>',

    # ── route kinds, shared by the route cards and the code label bars ──────
    "click":    '<path d="m4 3 7.1 17.2 2.4-6.9 6.9-2.4z"/><path d="m13.5 13.5 5.4 5.4"/>',
    "terminal": '<path d="m5 7 4.5 5L5 17"/><path d="M13 17h6"/>'
                '<rect x="2" y="3" width="20" height="18" rx="3"/>',
    "prompt":   '<path d="M11.4 3.6a.7.7 0 0 1 1.2 0l1.9 4.3 4.3 1.9a.7.7 0 0 1 0 1.2l-4.3 1.9'
                '-1.9 4.3a.7.7 0 0 1-1.2 0l-1.9-4.3-4.3-1.9a.7.7 0 0 1 0-1.2l4.3-1.9z"/>'
                '<path d="M18.5 16.5 19 18l1.5.5-1.5.5-.5 1.5-.5-1.5L16.5 18l1.5-.5z"/>',

    # ── platforms: where the reader is working. The route cards and the
    #    route selector use these; code label bars keep the kind icons above. ──
    # VS Code: a window with a code bracket
    "vscode":   '<rect x="2" y="3" width="20" height="18" rx="3"/><path d="M2 8h20"/>'
                '<path d="m9.5 12-2 2 2 2M14.5 12l2 2-2 2"/>',
    # the Claude Desktop app: a monitor on a stand
    "desktop":  '<rect x="2" y="3" width="20" height="14" rx="2.5"/><path d="M8 21h8M12 17v4"/>',

    # exact wording to post to a person — a chat message, an Asana comment
    "message":  '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-3.8-.8L3 21l1.9-5.1'
                'A8.4 8.4 0 0 1 4 11.5 8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"/>'
                '<path d="M8.5 11.5h8M8.5 15h5"/>',

    # ── the result you should be looking at ─────────────────────────────────
    "expect":   '<path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z"/>'
                '<circle cx="12" cy="12" r="2.6"/>',
}

# What each callout means. Quoted in the skill and the design system so the
# choice is a decision, not a mood.
MEANING = {
    "brand":    "the rule to carry out of this document",
    "note":     "context — why the step is the way it is; nothing to do",
    "warning":  "you can get this wrong; slow down",
    "critical": "breaks the live site, costs money, or cannot be undone",
    "success":  "the recommended default; what good looks like",
}


# WeasyPrint resolves `currentColor` from the svg element's OWN colour only —
# not from a parent, and not from a stylesheet rule on `.ic`. So the print
# renderer passes the colour in and the screen renderer lets CSS inherit.
# These are the same hexes as `hgm-doc.css`; change both together.
PRINT_COLOR = {
    "brand": "#5B3FBF", "note": "#3A424D", "warning": "#A16207",
    "critical": "#DC2626", "success": "#15803D",
    "click": "#15803D", "terminal": "#3A424D", "prompt": "#004FAA",
    "message": "#3A424D",
    "vscode": "#004FAA", "desktop": "#004FAA",
    "expect": "#004FAA",
}


def icon(name, color=None):
    """Inline SVG for `name`, or an empty string if there is no such icon.

    Pass `color` for print. Leave it off on screen so the callout's own colour
    (and the dark-theme override) flows through `currentColor`.
    """
    p = _PATHS.get(name)
    if not p:
        return ""
    svg = _S.format(p)
    if color:
        svg = svg.replace('<svg ', '<svg style="color:%s" ' % color, 1)
    return svg
