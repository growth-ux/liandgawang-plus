import json
import logging
import os

logger = logging.getLogger("suan.knowledge.memory")


def _client():
    raw = os.getenv("MEM0_CONFIG_JSON", "").strip()
    if not raw:
        return None
    try:
        from mem0 import Memory
        return Memory.from_config(json.loads(raw))
    except Exception:
        logger.exception("Mem0 初始化失败，回退数据库查询")
        return None


def sync_experience(item) -> None:
    """将经验同步到 Mem0（可选）。失败时静默降级。"""
    try:
        client = _client()
        if client is None:
            return
        client.add(
            [{"role": "assistant", "content": item.content}],
            user_id="liangda-enterprise",
            metadata={"experience_id": item.id, "source_record_id": item.source_record_id},
        )
    except Exception:
        logger.exception("Mem0 经验同步失败")


def search_memories(query: str, limit: int = 5) -> list[str]:
    """搜索 Mem0 共享记忆（可选）。未配置时返回空列表。"""
    try:
        client = _client()
        if client is None:
            return []
        results = client.search(query, user_id="liangda-enterprise", limit=limit)
        if isinstance(results, list):
            return [r.get("memory", "") if isinstance(r, dict) else str(r) for r in results]
        return []
    except Exception:
        logger.exception("Mem0 搜索失败")
        return []
