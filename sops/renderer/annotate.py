#!/usr/bin/env python3
"""
Draw the HGM click marker on a screenshot.

  python3 annotate.py shot.png out.png 0.34 0.90 0.10
  python3 annotate.py --batch targets.json

The marker is a solid orange ring with a translucent orange interior — the same
treatment Scribe uses, so a walkthrough built here reads the way people already
expect one to. Colour #F8943D, sampled from a Scribe marker.

This orange is a screenshot annotation, not a document accent. The design
system's ban is on gem yellow #FFD602 and applies to document colour; nothing in
a figure's own pixels uses brand colour.

Placing the ring
----------------
Find the target by pixel, not by eye. Eyeballing a thumbnail routinely puts the
ring in empty space next to the button. UI accent buttons and highlighted menu
rows are a distinct saturated blue, so a mask like

    (b > 120) & (b - r > 50) & (b - g > 30)

over the region of interest gives you the centre in one pass. `--find-blue`
does exactly that.

targets.json for --batch:
  {"f2-clone.png": {"out": "figa/f2-clone.png", "cx": 0.34, "cy": 0.90, "r": 0.10}}
"""

import json
import sys

from PIL import Image, ImageDraw, ImageFilter

MARKER = (248, 148, 61)      # #F8943D
FILL_ALPHA = 34              # ~13% — see-through, but the tint is noticeable
HALO_ALPHA = 70              # soft white lift so the ring holds on dark UI
STROKE_FRAC = 0.005          # ring width as a fraction of image width


def annotate(src, dst, cx, cy, r, marker=MARKER):
    """cx, cy, r are fractions of the image width (r) and of each axis (cx, cy)."""
    im = Image.open(src).convert("RGBA")
    W, H = im.size
    x, y, rad = cx * W, cy * H, r * W

    halo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(halo).ellipse(
        [x - rad * 1.28, y - rad * 1.28, x + rad * 1.28, y + rad * 1.28],
        fill=(255, 255, 255, HALO_ALPHA))
    im = Image.alpha_composite(im, halo.filter(
        ImageFilter.GaussianBlur(radius=max(6, rad * 0.30))))

    ring = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse(
        [x - rad, y - rad, x + rad, y + rad],
        fill=marker + (FILL_ALPHA,),
        outline=marker + (255,),
        width=max(3, int(W * STROKE_FRAC)))
    im = Image.alpha_composite(im, ring)

    im.convert("RGB").save(dst)
    return W, H


def find_blue(src, ymin=0.0, ymax=1.0):
    """Centre of the largest saturated-blue band — a UI accent button or a
    highlighted menu row. Returns (cx, cy) as fractions, or None."""
    import numpy as np
    a = np.asarray(Image.open(src).convert("RGB")).astype(int)
    H, W, _ = a.shape
    y0, y1 = int(H * ymin), int(H * ymax)
    sub = a[y0:y1]
    r, g, b = sub[:, :, 0], sub[:, :, 1], sub[:, :, 2]
    mask = (b > 120) & (b - r > 50) & (b - g > 30)
    ys, xs = np.nonzero(mask)
    if len(xs) < 200:
        return None
    from collections import Counter
    band = max(Counter(ys // 8), key=Counter(ys // 8).get) * 8
    sel = (ys >= band - 14) & (ys <= band + 14)
    return xs[sel].mean() / W, (ys[sel].mean() + y0) / H


def main():
    if len(sys.argv) >= 3 and sys.argv[1] == "--batch":
        with open(sys.argv[2]) as f:
            targets = json.load(f)
        for src, t in targets.items():
            w, h = annotate(src, t["out"], t["cx"], t["cy"], t["r"])
            print(f"{t['out']}  {w}x{h}  ring at ({t['cx']:.3f}, {t['cy']:.3f})")
        return

    if len(sys.argv) >= 4 and sys.argv[1] == "--find-blue":
        got = find_blue(sys.argv[2],
                        float(sys.argv[3]) if len(sys.argv) > 3 else 0.0,
                        float(sys.argv[4]) if len(sys.argv) > 4 else 1.0)
        print(f"{got[0]:.3f} {got[1]:.3f}" if got else "no blue region found")
        return

    if len(sys.argv) != 6:
        sys.exit(__doc__.strip())
    annotate(sys.argv[1], sys.argv[2], *(float(v) for v in sys.argv[3:6]))
    print(f"Wrote {sys.argv[2]}")


if __name__ == "__main__":
    main()
