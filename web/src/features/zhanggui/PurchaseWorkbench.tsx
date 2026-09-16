import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { parseNeed } from "../liang/parseNeed";
import {
  PURCHASE_STAGES,
  PURCHASE_STORAGE_KEY,
  purchaseTransports,
  purchaseSources,
  formatMoney,
  newPurchase,
  orderProblems,
  purchaseMemory,
  purchaseTotals,
  readPurchases,
  type Purchase,
  type PurchaseNeed,
} from "./purchaseModel";
import PurchaseCockpit from "./PurchaseCockpit";
import PurchaseDrawer from "./PurchaseDrawer";
import { purchaseInteraction } from "./purchaseInteraction";
import PurchaseMarket, { DecisionRecord } from "./PurchaseMarket";
import { assessPurchaseMarket } from "./marketAssessment";
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
  "15天内采购200吨二等玉米到潍坊，到厂预算不超过2680元/吨，库存还能用7天";
const STAGE_COPY = [
  [
    "说清需求，剩下的交给粮掌柜",
    "先确认品种、数量、到货地区和用粮安排，再研判相关行情。",
  ],
  [
    "结合已确认需求，决定这笔粮怎么买",
    "瞻小二研判市场，粮掌柜结合用粮安排给建议；采购时机由你确认。",
  ],
  [
    "先把交易条件核验清楚",
    "安小二与钱小二同步核验，缺什么补什么，进度不用重来。",
  ],
  [
    "选一笔合适的粮，再确认价格",
    "结合质量、库存与发运条件推荐；运输费用将在下一步一并核算。",
  ],
  ["这批粮，怎么到你手里？", "自提或配送都能办，费用和时效一起比较。"],
  [
    "核验无误，再放心下单",
    "合同、收款主体、预算和交期逐项守护，确认后持续跟进履约。",
  ],
  ["这笔采购办完了，经验留下来", "算清本次成本，让下一次采购有据可依。"],
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
  }, [stage]);

  useEffect(() => {
    setDrawerAgent(purchaseInteraction(purchase, stage).owner);
  }, [stage, purchase?.id, purchase?.ordered]);

  function openDrawer(agentId: string) {
    setDrawerAgent(agentId);
    setDrawerOpen(true);
  }

  function update(patch: Partial<Purchase>) {
    if (!purchase) return;
    if (patch.sourceId !== undefined || patch.transportId !== undefined) {
      patch = { ...patch, reviewed: false, reviewAttempted: false };
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
    if (purchase && purchase.stage !== 0) return;
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
  }

  function decideMarket(action: "buy" | "adjust" | "watch") {
    if (!purchase || purchase.stage !== 1) return;
    const currentNeed = purchase.need;
    const assessment = assessPurchaseMarket(currentNeed);
    update({
      need: action === "buy" ? assessment.suggestedNeed : currentNeed,
      stage: action === "buy" ? 2 : action === "adjust" ? 0 : 1,
      marketDecision: {
        action,
        summary: assessment.summary,
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
                  {item.received
                    ? "已完成 · 经验已沉淀"
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
                (index < purchase.stage || purchase.received) &&
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
            onSelectAgent={setDrawerAgent}
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
                <div className="pw-section-heading">
                  <p className="pw-eyebrow">
                    {String(stage + 1).padStart(2, "0")} /{" "}
                    {PURCHASE_STAGES[stage]}
                  </p>
                  <h2>{STAGE_COPY[stage][0]}</h2>
                  <p>{STAGE_COPY[stage][1]}</p>
                </div>
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
                      <NeedForm need={purchase?.need ?? need} onStart={start} />
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
                      advance({ received: true, learned: true })
                    }
                  />
                )}
                {stage === 6 && purchase && (
                  <Review
                    purchase={purchase}
                    onAgain={() => {
                      setNeed(purchase.need);
                      setSearchParams({});
                      setInspecting(null);
                    }}
                  />
                )}
              </section>
              <details className="pw-drawer-support">
                <summary>采购建议、账单与企业经验</summary>
                <aside className="pw-sidebar">
                  <section className="pw-step-guidance">
                    <p className="pw-eyebrow">粮掌柜建议</p>
                    <h3>{PURCHASE_STAGES[stage]}</h3>
                    <p>{adviceFor(stage, purchase)}</p>
                    <small>
                      {inspecting !== null
                        ? "正在回看历史阶段，当前内容只读"
                        : "小二提供依据，关键决策由你确认"}
                    </small>
                  </section>
                  {totals && purchase && purchase.stage >= 4 && (
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
                              ? "自提运费估算"
                              : "物流费用"}
                          </dt>
                          <dd>¥ {formatMoney(totals.logistics)}</dd>
                        </div>
                        {totals.additional > 0 && (
                          <div>
                            <dt>装卸、损耗等方案费用</dt>
                            <dd>¥ {formatMoney(totals.additional)}</dd>
                          </div>
                        )}
                        <div className="pw-bill-total">
                          <dt>预计总成本</dt>
                          <dd>¥ {formatMoney(totals.total)}</dd>
                        </div>
                      </dl>
                      <p className="pw-muted">
                        到厂 {formatMoney(totals.unit)} 元/吨 · 预计{" "}
                        {totals.days} 天到货
                      </p>
                    </section>
                  )}
                  <section className="pw-side-section">
                    <div className="pw-section-top">
                      <p className="pw-eyebrow">企业经验 · 主动引用</p>
                      <Link to="/knowledge">知识大脑 ↗</Link>
                    </div>
                    {references.length ? (
                      references.map((item) => (
                        <article className="pw-memory" key={item.id}>
                          <span className="pw-tag">同品种 · 同到货区域</span>
                          <p>{purchaseMemory(item)}</p>
                          <small>来源：{item.id} · 算小二复盘</small>
                        </article>
                      ))
                    ) : (
                      <p className="pw-muted">
                        本次尚无同区域、同品种的已完成采购经验。收货后，算小二会提炼本笔采购的成本与方案记录，供后续小二引用。
                      </p>
                    )}
                  </section>
                  <div className="pw-assurance">
                    <span>◎</span>
                    <p>
                      每一步有结果，关键节点有确认。
                      <br />
                      从一次买粮，积累下一次的经验。
                    </p>
                  </div>
                </aside>
              </details>
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
  onStart,
}: {
  need: PurchaseNeed;
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
  const valid =
    structured &&
    !dirty &&
    varietyConfirmed &&
    need.destination === "山东省潍坊市" &&
    need.quantity >= 1 &&
    need.quantity <= 1200 &&
    Number.isFinite(need.quantity) &&
    need.budget > 0 &&
    Number.isFinite(need.budget) &&
    need.days >= 1 &&
    Number.isInteger(need.days) &&
    Number.isInteger(need.stockDays) &&
    (need.stockDays ?? 0) >= 1 &&
    (need.stockDays ?? 0) <= 365;
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
    setNotice(
      "粮掌柜已整理采购条件，请核对下方表单；未提及的条件留空，请补充后确认。",
    );
  }
  return (
    <>
      <label className="pw-input-label" htmlFor="purchase-request">
        你想买什么粮？
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
          <span>品种、数量、交期、预算，一句话说清</span>
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
            <Button onClick={parse}>整理采购需求</Button>
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
              需求描述已修改，请先重新整理，避免按旧条件采购。
            </Info>
          )}
          <div className="pw-section-top pw-form-heading">
            <h3>确认采购条件</h3>
            <span className="pw-tag">商城 · 区域现货采购</span>
          </div>
          <div className="pw-fields">
            <label>
              粮食品种
              <select
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
            </label>
            <label>
              采购数量（吨）
              <input
                type="number"
                min="1"
                max="1200"
                value={need.quantity || ""}
                onChange={(e) =>
                  onChange({ ...need, quantity: Number(e.target.value) })
                }
              />
            </label>
            <label>
              到货地区
              <select
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
            </label>
            <label>
              最晚到货（天内）
              <input
                type="number"
                min="1"
                step="1"
                value={need.days || ""}
                onChange={(e) =>
                  onChange({ ...need, days: Number(e.target.value) })
                }
              />
            </label>
            <label>
              到厂预算上限（元/吨）
              <input
                type="number"
                min="1"
                value={need.budget || ""}
                onChange={(e) =>
                  onChange({ ...need, budget: Number(e.target.value) })
                }
              />
            </label>
            <label>
              库存可用天数
              <input
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
            </label>
            <div className="pw-static-field">
              <span>质量要求</span>
              <strong>二等及以上</strong>
              <small>水分 ≤ 14% · 杂质 ≤ 1%</small>
            </div>
          </div>
          {!valid && (
            <Info warning>
              请补全粮种、到货地区、数量、交期、预算与库存天数（1–365
              天）。当前单笔区域采购支持 1–1,200 吨。
            </Info>
          )}
          <div className="pw-action-bar">
            <p>确认后，瞻小二将结合到货地区、粮种和库存天数研判采购时机。</p>
            <Button onClick={() => onStart(need)} disabled={!valid}>
              确认需求，研判行情 →
            </Button>
          </div>
        </>
      )}
    </>
  );
}

