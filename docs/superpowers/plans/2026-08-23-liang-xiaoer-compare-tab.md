# 粮小二第二 Tab「候选对比」实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现候选对比 Tab——纯前端确定性对比，输出主推/备选/淘汰原因/待核验清单。

**Architecture:** 新增 TS 纯函数 `compare.ts`（硬过滤 + 排序 + 输出），新增 `CompareTab.tsx` 组件，重构 LiangPage 的需求状态（`pendingNeed` → `need`）并挂载组件。无后端改动、无新增依赖。

**Tech Stack:** React 18 + TypeScript（strict + noUnusedLocals）+ Tailwind v4。前端无测试框架，验证用 `npm run build` + 手动验收。

**约定：** 本项目 CLAUDE.md 禁止自动提交，每个 Task 末尾的 commit 步骤在执行时跳过。

---

## File Structure

- `web/src/features/liang/types.ts`（修改）— `NeedInput` 加 `crop_year`；新增 `Elimination`/`Pick`/`NeedSummary`/`CompareResult`
- `web/src/features/liang/parseNeed.ts`（修改）— 提取年份
- `web/src/features/liang/compare.ts`（新建）— `compareListings` 纯函数
- `web/src/features/liang/CompareTab.tsx`（新建）— 对比页组件
- `web/src/features/liang/ListingTable.tsx`（修改）— 「分析」按钮改为加入候选 + 跳转
- `web/src/features/liang/LiangPage.tsx`（修改）— `pendingNeed`/`pendingAnalyze` → `need`，挂载 CompareTab

---

## Task 1: 扩展类型（NeedInput 加年份 + CompareResult）

**Files:**
- Modify: `web/src/features/liang/types.ts`

- [ ] **Step 1: 修改 types.ts**

将 `NeedInput` 接口加上 `crop_year` 字段：

```typescript
export interface NeedInput {
  variety?: string;
  quantity_tons?: number;
  grade?: string;
  crop_year?: number;
  deadline_days?: number;
  budget_price?: number;
}
```

在文件末尾追加以下类型：

```typescript
export interface Elimination {
  listing: Listing;
  reason_code: string;
  reason_text: string;
}

export interface Pick {
  listing: Listing;
  reasons: string[];
  risks: string[];
  verification_count: number;
}

export interface NeedSummary {
  variety?: string;
  quantity_tons?: number;
  grade?: string;
  crop_year?: number;
  deadline?: string;
  budget_price?: number;
}

export interface CompareResult {
  has_need: boolean;
  scope: Listing[];
  primary: Pick | null;
  backup: Pick | null;
  eliminated: Elimination[];
  verifications: string[];
  need_summary: NeedSummary | null;
}
```

- [ ] **Step 2: 类型检查**

Run: `cd /Users/tiger/PycharmProjects/liangda/liangdawang-plus/web && npm run build`
Expected: 无类型错误

- [ ] **Step 3: Commit（跳过）**

---

## Task 2: parseNeed 提取年份

**Files:**
- Modify: `web/src/features/liang/parseNeed.ts`

- [ ] **Step 1: 加年份提取**

在 `parseNeed` 函数末尾（`return need;` 之前）加入：

```typescript
  const year = text.match(/(20\d{2})\s*年/);
  if (year) need.crop_year = Number(year[1]);
```

- [ ] **Step 2: 类型检查**

Run: `cd /Users/tiger/PycharmProjects/liangda/liangdawang-plus/web && npm run build`
Expected: 无类型错误

- [ ] **Step 3: Commit（跳过）**

---

## Task 3: compare.ts 纯函数

**Files:**
- Create: `web/src/features/liang/compare.ts`

- [ ] **Step 1: 写 compare.ts**

