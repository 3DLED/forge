"""Generate every icon and splash Forge ships, from one description of the mark.

Three platforms want the same dumbbell, and each wants it differently:

**The web app** gets a rounded plate, because nothing masks a PWA icon, plus a maskable
variant that hands the platform a full square to crop however it likes.

**iOS** gets exactly one file, 1024 square, and it has to be opaque: Apple rejects an app
icon carrying an alpha channel, and it applies its own corner mask, so a pre-rounded
source would come out rounded twice.

**Android** gets an adaptive pair -- a flat background colour and a foreground drawn on
transparency, with the mark held inside the 66-of-108dp safe circle because the launcher
may crop to a circle, a squircle or a teardrop -- plus legacy square and round bitmaps
for anything older than API 26.

The mark is axis-aligned rectangles, so most of these need no antialiasing at all. Only
the rounded and circular plates are supersampled, and none of those are large, which is
what keeps a pure-Python renderer viable.

    python tools/make_icons.py           # every platform, in place
    python tools/make_icons.py <folder>  # just the web icons, to a folder
"""
import zlib
import struct
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")

SS = 4  # supersample factor, for the curved plates

BG = (14, 17, 22)         # --bg
ACCENT = (255, 90, 60)    # --accent
PLATE = (232, 237, 245)   # --text

#: The dumbbell in a unit square: two plates, two collars, one bar.
MARK = [
    (0.06, 0.28, 0.22, 0.72, PLATE),
    (0.78, 0.28, 0.94, 0.72, PLATE),
    (0.22, 0.37, 0.30, 0.63, ACCENT),
    (0.70, 0.37, 0.78, 0.63, ACCENT),
    (0.30, 0.44, 0.70, 0.56, ACCENT),
]

#: Android density buckets, as multiples of mdpi.
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}

#: The splash filenames Capacitor lays down, and the sizes it expects them at. Not a clean
#: series, so it is written out rather than derived.
ANDROID_SPLASH = {
    "drawable": (480, 320),
    "drawable-port-mdpi": (320, 480), "drawable-land-mdpi": (480, 320),
    "drawable-port-hdpi": (480, 800), "drawable-land-hdpi": (800, 480),
    "drawable-port-xhdpi": (720, 1280), "drawable-land-xhdpi": (1280, 720),
    "drawable-port-xxhdpi": (960, 1600), "drawable-land-xxhdpi": (1600, 960),
    "drawable-port-xxxhdpi": (1280, 1920), "drawable-land-xxxhdpi": (1920, 1280),
}


def write_png(path, w, h, raw, alpha=True):
    """Colour type 6 (RGBA) or 2 (RGB) -- the latter is how alpha is kept off the iOS icon."""
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6 if alpha else 2, 0, 0, 0)))
        f.write(chunk(b"IDAT", zlib.compress(raw, 9)))
        f.write(chunk(b"IEND", b""))


def pack(grid, alpha):
    """A grid of RGBA tuples as filtered scanlines."""
    keep = 4 if alpha else 3
    return b"".join(b"\x00" + bytes(v for px in row for v in px[:keep]) for row in grid)


def plate(n, shape):
    """The ground the mark sits on: opaque where the shape covers, clear elsewhere."""
    if shape == "none":
        return [[(0, 0, 0, 0)] * n for _ in range(n)]
    if shape == "square":
        return [[(*BG, 255)] * n for _ in range(n)]
    grid = [[(0, 0, 0, 0)] * n for _ in range(n)]
    r = n / 2 if shape == "circle" else n * 0.22
    for y in range(n):
        row = grid[y]
        for x in range(n):
            if shape == "circle":
                inside = (x - r) ** 2 + (y - r) ** 2 <= r * r
            else:
                # Clamp to the nearest corner centre; along the straight edges dx and dy
                # collapse to zero and the test always passes.
                cx = r if x < r else (n - r if x > n - r else x)
                cy = r if y < r else (n - r if y > n - r else y)
                inside = (x - cx) ** 2 + (y - cy) ** 2 <= r * r
            if inside:
                row[x] = (*BG, 255)
    return grid


def stamp(grid, scale, clip):
    """Paint the mark, scaled and centred. `clip` keeps it inside a curved plate."""
    n = len(grid)
    off = n * (1 - scale) / 2

    def m(v):
        return off + v * n * scale

    for x0, y0, x1, y1, color in MARK:
        for y in range(max(0, int(m(y0))), min(n, int(m(y1)))):
            for x in range(max(0, int(m(x0))), min(n, int(m(x1)))):
                if not clip or grid[y][x][3]:
                    grid[y][x] = (*color, 255)
    return grid


