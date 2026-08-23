"""yun-v2 固定物流演示数据集：可组合线路网络与 500 条承运服务（幂等）。"""

from datetime import date
from math import ceil

from sqlalchemy.orm import Session

from app.logistics.models import LogisticsService, RouteSegment

MOCK_DATASET_VERSION = "yun-v2"
DATA_UPDATED_AT = "2026-08-23"
TODAY = date(2026, 8, 23)

# 产区编码、名称、到东北港口的基准里程、到深圳港的基准里程
ORIGINS = [
    ("HRB", "哈尔滨", 850, 3350),
    ("QQHE", "齐齐哈尔", 920, 3550),
    ("SUIHUA", "绥化", 760, 3280),
    ("CC", "长春", 620, 3050),
    ("BC", "白城", 540, 3100),
    ("SY", "松原", 680, 3150),
    ("TL", "通辽", 520, 2800),
    ("SYANG", "沈阳", 310, 2650),
    ("CF", "赤峰", 450, 2400),
    ("JMS", "佳木斯", 1250, 3650),
]

# 港口编码、名称、相对基准里程调整
NORTH_PORTS = [
    ("JZ", "锦州港", 0),
    ("BYQ", "鲅鱼圈港", 80),
    ("DL", "大连港", 170),
    ("QHD", "秦皇岛港", 230),
]

# 港口编码、名称、相对深圳方向里程调整
SOUTH_PORTS = [
    ("SH", "上海港", -700),
    ("NB", "宁波港", -560),
    ("QZ", "泉州港", -330),
    ("GZ", "广州港", -60),
    ("SZ", "深圳港", 0),
    ("ZJ", "湛江港", 180),
]

# 保留核心演示线路的既有口径，确保白城—深圳案例稳定。
CORE_SEGMENTS = [
    ("YUN-SEG-HRB-JZ-ROAD", "哈尔滨", "锦州港", "road", 880, 320, 360, 2, 3, "冬季需关注路面结冰"),
    ("YUN-SEG-CC-JZ-ROAD", "长春", "锦州港", "road", 620, 240, 280, 1, 2, ""),
    ("YUN-SEG-BC-JZ-ROAD", "白城", "锦州港", "road", 540, 210, 250, 1, 2, ""),
    ("YUN-SEG-BC-SZ-ROAD", "白城", "深圳港", "road", 3100, 1150, 1280, 3, 4, "整车直发，运价较高"),
    ("YUN-SEG-CC-JZ-RAIL", "长春", "锦州港", "rail", 620, 190, 230, 2, 3, "受车皮计划影响"),
    ("YUN-SEG-BC-SZ-RAIL", "白城", "深圳港", "rail", 3050, 500, 570, 5, 7, "受车皮计划影响"),
    ("YUN-SEG-HRB-SZ-RAIL", "哈尔滨", "深圳港", "rail", 3350, 540, 610, 6, 8, "时效波动较大"),
    ("YUN-SEG-JZ-SZ-WATER", "锦州港", "深圳港", "water", 1450, 95, 120, 6, 9, "受船期与天气影响"),
    ("YUN-SEG-JZ-GZ-WATER", "锦州港", "广州港", "water", 1380, 90, 115, 5, 8, "受船期与天气影响"),
    ("YUN-SEG-BYQ-SZ-WATER", "鲅鱼圈港", "深圳港", "water", 1460, 100, 125, 6, 9, "受船期与天气影响"),
]


def _append_segment(rows: list[tuple], seen: set[tuple], row: tuple) -> None:
    key = (row[1], row[2], row[3])
    if key not in seen:
        rows.append(row)
        seen.add(key)


