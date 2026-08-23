"""zhan-v1 固定演示数据集：四品种各自独立的库点与价格（固定种子伪随机，幂等可复现）。"""

import math
import random
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.market.models import MarketEvent, MarketPriceSeries, MarketSpotPrice

MOCK_DATASET_VERSION = "zhan-v1"
CHINA_TZ = timezone(timedelta(hours=8))
MOCK_GENERATED_AT = datetime(2026, 8, 22, 10, 0, tzinfo=CHINA_TZ)
PRICE_DATE = date(2026, 8, 22)

SERIES_DAYS = 730

# 每品种日收益率漂移（仅最近约 120 天逐步显现）：玉米偏强、大豆偏弱、小麦/稻谷震荡
TREND_DRIFT = {
    "corn": 0.0006,
    "wheat": 0.0,
    "soybean": -0.0006,
    "rice": 0.0,
}

QUOTE_BY_TYPE = {"产区": "收购价", "港口": "平仓价", "销区": "到货价"}

# ---------- 关键事件（玉米 2多1空、小麦震荡、大豆偏弱、稻谷无事件） ----------
EVENTS = [
    {
        "event_code": "ZHAN-V1-EVT-CORN-01",
        "variety_code": "corn",
        "title": "东北临储拍卖底价连续两周上调",
        "summary": (
            "临储玉米拍卖底价较两周前累计上调 20 元/吨，成交率维持在 85% 以上，"
            "市场对产区供给偏紧的预期有所强化。"
        ),
        "event_at": datetime(2026, 8, 18, tzinfo=CHINA_TZ),
        "impact_regions": '["东北", "华北"]',
        "direction": "bullish",
        "strength": "moderate",
        "duration_hint": "2～3 周",
    },
    {
        "event_code": "ZHAN-V1-EVT-CORN-02",
        "variety_code": "corn",
        "title": "北方港口到货量持续偏低",
        "summary": (
            "锦州、鲅鱼圈等主要港口玉米日到货量低于同期均值约 30%，"
            "港口平仓价获得支撑，南北价差扩大。"
        ),
        "event_at": datetime(2026, 8, 20, tzinfo=CHINA_TZ),
        "impact_regions": '["港口", "销区"]',
        "direction": "bullish",
        "strength": "moderate",
        "duration_hint": "1～2 周",
    },
    {
        "event_code": "ZHAN-V1-EVT-CORN-03",
        "variety_code": "corn",
        "title": "进口玉米到港预期增加",
        "summary": (
            "据船期推算，未来 3～4 周南方港口进口玉米到港量将明显回升，"
            "可能对销区到货价形成一定压制。"
        ),
        "event_at": datetime(2026, 8, 15, tzinfo=CHINA_TZ),
        "impact_regions": '["广东", "福建", "港口"]',
        "direction": "bearish",
        "strength": "mild",
        "duration_hint": "3～4 周后显现",
    },
    {
        "event_code": "ZHAN-V1-EVT-WHEAT-01",
        "variety_code": "wheat",
        "title": "主产区新麦上市供应充足",
        "summary": (
            "河南、山东新季小麦集中上市，产区收购价整体平稳，"
            "局部小幅波动，供需基本平衡。"
        ),
        "event_at": datetime(2026, 8, 16, tzinfo=CHINA_TZ),
        "impact_regions": '["河南", "山东", "河北"]',
        "direction": "neutral",
        "strength": "mild",
        "duration_hint": "2～4 周",
    },
    {
        "event_code": "ZHAN-V1-EVT-SOYBEAN-01",
        "variety_code": "soybean",
        "title": "进口大豆集中到港，压榨利润收窄",
        "summary": (
            "8 月进口大豆到港量预计超 900 万吨，油厂开机率回升，"
            "豆粕供应增加，国产大豆价格承压。"
        ),
        "event_at": datetime(2026, 8, 19, tzinfo=CHINA_TZ),
        "impact_regions": '["东北", "港口"]',
        "direction": "bearish",
        "strength": "moderate",
        "duration_hint": "2～3 周",
    },
]