def downsample(grid, size):
    """Box filter SS x SS blocks, compositing over transparency correctly."""
    out = []
    for y in range(size):
        row = []
        for x in range(size):
            r = g = b = a = 0
            for dy in range(SS):
                for dx in range(SS):
                    pr, pg, pb, pa = grid[y * SS + dy][x * SS + dx]
                    # Premultiply so edge pixels do not pick up black fringing.
                    r += pr * pa
                    g += pg * pa
                    b += pb * pa
                    a += pa
            if a:
                row.append((round(r / a), round(g / a), round(b / a), round(a / (SS * SS))))
            else:
                row.append((0, 0, 0, 0))
        out.append(row)
    return out


def icon(size, shape, scale, smooth=True):
    """One square icon as a grid of RGBA tuples."""
    if not smooth:
        return stamp(plate(size, shape), scale, shape != "none")
    n = size * SS
    return downsample(stamp(plate(n, shape), scale, shape != "none"), size)


def splash(path, w, h):
    """A flat ground with the mark at the centre, built a row at a time.

    2732 squared is seven million pixels, which a grid of tuples would not survive. There
    are no curves here, so each scanline is a fill plus a few slices.
    """
    side = min(w, h) * 0.22
    left, top = (w - side) / 2, (h - side) / 2
    ground = bytes(BG) * w
    rows = []
    for y in range(h):
        row = bytearray(ground)
        for x0, y0, x1, y1, color in MARK:
            if not top + y0 * side <= y < top + y1 * side:
                continue
            a, b = int(left + x0 * side), int(left + x1 * side)
            row[a * 3:b * 3] = bytes(color) * (b - a)
        rows.append(b"\x00" + bytes(row))
    write_png(path, w, h, b"".join(rows), alpha=False)


def web(out):
    for size in (180, 192, 512):
        write_png(os.path.join(out, f"icon-{size}.png"), size, size,
                  pack(icon(size, "rounded", 0.80), True))
        print(f"icon-{size}.png")
    # Maskable icons are squeezed into a safe zone, because the platform will crop.
    write_png(os.path.join(out, "icon-maskable-512.png"), 512, 512,
              pack(icon(512, "square", 0.62), True))
    print("icon-maskable-512.png")


def ios():
    assets = os.path.join(ROOT, "ios", "App", "App", "Assets.xcassets")
    write_png(os.path.join(assets, "AppIcon.appiconset", "AppIcon-512@2x.png"), 1024, 1024,
              pack(icon(1024, "square", 0.80, smooth=False), False), alpha=False)
    print("ios AppIcon-512@2x.png")
    for name in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
        splash(os.path.join(assets, "Splash.imageset", name), 2732, 2732)
        print(f"ios {name}")


def android():
    res = os.path.join(ROOT, "android", "app", "src", "main", "res")
    for bucket, k in DENSITIES.items():
        legacy = int(48 * k)
        folder = os.path.join(res, f"mipmap-{bucket}")
        write_png(os.path.join(folder, "ic_launcher.png"), legacy, legacy,
                  pack(icon(legacy, "rounded", 0.80), True))
        write_png(os.path.join(folder, "ic_launcher_round.png"), legacy, legacy,
                  pack(icon(legacy, "circle", 0.72), True))
        # A 108dp canvas, of which only the middle 66 is guaranteed to survive the crop.
        fore = int(108 * k)
        write_png(os.path.join(folder, "ic_launcher_foreground.png"), fore, fore,
                  pack(icon(fore, "none", 0.60, smooth=False), True))
        print(f"android mipmap-{bucket}")

    colour = os.path.join(res, "values", "ic_launcher_background.xml")
    body = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<resources>\n"
        '    <color name="ic_launcher_background">#%02X%02X%02X</color>\n'
        "</resources>\n"
    ) % BG
    with open(colour, "w", encoding="utf-8", newline="\n") as f:
        f.write(body)
    print("android ic_launcher_background.xml")

    for folder, (w, h) in ANDROID_SPLASH.items():
        splash(os.path.join(res, folder, "splash.png"), w, h)
        print(f"android {folder}/splash.png")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        web(sys.argv[1])
    else:
        web(os.path.join(ROOT, "public", "icons"))
        ios()
        android()
