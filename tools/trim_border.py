"""Trims a near-white border from a generated image in place and restores its original size.

Usage: python3 -I tools/trim_border.py <image> [<image> ...]
A side is trimmed only while its outermost row/column is almost entirely near-white, so bright
skies and other painted content are never cut. Prints 'trimmed <file>' when it changed something.
"""
import sys
from PIL import Image

NEAR_WHITE = 244      # every channel at or above this counts as white
WHITE_SHARE = 0.985   # a line is border if at least this share of it is near-white
MARGIN = 3            # extra pixels removed inside the border (anti-aliased edge)
MIN_TRIM = 4          # ignore borders thinner than this


def is_border(pixels):
    white = sum(1 for p in pixels if min(p[:3]) >= NEAR_WHITE)
    return white / len(pixels) >= WHITE_SHARE


def trim(path):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    row = lambda y: list(img.crop((0, y, w, y + 1)).getdata())
    col = lambda x: list(img.crop((x, 0, x + 1, h)).getdata())

    top = 0
    while top < h // 4 and is_border(row(top)):
        top += 1
    bottom = 0
    while bottom < h // 4 and is_border(row(h - 1 - bottom)):
        bottom += 1
    left = 0
    while left < w // 4 and is_border(col(left)):
        left += 1
    right = 0
    while right < w // 4 and is_border(col(w - 1 - right)):
        right += 1

    if max(top, bottom, left, right) < MIN_TRIM:
        return False
    box = (
        left + MARGIN if left else 0,
        top + MARGIN if top else 0,
        w - (right + MARGIN if right else 0),
        h - (bottom + MARGIN if bottom else 0),
    )
    out = img.crop(box).resize((w, h), Image.LANCZOS)
    if path.lower().endswith(".webp"):
        out.save(path, "WEBP", quality=86)
    else:
        out.save(path)
    return True


if __name__ == "__main__":
    for p in sys.argv[1:]:
        if trim(p):
            print("trimmed", p)
