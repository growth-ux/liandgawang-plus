from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

FieldSource = Literal["user", "liang", "yun", "qian"]
FieldStatus = Literal["confirmed", "pending", "estimated"]


class FieldMeta(BaseModel):
    source: FieldSource = "user"
    status: FieldStatus = "confirmed"
    note: str = ""


class SchemeDraft(BaseModel):
    scheme_id: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=128)
    variety_name: str | None = None
    quantity_tons: Decimal | None = Field(default=None, gt=0)
    purchase_price_yuan_per_ton: Decimal | None = Field(default=None, gt=0)
    tax_included: bool | None = None
    quality_discount_yuan_per_ton: Decimal | None = Field(default=None, ge=0)
    freight_yuan_per_ton: Decimal | None = Field(default=None, ge=0)
    loading_yuan_per_ton: Decimal | None = Field(default=None, ge=0)
    loss_rate_pct: Decimal | None = Field(default=None, ge=0, lt=100)
    financing_cost_yuan: Decimal | None = Field(default=None, ge=0)
    other_cost_yuan: Decimal | None = Field(default=None, ge=0)
    constraints_met: bool = True
    pending_items: list[str] = Field(default_factory=list)
    field_meta: dict[str, FieldMeta] = Field(default_factory=dict)


class SchemeInput(SchemeDraft):
    variety_name: str
    quantity_tons: Decimal = Field(gt=0)
    purchase_price_yuan_per_ton: Decimal = Field(gt=0)
    tax_included: bool
    quality_discount_yuan_per_ton: Decimal = Field(ge=0)
    freight_yuan_per_ton: Decimal = Field(ge=0)
    loading_yuan_per_ton: Decimal = Field(ge=0)
    loss_rate_pct: Decimal = Field(ge=0, lt=100)
    financing_cost_yuan: Decimal = Field(ge=0)
    other_cost_yuan: Decimal = Field(ge=0)


class CostBreakdown(BaseModel):
    purchase_yuan_per_ton: Decimal
    quality_yuan_per_ton: Decimal
    freight_yuan_per_ton: Decimal
    loading_yuan_per_ton: Decimal
    loss_impact_yuan_per_ton: Decimal
    financing_yuan_per_ton: Decimal
    other_yuan_per_ton: Decimal


class SchemeResult(BaseModel):
    scheme_id: str
    name: str
    eligible: bool
    total_cost_yuan: Decimal
    usable_quantity_tons: Decimal
    delivered_cost_yuan_per_ton: Decimal
    purchase_total_yuan: Decimal
    breakdown: CostBreakdown
    pending_items: list[str]


class CostDifference(BaseModel):
    scheme_id: str
    against_scheme_id: str
    delivered_cost_delta_yuan_per_ton: Decimal
    total_cost_delta_yuan: Decimal


class CostComparison(BaseModel):
    recommended_scheme_id: str | None
    results: list[SchemeResult]
    differences: list[CostDifference]
    contains_estimates: bool
    explanation: str = ""


class ProfitRequest(BaseModel):
    selling_price_yuan_per_ton: Decimal = Field(gt=0)
    sales_fulfillment_cost_yuan: Decimal = Field(default=Decimal("0"), ge=0)
    freight_yuan_per_ton: Decimal | None = Field(default=None, ge=0)
    loss_rate_pct: Decimal | None = Field(default=None, ge=0, lt=100)


class ProfitScenario(BaseModel):
    selling_price_yuan_per_ton: Decimal
    total_profit_yuan: Decimal
    profit_yuan_per_ton: Decimal
    margin_pct: Decimal
    break_even_price_yuan_per_ton: Decimal
    safety_space_yuan_per_ton: Decimal


class CalculateRequest(BaseModel):
    schemes: list[SchemeInput] = Field(min_length=1, max_length=3)


class SaveRecordRequest(BaseModel):
    title: str = Field(min_length=1, max_length=128)
    source_text: str = ""
    schemes: list[SchemeDraft] = Field(min_length=1, max_length=3)
    calculation: CostComparison | None = None
    selected_scheme_id: str | None = None


class AskRequest(BaseModel):
    tab: Literal["costing", "profit", "records"]
    question: str = Field(min_length=1, max_length=500)
    record_id: int | None = None


class ProfitQuestionRequest(BaseModel):
    baseline_selling_price_yuan_per_ton: Decimal = Field(gt=0)
    sales_fulfillment_cost_yuan: Decimal = Field(default=Decimal("0"), ge=0)
    question: str = Field(min_length=1, max_length=500)
