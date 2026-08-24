# 粮达网 Plus

面向粮食采购企业的多小二协作系统。后端使用 FastAPI、MySQL、LangChain 与 Mem0，前端使用 React。企业知识大脑会从已确认的办事结果中提炼经验，并让粮掌柜、运小二等后续主动引用。

## 本地启动

```bash
cd backend
uv sync
uv run python migrations/apply_enterprise_knowledge.py
uv run python -m seed_db
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

另开终端启动前端：

```bash
cd web
npm install
npm run dev
```

默认连接本地 MySQL `127.0.0.1:3309`，前端开发地址为 `http://127.0.0.1:5173`。

## Mem0 与 Milvus

项目默认复用后端 `.env` 中的 `QWEN_API_KEY`，通过 OpenAI-compatible 接口使用 `text-embedding-v4`，并连接：

- Milvus：`http://127.0.0.1:19530`
- Collection：`liangda_enterprise_memory`
- 向量维度：`1024`

可在 `.env` 中使用 `MILVUS_URL`、`MILVUS_COLLECTION`、`MEM0_EMBEDDING_MODEL` 和 `MEM0_EMBEDDING_DIMS` 覆盖默认值；也可用 `MEM0_CONFIG_JSON` 提供完整 Mem0 配置。若 Mem0、向量模型或 Milvus 暂时不可用，知识仍保存在 MySQL，办事流程会自动使用 MySQL 关键词与标签检索降级，不会阻断主流程。

真实向量库冒烟测试：

```bash
cd backend
uv run pytest tests/knowledge/test_milvus_smoke.py -v
```

## 企业知识大脑演示闭环

1. 在粮掌柜输入“库存只够 5 天，未来 15 天采购 200 吨二等玉米到潍坊，不能影响生产”。
2. 确认采购目标、协作团队和最终综合方案。
3. 打开企业知识大脑，在“刚刚学到”中查看粮掌柜沉淀的决策经验。
4. 进入运小二，创建相似的玉米运输需求。
5. 查看运小二引用了哪条企业知识、为什么适用，以及如何影响方案排序。
6. 点击“本次不采用”，验证只重算当前任务，不会停用全局知识。
7. 返回知识大脑查看引用轨迹，编辑适用场景或停用知识。
8. 再次匹配时，已停用知识不会进入任何小二的建议。

## 验证

```bash
cd backend && uv run pytest -q
cd web && npm run build
git diff --check
```
