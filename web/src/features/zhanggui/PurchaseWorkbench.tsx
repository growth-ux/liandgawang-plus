import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { parseNeed } from "../liang/parseNeed";
import {
  PURCHASE_STAGES,
  PURCHASE_STORAGE_KEY,
  purchaseTransports,
  purchaseSources,
  formatMoney,
  newPurchase,
  logisticsSearchResult,
  orderProblems,
  purchaseMemory,
  purchaseSettlement,
  purchaseTotals,
  readPurchases,
  sourceSearchResult,
  type Purchase,
  type PurchaseNeed,
} from "./purchaseModel";
import PurchaseCockpit from "./PurchaseCockpit";
import PurchaseDrawer from "./PurchaseDrawer";
import CostTrialPanel from "./CostTrialPanel";
import { purchaseInteraction } from "./purchaseInteraction";
import PurchaseMarket, { DecisionRecord } from "./PurchaseMarket";
import { assessPurchaseMarket } from "./marketAssessment";
import Qualification from "./Qualification";
import type { PurchaseAdvice } from "./purchaseAdvice";
import "./zhanggui.css";
import "./purchase.css";

const EMPTY_NEED: PurchaseNeed = {
  variety: "玉米",
  quantity: 0,
  destination: "",
  days: 0,
  budget: 0,
  stockDays: 0,
};
const EXAMPLE =
  "帮我采购 200 吨二等玉米送到潍坊，库存还能用15天，希望 10 天内到货，到厂价不超过 2680 元/吨。";
const STAGE_COPY = [
  ["采购需求", ""],
  ["", ""],
  ["", ""],
  ["", ""],
  ["", ""],
  ["", ""],
  ["", ""],
  ["", ""],
];

function Button({
  children,
  onClick,
  disabled,
  secondary = false,
}: {
  children: ReactNode;
  onClick(): void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <button
      type="button"
      className={secondary ? "pw-button pw-button-secondary" : "pw-button"}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Info({
  children,
  warning = false,
}: {
  children: ReactNode;
  warning?: boolean;
}) {
  return (
    <div className={`pw-info${warning ? " pw-warning" : ""}`}>{children}</div>
  );
}

export default function PurchaseWorkbench() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [purchases, setPurchases] = useState<Purchase[]>(readPurchases);
  const previousPurchaseId = useRef(searchParams.get("purchase"));
  const purchase =
    purchases.find((item) => item.id === searchParams.get("purchase")) ?? null;
  const [inspecting, setInspecting] = useState<number | null>(null);
  const [history, setHistory] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerAgent, setDrawerAgent] = useState("da");
  const [checking, setChecking] = useState<number | null>(null);
  const [agentActivityCue, setAgentActivityCue] = useState<{
    key: number;
    agentIds: string[];
  } | null>(null);
  const [startingMarketReview, setStartingMarketReview] = useState(false);
  const marketReviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveError, setSaveError] = useState("");
  const [need, setNeed] = useState<PurchaseNeed>(EMPTY_NEED);
  const stage = inspecting ?? purchase?.stage ?? 0;
  const readonly = Boolean(
    purchase && (inspecting !== null || purchase.ordered),
  );
  const totals = purchase ? purchaseTotals(purchase) : null;
  const references = purchases
    .filter(
      (item) =>
        item.learned &&
        item.id !== purchase?.id &&
        item.need.variety === (purchase?.need.variety ?? need.variety) &&
        item.need.destination ===
          (purchase?.need.destination ?? need.destination),
    )
    .slice(0, 2);

  useEffect(() => {
    try {
      localStorage.setItem(PURCHASE_STORAGE_KEY, JSON.stringify(purchases));
      setSaveError("");
    } catch {
      setSaveError(
        "当前浏览器无法保存采购进度，请保持页面开启，避免丢失本次记录。",
      );
    }
  }, [purchases]);

  useEffect(() => {
    if (previousPurchaseId.current === searchParams.get("purchase")) return;
    previousPurchaseId.current = searchParams.get("purchase");
    setInspecting(null);
    setChecking(null);
  }, [searchParams.get("purchase")]);

  useEffect(() => {
    setChecking(null);
    setAgentActivityCue(null);
  }, [stage]);

  useEffect(() => {
    setDrawerAgent(purchaseInteraction(purchase, stage).owner);
  }, [stage, purchase?.id, purchase?.ordered]);

  useEffect(
    () => () => {
      if (marketReviewTimer.current) clearTimeout(marketReviewTimer.current);
    },
    [],
  );

  function cueAgentActivity(agentId: string) {
    // 交易准入使用真实核验进度驱动舞台，不叠加入口反馈。
    if (inspecting !== null || stage === 2) return;
    const members = purchaseInteraction(purchase, stage).roles.members;
    const agentIds =
      agentId === "da"
        ? members
        : members.includes(agentId)
          ? [agentId]
          : [];
    if (agentIds.length === 0) return;
    setAgentActivityCue((current) => ({
      key: (current?.key ?? 0) + 1,
      agentIds,
    }));
  }

  function openDrawer(agentId: string) {
    setDrawerAgent(agentId);
    setDrawerOpen(true);
    cueAgentActivity(agentId);
  }

  function selectDrawerAgent(agentId: string) {
    setDrawerAgent(agentId);
    cueAgentActivity(agentId);
  }

  function update(patch: Partial<Purchase>) {
    if (!purchase) return;
    if (patch.sourceId !== undefined || patch.transportId !== undefined) {
      patch = {
        ...patch,
        reviewed: false,
        reviewAttempted: false,
        costEstimateAssumptions: patch.costEstimateAssumptions,
      };
    }
    if (patch.documentName !== undefined) {
      patch = { ...patch, qualified: false, qualificationChecked: false };
    }
    setPurchases((items) =>
      items.map((item) =>
        item.id === purchase.id ? { ...item, ...patch } : item,
      ),
    );
  }

  function open(item: Purchase) {
    setSearchParams({ purchase: item.id });
    setInspecting(null);
    setHistory(false);
  }
  function advance(patch: Partial<Purchase> = {}) {
    update({ stage: (purchase?.stage ?? 0) + 1, ...patch });
    setInspecting(null);
  }
  function start(confirmedNeed: PurchaseNeed) {
    if (startingMarketReview || (purchase && purchase.stage !== 0)) return;
    if (marketReviewTimer.current) clearTimeout(marketReviewTimer.current);
    setStartingMarketReview(true);
    setAgentActivityCue((current) => ({
      key: (current?.key ?? 0) + 1,
      agentIds: ["zhan"],
    }));
    marketReviewTimer.current = setTimeout(() => {
      if (purchase) {
        update({
          need: { ...confirmedNeed },
          stage: 1,
          marketDecision: undefined,
        });
        setInspecting(null);
      } else {
        const item = { ...newPurchase({ ...confirmedNeed }), stage: 1 };
        setPurchases((items) => [item, ...items]);
        open(item);
      }
      setStartingMarketReview(false);
      marketReviewTimer.current = null;
    }, 2500);
  }

  function decideMarket(action: "buy" | "adjust" | "watch", advice?: PurchaseAdvice) {
    if (!purchase || purchase.stage !== 1) return;
    const currentNeed = purchase.need;
    const assessment = assessPurchaseMarket(currentNeed);
    update({
      need: action === "buy" ? assessment.suggestedNeed : currentNeed,
      stage: action === "buy" ? 2 : action === "adjust" ? 0 : 1,
      marketDecision: {
        action,
        summary: advice ? `${advice.title}。${advice.reasoning}${advice.caution}` : assessment.summary,
        advice,
        decidedAt: new Date().toISOString(),
        assessedNeed: { ...currentNeed },
        suggestedNeed: assessment.suggestedNeed,
      },
    });
    setInspecting(null);
  }

  return (
    <div className="pw-page pw-avatar-workbench">
      <header className="pw-header">
        <div className="pw-brand">
          <span className="pw-brand-mark">掌</span>
          <div>
            <p className="pw-eyebrow">粮掌柜 · 全程采购服务</p>
            <h1>采购协作驾驶舱</h1>
          </div>
        </div>
        <div className="pw-header-actions">
          <Button
            secondary
            onClick={() => {
              setHistory(!history);
              setChecking(null);
            }}
          >
            {history
              ? "返回工作台"
              : `采购记录${purchases.length ? ` · ${purchases.length}` : ""}`}
          </Button>
          {purchase && (
            <Button
              secondary
              onClick={() => {
                setNeed({ ...EMPTY_NEED });
                setSearchParams({});
                setInspecting(null);
                setHistory(false);
              }}
            >
              ＋ 新建采购
            </Button>
          )}
        </div>
      </header>
      {saveError && (
        <div role="alert">
          <Info warning>{saveError}</Info>
        </div>
      )}
      {history ? (
        <section className="pw-panel pw-history">
          <p className="pw-eyebrow">持续跟进每一笔采购</p>
          <h2>采购记录</h2>
          {purchases.length === 0 ? (
            <p className="pw-muted">
              还没有采购记录，先描述你的第一笔采购需求。
            </p>
          ) : (
            purchases.map((item) => (
              <button
                type="button"
                className="pw-history-row"
                key={item.id}
                onClick={() => open(item)}
              >
                <span>
                  <strong>
                    {item.need.quantity} 吨{item.need.variety} ·{" "}
                    {item.need.destination}
                  </strong>
                  <small>
                    {item.id} ·{" "}
                    {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                  </small>
                </span>
                <span className="pw-tag">
                  {item.learned
                    ? "已完成"
                    : item.stage === 1 &&
                        item.marketDecision?.action === "watch"
                      ? "行情研判 · 观望中"
                      : PURCHASE_STAGES[item.stage]}{" "}
                  →
                </span>
              </button>
            ))
          )}
        </section>
      ) : (
        <>
          {purchase && (
            <div className="pw-order-heading">
              <div>
                <span className="pw-tag">
                  {purchase.stage < 2 ? "采购意向" : "商城采购"}
                </span>
                <strong>
                  {purchase.need.quantity} 吨二等{purchase.need.variety}
                </strong>
                <span className="pw-muted">→ {purchase.need.destination}</span>
              </div>
              <p>
                {purchase.need.days} 天内到货 <span>·</span> 到厂预算 ≤{" "}
                {formatMoney(purchase.need.budget)} 元/吨 <span>·</span>{" "}
                {purchase.id}
              </p>
            </div>
          )}
          <nav className="pw-rail" aria-label="买粮流程">
            {PURCHASE_STAGES.map((label, index) => {
              const done = Boolean(
                purchase &&
                (index < purchase.stage ||
                  (index === PURCHASE_STAGES.length - 1 && purchase.learned)) &&
                (index !== 1 || Boolean(purchase.marketDecision)),
              );
              return (
                <button
                  type="button"
                  key={label}
                  className="pw-step"
                  data-active={index === stage}
                  data-done={done}
                  disabled={!purchase || index > purchase.stage}
                  aria-current={index === stage ? "step" : undefined}
                  onClick={() =>
                    setInspecting(index === purchase?.stage ? null : index)
                  }
                >
                  <span className="pw-step-number">
                    {done ? "✓" : `0${index + 1}`}
                  </span>
                  <span>
                    {label}
                    <small>
                      {index === 1 &&
                      purchase &&
                      purchase.stage > 1 &&
                      !purchase.marketDecision
                        ? "历史未单独记录"
                        : index === stage
                          ? purchase?.received
                            ? "已完成"
                            : "当前阶段"
                          : done
                            ? "已完成 · 可回看"
                            : "待推进"}
                    </small>
                  </span>
                </button>
              );
            })}
          </nav>
          <PurchaseCockpit
            purchase={purchase}
            need={need}
            stage={stage}
            checking={checking}
            reviewing={inspecting !== null}
            selectedAgent={drawerOpen ? drawerAgent : null}
            activityCue={agentActivityCue}
            onOpen={openDrawer}
          />
          <PurchaseDrawer
            open={drawerOpen}
            agentId={drawerAgent}
            purchase={purchase}
            need={need}
            stage={stage}
            checking={checking}
            reviewing={inspecting !== null}
            onClose={() => setDrawerOpen(false)}
            onSelectAgent={selectDrawerAgent}
          >
            {purchase?.originMission && (
              <details className="pw-origin-results">
                <summary>
                  本笔采购沿用原方案 {purchase.originMission.mission_code} ·
                  查看小二分析依据
                </summary>
                {purchase.originMission.agent_runs
                  .filter((run) => run.output_snapshot)
                  .map((run) => (
                    <article key={run.agent_id}>
                      <strong>{run.participation_reason}</strong>
                      <p>{run.output_snapshot?.summary}</p>
                    </article>
                  ))}
              </details>
            )}
            <div className="pw-grid">
              <section
                className="pw-panel pw-main"
                id="purchase-step-content"
                tabIndex={-1}
                key={`${purchase?.id ?? "new"}-${stage}`}
              >
                {(STAGE_COPY[stage][0] || STAGE_COPY[stage][1]) && (
                  <div className="pw-section-heading">
                    <p className="pw-eyebrow">
                      {String(stage + 1).padStart(2, "0")} /{" "}
                      {PURCHASE_STAGES[stage]}
                    </p>
                    {STAGE_COPY[stage][0] && <h2>{STAGE_COPY[stage][0]}</h2>}
                    {STAGE_COPY[stage][1] && <p>{STAGE_COPY[stage][1]}</p>}
                  </div>
                )}
                {inspecting !== null && (
                  <Info>
                    正在回看已完成的步骤。
                    <button
                      type="button"
                      className="pw-text-button"
                      onClick={() => setInspecting(null)}
                    >
                      返回当前办理阶段 →
                    </button>
                  </Info>
                )}
                {stage === 0 &&
                  (readonly && purchase ? (
                    <NeedSummary need={purchase.need} />
                  ) : (
                    <>
                      {purchase?.marketDecision && (
                        <>
                          <DecisionRecord decision={purchase.marketDecision} />
                          <Info>
                            请重新确认采购条件，下一步将按本次需求重新研判行情。
                          </Info>
                        </>
                      )}
                      <NeedForm
                        need={purchase?.need ?? need}
                        starting={startingMarketReview}
                        onStart={start}
                      />
                    </>
                  ))}
                {stage === 1 && purchase && (
                  <PurchaseMarket
                    purchase={purchase}
                    need={
                      inspecting !== null && purchase.marketDecision
                        ? purchase.marketDecision.assessedNeed
                        : purchase.need
                    }
                    readonly={readonly}
                    onDecide={decideMarket}
                  />
                )}
                {stage === 2 && purchase && (
                  <Qualification
                    purchase={purchase}
                    readonly={readonly}
                    update={update}
                    onNext={() => advance()}
                    onProgress={setChecking}
                  />
                )}
                {stage === 3 && purchase && (
                  <Sources
                    purchase={purchase}
                    readonly={readonly}
                    update={update}
                    onNext={() => advance({ payee: totals!.source.name })}
                  />
                )}
                {stage === 4 && purchase && (
                  <Transport
                    purchase={purchase}
                    readonly={readonly}
                    update={update}
                    onNext={() => advance()}
                  />
                )}
                {stage === 5 && purchase && (
                  <Order
                    purchase={purchase}
                    inspecting={inspecting !== null}
                    update={update}
                    onRevise={() => update({ stage: 3, reviewed: false })}
                    onReceived={() =>
                      advance({ received: true, learned: false })
                    }
                  />
                )}
                {stage === 6 && purchase && (
                  <Review
                    purchase={purchase}
                    phase="cost"
                    onNext={inspecting === null ? () => advance({ learned: true }) : undefined}
                  />
                )}
                {stage === 7 && purchase && (
                  <Review
                    purchase={purchase}
                    phase="knowledge"
                    onClose={() => setDrawerOpen(false)}
                  />
                )}
              </section>
              {stage < 6 && (stage > 1 || references.length > 0) && <details className="pw-drawer-support">
                <summary>
                  {stage <= 1
                    ? "相关采购经验"
                    : stage === 3
                      ? "企业经验"
                      : stage === 5
                        ? "采购账单与企业经验"
                      : "采购建议、账单与企业经验"}
                </summary>
                <aside className="pw-sidebar">
                  {stage > 1 && stage !== 3 && stage !== 5 && <section className="pw-step-guidance">
                    <p className="pw-eyebrow">粮掌柜建议</p>
                    <h3>{PURCHASE_STAGES[stage]}</h3>
                    <p>{adviceFor(stage, purchase)}</p>
                    <small>
                      {inspecting !== null
                        ? "正在回看历史阶段，当前内容只读"
                        : "小二提供依据，关键决策由你确认"}
                    </small>
                  </section>}
                  {stage > 1 && totals && purchase && purchase.stage >= 4 && (
                    <section className="pw-side-section">
                      <p className="pw-eyebrow">本笔采购账单</p>
                      <dl className="pw-bill">
                        <div>
                          <dt>粮款</dt>
                          <dd>¥ {formatMoney(totals.goods)}</dd>
                        </div>
                        <div>
                          <dt>
                            {purchase.transportId === "pickup"
                              ? "自提运输费用"
                              : "物流费用"}
                          </dt>
                          <dd>
                            {purchase.transportId === "pickup"
                              ? "采购方另行承担"
                              : `¥ ${formatMoney(totals.logistics)}`}
                          </dd>
                        </div>
                        {totals.additional > 0 && (
                          <div>
                            <dt>装卸、损耗等方案费用</dt>
                            <dd>¥ {formatMoney(totals.additional)}</dd>
                          </div>
                        )}
                        <div className="pw-bill-total">
                          <dt>
                            {purchase.transportId === "pickup"
                              ? "平台应付金额"
                              : "预计总成本"}
                          </dt>
                          <dd>¥ {formatMoney(totals.total)}</dd>
                        </div>
                      </dl>
                      <p className="pw-muted">
                        {purchase.transportId === "pickup"
                          ? `粮款 ${formatMoney(totals.unit)} 元/吨 · 自提费用未计入`
                          : `到厂 ${formatMoney(totals.unit)} 元/吨 · 预计 ${totals.days} 天到货`}
                      </p>
                    </section>
                  )}
                  <section className="pw-side-section">
                    <div className="pw-section-top">
                      <p className="pw-eyebrow">{stage <= 1 ? "相关采购经验" : "企业经验 · 主动引用"}</p>
                      <Link to="/knowledge">知识大脑 ↗</Link>
                    </div>
                    {references.length ? (
                      references.map((item) => (
                        <article className="pw-memory" key={item.id}>
                          <span className="pw-tag">同品种 · 同到货区域</span>
                          <p>{purchaseMemory(item)}</p>
                          <small>来源：{item.id} · 算小二成本基线</small>
                        </article>
                      ))
                    ) : (
                      <p className="pw-muted">
                        暂无同区域、同品种的历史成本基线。
                      </p>
                    )}
                  </section>
                  {stage > 1 && stage !== 3 && <div className="pw-assurance">
                    <span>◎</span>
                    <p>
                      每一步有结果，关键节点有确认。
                      <br />
                      从一次买粮，积累下一次的经验。
                    </p>
                  </div>}
                </aside>
              </details>}
            </div>
          </PurchaseDrawer>
        </>
      )}
    </div>
  );
}

