import { useEffect, useRef, useState } from "react";
import type { Purchase } from "./purchaseModel";
import { formatMoney } from "./purchaseModel";
import {
  CHECK_ITEMS,
  CREDIT_SCORE,
  columnChecks,
  reportId,
  type CheckResult,
} from "./qualificationData";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ItemStatus = "idle" | "checking" | "done";

interface ColumnState {
  items: Record<string, ItemStatus>;
  results: Record<string, CheckResult>;
}

function idleColumn(category: "an" | "qian"): ColumnState {
  const items: Record<string, ItemStatus> = {};
  for (const c of columnChecks(category)) items[c.id] = "idle";
  return { items, results: {} };
}

function doneColumn(category: "an" | "qian", purchase: Purchase): ColumnState {
  const items: Record<string, ItemStatus> = {};
  const results: Record<string, CheckResult> = {};
  for (const c of columnChecks(category)) {
    items[c.id] = "done";
    results[c.id] = c.evaluate(purchase);
  }
  return { items, results };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Qualification({
  purchase,
  readonly,
  update,
  onNext,
  onProgress,
}: {
  purchase: Purchase;
  readonly: boolean;
  update(patch: Partial<Purchase>): void;
  onNext(): void;
  onProgress(value: number | null): void;
}) {
  const [anState, setAnState] = useState<ColumnState>(() =>
    purchase.qualified
      ? doneColumn("an", purchase)
      : idleColumn("an"),
  );
  const [qianState, setQianState] = useState<ColumnState>(() =>
    purchase.qualified
      ? doneColumn("qian", purchase)
      : idleColumn("qian"),
  );
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  /* 清理定时器 */
  useEffect(
    () => () => {
      for (const t of timers.current) clearTimeout(t);
    },
    [],
  );

  /* ---- 开始并行核验 ---- */
  function check() {
    if (running) return;
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
    setRunning(true);
    setAnState(idleColumn("an"));
    setQianState(idleColumn("qian"));
    setExpanded(null);
    onProgress(0);

    const all: {
      col: "an" | "qian";
      delay: number;
      result: CheckResult;
      id: string;
    }[] = [];

    for (const col of ["an", "qian"] as const) {
      let accumulated = 0;
      for (const item of columnChecks(col)) {
        accumulated += item.delay;
        all.push({
          col,
          delay: accumulated,
          result: item.evaluate(purchase),
          id: item.id,
        });
      }
    }

    /* 每项：先进入 checking，延迟后进入 done */
    let progressCount = 0;
    for (const entry of all) {
      const setter = entry.col === "an" ? setAnState : setQianState;

      // 立即标记为 checking（视觉效果：该项开始转动）
      timers.current.push(
        setTimeout(() => {
          setter((prev) => ({
            ...prev,
            items: { ...prev.items, [entry.id]: "checking" },
          }));
        }, 30),
      );

      // 延迟后标记为 done，写入结果
      timers.current.push(
        setTimeout(() => {
          progressCount += 1;
          onProgress(progressCount);
          setter((prev) => ({
            ...prev,
            items: { ...prev.items, [entry.id]: "done" },
            results: { ...prev.results, [entry.id]: entry.result },
          }));
        }, entry.delay),
      );
    }

    /* 全部完成后：汇总结果 */
    const maxDelay = Math.max(...all.map((a) => a.delay));
    timers.current.push(
      setTimeout(() => {
        setRunning(false);
        const allResults = all.map((a) => a.result);
        const allPassed = allResults.every((r) => r.status === "passed");
        update({
          qualified: allPassed,
          qualificationChecked: true,
        });
        onProgress(null);
      }, maxDelay + 300),
    );
  }

  /* ---- 派生状态 ---- */
  const allDone =
    Object.values(anState.items).every((s) => s === "done") &&
    Object.values(qianState.items).every((s) => s === "done");

  const totalCount = CHECK_ITEMS.length;
  const doneCount =
    Object.values(anState.items).filter((s) => s === "done").length +
    Object.values(qianState.items).filter((s) => s === "done").length;

  /* ---- 状态徽章 ---- */
  function statusBadge(status: ItemStatus, result?: CheckResult) {
    if (status === "idle")
      return <span className="pw-q-badge is-idle">待核验</span>;
    if (status === "checking")
      return (
        <span className="pw-q-badge is-running">
          <span className="pw-check-spinner" /> 核验中
        </span>
      );
    if (!result) return null;
    if (result.status === "passed")
      return <span className="pw-q-badge is-passed">✓ 通过</span>;
    if (result.status === "warning")
      return <span className="pw-q-badge is-warning">! 注意</span>;
    return <span className="pw-q-badge is-failed">✗ 待补充</span>;
  }

  /* ---- 渲染列 ---- */
  function renderColumn(
    category: "an" | "qian",
    state: ColumnState,
    title: string,
  ) {
    const items = columnChecks(category);
    const completed = Object.values(state.items).filter(
      (status) => status === "done",
    ).length;
    const agentMeta =
      category === "an"
        ? {
            mark: "安",
            name: "安小二",
            scope: "企业身份与授权材料",
          }
        : {
            mark: "钱",
            name: "钱小二",
            scope: "信用、账户与保证金",
          };
    return (
      <section className={`pw-q-column is-${category}`}>
        <header className="pw-q-column-header">
          <span className="pw-q-agent-mark" aria-hidden="true">
            {agentMeta.mark}
          </span>
          <div>
            <h3 className="pw-q-column-title">{title}</h3>
            <p>{agentMeta.scope}</p>
          </div>
          <span className="pw-q-column-count">
            <strong>{completed}</strong> / {items.length}
          </span>
        </header>

        <div className="pw-q-list">
          {items.map((def, index) => {
            const status = state.items[def.id] ?? "idle";
            const result = state.results[def.id];
            const isExpanded = expanded === def.id;
            const stateSymbol =
              status === "checking"
                ? null
                : result?.status === "failed"
                  ? "!"
                  : result?.status === "warning"
                    ? "!"
                    : status === "done"
                      ? "✓"
                      : String(index + 1);
            return (
              <div
                className={`pw-check-row${status === "checking" ? " is-checking" : ""}${status === "done" ? " is-finished" : ""}${result ? ` is-${result.status}` : ""}`}
                key={def.id}
              >
                <span className="pw-check-state" aria-hidden="true">
                  {status === "checking" ? (
                    <span className="pw-check-spinner" />
                  ) : (
                    stateSymbol
                  )}
                </span>
                <div className="pw-check-content">
                  <div className="pw-check-head">
                    <strong>{def.label}</strong>
                    {statusBadge(status, result)}
                  </div>

                  {status === "idle" && (
                    <p className="pw-check-hint">等待双通道核验启动</p>
                  )}
                  {status === "checking" && (
                    <p className="pw-check-hint">{def.checkingText}</p>
                  )}
                  {status === "done" && result && (
                    <>
                      <p className="pw-check-hint">{result.label}</p>
                      {result.note && (
                        <p className="pw-check-note">{result.note}</p>
                      )}
                      <button
                        type="button"
                        className={`pw-evidence-toggle${isExpanded ? " is-open" : ""}`}
                        onClick={() => setExpanded(isExpanded ? null : def.id)}
                        aria-expanded={isExpanded}
                      >
                        核验依据
                        <span className="pw-evidence-toggle-icon">
                          {isExpanded ? "−" : "+"}
                        </span>
                      </button>
                    </>
                  )}

                  {status === "done" && result && isExpanded && (
                    <div className="pw-check-evidence">
                      <div className="pw-evidence-hd">
                        <span className="pw-evidence-src">
                          {result.evidence.source}
                        </span>
                      </div>
                      <div className="pw-evidence-body">
                        {result.evidence.lines.map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </div>
                      {result.marginCalc && (
                        <div className="pw-margin-calc">
                          <p className="pw-margin-title">保证金计算</p>
                          <div className="pw-margin-formula">
                            {result.marginCalc.quantity} 吨 ×{" "}
                            {formatMoney(result.marginCalc.unitPrice)} 元/吨 ×{" "}
                            {(result.marginCalc.rate * 100).toFixed(0)}% ={" "}
                            <strong>
                              {formatMoney(result.marginCalc.required)} 元
                            </strong>
                          </div>
                          <div className="pw-margin-breakdown">
                            <div>
                              <span>账户总额</span>
                              <strong>
                                ¥{formatMoney(result.marginCalc.total)}
                              </strong>
                            </div>
                            <div>
                              <span>已冻结</span>
                              <strong>
                                ¥{formatMoney(result.marginCalc.frozen)}
                              </strong>
                            </div>
                            <div>
                              <span>可用额度</span>
                              <strong>
                                ¥{formatMoney(result.marginCalc.available)}
                              </strong>
                            </div>
                            <div>
                              <span>预留后剩余</span>
                              <strong>
                                ¥
                                {formatMoney(
                                  result.marginCalc.available -
                                    result.marginCalc.required,
                                )}
                              </strong>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  /* ---- 核验报告 ---- */
  function renderReport() {
    if (!allDone || running) return null;
    const rid = reportId(purchase.id);
    const time = new Date().toLocaleString("zh-CN");
    const passed = CHECK_ITEMS.filter((c) => {
      const s = c.category === "an" ? anState : qianState;
      return s.results[c.id]?.status === "passed";
    }).length;
    const failed = CHECK_ITEMS.filter((c) => {
      const s = c.category === "an" ? anState : qianState;
      return s.results[c.id]?.status === "failed";
    }).length;
    const warns = CHECK_ITEMS.filter((c) => {
      const s = c.category === "an" ? anState : qianState;
      return s.results[c.id]?.status === "warning";
    }).length;
    return (
      <section className="pw-verification-report">
        <div className="pw-report-head">
          <div>
            <strong>准入核验报告</strong>
            <p>
              {rid} · {time}
            </p>
          </div>
          <span
            className={`pw-report-badge ${
              purchase.qualified ? "is-passed" : "is-failed"
            }`}
          >
            {purchase.qualified ? "全部通过" : "存在异常"}
          </span>
        </div>
        <div className="pw-report-stats">
          <div>
            <span>核验项</span>
            <strong>{totalCount}</strong>
          </div>
          <div>
            <span>通过</span>
            <strong className="is-ok">{passed}</strong>
          </div>
          {warns > 0 && (
            <div>
              <span>注意</span>
              <strong className="is-warn">{warns}</strong>
            </div>
          )}
          {failed > 0 && (
            <div>
              <span>不通过</span>
              <strong className="is-bad">{failed}</strong>
            </div>
          )}
        </div>
        <p className="pw-report-footer">
          {purchase.qualified
            ? "企业资质与交易条件均符合要求，可进入选粮点价。"
            : "请补充缺失材料或调整采购计划后重新核验。"}
          <span>核验方：安小二（企业资质） · 钱小二（交易条件）</span>
        </p>
      </section>
    );
  }

  /* ---- 企业信用评分 ---- */
  function renderCreditScore() {
    if (!allDone || running) return null;
    return (
      <section className="pw-credit-score">
        <div className="pw-credit-head">
          <strong>企业交易信用</strong>
          <div className="pw-credit-badge">
            <span className="pw-credit-grade">{CREDIT_SCORE.grade}</span>
            <div className="pw-credit-pts-wrap">
              <span className="pw-credit-pts">{CREDIT_SCORE.score}</span>
              <span className="pw-credit-unit">分</span>
            </div>
          </div>
        </div>
        <div className="pw-credit-bar">
          <div
            className="pw-credit-fill"
            style={{ width: `${(CREDIT_SCORE.score / 1000) * 100}%` }}
          />
        </div>
        <div className="pw-credit-dims">
          {CREDIT_SCORE.dimensions.map((d) => (
            <div key={d.label}>
              <span>{d.label}</span>
              <strong>{d.value}</strong>
              <small>{d.detail}</small>
            </div>
          ))}
        </div>
      </section>
    );
  }

  /* ---- 主体 ---- */
  return (
    <>
      <section className="pw-q-overview" aria-label="交易准入核验概览">
        <div className="pw-q-overview-visual" aria-hidden="true">
          <span>安</span>
          <i />
          <span>钱</span>
        </div>
        <div className="pw-q-overview-copy">
          <strong>双小二并行核验</strong>
          <p>企业资质与交易条件同步校验，结果可追溯、缺项可续办。</p>
        </div>
        <div className="pw-q-overview-stats">
          <span>
            <strong>{doneCount}</strong> / {totalCount} 已完成
          </span>
          <span>{running ? "正在核验" : allDone ? "核验完成" : "等待启动"}</span>
        </div>
      </section>

      <div className="pw-check-columns">
        {renderColumn("an", anState, "安小二 · 企业资质核验")}
        {renderColumn("qian", qianState, "钱小二 · 交易条件核验")}
      </div>

      {running && (
        <div className="pw-check-progress">
          <div
            className="pw-check-progress-fill"
            style={{ width: `${(doneCount / totalCount) * 100}%` }}
          />
        </div>
      )}

      {renderReport()}
      {renderCreditScore()}

      {!readonly && !purchase.qualified && (
        <div className="pw-material">
          <div>
            <strong>补充经办人授权书</strong>
            <p>
              {purchase.documentName ||
                "可使用企业已有资料，也可上传新的授权文件。"}
            </p>
          </div>
          <div className="pw-inline-actions">
            <button
              type="button"
              className="pw-button pw-button-secondary"
              disabled={running}
              onClick={() =>
                update({ documentName: "企业档案 / 采购经办授权书.pdf" })
              }
            >
              使用企业档案材料
            </button>
            <label className="pw-file-button">
              上传材料
              <input
                aria-label="上传经办人授权书"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                disabled={running}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) update({ documentName: file.name });
                }}
              />
            </label>
          </div>
        </div>
      )}

      {!readonly && (
        <div className="pw-action-bar">
          <p>
            {purchase.qualified
              ? `${totalCount} 项核验全部通过，可以选粮点价。`
              : allDone
                ? "核验存在异常项，请补充材料后重新核验。"
                : running
                  ? `安小二与钱小二正在并行核验 ${doneCount}/${totalCount}…`
                  : "核验通过后方可进入选粮点价。"}
          </p>
          {purchase.qualified ? (
            <button type="button" className="pw-button" onClick={onNext}>
              核验通过，去选粮 →
            </button>
          ) : (
            <button
              type="button"
              className="pw-button"
              onClick={check}
              disabled={running}
            >
              {running
                ? "小二正在并行核验…"
                : allDone
                  ? "重新核验"
                  : "启动核验"}
            </button>
          )}
        </div>
      )}
    </>
  );
}
