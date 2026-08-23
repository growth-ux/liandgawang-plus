import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.market import repository
from app.market.metrics import compute_judgment, interpret_spot
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
    """市场全景：库点现货价 + AI 判断 + 事件 + 解读。"""
    if variety_code not in VARIETY_NAMES:
        raise HTTPException(status_code=404, detail="品种不存在")

    variety_name = VARIETY_NAMES[variety_code]
    spots = repository.list_spots(db, variety_code)
    events = repository.list_events(db, variety_code)

    # 确定性市场判断
    judgment = compute_judgment(spots, variety_name, events)

    # 事件序列化
    event_items = [
        {
            "event_code": e.event_code,
            "title": e.title,
            "summary": e.summary,
            "event_at": e.event_at.isoformat(),
            "impact_regions": json.loads(e.impact_regions),
            "direction": e.direction,
            "strength": e.strength,
            "duration_hint": e.duration_hint,
        }
        for e in events
    ]

    return {
        "data_kind": "simulated",
        "mock_dataset_version": MOCK_DATASET_VERSION,
        "mock_generated_at": MOCK_GENERATED_AT.isoformat(),
        "variety_code": variety_code,
        "variety_name": variety_name,
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
                "interpretation": interpret_spot(s.region_type, float(s.change_pct)),
            }
            for s in spots
        ],
        "events": event_items,
        "judgment": judgment,
    }
