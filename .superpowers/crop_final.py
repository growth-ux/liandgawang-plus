"""最终裁切：框准 + 米白背景转透明（洪水填充去底）"""
import os

from PIL import Image

SRC = "/tmp/ldw-tiles/src.png"
OUT = "/Users/tiger/PycharmProjects/liangda/liangdawang-plus/web/public/images/field"
os.makedirs(OUT, exist_ok=True)

img = Image.open(SRC).convert("RGBA")

# name: (left, top, right, bottom)
regions = {
    "bank": (620, 470, 920, 780),
    "mall": (375, 150, 810, 480),
    "info-pie": (1210, 450, 1440, 790),
    "info-cube": (1440, 440, 1640, 700),
}

BG = (251, 246, 242)
TOL = 10  # 与底色的容差：只吃掉底色与格纹，保留白色台面


def is_bg(r: int, g: int, b: int) -> bool:
    """接近底色才算背景；接近纯白的像素（气泡/台面）受保护"""
    if r > 248 and g > 248 and b > 248:
        return False
    return abs(r - BG[0]) <= TOL and abs(g - BG[1]) <= TOL and abs(b - BG[2]) <= TOL


def flood_transparent(im: Image.Image) -> Image.Image:
    """从四条边缘向内洪水填充，把接近底色的像素变透明"""
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    stack = []
    for x in range(w):
        stack.append((x, 0))
        stack.append((x, h - 1))
    for y in range(h):
        stack.append((0, y))
        stack.append((w - 1, y))
    while stack:
        x, y = stack.pop()
        idx = y * w + x
        if seen[idx]:
            continue
        seen[idx] = 1
        r, g, b, a = px[x, y]
        if is_bg(r, g, b):
            px[x, y] = (r, g, b, 0)
            if x > 0:
                stack.append((x - 1, y))
            if x < w - 1:
                stack.append((x + 1, y))
            if y > 0:
                stack.append((x, y - 1))
            if y < h - 1:
                stack.append((x, y + 1))
    # 收紧透明边界：裁掉四周全透明边
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


for name, box in regions.items():
    crop = img.crop(box)
    crop = flood_transparent(crop)
    crop.save(f"{OUT}/{name}.png", optimize=True)
    print(f"{name}: {crop.size}")