def _build_segments() -> list[tuple]:
    """构建产区—北方港—南方港网络，并补充公路、铁路直达线路。"""
    rows = list(CORE_SEGMENTS)
    seen = {(row[1], row[2], row[3]) for row in rows}

    for origin_index, (origin_code, origin, feeder_km, south_km) in enumerate(ORIGINS):
        for port_index, (port_code, port, km_adjustment) in enumerate(NORTH_PORTS):
            km = max(260, feeder_km + km_adjustment + (origin_index % 3) * 15)
            road_low = round(km * 0.39)
            road_days = max(1, ceil(km / 520))
            _append_segment(
                rows,
                seen,
                (
                    f"YUN-SEG-{origin_code}-{port_code}-ROAD",
                    origin,
                    port,
                    "road",
                    km,
                    road_low,
                    road_low + 35 + port_index * 4,
                    road_days,
                    road_days + 1,
                    "冬季与高峰期需关注道路通行" if origin_index < 3 else "",
                ),
            )

            rail_low = round(km * 0.29)
            rail_days = max(2, ceil(km / 430))
            _append_segment(
                rows,
                seen,
                (
                    f"YUN-SEG-{origin_code}-{port_code}-RAIL",
                    origin,
                    port,
                    "rail",
                    km,
                    rail_low,
                    rail_low + 30 + port_index * 5,
                    rail_days,
                    rail_days + 1,
                    "受铁路装车计划影响",
                ),
            )

        for destination_index, (dest_code, destination, km_adjustment) in enumerate(SOUTH_PORTS):
            km = max(1700, south_km + km_adjustment + (origin_index % 2) * 25)
            road_low = round(km * 0.37)
            road_days = max(3, ceil(km / 850))
            _append_segment(
                rows,
                seen,
                (
                    f"YUN-SEG-{origin_code}-{dest_code}-ROAD",
                    origin,
                    destination,
                    "road",
                    km,
                    road_low,
                    road_low + 85 + destination_index * 8,
                    road_days,
                    road_days + 1,
                    "长途整车直发，需确认司机与车辆排期",
                ),
            )

            rail_low = round(km * 0.18)
            rail_days = max(4, ceil(km / 610))
            _append_segment(
                rows,
                seen,
                (
                    f"YUN-SEG-{origin_code}-{dest_code}-RAIL",
                    origin,
                    destination,
                    "rail",
                    km,
                    rail_low,
                    rail_low + 65 + destination_index * 6,
                    rail_days,
                    rail_days + 2,
                    "受班列计划与到站短驳衔接影响",
                ),
            )

    for north_index, (north_code, north_port, _) in enumerate(NORTH_PORTS):
        for south_index, (south_code, south_port, km_adjustment) in enumerate(SOUTH_PORTS):
            km = 1450 + km_adjustment + north_index * 45
            price_low = 95 + south_index * 5 + north_index * 3
            days_low = max(4, 6 + south_index // 2 - (1 if south_index < 2 else 0))
            _append_segment(
                rows,
                seen,
                (
                    f"YUN-SEG-{north_code}-{south_code}-WATER",
                    north_port,
                    south_port,
                    "water",
                    km,
                    price_low,
                    price_low + 25,
                    days_low,
                    days_low + 3,
                    "受船期、港口作业与沿海天气影响",
                ),
            )

    return rows


SEGMENTS = _build_segments()

ROAD_CARRIERS = [
    "粮达物流东北车队",
    "辽吉粮食运输合作社",
    "华粮干线物流",
    "丰达供应链",
    "北仓公路运输",
    "新程粮运",
    "安达货运",
    "中谷陆运",
    "金穗物流",
    "通达粮食运输",
    "黑吉辽联运",
    "北方粮贸物流",
]
RAIL_CARRIERS = [
    "东北铁路集装箱运输中心",
    "中北公铁联运",
    "华粮铁路物流",
    "北方陆港供应链",
    "中谷班列服务",
    "丰收铁路运输",
    "粮达公铁联运",
    "东北粮运班列",
]
WATER_CARRIERS = [
    "北洋航运内贸线",
    "北方港航船务",
    "中谷海运",
    "华粮沿海运输",
    "丰海航运",
    "粮达港航",
    "渤海粮运船务",
    "东海内贸航运",
]

VARIETY_OPTIONS = [
    "corn,wheat",
    "corn,soybean",
    "corn,wheat,soybean",
    "corn,wheat,soybean,rice",
]


def _service_profile(mode: str, index: int) -> tuple[str, int, int, str, str, str]:
    if mode == "road":
        carrier = ROAD_CARRIERS[index % len(ROAD_CARRIERS)]
        tonnage_min = 20 + (index % 3) * 10
        tonnage_max = 180 + (index % 7) * 40
        windows = ["每日发运", "隔日发运", "预约后24小时内发运", "预约后48小时内发运"]
        loading = "散粮自卸车" if index % 2 == 0 else "散粮/吨包"
        performance = f"近30天准点率{92 + index % 7}%"
    elif mode == "rail":
        carrier = RAIL_CARRIERS[index % len(RAIL_CARRIERS)]
        tonnage_min = 60 + (index % 3) * 60
        tonnage_max = 1800 + (index % 8) * 500
        windows = ["每周一、四装车", "每周二、五装车", "每周三、六装车", "按班列计划发运"]
        loading = "集装箱/散粮装车点"
        performance = f"近30天计划兑现率{88 + index % 10}%"
    else:
        carrier = WATER_CARRIERS[index % len(WATER_CARRIERS)]
        tonnage_min = 500 + (index % 4) * 500
        tonnage_max = 12000 + (index % 8) * 5000
        windows = ["每周一、五班期", "每周二、六班期", "每周三、日班期", "按船期滚动发运"]
        loading = "港口散粮装船"
        performance = f"近30天班期准点率{87 + index % 11}%"
    return carrier, tonnage_min, tonnage_max, windows[index % len(windows)], loading, performance


def _build_services() -> list[tuple]:
    """稳定生成 500 条服务；所有线路至少有两条可用承运服务。"""
    rows = []
    for index in range(500):
        segment = SEGMENTS[index % len(SEGMENTS)]
        carrier, tonnage_min, tonnage_max, window, loading, performance = _service_profile(
            segment[3], index
        )
        rows.append(
            (
                f"YUN-SVC-V2-{index + 1:04d}",
                carrier,
                segment[0],
                VARIETY_OPTIONS[index % len(VARIETY_OPTIONS)],
                tonnage_min,
                tonnage_max,
                window,
                loading,
                performance,
            )
        )
    return rows


ALL_SERVICES = _build_services()


def seed_logistics_mock_data(db: Session) -> None:
    """把受管的 YUN 数据同步为 v2；重复执行不会增加记录。"""
    expected_segments = {row[0]: row for row in SEGMENTS}
    expected_services = {row[0]: row for row in ALL_SERVICES}

    managed_services = {
        service.service_code: service
        for service in db.query(LogisticsService)
        .filter(LogisticsService.service_code.like("YUN-SVC-%"))
        .all()
    }
    for code, service in managed_services.items():
        if code not in expected_services:
            db.delete(service)

    managed_segments = {
        segment.segment_code: segment
        for segment in db.query(RouteSegment)
        .filter(RouteSegment.segment_code.like("YUN-SEG-%"))
        .all()
    }
    for code, segment in managed_segments.items():
        if code not in expected_segments:
            db.delete(segment)

    db.flush()

    for code, origin, destination, mode, km, price_low, price_high, days_low, days_high, risk in SEGMENTS:
        segment = managed_segments.get(code)
        if segment is None:
            segment = RouteSegment(segment_code=code)
            db.add(segment)
        segment.origin = origin
        segment.destination = destination
        segment.mode = mode
        segment.distance_km = km
        segment.price_low = price_low
        segment.price_high = price_high
        segment.days_low = days_low
        segment.days_high = days_high
        segment.risk_note = risk
        segment.data_updated_at = DATA_UPDATED_AT

    for code, carrier, segment_code, varieties, tonnage_min, tonnage_max, window, loading, performance in ALL_SERVICES:
        service = managed_services.get(code)
        if service is None:
            service = LogisticsService(service_code=code)
            db.add(service)
        service.carrier = carrier
        service.segment_code = segment_code
        service.varieties = varieties
        service.tonnage_min = tonnage_min
        service.tonnage_max = tonnage_max
        service.dispatch_window = window
        service.loading_note = loading
        service.performance_note = performance

    db.commit()
