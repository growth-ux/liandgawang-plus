"""通用色相抠像：绿幕/品红幕渲染稿 -> 透明 RGBA + 深色底预览。用法: python3 matting_liang.py [src] [out] [preview]"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

SRC = sys.argv[1] if len(sys.argv) > 1 else "/Users/tiger/.qoder/vibe_images/liang-xiaoer-evolve-chromakey-v1_1789474825.png"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/Users/tiger/PycharmProjects/liangda/liangdawang-plus-feature2/web/public/images/agents/liang-xiaoer-evolve-transparent.png"
PREVIEW = sys.argv[3] if len(sys.argv) > 3 else "/Users/tiger/PycharmProjects/liangda/liangdawang-plus-feature2/.tmp/liang-matting-preview.png"

img = Image.open(SRC).convert("RGB")
px = np.asarray(img).astype(np.float32)

# 取画面边界环的中位数作为幕布色 C（自动适配绿幕 / 品红幕）
border = np.concatenate([px[0, :], px[-1, :], px[:, 0], px[:, -1]])
C = np.median(border, axis=0)

# 到幕布色的距离做软键：近=透明，远=不透明，中间过渡成抗锯齿边缘
dist = np.linalg.norm(px - C, axis=2)
T_HARD, T_SOFT = 70.0, 150.0
alpha = np.clip((dist - T_HARD) / (T_SOFT - T_HARD), 0, 1)

# 只保留最大前景连通域，去掉幕布里的噪点碎片
fg = alpha > 0.5
lab2, n2 = ndimage.label(fg)
if n2 > 1:
    sizes = ndimage.sum(fg, lab2, index=np.arange(1, n2 + 1))
    fg = lab2 == (np.argmax(sizes) + 1)
    alpha = np.where(fg, alpha, 0.0)

alpha = np.clip(ndimage.gaussian_filter(alpha, sigma=0.8), 0, 1)

# 反预乘去溢色：observed = a*F + (1-a)*C  =>  F = (observed - (1-a)*C) / a
a3 = alpha[..., None]
F = (px - (1 - a3) * C) / np.maximum(a3, 0.02)
rgb = np.clip(F, 0, 255).astype(np.uint8)

rgba = np.dstack([rgb, (alpha * 255).astype(np.uint8)])
Image.fromarray(rgba, "RGBA").save(OUT)

# 深色底预览（首页协作场底色 #07101f）
dark = np.zeros_like(rgb, dtype=np.uint8)
dark[:] = (7, 16, 31)
comp = (rgb.astype(np.float32) * a3 + dark.astype(np.float32) * (1 - a3)).astype(np.uint8)
Image.fromarray(comp, "RGB").save(PREVIEW)

print("chroma", C.astype(int).tolist(), "fg_ratio", round(float((alpha > 0.5).mean()), 4), "size", img.size)
