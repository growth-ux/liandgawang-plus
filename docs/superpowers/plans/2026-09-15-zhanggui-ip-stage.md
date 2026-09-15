# 粮掌柜 IP 舞台实施计划

> **For agentic workers:** 使用 superpowers:subagent-driven-development 执行独立任务，协调者完成集成与最终检查。禁止自动提交。

**Goal:** 把用户已确认的 A 无全息版本接入两个正式驾驶舱。

**Architecture:** 现有 React + CSS + SVG；舞台统一使用 1040 × 720 坐标，角色、背景、流线一起缩放和视差。业务仍使用 CollaborationSnapshot 与 liveRuns。

**Tech Stack:** React 18、TypeScript、CSS、SVG、Vite。

**Spec:** `docs/superpowers/specs/2026-09-15-zhanggui-ip-stage-design.md`

## Global Constraints

- 不自动提交，不新增运行依赖，不改后端、首页素材配置或业务流程。
- 不使用 computer-use；浏览器验证可使用项目提供的 chrome-devtools-cli。
- 保留七位已有 IP、系统配色、状态文字、结果抽屉、采购模式待命禁用。
- 不接入全息屏、幕墙、投影光束和预览选择控件。
- 已在现有隔离工作区、codex/direction 分支上执行。

## Task 1: 状态流线

文件：`web/src/features/zhanggui/AgentFlowSvg.tsx`。

接口：保留 mission/liveRuns，新增可选 returningAgentIds: string[]；导出 STAGE_VIEW、HUB_POSITION 和 AGENT_POSITIONS。坐标如下：

```ts
const STAGE_VIEW = { minX: 0, minY: 0, width: 1040, height: 720 };
const HUB_POSITION = { x: 520, y: 370 };
const AGENT_POSITIONS = {
  zhan: { x: 260, y: 245 }, liang: { x: 755, y: 245 },
  yun: { x: 880, y: 430 }, suan: { x: 720, y: 575 },
  qian: { x: 325, y: 575 }, an: { x: 155, y: 430 },
};
```

- [x] 实现正常运行、完成、异议、失败和待命的流线类别，继续让 liveRuns 优先。
- [x] 连线接入脚下底座；运行时向外流动，returningAgentIds 触发向内一次回传，其余状态静止。
- [x] 用 CSS stroke-dashoffset 实现动画，以便页面隐藏、减少动效时暂停。
- [x] 核对异议只突出实际 completed_with_objection 节点，报告接口和 CSS 类名。

## Task 2: 舞台、角色与驾驶舱集成

创建 `StageBackdrop.tsx`、`IpPortrait.tsx`、`ip-stage.css`；修改 `SpatialAgentStage.tsx`、`AgentPod.tsx`、`PurchaseCockpit.tsx`、`purchase.css`；清除 `zhanggui.css` 中失效的旧舞台样式。

接口：保留 SpatialAgentStage 原有属性，增加可选 animationKey 用于采购任务/阶段切换清理；AgentPod 接受绝对脚底坐标、有效状态、参与状态和 onClick。

- [x] 用 SVG 绘制分层底座、地面网格、环形刻度，禁止全息投影。
- [x] IpPortrait 使用 img 与出错文字后备；粮掌柜单独用 da.png，其他图片按 getAgent 读取。
- [x] AgentPod 保持 button，姓名/状态/简短摘要在角色脚底下方；保留 aria-pressed、disabled 与结果选择。
- [x] 用 ResizeObserver 计算统一缩放；触屏和减少动效关闭视差；窄容器使用可读的角色网格。
- [x] 首次快照不回放，运行状态变化为完成时才短暂回传；任务或阶段切换清理计时器。
- [x] 移除 PurchaseCockpit 外部固定缩放，由共用舞台统一负责尺寸；保留收起行为。
- [x] 保留页面不可见时暂停动画，隐藏面板不回放动画。

## Task 3: 验证与审查

- [x] 运行 `cd web && npm run build`。
- [x] 使用 chrome-devtools-cli 在独立浏览器上下文访问正式粮掌柜页面，验证七位 IP、窄屏、收起展开、点击结果与运行状态。
- [x] 对缺少后端任务的状态使用隔离浏览器测试夹具，不写入用户现有采购记录。
- [x] 截图检查实际布局与已确认预览一致，检查长文本、角色/连线对齐和资源加载。
- [x] 独立审查本次未提交 diff，修复发现的问题，再更新设计/计划完成状态。
