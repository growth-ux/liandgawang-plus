const FIELD_LABELS: Record<string, string> = {
  variety_code: "品种编码",
  variety_name: "品种",
  grade: "等级",
  quantity_tons: "数量",
  deadline_date: "最晚到货日期",
  destination: "目的地",
  budget_yuan_per_ton: "预算单价",
  stock_days: "当前库存天数",
  financing_gap_yuan: "资金缺口",
  priority: "采购优先级",
  hard_constraints: "硬性条件",
  action_label: "采购建议",
  ratio_low: "建议采购比例下限",
  ratio_high: "建议采购比例上限",
  time_window: "建议采购窗口",
  invalidation: "建议失效条件",
  watch_metrics: "重点关注指标",
  evidence_completeness: "证据完整度",
  origin: "发货地",
  candidates: "候选粮源",
  eliminated: "淘汰粮源",
  verifications: "待核验事项",
  listing_code: "粮源编号",
  supplier_code: "供应方编号",
  supplier_name: "供应方",
  price: "报价",
  price_type: "报价类型",
  available_quantity_tons: "可供数量",
  latest_ship_at: "最晚发运时间",
  delivered_price: "参考到厂价",
  quality_penalty: "质量扣价",
  reasons: "入选原因",
  risks: "风险提示",
  scheme_id: "方案",
  batches: "运输批次",
  freight_weighted_yuan_per_ton: "加权参考运费",
  rejected: "未采用运输方案",
  check_items: "运输核验事项",
  batch: "批次",
  mode_name: "运输方式",
  freight_yuan_per_ton: "参考运费",
  days_low: "最短运输时间",
  days_high: "最长运输时间",
  transship_count: "中转次数",
  legs: "运输路线",
  risk_note: "运输风险",
  distance_km: "运输距离",
  price_low: "参考运费下限",
  price_high: "参考运费上限",
  deadline_ok: "满足到货要求",
  over_days: "预计超期",
  tags: "方案标签",
  reason: "未采用原因",
  reason_text: "淘汰原因",
  moisture_pct: "水分",
  impurity_pct: "杂质",
  crop_year: "收获年度",
  test_weight_g_l: "容重",
  recommended_scheme_id: "主推方案",
  backup_scheme_id: "备选方案",
  delivered_cost_yuan_per_ton: "到厂吨成本",
  total_cost_yuan: "总成本",
  saving_total_yuan: "方案总成本差额",
  delta_yuan_per_ton: "方案吨成本差额",
  schemes: "成本方案",
  contains_estimates: "包含暂估数据",
  name: "方案名称",
  breakdown: "成本构成",
  purchase_yuan_per_ton: "采购成本",
  quality_yuan_per_ton: "质量调整",
  loading_yuan_per_ton: "装卸成本",
  loss_impact_yuan_per_ton: "损耗影响",
  financing_yuan_per_ton: "资金成本分摊",
  other_yuan_per_ton: "其他成本",
  amount_yuan: "融资金额",
  duration_days: "融资期限",
  product_code: "产品编号",
  product_name: "产品名称",
  institution_name: "金融机构",
  annual_rate_pct: "参考年化利率",
  estimated_cost_yuan: "参考资金成本",
  matched_reasons: "匹配原因",
  pending_conditions: "待满足条件",
  candidates_reviewed: "已审核候选方",
  allow_split: "允许分批运输",
  today: "测算日期",
  decision_preference: "方案偏好",
};

