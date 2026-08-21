"""第二轮裁切：按密度图修正框选范围"""
import os

from PIL import Image

SRC = "/tmp/ldw-tiles/src.png"
OUT = "/tmp/ldw-tiles/crops2"
os.makedirs(OUT, exist_ok=True)

img = Image.open(SRC).convert("RGB")

regions = {
    "bank": (640, 500, 900, 760),             # 银行（含粮达金融气泡）
    "mall": (430, 150, 800, 470),             # 商城大屏（含粮达商城气泡）
    "warehouse": (1210, 60, 1520, 400),       # 粮达优采仓库（含气泡）
    "info-stack": (1230, 460, 1600, 800),     # 粮达资讯数据台（含气泡）
    "bid-device": (880, 500, 1210, 780),      # 竞价交易装置（装饰）
    "logistics-icon": (380, 490, 620, 750),   # 物流闪电盒子（含物流气泡）
}

for name, box in regions.items():
    crop = img.crop(box)
    crop.save(f"{OUT}/{name}.png")
    print(f"{name}: {crop.size}")
