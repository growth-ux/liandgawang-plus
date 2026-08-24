import os
import time
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
from dotenv import load_dotenv

from app.knowledge import memory

load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False)

pytestmark = pytest.mark.skipif(
    not (os.getenv("MEM0_CONFIG_JSON") or os.getenv("QWEN_API_KEY")),
    reason="需要 QWEN_API_KEY 或完整 MEM0_CONFIG_JSON 配置",
)


def test_live_milvus_add_search_delete():
    memory.reset_client_for_tests()
    marker = uuid4().hex[:10]
    knowledge_id = int(marker[:7], 16)
    item = SimpleNamespace(
        id=knowledge_id,
        content=f"潍坊雨季紧急补库优先锁定稳定车源，验证标识{marker}",
        knowledge_type="decision",
        memory_id=None,
    )
    memory_id = memory.sync_item(item)
    assert memory_id
    try:
        found = False
        for _ in range(20):
            if knowledge_id in memory.search_ids(item.content, 100):
                found = True
                break
            time.sleep(0.5)
        assert found, "Milvus 在 10 秒内未达到可检索状态"
    finally:
        deleted = False
        for _ in range(20):
            if memory.delete_item(memory_id):
                deleted = True
                break
            time.sleep(0.5)
        assert deleted, "Milvus 测试数据清理失败"
