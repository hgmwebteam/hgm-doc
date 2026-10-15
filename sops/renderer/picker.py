"""Shared logic for the task picker ("What are you trying to do?").

The picker is built from meta.tasks and belongs at the head of the Procedure
section, not in the JSON. Three renderers use this:
  - to_html.py draws its interactive picker there (and drops any hand-built
    picker cards it finds in that spot, so older files do not show two);
  - hgm_doc.py and to_markdown.py synthesise a `sub` + `cards` there for
    print, unless the file already carries hand-built picker cards.
"""

PICKER_H = "What are you trying to do?"
PICKER_D = "Pick the phase that matches your situation and jump straight to its tasks."


def procedure_index(blocks):
    """Index of the section block that holds the first phase (`sub` with id), or None."""
    cur = None
    for i, b in enumerate(blocks):
        t = b.get("type")
        if t == "section":
            cur = i
        elif t == "sub" and b.get("id") and cur is not None:
            return cur
    return None


def picker_span(blocks):
    """(start, end) indices of the blocks between the Procedure heading and its
    first phase — where a hand-built picker would live. end is exclusive."""
    p = procedure_index(blocks)
    if p is None:
        return None
    j = p + 1
    while j < len(blocks) and not (blocks[j].get("type") == "sub" and blocks[j].get("id")):
        j += 1
    return p + 1, j


def manual_picker_present(blocks):
    span = picker_span(blocks)
    if not span:
        return False
    return any(b.get("type") == "cards" and any(it.get("k") for it in b.get("items", []))
               for b in blocks[span[0]:span[1]])


def synthesised_blocks(meta):
    """`sub` + `cards` rows drawn from meta.tasks, three to a row, for print."""
    tasks = meta.get("tasks") or []
    if not tasks:
        return []
    out = [{"type": "sub", "text": meta.get("picker_h", PICKER_H),
            "d": meta.get("picker_d", PICKER_D)}]
    for i in range(0, len(tasks), 3):
        out.append({"type": "cards", "cols": 3, "items": [
            {"k": t.get("badge", ""), "t": t.get("label", ""), "d": t.get("hint", "")}
            for t in tasks[i:i + 3]]})
    return out


def blocks_for_print(doc):
    """Blocks with the picker synthesised in place when the file has none."""
    blocks = list(doc.get("blocks", []))
    meta = doc.get("meta", {})
    p = procedure_index(blocks)
    if p is None or manual_picker_present(blocks) or not meta.get("tasks"):
        return blocks
    return blocks[:p + 1] + synthesised_blocks(meta) + blocks[p + 1:]