```typescript
// web/src/features/liang/compare.ts
import type {
  CompareResult,
  Elimination,
  Listing,
  NeedInput,
  NeedSummary,
  Pick,
} from "./types";

const GRADE_ORDER = ["一等", "二等", "三等", "四等"];
// mock 数据基准日期，与种子 PRICE_DATE（2026-08-23）一致，保证结果可复现
const BASE_DATE = "2026-08-23";

const FIXED_VERIFICATIONS = [
  "确认可锁定库存",
  "获取正式质检单",
  "确认报价有效期与含税口径",
  "确认装运窗口",
  "核验供应方主体与联系人",
];

function hasNeed(need: NeedInput | null): boolean {
  if (!need) return false;
  return !!(
    need.variety ||
    need.quantity_tons != null ||
    need.grade ||
    need.crop_year != null ||
    need.deadline_days != null ||
    need.budget_price != null
  );
}

/** ISO 日期相对基准日期的天数 */
function daysFromBase(iso: string): number {
  const base = Date.parse(`${BASE_DATE}T00:00:00Z`);
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - base) / 86400000);
}

function addDays(days: number): string {
  const d = new Date(`${BASE_DATE}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function gradeRank(g: string): number {
  const i = GRADE_ORDER.indexOf(g);
  return i < 0 ? 99 : i;
}

function fieldMissingCount(l: Listing): number {
  let n = 0;
  if (!l.earliest_ship_at || !l.latest_ship_at) n += 1;
  if (l.test_weight_g_l == null) n += 1;
  if (l.moisture_pct == null) n += 1;
  return n;
}

function hardFail(
  l: Listing,
  need: NeedInput,
  deadlineDays: number | null,
): string | null {
  if (need.variety && l.variety_name !== need.variety) return "VARIETY_MISMATCH";
  if (need.quantity_tons != null && l.available_quantity_tons < need.quantity_tons) {
    return "QUANTITY_INSUFFICIENT";
  }
  if (need.grade && gradeRank(l.grade) > gradeRank(need.grade)) {
    return "GRADE_BELOW_REQUIREMENT";
  }
  if (need.crop_year != null && l.crop_year !== need.crop_year) {
    return "CROP_YEAR_MISMATCH";
  }
  if (need.budget_price != null && Number(l.price) > need.budget_price) {
    return "PRICE_OVER_BUDGET";
  }
  if (deadlineDays != null) {
    if (!l.latest_ship_at) return "REQUIRED_FIELD_MISSING";
    if (daysFromBase(l.latest_ship_at) > deadlineDays) return "SHIP_WINDOW_MISSED";
  }
  return null;
}

const REASON_TEXT: Record<string, (l: Listing, need: NeedInput) => string> = {
  VARIETY_MISMATCH: (l, need) => `品种为${l.variety_name}，与需求的${need.variety}不符`,
  QUANTITY_INSUFFICIENT: (l, need) =>
    `可用量 ${l.available_quantity_tons} 吨，不足需求的 ${need.quantity_tons} 吨`,
  GRADE_BELOW_REQUIREMENT: (l, need) => `等级为${l.grade}，低于需求的${need.grade}`,
  CROP_YEAR_MISMATCH: (l, need) => `年份为${l.crop_year}，与需求的${need.crop_year}不符`,
  PRICE_OVER_BUDGET: (l, need) =>
    `报价 ${l.price} 元/吨，超过预算 ${need.budget_price} 元/吨`,
  SHIP_WINDOW_MISSED: (l) => `最晚可发 ${l.latest_ship_at}，晚于需求期限`,
  REQUIRED_FIELD_MISSING: () => `缺少发运窗口，无法确认能否按时交付`,
};

function shipPenalty(l: Listing): number {
  if (!l.latest_ship_at) return 999;
  return daysFromBase(l.latest_ship_at);
}

function sortKey(l: Listing): [number, number, number, number, number] {
  return [
    fieldMissingCount(l),
    -l.crop_year, // 新粮优先（降序）
    Number(l.price),
    shipPenalty(l),
    l.id,
  ];
}

function buildPick(l: Listing): Pick {
  const missing = fieldMissingCount(l);
  return {
    listing: l,
    reasons: [`${l.crop_year} 年新粮，${l.grade}，${l.origin_province}产区`],
    risks: missing > 0 ? ["部分关键字段待核验"] : [],
    verification_count: FIXED_VERIFICATIONS.length,
  };
}

