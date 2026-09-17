import type { Purchase } from "./purchaseModel";
import { formatMoney } from "./purchaseModel";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CheckEvidence {
  source: string;
  lines: string[];
}

export interface MarginCalc {
  quantity: number;
  unitPrice: number;
  rate: number;
  required: number;
  total: number;
  frozen: number;
  available: number;
}

export interface CheckResult {
  status: "passed" | "warning" | "failed";
  label: string;
  evidence: CheckEvidence;
  marginCalc?: MarginCalc;
  note?: string;
}

export interface CreditScore {
  grade: string;
  score: number;
  dimensions: { label: string; value: string; detail: string }[];
}

/* ------------------------------------------------------------------ */
/*  Static data                                                        */
/* ------------------------------------------------------------------ */

export const ENTERPRISE = {
  id: "QD-2024-0892",
  registeredAt: "2024-03-15",
  creditCode: "91370200MA2T8KXY3P",
  licenseExpiry: "2029-06-30",
  accountMasked: "3702 **** **** 6789",
};

export const CREDIT_SCORE: CreditScore = {
  grade: "A",
  score: 892,
  dimensions: [
    {
      label: "履约记录",
      value: "98.2%",
      detail: "近12个月完成 47 笔，1 笔轻微逾期（3天）",
    },
    {
      label: "资金安全",
      value: "良好",
      detail: "近6个月无异常资金变动，账户流水稳定",
    },
    {
      label: "合规状态",
      value: "全部有效",
      detail: "营业执照、食品经营许可均在有效期",
    },
    {
      label: "平台评级",
      value: "优秀",
      detail: "连续3个季度优秀合作方",
    },
  ],
};

export const ACCOUNT_TOTAL = 823500;
export const ACCOUNT_FROZEN = 156000;

/* ------------------------------------------------------------------ */
/*  Check item definitions                                             */
/* ------------------------------------------------------------------ */

export interface CheckDef {
  id: string;
  label: string;
  delay: number;
  category: "an" | "qian";
  /** 核验过程中显示的动态文案，模拟真实查询过程 */
  checkingText: string;
  evidence: (purchase: Purchase) => CheckEvidence;
  evaluate: (purchase: Purchase) => CheckResult;
}

