"""从官方截图中裁切建筑素材（第一轮：预览框选范围）"""
import os
import statistics

from PIL import Image

SRC = "/tmp/ldw-tiles/src.png"
OUT = "/tmp/ldw-tiles/crops"
os.makedirs(OUT, exist_ok=True)

img = Image.open(SRC).convert("RGB")
w, h = img.size
print(f"source size: {w}x{h}")

# 取背景底色：采样画面边缘的干净区域
samples = []
for x in range(20, w - 20, 40):
    samples.append(img.getpixel((x, 8)))
    samples.append(img.getpixel((x, h - 8)))
for y in range(20, h - 20, 40):
    samples.append(img.getpixel((8, y)))
    samples.append(img.getpixel((w - 8, y)))
r = round(statistics.mean(s[0] for s in samples))
g = round(statistics.mean(s[1] for s in samples))
b = round(statistics.mean(s[2] for s in samples))
print(f"bg color approx: rgb({r},{g},{b}) -> #{r:02x}{g:02x}{b:02x}")

# 各建筑的候选框 (left, top, right, bottom)
regions = {
    "bank": (560, 470, 900, 820),           # 银行（金色立柱+¥）
    "mall": (400, 180, 780, 470),           # 商城大屏（两人交接）
    "finance-cube": (60, 130, 360, 420),    # 金融方块（粮达金融标签）
    "warehouse": (1080, 40, 1500, 380),     # 粮达优采（仓库+筒仓，待验证）
    "info-stack": (1260, 470, 1560, 760),   # 粮达资讯数据台
    "logistics-icon": (430, 500, 640, 740), # 物流闪电盒子
}

for name, box in regions.items():
    crop = img.crop(box)
    crop.save(f"{OUT}/{name}.png")
    print(f"{name}: {crop.size}")