const HIDDEN_TECHNICAL_FIELDS = new Set(["action", "risk_codes", "mode", "price_unit", "reason_code"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberText(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(numeric);
}

function scalarText(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "未提供";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (key.endsWith("_yuan_per_ton") || ["price", "delivered_price", "quality_penalty", "price_low", "price_high"].includes(key)) {
    return `${numberText(value)} 元/吨`;
  }
  if (key.endsWith("_yuan")) return `${numberText(value)} 元`;
  if (key.endsWith("_pct")) return `${numberText(value)}%`;
  if (key.endsWith("_tons")) return `${numberText(value)} 吨`;
  if (key.endsWith("_days") || key === "stock_days" || key === "days_low" || key === "days_high") return `${numberText(value)} 天`;
  if (key === "distance_km") return `${numberText(value)} 公里`;
  if (key === "over_days") return `${numberText(value)} 天`;
  if (key === "transship_count") return `${numberText(value)} 次`;
  if (key === "candidates_reviewed") return `${numberText(value)} 家`;
  if (key === "ratio_low" || key === "ratio_high") return `${numberText(value)}%`;
  if (key === "scheme_id" || key.endsWith("_scheme_id")) return `方案 ${String(value)}`;
  if (key === "priority") {
    return { supply: "优先保供", balanced: "均衡考虑", cost: "优先成本" }[String(value)] ?? "均衡考虑";
  }
  if (key === "decision_preference") {
    return { supply: "优先保供", balanced: "均衡考虑", cost: "优先成本" }[String(value)] ?? "均衡考虑";
  }
  if (key === "evidence_completeness") {
    return { high: "较完整", medium: "基本完整", low: "仍需补充" }[String(value)] ?? "仍需补充";
  }
  return String(value);
}

function routeText(legs: unknown[]) {
  const records = legs.filter(isRecord);
  if (records.length === 0) return "未提供路线";
  const stops = [records[0].origin, ...records.map((leg) => leg.destination)].filter(Boolean).map(String);
  return stops.join(" → ");
}

function recordTitle(record: Record<string, unknown>, index: number) {
  if (record.batch) return String(record.batch);
  if (record.name) return String(record.name);
  if (record.supplier_name) return String(record.supplier_name);
  if (record.scheme_id) return `方案 ${String(record.scheme_id)}`;
  if (record.listing_code) return `粮源 ${String(record.listing_code)}`;
  return `第 ${index + 1} 项`;
}

function FieldValue({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-ink-soft">无</span>;
    if (fieldKey === "legs") {
      const modes = value.filter(isRecord).map((leg) => leg.mode_name).filter(Boolean).map(String);
      return (
        <div className="text-right">
          <p className="font-medium text-ink">{routeText(value)}</p>
          {modes.length > 0 && <p className="text-xs text-ink-soft">{modes.join(" + ")}</p>}
        </div>
      );
    }
    if (value.every((item) => !isRecord(item) && !Array.isArray(item))) {
      return (
        <ul className="space-y-1 text-left">
          {value.map((item, index) => <li key={index}>• {scalarText(fieldKey, item)}</li>)}
        </ul>
      );
    }
    return (
      <div className="grid gap-2">
        {value.map((item, index) => isRecord(item) ? (
          <div key={index} className="rounded-xl border border-line bg-rice-deep/70 px-3 py-2.5">
            <p className="mb-1.5 text-xs font-medium text-tech">{recordTitle(item, index)}</p>
            <FactRows facts={item} nested />
          </div>
        ) : <p key={index}>{String(item)}</p>)}
      </div>
    );
  }

  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length > 0 && entries.every(([key]) => /^[A-Z0-9]+$/.test(key))) {
      return (
        <div className="space-y-1.5">
          {entries.map(([schemeId, schemeValue]) => (
            <div key={schemeId} className="flex items-center justify-between gap-4">
              <span className="text-ink-soft">方案 {schemeId}</span>
              <span>{scalarText(fieldKey, schemeValue)}</span>
            </div>
          ))}
        </div>
      );
    }
    return <FactRows facts={value} nested />;
  }

  return <span>{scalarText(fieldKey, value)}</span>;
}

function FactRows({ facts, nested = false }: { facts: Record<string, unknown>; nested?: boolean }) {
  const entries = Object.entries(facts).filter(([key]) => !HIDDEN_TECHNICAL_FIELDS.has(key));
  return (
    <div className={nested ? "space-y-1.5" : "space-y-2"}>
      {entries.map(([key, value]) => {
        const complex = Array.isArray(value) && value.some(isRecord);
        return (
          <div key={key} className={complex ? "grid gap-1.5" : "flex items-start justify-between gap-4"}>
            <span className="shrink-0 text-ink-soft">{FIELD_LABELS[key] ?? "补充信息"}</span>
            <div className={complex ? "min-w-0" : "min-w-0 text-right text-ink"}>
              <FieldValue fieldKey={key} value={value} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AgentFactList({ facts }: { facts: Record<string, unknown> }) {
  return <FactRows facts={facts} />;
}
