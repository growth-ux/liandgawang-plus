# 首页「机器人在操作东西」全息道具设计

日期：2026-08-21
状态：已确认（用户口头确认）

## 背景与目标

首页（`web/src/pages/Home.tsx`）目前是七位数字员工的静态 PNG 形象 + 轻微浮动/摇摆动画，观感单调。目标是让每个小二看起来像「正在操作全息设备」，呼应参考图中机器人对着全息屏工作的效果，让首页活起来。

约束（用户已确认）：

- 纯代码（CSS/SVG）绘制全息道具，不重新生成 AI 图片
- 角色本体动画保持现状（bob/sway），不加巡逻、不加场景事件
- 科技风格，与现有深空场景一致

## 方案

### 结构改动

1. `web/src/data/agents.ts`：每个 agent 增加 `holo` 字段：

   ```ts
   holo: {
     type: HoloType;            // 道具类型
     side: "left" | "right";    // 道具在角色的哪一侧
     offsetY: number;           // 相对角色高度的垂直位置（百分比）
   }
   ```

   `HoloType` 取值：`"command" | "chart" | "grain" | "route" | "rings" | "fund" | "shield"`

2. 新增 `web/src/components/field/HoloProp.tsx`：按 `holo.type` 渲染对应全息道具，纯装饰层（`pointer-events-none`、`aria-hidden`），SVG + CSS 动画。

3. `Home.tsx` 的 `AgentActor`：在角色图旁挂 `<HoloProp holo={agent.holo} />`。道具跟随浮动（bob）但不跟随摇摆（sway），避免全息屏晃动穿帮。

### 七位小二的道具设计

道具造型严格对照官方参考图 `product-design/assets/generated/liangdawang-plus-home-collaboration-field-v1.png`（等距场景中每个机器人手举/环绕的橙色全息屏），代码版做动画化还原：

| 小二 | type | 道具（对照参考图） | 动画 |
|---|---|---|---|
| 粮掌柜 | rings | 脚下双层能量环（自算小二迁移） | 外橙内青虚线反向流动 |
| 瞻小二 | chart | 身旁悬浮行情大屏：上升趋势折线 + 网格（参考图下方样品台省略） | 折线描边循环生长、末端数据点闪烁 |
| 粮小二 | grain | 等距稻田全息：4×4 麦株阵列（呼应官方资产 wheat.14a88246.png）+ 优选地块扫描环 | 扫描线掠过田面、谷粒光点上升、优选环流动 |
| 运小二 | route | 手举路线屏：起点→途径→终点的运输路线折线 | 光点沿路线循环跑动 |
| 算小二 | chips | 成本要素碎片环绕角色（运费/水杂/到厂价）+ 方案A/B 对比小牌；脚下能量环已迁移至粮掌柜 | 碎片轮流亮起 |
| 钱小二 | fund | 手举凭证屏：¥ 符号 + 条目列表 | 条目逐行亮起、微光扫过牌面 |
| 安小二 | shield | 手举盾牌全息牌：中央对勾徽章 | 盾面扫描线掠过、对勾脉冲发光 |

`HoloType` 取值相应为：`"command" | "chart" | "grain" | "route" | "rings" | "fund" | "shield"`。

### 视觉规范

- 主色 `#ee7b1f`（brand 橙，呼应参考图的橙色全息），数据细节点缀 `#22d3ee`（tech 青）
- 半透明填充 + 发光描边（drop-shadow / box-shadow 橙光）
- 道具宽度不超过角色宽度的 60%，不抢主体
- 所有动画 3–8s 循环，`animation-delay` 按角色 index 错开相位，避免全场同步闪烁
- 动画一律 `transform` / `opacity` / `stroke-dashoffset`，不触发 layout

### 动画实现

- 新增 keyframes 写入 `web/src/index.css`（沿用现有 `ld-bob` / `ld-sway` 命名风格，前缀 `ld-`）
- 简单循环（扫描线、旋转、闪烁）用 CSS keyframes；折线描边、光点跑路线用 SVG `stroke-dasharray`/`offset-path` 或 `<animateMotion>`，视实现简洁度二选一

## 错误处理与测试

- 纯展示组件，无交互逻辑、无数据请求
- 验证方式：`npm run build`（或 `tsc`）通过 + 浏览器截图肉眼核对七个道具位置与动画
- 降级：`holo` 字段缺失时 `HoloProp` 渲染 null，不影响角色显示

## 明确不做（YAGNI）

- 不重新生成角色图片
- 不做角色巡逻/走动、跨角色数据流事件
- 道具不响应点击/悬停交互（角色本身已有悬停高亮，道具仅装饰）
