"""Generate web-ready KHETNITI brand assets from the brand-identity boards.

Source boards (design originals, not served):  frontend/assets/brand/*.png
Output (served by Next.js):                     frontend/public/brand/*.png, frontend/src/app/{icon,apple-icon}.png

Each board is a flat background with logo artwork on it. Every pixel is "unmixed" into
background + one ink colour (the inks are detected from the board), which yields a clean,
anti-aliased transparent PNG whose colours stay exactly on-brand on any background.

Usage (needs Pillow + NumPy):
    python3 -m venv /tmp/imgtools && /tmp/imgtools/bin/pip install pillow numpy
    /tmp/imgtools/bin/python frontend/scripts/process_brand_assets.py
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "brand"
OUT = ROOT / "public" / "brand"
APP = ROOT / "src" / "app"

KHET_GREEN = (13, 59, 43)
CREAM = (246, 238, 220)


def load(name: str) -> np.ndarray:
    return np.asarray(Image.open(SRC / name).convert("RGB")).astype(np.float32)


def detect_inks(region: np.ndarray, bg: np.ndarray, min_share: float = 0.01, min_dist: float = 90.0) -> np.ndarray:
    px = region.reshape(-1, 3).astype(np.int32)
    far = px[np.linalg.norm(px - bg, axis=1) > min_dist]
    colors, counts = np.unique(far, axis=0, return_counts=True)
    keep = counts > max(50, counts.sum() * min_share)
    inks = colors[keep].astype(np.float32)
    # merge near-duplicates
    merged: list[np.ndarray] = []
    for c in inks[np.argsort(-counts[keep])]:
        if all(np.linalg.norm(c - m) > 25 for m in merged):
            merged.append(c)
    return np.array(merged, dtype=np.float32)


def unmix(region: np.ndarray, bg: np.ndarray | None = None) -> Image.Image:
    """Return an RGBA image: alpha = coverage of the best-fitting ink, colour = that ink."""
    if bg is None:
        bg = np.median(np.concatenate([region[:8, :8].reshape(-1, 3), region[-8:, -8:].reshape(-1, 3)]), axis=0)
    inks = detect_inks(region, bg)
    h, w, _ = region.shape
    v = region.reshape(-1, 3) - bg  # (N,3)
    d = inks - bg  # (K,3)
    a = (v @ d.T) / (d * d).sum(axis=1)  # (N,K)
    resid = np.linalg.norm(v[:, None, :] - a[:, :, None] * d[None, :, :], axis=2)
    resid += np.where((a < -0.05) | (a > 1.1), 1e6, 0)
    k = resid.argmin(axis=1)
    alpha = np.clip(a[np.arange(len(k)), k], 0, 1)
    alpha[alpha < 0.03] = 0
    rgb = inks[k]
    rgba = np.concatenate([rgb, (alpha * 255)[:, None]], axis=1).reshape(h, w, 4)
    return Image.fromarray(rgba.round().astype(np.uint8), "RGBA")


def trim(img: Image.Image, pad_ratio: float = 0.04) -> Image.Image:
    bbox = img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    img = img.crop(bbox)
    pad = int(max(img.size) * pad_ratio)
    canvas = Image.new("RGBA", (img.width + 2 * pad, img.height + 2 * pad), (0, 0, 0, 0))
    canvas.paste(img, (pad, pad))
    return canvas


def recolor(img: Image.Image, rgb: tuple[int, int, int]) -> Image.Image:
    out = Image.new("RGBA", img.size, rgb + (0,))
    out.putalpha(img.getchannel("A"))
    return out


def drop_tagline(img: Image.Image, mark_right_frac: float = 0.24) -> Image.Image:
    """Remove the tagline line that sits under the wordmark, right of the K mark."""
    a = np.asarray(img.getchannel("A")).copy()
    x0 = int(img.width * mark_right_frac)
    rows = (a[:, x0:] > 20).any(axis=1)
    runs, start = [], None
    for y, on in enumerate(rows):
        if on and start is None:
            start = y
        elif not on and start is not None:
            runs.append((start, y))
            start = None
    if start is not None:
        runs.append((start, len(rows)))
    if len(runs) >= 2:
        y0, y1 = runs[-1]
        arr = np.asarray(img).copy()
        arr[y0:y1, x0:, 3] = 0
        img = Image.fromarray(arr, "RGBA")
    return img


def mark_only(img: Image.Image, mark_right_frac: float = 0.24) -> Image.Image:
    return img.crop((0, 0, int(img.width * mark_right_frac), img.height))


def save(img: Image.Image, name: str) -> None:
    path = OUT / name
    img.save(path, optimize=True)
    print(f"{path.relative_to(ROOT)}  {img.width}x{img.height}  {path.stat().st_size // 1024} KB")


def rounded_mask(size: int, radius_frac: float = 0.225, scale: int = 4) -> Image.Image:
    big = Image.new("L", (size * scale, size * scale), 0)
    ImageDraw.Draw(big).rounded_rectangle((0, 0, size * scale - 1, size * scale - 1), radius=int(size * scale * radius_frac), fill=255)
    return big.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    # Horizontal lockups: top half = light ground, bottom half = dark ground.
    board = load("horizontal-light-dark.png")
    h = board.shape[0] // 2
    horiz_light = trim(unmix(board[:h]))
    horiz_dark = trim(unmix(board[h:]))
    save(horiz_light, "logo-horizontal-light.png")
    save(horiz_dark, "logo-horizontal-dark.png")

    # Lockup without tagline, and the K mark on its own.
    lock_light = trim(drop_tagline(trim(unmix(board[:h]), 0)))
    lock_dark = trim(drop_tagline(trim(unmix(board[h:]), 0)))
    save(lock_light, "logo-lockup-light.png")
    save(lock_dark, "logo-lockup-dark.png")
    save(trim(mark_only(trim(unmix(board[:h]), 0))), "logo-mark-light.png")
    save(trim(mark_only(trim(unmix(board[h:]), 0))), "logo-mark-dark.png")

    # Vertical lockups with Hindi: left half light, right half dark.
    board = load("vertical-light-dark.png")
    w = board.shape[1] // 2
    save(trim(unmix(board[:, :w])), "logo-vertical-light.png")
    save(trim(unmix(board[:, w:])), "logo-vertical-dark.png")

    # Hindi wordmark (single colour) for both themes.
    board = load("hindi-wordmark.png")
    split = int(board.shape[0] * 700 / 1200)
    hindi = trim(unmix(board[:split]))
    save(recolor(hindi, KHET_GREEN), "wordmark-hindi-light.png")
    save(recolor(hindi, CREAM), "wordmark-hindi-dark.png")
    save(trim(unmix(board[split:])), "lockup-hindi-dark.png")

    # App icon: the large rounded square on the left of the board.
    board = load("app-icon.png")
    left = board[:, : board.shape[1] // 2]
    green = np.linalg.norm(left - np.array(KHET_GREEN), axis=2) < 12
    ys, xs = np.where(green)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    inset = 4  # skip the anti-aliased edge of the rounded square on the board
    side = max(y1 - y0, x1 - x0) - 2 * inset
    y0, x0 = y0 + inset, x0 + inset
    tile = Image.fromarray(left[y0 : y0 + side, x0 : x0 + side].astype(np.uint8), "RGB")
    # Full-bleed square (corners filled with Khet Green) for maskable / Apple icons.
    full = tile.copy()
    bg = Image.new("RGB", full.size, KHET_GREEN)
    full = Image.composite(full, bg, rounded_mask(side, radius_frac=0.32))
    for size, name in [(512, "icon-512.png"), (192, "icon-192.png")]:
        save(full.resize((size, size), Image.LANCZOS), name)
    full.resize((180, 180), Image.LANCZOS).save(APP / "apple-icon.png", optimize=True)
    # Rounded, transparent-corner favicon.
    fav = full.resize((256, 256), Image.LANCZOS).convert("RGBA")
    fav.putalpha(rounded_mask(256))
    fav.save(APP / "icon.png", optimize=True)
    print("src/app/icon.png, src/app/apple-icon.png")


if __name__ == "__main__":
    main()