# 每品种：库点集合不同（体现品种产区分布）；价格/涨跌区间按产区/港口/销区分档。
# 价格链条遵循现货贸易逻辑：产区收购价 < 港口平仓价 < 销区到货价（销区含南北运费、损耗与贸易毛利）。
# 库点：(地点, 类型, 经度, 纬度)
VARIETIES = {
    "corn": {
        "name": "玉米",
        "producing": (2280, 2340),
        "port": (2400, 2480),
        "sale": (2490, 2610),
        "chg": (-0.6, 1.8),
        "spots": [
            ("黑龙江·绥化", "产区", 126.98, 46.63),
            ("吉林·长春", "产区", 125.32, 43.90),
            ("内蒙·通辽", "产区", 122.26, 43.65),
            ("辽宁·大连港", "港口", 121.62, 38.92),
            ("河北·石家庄", "产区", 114.51, 38.04),
            ("山东·潍坊", "销区", 119.16, 36.71),
            ("江苏·连云港", "港口", 119.22, 34.60),
            ("湖北·武汉", "销区", 114.30, 30.59),
            ("四川·成都", "销区", 104.07, 30.57),
            ("云南·昆明", "销区", 102.71, 25.05),
            ("广东·广州港", "港口", 113.60, 22.90),
            ("黑龙江·哈尔滨", "产区", 126.63, 45.80),
            ("黑龙江·齐齐哈尔", "产区", 123.92, 47.35),
            ("吉林·四平", "产区", 124.35, 43.17),
            ("吉林·松原", "产区", 124.83, 45.14),
            ("辽宁·锦州港", "港口", 121.15, 40.80),
            ("辽宁·鲅鱼圈港", "港口", 122.13, 40.26),
            ("河南·郑州", "销区", 113.65, 34.75),
            ("河南·新乡", "产区", 113.87, 35.30),
            ("山东·德州", "产区", 116.36, 37.44),
            ("山东·临沂", "销区", 118.35, 35.10),
            ("河北·衡水", "产区", 115.67, 37.74),
            ("山西·临汾", "产区", 111.52, 36.08),
            ("天津", "港口", 117.20, 39.08),
            ("江苏·徐州", "销区", 117.28, 34.26),
            ("江苏·南通", "销区", 120.89, 31.98),
            ("安徽·蚌埠", "产区", 117.36, 32.92),
            ("浙江·宁波港", "港口", 121.55, 29.87),
            ("上海", "港口", 121.47, 31.23),
            ("湖北·荆州", "销区", 112.24, 30.33),
            ("湖南·岳阳", "销区", 113.13, 29.36),
            ("江西·南昌", "销区", 115.86, 28.68),
            ("广东·深圳港", "港口", 114.06, 22.55),
            ("广西·南宁", "销区", 108.32, 22.82),
            ("福建·福州", "销区", 119.30, 26.08),
            ("海南·海口港", "港口", 110.35, 20.02),
            ("重庆", "销区", 106.55, 29.56),
            ("贵州·贵阳", "销区", 106.63, 26.65),
            ("云南·曲靖", "产区", 103.79, 25.49),
            ("陕西·西安", "销区", 108.94, 34.34),
            ("甘肃·兰州", "销区", 103.83, 36.06),
        ],
    },
    "wheat": {
        "name": "小麦",
        "producing": (2460, 2520),
        "port": (2600, 2680),
        "sale": (2690, 2810),
        "chg": (-0.6, 0.6),
        "spots": [
            ("河南·新乡", "产区", 113.87, 35.30),
            ("河南·周口", "产区", 113.60, 33.63),
            ("河南·驻马店", "产区", 114.02, 32.98),
            ("河南·商丘", "产区", 115.65, 34.44),
            ("山东·德州", "产区", 116.36, 37.44),
            ("山东·菏泽", "产区", 115.48, 35.23),
            ("山东·聊城", "产区", 115.99, 36.46),
            ("山东·济宁", "产区", 116.58, 35.41),
            ("河北·石家庄", "产区", 114.51, 38.04),
            ("河北·衡水", "产区", 115.67, 37.74),
            ("河北·邯郸", "产区", 114.54, 36.63),
            ("河北·邢台", "产区", 114.50, 37.06),
            ("安徽·宿州", "产区", 116.98, 33.65),
            ("安徽·阜阳", "产区", 115.81, 32.89),
            ("江苏·徐州", "产区", 117.28, 34.26),
            ("陕西·渭南", "产区", 109.51, 34.50),
            ("天津", "港口", 117.20, 39.08),
            ("山东·青岛港", "港口", 120.38, 36.07),
            ("江苏·连云港", "港口", 119.22, 34.60),
            ("河南·郑州", "销区", 113.65, 34.75),
            ("山东·济南", "销区", 117.12, 36.65),
            ("陕西·西安", "销区", 108.94, 34.34),
            ("湖北·武汉", "销区", 114.30, 30.59),
            ("四川·成都", "销区", 104.07, 30.57),
            ("重庆", "销区", 106.55, 29.56),
            ("广东·广州港", "销区", 113.60, 22.90),
            ("上海", "销区", 121.47, 31.23),
            ("北京", "销区", 116.41, 39.90),
            ("辽宁·沈阳", "销区", 123.43, 41.80),
            ("甘肃·兰州", "销区", 103.83, 36.06),
        ],
    },
    "soybean": {
        "name": "大豆",
        "producing": (3960, 4040),
        "port": (4080, 4160),
        "sale": (4170, 4290),
        "chg": (-1.4, 0.4),
        "spots": [
            ("黑龙江·哈尔滨", "产区", 126.63, 45.80),
            ("黑龙江·绥化", "产区", 126.98, 46.63),
            ("黑龙江·齐齐哈尔", "产区", 123.92, 47.35),
            ("黑龙江·佳木斯", "产区", 130.32, 46.80),
            ("黑龙江·牡丹江", "产区", 129.63, 44.55),
            ("黑龙江·黑河", "产区", 127.53, 50.25),
            ("黑龙江·双鸭山", "产区", 131.16, 46.65),
            ("吉林·长春", "产区", 125.32, 43.90),
            ("吉林·敦化", "产区", 128.23, 43.37),
            ("吉林·榆树", "产区", 126.53, 44.83),
            ("内蒙·呼伦贝尔", "产区", 119.76, 49.21),
            ("内蒙·兴安盟", "产区", 122.07, 46.08),
            ("内蒙·通辽", "产区", 122.26, 43.65),
            ("辽宁·大连港", "港口", 121.62, 38.92),
            ("辽宁·锦州港", "港口", 121.15, 40.80),
            ("辽宁·沈阳", "销区", 123.43, 41.80),
            ("北京", "销区", 116.41, 39.90),
            ("天津", "销区", 117.20, 39.08),
            ("山东·济南", "销区", 117.12, 36.65),
            ("河南·郑州", "销区", 113.65, 34.75),
            ("湖北·武汉", "销区", 114.30, 30.59),
            ("四川·成都", "销区", 104.07, 30.57),
            ("广东·广州港", "销区", 113.60, 22.90),
            ("上海", "销区", 121.47, 31.23),
            ("河北·石家庄", "销区", 114.51, 38.04),
            ("陕西·西安", "销区", 108.94, 34.34),
            ("湖南·长沙", "销区", 112.94, 28.23),
            ("浙江·杭州", "销区", 120.15, 30.28),
        ],
    },
    "rice": {
        "name": "稻谷",
        "producing": (2560, 2640),
        "port": (2680, 2760),
        "sale": (2770, 2890),
        "chg": (-0.35, 0.4),
        "spots": [
            ("黑龙江·哈尔滨", "产区", 126.63, 45.80),
            ("黑龙江·佳木斯", "产区", 130.32, 46.80),
            ("黑龙江·绥化", "产区", 126.98, 46.63),
            ("黑龙江·建三江", "产区", 132.70, 47.28),
            ("吉林·吉林市", "产区", 126.55, 43.84),
            ("吉林·松原", "产区", 124.83, 45.14),
            ("辽宁·盘锦", "产区", 122.07, 41.12),
            ("湖南·常德", "产区", 111.70, 29.03),
            ("湖南·益阳", "产区", 112.36, 28.55),
            ("湖南·岳阳", "产区", 113.13, 29.36),
            ("湖北·荆州", "产区", 112.24, 30.33),
            ("湖北·荆门", "产区", 112.20, 31.04),
            ("江西·南昌", "产区", 115.86, 28.68),
            ("江西·九江", "产区", 116.00, 29.71),
            ("安徽·合肥", "产区", 117.28, 31.86),
            ("安徽·滁州", "产区", 118.32, 32.30),
            ("江苏·盐城", "产区", 120.16, 33.35),
            ("江苏·泰州", "产区", 119.92, 32.46),
            ("辽宁·大连港", "港口", 121.62, 38.92),
            ("广东·广州港", "港口", 113.60, 22.90),
            ("上海港", "港口", 121.47, 31.23),
            ("湖北·武汉", "销区", 114.30, 30.59),
            ("湖南·长沙", "销区", 112.94, 28.23),
            ("四川·成都", "销区", 104.07, 30.57),
            ("重庆", "销区", 106.55, 29.56),
            ("广东·深圳港", "销区", 114.06, 22.55),
            ("浙江·杭州", "销区", 120.15, 30.28),
            ("云南·昆明", "销区", 102.71, 25.05),
            ("贵州·贵阳", "销区", 106.63, 26.65),
            ("广西·南宁", "销区", 108.32, 22.82),
            ("福建·福州", "销区", 119.30, 26.08),
            ("海南·海口港", "销区", 110.35, 20.02),
        ],
    },
}