function Qualification({
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
  const [checked, setChecked] = useState(purchase.qualified ? 6 : 0);
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fundsAvailable =
    purchase.need.quantity * purchase.need.budget * 0.1 <= 800000;
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );
  function check() {
    if (running) return;
    setRunning(true);
    setChecked(0);
    onProgress(0);
    let count = 0;
    timer.current = setInterval(() => {
      count += 1;
      setChecked(count);
      onProgress(count);
      if (count === 6) {
        clearInterval(timer.current!);
        timer.current = null;
        setRunning(false);
        update({
          qualified: Boolean(purchase.documentName) && fundsAvailable,
          qualificationChecked: true,
        });
        onProgress(null);
      }
    }, 230);
  }
  const checks = [
    ["注册入驻", "企业档案已建立"],
    ["营业执照", "企业名称与主体信息一致"],
    ["经办人授权书", purchase.documentName || "缺少本次采购经办人授权书"],
    ["风险预警", "当前企业无禁止交易记录"],
    ["资金账户", "企业对公账户已关联"],
    [
      "保证金",
      `可用额度 800,000 元；本单预留上限 ${formatMoney(purchase.need.quantity * purchase.need.budget * 0.1)} 元`,
    ],
  ];
  return (
    <>
      <div className="pw-check-columns">
        {[0, 1].map((column) => (
          <section key={column}>
            <h3>
              {column === 0 ? "安小二 · 企业资质" : "钱小二 · 交易条件"}
              <span className="pw-tag">并行核验</span>
            </h3>
            {checks
              .slice(column * 3, column * 3 + 3)
              .map(([label, description], i) => {
                const index = column * 3 + i;
                const finished = checked > i * 2 + column;
                const missing =
                  (index === 2 && !purchase.documentName) ||
                  (index === 5 && !fundsAvailable);
                return (
                  <div className="pw-check-row" key={label}>
                    <span
                      className={`pw-check-icon ${finished ? (missing ? "is-warning" : "is-done") : ""}`}
                    >
                      {finished ? (missing ? "!" : "✓") : "·"}
                    </span>
                    <div>
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </div>
                    <span>
                      {finished
                        ? missing
                          ? "待补充"
                          : "通过"
                        : running
                          ? "核验中"
                          : "待核验"}
                    </span>
                  </div>
                );
              })}
          </section>
        ))}
      </div>
      {checked === 6 && !purchase.qualified && (
        <Info warning>
          {!fundsAvailable
            ? "保证金预留上限超过账户可用额度，请新建采购并调整数量或预算。"
            : "经办人授权书尚未核验。补充后重跑即可，已填写的采购需求会保留。"}
        </Info>
      )}
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
            <Button
              secondary
              disabled={running}
              onClick={() =>
                update({ documentName: "企业档案 / 采购经办授权书.pdf" })
              }
            >
              使用企业档案材料
            </Button>
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
              ? "6 项核验通过，可以选粮点价。"
              : "核验通过后才能进入选粮点价。"}
          </p>
          {purchase.qualified ? (
            <Button onClick={onNext}>核验通过，去选粮 →</Button>
          ) : (
            <Button onClick={check} disabled={running}>
              {running
                ? "小二正在并行核验…"
                : checked
                  ? "重新核验"
                  : "开始并行核验"}
            </Button>
          )}
        </div>
      )}
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
  return (
    <>
      <Info>
        粮小二已按二等{purchase.need.variety}、{purchase.need.quantity} 吨与
        {purchase.need.destination}
        到货区域整理候选粮源。选择后将继续比较完整到厂成本。
      </Info>
      <div className="pw-sources">
        {sources.map((source, index) => (
          <button
            type="button"
            className="pw-source"
            data-selected={source.id === purchase.sourceId}
            disabled={readonly || purchase.need.quantity > source.stock}
            key={source.id}
            onClick={() =>
              update({
                sourceId: source.id,
                transportId: purchaseTransports(purchase)[0].id,
                reviewed: false,
              })
            }
            aria-pressed={source.id === purchase.sourceId}
          >
            <div className="pw-section-top">
              <span className="pw-tag">
                {index === 0
                  ? "粮小二优先建议"
                  : index === 1
                    ? "同级备选"
                    : "本地补库"}
              </span>
              <span className="pw-radio">
                {source.id === purchase.sourceId ? "●" : "○"}
              </span>
            </div>
            <h3>{source.depot}</h3>
            <p className="pw-source-name">{source.name}</p>
            <div className="pw-price">
              {formatMoney(source.price)}
              <small>元/吨</small>
            </div>
            <p className="pw-muted">出库报价 · 不含运输</p>
            <dl>
              <div>
                <dt>等级 / 水分</dt>
                <dd>二等 / {source.moisture}</dd>
              </div>
              <div>
                <dt>可供数量</dt>
                <dd>{formatMoney(source.stock)} 吨</dd>
              </div>
            </dl>
            <p className="pw-source-reason">
              {purchase.need.quantity > source.stock
                ? "可供数量不足，暂不可选"
                : source.reason}
            </p>
          </button>
        ))}
      </div>
      {!purchase.originMission && (
        <details className="pw-details">
          <summary>查看同区域历史成交参考</summary>
          <div className="pw-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>成交时间</th>
                  <th>品种等级</th>
                  <th>数量</th>
                  <th>出库单价</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>前一交易日</td>
                  <td>二等{purchase.need.variety}</td>
                  <td>180 吨</td>
                  <td>{formatMoney(sources[0].price + 10)} 元/吨</td>
                </tr>
                <tr>
                  <td>前三个交易日</td>
                  <td>二等{purchase.need.variety}</td>
                  <td>260 吨</td>
                  <td>{formatMoney(sources[0].price + 20)} 元/吨</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="pw-muted">
            历史成交用于辅助判断，不代表当前可成交价格。
          </p>
        </details>
      )}
      {!readonly && (
        <div className="pw-action-bar">
          <p>
            已选 {selected.depot} · {purchase.need.quantity} 吨<br />
            <strong>
              粮款 ¥ {formatMoney(selected.price * purchase.need.quantity)}
            </strong>
          </p>
          <Button
            disabled={purchase.need.quantity > selected.stock}
            onClick={onNext}
          >
            确认点价，安排提货 →
          </Button>
        </div>
      )}
    </>
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
  const options = purchaseTransports(purchase).filter(
    (item) =>
      item.mode === (pickup ? "pickup" : "delivery") &&
      !(purchase.sourceId === "weifang" && item.id === "combined"),
  );
  const feasible =
    totals.days <= purchase.need.days && totals.unit <= purchase.need.budget;
  return (
    <>
      {purchase.originMission && (
        <Info>
          运输方式、运价与时效沿用本任务已确认的运小二结果。如需更换运输方式，请回到原方案重新研判。
        </Info>
      )}
      <div className="pw-segment" aria-label="提货方式">
        <button
          type="button"
          aria-pressed={!pickup}
          disabled={readonly}
          onClick={() =>
            update({
              transportId: purchaseTransports(purchase)[0].id,
              reviewed: false,
            })
          }
        >
          安排配送<span>运小二找运力，送到工厂</span>
        </button>
        <button
          type="button"
          aria-pressed={pickup}
          disabled={readonly || Boolean(purchase.originMission)}
          onClick={() => update({ transportId: "pickup", reviewed: false })}
        >
          自行提货<span>自主安排车辆，预约到库</span>
        </button>
      </div>
      <div className="pw-route">
        <span>{totals.source.depot}</span>
        <div>
          <small>{pickup ? "自提运输" : "区域粮食运输"}</small>
          <span>────────→</span>
        </div>
        <span>{purchase.need.destination}</span>
      </div>
      <div className="pw-transport-options">
        {options.map((option) => {
          const cost = purchaseTotals({ ...purchase, transportId: option.id });
          return (
            <button
              type="button"
              key={option.id}
              className="pw-transport-option"
              data-selected={purchase.transportId === option.id}
              aria-pressed={purchase.transportId === option.id}
              disabled={readonly}
              onClick={() =>
                update({ transportId: option.id, reviewed: false })
              }
            >
              <div className="pw-section-top">
                <h3>{option.label}</h3>
                <span className="pw-radio">
                  {purchase.transportId === option.id ? "●" : "○"}
                </span>
              </div>
              <p>{option.description}</p>
              <div className="pw-transport-numbers">
                <strong>
                  {cost.freight}
                  <small>元/吨</small>
                </strong>
                <strong>
                  {cost.days}
                  <small>天到货</small>
                </strong>
                <strong>
                  {formatMoney(cost.unit)}
                  <small>元/吨到厂</small>
                </strong>
              </div>
              {cost.days > purchase.need.days && (
                <span className="pw-danger">超过本次交期</span>
              )}
            </button>
          );
        })}
      </div>
      {pickup && (
        <div className="pw-pickup-guide">
          <h3>瞻小二 × 运小二 · 到库提货建议</h3>
          <dl>
            <div>
              <dt>车型与车次</dt>
              <dd>
                按合规净载 30 吨规划，约{" "}
                {Math.ceil(purchase.need.quantity / 30)}{" "}
                车次；装车前复核车辆核载
              </dd>
            </div>
            <div>
              <dt>粮库营业时间</dt>
              <dd>08:30–17:30，出发前联系库区确认</dd>
            </div>
            <div>
              <dt>错峰预约</dt>
              <dd>建议 09:00–11:00 分批到库，预留排队时间</dd>
            </div>
            <div>
              <dt>天气与防护</dt>
              <dd>出发前复核降雨预警，配备防雨篷布，装卸时注意防潮</dd>
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
      {!readonly && (
        <div className="pw-action-bar">
          <p>
            预计总成本 <strong>¥ {formatMoney(totals.total)}</strong>
            <br />
            含粮款与{pickup ? "自组织运费估算" : "物流报价"}
          </p>
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
  return (
    <>
      <div className="pw-contract">
        <div className="pw-section-top">
          <h3>{purchase.ordered ? "采购订单" : "订单与合同要点"}</h3>
          <span className="pw-tag">
            {purchase.received
              ? "已签收"
              : purchase.ordered
                ? "已下单 · 履约中"
                : "待确认"}
          </span>
        </div>
        <dl className="pw-need-summary">
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
            <dt>履约方式</dt>
            <dd>
              {totals.transport.label} · {totals.days} 天到货
            </dd>
          </div>
          <div>
            <dt>
              {purchase.transportId === "pickup"
                ? "应付粮款 / 另计自提运费"
                : "订单金额（含物流）"}
            </dt>
            <dd>
              ¥{" "}
              {formatMoney(
                purchase.transportId === "pickup" ? totals.goods : totals.total,
              )}
            </dd>
          </div>
        </dl>
        <p className="pw-muted">
          质量约定：二等及以上，水分 ≤ 14%，杂质 ≤
          1%；到货验收异常需复核后再确认收货。
        </p>
      </div>
      {!purchase.ordered && (
        <>
          <label className="pw-input-label" htmlFor="purchase-payee">
            对公收款主体
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
          <p className="pw-muted">安小二将核对收款主体与合同卖方是否一致。</p>
          {!checked && (
            <Info>
              下单前需核验合同主体、资金、预算、交期与库存。点击“核验交易”，通过后即可确认下单。
            </Info>
          )}
          {checked && (
            <div role="status">
              {problems.length ? (
                <Info warning>
                  <strong>交易已拦截</strong>
                  <ul>
                    {problems.map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                </Info>
              ) : (
                <Info>
                  ✓ 合同主体、企业资质、预算、交期与库存核验通过，可以确认下单。
                </Info>
              )}
            </div>
          )}
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
                    {formatMoney(
                      purchase.transportId === "pickup"
                        ? totals.goods
                        : totals.total,
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
      {purchase.ordered && (
        <section className="pw-fulfillment">
          <h3>运小二 · 交付跟进</h3>
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
          <Info>
            {purchase.received
              ? "采购已完成，成本复盘和交易经验已生成。"
              : purchase.deliveryStep === 0
                ? "订单已生成，正在按确认方案安排库区出货。"
                : purchase.deliveryStep === 1
                  ? "粮食已发运，运小二跟进运输与到货安排。"
                  : "粮食已到厂，请完成数量和质量验收后确认收货。"}
          </Info>
          {!inspecting && !purchase.received && (
            <div className="pw-action-bar">
              <p>
                采购单号 {purchase.id}
                <br />
                计划到货 {totals.days} 天 · 到货地 {purchase.need.destination}
              </p>
              {purchase.deliveryStep < 2 ? (
                <Button
                  onClick={() =>
                    update({ deliveryStep: purchase.deliveryStep + 1 })
                  }
                >
                  更新履约进度 →
                </Button>
              ) : (
                <Button onClick={onReceived}>验收通过，确认收货 →</Button>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}

function Review({
  purchase,
  onAgain,
}: {
  purchase: Purchase;
  onAgain(): void;
}) {
  const totals = purchaseTotals(purchase);
  const roadCost = purchaseTotals({
    ...purchase,
    transportId: purchase.originMission ? purchase.transportId : "road",
  });
  const difference = roadCost.logistics - totals.logistics;
  return (
    <>
      <div className="pw-complete">
        <span>✓</span>
        <div>
          <h3>
            {purchase.need.quantity} 吨{purchase.need.variety}已签收入库
          </h3>
          <p>采购单 {purchase.id} · 本次办理闭环</p>
        </div>
      </div>
      <div className="pw-review-metrics">
        <div>
          <span>采购粮款</span>
          <strong>¥ {formatMoney(totals.goods)}</strong>
        </div>
        <div>
          <span>
            {purchase.transportId === "pickup"
              ? "自提运费估算"
              : "方案物流费用"}
          </span>
          <strong>¥ {formatMoney(totals.logistics)}</strong>
        </div>
        <div>
          <span>订单口径到厂成本</span>
          <strong>
            {formatMoney(totals.unit)} <small>元/吨</small>
          </strong>
        </div>
      </div>
      <div className="pw-pickup-guide">
        <h3>算小二 · 成本复盘</h3>
        <p>
          本次按点价粮款与运输方案计算，总成本为{" "}
          <strong>¥ {formatMoney(totals.total)}</strong>。较预算上限留有{" "}
          <strong>
            ¥{" "}
            {formatMoney(
              (purchase.need.budget - totals.unit) * purchase.need.quantity,
            )}
          </strong>{" "}
          空间。
        </p>
        <p>
          {difference > 0
            ? `相比同粮源公路直达方案，所选运输方式预计减少 ${formatMoney(difference)} 元运输费用。`
            : purchase.originMission
              ? "本次沿用原驾驶舱已确认的运输组合，未重复计算方案节约。"
              : "本次选择公路直达，以减少中转、保障到货时效；未计入额外的运输节约。"}
        </p>
        {totals.additional > 0 && (
          <p>
            另含装卸、损耗等原方案费用 ¥ {formatMoney(totals.additional)}
            ，已计入到厂总成本。
          </p>
        )}
        <small>
          预算余量不等于实际节约。以上按确认订单与方案口径计算，最终成本以实际结算单为准。
        </small>
      </div>
      <div className="pw-learned">
        <div className="pw-section-top">
          <h3>企业知识大脑 · 已沉淀 1 条采购经验</h3>
          <span className="pw-tag">下次主动引用</span>
        </div>
        <p>{purchaseMemory(purchase)}</p>
        <small>
          来源：{purchase.id} · 算小二复盘 → 粮掌柜共享 ·
          单笔交易经验，使用前复核
        </small>
      </div>
      <div className="pw-action-bar">
        <Link to="/knowledge" className="pw-text-button">
          到企业知识大脑查看 →
        </Link>
        <Button onClick={onAgain}>沿用需求，再买一笔 →</Button>
      </div>
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
    purchase.originMission
      ? `已带入原方案中的${totals.source.name}与点价结果，继续核对库存、质量及交易条件。`
      : "优先比较青岛港粮源，库存可以覆盖当前需求。点价前确认质量和数量，下一步将把运费加入，比较完整到厂成本。",
    `当前${totals.transport.label}预计${totals.days}天到货，到厂${totals.unit}元/吨。${purchase.originMission ? "运输与成本口径沿用本任务已确认的专业结果。" : purchase.need.days >= 6 && purchase.sourceId !== "weifang" ? "交期允许时可对比铁公联运，兼顾费用与中转时间。" : "优先关注短交期与到货保障。"}`,
    purchase.ordered
      ? "订单已确认，我会继续跟进发运与交付。到货验收通过后再确认收货，随后生成采购复盘。"
      : "先核对卖方与收款主体，再复核到厂预算、交期和库存。任何一项不符合，都不会放行下单。",
    "本次采购经验已经留下。下一笔相同品种、相同到货区域的需求，会主动带入这次方案供你参考；价格与库存仍会重新核对。",
  ][stage];
}
