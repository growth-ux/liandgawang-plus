from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Purpose = Literal["grain_purchase", "inventory_turnover", "receivable_turnover"]
SourceType = Literal["manual", "liang", "suan"]


class FinanceRequirement(BaseModel):
    purpose: Purpose
    amount_yuan: Decimal = Field(gt=0, le=100_000_000)
    duration_days: int = Field(ge=1, le=730)
    business_years: Decimal | None = Field(default=None, ge=0, le=100)
    guarantee_modes: list[str] | None = None
    credentials: list[str] | None = None
    source_type: SourceType = "manual"
    source_ref: str | None = Field(default=None, max_length=64)


class FinanceProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_code: str
    name: str
    institution_name: str
    category: str
    scenario: str
    min_amount_yuan: Decimal
    max_amount_yuan: Decimal
    min_days: int
    max_days: int
    annual_rate_pct: Decimal | None
    fee_note: str
    purposes: list[str]
    guarantee_modes: list[str]
    required_credentials: list[str]
    min_business_years: Decimal | None
    requirements: list[str]
    data_updated_at: str


class MatchCandidate(BaseModel):
    product: FinanceProductOut
    estimated_cost_yuan: Decimal | None
    matched_reasons: list[str]
    pending_conditions: list[str]
    rejection_reasons: list[str] = Field(default_factory=list)


class MatchPreview(BaseModel):
    requirement: FinanceRequirement
    primary: MatchCandidate | None
    backups: list[MatchCandidate]
    rejected: list[MatchCandidate]
    explanation: str = ""