def seed_zhan_mock_data(db: Session) -> None:
    """幂等写入 zhan-v1 库点现货价，已存在的 spot_code 跳过。

    价格在品种对应的产区/港口/销区区间内用固定种子伪随机生成，
    涨跌按品种趋势区间生成，去年同期由涨跌反推。固定种子保证每次启动结果一致。
    """
    for variety_code, data in VARIETIES.items():
        rng = random.Random(f"zhan-v1-{variety_code}")
        for i, (region_name, region_type, lng, lat) in enumerate(data["spots"], start=1):
            spot_code = f"ZHAN-V1-{variety_code.upper()}-{i:02d}"
            exists = (
                db.query(MarketSpotPrice.spot_code).filter_by(spot_code=spot_code).first()
            )
            if exists:
                continue
            lo, hi = {
                "产区": data["producing"],
                "港口": data["port"],
                "销区": data["sale"],
            }[region_type]
            price = rng.randint(lo, hi)
            chg = round(rng.uniform(*data["chg"]), 1)
            last = round(price / (1 + chg / 100))
            db.add(
                MarketSpotPrice(
                    spot_code=spot_code,
                    variety_code=variety_code,
                    variety_name=data["name"],
                    region_name=region_name,
                    region_type=region_type,
                    quote_type=QUOTE_BY_TYPE[region_type],
                    remark="一等集装箱" if region_type == "港口" else "二等散粮",
                    lng=lng,
                    lat=lat,
                    price=price,
                    change_pct=chg,
                    last_year_price=last,
                    price_date=PRICE_DATE,
                    data_kind="simulated",
                    mock_dataset_version=MOCK_DATASET_VERSION,
                    mock_generated_at=MOCK_GENERATED_AT,
                )
            )
    # 写入事件
    for evt in EVENTS:
        exists = (
            db.query(MarketEvent.event_code).filter_by(event_code=evt["event_code"]).first()
        )
        if exists:
            continue
        db.add(
            MarketEvent(
                event_code=evt["event_code"],
                variety_code=evt["variety_code"],
                title=evt["title"],
                summary=evt["summary"],
                event_at=evt["event_at"],
                impact_regions=evt["impact_regions"],
                direction=evt["direction"],
                strength=evt["strength"],
                duration_hint=evt["duration_hint"],
                data_kind="simulated",
                mock_dataset_version=MOCK_DATASET_VERSION,
                mock_generated_at=MOCK_GENERATED_AT,
            )
        )
    db.commit()
    seed_zhan_price_series(db)