function NeedSummary({ need }: { need: PurchaseNeed }) {
  return (
    <dl className="pw-need-summary">
      <div>
        <dt>粮食品种</dt>
        <dd>二等{need.variety}</dd>
      </div>
      <div>
        <dt>采购数量</dt>
        <dd>{need.quantity} 吨</dd>
      </div>
      <div>
        <dt>到货地点</dt>
        <dd>{need.destination}</dd>
      </div>
      <div>
        <dt>交期与预算</dt>
        <dd>
          {need.days} 天 / {need.budget} 元/吨
        </dd>
      </div>
    </dl>
  );
}

function NeedForm({
  need: initialNeed,
  starting,
  onStart,
}: {
  need: PurchaseNeed;
  starting: boolean;
  onStart(value: PurchaseNeed): void;
}) {
  const [need, onChange] = useState<PurchaseNeed>({ ...initialNeed });
  const [structured, setStructured] = useState(initialNeed.quantity > 0);
  const [varietyConfirmed, setVarietyConfirmed] = useState(
    initialNeed.quantity > 0,
  );
  const [dirty, setDirty] = useState(false);
  const [text, setText] = useState(
    initialNeed.quantity > 0
      ? `${initialNeed.days}天内采购${initialNeed.quantity}吨二等${initialNeed.variety}到${initialNeed.destination}，到厂预算不超过${initialNeed.budget}元/吨${initialNeed.stockDays ? `，库存还能用${initialNeed.stockDays}天` : ""}`
      : "",
  );
  const [notice, setNotice] = useState("");
  const errors = {
    variety: varietyConfirmed ? "" : "请选择粮食品种",
    destination: need.destination === "山东省潍坊市" ? "" : "请选择到货地区",
    quantity: !need.quantity
      ? "请填写采购数量"
      : Number.isFinite(need.quantity) && need.quantity >= 1 && need.quantity <= 1200
        ? "" : "采购数量需在 1–1,200 吨之间",
    days: !need.days
      ? "请填写到货期限"
      : Number.isInteger(need.days) && need.days >= 1
        ? "" : "到货天数需为正整数",
    budget: !need.budget
      ? "请填写到厂预算"
      : Number.isFinite(need.budget) && need.budget > 0
        ? "" : "预算需大于 0",
    stockDays: !need.stockDays
      ? "请填写库存可用天数"
      : Number.isInteger(need.stockDays) && need.stockDays >= 1 && need.stockDays <= 365
        ? "" : "库存天数需为 1–365 的整数",
  };
  const valid = structured && !dirty && !Object.values(errors).some(Boolean);
  function fieldError(field: keyof typeof errors) {
    return !dirty && errors[field] ? (
      <span className="pw-field-error" id={`purchase-${field}-error`}>
        {errors[field]}
      </span>
    ) : null;
  }
  function fieldAccessibility(field: keyof typeof errors) {
    return {
      "aria-invalid": !dirty && Boolean(errors[field]),
      "aria-describedby": !dirty && errors[field] ? `purchase-${field}-error` : undefined,
    };
  }
  function parse() {
    const stock = text.match(/库存[^，。；;\n\d]{0,12}(\d+)\s*天/);
    // 库存天数与到货交期是两个条件，先分离库存片段再提取交期。
    const result = parseNeed(stock ? text.replace(stock[0], "") : text);
    const locations = [
      ...text.matchAll(
        /(?:送到|送至|到货地[为是：:\s]*|收货地[为是：:\s]*|到)([\u4e00-\u9fa5]+)/g,
      ),
    ]
      .map((match) => match[1])
      .filter((value) => !/^(厂|货)/.test(value));
    const unsupportedLocation = locations.some(
      (value) => !value.includes("潍坊"),
    );
    if (!text.trim()) {
      setNotice("请先输入采购需求。");
      return;
    }
    if (result.grade && result.grade !== "二等") {
      setNotice(
        "当前区域粮源按二等粮展示，暂不支持其他等级需求，请核对采购质量要求。",
      );
      return;
    }
    if (
      (result.variety && !["玉米", "小麦"].includes(result.variety)) ||
      unsupportedLocation
    ) {
      setNotice(
        "当前区域服务支持潍坊的玉米、小麦采购，暂不支持其他地区或品种，请核对采购条件。",
      );
      return;
    }
    onChange({
      variety: (result.variety as PurchaseNeed["variety"]) ?? "玉米",
      quantity: result.quantity_tons ?? 0,
      destination: text.includes("潍坊") ? "山东省潍坊市" : "",
      days: result.deadline_days ?? 0,
      budget: result.budget_price ?? 0,
      stockDays: stock ? Number(stock[1]) : 0,
    });
    setVarietyConfirmed(Boolean(result.variety));
    setStructured(true);
    setDirty(false);
    setNotice("");
  }
  return (
    <div className="pw-need-form">
      <label className="pw-input-label" htmlFor="purchase-request">
        描述需求
      </label>
      <div className="pw-request">
        <textarea
          id="purchase-request"
          rows={3}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setDirty(true);
            setNotice("");
          }}
          placeholder={`例如：${EXAMPLE}`}
        />
        <div>
          <div className="pw-inline-actions">
            <Button
              secondary
              onClick={() => {
                setText(EXAMPLE);
                setDirty(true);
                setNotice("");
              }}
            >
              填入示例
            </Button>
            <Button onClick={parse}>{structured && dirty ? "重新整理" : "整理需求"}</Button>
          </div>
        </div>
      </div>
      {notice && (
        <div role="status">
          <Info>{notice}</Info>
        </div>
      )}
      {structured && (
        <>
          {dirty && (
            <Info warning>
              描述已修改，请重新整理。
            </Info>
          )}
          <div className="pw-section-top pw-form-heading">
            <h3>采购条件</h3>
          </div>
          <div className="pw-fields">
            <label>
              粮食品种
              <select
                {...fieldAccessibility("variety")}
                value={varietyConfirmed ? need.variety : ""}
                onChange={(e) => {
                  setVarietyConfirmed(Boolean(e.target.value));
                  onChange({
                    ...need,
                    variety: e.target.value as PurchaseNeed["variety"],
                  });
                }}
              >
                <option value="" disabled>
                  待补充粮种
                </option>
                <option>玉米</option>
                <option>小麦</option>
              </select>
              {fieldError("variety")}
            </label>
            <label>
              采购数量（吨）
              <input
                {...fieldAccessibility("quantity")}
                type="number"
                min="1"
                max="1200"
                value={need.quantity || ""}
                onChange={(e) =>
                  onChange({ ...need, quantity: Number(e.target.value) })
                }
              />
              {fieldError("quantity")}
            </label>
            <label>
              到货地区
              <select
                {...fieldAccessibility("destination")}
                value={need.destination}
                onChange={(e) =>
                  onChange({ ...need, destination: e.target.value })
                }
              >
                <option value="" disabled>
                  待补充到货地区
                </option>
                <option value="山东省潍坊市">山东省潍坊市</option>
              </select>
              {fieldError("destination")}
            </label>
            <label>
              最晚到货（天内）
              <input
                {...fieldAccessibility("days")}
                type="number"
                min="1"
                step="1"
                value={need.days || ""}
                onChange={(e) =>
                  onChange({ ...need, days: Number(e.target.value) })
                }
              />
              {fieldError("days")}
            </label>
            <label>
              到厂预算上限（元/吨）
              <input
                {...fieldAccessibility("budget")}
                type="number"
                min="1"
                value={need.budget || ""}
                onChange={(e) =>
                  onChange({ ...need, budget: Number(e.target.value) })
                }
              />
              {fieldError("budget")}
            </label>
            <label>
              库存可用天数
              <input
                {...fieldAccessibility("stockDays")}
                aria-label="库存可用天数"
                type="number"
                min="1"
                max="365"
                step="1"
                value={need.stockDays || ""}
                onChange={(e) =>
                  onChange({ ...need, stockDays: Number(e.target.value) })
                }
              />
              {fieldError("stockDays")}
            </label>
            <div className="pw-static-field">
              <span>质量要求</span>
              <strong>二等及以上</strong>
              <small>水分 ≤ 14% · 杂质 ≤ 1%</small>
            </div>
          </div>
          <div className="pw-action-bar">
            <Button
              onClick={() => onStart(need)}
              disabled={!valid || starting}
            >
              {starting ? "正在研判行情…" : "确认，查看行情"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// Qualification 已提取到 ./Qualification.tsx

type AiMatchingKind = "source" | "logistics";
type AiMatchingStatus = "idle" | "analyzing" | "ready";

const AI_MATCHING_COPY: Record<
  AiMatchingKind,
  {
    team: string;
    title: string;
    description: string;
    action: string;
    readyTitle: string;
    phases: Array<{ title: string; detail: string }>;
  }
> = {
  source: {
    team: "粮小二 + 瞻小二 + 企业知识库",
    title: "启动粮源智能匹配",
    description:
      "系统先按准入规则筛选粮源，再由AI结合价格、质量与履约经验完成综合研判。",
    action: "开始智能匹配",
    readyTitle: "粮源智能匹配已完成",
    phases: [
      {
        title: "理解采购意图",
        detail: "拆解品种、数量、预算、交期和质量约束",
      },
      {
        title: "召回企业经验",
        detail: "查找同品种、同区域的采购与履约经验",
      },
      {
        title: "检索并筛选粮源",
        detail: "核验可供量、报价时效、质量和交货能力",
      },
      {
        title: "多目标排序",
        detail: "平衡价格、质量、供应稳定性与交付风险",
      },
    ],
  },
  logistics: {
    team: "运小二 + 算小二 + 企业知识库",
    title: "启动物流智能匹配",
    description:
      "系统先按资质、线路和运力规则筛选，再由AI综合优化成本、时效与履约风险。",
    action: "开始智能匹配",
    readyTitle: "物流智能匹配已完成",
    phases: [
      {
        title: "计算发运需求",
        detail: "根据吨位、装载量和交期拆解车次与节奏",
      },
      {
        title: "检索可用运力",
        detail: "核验承运资质、线路覆盖、车辆适配与当日报价",
      },
      {
        title: "预测履约风险",
        detail: "结合历史准时率、交期余量和货损风险研判",
      },
      {
        title: "生成调度方案",
        detail: "输出综合最优方案、备选运力和异常处置余量",
      },
    ],
  },
};

function AiMatchingGate({
  kind,
  readonly,
  bypass = false,
  resultSummary,
  resultMeta,
  children,
}: {
  kind: AiMatchingKind;
  readonly: boolean;
  bypass?: boolean;
  resultSummary: string;
  resultMeta: string;
  children: ReactNode;
}) {
  const copy = AI_MATCHING_COPY[kind];
  const [status, setStatus] = useState<AiMatchingStatus>(
    readonly ? "ready" : "idle",
  );
  const [activePhase, setActivePhase] = useState(-1);

  useEffect(() => {
    if (readonly) setStatus("ready");
  }, [readonly]);

  useEffect(() => {
    if (status !== "analyzing") return;
    const phaseTimers = copy.phases.map((_, index) =>
      setTimeout(() => setActivePhase(index), 260 + index * 620),
    );
    const readyTimer = setTimeout(() => {
      setActivePhase(copy.phases.length - 1);
      setStatus("ready");
    }, 260 + copy.phases.length * 620);
    return () => {
      phaseTimers.forEach(clearTimeout);
      clearTimeout(readyTimer);
    };
  }, [copy.phases, status]);

  if (bypass) return <>{children}</>;

  return (
    <>
      <section
        className="pw-ai-match-gate"
        data-status={status}
        aria-live="polite"
      >
        <div className="pw-ai-match-head">
          <div>
            <span>{copy.team}</span>
            <h3>
              {status === "ready" ? copy.readyTitle : copy.title}
            </h3>
            <p>
              {status === "ready" ? resultSummary : copy.description}
            </p>
          </div>
          {status === "idle" && (
            <button
              type="button"
              onClick={() => {
                setActivePhase(-1);
                setStatus("analyzing");
              }}
            >
              {copy.action}
            </button>
          )}
          {status === "analyzing" && (
            <strong className="pw-ai-match-state">智能匹配中</strong>
          )}
          {status === "ready" && (
            <strong className="pw-ai-match-state is-ready">待你确认</strong>
          )}
        </div>

        {status === "idle" && (
          <div className="pw-ai-match-brief">
            <div>
              <span>决策方式</span>
              <strong>规则筛选 + AI综合研判</strong>
            </div>
            <div>
              <span>经验支持</span>
              <strong>主动引用企业办事记录</strong>
            </div>
            <div>
              <span>输出结果</span>
              <strong>推荐、备选与风险依据</strong>
            </div>
          </div>
        )}

        {status === "analyzing" && (
          <ol className="pw-ai-match-phases" aria-label="智能匹配进度">
            {copy.phases.map((phase, index) => {
              const phaseState =
                index < activePhase
                  ? "done"
                  : index === activePhase
                    ? "active"
                    : "pending";
              return (
                <li key={phase.title} data-state={phaseState}>
                  <i aria-hidden="true">
                    {phaseState === "done" ? "✓" : index + 1}
                  </i>
                  <span>
                    <strong>{phase.title}</strong>
                    <small>{phase.detail}</small>
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {status === "ready" && (
          <div className="pw-ai-match-result">
            <span>智能匹配结论</span>
            <strong>{resultMeta}</strong>
            <small>结果不会自动生效，请检查依据后确认方案</small>
          </div>
        )}
      </section>
      {status === "ready" && children}
    </>
  );
}

function Sources({
  purchase,
  readonly,
  update,
  onNext,
}: {
  purchase: Purchase;
  readonly: boolean;
  update(patch: Partial<Purchase>): void;
  onNext(): void;
}) {
  const sources = purchaseSources(purchase);
  const selected = purchaseTotals(purchase).source;
  const search = sourceSearchResult(purchase.need);
  const recommendedIndex = Math.max(
    0,
    sources.findIndex((source) => purchase.need.quantity <= source.stock),
  );
  const recommended = sources[recommendedIndex];
  function evidenceFor(source: (typeof sources)[number], index: number) {
    return (
      source.evidence ?? {
        quoteNo: purchase.originMission
          ? `原任务 ${purchase.id}`
          : `BJ-${source.id.toUpperCase()}-${String(index + 1).padStart(3, "0")}`,
        updatedAt: purchase.originMission ? "随已确认方案带入" : "今日已更新",
        priceBasis: purchase.originMission
          ? "沿用原方案价格口径"
          : "含税出库价",
        stockCheckedAt: purchase.originMission ? "原方案确认时" : "今日已核验",
        impurities: "以质检单为准",
        bulkDensity: "以质检单为准",
        moldyKernels: "以质检单为准",
        inspectionReportNo: purchase.originMission
          ? "原方案专业结果"
          : "待查看质检单",
        inspectedAt: "方案确认时",
        fulfilledOrders: 0,
        fulfillmentRate: "已核验",
        disputes: 0,
        benchmarkPrice: source.price,
        benchmarkLow: source.price - 20,
        benchmarkHigh: source.price + 30,
        sampleSize: purchase.originMission ? 1 : 8,
        risk: purchase.originMission
          ? "当前粮源来自已确认方案，点价前请复核当前报价与可供数量。"
          : "点价前需再次确认实时报价与可供数量。",
      }
    );
  }

  function selectSource(sourceId: string) {
    update({
      sourceId,
      transportId: purchaseTransports(purchase)[0].id,
      reviewed: false,
    });
  }

  function rejectionDetail(
    item: (typeof search.examples)[number],
  ): string {
    if (item.reason === "可供数量不足")
      return `可供 ${formatMoney(item.record.stock)} 吨，低于本次 ${formatMoney(purchase.need.quantity)} 吨需求`;
    if (item.reason === "报价未更新")
      return "今日尚未更新报价，需供应方重新确认";
    if (item.reason === "预计交期超限")
      return `预计 ${item.record.leadDays} 天到货，超过 ${purchase.need.days} 天交期`;
    return item.reason;
  }

  const recommendedEvidence = evidenceFor(recommended, recommendedIndex);
  const leadDaysFor = (sourceId: string, fallbackIndex: number) =>
    search.eligible.find((item) => item.id === sourceId)?.leadDays ??
    Math.min(purchase.need.days, 3 + fallbackIndex);
  const recommendedLeadDays = leadDaysFor(recommended.id, recommendedIndex);
  const recommendedCoverage =
    recommended.stock / Math.max(1, purchase.need.quantity);
  const recommendedPriceDelta =
    recommendedEvidence.benchmarkPrice - recommended.price;
  const selectedIndex = Math.max(
    0,
    sources.findIndex((source) => source.id === selected.id),
  );
  const selectedEvidence = evidenceFor(selected, selectedIndex);
  const benchmarkDelta = selected.price - selectedEvidence.benchmarkPrice;
  const benchmarkPercent =
    selectedEvidence.benchmarkPrice > 0
      ? (benchmarkDelta / selectedEvidence.benchmarkPrice) * 100
      : 0;
  const range = Math.max(
    1,
    selectedEvidence.benchmarkHigh - selectedEvidence.benchmarkLow,
  );
  const selectedPosition = Math.min(
    100,
    Math.max(
      0,
      ((selected.price - selectedEvidence.benchmarkLow) / range) * 100,
    ),
  );

  return (
    <AiMatchingGate
      kind="source"
      readonly={readonly}
      bypass={Boolean(purchase.originMission)}
      resultSummary={`已检索 ${search.records.length} 个候选粮源，筛出 ${search.eligible.length} 个合格粮源，并完成价格、质量、供给、履约和交付综合比选。`}
      resultMeta={`优先推荐 ${recommended.depot}，另保留 ${Math.max(0, Math.min(2, search.eligible.length - 1))} 个备选`}
    >
      <>
      <section className="pw-source-scope" aria-label="本次粮源匹配范围">
        <div>
          <span>采购条件</span>
          <strong>
            二等{purchase.need.variety} · {formatMoney(purchase.need.quantity)} 吨
          </strong>
          <small>
            到货区域 {purchase.need.destination} · {purchase.need.days} 天内
          </small>
        </div>
        <div className="pw-source-scope-result">
          <span>{purchase.originMission ? "方案来源" : "数据来源"}</span>
          <strong>
            {purchase.originMission
              ? "沿用原任务已确认粮源"
              : search.channels
                  .map((item) => `${item.channel} ${item.count}`)
                  .join(" · ")}
          </strong>
          {purchase.originMission && <small>{purchase.id}</small>}
        </div>
      </section>

      {!purchase.originMission && (
        <section className="pw-source-funnel">
          <div className="pw-source-funnel-heading">
            <strong>筛选结果</strong>
            <small>今日 10:20 更新</small>
          </div>
          <div
            className="pw-source-funnel-flow"
            aria-label={`${search.records.length} 个候选粮源，经准入筛选淘汰 ${search.rejected.length} 个，${search.eligible.length} 个合格粮源参与多维比选，最终推荐 ${Math.min(3, search.eligible.length)} 个`}
          >
            <div className="pw-source-funnel-node">
              <span>候选粮源</span>
              <strong>
                {search.records.length}<small>个</small>
              </strong>
            </div>
            <div className="pw-source-funnel-link">
              <span>准入筛选</span>
              <small>淘汰 {search.rejected.length} 个</small>
              <i aria-hidden="true">→</i>
            </div>
            <div className="pw-source-funnel-node is-qualified">
              <span>合格粮源</span>
              <strong>
                {search.eligible.length}<small>个</small>
              </strong>
            </div>
            <div className="pw-source-funnel-link">
              <span>多维比选</span>
              <small>价 · 质 · 供 · 履 · 运</small>
              <i aria-hidden="true">→</i>
            </div>
            <div className="pw-source-funnel-node is-ranked">
              <span>推荐结果</span>
              <strong>
                {Math.min(3, search.eligible.length)}<small>个</small>
              </strong>
            </div>
          </div>
          <div className="pw-source-filter-chips" aria-label="硬性筛选条件">
            <span>等级 二等及以上</span>
            <span>可供 ≥ {formatMoney(purchase.need.quantity)} 吨</span>
            <span>当日报价</span>
            <span>交期 ≤ {purchase.need.days} 天</span>
          </div>
          <details className="pw-source-filter-details">
            <summary>
              筛选明细
              <span>{search.rejected.length} 个未通过</span>
            </summary>
            <div className="pw-source-filter-body">
              <div className="pw-source-reason-counts">
                {search.reasons.map((item) => (
                  <div key={item.reason}>
                    <span>{item.reason}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
              <div className="pw-source-rejected-examples">
                <span>典型淘汰记录</span>
                {search.examples.map((item) => (
                  <div key={item.record.id}>
                    <strong>{item.record.depot}</strong>
                    <p>{rejectionDetail(item)}</p>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </section>
      )}

      <section className="pw-source-featured" data-selected={recommended.id === selected.id}>
        <div className="pw-source-featured-head">
          <div>
            <span className="pw-source-kicker">优先推荐</span>
            <h3>{recommended.depot}</h3>
            <p>{recommended.name}</p>
          </div>
          <div className="pw-source-rank-badge" aria-label="推荐序位第一">
            <span>推荐序位</span>
            <strong>01</strong>
          </div>
        </div>

        <div className="pw-source-match-facts" aria-label="粮源匹配依据">
          <div data-dimension="price">
            <span>价格竞争力</span>
            <strong>{formatMoney(recommended.price)} 元/吨</strong>
            <small>
              较近30日中位价{recommendedPriceDelta >= 0 ? "低" : "高"} {formatMoney(Math.abs(recommendedPriceDelta))} 元
            </small>
          </div>
          <div data-dimension="quality">
            <span>质量指标</span>
            <strong>二等 · 水分 {recommended.moisture}</strong>
            <small>杂质 {recommendedEvidence.impurities} · 容重 {recommendedEvidence.bulkDensity}</small>
          </div>
          <div data-dimension="supply">
            <span>数量覆盖</span>
            <strong>{recommendedCoverage.toFixed(1)} 倍</strong>
            <small>可供 {formatMoney(recommended.stock)} 吨 · 需求 {formatMoney(purchase.need.quantity)} 吨</small>
          </div>
          <div data-dimension="fulfillment">
            <span>履约记录</span>
            <strong>{recommendedEvidence.fulfillmentRate}</strong>
            <small>近12月 {recommendedEvidence.fulfilledOrders || "多"} 笔 · 争议 {recommendedEvidence.disputes} 笔</small>
          </div>
          <div data-dimension="delivery">
            <span>交货响应</span>
            <strong>预计 {recommendedLeadDays} 天</strong>
            <small>支持 {purchase.need.destination} 区域发运</small>
          </div>
        </div>

        <div className="pw-source-caution">
          <span>关注</span>
          <p>{recommendedEvidence.risk}</p>
        </div>

        <div className="pw-source-featured-foot">
          <div>
            <span>报价编号 {recommendedEvidence.quoteNo}</span>
            <span>报价更新时间 {recommendedEvidence.updatedAt}</span>
          </div>
          <button
            type="button"
            className="pw-source-select-button"
            disabled={
              readonly || purchase.need.quantity > recommended.stock
            }
            onClick={() => selectSource(recommended.id)}
          >
            {recommended.id === selected.id ? "✓ 已选择" : "选择此粮源"}
          </button>
        </div>
      </section>

      <section className="pw-source-compare">
        <div className="pw-source-section-heading">
          <h3>候选对比</h3>
          <small>含税出库价 · 不含运输</small>
        </div>
        <div className="pw-source-table-wrap">
          <table>
            <thead>
              <tr>
                <th>粮库 / 供应方</th>
                <th>推荐序位</th>
                <th>出库价</th>
                <th>质量</th>
                <th>可供量</th>
                <th>预计交货</th>
                <th>履约率</th>
                <th>报价更新时间</th>
                <th><span className="sr-only">选择</span></th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source, index) => {
                const evidence = evidenceFor(source, index);
                const leadDays = leadDaysFor(source.id, index);
                const unavailable = purchase.need.quantity > source.stock;
                const isSelected = source.id === selected.id;
                const eligibleRank = sources
                  .filter((item) => item.stock >= purchase.need.quantity)
                  .findIndex((item) => item.id === source.id);
                return (
                  <tr key={source.id} data-selected={isSelected} data-disabled={unavailable}>
                    <td>
                      <strong>{source.depot}</strong>
                      <small>{source.name}</small>
                    </td>
                    <td>
                      <strong className="pw-source-table-rank">
                        {eligibleRank === 0 ? "优先" : eligibleRank > 0 ? `备选 ${eligibleRank}` : "—"}
                      </strong>
                      <small>{eligibleRank >= 0 ? `第 ${eligibleRank + 1} 位` : "数量不足"}</small>
                    </td>
                    <td>
                      <strong>{formatMoney(source.price)}</strong>
                      <small>元/吨</small>
                    </td>
                    <td>
                      <strong>二等 · {source.moisture}</strong>
                      <small>杂质 {evidence.impurities}</small>
                    </td>
                    <td>
                      <strong>{formatMoney(source.stock)} 吨</strong>
                      <small>{evidence.stockCheckedAt}</small>
                    </td>
                    <td>
                      <strong>{leadDays} 天</strong>
                      <small>满足 {purchase.need.days} 天交期</small>
                    </td>
                    <td>
                      <strong>{evidence.fulfillmentRate}</strong>
                      <small>争议 {evidence.disputes} 笔</small>
                    </td>
                    <td>
                      <strong>{evidence.updatedAt}</strong>
                      <small>{evidence.quoteNo}</small>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="pw-source-row-select"
                        aria-label={`选择${source.depot}`}
                        aria-pressed={isSelected}
                        disabled={readonly || unavailable}
                        onClick={() => selectSource(source.id)}
                      >
                        {unavailable ? "数量不足" : isSelected ? "已选" : "选择"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {!purchase.originMission && (
        <section className="pw-source-benchmark">
          <div className="pw-source-section-heading">
            <h3>近30日成交基准</h3>
            <small>
              同区域 · 二等{purchase.need.variety} · {selectedEvidence.sampleSize} 笔
            </small>
          </div>
          <div className="pw-benchmark-body">
            <div className="pw-benchmark-median">
              <span>成交中位价</span>
              <strong>{formatMoney(selectedEvidence.benchmarkPrice)}</strong>
              <small>元/吨</small>
            </div>
            <div className="pw-benchmark-range">
              <div className="pw-benchmark-track">
                <i style={{ left: `${selectedPosition}%` }} />
              </div>
              <div>
                <span>{formatMoney(selectedEvidence.benchmarkLow)}</span>
                <span>可比成交区间</span>
                <span>{formatMoney(selectedEvidence.benchmarkHigh)}</span>
              </div>
            </div>
            <div className={`pw-benchmark-delta${benchmarkDelta <= 0 ? " is-good" : " is-high"}`}>
              <span>当前所选</span>
              <strong>
                {benchmarkDelta <= 0 ? "低" : "高"} {formatMoney(Math.abs(benchmarkDelta))} 元/吨
              </strong>
              <small>{Math.abs(benchmarkPercent).toFixed(1)}% · {selectedEvidence.sampleSize} 笔样本</small>
            </div>
          </div>
          <p className="pw-benchmark-note">
            参考价不等于当前成交价。
          </p>
        </section>
      )}

      {!readonly && (
        <div className="pw-source-confirm">
          <div className="pw-source-confirm-main">
            <span>本次点价</span>
            <strong>{selected.depot} · {formatMoney(purchase.need.quantity)} 吨</strong>
            <small>
              报价 {selectedEvidence.quoteNo} · 更新于 {selectedEvidence.updatedAt}
            </small>
          </div>
          <div className="pw-source-confirm-amount">
            <span>粮款合计</span>
            <strong>¥ {formatMoney(selected.price * purchase.need.quantity)}</strong>
            <small>{formatMoney(selected.price)} 元/吨 · 不含运输</small>
          </div>
          <Button
            disabled={purchase.need.quantity > selected.stock}
            onClick={onNext}
          >
            确认本次点价 →
          </Button>
        </div>
      )}
      </>
    </AiMatchingGate>
  );
}

function Transport({
  purchase,
  readonly,
  update,
  onNext,
}: {
  purchase: Purchase;
  readonly: boolean;
  update(patch: Partial<Purchase>): void;
  onNext(): void;
}) {
  const totals = purchaseTotals(purchase);
  const pickup = purchase.transportId === "pickup";
  const allOptions = purchaseTransports(purchase);
  const logisticsSearch = logisticsSearchResult(purchase);
  const options = purchaseTransports(purchase).filter(
    (item) =>
      item.mode === (pickup ? "pickup" : "delivery") &&
      !(purchase.sourceId === "weifang" && item.id === "combined") &&
      (pickup ||
        Boolean(purchase.originMission) ||
        logisticsSearch.responded.some(
          (candidate) =>
            candidate.mode === (item.id === "combined" ? "combined" : "road"),
        )),
  );
  const onTime = totals.days <= purchase.need.days;
  const withinBudget = totals.unit <= purchase.need.budget;
  const feasible = onTime && withinBudget;
  const selectedCapacity = totals.transport.loadCapacity ?? 30;
  const selectedLoadUnit = totals.transport.loadUnit ?? "车次";
  const selectedLoads = Math.ceil(
    purchase.need.quantity / Math.max(1, selectedCapacity),
  );
  const roadOption = options.find((option) => option.id === "road");
  const roadLogistics = roadOption
    ? purchaseTotals({ ...purchase, transportId: roadOption.id }).logistics
    : 0;
  const assessedOptions = options
    .filter((option) => option.mode === "delivery")
    .map((option) => {
      const cost = purchaseTotals({ ...purchase, transportId: option.id });
      const responseCount = logisticsSearch.responded.filter(
        (candidate) =>
          candidate.mode === (option.id === "combined" ? "combined" : "road"),
      ).length;
      const bufferDays = Math.max(0, purchase.need.days - cost.days);
      const historicalOnTime = Number.parseFloat(option.onTimeRate ?? "95");
      const predictedOnTime = Math.round(
        Math.min(
          99,
          Math.max(
            80,
            historicalOnTime + Math.min(bufferDays, 4) * 0.25 -
              (option.id === "combined" ? 0.8 : 0),
          ),
        ),
      );
      const savings = Math.max(0, roadLogistics - cost.logistics);
      return {
        option,
        cost,
        responseCount,
        bufferDays,
        predictedOnTime,
        savings,
        weatherRisk: "低",
        cargoRisk: option.id === "combined" ? "中低" : "低",
        costDeviation: option.id === "combined" ? "±5%" : "±3%",
        reason:
          option.id === "combined"
            ? `预计节省 ${formatMoney(savings)} 元运输费用，保留 ${bufferDays} 天交期余量`
            : `直达无中转，${responseCount} 家承运商响应，预计 ${cost.days} 天到货`,
      };
    });
  const recommendedAssessment =
    assessedOptions.find(
      (item) =>
        item.option.id === "combined" &&
        item.bufferDays >= 2 &&
        item.savings > 0,
    ) ?? assessedOptions.find((item) => item.option.id === "road") ?? assessedOptions[0];
  return (
    <>
      {purchase.originMission && (
        <Info>
          本任务已锁定运输方案；如需更换方式，请回到原方案重新研判。
        </Info>
      )}
      <div className="pw-segment" aria-label="提货方式">
        <button
          type="button"
          aria-pressed={!pickup}
          disabled={readonly}
          onClick={() =>
            update({
              transportId: allOptions[0].id,
              reviewed: false,
            })
          }
        >
          <strong>平台配送</strong>
          <span>{allOptions.filter((item) => item.mode === "delivery").length} 个可用方案</span>
        </button>
        <button
          type="button"
          aria-pressed={pickup}
          disabled={readonly || Boolean(purchase.originMission)}
          onClick={() => update({ transportId: "pickup", reviewed: false })}
        >
          <strong>自行提货</strong>
          <span>自备车辆到库装运</span>
        </button>
      </div>
      <div className="pw-route" aria-label="运输线路">
        <div className="pw-route-endpoint">
          <span>起运库点</span>
          <strong>{totals.source.depot}</strong>
        </div>
        <div className="pw-route-line">
          <small>{formatMoney(purchase.need.quantity)} 吨 · {totals.transport.label}</small>
          <i aria-hidden="true" />
          <span>{pickup ? "计划" : "预计"} {totals.days} 天</span>
        </div>
        <div className="pw-route-endpoint is-destination">
          <span>收货区域</span>
          <strong>{purchase.need.destination}</strong>
        </div>
      </div>
      <AiMatchingGate
        kind="logistics"
        readonly={readonly}
        bypass={pickup || Boolean(purchase.originMission)}
        resultSummary={`已核验 ${logisticsSearch.records.length} 个候选运力，收到 ${logisticsSearch.responded.length} 个有效报价，并形成 ${options.length} 个可执行运输方案。`}
        resultMeta={
          recommendedAssessment
            ? `综合最优为${recommendedAssessment.option.label}，预计 ${recommendedAssessment.cost.days} 天到货`
            : `已生成 ${options.length} 个可选运输方案`
        }
      >
        <>
      {!pickup && !purchase.originMission && (
        <section className="pw-source-funnel pw-logistics-funnel">
          <div className="pw-source-funnel-heading">
            <strong>运力匹配</strong>
            <small>今日 10:35 更新</small>
          </div>
          <div
            className="pw-source-funnel-flow"
            aria-label={`${logisticsSearch.records.length} 个候选运力，经资质、线路、运力和交期筛选，收到 ${logisticsSearch.responded.length} 个有效报价，形成 ${options.length} 个运输方案`}
          >
            <div className="pw-source-funnel-node">
              <span>候选运力</span>
              <strong>{logisticsSearch.records.length}<small>个</small></strong>
            </div>
            <div className="pw-source-funnel-link">
              <span>准入筛选</span>
              <small>淘汰 {logisticsSearch.records.length - logisticsSearch.qualified.length} 个</small>
              <i aria-hidden="true">→</i>
            </div>
            <div className="pw-source-funnel-node is-qualified">
              <span>有效报价</span>
              <strong>{logisticsSearch.responded.length}<small>个</small></strong>
            </div>
            <div className="pw-source-funnel-link">
              <span>智能匹配</span>
              <small>价 · 时 · 运力 · 风险</small>
              <i aria-hidden="true">→</i>
            </div>
            <div className="pw-source-funnel-node is-ranked">
              <span>可选方案</span>
              <strong>{options.length}<small>个</small></strong>
            </div>
          </div>
          <div className="pw-source-filter-chips" aria-label="运力准入条件">
            <span>承运商经营范围</span>
            <span>车辆与司机资质</span>
            <span>散粮运输适配</span>
            <span>线路覆盖</span>
            <span>运力与交期</span>
            <span>当日报价</span>
          </div>
          <details className="pw-source-filter-details">
            <summary>
              筛选明细
              <span>
                {logisticsSearch.qualified.length} 个准入 · {logisticsSearch.responded.length} 个完成报价
              </span>
            </summary>
            <div className="pw-logistics-filter-body">
              {logisticsSearch.reasons.map((item) => (
                <div key={item.reason}>
                  <span>{item.reason}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
              <div>
                <span>准入后未完成当日报价</span>
                <strong>{logisticsSearch.qualified.length - logisticsSearch.responded.length}</strong>
              </div>
            </div>
          </details>
        </section>
      )}
      {!pickup && !purchase.originMission && recommendedAssessment && (
        <section className="pw-transport-assessment">
          <div className="pw-transport-assessment-head">
            <div>
              <span>AI 动态研判</span>
              <h3>建议采用{recommendedAssessment.option.label}</h3>
              <p>{recommendedAssessment.reason}</p>
            </div>
            <button
              type="button"
              disabled={readonly || purchase.transportId === recommendedAssessment.option.id}
              onClick={() =>
                update({
                  transportId: recommendedAssessment.option.id,
                  reviewed: false,
                })
              }
            >
              {purchase.transportId === recommendedAssessment.option.id
                ? "已采用建议"
                : "采用建议方案"}
            </button>
          </div>
          <div className="pw-transport-assessment-metrics">
            <div>
              <span>准时到货预测</span>
              <strong>{recommendedAssessment.predictedOnTime}%</strong>
              <small>历史履约 + 交期余量</small>
            </div>
            <div>
              <span>天气路况风险</span>
              <strong data-risk="low">{recommendedAssessment.weatherRisk}</strong>
              <small>未来72小时无高影响预警</small>
            </div>
            <div>
              <span>粮食货损风险</span>
              <strong data-risk={recommendedAssessment.cargoRisk === "低" ? "low" : "medium"}>
                {recommendedAssessment.cargoRisk}
              </strong>
              <small>{recommendedAssessment.option.id === "combined" ? "含一次中转" : "直达无中转"}</small>
            </div>
            <div>
              <span>成本偏差风险</span>
              <strong>{recommendedAssessment.costDeviation}</strong>
              <small>依据当前报价口径估算</small>
            </div>
            <div>
              <span>备用承运能力</span>
              <strong>{Math.max(0, recommendedAssessment.responseCount - 1)} 家</strong>
              <small>可用于异常补充调度</small>
            </div>
          </div>
          <div className="pw-transport-assessment-foot">
            <span>研判依据</span>
            <p>平台同类运单、当前询价响应、交期余量及公路气象预警</p>
            <small>今日 10:40 更新 · 发运前持续复核</small>
          </div>
        </section>
      )}
      <div className="pw-transport-options">
        {options.map((option, index) => {
          const cost = purchaseTotals({ ...purchase, transportId: option.id });
          const optionPickup = option.id === "pickup";
          const loadCapacity = option.loadCapacity ?? 30;
          const loadUnit = option.loadUnit ?? "车次";
          const loads = Math.ceil(
            purchase.need.quantity / Math.max(1, loadCapacity),
          );
          const selected = purchase.transportId === option.id;
          const responseCount = logisticsSearch.responded.filter(
            (candidate) =>
              candidate.mode === (option.id === "combined" ? "combined" : "road"),
          ).length;
          const assessment = assessedOptions.find(
            (item) => item.option.id === option.id,
          );
          const recommended = recommendedAssessment?.option.id === option.id;
          return (
            <button
              type="button"
              key={option.id}
              className="pw-transport-option"
              data-selected={selected}
              data-recommended={recommended}
              aria-pressed={selected}
              disabled={readonly}
              onClick={() =>
                update({ transportId: option.id, reviewed: false })
              }
            >
              <div className="pw-transport-option-head">
                <div>
                  <span>运输方案 {String(index + 1).padStart(2, "0")}</span>
                  <h3>{option.label}</h3>
                </div>
                <b>
                  {selected && recommended
                    ? "已选 · AI建议"
                    : selected
                      ? "已选择"
                      : recommended
                        ? "AI建议"
                        : "选择"}
                </b>
              </div>
              {assessment && (
                <div className="pw-transport-match-reason">
                  <span>智能匹配</span>
                  <p>{assessment.reason}</p>
                </div>
              )}
              <div className="pw-transport-metrics">
                <div>
                  <span>{optionPickup ? "平台运费" : "运输单价"}</span>
                  <strong>
                    {optionPickup ? "不计费" : cost.freight}
                    {!optionPickup && <small>元/吨</small>}
                  </strong>
                </div>
                <div>
                  <span>运输费用</span>
                  <strong>{optionPickup ? "另行承担" : `¥ ${formatMoney(cost.logistics)}`}</strong>
                </div>
                <div>
                  <span>{optionPickup ? "粮款单价" : "到厂单价"}</span>
                  <strong>{formatMoney(cost.unit)}<small>元/吨</small></strong>
                </div>
                <div>
                  <span>{optionPickup ? "计划周期" : "预计到货"}</span>
                  <strong>{cost.days}<small>天</small></strong>
                </div>
              </div>
              <dl className="pw-transport-facts">
                <div>
                  <dt>运力安排</dt>
                  <dd>{loads} {loadUnit} · {loadCapacity} 吨/{loadUnit}</dd>
                </div>
                <div>
                  <dt>调度响应</dt>
                  <dd>{option.dispatchWindow ?? "按实际运力确认"}</dd>
                </div>
                {!optionPickup && (
                  <>
                    <div>
                      <dt>询价响应</dt>
                      <dd>{responseCount} 家承运商完成当日报价</dd>
                    </div>
                    <div>
                      <dt>历史履约</dt>
                      <dd>近12月 {option.completedOrders ?? "—"} 单 · 准时率 {option.onTimeRate ?? "待核验"}</dd>
                    </div>
                    <div>
                      <dt>合规核验</dt>
                      <dd>{option.complianceNote ?? "派车后核验车辆与司机资质"}</dd>
                    </div>
                    <div>
                      <dt>承运保障</dt>
                      <dd>{option.protectionNote ?? "以运输合同约定为准"}</dd>
                    </div>
                  </>
                )}
                <div>
                  <dt>费用口径</dt>
                  <dd>{option.priceBasis ?? "以确认方案为准"}</dd>
                </div>
                <div>
                  <dt>{optionPickup ? "平台报价" : "报价更新"}</dt>
                  <dd>
                    {option.quoteNo ? `${option.quoteNo} · ` : ""}
                    {option.quoteUpdatedAt ?? "原方案确认时"}
                  </dd>
                </div>
              </dl>
              {cost.days > purchase.need.days && (
                <span className="pw-danger">超过本次交期</span>
              )}
            </button>
          );
        })}
      </div>
      {pickup && (
        <div className="pw-pickup-guide">
          <h3>自提执行清单</h3>
          <dl>
            <div>
              <dt>车辆计划</dt>
              <dd>
                {selectedLoads} {selectedLoadUnit} · 按 {selectedCapacity} 吨/{selectedLoadUnit}规划，装车前复核车辆核载
              </dd>
            </div>
            <div>
              <dt>预约装车</dt>
              <dd>库区作业时间 08:30–17:30，车辆到库前确认装车窗口</dd>
            </div>
            <div>
              <dt>随车材料</dt>
              <dd>携带提货单、车辆及司机信息，按库区要求办理入场</dd>
            </div>
            <div>
              <dt>货物防护</dt>
              <dd>检查车厢清洁和防雨篷布，装卸及运输途中注意防潮</dd>
            </div>
          </dl>
        </div>
      )}
      {!feasible && (
        <Info warning>
          {totals.unit > purchase.need.budget
            ? "当前到厂单价超出预算，请回到选粮阶段调整方案。"
            : "当前方案超过最晚交期，请切换更快的运输方式。"}
        </Info>
      )}
      {!pickup && (
        <CostTrialPanel
          purchase={purchase}
          readonly={readonly}
          onAdopt={(sourceId, transportId, costEstimateAssumptions) =>
            update({
              sourceId,
              transportId,
              payee:
                purchaseSources(purchase).find((source) => source.id === sourceId)
                  ?.name ?? purchase.payee,
              costEstimateAssumptions,
              reviewed: false,
            })
          }
        />
      )}
      {!readonly && (
        <div className="pw-action-bar">
          <div className="pw-transport-summary">
            <span>{pickup ? "本次平台应付粮款" : "当前待下单金额"}</span>
            <strong>¥ {formatMoney(totals.total)}</strong>
            <small>
              {pickup
                ? `粮款 ${formatMoney(totals.unit)} 元/吨 · 自提运输费用未计入`
                : `粮价 + 运费 ${formatMoney(totals.unit)} 元/吨 · 运输费 ¥ ${formatMoney(totals.logistics)}`}
            </small>
            <div>
              <b data-ok={withinBudget}>{withinBudget ? (pickup ? "粮款未超预算" : "预算内") : "超预算"}</b>
              {pickup && <b data-ok="pending">自提费用另行核算</b>}
              <b data-ok={onTime}>{onTime ? `满足 ${purchase.need.days} 天交期` : "超过交期"}</b>
            </div>
          </div>
          <div className="pw-inline-actions">
            <Button
              secondary
              onClick={() => update({ stage: 3, reviewed: false })}
            >
              重选粮源
            </Button>
            <Button disabled={!feasible} onClick={onNext}>
              确认安排，核验下单 →
            </Button>
          </div>
        </div>
      )}
        </>
      </AiMatchingGate>
    </>
  );
}

function Order({
  purchase,
  inspecting,
  update,
  onRevise,
  onReceived,
}: {
  purchase: Purchase;
  inspecting: boolean;
  update(patch: Partial<Purchase>): void;
  onRevise(): void;
  onReceived(): void;
}) {
  const totals = purchaseTotals(purchase);
  const checked = Boolean(purchase.reviewed || purchase.reviewAttempted);
  const problems = orderProblems(purchase);
  const canOrder = purchase.reviewed && problems.length === 0;
  const fulfillmentStatus = purchase.received
    ? "已签收入库"
    : ["待装车发运", "运输中", "待到货验收"][purchase.deliveryStep];
  const nextFulfillmentAction =
    purchase.deliveryStep === 0
      ? "确认已装车发运"
      : purchase.deliveryStep === 1
        ? "确认已到货"
        : "验收通过，确认收货";
  return (
    <>
      <section className="pw-order-card">
        <div className="pw-order-card-head">
          <div>
            <span>{purchase.ordered ? "采购订单" : "订单确认"}</span>
            <strong>{purchase.id}</strong>
          </div>
          <span className="pw-tag">
            {purchase.received
              ? "已签收"
              : purchase.ordered
                ? "已下单 · 履约中"
                : "待确认"}
          </span>
        </div>
        <dl className="pw-order-facts">
          <div>
            <dt>合同卖方</dt>
            <dd>{totals.source.name}</dd>
          </div>
          <div>
            <dt>采购标的</dt>
            <dd>
              二等{purchase.need.variety} · {purchase.need.quantity} 吨
            </dd>
          </div>
          <div>
            <dt>交付方式</dt>
            <dd>
              {totals.transport.label} · {totals.days} 天到货
            </dd>
          </div>
          <div>
            <dt>收货区域</dt>
            <dd>{purchase.need.destination}</dd>
          </div>
          <div>
            <dt>质量约定</dt>
            <dd>二等及以上 · 水分 ≤ 14% · 杂质 ≤ 1%</dd>
          </div>
          <div className="is-amount">
            <dt>{purchase.transportId === "pickup" ? "平台应付金额" : "订单金额"}</dt>
            <dd>¥ {formatMoney(totals.total)}</dd>
            {purchase.transportId === "pickup" && <small>自提运输费用另计</small>}
          </div>
        </dl>
      </section>
      {!purchase.ordered && (
        <>
          <section className="pw-order-verification">
            <div className="pw-order-verification-head">
              <h3>交易核验</h3>
              <span data-state={!checked ? "pending" : problems.length ? "blocked" : "passed"}>
                {!checked ? "待核验" : problems.length ? "已拦截" : "已通过"}
              </span>
            </div>
            <label htmlFor="purchase-payee">
              <span>对公收款主体</span>
              <small>应与合同卖方一致</small>
            </label>
            <input
              id="purchase-payee"
              className="pw-wide-input"
              value={purchase.payee}
              disabled={inspecting}
              onChange={(e) => {
                update({
                  payee: e.target.value,
                  reviewed: false,
                  reviewAttempted: false,
                });
              }}
            />
            {checked && (
              <div className="pw-order-verification-result" role="status">
                {problems.length ? (
                  <ul>
                    {problems.map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="pw-order-checks">
                    {[
                      "主体一致",
                      "企业资质",
                      "资金可用",
                      "预算符合",
                      "交期与库存",
                    ].map((item) => (
                      <span key={item}>✓ {item}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
          {!inspecting && (
            <div className="pw-action-bar">
              <Button secondary onClick={onRevise}>
                调整采购方案
              </Button>
              <div className="pw-inline-actions">
                <Button
                  secondary={canOrder}
                  onClick={() => {
                    update({
                      reviewed: problems.length === 0,
                      reviewAttempted: true,
                    });
                  }}
                >
                  {checked ? "重新核验交易" : "核验交易"}
                </Button>
                {canOrder && (
                  <Button
                    onClick={() => {
                      if (
                        purchase.reviewed &&
                        !purchase.ordered &&
                        orderProblems(purchase).length === 0
                      )
                        update({ ordered: true });
                    }}
                  >
                    确认下单 · ¥{" "}
                    {formatMoney(totals.total)}
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
      {purchase.ordered && (
        <section className="pw-fulfillment">
          <div className="pw-fulfillment-head">
            <div>
              <span>履约进度</span>
              <h3>{fulfillmentStatus}</h3>
            </div>
            <small>{purchase.id}</small>
          </div>
          <div className="pw-delivery-rail">
            {["订单已确认", "已装车发运", "已到货待验收", "已签收入库"].map(
              (label, i) => (
                <div
                  key={label}
                  data-done={purchase.received || i <= purchase.deliveryStep}
                >
                  <span>
                    {purchase.received || i <= purchase.deliveryStep
                      ? "✓"
                      : i + 1}
                  </span>
                  <p>{label}</p>
                </div>
              ),
            )}
          </div>
          <div className="pw-fulfillment-meta">
            <div>
              <span>交付方式</span>
              <strong>{totals.transport.label}</strong>
            </div>
            <div>
              <span>计划周期</span>
              <strong>{totals.days} 天</strong>
            </div>
            <div>
              <span>收货区域</span>
              <strong>{purchase.need.destination}</strong>
            </div>
          </div>
          {purchase.transportId !== "pickup" && purchase.deliveryStep > 0 && (
            <TransitTracking purchase={purchase} />
          )}
          {!inspecting && !purchase.received && (
            <div className="pw-action-bar pw-fulfillment-action">
              <Button
                onClick={() =>
                  purchase.deliveryStep < 2
                    ? update({ deliveryStep: purchase.deliveryStep + 1 })
                    : onReceived()
                }
              >
                {nextFulfillmentAction} →
              </Button>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function TransitTracking({ purchase }: { purchase: Purchase }) {
  const totals = purchaseTotals(purchase);
  const arrived = purchase.deliveryStep >= 2;
  const combined = purchase.transportId === "combined";
  const mapElement = useRef<HTMLDivElement>(null);
  const progress = arrived ? 1 : combined ? 0.54 : 0.64;
  const loadCount = Math.ceil(purchase.need.quantity / (combined ? 60 : 30));
  const [remainingKm, setRemainingKm] = useState(arrived ? 0 : combined ? 128 : 55);
  const trackingNumber = `YT-${purchase.id.replace(/\D/g, "").slice(-8) || "0916028"}`;
  const location = arrived
    ? purchase.need.destination
    : combined
      ? "济南铁路货运中心 · 在途"
      : totals.source.depot.includes("日照")
        ? "G1511 日兰高速 · 沂水段"
        : totals.source.depot.includes("潍坊")
          ? "G20 青银高速 · 淄博段"
          : "G20 青银高速 · 潍坊段";
  const carrier = combined ? "济铁物流 · 鲁中专线" : "鲁粮运输 · 散粮专线";
  const transportCode = combined ? "班列 78426" : "鲁B·7K29 / 鲁B·Q89挂";
  const speed = arrived ? 0 : combined ? 74 : 62;
  const events = combined
    ? [
        ["08:40", "配载完成", `${purchase.need.quantity} 吨 · 配载清单已核`],
        ["09:10", "运单关联", `${trackingNumber} · 班列 78426`],
        ["10:05", "驶离货运站", "电子围栏自动记录"],
        [arrived ? "次日 10:18" : "14:26", arrived ? "到达收货地" : "班列定位正常", arrived ? "已进入收货围栏" : "北斗定位 · 无异常停留"],
      ]
    : [
        ["09:12", "装车完成", "当前车辆 · 装车照片 6 张"],
        ["09:26", "地磅出库", "净重 30.18 吨 · 磅单已核"],
        ["10:03", "驶离粮库", "电子围栏自动记录"],
        [arrived ? "次日 10:18" : "14:26", arrived ? "到达收货地" : "车辆定位正常", arrived ? "已进入收货围栏" : "车载 GPS · 无异常停留"],
      ];

  useEffect(() => {
    const element = mapElement.current;
    if (!element) return;

    const coordinates: Record<string, [number, number]> = {
      青岛: [36.103, 120.294],
      日照: [35.416, 119.526],
      潍坊: [36.706, 119.161],
      济南: [36.651, 117.12],
      淄博: [36.813, 118.055],
      临沂: [35.105, 118.356],
      德州: [37.436, 116.359],
      东营: [37.434, 118.674],
      泰安: [36.2, 117.087],
      烟台: [37.464, 121.448],
    };
    const resolvePoint = (label: string, fallback: [number, number]) => {
      const key = Object.keys(coordinates).find((name) => label.includes(name));
      return key ? coordinates[key] : fallback;
    };
    const origin = resolvePoint(totals.source.depot, [36.103, 120.294]);
    let destination = resolvePoint(purchase.need.destination, [36.651, 117.12]);
    if (
      Math.abs(origin[0] - destination[0]) < 0.04 &&
      Math.abs(origin[1] - destination[1]) < 0.04
    ) {
      destination = [destination[0] - 0.09, destination[1] + 0.12];
    }
    const latitudeDelta = destination[0] - origin[0];
    const longitudeDelta = destination[1] - origin[1];
    const distance = Math.max(Math.hypot(latitudeDelta, longitudeDelta), 0.01);
    const bend = Math.min(Math.max(distance * (combined ? 0.13 : 0.09), 0.035), 0.16);
    const control: [number, number] = [
      (origin[0] + destination[0]) / 2 - (longitudeDelta / distance) * bend,
      (origin[1] + destination[1]) / 2 + (latitudeDelta / distance) * bend,
    ];
    const route: [number, number][] = Array.from({ length: 33 }, (_, index) => {
      const t = index / 32;
      const remaining = 1 - t;
      return [
        remaining * remaining * origin[0] + 2 * remaining * t * control[0] + t * t * destination[0],
        remaining * remaining * origin[1] + 2 * remaining * t * control[1] + t * t * destination[1],
      ];
    });
    const map = L.map(element, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    L.circle(origin, {
      radius: 4200,
      color: "#67cfc0",
      weight: 1,
      opacity: 0.65,
      fillColor: "#46b9aa",
      fillOpacity: 0.06,
      dashArray: "4 6",
      interactive: false,
    }).addTo(map);
    L.circle(destination, {
      radius: 4200,
      color: "#e1ad68",
      weight: 1,
      opacity: 0.65,
      fillColor: "#d49b55",
      fillOpacity: 0.06,
      dashArray: "4 6",
      interactive: false,
    }).addTo(map);

    const routeStyle = { lineCap: "round", lineJoin: "round", interactive: false } as const;
    const routeLayers = L.layerGroup().addTo(map);
    const drawRoute = (points: [number, number][], distanceKm?: number) => {
      routeLayers.clearLayers();
      const currentIndex = Math.round(progress * (points.length - 1));
      const current = points[currentIndex];
      const completedRoute = points.slice(0, currentIndex + 1);
      if (distanceKm !== undefined)
        setRemainingKm(arrived ? 0 : Math.max(1, Math.round(distanceKm * (1 - progress))));

      L.polyline(points, {
        ...routeStyle,
        color: "#06131c",
        weight: 8,
        opacity: 0.8,
      }).addTo(routeLayers);
      L.polyline(points, {
        ...routeStyle,
        color: "#9aabb2",
        weight: 2,
        opacity: 0.52,
      }).addTo(routeLayers);
      L.polyline(completedRoute, {
        ...routeStyle,
        className: "pw-map-route-glow",
        color: "#36c9b6",
        weight: 8,
        opacity: 0.16,
      }).addTo(routeLayers);
      L.polyline(completedRoute, {
        ...routeStyle,
        className: "pw-map-route-live",
        color: "#54ddca",
        weight: 3.5,
        opacity: 0.96,
      }).addTo(routeLayers);

      const sampleEvery = Math.max(1, Math.floor(completedRoute.length / 9));
      completedRoute.forEach((point, index) => {
        if (index === 0 || index === completedRoute.length - 1 || index % sampleEvery !== 0) return;
        L.circleMarker(point, {
          radius: 2,
          color: "#8ce9dc",
          weight: 1,
          fillColor: "#54ddca",
          fillOpacity: 0.95,
          interactive: false,
        }).addTo(routeLayers);
      });

      const previous = points[Math.max(0, currentIndex - 1)];
      const bearing = Math.atan2(current[1] - previous[1], current[0] - previous[0]) * (180 / Math.PI);
      const vehicleIcon = L.divIcon({
        className: "pw-map-icon-shell",
        html: `<span class="pw-map-vehicle${arrived ? " is-arrived" : ""}" style="transform:rotate(${bearing}deg)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 20 21 12 17 4 21Z" /></svg></span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker(arrived ? destination : current, { icon: vehicleIcon })
        .addTo(routeLayers)
        .bindPopup(`<strong>${arrived ? "已到达收货地" : location}</strong><br/>${transportCode}<br/>车载北斗/GPS · 2 分钟前`);
    };

    drawRoute(route);

    const pointIcon = (kind: "origin" | "destination") =>
      L.divIcon({
        className: "pw-map-icon-shell",
        html: `<span class="pw-map-point is-${kind}"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
    L.marker(origin, { icon: pointIcon("origin") })
      .addTo(map)
      .bindTooltip(totals.source.depot, {
        permanent: true,
        direction: "top",
        offset: [0, -8],
        className: "pw-map-tooltip",
      });
    L.marker(destination, { icon: pointIcon("destination") })
      .addTo(map)
      .bindTooltip(purchase.need.destination, {
        permanent: true,
        direction: "top",
        offset: [0, -8],
        className: "pw-map-tooltip is-destination",
      });
    L.control.zoom({ position: "bottomleft" }).addTo(map);
    map.fitBounds(L.latLngBounds([origin, destination]), {
      paddingTopLeft: [48, 62],
      paddingBottomRight: [48, 48],
      maxZoom: 9,
    });

    let disposed = false;
    if (!combined) {
      const routeUrl = `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson`;
      void fetch(routeUrl)
        .then((response) => {
          if (!response.ok) throw new Error("route unavailable");
          return response.json() as Promise<{
            code: string;
            routes?: Array<{
              distance: number;
              geometry: { coordinates: Array<[number, number]> };
            }>;
          }>;
        })
        .then((data) => {
          const result = data.routes?.[0];
          if (disposed || data.code !== "Ok" || !result) return;
          const roadRoute = result.geometry.coordinates.map(
            ([longitude, latitude]) => [latitude, longitude] as [number, number],
          );
          drawRoute(roadRoute, result.distance / 1000);
          map.fitBounds(L.latLngBounds(roadRoute), {
            paddingTopLeft: [48, 62],
            paddingBottomRight: [48, 48],
            maxZoom: 9,
          });
        })
        .catch(() => undefined);
    }

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(element);
    return () => {
      disposed = true;
      observer.disconnect();
      map.remove();
    };
  }, [arrived, combined, location, progress, purchase.need.destination, totals.source.depot, transportCode]);

  return (
    <section className="pw-transit-tracking" aria-label="运输轨迹">
      <div className="pw-transit-head">
        <div>
          <span>在途跟踪 · 当前查看 1 / {loadCount}</span>
          <h4>
            {totals.source.depot} <i>→</i> {purchase.need.destination}
          </h4>
        </div>
        <div className="pw-transit-state">
          <small>{arrived ? "实际到达 次日 10:18" : "预计到达 明日 10:30"}</small>
          <b data-arrived={arrived}>{arrived ? "已到达" : "运输正常"}</b>
        </div>
      </div>
      <div className="pw-transit-layout">
        <div className="pw-transit-map">
          <div
            ref={mapElement}
            className="pw-transit-map-canvas"
            aria-label={`${totals.source.depot}至${purchase.need.destination}实时运输地图`}
          />
          <div className="pw-transit-map-legend" aria-label="路线图例">
            <span data-kind="planned">计划路线</span>
            <span data-kind="actual">实际轨迹</span>
          </div>
        </div>
        <aside className="pw-transit-panel">
          <div className="pw-transit-current">
            <span>当前定位</span>
            <strong>{location}</strong>
            <small>车载北斗 / GPS · 2 分钟前</small>
          </div>
          <div className="pw-transit-metrics">
            <div>
              <span>速度</span>
              <strong>{speed}<small> km/h</small></strong>
            </div>
            <div>
              <span>剩余</span>
              <strong>{remainingKm}<small> km</small></strong>
            </div>
            <div>
              <span>进度</span>
              <strong>{Math.round(progress * 100)}<small> %</small></strong>
            </div>
          </div>
          <dl className="pw-transit-data">
            <div>
              <dt>{combined ? "班列" : "车辆"}</dt>
              <dd>{transportCode}</dd>
            </div>
            <div>
              <dt>承运方</dt>
              <dd>{carrier}</dd>
            </div>
            <div>
              <dt>运输单号</dt>
              <dd>{trackingNumber}</dd>
            </div>
          </dl>
          <div className="pw-transit-flags">
            <span>✓ 无偏航</span>
            <span>✓ 无异常停留</span>
          </div>
          {!arrived && (
            <div className="pw-transit-judgment">
              <span>运输研判</span>
              <strong>预计按时到达</strong>
              <small>轨迹、车速与停留时长正常</small>
            </div>
          )}
        </aside>
      </div>
      <section className="pw-transit-events">
        <div>
          <h5>运输事件</h5>
          <span>节点数据自动留痕</span>
        </div>
        <ol>
          {events.map(([time, title, evidence], index) => (
            <li key={`${time}-${title}`} data-latest={index === events.length - 1}>
              <time>{time}</time>
              <strong>{title}</strong>
              <small>{evidence}</small>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}

function Review({
  purchase,
  phase,
  onNext,
  onClose,
}: {
  purchase: Purchase;
  phase: "cost" | "knowledge";
  onNext?: () => void;
  onClose?: () => void;
}) {
  const settlement = purchaseSettlement(purchase);
  const actualUnit = settlement.landedUnit ?? settlement.baseUnit;
  const variancePerTon = purchase.need.budget - actualUnit;
  const varianceTotal = variancePerTon * settlement.receivedQuantity;
  const recordCode = purchase.id.replace(/[^A-Z0-9]/gi, "").slice(-8).toUpperCase();
  const qualityResult = `二等 · 水分 ${settlement.source.moisture} · 杂质 ${settlement.source.evidence?.impurities ?? "≤1%"}`;
  const deliveredOnTime = settlement.days <= purchase.need.days;
  const lossWithinAllowance = settlement.lossRate <= settlement.lossAllowanceRate;
  const hasRiskFinding = !deliveredOnTime || !lossWithinAllowance;
  const costRows = [
    ["粮款", settlement.source.price, settlement.goods],
    ["运输结算", settlement.freight, settlement.logistics],
    ["装卸与中转", settlement.handlingPerTon, settlement.handling],
    ["运输保险", settlement.insurancePerTon, settlement.insurance],
    ...(settlement.other > 0
      ? [["其他到厂费用", settlement.otherPerTon, settlement.other] as [string, number, number]]
      : []),
  ] as [string, number, number][];
  const evidence = [
    ["出库磅单", `CK-${recordCode}`],
    ["入库磅单", `RK-${recordCode}`],
    ["运输结算单", `YF-${recordCode}`],
    ["入库质检单", `ZJ-${recordCode}`],
  ];
  const knowledgeChanges = [
    {
      type: "企业事实",
      tone: "fact",
      status: purchase.need.destination.includes("潍坊") ? "已引用" : "无新增",
      title: purchase.need.destination.includes("潍坊")
        ? "潍坊工厂为主要到货点"
        : "本次未形成新的企业长期事实",
      detail: purchase.need.destination.includes("潍坊")
        ? "方案继续按潍坊到厂成本统一比较"
        : "单笔订单到货地不直接升级为企业事实",
    },
    {
      type: "经营偏好",
      tone: "preference",
      status: "已验证",
      title:
        (purchase.need.stockDays ?? 0) <= 7
          ? "安全库存低于七天时优先保供"
          : "正常库存优先比较综合到厂成本",
      detail: deliveredOnTime
        ? `本次选择${settlement.transport.label}并按期到货`
        : `本次实际交付超出约定 ${settlement.days - purchase.need.days} 天`,
    },
    {
      type: "决策经验",
      tone: "decision",
      status: settlement.isComplete ? "新增 1 条" : "待补齐",
      title: `${settlement.source.depot} + ${settlement.transport.label}`,
      detail: settlement.isComplete
        ? `合格入库吨成本 ${formatMoney(actualUnit)} 元 · 损耗 ${(settlement.lossRate * 100).toFixed(2)}%`
        : "补录自提费用后生成完整成本经验",
    },
    {
      type: "风险规则",
      tone: "risk",
      status: hasRiskFinding ? "新增 1 条" : "无新增",
      title: !deliveredOnTime
        ? "相似交期下需提高运输时效约束"
        : !lossWithinAllowance
          ? "相似线路需加强损耗与承运责任约束"
          : "本次未发生延误、毁约或超限损耗",
      detail: hasRiskFinding
        ? "后续匹配时自动提醒，并影响相关合作方推荐"
        : "不为正常履约强行生成风险规则",
    },
  ];
  const formatWeight = (value: number) =>
    value.toLocaleString("zh-CN", {
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });
  return (
    <>
      {phase === "cost" ? (
        <>
      <section className="pw-settlement-sheet">
        <header className="pw-settlement-head">
          <div>
            <span>算小二 · 到厂核算</span>
            <h3>到厂成本核算</h3>
            <small>{purchase.id} · {settlement.source.depot} → {purchase.need.destination}</small>
          </div>
          <b data-complete={settlement.isComplete}>
            {settlement.isComplete ? "成本口径完整" : "待补自提费用"}
          </b>
        </header>

        <div className="pw-settlement-overview">
          <article className="pw-settlement-primary">
            <span>{settlement.isComplete ? "实际合格入库吨成本" : "平台已核算吨成本"}</span>
            <strong>
              <small>¥</small> {formatMoney(actualUnit)}
              <em>元/吨</em>
            </strong>
            <p>
              {settlement.isComplete
                ? `到厂总成本 ÷ ${formatWeight(settlement.receivedQuantity)} 吨合格入库量`
                : "仅含粮款，自提运输、装卸和损耗费用未计入"}
            </p>
          </article>
          <div className="pw-settlement-kpis">
            <article>
              <span>{settlement.isComplete ? "到厂总成本" : "平台结算金额"}</span>
              <strong>¥ {formatMoney(settlement.settledTotal)}</strong>
              <small>{settlement.isComplete ? "已完成交易对账" : "不含采购方自提费用"}</small>
            </article>
            <article>
              <span>合格入库</span>
              <strong>{formatWeight(settlement.receivedQuantity)} <i>吨</i></strong>
              <small>{qualityResult}</small>
            </article>
            <article>
              <span>{settlement.isComplete ? "预算差异" : "成本状态"}</span>
              <strong data-tone={!settlement.isComplete ? "muted" : variancePerTon >= 0 ? "positive" : "negative"}>
                {settlement.isComplete
                  ? `${variancePerTon >= 0 ? "−" : "+"} ¥ ${formatMoney(Math.abs(variancePerTon))}`
                  : "待补齐"}
                {settlement.isComplete && <i>元/吨</i>}
              </strong>
              <small>
                {settlement.isComplete
                  ? `相对预算 ${formatMoney(purchase.need.budget)} 元/吨 · ${variancePerTon >= 0 ? "结余" : "超支"} ¥ ${formatMoney(Math.abs(varianceTotal))}`
                  : "补录自提结算后生成完整到厂成本"}
              </small>
            </article>
          </div>
        </div>
      </section>

      <section className="pw-settlement-ledger">
        <div className="pw-review-section-head">
          <div>
            <span>成本构成</span>
            <h3>结算明细</h3>
          </div>
          <small>统一折算为元/吨</small>
        </div>
        <div className="pw-settlement-ledger-body">
          <div className="pw-settlement-cost-table" role="table" aria-label="到厂成本结算明细">
            <div className="pw-settlement-cost-head" role="row">
              <span>项目</span><span>计价单价</span><span>结算金额</span>
            </div>
            {costRows.map(([label, unit, amount]) => (
              <div role="row" key={label}>
                <strong>{label}</strong>
                <span>{formatMoney(unit)} 元/吨</span>
                <b>¥ {formatMoney(amount)}</b>
              </div>
            ))}
            <div className="pw-settlement-cost-total" role="row">
              <strong>结算合计</strong>
              <span>{formatMoney(settlement.baseUnit)} 元/出库吨</span>
              <b>¥ {formatMoney(settlement.settledTotal)}</b>
            </div>
          </div>
          <aside className="pw-settlement-adjustments">
            <h4>结算调整</h4>
            <dl>
              <div><dt>质量扣价</dt><dd>¥ 0.00</dd><small>入库质量达标</small></div>
              <div><dt>承运赔付</dt><dd>¥ 0.00</dd><small>损耗未超合同允差</small></div>
              <div><dt>异常费用</dt><dd>¥ 0.00</dd><small>无压车、滞箱记录</small></div>
              <div data-accent="true">
                <dt>损耗摊增</dt>
                <dd>{settlement.lossImpactPerTon === null ? "待核算" : `+ ¥ ${formatMoney(settlement.lossImpactPerTon)} / 吨`}</dd>
                <small>不新增付款，计入实际入库吨成本</small>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <section className="pw-settlement-loss">
        <div className="pw-review-section-head">
          <div>
            <span>数量与损耗</span>
            <h3>损耗核算及归责</h3>
          </div>
          <small>{settlement.settlementBasis}</small>
        </div>
        <div className="pw-settlement-loss-grid">
          <div><span>出库净重</span><strong>{formatWeight(settlement.shippedQuantity)} 吨</strong><small>出库磅单</small></div>
          <div><span>入库净重</span><strong>{formatWeight(settlement.receivedQuantity)} 吨</strong><small>入库磅单</small></div>
          <div><span>运输损耗</span><strong>{formatWeight(settlement.lossQuantity)} 吨</strong><small>{(settlement.lossRate * 100).toFixed(2)}%</small></div>
          <div><span>合同允差</span><strong>≤ {(settlement.lossAllowanceRate * 100).toFixed(2)}%</strong><small>{settlement.lossResponsibility}</small></div>
        </div>
        <div className="pw-settlement-loss-result">
          <b>{(settlement.lossRate * 100).toFixed(2)}%</b>
          <span>≤</span>
          <b>{(settlement.lossAllowanceRate * 100).toFixed(2)}%</b>
          <strong>允差内</strong>
          <small>损耗已计入实际合格入库吨成本</small>
        </div>
      </section>

        </>
      ) : (
        <>
      <section className="pw-settlement-sheet pw-review-retro-summary">
        <header className="pw-settlement-head">
          <div>
            <span>粮掌柜 × 安小二</span>
            <h3>履约复盘</h3>
            <small>{purchase.id} · {settlement.source.depot} → {purchase.need.destination}</small>
          </div>
          <b data-complete={!hasRiskFinding}>
            {hasRiskFinding ? "异常已归档" : "履约正常"}
          </b>
        </header>
        <div className="pw-review-retro-strip">
          <div><span>供应结果</span><strong>质量验收达标</strong></div>
          <div><span>运输结果</span><strong>{settlement.days} 天到货 · 损耗 {(settlement.lossRate * 100).toFixed(2)}%</strong></div>
          <div><span>知识变更</span><strong>{knowledgeChanges.filter((item) => item.status.includes("新增")).length} 条新增</strong></div>
        </div>
      </section>

      <section className="pw-review-performance">
        <div className="pw-review-section-head">
          <div>
            <span>履约评价</span>
            <h3>供应、运输与交易结果</h3>
          </div>
          <small>按客观履约记录评价</small>
        </div>
        <div className="pw-review-performance-grid">
          <article>
            <div><span>供应方履约</span><b data-state="success">正常</b></div>
            <strong>{settlement.source.name}</strong>
            <small>供货完成 · {qualityResult}</small>
          </article>
          <article>
            <div><span>运输履约</span><b data-state={deliveredOnTime && lossWithinAllowance ? "success" : "warning"}>{deliveredOnTime && lossWithinAllowance ? "正常" : "需关注"}</b></div>
            <strong>{settlement.transport.label} · {settlement.days} 天</strong>
            <small>运输损耗 {(settlement.lossRate * 100).toFixed(2)}% · 合同允差 {(settlement.lossAllowanceRate * 100).toFixed(2)}%</small>
          </article>
          <article>
            <div><span>交易结果</span><b data-state={hasRiskFinding ? "warning" : "success"}>{hasRiskFinding ? "异常已记录" : "无争议"}</b></div>
            <strong>质量扣价 ¥ 0 · 承运赔付 ¥ 0</strong>
            <small>{hasRiskFinding ? "异常结论已进入知识变更" : "无毁约、无异常费用记录"}</small>
          </article>
        </div>
      </section>

      <section className="pw-review-knowledge">
        <div className="pw-review-section-head">
          <div>
            <span>企业知识库</span>
            <h3>本次知识变更</h3>
          </div>
          <small>{knowledgeChanges.filter((item) => item.status.includes("新增")).length} 条新增</small>
        </div>
        <div className="pw-review-knowledge-list">
          {knowledgeChanges.map((item) => (
            <article key={item.type} data-tone={item.tone}>
              <span>{item.type}</span>
              <div>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </div>
              <b>{item.status}</b>
            </article>
          ))}
        </div>
      </section>

        </>
      )}

      {phase === "cost" && (
        <section className="pw-settlement-evidence">
          <div className="pw-review-section-head">
            <div>
              <span>核算依据</span>
              <h3>四单已关联</h3>
            </div>
            <small>数据口径可追溯</small>
          </div>
          <div className="pw-settlement-evidence-row">
            {evidence.map(([type, id]) => (
              <div key={type}>
                <i>✓</i>
                <span>{type}</span>
                <strong>{id}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {phase === "cost" ? (
        onNext && (
          <div className="pw-action-bar pw-review-next">
            <Button onClick={onNext}>确认核算结果 →</Button>
          </div>
        )
      ) : (
        <div className="pw-review-complete">
          <Button onClick={() => onClose?.()}>本次采购已完成</Button>
        </div>
      )}

    </>
  );
}

function adviceFor(stage: number, purchase: Purchase | null): string {
  if (stage === 0)
    return "先确认品种、数量、到货地区、交期、预算和库存天数，再由瞻小二研判相关行情。";
  if (stage === 1)
    return purchase?.marketDecision?.action === "watch"
      ? "研判已保存，当前选择暂时观望。决定采购时，可在本笔任务继续确认计划；交易核验尚未启动。"
      : "采购需求已确认，结合相关行情、库存与用粮时间决定采购时机。你可以按建议采购、调整采购计划，或先保存研判继续观望。";
  if (!purchase)
    return "先确认要买什么、什么时候要、最多花多少。粮小二找粮，安小二查资质，钱小二核资金；需要你选择时，我再提醒。";
  const totals = purchaseTotals(purchase);
  return [
    purchase.marketDecision?.summary ?? "历史任务未单独记录行情确认。",
    `已按${purchase.need.quantity}吨二等${purchase.need.variety}、${purchase.need.days}天内到${purchase.need.destination}组织本次采购。`,
    purchase.qualified
      ? "企业资质与交易条件均已通过，下一步可以选粮。"
      : "把资质审核和资金核验一起办。经办人授权书缺失时，补充企业档案材料即可重新核验。",
    "",
    purchase.transportId === "pickup"
      ? `当前选择自行提货，平台仅核算 ${totals.unit} 元/吨粮款，自提运输费用需另行确认。`
      : `当前${totals.transport.label}预计${totals.days}天到货，到厂${totals.unit}元/吨。${purchase.originMission ? "运输与成本口径沿用本任务已确认的专业结果。" : purchase.need.days >= 6 && purchase.sourceId !== "weifang" ? "交期允许时可对比铁公联运，兼顾费用与中转时间。" : "优先关注短交期与到货保障。"}`,
    "",
    "",
    "",
  ][stage];
}
