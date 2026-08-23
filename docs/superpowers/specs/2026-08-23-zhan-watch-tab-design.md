# 瞻小二「我的关注」Tab 设计规格

> 日期：2026-08-23
> 状态：已确认
> 范围：瞻小二页内「我的关注」Tab 的独立关注条件管理（创建、列表、重新检查、暂停/恢复/关闭），不接「我的办事」「研判记录」或粮小二交接。

---

## 1. 设计目标

在瞻小二（`/agent/zhan`）内提供独立的行情关注管理：用户针对某个品种、某个库点设置价格或涨跌阈值，系统用固定的 `zhan-v1` 演示行情即时判定是否触发，帮助采购人员"盯着关键价格点位"。

首版解决的真实问题：

- 采购人员需要盯住若干关键库点价格点位，不希望反复翻看整页行情。
- "什么时候该提醒我"应落到具体阈值，而不是模糊的"涨了/跌了"。
- 判定结果必须可追溯（当前值、阈值、判定时间、触发原因），不能是一个无来源的状态徽章。

竞赛阶段成功标准：

- 打开「我的关注」即可看到预置示例，一眼看到"已触发/监测中"两类状态。
- 创建一条关注后立即看到 `monitoring` 或 `triggered`。
- "重新检查"只重算确定性条件，不刷新、不生成新行情。
- 全部数据来自 `zhan-v1` 演示行情，页面常驻演示声明。

---

## 2. 已确认的范围决策

1. **关注条件类型 4 种**：`price_above`（价格高于）、`price_below`（价格低于）、`day_change`（日涨跌超过，按绝对值）、`week_change`（周涨跌超过，按绝对值）。
2. **仅页内管理**：关注列表、创建、重新检查、暂停/恢复/关闭都在瞻小二页内完成，不接「我的办事」。
3. **预置 2 条示例关注**：1 条「已触发」+ 1 条「监测中」，用于演示直观展示。

---

## 3. 数据模型

新增表 `watch_conditions`（后端新模块 `backend/app/workflow/`）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | Integer PK | 自增主键 |
| `watch_code` | String(64) | 稳定唯一键，如 `WATCH-CORN-01` |
| `variety_code` | String(32) | 品种代码：corn/wheat/soybean/rice |
| `variety_name` | String(32) | 品种中文名 |
| `spot_code` | String(64) | 关注的库点（价格/涨跌均锚定具体库点） |
| `region_name` | String(64) | 库点地区名（冗余展示） |
| `quote_type` | String(16) | 价格口径：收购价/平仓价/到货价 |
| `watch_type` | String(32) | `price_above` / `price_below` / `day_change` / `week_change` |
| `threshold` | Numeric(10,2) | 阈值：价格=元/吨，涨跌=% |
| `status` | String(16) | `monitoring` / `triggered` / `paused` / `closed` / `data_pending` |
| `current_value` | Numeric(10,2) | 最近一次检查的当前值 |
| `triggered_reason` | Text | 触发/未触发的说明文案 |
| `last_checked_at` | DateTime | 最近检查时间 |
| `data_kind` | String(16) | 固定 `user_input` |
| `mock_dataset_version` | String(32) | 固定 `zhan-v1` |
| `created_at` / `updated_at` | DateTime | 创建/更新时间 |

不引入软删除、不引入定时任务表、不引入 `request_token` 幂等字段（创建/暂停/关闭等操作对演示足够）。

---

## 4. 判定规则（纯函数）

当前值来源：

- 价格、日涨跌：`MarketSpotPrice.price` / `MarketSpotPrice.change_pct`。
- 周涨跌：该库点 `MarketPriceSeries` 序列，复用 `build_summary` 的 `week_change_pct`。

判定：

- `price_above`：当前价 ≥ 阈值 → `triggered`。
- `price_below`：当前价 ≤ 阈值 → `triggered`。
- `day_change`：`|日涨跌| ≥ 阈值` → `triggered`（文案为"单日波动过大"）。
- `week_change`：`|周涨跌| ≥ 阈值` → `triggered`。

缺库点或价格序列等必要数据 → `data_pending`，绝不误报为"未触发"。纯函数 `evaluate_watch_condition(watch_type, threshold, current_value) -> bool` 不访问数据库、不调用 LangChain。

---

## 5. 后端 API（前缀 `/api/watches`）

- `GET /api/watches` — 列出全部关注，**打开时用当前 Mock 数据重算**每条 status/current_value/reason/last_checked_at。
- `POST /api/watches` — 创建关注（body：`variety_code`、`spot_code`、`watch_type`、`threshold`），创建后立即判定。
- `PATCH /api/watches/{id}` — 修改阈值或状态（暂停/恢复/关闭），改后重算。
- `POST /api/watches/{id}/evaluate` — 单条「重新检查」（只重算，不刷新 Mock 数据）。

