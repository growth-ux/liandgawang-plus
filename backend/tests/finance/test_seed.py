from app.finance.models import FinanceProduct
from app.finance.seed import DATASET_VERSION, seed_finance_products


def test_seed_is_idempotent(db_session):
    seed_finance_products(db_session)
    first = db_session.query(FinanceProduct).count()
    seed_finance_products(db_session)
    assert db_session.query(FinanceProduct).count() == first == 50


def test_seed_covers_four_finance_categories(db_session):
    seed_finance_products(db_session)
    rows = db_session.query(FinanceProduct).all()
    assert {row.category for row in rows} == {
        "purchase_working", "order_finance", "warehouse_finance", "receivable_finance"
    }
    assert all(row.dataset_version == DATASET_VERSION for row in rows)
    assert all(row.is_active for row in rows)


def test_seed_has_products_for_demo_requirement(db_session):
    seed_finance_products(db_session)
    rows = db_session.query(FinanceProduct).all()
    assert any(
        row.min_amount_yuan <= 300_000 <= row.max_amount_yuan
        and row.min_days <= 45 <= row.max_days
        and "credit" in row.guarantee_modes
        for row in rows
    )
