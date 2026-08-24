import json
import logging
import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

logger = logging.getLogger("knowledge.memory")


def _build_config() -> dict | None:
    """显式 Mem0 配置优先，否则复用项目通义配置直连本机 Milvus。"""
    load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False)

    raw = os.getenv("MEM0_CONFIG_JSON", "").strip()
    if raw:
        return json.loads(raw)

    api_key = os.getenv("QWEN_API_KEY", "").strip()
    if not api_key:
        return None

    embedding_dims = int(os.getenv("MEM0_EMBEDDING_DIMS", "1024"))
    base_url = os.getenv(
        "QWEN_BASE_URL",
        "https://dashscope.aliyuncs.com/compatible-mode/v1",
    )
    return {
        "history_db_path": os.getenv(
            "MEM0_HISTORY_DB_PATH",
            str(Path(__file__).resolve().parents[2] / ".mem0" / "history.db"),
        ),
        "vector_store": {
            "provider": "milvus",
            "config": {
                "url": os.getenv("MILVUS_URL", "http://127.0.0.1:19530"),
                "token": os.getenv("MILVUS_TOKEN", ""),
                "collection_name": os.getenv(
                    "MILVUS_COLLECTION", "liangda_enterprise_memory"
                ),
                "embedding_model_dims": embedding_dims,
            },
        },
        "embedder": {
            "provider": "openai",
            "config": {
                "api_key": api_key,
                "model": os.getenv("MEM0_EMBEDDING_MODEL", "text-embedding-v4"),
                "embedding_dims": embedding_dims,
                "openai_base_url": base_url,
            },
        },
        "llm": {
            "provider": "openai",
            "config": {
                "api_key": api_key,
                "model": os.getenv("QWEN_MODEL", "qwen-plus"),
                "temperature": 0.1,
                "openai_base_url": base_url,
            },
        },
    }


@lru_cache(maxsize=1)
def _client():
    config = _build_config()
    if config is None:
        return None
    try:
        os.environ.setdefault("MEM0_TELEMETRY", "False")
        from mem0 import Memory

        Path(config["history_db_path"]).parent.mkdir(parents=True, exist_ok=True)
        return Memory.from_config(config)
    except Exception:
        logger.exception("Mem0 初始化失败，回退 MySQL 查询")
        return None


def reset_client_for_tests() -> None:
    cache_clear = getattr(_client, "cache_clear", None)
    if cache_clear is not None:
        cache_clear()


def _result_items(raw) -> list[dict]:
    if isinstance(raw, dict):
        items = raw.get("results", [])
        return items if isinstance(items, list) else []
    return raw if isinstance(raw, list) else []


def sync_item(item) -> str | None:
    """将 MySQL 知识原文同步到 Mem0；失败时保留 MySQL 事实源。"""
    try:
        client = _client()
        if client is None:
            return None
        if item.memory_id:
            client.update(memory_id=item.memory_id, data=item.content)
            return item.memory_id
        result = client.add(
            [{"role": "user", "content": item.content}],
            user_id="liangda-enterprise",
            metadata={
                "knowledge_id": item.id,
                "knowledge_type": item.knowledge_type,
            },
            infer=False,
        )
        items = _result_items(result)
        return str(items[0]["id"]) if items and items[0].get("id") is not None else None
    except Exception:
        logger.exception("Mem0/Milvus 同步失败")
        return None


def delete_item(memory_id: str | None) -> bool:
    if not memory_id:
        return True
    try:
        client = _client()
        if client is None:
            return False
        client.delete(memory_id=memory_id)
        return True
    except Exception:
        logger.exception("Mem0/Milvus 删除失败")
        return False


def _search(query: str, limit: int) -> list[dict]:
    client = _client()
    if client is None:
        return []
    return _result_items(
        client.search(
            query=query,
            filters={"user_id": "liangda-enterprise"},
            limit=limit,
        )
    )


def search_ids(query: str, limit: int = 10) -> list[int]:
    """返回向量召回中的知识 ID；调用方必须再次检查 MySQL 状态。"""
    try:
        ids: list[int] = []
        for item in _search(query, limit):
            knowledge_id = item.get("metadata", {}).get("knowledge_id")
            if knowledge_id is not None:
                ids.append(int(knowledge_id))
        return ids
    except Exception:
        logger.exception("Mem0/Milvus 检索失败")
        return []


def sync_experience(item) -> None:
    """兼容旧经验调用；新服务使用 sync_item 获取 memory_id。"""
    sync_item(item)


def search_memories(query: str, limit: int = 5) -> list[str]:
    """兼容旧粮掌柜调用，返回 Mem0 召回文本。"""
    try:
        return [
            str(item.get("memory") or item.get("text") or item.get("data") or "")
            for item in _search(query, limit)
            if item.get("memory") or item.get("text") or item.get("data")
        ]
    except Exception:
        logger.exception("Mem0/Milvus 检索失败")
        return []
