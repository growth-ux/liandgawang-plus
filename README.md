# 粮达网 Plus

> 面向粮食采购企业的多智能体协作平台：让不同专业“小二”既能独立办事，也能围绕同一个采购目标协同决策，并把已确认的办事经验沉淀为企业共享记忆。

粮食采购不是单点比价问题。行情、粮源、物流、资金、成本和履约风险相互影响，传统流程常见信息分散、反复沟通、经验依赖个人、方案依据难追溯等问题。粮达网 Plus 以“粮掌柜 + 六位专业小二”为业务入口，把自然语言需求拆成可执行任务，在关键节点保留人工确认，并持续复用企业历史经验。

## 项目亮点

- **一个目标，多小二协同**：粮掌柜解析采购目标、推荐协作团队，调用各专业小二并行或按依赖办理，最终汇总方案、冲突与行动任务。
- **每个小二可独立使用**：用户可以直接看行情、找粮源、找物流、算成本、找资金或查风险，不必先创建复杂任务。
- **AI 与确定性规则分工**：大模型负责自然语言理解、知识提炼和可读解释；价格、成本、硬条件过滤、风险判定等关键计算由规则完成，结果更可核验。
- **企业知识自动生长**：从用户确认的办事结果中提炼企业事实、业务偏好、决策经验和风险规则，通过 Mem0 + Milvus 召回，并由 MySQL 保存权威业务记录。
- **知识引用可追踪、可纠偏**：页面展示引用了哪条经验、为什么适用、对方案产生了什么影响；用户可拒绝本次采用、编辑适用范围或停用知识。
- **关键决策有人把关**：目标确认、团队确认、最终方案等环节设置人工决策闸门，避免 AI 直接替用户做高影响业务决定。
- **模型不可用仍能演示主流程**：未配置模型或调用失败时，需求抽取、方案匹配和解释会使用业务规则降级；Mem0/Milvus 不可用时，知识检索会回退到 MySQL。

## 智能体能力地图

| 角色 | 定位 | 当前能力 |
| --- | --- | --- |
| 粮掌柜 | 采购主理与协作组织 | 目标解析、团队推荐、LangGraph 任务编排、冲突检测、综合建议、行动任务 |
| 瞻小二 | 行情研判 | 市场全景、价格趋势、品种行情、条件关注、采购研判与记录 |
| 粮小二 | 粮源寻采 | 粮源市场、自然语言寻源、硬条件过滤、候选篮、方案对比、任务交接 |
| 运小二 | 物流服务 | 线路筛选、运输需求确认、方案排序、询运对接、企业经验引用 |
| 算小二 | 综合成本 | 到厂成本测算、多方案比较、盈亏推演、记录复用 |
| 钱小二 | 资金服务 | 金融产品市场、需求抽取、智能匹配、匹配记录、转交算小二 |
| 安小二 | 风险审核 | 合作方体检、待办核验、风险处置记录、风险经验沉淀 |

## 系统架构

```mermaid
flowchart LR
    U[采购人员] --> W[React 科技风 Web]
    W --> API[FastAPI API]
    API --> Z[粮掌柜 LangGraph]
    Z --> A[六位专业小二]
    A --> R[业务规则与 AI 解释]
    R --> DB[(MySQL 业务数据)]
    R --> K[企业知识服务]
    K --> DB
    K --> M[Mem0]
    M --> V[(Milvus 向量检索)]
```

### 技术栈

- 前端：React 18、TypeScript、Vite、Tailwind CSS 4、ECharts
- 后端：Python 3.12、FastAPI、SQLAlchemy、Pydantic
- Agent：LangChain、LangGraph、OpenAI-compatible 大模型接口
- 存储：MySQL 8、Mem0、Milvus
- 测试：Pytest、HTTPX

## 快速开始

### 1. 环境要求

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)
- Node.js 20+ 与 npm
- Docker（用于本地 MySQL；也可连接已有 MySQL 8）

### 2. 启动 MySQL

项目默认连接 `127.0.0.1:3309`。首次使用可直接创建本地容器：

```bash
docker run --name liangda-mysql \
  -e MYSQL_DATABASE=liangda_plus \
  -e MYSQL_USER=liangda \
  -e MYSQL_PASSWORD=liangda \
  -e MYSQL_ROOT_PASSWORD=root \
  -p 3309:3306 \
  -d mysql:8.0 \
  --character-set-server=utf8mb4 \
  --collation-server=utf8mb4_unicode_ci
```

容器已创建但处于停止状态时：

```bash
docker start liangda-mysql
```

默认数据库连接为：

```text
mysql+pymysql://liangda:liangda@127.0.0.1:3309/liangda_plus?charset=utf8mb4
```

如需连接其他数据库，请在启动后端前设置 `DATABASE_URL` 环境变量。

### 3. 配置并启动后端

```bash
cd backend
[ -f .env ] || cp .env.example .env
uv sync
uv run python -m seed_db
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

说明：

- `seed_db` 会创建当前版本所需的基础表并幂等写入演示数据，重复执行不会重复插入。
- FastAPI 启动时还会补齐已注册的数据表，并初始化金融产品与企业知识种子。
- `QWEN_API_KEY` 可暂时留空，此时依赖大模型的能力会使用规则结果降级。
- 仅在复用早期版本数据库、需要补齐企业知识字段时，才执行 `uv run python migrations/apply_enterprise_knowledge.py`；全新数据库无需执行增量迁移。

后端启动后可访问：

- API 服务：<http://127.0.0.1:8000>
- Swagger 文档：<http://127.0.0.1:8000/docs>
- OpenAPI：<http://127.0.0.1:8000/openapi.json>

### 4. 启动前端

另开一个终端：

```bash
cd web
npm ci
npm run dev
```

访问 <http://127.0.0.1:5173>。Vite 默认将 `/api` 代理到 `http://127.0.0.1:8000`；如后端使用其他端口，可这样启动：