响应统一含 `data_kind`、`mock_dataset_version`。不存在对象返回 404，非法输入 422。

---

## 6. 前端 UI（`web/src/features/zhan/WatchesTab.tsx`，接入 ZhanPage index 4）

页面结构（沿用深色科技风、`panel`/`line`/`tech`/`brand` 色板，与 `VarietyMarketTab` 一致）：

1. **顶部说明条**：`当前检查基于固定 zhan-v1 演示行情，不会获取或生成新行情`。
2. **关注列表**：每张卡显示——品种+库点+口径、条件类型与阈值、当前值 vs 阈值、状态徽章、触发说明、最近检查时间、操作按钮（重新检查 / 暂停 / 恢复 / 关闭）。
3. **「新建关注」表单**：品种下拉 → 该品种库点下拉（复用 `/api/market/overview` 的 spots）→ 条件类型 → 阈值输入 → 提交即创建并显示判定结果。
4. 空状态：无关注时显示"创建关注"引导。

状态文案与配色（对齐 `agents.ts` 的 `taskStatuses` 徽章风格）：

- 监测中 `text-sky-300`、已触发 `text-amber-300`、已暂停/已关闭 `text-ink-soft`、数据待补充 `text-amber-300`。

前端扩展 `types.ts`（Watch 类型）与 `api.ts`（`fetchWatches` / `createWatch` / `updateWatch`）。

---

## 7. 预置示例

`workflow` 模块提供 `seed_demo_watches(db)`，在应用 lifespan 幂等写入 2 条（`data_kind=user_input`，`mock_dataset_version=zhan-v1`）：

1. `WATCH-CORN-01`：玉米·黑龙江绥化 收购价 `price_below` 2300 元/吨 → 当前价低于阈值 → **已触发**。
2. `WATCH-CORN-02`：玉米·辽宁大连港 平仓价 `week_change` 阈值 2.0% → 当前未超 → **监测中**。

阈值选择以 `zhan-v1` 固定数据（玉米产区价 2280~2340、港口价 2400~2480）为基准，保证一条触发、一条监测，且不脱离实际。

---

## 8. 明确不做（首版）

- 不接「我的办事」「研判记录」、不接粮小二交接。
- 不做短信/邮件推送、不做定时轮询、不做公开行情接入。
- 不实现区域价差、指标方向、事件出现三类条件（当前数据模型尚缺 `market_metrics` 与价差基础设施）。
- 不引入消息队列、调度器、软删除、幂等 `request_token`。

---

## 9. 测试与验收

### 9.1 后端

- `rules.py` 纯函数：4 类判定 + `data_pending` 分支 + 相同输入结果稳定。
- `/api/watches`：创建后立即判定、列表重算、修改阈值/状态、单条重新检查。
- 预置 2 条种子幂等（重复执行不新增）。
- 不存在关注返回 404，非法 watch_type 返回 422。

### 9.2 前端

- WatchesTab 渲染预置列表与状态徽章。
- 新建表单校验并提交后刷新列表。
- 暂停/恢复/关闭与重新检查交互正常。
- 空状态与加载/错误状态完整。

### 9.3 核心闭环

1. 打开 `/agent/zhan` → 切到「我的关注」。
2. 看到 2 条预置示例（1 触发 + 1 监测）。
3. 新建一条价格关注 → 立即看到 `monitoring` 或 `triggered`。
4. 点击「重新检查」→ 状态按固定 Mock 数据重算，不出现"数据已刷新/实时"文案。
5. 暂停/恢复/关闭一条关注，状态随之变化。

---

## 10. 文件结构与职责

```text
backend/app/workflow/
├── __init__.py
├── models.py        # WatchCondition 表
├── rules.py         # 纯函数 evaluate_watch_condition
├── repository.py    # 关注 CRUD
├── routes.py        # /api/watches/*
└── seed.py          # seed_demo_watches（幂等 2 条示例）

backend/app/main.py  # 注册 workflow 路由 + lifespan 调用 seed_demo_watches

backend/tests/workflow/
├── test_rules.py
├── test_repository.py
└── test_routes.py

web/src/features/zhan/
├── types.ts         # Watch 类型
├── api.ts           # fetchWatches / createWatch / updateWatch
└── WatchesTab.tsx   # 页面组件（接入 ZhanPage index 4）
```

沿用 `market` 模块的 dict 返回风格（不额外建 Pydantic 响应 schema；请求体用 FastAPI Pydantic 校验），前端沿用 `VarietyMarketTab` 的组件风格与 `format.ts` 工具。
