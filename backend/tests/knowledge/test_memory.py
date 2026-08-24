from types import SimpleNamespace

from app.knowledge import memory


class FakeMemory:
    def add(self, messages, **kwargs):
        assert messages == [{"role": "user", "content": "雨季优先锁车"}]
        assert kwargs["infer"] is False
        assert kwargs["metadata"]["knowledge_id"] == 7
        return {"results": [{"id": "mem-7"}]}

    def search(self, query, **kwargs):
        assert query == "雨季补库"
        return {
            "results": [
                {"memory": "雨季优先锁车", "metadata": {"knowledge_id": 7}, "score": 0.92},
                {"memory": "缺少知识 ID", "metadata": {}, "score": 0.8},
            ]
        }

    def update(self, memory_id, data):
        assert memory_id == "mem-7"
        assert data == "雨季优先锁车"

    def delete(self, memory_id):
        assert memory_id == "mem-7"


def test_sync_search_update_delete(monkeypatch):
    monkeypatch.setattr(memory, "_client", lambda: FakeMemory())
    item = SimpleNamespace(
        id=7,
        content="雨季优先锁车",
        knowledge_type="decision",
        memory_id=None,
    )

    assert memory.sync_item(item) == "mem-7"
    assert memory.search_ids("雨季补库", 5) == [7]
    item.memory_id = "mem-7"
    assert memory.sync_item(item) == "mem-7"
    assert memory.delete_item("mem-7") is True


def test_memory_failure_returns_safe_defaults(monkeypatch):
    class BrokenMemory:
        def search(self, *args, **kwargs):
            raise RuntimeError("milvus unavailable")

    monkeypatch.setattr(memory, "_client", lambda: BrokenMemory())
    assert memory.search_ids("玉米") == []


def test_legacy_search_returns_memory_text(monkeypatch):
    monkeypatch.setattr(memory, "_client", lambda: FakeMemory())
    assert memory.search_memories("雨季补库", 5) == ["雨季优先锁车", "缺少知识 ID"]


def test_build_config_reuses_qwen_key_and_local_milvus(monkeypatch):
    monkeypatch.delenv("MEM0_CONFIG_JSON", raising=False)
    monkeypatch.setenv("QWEN_API_KEY", "test-key")
    monkeypatch.setenv("QWEN_MODEL", "qwen-plus")

    config = memory._build_config()

    assert config["vector_store"]["provider"] == "milvus"
    assert config["vector_store"]["config"]["url"] == "http://127.0.0.1:19530"
    assert config["vector_store"]["config"]["embedding_model_dims"] == 1024
    assert config["embedder"]["config"]["model"] == "text-embedding-v4"
    assert config["embedder"]["config"]["api_key"] == "test-key"
