# 新版机器人 IP 发布资源

统一入口：`web/src/data/agents.ts`。首页、协作驾驶舱、各小二独立页面共用此配置。

| 发布文件 | 原素材（product-design/assets/ip） | 处理 |
| --- | --- | --- |
| da.png | 掌柜.png | 原图复制 |
| zhan.png | 瞻小二.png | 原图复制 |
| liang.png | 粮小二.png | 内置 image_gen 处理透明背景 |
| yun.png | 运小二.png | 原图复制 |
| suan.png | 算小二.png | 原图复制 |
| qian.png | 钱小二.png | 内置 image_gen 处理透明背景 |
| an.png | 安小二.png | 原图复制 |

原始素材保留不变；发布形象使用原始朝向，避免道具符号被镜像。

## 透明背景处理提示词

### 粮小二

Use case: background-extraction. Edit this exact provided image: remove ONLY the white background and output a genuinely transparent RGBA PNG cutout. Preserve the existing robot exactly, its face, straw hat and wheat, orange-white body, grain bowl, handheld scanner, full pose, proportions, lighting, materials, and all edges. Do not redesign, flip, add, recolor, or crop the robot. Keep full head and feet, original portrait framing. White robot parts must remain opaque white. This is an existing website character asset requiring background removal, not a new character design.

### 钱小二

Use case: background-extraction. Edit this exact provided image: remove ONLY the white background and output a genuinely transparent RGBA PNG cutout. Preserve the exact existing female-style white-orange finance robot, face, pose, skirt, fingers, financial cards, arrows and currency symbols, full body proportions, lighting, materials, and all edges. Do not redesign, flip, add, recolor, or crop the robot. Keep full head and feet with original portrait framing. White robot parts and white cards must remain opaque white. This is an existing website character asset requiring background removal, not a new character design.
