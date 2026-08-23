"""yun-v1 固定物流演示数据集：粮贸主干线路段与承运服务（幂等）。"""

from datetime import date

from sqlalchemy.orm import Session

from app.logistics.models import LogisticsService, RouteSegment

MOCK_DATASET_VERSION = "yun-v1"
DATA_UPDATED_AT = "2026-08-22"
TODAY = date(2026, 8, 23)

# (code, 起点, 终点, 方式, 里程, 价低, 价高, 时效低, 时效高, 风险备注)
SEGMENTS = [
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

# (code, 承运方, 线路段, 品种, 吨位下限, 吨位上限, 发运窗口, 装卸条件, 履约摘要)
SERVICES = [
    ("YUN-SVC-HRB-JZ", "粮达物流东北车队", "YUN-SEG-HRB-JZ-ROAD", "corn,wheat,soybean,rice", 30, 300, "每日发运", "散粮自卸车", "近30天准点率96%"),
    ("YUN-SVC-CC-JZ", "粮达物流辽西车队", "YUN-SEG-CC-JZ-ROAD", "corn,wheat,soybean,rice", 30, 300, "每日发运", "散粮自卸车", "近30天准点率97%"),
    ("YUN-SVC-BC-JZ", "辽吉粮食运输合作社", "YUN-SEG-BC-JZ-ROAD", "corn,wheat", 30, 200, "隔日发运", "散粮自卸车", "近30天准点率94%"),
    ("YUN-SVC-BC-SZ", "粮达物流干线车队", "YUN-SEG-BC-SZ-ROAD", "corn,wheat,soybean,rice", 30, 150, "每周三、五", "散粮/吨包", "近30天准点率98%"),
    ("YUN-SVC-CC-JZ-R", "东北铁路集装箱运输中心", "YUN-SEG-CC-JZ-RAIL", "corn,wheat,soybean,rice", 60, 2000, "每周二、四装车", "集装箱/散粮装车点", "近30天计划兑现率92%"),
    ("YUN-SVC-BC-SZ-R", "东北铁路集装箱运输中心", "YUN-SEG-BC-SZ-RAIL", "corn,wheat", 60, 2000, "每周一、四装车", "集装箱/散粮装车点", "近30天计划兑现率90%"),
    ("YUN-SVC-HRB-SZ-R", "东北铁路集装箱运输中心", "YUN-SEG-HRB-SZ-RAIL", "corn,soybean", 60, 2000, "每周二装车", "集装箱/散粮装车点", "近30天计划兑现率88%"),
    ("YUN-SVC-JZ-SZ-W", "北洋航运内贸线", "YUN-SEG-JZ-SZ-WATER", "corn,wheat,soybean,rice", 500, 30000, "每周一、五班期", "港口散粮装船", "近30天班期准点率91%"),
    ("YUN-SVC-JZ-GZ-W", "北洋航运内贸线", "YUN-SEG-JZ-GZ-WATER", "corn,wheat,soybean,rice", 500, 30000, "每周三、六班期", "港口散粮装船", "近30天班期准点率93%"),
    ("YUN-SVC-BYQ-SZ-W", "北方港航船务", "YUN-SEG-BYQ-SZ-WATER", "corn,wheat", 500, 30000, "每周二、六班期", "港口散粮装船", "近30天班期准点率89%"),
]


def _generated_services() -> list[tuple]:
    """补齐到 200 条承运服务，覆盖现有主干线路的不同运力与发运安排。"""
    carriers = ["中北公铁联运", "粮运供应链", "华北仓配物流", "东北陆港运输", "安达货运", "丰收航运", "新程物流", "兴达铁路服务"]
    variety_options = ["corn,wheat", "corn,soybean", "corn,wheat,soybean", "corn,wheat,soybean,rice"]
    windows = ["每日发运", "隔日发运", "每周一、四装车", "每周二、五装车", "预约后48小时内发运"]
    loadings = ["散粮自卸车", "吨包集装箱", "散粮/吨包", "港口散粮装船"]
    rows = []
    for number in range(11, 201):
        index = number - 11
        segment = SEGMENTS[index % len(SEGMENTS)]
        carrier = carriers[index % len(carriers)]
        rows.append((
            f"YUN-SVC-V1-{number:03d}", f"{carrier}{index // len(carriers) + 1}号运力中心", segment[0],
            variety_options[index % len(variety_options)], 30 + (index % 5) * 20,
            300 + (index * 175) % 5000, windows[index % len(windows)], loadings[index % len(loadings)],
            f"近30天准点率{90 + index % 9}%",
        ))
    return rows


ALL_SERVICES = [*SERVICES, *_generated_services()]


def seed_logistics_mock_data(db: Session) -> None:
    expected_service_codes = {row[0] for row in ALL_SERVICES}
    # 清理早期版本遗留的 YUN-SVC-001 ～ YUN-SVC-050 Mock 服务，确保演示库稳定为 200 条。
    for service in db.query(LogisticsService).filter(LogisticsService.service_code.like("YUN-SVC-%")).all():
        if service.service_code not in expected_service_codes:
            db.delete(service)
    existing_segments = {code for (code,) in db.query(RouteSegment.segment_code).all()}
    for code, origin, dest, mode, km, pl, ph, dl, dh, risk in SEGMENTS:
        if code in existing_segments:
            continue
        db.add(RouteSegment(
            segment_code=code, origin=origin, destination=dest, mode=mode,
            distance_km=km, price_low=pl, price_high=ph, days_low=dl, days_high=dh,
            risk_note=risk, data_updated_at=DATA_UPDATED_AT,
        ))
    existing_services = {code for (code,) in db.query(LogisticsService.service_code).all()}
    for code, carrier, seg, varieties, tmin, tmax, window, loading, perf in ALL_SERVICES:
        if code in existing_services:
            continue
        db.add(LogisticsService(
            service_code=code, carrier=carrier, segment_code=seg, varieties=varieties,
            tonnage_min=tmin, tonnage_max=tmax, dispatch_window=window,
            loading_note=loading, performance_note=perf,
        ))
    db.commit()
