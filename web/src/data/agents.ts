export interface Agent {
  /** 路由标识，/agent/:id */
  id: string;
  /** 名称，如 达小二 */
  name: string;
  /** 头像单字 */
  char: string;
  /** 动作化服务说明，如 帮我办事 */
  action: string;
  /** 职责定位 */
  role: string;
  /** 视觉符号（设计文档 7.2） */
  symbol: string;
  /** 场景位置（设计文档 7.2） */
  zone: string;
  /** 头像主题色 */
  accent: string;
  /** 页内 Tab（设计文档第 8 章） */
  tabs: string[];
  /** 首页主视觉热区，百分比坐标 */
  hotspot: { x: number; y: number; w: number; h: number };
}

export const agents: Agent[] = [
  {
    id: "da",
    name: "达小二",
    char: "达",
    action: "帮我办事",
    role: "采购主理与协作组织",
    symbol: "指挥屏、耳麦、罗盘",
    zone: "中央业务台",
    accent: "#e35d2b",
    tabs: ["目标受理", "任务方案", "参与小二", "综合结论", "行动清单", "历史任务"],
    hotspot: { x: 40, y: 27, w: 21, h: 46 },
  },
  {
    id: "zhan",
    name: "瞻小二",
    char: "瞻",
    action: "看行情",
    role: "行情研判",
    symbol: "数据目镜、趋势波形",
    zone: "行情与资讯屏",
    accent: "#2f7fb8",
    tabs: ["市场全景", "品种走势", "区域价差", "影响因素", "我的关注", "研判记录"],
    hotspot: { x: 42, y: 3, w: 16, h: 24 },
  },
  {
    id: "liang",
    name: "粮小二",
    char: "粮",
    action: "找粮源",
    role: "粮源寻采",
    symbol: "麦穗扫描器、粮食样品仓",
    zone: "农田与粮源区",
    accent: "#c9902a",
    tabs: ["找粮源", "候选对比", "供应方", "寻源任务", "历史记录"],
    hotspot: { x: 68, y: 11, w: 17, h: 28 },
  },
  {
    id: "yun",
    name: "运小二",
    char: "运",
    action: "找物流",
    role: "物流服务",
    symbol: "路线投影、运输轮组",
    zone: "仓储与物流区",
    accent: "#3f9d6e",
    tabs: ["找物流", "路线方案", "方案对比", "运输任务", "历史记录"],
    hotspot: { x: 83, y: 33, w: 16, h: 32 },
  },
  {
    id: "suan",
    name: "算小二",
    char: "算",
    action: "算成本",
    role: "综合成本",
    symbol: "成本仪表盘、计算矩阵",
    zone: "方案测算台",
    accent: "#7a6bc0",
    tabs: ["新建测算", "成本明细", "方案对比", "敏感因素", "测算记录"],
    hotspot: { x: 41, y: 64, w: 18, h: 30 },
  },
  {
    id: "qian",
    name: "钱小二",
    char: "钱",
    action: "找资金",
    role: "资金服务",
    symbol: "金融凭证、资金环",
    zone: "金融服务区",
    accent: "#c76a3f",
    tabs: ["找资金服务", "服务对比", "申请咨询", "办理进度", "服务记录"],
    hotspot: { x: 13, y: 50, w: 17, h: 32 },
  },
  {
    id: "an",
    name: "安小二",
    char: "安",
    action: "查风险",
    role: "风险审核",
    symbol: "盾牌扫描器、风险灯",
    zone: "全局巡检位",
    accent: "#4b8f8c",
    tabs: ["发起审核", "风险清单", "核验事项", "审核对象", "审核记录"],
    hotspot: { x: 3, y: 19, w: 16, h: 30 },
  },
];

export function getAgent(id: string | undefined): Agent | undefined {
  return agents.find((a) => a.id === id);
}

/** 共通任务状态（设计文档 8.1） */
export const taskStatuses: { label: string; desc: string; tone: string }[] = [
  { label: "待命", desc: "当前没有参与任务", tone: "bg-rice-deep text-ink-soft" },
  { label: "工作中", desc: "正在形成专业结果", tone: "bg-brand-soft text-brand-deep" },
  { label: "待确认", desc: "缺少会影响结果的关键信息", tone: "bg-amber-100 text-amber-700" },
  { label: "有发现", desc: "已经形成可查看的结论", tone: "bg-emerald-100 text-emerald-700" },
  { label: "有异议", desc: "与其他小二结论存在冲突", tone: "bg-violet-100 text-violet-700" },
  { label: "有风险", desc: "发现需要优先处理的问题", tone: "bg-red-100 text-red-700" },
  { label: "已完成", desc: "本阶段服务已经完成", tone: "bg-sky-100 text-sky-700" },
];