export function compareListings(
  allListings: Listing[],
  candidates: Listing[],
  need: NeedInput | null,
): CompareResult {
  const scope = candidates.length > 0 ? candidates : allListings;
  const has = hasNeed(need);

  if (!has || !need) {
    return {
      has_need: false,
      scope,
      primary: null,
      backup: null,
      eliminated: [],
      verifications: [],
      need_summary: null,
    };
  }

  const deadlineDays = need.deadline_days ?? null;
  const passed: Listing[] = [];
  const eliminated: Elimination[] = [];

  for (const l of scope) {
    const code = hardFail(l, need, deadlineDays);
    if (code) {
      eliminated.push({
        listing: l,
        reason_code: code,
        reason_text: REASON_TEXT[code](l, need),
      });
    } else {
      passed.push(l);
    }
  }

  passed.sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    for (let i = 0; i < ka.length; i += 1) {
      if (ka[i] !== kb[i]) return ka[i] - kb[i];
    }
    return 0;
  });

  const needSummary: NeedSummary = {
    variety: need.variety,
    quantity_tons: need.quantity_tons,
    grade: need.grade,
    crop_year: need.crop_year,
    deadline: need.deadline_days != null ? addDays(need.deadline_days) : undefined,
    budget_price: need.budget_price,
  };

  return {
    has_need: true,
    scope,
    primary: passed.length > 0 ? buildPick(passed[0]) : null,
    backup: passed.length > 1 ? buildPick(passed[1]) : null,
    eliminated,
    verifications: FIXED_VERIFICATIONS,
    need_summary: needSummary,
  };
}
```

- [ ] **Step 2: 类型检查**

Run: `cd /Users/tiger/PycharmProjects/liangda/liangdawang-plus/web && npm run build`
Expected: 无类型错误

- [ ] **Step 3: Commit（跳过）**

---

## Task 4: CompareTab 组件

**Files:**
- Create: `web/src/features/liang/CompareTab.tsx`

- [ ] **Step 1: 写 CompareTab.tsx**

```tsx
// web/src/features/liang/CompareTab.tsx
import { useEffect, useState } from "react";
import { fetchListings } from "./api";
import { useCandidates } from "./CandidateContext";
import { compareListings } from "./compare";
import NeedInputBar from "./NeedInputBar";
import { fmtInt, fmtQuality, fmtDate } from "./format";
import type { CompareResult, Listing, NeedInput, NeedSummary, Pick } from "./types";

function NeedSummaryCard({ summary }: { summary: NeedSummary }) {
  const parts: string[] = [];
  if (summary.variety) parts.push(summary.variety);
  if (summary.grade) parts.push(summary.grade);
  if (summary.crop_year) parts.push(`${summary.crop_year} 年`);
  if (summary.quantity_tons != null) parts.push(`${summary.quantity_tons} 吨`);
  if (summary.deadline) parts.push(`最晚 ${summary.deadline} 发运`);
  if (summary.budget_price != null) parts.push(`预算 ≤ ${summary.budget_price} 元/吨`);
  return (
    <div className="rounded-2xl border border-line bg-panel px-5 py-4">
      <span className="text-xs text-ink-soft">当前需求</span>
      <div className="mt-1 text-sm font-medium text-ink">
        {parts.length ? parts.join(" · ") : "未指定条件"}
      </div>
    </div>
  );
}

function PickCard({ pick, label }: { pick: Pick; label: string }) {
  const l = pick.listing;
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-brand-deep">{label}</span>
        <span className="text-xs text-ink-soft">{l.listing_code}</span>
      </div>
      <div className="mt-2 text-lg font-semibold text-ink">
        {l.variety_name} · {l.grade} · {l.crop_year}
        <span className="ml-2 text-sm font-normal text-ink-soft">
          {l.origin_province} {l.origin_city}
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-tech">
        {fmtInt(l.price)}
        <span className="ml-1 text-xs font-normal text-ink-soft">元/吨 · {l.price_type}</span>
      </div>
      <div className="mt-3 space-y-1 text-sm text-ink">
        <div>供应方：{l.supplier_name}</div>
        <div>可用量：{fmtInt(l.available_quantity_tons)} 吨 · {l.delivery_type}</div>
        <div>发运：{fmtDate(l.earliest_ship_at)} ~ {fmtDate(l.latest_ship_at)}</div>
        <div>
          质检：水分 {fmtQuality(l.moisture_pct)}% · 容重 {fmtQuality(l.test_weight_g_l)} g/L
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-rice px-4 py-2.5">
        <div className="text-xs text-ink-soft">入选理由</div>
        <div className="mt-1 text-sm text-ink">{pick.reasons.join("；")}</div>
      </div>
      {pick.risks.length > 0 && (
        <div className="mt-2 text-xs text-amber-300">风险：{pick.risks.join("；")}</div>
      )}
      <div className="mt-2 text-xs text-ink-soft">待核验 {pick.verification_count} 项</div>
    </div>
  );
}

