from decimal import Decimal
from types import SimpleNamespace

from app.finance.rules import calculate_reference_cost, match_products
from app.finance.schemas import FinanceRequirement


def product(code, rate, *, min_amount=100_000, max_amount=1_000_000,
            min_days=15, max_days=90, guarantees=None, credentials=None,
            min_years=1):
    return SimpleNamespace(
        id=int(code[-1]), product_code=code, name=code, institution_name="测试机构",
        category="purchase_working", scenario="采购周转", min_amount_yuan=Decimal(min_amount),
        max_amount_yuan=Decimal(max_amount), min_days=min_days, max_days=max_days,
        annual_rate_pct=Decimal(rate), fee_note="", purposes=["grain_purchase"],
        guarantee_modes=guarantees or ["credit"], required_credentials=credentials or ["purchase_contract"],
        min_business_years=Decimal(str(min_years)), requirements=["人工核验"],
        data_updated_at="2026-08-23", is_active=True,
    )


DEMAND = FinanceRequirement(
    purpose="grain_purchase", amount_yuan=Decimal("300000"), duration_days=45,
    business_years=Decimal("2"), guarantee_modes=["credit"],
    credentials=["purchase_contract"], source_type="manual",
)


def test_reference_cost_uses_decimal_and_rounds_to_cents():
    assert calculate_reference_cost(Decimal("300000"), Decimal("5.2"), 45) == Decimal("1923.29")


def test_amount_or_duration_mismatch_never_enters_recommendations():
    out = match_products(DEMAND, [
        product("P1", "5.2"),
        product("P2", "4.0", min_amount=500_000),
        product("P3", "3.8", min_days=90, max_days=365),
    ])
    assert out.primary.product.product_code == "P1"
    assert out.backups == []
    assert {item.product.product_code for item in out.rejected} == {"P2", "P3"}


def test_missing_business_years_is_pending_not_fabricated_rejection():
    demand = DEMAND.model_copy(update={"business_years": None})
    out = match_products(demand, [product("P1", "5.2")])
    assert out.primary.product.product_code == "P1"
    assert out.primary.pending_conditions == ["需确认企业持续经营是否满1年"]


def test_missing_required_credential_is_rejected():
    out = match_products(DEMAND, [
        product("P1", "4.9", guarantees=["credit", "warehouse_receipt"], credentials=["warehouse_receipt"])
    ])
    assert out.primary is None
    assert "缺少必要凭证" in out.rejected[0].rejection_reasons[0]


def test_sort_is_stable_and_prefers_lower_cost_after_pending_count():
    products = [product("P1", "6.0"), product("P2", "5.2"), product("P3", "5.8")]
    a = match_products(DEMAND, products)
    b = match_products(DEMAND, list(reversed(products)))
    assert a.primary.product.product_code == b.primary.product.product_code == "P2"
    assert [x.product.product_code for x in a.backups] == ["P3", "P1"]
