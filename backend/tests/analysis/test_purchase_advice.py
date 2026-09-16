import asyncio
import json
from datetime import date, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.analysis import purchase_advice as advice
from app.database import get_db
from app.knowledge.models import SharedExperience


@pytest.fixture()
def setup_advice(db_session, monkeypatch):
    monkeypatch.setattr(advice, '_config', lambda: ('test-key', 'qwen-plus', 'https://example.test/v1'))
    monkeypatch.delenv('QWEN_PURCHASE_MODEL', raising=False)
    spot = SimpleNamespace(region_name='山东·潍坊', quote_type='到货价', remark='二等散粮')
    monkeypatch.setattr(advice.market, 'get_spot', lambda db, variety, code: spot if variety == 'corn' and code == 'weifang' else None)
    end = date(2026, 9, 16)
    rows = [SimpleNamespace(observed_date=end - timedelta(days=29-i), price=Decimal(2400+i)) for i in range(30)]
    monkeypatch.setattr(advice.market, 'get_price_series', lambda db, code: rows)
    app = FastAPI()
    app.include_router(advice.router, prefix='/api/analysis')
    app.dependency_overrides[get_db] = lambda: db_session
    req = dict(variety_code='corn', quantity_tons=200, destination='山东省潍坊市', deadline_days=10,
               stock_days=15, budget_price=2680, spot_code='weifang', period_days=7, data_date=str(end))
    return TestClient(app), req


def test_context_uses_selected_window_and_active_experience(setup_advice, db_session, monkeypatch):
    client, req = setup_advice
    db_session.add_all([
        SharedExperience(title='玉米补库经验', content='交期较紧时先核实可发运库存', tags=['玉米'], status='active'),
        SharedExperience(title='玉米旧经验', content='不应召回', tags=['玉米'], status='ignored'),
    ])
    db_session.commit()
    captured = []

    async def generate(context, key, base_url, model):
        captured.append(context)
        assert model == 'qwen-flash'
        return advice.AdviceText(title='先比较到厂方案', reasoning='行情上涨，按期到货有5天缓冲。', caution='核实实际报价与交期。')

    monkeypatch.setattr(advice, 'generate_advice', generate)
    response = client.post('/api/analysis/purchase-advice', json=req)
    assert response.status_code == 200
    body = response.json()
    assert body['source'] == 'qwen' and body['model'] == 'qwen-flash'
    context = captured[0]
    assert context['need']['buffer_days'] == 5
    assert Decimal(context['market']['change']) == 6
    assert len(context['market']['daily_prices']) == 7
    assert context['market']['price_basis'] == '到货价'
    assert [item['title'] for item in context['experiences']] == ['玉米补库经验']
    response = client.post('/api/analysis/purchase-advice', json={**req, 'period_days': 30})
    assert response.status_code == 200
    assert Decimal(captured[1]['market']['change']) == 29
    assert body['context'] == {key: req[key] for key in ('spot_code', 'period_days', 'data_date')}


@pytest.mark.parametrize('patch,status', [({'stock_days': 0}, 422), ({'period_days': 12}, 422),
                                        ({'spot_code': 'unknown'}, 404), ({'data_date': '2026-09-17'}, 422)])
def test_invalid_requests_do_not_call_model(setup_advice, monkeypatch, patch, status):
    client, req = setup_advice
    async def unexpected(*args):
        raise AssertionError('invalid input must not call model')
    monkeypatch.setattr(advice, 'generate_advice', unexpected)
    assert client.post('/api/analysis/purchase-advice', json={**req, **patch}).status_code == status


def test_timeout_returns_explicit_rule_fallback(setup_advice, monkeypatch):
    client, req = setup_advice
    monkeypatch.setattr(advice, 'MODEL_TIMEOUT', .01)
    async def slow(*args):
        await asyncio.sleep(1)
    monkeypatch.setattr(advice, 'generate_advice', slow)
    body = client.post('/api/analysis/purchase-advice', json={**req, 'stock_days': 7}).json()
    assert body['source'] == 'rule' and body['model'] is None
    assert body['title'] == '先确认首批到货时间'
    assert body['elapsed_ms'] < 500


def test_no_key_returns_honest_fallback(setup_advice, monkeypatch):
    client, req = setup_advice
    monkeypatch.setattr(advice, '_config', lambda: ('', '', ''))
    assert client.post('/api/analysis/purchase-advice', json=req).json()['source'] == 'rule'


def test_lightweight_model_options(monkeypatch):
    import langchain_openai
    captured = {}
    class FakeModel:
        def __init__(self, **kwargs): captured.update(kwargs)
        def with_structured_output(self, schema, method):
            assert schema is advice.AdviceText and method == 'json_mode'
            return self
        async def ainvoke(self, messages):
            captured['context'] = json.loads(messages[1][1])
            return advice.AdviceText(title='比较报价', reasoning='根据行情比较报价。', caution='确认到货时间。')
    monkeypatch.setattr(langchain_openai, 'ChatOpenAI', FakeModel)
    asyncio.run(advice.generate_advice({'need': {'buffer_days': 5}}, 'key', 'url', 'qwen-flash'))
    assert captured['extra_body'] == {'enable_thinking': False}
    assert captured['max_retries'] == 0
    assert captured['max_tokens'] == 600
    assert captured['timeout'] == 8
    assert captured['context']['need']['buffer_days'] == 5
