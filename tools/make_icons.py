"""Generate app icons with no third-party deps (pure zlib + struct PNG writer).

Renders at 4x and box-downsamples, which gives clean antialiased edges on both
the rounded corners and the mark without needing a graphics library.
"""
import zlib, struct, os, sys, math

OUT = sys.argv[1]
SS = 4  # supersample factor

BG     = (14, 17, 22)       # --bg
ACCENT = (255, 90, 60)      # --accent
PLATE  = (232, 237, 245)    # --text


def write_png(path, size, pixels):
    raw = b''.join(b'\x00' + bytes(v for px in row for v in px) for row in pixels)
    def chunk(tag, data):
        c = tag + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)))
        f.write(chunk(b'IDAT', zlib.compress(raw, 9)))
        f.write(chunk(b'IEND', b''))


def render(size, maskable):
    """Render at size*SS, return the supersampled RGBA grid."""
    n = size * SS
    radius = 0 if maskable else n * 0.22
    grid = [[(0, 0, 0, 0)] * n for _ in range(n)]

    for y in range(n):
        for x in range(n):
            if maskable:
                inside = True
            else:
                # Clamp to the nearest corner centre; in the straight
                # sections dx/dy collapse to 0 and the test always passes.
                cx = radius if x < radius else (n - radius if x > n - radius else x)
                cy = radius if y < radius else (n - radius if y > n - radius else y)
                inside = (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius
            grid[y][x] = (*BG, 255) if inside else (0, 0, 0, 0)

    # Maskable icons get squeezed into a safe zone so the platform can crop.
    scale = 0.62 if maskable else 0.80
    off = n * (1 - scale) / 2
    def m(v):
        return off + v * n * scale

    def rect(x0, y0, x1, y1, color):
        for y in range(max(0, int(m(y0))), min(n, int(m(y1)))):
            for x in range(max(0, int(m(x0))), min(n, int(m(x1)))):
                if grid[y][x][3]:
                    grid[y][x] = (*color, 255)

    # Dumbbell: two plates, two collars, one bar.
    rect(0.06, 0.28, 0.22, 0.72, PLATE)
    rect(0.78, 0.28, 0.94, 0.72, PLATE)
    rect(0.22, 0.37, 0.30, 0.63, ACCENT)
    rect(0.70, 0.37, 0.78, 0.63, ACCENT)
    rect(0.30, 0.44, 0.70, 0.56, ACCENT)
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
                    # premultiply so edge pixels don't pick up black fringing
                    r += pr * pa; g += pg * pa; b += pb * pa; a += pa
            if a:
                row.append((round(r / a), round(g / a), round(b / a), round(a / (SS * SS))))
            else:
                row.append((0, 0, 0, 0))
        out.append(row)
    return out


os.makedirs(OUT, exist_ok=True)
for size in (180, 192, 512):
    write_png(os.path.join(OUT, f'icon-{size}.png'), size, downsample(render(size, False), size))
    print(f'icon-{size}.png')
write_png(os.path.join(OUT, 'icon-maskable-512.png'), 512, downsample(render(512, True), 512))
print('icon-maskable-512.png')
