"""第三轮：找粮达优采仓库 + 修正 info-stack"""
import os

from PIL import Image

SRC = "/tmp/ldw-tiles/src.png"
OUT = "/tmp/ldw-tiles/crops3"
os.makedirs(OUT, exist_ok=True)

img = Image.open(SRC).convert("RGB")

regions = {
    "top-band": (1050, 0, 1666, 450),        # 右上角整带，找粮达优采仓库
    "info-stack": (1210, 450, 1620, 810),    # 粮达资讯（含气泡与数据台）
    "mall": (430, 140, 810, 480),            # 商城大屏（含气泡，再确认）
    "bid-device": (940, 470, 1230, 740),     # 竞价交易装置（去掉玉米田）
}

for name, box in regions.items():
    crop = img.crop(box)
    crop.save(f"{OUT}/{name}.png")
    print(f"{name}: {crop.size}")
