/** 首页全息道具类型（HoloProp 按类型渲染，对照官方参考图） */
export type HoloType = "chart" | "grain" | "route" | "rings" | "chips" | "fund" | "shield";

export interface Holo {
  type: HoloType;
  /** 道具在角色的哪一侧（rings 环绕型忽略） */
  side: "left" | "right";
  /** 道具顶部相对角色高度的位置百分比（rings 忽略） */
  offsetY: number;
  /** 透视倾斜角（度）：y 水平侧翻（正值右边缘后退）、x 俯仰、z 平面内旋转；缺省 y=±16、x=3、z=0 */
  tilt?: { y?: number; x?: number; z?: number };
  /** 屏与角色的水平锚点（角色宽度百分比，越大离角色越远）；缺省 58 */
  gap?: number;
}

export interface Agent {
  /** 路由标识，/agent/:id */
  id: string;
  /** 名称，如 粮掌柜 */
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
  /** 专属 IP 形象图（assets/generated，透明底 PNG） */
  image: string;
  /** 当前正在做的具体事情（首页名称气泡第二行） */
  doing: string;
  /** 首页协作场站位：x/y 为脚底锚点百分比，size 为角色高度占舞台高度百分比 */
  pos: { x: number; y: number; size: number };
  /** 首页全息道具：角色「正在操作」的全息屏（对照官方参考图）；不配置则不渲染 */
  holo?: Holo;
  /** 首页形象水平镜像（true 时角色面朝反方向，全息道具位置不受影响） */
  flip?: boolean;
}

export const agents: Agent[] = [
  {
    id: "da",
    name: "粮掌柜",
    char: "掌",
    action: "帮我办事",
    role: "采购主理与协作组织",
    symbol: "指挥屏、耳麦、罗盘",
    zone: "中央业务台",
    accent: "#e35d2b",
    tabs: ["开始新任务", "历史任务"],
    image: "/images/agents/liangdawang-plus-collaboration-duo-v1.png",
    doing: "正在拆解 200 吨玉米采购目标，组织六位小二分工",
    pos: { x: 50, y: 57, size: 30 },
    holo: { type: "rings", side: "right", offsetY: 0 },
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
    tabs: ["市场全景", "品种行情", "我的关注", "采购研判", "研判记录"],
    image: "/images/agents/zhan.png",
    doing: "跟踪玉米拍卖底价与港口平仓价，整理本周行情研判",
    pos: { x: 28, y: 31, size: 19 },
    holo: { type: "chart", side: "right", offsetY: 8, tilt: { y: 16 } },
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
    tabs: ["找粮源", "寻源任务", "候选对比"],
    image: "/images/agents/liangxiaoer-hologram-pose-transparent.png",
    doing: "对比东北产区 3 家供应方的粮源报价与质检报告",
    pos: { x: 69, y: 31, size: 19 },
    holo: { type: "grain", side: "right", offsetY: 48, tilt: { y: 10, x: 2 } },
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
    tabs: ["找物流", "运输方案", "运输任务", "询运对接"],
    image: "/images/agents/yun.png",
    doing: "规划港口到厂的 2 条运输路线，核对车辆排期",
    pos: { x: 89, y: 57, size: 20 },
    holo: { type: "route", side: "left", gap: 68, offsetY: 0, tilt: { y: -14 } },
    flip: true,
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
    tabs: ["成本测算", "盈亏推演", "测算记录"],
    image: "/images/agents/suan-xiaoer-thinking-operation-transparent.png",
    doing: "测算方案 A 的到厂成本，比对运费与水分扣量影响",
    pos: { x: 70, y: 90, size: 21 },
    holo: { type: "chips", side: "right", offsetY: 0 },
    flip: true,
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
    tabs: ["资金产品", "智能匹配", "我的匹配"],
    image: "/images/agents/qian.png",
    doing: "分析采购资金需求，从金融产品市场筛选主推与备选方案",
    pos: { x: 26, y: 88, size: 21 },
    holo: { type: "fund", side: "right", offsetY: 10, tilt: { y: 16 } },
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
    tabs: ["合作方体检", "待办核验", "风控记录"],
    image: "/images/agents/an.png",
    doing: "巡检粮源、物流与资金合作方，标记 2 项待核验风险",
    pos: { x: 13, y: 57, size: 20 },
    holo: { type: "shield", side: "right", offsetY: 8, tilt: { y: 12 } },
  },
];

export function getAgent(id: string | undefined): Agent | undefined {
  return agents.find((a) => a.id === id);
}

/** 共通任务状态（设计文档 8.1，暗色主题徽章） */
export const taskStatuses: { label: string; desc: string; tone: string }[] = [
  { label: "待命", desc: "当前没有参与任务", tone: "bg-rice-deep text-ink-soft" },
  { label: "工作中", desc: "正在形成专业结果", tone: "bg-brand-soft text-brand-deep" },
  { label: "待确认", desc: "缺少会影响结果的关键信息", tone: "bg-amber-400/15 text-amber-300" },
  { label: "有发现", desc: "已经形成可查看的结论", tone: "bg-emerald-400/15 text-emerald-300" },
  { label: "有异议", desc: "与其他小二结论存在冲突", tone: "bg-violet-400/15 text-violet-300" },
  { label: "有风险", desc: "发现需要优先处理的问题", tone: "bg-red-400/15 text-red-300" },
  { label: "已完成", desc: "本阶段服务已经完成", tone: "bg-sky-400/15 text-sky-300" },
];
