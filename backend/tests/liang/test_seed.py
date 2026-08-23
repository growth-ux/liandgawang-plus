from app.liang.mock_seed import seed_liang_mock_data
from app.liang.models import GrainListing


def test_seed_is_idempotent(db_session):
    seed_liang_mock_data(db_session)
    seed_liang_mock_data(db_session)
    count = db_session.query(GrainListing).count()
    assert count == 12


def test_seed_covers_demo_scenarios(db_session):
    seed_liang_mock_data(db_session)
    codes = {l.listing_code for l in db_session.query(GrainListing).all()}
    assert "LIANG-V1-001" in codes  # 主推
    assert "LIANG-V1-002" in codes  # 备选
    assert "LIANG-V1-003" in codes  # 低价但等级不符
    assert "LIANG-V1-004" in codes  # 数量不足
    assert "LIANG-V1-005" in codes  # 字段缺失（无发运窗口）
    assert "LIANG-V1-009" in codes  # 小麦
    assert "LIANG-V1-011" in codes  # 大豆