```bash
VITE_API_TARGET=http://127.0.0.1:8010 npm run dev
```

## 大模型与企业记忆配置

后端从 `backend/.env` 读取模型和记忆配置：

```dotenv
QWEN_API_KEY=
QWEN_MODEL=qwen-plus
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

MILVUS_URL=http://127.0.0.1:19530
MILVUS_TOKEN=
MILVUS_COLLECTION=liangda_enterprise_memory
MEM0_EMBEDDING_MODEL=text-embedding-v4
MEM0_EMBEDDING_DIMS=1024
MEM0_HISTORY_DB_PATH=./.mem0/history.db
MEM0_TELEMETRY=False
```

默认使用同一个 `QWEN_API_KEY` 调用对话模型与 `text-embedding-v4`。也可以通过 `MEM0_CONFIG_JSON` 提供完整 Mem0 配置。

MySQL 是企业知识的权威存储；Mem0 + Milvus 用于语义检索。向量服务异常不会阻断办事流程，系统会自动使用 MySQL 关键词与标签检索。

## 推荐演示路线

### 路线一：多小二协作采购

1. 进入“粮掌柜”，输入：`库存只够 5 天，未来 15 天采购 200 吨二等玉米到潍坊，不能影响生产。`
2. 查看 AI 结构化出的采购目标，并确认或调整约束。
3. 查看粮掌柜推荐的协作团队与参与原因，确认后开始办理。
4. 观察瞻、粮、运、钱等小二并行工作，算小二基于上游结果测算，安小二完成风险审核。
5. 查看跨专业冲突、定向补充结果和综合推荐，在决策闸门确认最终方案。
6. 查看自动生成的后续行动任务及完整决策轨迹。

### 路线二：企业知识闭环

1. 完成一次粮掌柜采购决策或安小二风险审核。
2. 打开“企业知识大脑”，在“刚刚学到”中查看自动提炼的经验。
3. 进入运小二创建相似玉米运输任务，查看被主动引用的企业知识、适用原因及其排序影响。
4. 点击“本次不采用”，验证只重算当前任务，不停用全局知识。
5. 返回知识大脑查看引用轨迹，编辑适用场景或停用知识。
6. 再次匹配时，已停用知识不会进入任何小二的建议。

## 主要 API

| 前缀 | 模块 |
| --- | --- |
| `/api/zhanggui` | 粮掌柜采购任务、决策闸门、运行事件与行动任务 |
| `/api/market`、`/api/analysis`、`/api/watches` | 行情、采购研判与关注条件 |
| `/api/liang` | 粮源、候选篮、寻源任务与候选解释 |
| `/api/logistics` | 物流线路、运输任务、方案匹配与询运 |
| `/api/costing` | 成本测算、盈亏推演与测算记录 |
| `/api/finance` | 资金产品、需求抽取与智能匹配 |
| `/api/knowledge` | 企业知识学习、检索、编辑与引用轨迹 |
| `/api/handoffs` | 小二之间的结构化任务交接 |

具体请求与响应结构以 Swagger 文档为准。

## 项目结构

```text
.
├── backend/
│   ├── app/
│   │   ├── zhanggui/       # 粮掌柜 LangGraph 编排
│   │   ├── market/         # 行情数据
│   │   ├── analysis/       # 采购研判
│   │   ├── workflow/       # 行情关注条件
│   │   ├── liang/          # 粮源寻采
│   │   ├── logistics/      # 物流方案
│   │   ├── costing/        # 成本与盈亏
│   │   ├── finance/        # 资金匹配
│   │   ├── knowledge/      # 企业知识与 Mem0
│   │   └── handoff/        # 跨小二交接
│   ├── migrations/         # 增量数据库迁移
│   ├── tests/              # 后端测试
│   └── seed_db.py          # 演示数据初始化
├── web/
│   └── src/
│       ├── features/       # 各小二与知识大脑业务页面
│       ├── pages/          # 首页、我的办事、知识页
│       └── components/     # 通用科技风组件
├── docs/
│   ├── superpowers/specs/  # 分功能设计规格
│   └── superpowers/plans/  # 实施计划
└── product-design/         # 产品视觉素材
```

## 验证

运行全部后端测试：

```bash
cd backend
uv run pytest -q
```

验证真实 Milvus 连接与向量召回：

```bash
cd backend
uv run pytest tests/knowledge/test_milvus_smoke.py -v
```

构建前端：

```bash
cd web
npm run build
```

提交前检查文本差异：

```bash
git diff --check
```

## 设计文档

- [产品设计文档 V2](docs/粮达网Plus产品设计文档-V2.md)
- [企业知识大脑设计](docs/superpowers/specs/2026-08-24-enterprise-knowledge-brain-design.md)
- [粮掌柜设计](docs/superpowers/specs/2026-08-24-liang-zhanggui-design.md)
- [运小二运输方案 AI 决策舱](docs/superpowers/specs/2026-08-23-yun-transport-plan-ai-design.md)
- [粮小二寻源任务设计](docs/superpowers/specs/2026-08-23-liang-xiaoer-sourcing-tab-design.md)

## 当前定位

本项目面向 AI 竞赛场景，重点验证“多智能体协作 + 人工决策闸门 + 企业记忆复用”是否能解决粮食采购中的真实协同痛点。当前版本优先保证核心业务闭环清晰、可运行、可演示，生产级账号权限、消息基础设施和外部业务系统集成不在本阶段范围内。