function EliminatedList({ eliminated }: { eliminated: CompareResult["eliminated"] }) {
  if (eliminated.length === 0) return null;
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="mb-3 text-sm font-semibold">未入选原因</div>
      <ul className="space-y-2">
        {eliminated.map((e) => (
          <li key={e.listing.id} className="flex items-start justify-between gap-4 text-sm">
            <span className="shrink-0 text-ink">
              {e.listing.variety_name}·{e.listing.grade} · {e.listing.supplier_name}
            </span>
            <span className="text-right text-ink-soft">{e.reason_text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VerificationList({ verifications }: { verifications: string[] }) {
  if (verifications.length === 0) return null;
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="mb-3 text-sm font-semibold">交易前待核验清单</div>
      <ol className="space-y-1.5">
        {verifications.map((v, i) => (
          <li key={v} className="text-sm text-ink">
            <span className="mr-2 text-ink-soft">{i + 1}.</span>
            {v}
          </li>
        ))}
      </ol>
    </div>
  );
}

function CompareTable({ result }: { result: CompareResult }) {
  const reasonOf = (id: number) =>
    result.eliminated.find((e) => e.listing.id === id)?.reason_code;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-soft">
            <th className="px-4 py-3 font-normal">品种·等级·年份</th>
            <th className="px-4 py-3 font-normal">产地</th>
            <th className="px-4 py-3 font-normal">供应方</th>
            <th className="px-4 py-3 font-normal">报价（口径）</th>
            <th className="px-4 py-3 font-normal">可用量</th>
            <th className="px-4 py-3 font-normal">发运</th>
            <th className="px-4 py-3 font-normal">质检</th>
            <th className="px-4 py-3 font-normal">状态</th>
          </tr>
        </thead>
        <tbody>
          {result.scope.map((l) => {
            const code = reasonOf(l.id);
            const isPrimary = result.primary?.listing.id === l.id;
            const isBackup = result.backup?.listing.id === l.id;
            return (
              <tr key={l.id} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-3 text-ink">
                  {l.variety_name}·{l.grade}·{l.crop_year}
                </td>
                <td className="px-4 py-3 text-ink">
                  {l.origin_province} {l.origin_city}
                </td>
                <td className="px-4 py-3 text-ink">{l.supplier_name}</td>
                <td className="px-4 py-3 tabular-nums text-ink">
                  {fmtInt(l.price)}
                  <span className="ml-1 text-xs text-ink-soft">{l.price_type}</span>
                </td>
                <td className="px-4 py-3 tabular-nums text-ink">
                  {fmtInt(l.available_quantity_tons)}吨
                </td>
                <td className="px-4 py-3 text-ink">{fmtDate(l.latest_ship_at)}</td>
                <td className="px-4 py-3 text-xs text-ink-soft">
                  {l.moisture_pct ? `水分${fmtQuality(l.moisture_pct)}%` : "--"}
                </td>
                <td className="px-4 py-3">
                  {isPrimary ? (
                    <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-white">主推</span>
                  ) : isBackup ? (
                    <span className="rounded-full bg-tech px-2 py-0.5 text-xs text-rice">备选</span>
                  ) : code ? (
                    <span className="text-xs text-ink-soft">{code}</span>
                  ) : (
                    <span className="text-xs text-ink-soft">候选</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CompareTab({
  need,
  onNeedChange,
}: {
  need: NeedInput | null;
  onNeedChange: (need: NeedInput, raw: string) => void;
}) {
  const { candidates } = useCandidates();
  const [all, setAll] = useState<Listing[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchListings()
      .then((d) => {
        if (!cancelled) setAll(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const result = compareListings(all, candidates, need);

  return (
    <div className="flex flex-col gap-4">
      <NeedInputBar onSubmit={onNeedChange} />

      {result.scope.length === 0 ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
          <p className="text-sm text-ink-soft">还没有可对比的粮源</p>
          <p className="mt-2 text-xs text-ink-soft">
            去「找粮源」收藏候选，或在上方描述你的采购需求。
          </p>
        </div>
      ) : (
        <>
          {result.need_summary && <NeedSummaryCard summary={result.need_summary} />}

          {result.primary && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <PickCard pick={result.primary} label="主推粮源" />
              {result.backup ? (
                <PickCard pick={result.backup} label="备选粮源" />
              ) : (
                <div className="flex items-center justify-center rounded-2xl border border-dashed border-line bg-panel/40 text-sm text-ink-soft">
                  暂无满足硬条件的备选
                </div>
              )}
            </div>
          )}

          <EliminatedList eliminated={result.eliminated} />
          <VerificationList verifications={result.verifications} />
          <CompareTable result={result} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 类型检查**

Run: `cd /Users/tiger/PycharmProjects/liangda/liangdawang-plus/web && npm run build`
Expected: 无类型错误（此时 CompareTab 尚未被引用，tsc 仍编译）

- [ ] **Step 3: Commit（跳过）**

---

## Task 5: ListingTable「分析」按钮改为加入候选 + 跳转

**Files:**
- Modify: `web/src/features/liang/ListingTable.tsx`

- [ ] **Step 1: 修改「分析」按钮**

将：

```tsx
                    <button
                      type="button"
                      onClick={() => onAnalyze(l)}
```

改为：

```tsx
                    <button
                      type="button"
                      onClick={() => {
                        add(l);
                        onAnalyze(l);
                      }}
```

（`add` 已从 `useCandidates()` 解构，位于本组件顶部。）

- [ ] **Step 2: 类型检查**

Run: `cd /Users/tiger/PycharmProjects/liangda/liangdawang-plus/web && npm run build`
Expected: 无类型错误

- [ ] **Step 3: Commit（跳过）**

---

## Task 6: LiangPage 集成

**Files:**
- Modify: `web/src/features/liang/LiangPage.tsx`

- [ ] **Step 1: 引入 CompareTab**

在 import 区（`import Pagination from "./Pagination";` 之后）加：

```tsx
import CompareTab from "./CompareTab";
```

- [ ] **Step 2: 重构需求状态**

将：

```tsx
  const [pendingNeed, setPendingNeed] = useState<{ need: NeedInput; raw: string } | null>(null);
  const [pendingAnalyze, setPendingAnalyze] = useState<Listing | null>(null);
```

改为：

```tsx
  const [need, setNeed] = useState<NeedInput | null>(null);
```

- [ ] **Step 3: 渲染候选对比 Tab**

将占位块（`activeTab !== 0` 的整段 `: (` 分支）里的占位内容，替换为：当 `activeTab === 1` 时渲染 `<CompareTab />`。

具体：找到：

```tsx
          {activeTab !== 0 ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
              <img src={agent.image} alt={agent.name} className="h-20 w-auto drop-shadow-[0_0_16px_rgba(201,144,42,0.4)]" />
              <h2 className="mt-4 text-lg font-semibold">
                {pendingAnalyze && activeTab === 1
                  ? `正在分析 ${pendingAnalyze.supplier_name} 的 ${pendingAnalyze.variety_name}`
                  : pendingNeed && activeTab === 1
                    ? `已收到需求：${pendingNeed.raw}`
                    : `「${agent.tabs[activeTab]}」正在建设中`}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-ink-soft">
                {activeTab === 1
                  ? "候选对比将在这里展示主推、备选、淘汰原因与待核验清单。"
                  : "本页将提供粮小二的专业服务，功能按设计逐步落地。"}
              </p>
            </div>
          ) : (
```

替换为：

```tsx
          {activeTab === 1 ? (
            <CompareTab need={need} onNeedChange={(n) => setNeed(n)} />
          ) : activeTab !== 0 ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/60 text-center">
              <img src={agent.image} alt={agent.name} className="h-20 w-auto drop-shadow-[0_0_16px_rgba(201,144,42,0.4)]" />
              <h2 className="mt-4 text-lg font-semibold">「{agent.tabs[activeTab]}」正在建设中</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-ink-soft">
                本页将提供粮小二的专业服务，功能按设计逐步落地。
              </p>
            </div>
          ) : (
```

- [ ] **Step 4: 更新第一 Tab 的 NeedInputBar 提交回调**

将：

```tsx
              <NeedInputBar
                onSubmit={(need, raw) => {
                  setPendingNeed({ need, raw });
                  setActiveTab(1);
                }}
              />
```

改为：

```tsx
              <NeedInputBar
                onSubmit={(n) => {
                  setNeed(n);
                  setActiveTab(1);
                }}
              />
```

- [ ] **Step 5: 更新 ListingTable 的 onAnalyze 回调**

将：

```tsx
                    onAnalyze={(l) => {
                      setPendingAnalyze(l);
                      setActiveTab(1);
                    }}
```

改为：

```tsx
                    onAnalyze={() => setActiveTab(1)}
```

- [ ] **Step 6: 类型检查 + 构建**

Run: `cd /Users/tiger/PycharmProjects/liangda/liangdawang-plus/web && npm run build`
Expected: 无类型错误、build 成功

- [ ] **Step 7: Commit（跳过）**

---

## Task 7: 手动验收

- [ ] **Step 1: 启动服务**

后端已在 8001（--reload），前端已在 5176（dev server，VITE_API_TARGET=8001）。若未运行，参照此前命令启动。

- [ ] **Step 2: 逐项验收**

打开 `http://localhost:5176/agent/liang`：

1. 切到「候选对比」Tab，候选篮空、无需求 → 显示「还没有可对比的粮源」空状态。
2. 顶部输入「120吨二等玉米 7天内可发」→ 显示需求摘要、主推「北安粮贸」（玉米·二等·2025，2380）、备选「榆树粮贸」（2420）；淘汰列表含铁岭（等级不符）、通辽（数量不足）、松原（缺发运窗口）；对比表状态列有「主推/备选/原因码」。
3. 输入「120吨 2025年 二等玉米 7天内可发」→ 四平（2024 年）进入淘汰（`CROP_YEAR_MISMATCH`），主推备选不变。
4. 回「找粮源」收藏 2~3 笔 → 切回「候选对比」→ 只对比这 2~3 笔（对比表行数 = 候选篮数量）。
5. 无需求但候选篮有粮源 → 只显示对比表，不显示主推/备选/淘汰/待核验。
6. 列表「分析」按钮 → 自动加入候选并跳到候选对比 Tab。
7. 页面任何位置不出现「演示数据 / mock」字样。

- [ ] **Step 3: Commit（跳过，由用户手动提交）**

---

## Self-Review 记录

- **Spec 覆盖**：第 3 节输入触发 → Task 4/6；第 4 节对比范围 → Task 3（`scope = candidates.length > 0 ? candidates : allListings`）；第 5 节确定性算法 → Task 3；第 6 节输出结构 → Task 4；第 8 节验收 → Task 7。
- **类型一致性**：`CompareResult`/`Pick`/`Elimination`/`NeedSummary` 在 Task 1 定义，Task 3/4 引用一致；`NeedInput.crop_year` 在 Task 1 加、Task 2 提取、Task 3 使用，一致；`CompareTab` 的 `onNeedChange` 签名 `(need, raw) => void` 与 `NeedInputBar` 的 `onSubmit` 一致，LiangPage 传入 `(n) => setNeed(n)`（忽略 raw，符合 TS 函数参数逆变）。
- **无占位符**：所有步骤含完整代码与命令。
