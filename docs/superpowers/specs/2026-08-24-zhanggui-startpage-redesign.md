# 粮掌柜入口页重设计 — 设计规范

## 概述

将粮掌柜入口页（MissionStart）从"原型占位"升级为"企业级AI对话式工作台"，采用聚焦对话式布局，配合AI能力展示、工作流程图、场景示例和效率数据条，达到可直接向B端企业销售的产品水准。

## 设计决策

- **布局方案**: 聚焦对话式（方案A），居中单列布局，最大宽度 800px
- **核心体验**: 自然语言输入 → AI拆解 → 团队协作 → 决策拍板
- **视觉风格**: 深空蓝黑底 + 克制科技感，参考 Linear/Vercel/Stripe 的企业级设计语言
- **字体**: Inter + Noto Sans SC（项目已有 font-sans 覆盖）

## 页面结构（从上到下7个区块）

### 1. 品牌欢迎区（Hero）
- 居中布局，上方小标签 "AI PROCUREMENT COPILOT"（带呼吸灯圆点）
- 主标题 30px bold："描述采购目标，粮掌柜来办"
- 副标题 15px："用自然语言描述需求，AI 自动拆解目标、组建专业团队、并行推进办理，在关键决策节点等你拍板。"
- 底部留白 40px

### 2. 目标输入区（Input Card）
- 背景 `bg-card`（#141c30），边框使用 accent cyan 发光（1px solid rgba(34,211,238,0.18)）
- 顶部渐变高光伪元素（::before），增加精致感
- 标签行：左侧 "采购目标"（12px semibold），右侧提示 "支持自然语言描述，也可粘贴报价单 / 采购计划"
- 文本区域：15px，最小高度 72px，预填 DEMO_EXAMPLE
- 底部分割线后：
  - 左侧：附件按钮（SVG 回形针图标 + "附加资料"），圆角 8px，border solid
  - 右侧："填入示例" 链接 + "开始拆解" 提交按钮
- 提交按钮：渐变橙（#ee7b1f → #d4691a），圆角 10px，带投影，hover 上浮动效
- 阴影：`0 0 40px rgba(34,211,238,0.03), 0 4px 24px rgba(0,0,0,0.2)`

### 3. AI能力展示条（Capabilities）
- 输入框下方 16px，居中 flex 布局，4 个标签
- 每个标签：SVG 图标（16x16 方形小图标，cyan 色）+ 文字
- 标签样式：bg-surface + border-subtle，圆角 8px，12px 字号
- 四项能力：智能组队、并行办理、冲突会商、方案对比
- 底部留白 48px

### 4. 工作流程图（Workflow）
- section-header：左侧 "工作流程" 标签（11px uppercase），右侧细线分隔
- 5 个步骤横向排列，中间用渐变连接线连接
- 每个步骤：编号圆角方块（36x36，bg-card + border）+ 标题 + 描述
- 前 4 步 cyan 编号，第 5 步（决策拍板）brand 色高亮
- 步骤：描述目标 → AI理解 → 智能组队 → 并行办理 → 决策拍板
- 底部留白 48px

### 5. 示例目标卡片（Examples）
- section-header：左侧 "场景示例" 标签
- 3 列 grid，每个卡片：bg-card + border-subtle，圆角 12px
- 卡片标题 13px semibold + 分类标签（常规/紧急/长期，cyan 小标签）
- 卡片描述 12px tertiary 色
- hover 效果：border 加深 + bg-elevated + 微上浮 + 阴影
- 三个场景：玉米补库采购、大豆紧急采购、小麦框架协议
- 点击填入输入框
- 底部留白 48px

### 6. 最近任务（Recent Tasks）
- 上方分割线分隔
- header：左侧 "最近任务" 标题 + 右侧 "查看全部 →" 链接
- 2 列 grid 布局
- 卡片：bg-card + border-subtle，圆角 12px，padding 16px 18px
- 上行：任务名 13.5px + 状态标签（已完成/办理中等）
- 下行：任务编号 + 更新时间
- hover：border 加深 + bg-elevated

### 7. 效率数据条（Stats Bar）
- 页面最底部，bg-surface + border-subtle，圆角 12px
- 4 项数据用竖线分隔：采购目标数(cyan) / 平均拆解时间(brand) / 方案通过率(green) / 协作小二数(white)
- 数值 22px bold，标签 11px tertiary
- 数据从后端 API 获取（或前端 mock 固定值）

## 样式系统变更

### 新增 CSS 变量（在 index.css 的 @theme 中）
- 无需新增变量，现有变量已覆盖所需色彩
- `--color-rice` (#0b1220) 作为页面底色
- `--color-panel` (#131c36) 作为卡片背景
- `--color-rice-deep` (#111b30) 作为表面层
- `--color-tech` (#22d3ee) 作为 cyan 强调色
- `--color-brand` (#ee7b1f) 作为品牌橙色

### 新增自定义 CSS
在 `zhanggui.css` 末尾添加入口页专用样式：
- `.zg-start-hero` — 品牌欢迎区
- `.zg-start-input` — 输入卡片
- `.zg-start-cap` — 能力标签
- `.zg-start-workflow` — 工作流程
- `.zg-start-examples` — 示例卡片
- `.zg-start-recent` — 最近任务
- `.zg-start-stats` — 效率数据条

## 组件拆分

将 MissionStart.tsx 拆分为子组件（保持在同目录下）：

| 组件 | 职责 |
|------|------|
| `MissionStart.tsx` | 入口页容器，管理状态与布局 |
| `StartHero.tsx` | 品牌欢迎区 |
| `StartInput.tsx` | 目标输入卡片（含附件、提交） |
| `StartCapabilities.tsx` | AI能力展示条 |
| `StartWorkflow.tsx` | 工作流程图 |
| `StartExamples.tsx` | 示例目标卡片 |
| `StartRecent.tsx` | 最近任务列表 |
| `StartStats.tsx` | 效率数据条 |

## 交互行为

- **提交目标**: 与现有逻辑一致（previewGoal → createMission → onCreated）
- **填入示例**: 点击示例卡片或"填入示例"链接，将文本填入 textarea
- **附加资料**: 与现有逻辑一致（file input 读取文本追加到 textarea）
- **打开任务**: 点击最近任务卡片，fetchMission → onOpenMission
- **查看全部**: 跳转到历史任务视图

## 效率数据来源

从后端 `fetchMissions()` 返回的 MissionSummary[] 中统计：
- 累计任务数：missions.length
- 已完成数/完成率：status === "completed" 的比例
- 协作小二数：从 mission team 数据中统计 unique agent_id
- 平均拆解时间：暂用固定 mock 值（3.2 min），后续可从 created_at → 首个 agent_run.started_at 计算

## 不改动的部分

- `ZhangguiPage.tsx` — 路由与状态管理逻辑不变
- `MissionCockpit.tsx` — 指挥舱页面不变
- `HistoryView.tsx` — 历史任务视图不变
- `api.ts` — API 调用不变
- `types.ts` — 类型定义不变
- 导航栏（TopNav）— 不变
- 其他小二页面 — 不变

## 约束

- AI竞赛项目，不需要过度设计
- 数据部分 mock 但不能在页面上明显标出
- 科技风格但不过度花哨
- 保持现有功能不变，仅重构 UI
