"""Trims a light border (white or cream) from a generated image in place and restores its original size.

Usage: python3 -I tools/trim_border.py <image> [<image> ...]
A side is trimmed only when its outermost lines are almost entirely pale and low-saturation AND the run
ends in a sharp brightness step to the painting. Bright skies and fog fade smoothly, so they are never cut.
Prints 'trimmed <file>' when it changed something.
"""
import sys
from PIL import Image

PALE = 170            # every channel of a border pixel is at least this bright
MAX_SPREAD = 50       # and the channels differ by at most this much (white, cream, grey paper)
BORDER_SHARE = 0.985  # a line is border if at least this share of its pixels are pale
STEP = 30             # required brightness jump between the last border line and the painting
MARGIN = 3            # extra pixels removed inside the border (anti-aliased edge)
MIN_TRIM = 4          # ignore borders thinner than this
MAX_FRACTION = 4      # never trim more than 1/4 of the image from one side


def pale_share(r, g, b):
    """Share of pixels that are pale, given three equal-length byte sequences."""
    pale = sum(
        1
        for pr, pg, pb in zip(r, g, b)
        if min(pr, pg, pb) >= PALE and max(pr, pg, pb) - min(pr, pg, pb) <= MAX_SPREAD
    )
    return pale / len(r)


def trim(path):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    data = img.tobytes()  # RGB, row-major
    stride = w * 3

    def row_channels(y):
        base = y * stride
        return data[base:base + stride:3], data[base + 1:base + stride:3], data[base + 2:base + stride:3]

    def col_channels(x):
        return data[x * 3::stride], data[x * 3 + 1::stride], data[x * 3 + 2::stride]

    def luma(chans):
        return sum(sum(c) for c in chans) / (3 * len(chans[0]))

    def run_length(size, channels):
        """Border lines counted from index 0 of `channels(i)`, or 0 if the run has no sharp inner edge."""
        n = 0
        while n < size // MAX_FRACTION and pale_share(*channels(n)) >= BORDER_SHARE:
            n += 1
        if n < MIN_TRIM or n + 3 >= size:
            return 0
        return n if abs(luma(channels(n - 1)) - luma(channels(n + 3))) >= STEP else 0

    top = run_length(h, row_channels)
    bottom = run_length(h, lambda i: row_channels(h - 1 - i))
    left = run_length(w, col_channels)
    right = run_length(w, lambda i: col_channels(w - 1 - i))

    if max(top, bottom, left, right) == 0:
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
