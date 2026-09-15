# 瞻小二首页比例优化 v2

- 生成方式：内置 image_gen 工具
- 发布素材：web/public/images/agents/ip/zhan-balanced-v2.png
- 原图保留：web/public/images/agents/ip/zhan.png
- 应用范围：通过 agents 共用形象配置同步首页、驾驶舱及独立页面；站位与显示高度保持原值。
- 检查：1024 × 1536 RGBA，透明通道背景为 0，四肢与头脚完整。

## 最终采用版本的生成提示词

Use case: precise-object-edit.
Asset type: transparent PNG full-body robot mascot sprite for an existing Chinese AI assistants homepage.
Input images: Image 1 (zhan.png) is the character identity and pose reference / edit target. Image 2 (liang.png) is only the reference for fuller, friendly mascot proportions; do not copy its hat, wheat, scanner, bowl or background.
Primary request: Create a NEW proportion-refined version of the robot in Image 1. Correct the overly elongated, thin adult-human silhouette so it harmonizes with the other rounded robot mascots. Increase head size relative to body by about 20-25%, shorten thighs and shins by about 25%, shorten the exposed neck and waist, make torso and limbs moderately fuller. Aim for approximately 4.5 head-heights tall, balanced and friendly but still professional; not an extreme chibi or toddler.
Keep invariant: same recognizable white ceramic / black joint / orange trim robot identity, rounded black face screen, two orange ring eyes inside the horizontal orange-edged data visor, orange circular ear modules, orange crown accent, same 3/4 camera view and orientation. Same pose: hand on image-left touches temple in a thinking gesture, arm on image-right extends outward with palm upward, both feet on same implied ground. Preserve crisp detailed premium 3D rendering and soft studio lighting.
Composition: one full-body character only centered in portrait 1024x1536 canvas, entire hands and shoes visible, head around 6% from top, shoe soles around 94% down the canvas, balanced clear margins. Keep the head and feet vertical alignment close to Image 1.
Scene/backdrop: truly TRANSPARENT alpha background, clean cutout edges. No solid black or white background, no baked checkerboard, no halo, no glow cloud, no floor or ground shadow (the app renders its own).
Avoid: text, labels, logos, watermark, extra characters, extra props, chart screens, long skinny legs, tiny head, human adult body proportions. Deliver a single finished transparent PNG.