export const CHECK_ITEMS: CheckDef[] = [
  /* ---- 安小二 · 交易准入 ---- */
  {
    id: "registration",
    label: "注册入驻",
    delay: 450,
    category: "an",
    checkingText: "正在校验入驻资料的完整性与真实性…",
    evidence: (p) => ({
      source: "粮达网商户中心 · 权威数据源比对",
      lines: p.documentName
        ? [
            `企业编号：${ENTERPRISE.id}`,
            `入驻时间：${ENTERPRISE.registeredAt}`,
            `本次材料：${p.documentName}`,
          ]
        : [
            `企业编号：${ENTERPRISE.id}`,
            `入驻时间：${ENTERPRISE.registeredAt}`,
            "未检测到本次采购的经办人授权及资质附件",
            "请补充材料后重新核验",
          ],
    }),
    evaluate: (p) =>
      p.documentName
        ? {
            status: "passed",
            label: "入驻资料齐备，真实性比对通过",
            evidence: {
              source: "粮达网商户中心 · 权威数据源比对",
              lines: [
                `企业编号：${ENTERPRISE.id}`,
                `入驻时间：${ENTERPRISE.registeredAt}`,
                `本次材料：${p.documentName}`,
                "材料完整性：营业执照、法人身份、经办人授权 3/3",
                `真实性比对：与工商登记、法人身份核验源一致（${new Date().toLocaleDateString("zh-CN")}）`,
              ],
            },
          }
        : {
            status: "failed",
            label: "入驻资料不完整，缺少本次采购的经办人授权附件",
            evidence: {
              source: "粮达网商户中心 · 权威数据源比对",
              lines: [
                `企业编号：${ENTERPRISE.id}`,
                `入驻时间：${ENTERPRISE.registeredAt}`,
                "未检测到本次采购的经办人授权及资质附件",
                "请补充材料后重新核验",
              ],
            },
            note: "补充后重跑即可，已填写的采购需求会保留",
          },
  },
  {
    id: "credit",
    label: "企业资质",
    delay: 850,
    category: "an",
    checkingText: "正在检索工商登记、司法与征信记录…",
    evidence: () => ({
      source: "国家企业信用信息公示系统 · 司法与征信数据",
      lines: [
        `统一社会信用代码：${ENTERPRISE.creditCode}`,
        `资质有效期至：${ENTERPRISE.licenseExpiry}`,
        "经营状态：存续（在营、开业、在册）",
      ],
    }),
    evaluate: () => ({
      status: "passed",
      label: "工商与征信记录正常，近 36 个月无不良记录",
      evidence: {
        source: "国家企业信用信息公示系统 · 司法与征信数据",
        lines: [
          `统一社会信用代码：${ENTERPRISE.creditCode}`,
          `资质有效期至：${ENTERPRISE.licenseExpiry}`,
          "经营状态：存续（在营、开业、在册）",
          "近 36 个月：无行政处罚、无经营异常、无被执行记录",
          `查询时间：${new Date().toLocaleDateString("zh-CN")}`,
        ],
      },
    }),
  },
  {
    id: "fulfillment",
    label: "履约授信",
    delay: 1200,
    category: "an",
    checkingText: "正在复核平台过往订单与资金流水…",
    evidence: () => ({
      source: "平台交易信用库 · 订单结算流水",
      lines: [
        "近 12 个月订单：47 笔，结算 47 笔，完成率 100%",
        "平均结算周期：T+3，无逾期结算",
      ],
    }),
    evaluate: () => ({
      status: "passed",
      label: "过往订单与资金流水正常，履约授信充足",
      evidence: {
        source: "平台交易信用库 · 订单结算流水",
        lines: [
          "近 12 个月订单：47 笔，结算 47 笔，完成率 100%",
          "平均结算周期：T+3，无逾期结算",
          "资金审查：单笔金额与经营范围匹配，无异常拆分",
          `履约授信结论：${CREDIT_SCORE.grade} 级（${CREDIT_SCORE.score} 分），本单授信额度充足`,
          `查询时间：${new Date().toLocaleDateString("zh-CN")}`,
        ],
      },
    }),
  },

  /* ---- 钱小二 · 交易条件 ---- */
  {
    id: "risk",
    label: "风险预警",
    delay: 1500,
    category: "qian",
    checkingText: "正在扫描交易信用库及司法数据…",
    evidence: () => ({
      source: "平台交易信用库",
      lines: [
        `企业信用等级：${CREDIT_SCORE.grade} 级（${CREDIT_SCORE.score} 分）`,
        `近12个月履约率：98.2%（47 笔完成，1 笔轻微逾期）`,
        "近6个月无重大违约记录、无法院被执行信息",
      ],
    }),
    evaluate: () => ({
      status: "passed",
      label: "近12个月无重大违约记录",
      evidence: {
        source: "平台交易信用库",
        lines: [
          `企业信用等级：${CREDIT_SCORE.grade} 级（${CREDIT_SCORE.score} 分）`,
          `近12个月履约率：98.2%（47 笔完成，1 笔轻微逾期）`,
          "近6个月无重大违约记录、无法院被执行信息",
          `查询时间：${new Date().toLocaleDateString("zh-CN")}`,
        ],
      },
    }),
  },
  {
    id: "account",
    label: "资金账户",
    delay: 650,
    category: "qian",
    checkingText: "正在核实资金监管系统账户状态…",
    evidence: () => ({
      source: "资金监管系统",
      lines: [
        `对公账户：${ENTERPRISE.accountMasked}`,
        `账户状态：正常（已关联粮达网交易账户）`,
        `最近交易：${new Date(Date.now() - 86400000 * 3).toLocaleDateString("zh-CN")}`,
      ],
    }),
    evaluate: () => ({
      status: "passed",
      label: "企业对公账户已关联",
      evidence: {
        source: "资金监管系统",
        lines: [
          `对公账户：${ENTERPRISE.accountMasked}`,
          `账户状态：正常（已关联粮达网交易账户）`,
          `最近交易：${new Date(Date.now() - 86400000 * 3).toLocaleDateString("zh-CN")}`,
        ],
      },
    }),
  },
  {
    id: "margin",
    label: "保证金",
    delay: 1050,
    category: "qian",
    checkingText: "正在计算保证金额度并核对台账…",
    evidence: (p) => {
      const qty = p.need.quantity;
      const price = p.need.budget;
      const rate = 0.1;
      const required = Math.round(qty * price * rate);
      return {
        source: "保证金台账",
        lines: [
          `计算公式：${qty} 吨 × ${formatMoney(price)} 元/吨 × ${(rate * 100).toFixed(0)}% = ${formatMoney(required)} 元`,
          `账户总额：${formatMoney(ACCOUNT_TOTAL)} 元`,
          `已冻结：${formatMoney(ACCOUNT_FROZEN)} 元`,
          `可用额度：${formatMoney(ACCOUNT_TOTAL - ACCOUNT_FROZEN)} 元`,
        ],
      };
    },
    evaluate: (p) => {
      const qty = p.need.quantity;
      const price = p.need.budget;
      const rate = 0.1;
      const required = Math.round(qty * price * rate);
      const available = ACCOUNT_TOTAL - ACCOUNT_FROZEN;
      const calc: MarginCalc = {
        quantity: qty,
        unitPrice: price,
        rate,
        required,
        total: ACCOUNT_TOTAL,
        frozen: ACCOUNT_FROZEN,
        available,
      };
      return required > available
        ? {
            status: "failed",
            label: `预留 ${formatMoney(required)} 元超过可用额度 ${formatMoney(available)} 元`,
            evidence: {
              source: "保证金台账",
              lines: [
                `计算公式：${qty} 吨 × ${formatMoney(price)} 元/吨 × ${(rate * 100).toFixed(0)}% = ${formatMoney(required)} 元`,
                `账户总额：${formatMoney(ACCOUNT_TOTAL)} 元`,
                `已冻结：${formatMoney(ACCOUNT_FROZEN)} 元`,
                `可用额度：${formatMoney(available)} 元`,
              ],
            },
            marginCalc: calc,
            note: "保证金预留上限超过账户可用额度，请调整采购数量或预算",
          }
        : {
            status: "passed",
            label: `可用额度 ${formatMoney(available)} 元，本单预留 ${formatMoney(required)} 元`,
            evidence: {
              source: "保证金台账",
              lines: [
                `计算公式：${qty} 吨 × ${formatMoney(price)} 元/吨 × ${(rate * 100).toFixed(0)}% = ${formatMoney(required)} 元`,
                `账户总额：${formatMoney(ACCOUNT_TOTAL)} 元`,
                `已冻结：${formatMoney(ACCOUNT_FROZEN)} 元`,
                `可用额度：${formatMoney(available)} 元`,
                `预留后剩余：${formatMoney(available - required)} 元`,
              ],
            },
            marginCalc: calc,
          };
    },
  },
];

/** 按小二分组 */
export function columnChecks(category: "an" | "qian"): CheckDef[] {
  return CHECK_ITEMS.filter((c) => c.category === category);
}

/** 生成核验报告编号（确定性，基于采购 ID） */
export function reportId(purchaseId: string): string {
  const hash = purchaseId
    .split("")
    .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) & 0xffff, 0);
  return `VRF-${hash.toString(16).toUpperCase().padStart(4, "0")}`;
}
