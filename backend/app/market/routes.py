from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.market import repository
from app.market.metrics import build_summary
from app.market.mock_seed import MOCK_DATASET_VERSION, MOCK_GENERATED_AT, PRICE_DATE

router = APIRouter(prefix="/api/market", tags=["market"])

VARIETY_NAMES = {
    "corn": "玉米",
    "wheat": "小麦",
    "soybean": "大豆",
    "rice": "稻谷",
}


@router.get("/overview")
def get_overview(variety_code: str = "corn", db: Session = Depends(get_db)):
    """市场全景：某品种的全国库点现货价与指数。"""
    if variety_code not in VARIETY_NAMES:
        raise HTTPException(status_code=404, detail="品种不存在")
    spots = repository.list_spots(db, variety_code)
    return {
        "data_kind": "simulated",
        "mock_dataset_version": MOCK_DATASET_VERSION,
        "mock_generated_at": MOCK_GENERATED_AT.isoformat(),
        "variety_code": variety_code,
        "variety_name": VARIETY_NAMES[variety_code],
        "price_date": PRICE_DATE.isoformat(),
        "spots": [
            {
                "spot_code": s.spot_code,
                "region_name": s.region_name,
                "region_type": s.region_type,
                "quote_type": s.quote_type,
                "remark": s.remark,
                "lng": s.lng,
                "lat": s.lat,
                "price": str(s.price),
                "change_pct": str(s.change_pct),
                "last_year_price": str(s.last_year_price),
            }
            for s in spots
        ],
    }


@router.get("/price-series")
def get_price_series(
    variety_code: str, spot_code: str, db: Session = Depends(get_db)
):
    """品种行情：某库点的历史价格序列与摘要指标。"""
    if variety_code not in VARIETY_NAMES:
        raise HTTPException(status_code=404, detail="品种不存在")
    spot = repository.get_spot(db, variety_code, spot_code)
    if spot is None:
        raise HTTPException(status_code=404, detail="库点不存在")
    points = repository.get_price_series(db, spot_code)
    return {
        "data_kind": "simulated",
        "mock_dataset_version": MOCK_DATASET_VERSION,
        "mock_generated_at": MOCK_GENERATED_AT.isoformat(),
        "variety_code": variety_code,
        "variety_name": VARIETY_NAMES[variety_code],
        "spot": {
            "spot_code": spot.spot_code,
            "region_name": spot.region_name,
            "region_type": spot.region_type,
            "quote_type": spot.quote_type,
            "remark": spot.remark,
            "unit": "元/吨",
        },
        "points": [
            {"observed_date": p.observed_date.isoformat(), "price": str(p.price)}
            for p in points
        ],
        "summary": build_summary([p.price for p in points]),
    }
