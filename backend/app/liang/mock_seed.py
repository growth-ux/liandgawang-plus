"""liang-v1 固定粮源数据集：覆盖主推、备选、低价等级不符、数量不足、字段缺失等场景。"""
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.liang.models import GrainListing

PRICE_DATE = date(2026, 8, 23)

# (listing_code, variety_code, variety_name, crop_year, origin_province, origin_city,
#  grade, price, price_type, available_quantity_tons, delivery_type,
#  earliest_ship_at, latest_ship_at, moisture_pct, test_weight_g_l, impurity_pct,
#  supplier_name, supplier_region)
LISTINGS = [
    ("LIANG-V1-001", "corn", "玉米", 2025, "黑龙江", "绥化", "二等", "2380", "出厂价",
     800, "散粮", date(2026, 8, 25), date(2026, 8, 28), "14.0", "686", "1.0",
     "北安粮贸", "黑龙江绥化"),
    ("LIANG-V1-002", "corn", "玉米", 2025, "吉林", "榆树", "二等", "2420", "出厂价",
     600, "散粮", date(2026, 8, 26), date(2026, 8, 30), "14.2", "685", "1.0",
     "榆树粮贸", "吉林榆树"),
    ("LIANG-V1-003", "corn", "玉米", 2025, "辽宁", "铁岭", "三等", "2280", "出厂价",
     900, "散粮", date(2026, 8, 24), date(2026, 8, 27), "14.5", "660", "1.5",
     "铁岭粮贸", "辽宁铁岭"),
    ("LIANG-V1-004", "corn", "玉米", 2025, "内蒙古", "通辽", "二等", "2350", "出厂价",
     100, "散粮", date(2026, 8, 25), date(2026, 8, 29), "14.0", "686", "1.0",
     "通辽粮贸", "内蒙古通辽"),
    ("LIANG-V1-005", "corn", "玉米", 2025, "吉林", "松原", "二等", "2390", "出厂价",
     500, "散粮", None, None, "14.1", "685", "1.0",
     "松原农贸", "吉林松原"),
    ("LIANG-V1-006", "corn", "玉米", 2024, "吉林", "四平", "二等", "2320", "出厂价",
     700, "散粮", date(2026, 8, 25), date(2026, 8, 28), "13.8", "688", "0.9",
     "四平粮贸", "吉林四平"),
    ("LIANG-V1-007", "corn", "玉米", 2025, "辽宁", "锦州港", "二等", "2480", "港口价",
     1500, "集装箱", date(2026, 8, 24), date(2026, 8, 26), "14.0", "687", "1.0",
     "锦州港粮贸", "辽宁锦州"),
    ("LIANG-V1-008", "corn", "玉米", 2025, "辽宁", "大连港", "二等", "2500", "港口价",
     1000, "散粮", date(2026, 8, 26), date(2026, 8, 30), "14.0", "686", "1.0",
     "大连港粮贸", "辽宁大连"),
    ("LIANG-V1-009", "wheat", "小麦", 2025, "河南", "新乡", "二等", "2490", "出厂价",
     600, "散粮", date(2026, 8, 27), date(2026, 9, 2), "12.5", "790", "0.8",
     "新乡面业", "河南新乡"),
    ("LIANG-V1-010", "wheat", "小麦", 2025, "山东", "德州", "一等", "2620", "到库价",
     400, "散粮", date(2026, 8, 26), date(2026, 8, 31), "12.8", "795", "0.7",
     "德州粮贸", "山东德州"),
    ("LIANG-V1-011", "soybean", "大豆", 2025, "黑龙江", "哈尔滨", "二等", "3980", "出厂价",
     300, "散粮", date(2026, 8, 28), date(2026, 9, 5), "12.0", None, "1.0",
     "哈尔滨粮贸", "黑龙江哈尔滨"),
    ("LIANG-V1-012", "soybean", "大豆", 2025, "黑龙江", "佳木斯", "三等", "3860", "出厂价",
     500, "散粮", date(2026, 8, 27), date(2026, 9, 3), "12.5", None, "1.2",
     "佳木斯粮贸", "黑龙江佳木斯"),
]


def _generated_listings() -> list[tuple]:
    """补齐到 200 条可筛选的真实感粮源挂牌，固定生成以保证演示可复现。"""
    sources = [
        ("corn", "玉米", "黑龙江", "齐齐哈尔", 2360, 14.0, 685),
        ("corn", "玉米", "吉林", "长春", 2390, 14.0, 685),
        ("corn", "玉米", "辽宁", "沈阳", 2420, 14.0, 685),
        ("wheat", "小麦", "河南", "周口", 2480, 12.5, 770),
        ("wheat", "小麦", "山东", "聊城", 2550, 12.5, 770),
        ("soybean", "大豆", "黑龙江", "绥化", 3920, 13.0, 680),
        ("soybean", "大豆", "内蒙古", "呼伦贝尔", 4010, 13.0, 680),
    ]
    suppliers = ["北方粮贸", "丰年粮食", "中粮东北", "华粮供应链", "金穗粮贸", "兴农仓储", "恒泰农产品", "嘉禾粮行"]
    grades = ["一等", "二等", "二等", "三等"]
    price_types = ["出厂价", "出厂价", "到库价", "港口价"]
    rows = []
    for number in range(13, 201):
        index = number - 13
        vcode, vname, province, city, base_price, moisture_std, weight_std = sources[index % len(sources)]
        grade = grades[index % len(grades)]
        price_type = price_types[index % len(price_types)]
        earliest = PRICE_DATE + timedelta(days=1 + index % 12)
        latest = earliest + timedelta(days=2 + index % 6)
        # 少量记录保留待补字段，供核验和筛选场景使用。
        missing_window = index % 17 == 0
        rows.append((
            f"LIANG-V1-{number:03d}", vcode, vname, 2025 if index % 5 else 2024,
            province, city, grade, str(base_price + (index * 17) % 260), price_type,
            180 + (index * 95) % 2200, "集装箱" if price_type == "港口价" else "散粮",
            None if missing_window else earliest, None if missing_window else latest,
            str(round(moisture_std + ((index % 8) - 3) * 0.15, 2)),
            str(int(weight_std + ((index % 9) - 4) * 3)),
            str(round(0.6 + (index % 7) * 0.15, 2)),
            f"{suppliers[index % len(suppliers)]}{province}{index // len(sources) + 1}部", f"{province}{city}",
        ))
    return rows


ALL_LISTINGS = [*LISTINGS, *_generated_listings()]


def seed_liang_mock_data(db: Session) -> None:
    """幂等写入 liang-v1 粮源，已存在的 listing_code 跳过。"""
    existing_codes = {code for (code,) in db.query(GrainListing.listing_code).all()}
    for row in ALL_LISTINGS:
        (
            code, vcode, vname, year, prov, city, grade, price, ptype, qty, dtype,
            early, late, moisture, tw, impurity, supplier, sregion,
        ) = row
        if code in existing_codes:
            continue
        db.add(
            GrainListing(
                listing_code=code,
                variety_code=vcode,
                variety_name=vname,
                crop_year=year,
                origin_province=prov,
                origin_city=city,
                grade=grade,
                price=Decimal(price),
                price_type=ptype,
                available_quantity_tons=qty,
                delivery_type=dtype,
                earliest_ship_at=early,
                latest_ship_at=late,
                moisture_pct=Decimal(moisture) if moisture else None,
                test_weight_g_l=Decimal(tw) if tw else None,
                impurity_pct=Decimal(impurity) if impurity else None,
                supplier_name=supplier,
                supplier_region=sregion,
            )
        )
    db.commit()
