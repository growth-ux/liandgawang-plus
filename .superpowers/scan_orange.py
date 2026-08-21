"""扫描截图中橙色（饱和暖色）像素密度，粗定位所有物件"""
from PIL import Image

img = Image.open("/tmp/ldw-tiles/src.png").convert("RGB")
w, h = img.size
CW, CH = 24, 18  # 网格
cell = [[0] * CW for _ in range(CH)]

for y in range(0, h, 2):
    for x in range(0, w, 2):
        r, g, b = img.getpixel((x, y))
        # 橙色/金色/深米色物体：R 明显大于 B，且饱和度足够
        if r > 150 and r - b > 45 and r - g > 8:
            cell[min(y * CH // h, CH - 1)][min(x * CW // w, CW - 1)] += 1

mx = max(max(row) for row in cell)
for row in cell:
    print("".join(" .:-=+*#%@"[min(int(v / mx * 9.99), 9)] for v in row))
print(f"\n网格：{CW}x{CH}，每格约 {w // CW}x{h // CH}px，@ 为橙色最密集")