def _generate_series(
    end_price: float, change_pct: float, drift: float, rng: random.Random
) -> list[int]:
    """回溯生成 2 年整数价格：末点=end_price，倒数第二天使日涨跌≈change_pct。

    早期由长/短周期波段主导（涨跌交替、有回调），最近约 120 天波段衰减、
    趋势逐步显现，让近期走势与品种方向一致。固定种子保证幂等。
    """
    n = SERIES_DAYS
    prices = [0] * n
    prices[-1] = round(end_price)
    prices[-2] = round(end_price / (1 + change_pct / 100))
    phase1 = rng.uniform(0, 2 * math.pi)
    phase2 = rng.uniform(0, 2 * math.pi)
    for i in range(n - 3, -1, -1):
        t = i / (n - 1)
        j = n - 1 - i  # 距末尾天数
        wave = 0.0009 * math.sin(2 * math.pi * 2 * t + phase1) + 0.0005 * math.sin(
            2 * math.pi * 8 * t + phase2
        )
        # 波段：早期全量、接近当前衰减到 0；趋势：仅最近约 120 天逐步显现
        fade_wave = min(1.0, j / 120.0)
        fade_drift = max(0.0, 1.0 - j / 120.0)
        noise = rng.uniform(-0.002, 0.002)
        daily_ret = drift * fade_drift + wave * fade_wave + noise
        prices[i] = round(prices[i + 1] / (1 + daily_ret))
    return prices


def seed_zhan_price_series(db: Session) -> None:
    """重建各库点 2 年历史价格序列：先清空旧序列，再按当前生成逻辑写入。

    末点与库点当前价一致、趋势随品种设定。清空重建确保生成逻辑或天数变更后
    无旧数据残留（避免新旧序列在接缝处跳变）。固定种子保证可复现。
    """
    db.query(MarketPriceSeries).delete(synchronize_session=False)
    db.expunge_all()
    rows_to_add = []
    for spot in db.query(MarketSpotPrice).all():
        rng = random.Random(f"zhan-v1-series-{spot.spot_code}")
        drift = TREND_DRIFT[spot.variety_code]
        prices = _generate_series(
            float(spot.price), float(spot.change_pct), drift, rng
        )
        for i, price in enumerate(prices):
            observed_date = PRICE_DATE - timedelta(days=SERIES_DAYS - 1 - i)
            series_code = (
                f"ZHAN-V1-SERIES-{spot.spot_code}-{observed_date.strftime('%Y%m%d')}"
            )
            rows_to_add.append(
                MarketPriceSeries(
                    series_code=series_code,
                    spot_code=spot.spot_code,
                    variety_code=spot.variety_code,
                    observed_date=observed_date,
                    price=price,
                    mock_generated_at=MOCK_GENERATED_AT,
                )
            )
    db.add_all(rows_to_add)
    db.commit()
