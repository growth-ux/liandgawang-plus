"""yun-v1 固定物流演示数据集：东北产区集港 → 北方港 → 南方销区的粮贸主干线路与承运服务（幂等）。"""

from datetime import date

from sqlalchemy.orm import Session

from app.logistics.models import LogisticsService, RouteSegment

MOCK_DATASET_VERSION = "yun-v1"
DATA_UPDATED_AT = "2026-08-22"
TODAY = date(2026, 8, 23)

# 线路段主数据：(起点, 终点, 方式, 里程, 价低, 价高, 时效低, 时效高, 风险备注)
# 覆盖三大方式：公路集港（产区→北方港）、铁路直达（产区→南方港）、水路海运（北方港→南方港）
SEGMENT_ROWS = [
    # ── 公路集港（road，东北产区 → 北方港）──
    ("哈尔滨", "锦州港", "road", 880, 320, 360, 2, 3, "冬季需关注路面结冰"),
    ("长春", "锦州港", "road", 620, 240, 280, 1, 2, ""),
    ("白城", "锦州港", "road", 540, 210, 250, 1, 2, ""),
    ("松原", "锦州港", "road", 500, 200, 240, 1, 2, ""),
    ("通辽", "锦州港", "road", 450, 190, 230, 1, 2, ""),
    ("齐齐哈尔", "锦州港", "road", 950, 340, 380, 2, 3, "东北秋收期运力紧张"),
    ("绥化", "锦州港", "road", 800, 300, 340, 2, 3, ""),
    ("佳木斯", "锦州港", "road", 1050, 380, 420, 2, 3, "长距离直发，运价偏高"),
    ("铁岭", "锦州港", "road", 300, 160, 200, 1, 2, ""),
    ("沈阳", "锦州港", "road", 250, 150, 190, 1, 2, ""),
    ("四平", "鲅鱼圈港", "road", 380, 180, 220, 1, 2, ""),
    ("长春", "鲅鱼圈港", "road", 500, 200, 240, 1, 2, ""),
    ("通辽", "鲅鱼圈港", "road", 420, 180, 220, 1, 2, ""),
    ("哈尔滨", "大连港", "road", 900, 340, 380, 2, 3, "冬季需关注路面结冰"),
    ("长春", "大连港", "road", 700, 280, 320, 1, 2, ""),
    ("四平", "大连港", "road", 500, 220, 260, 1, 2, ""),
    ("松原", "大连港", "road", 650, 260, 300, 1, 2, ""),
    ("白城", "营口港", "road", 500, 210, 250, 1, 2, ""),
    ("通辽", "营口港", "road", 400, 180, 220, 1, 2, ""),
    ("沈阳", "大连港", "road", 390, 170, 210, 1, 2, ""),
    ("齐齐哈尔", "大连港", "road", 1050, 380, 420, 2, 3, "东北秋收期运力紧张"),
    ("绥化", "大连港", "road", 900, 340, 380, 2, 3, ""),

    # ── 铁路直达（rail，东北产区 → 南方港）──
    ("哈尔滨", "深圳港", "rail", 3350, 540, 610, 6, 8, "时效波动较大"),
    ("长春", "深圳港", "rail", 3200, 510, 580, 5, 7, "受车皮计划影响"),
    ("白城", "深圳港", "rail", 3050, 500, 570, 5, 7, "受车皮计划影响"),
    ("通辽", "深圳港", "rail", 3000, 490, 560, 5, 7, ""),
    ("四平", "深圳港", "rail", 3100, 500, 570, 5, 7, "受车皮计划影响"),
    ("哈尔滨", "广州港", "rail", 3300, 530, 600, 6, 8, "时效波动较大"),
    ("长春", "广州港", "rail", 3150, 500, 570, 5, 7, ""),
    ("白城", "广州港", "rail", 3000, 495, 560, 5, 7, "受车皮计划影响"),
    ("白城", "上海港", "rail", 2800, 470, 530, 4, 6, ""),
    ("哈尔滨", "上海港", "rail", 3050, 500, 560, 5, 7, "受车皮计划影响"),
    ("长春", "上海港", "rail", 2950, 480, 540, 5, 6, ""),
    ("通辽", "宁波港", "rail", 2900, 480, 540, 5, 7, ""),
    ("哈尔滨", "南通港", "rail", 3000, 495, 555, 5, 7, ""),
    ("齐齐哈尔", "深圳港", "rail", 3450, 560, 630, 7, 9, "时效波动较大"),

    # ── 水路海运（water，北方港 → 南方港）──
    ("锦州港", "深圳港", "water", 1450, 95, 120, 6, 9, "受船期与天气影响"),
    ("鲅鱼圈港", "深圳港", "water", 1460, 100, 125, 6, 9, "受船期与天气影响"),
    ("大连港", "深圳港", "water", 1420, 98, 122, 6, 9, "受船期与天气影响"),
    ("营口港", "深圳港", "water", 1440, 97, 121, 6, 9, "受船期与天气影响"),
    ("锦州港", "广州港", "water", 1380, 90, 115, 5, 8, "受船期与天气影响"),
    ("大连港", "广州港", "water", 1350, 88, 112, 5, 8, "受船期与天气影响"),
    ("鲅鱼圈港", "广州港", "water", 1360, 90, 114, 5, 8, ""),
    ("营口港", "上海港", "water", 980, 70, 90, 4, 6, ""),
    ("大连港", "上海港", "water", 900, 65, 85, 4, 6, ""),
    ("丹东港", "上海港", "water", 850, 62, 80, 4, 6, ""),
    ("鲅鱼圈港", "宁波港", "water", 1100, 75, 95, 4, 7, "受船期与天气影响"),
    ("锦州港", "南通港", "water", 1200, 80, 100, 5, 7, ""),
    ("大连港", "宁波港", "water", 1050, 72, 90, 4, 6, ""),
    ("营口港", "南通港", "water", 1150, 78, 98, 5, 7, ""),

    # ── 公路直发（road，东北产区 → 南方港，长途急需/高值批次）──
    ("白城", "深圳港", "road", 3100, 1150, 1280, 3, 4, "长途直达，运价较高，适合急需到货"),
    ("哈尔滨", "深圳港", "road", 3450, 1260, 1400, 4, 5, "长途直达，运价较高"),
    ("长春", "深圳港", "road", 3300, 1210, 1350, 3, 4, "长途直达，运价较高"),
    ("通辽", "深圳港", "road", 3250, 1190, 1330, 3, 4, ""),
    ("白城", "广州港", "road", 3050, 1120, 1260, 3, 4, "长途直达，运价较高"),
    ("哈尔滨", "广州港", "road", 3400, 1240, 1380, 4, 5, ""),
]

# 承运方池：按方式区分，同一承运方服务多条线路（轮换分配）
ROAD_CARRIERS = [
    "粮达物流东北车队",
    "辽吉粮食运输合作社",
    "松嫩平原物流",
    "长白运力平台",
    "黑土地粮运",
    "北疆汽运联盟",
    "辽西粮食车队",
    "哈尔滨粮运集团",
]
RAIL_CARRIERS = [
    "东北铁路集装箱运输中心",
    "中铁集装箱东北分部",
    "哈尔滨铁路货运部",
    "沈阳铁路局货运中心",
]
WATER_CARRIERS = [
    "北洋航运内贸线",
    "北方港航船务",
    "华北海运公司",
    "远东内贸航运",
    "渤海湾船务",
]

# 发运窗口与装卸条件：按方式轮换
ROAD_WINDOWS = ["每日发运", "隔日发运", "每周三、五", "按需派车"]
RAIL_WINDOWS = ["每周二、四装车", "每周一、四装车", "每周二装车", "每周五装车"]
WATER_WINDOWS = ["每周一、五班期", "每周三、六班期", "每周二、六班期", "每周四班期"]
ROAD_LOADING = ["散粮自卸车", "散粮/吨包", "散粮挂车"]
RAIL_LOADING = ["集装箱/散粮装车点", "集装箱装车点", "散粮专用线"]
WATER_LOADING = ["港口散粮装船", "港口散粮码头", "港口件杂货码头"]
PERF_NOTES = [
    "近30天准点率96%",
    "近30天准点率97%",
    "近30天准点率94%",
    "近30天计划兑现率92%",
    "近30天班期准点率91%",
    "近30天准点率98%",
]

# 吨位区间与品种适配：按方式区分
MODE_TONNAGE = {"road": (30, 300), "rail": (60, 2000), "water": (500, 30000)}
# 部分承运方只做玉米/小麦（合作社、小船东），其余全品种
FULL_VARIETIES = "corn,wheat,soybean,rice"
LIMITED_VARIETIES = "corn,wheat"


def _carriers(mode: str) -> list[str]:
    if mode == "road":
        return ROAD_CARRIERS
    if mode == "rail":
        return RAIL_CARRIERS
    return WATER_CARRIERS


def _windows(mode: str) -> list[str]:
    if mode == "road":
        return ROAD_WINDOWS
    if mode == "rail":
        return RAIL_WINDOWS
    return WATER_WINDOWS


def _loading(mode: str) -> list[str]:
    if mode == "road":
        return ROAD_LOADING
    if mode == "rail":
        return RAIL_LOADING
    return WATER_LOADING


def seed_logistics_mock_data(db: Session) -> None:
    if db.query(RouteSegment).count() > 0:
        return

    carriers = _carriers("road") + _carriers("rail") + _carriers("water")
    # 统计每种方式当前序号，用于在各自池内轮换承运方/窗口/装卸条件
    mode_index: dict[str, int] = {}

    for i, (origin, dest, mode, km, pl, ph, dl, dh, risk) in enumerate(SEGMENT_ROWS, 1):
        seg_code = f"YUN-SEG-{mode.upper()}-{i:03d}"
        db.add(
            RouteSegment(
                segment_code=seg_code,
                origin=origin,
                destination=dest,
                mode=mode,
                distance_km=km,
                price_low=pl,
                price_high=ph,
                days_low=dl,
                days_high=dh,
                risk_note=risk,
                data_updated_at=DATA_UPDATED_AT,
            )
        )

        idx = mode_index.get(mode, 0)
        mode_index[mode] = idx + 1
        mode_carriers = _carriers(mode)
        carrier = mode_carriers[idx % len(mode_carriers)]
        window = _windows(mode)[idx % len(_windows(mode))]
        loading = _loading(mode)[idx % len(_loading(mode))]
        perf = PERF_NOTES[i % len(PERF_NOTES)]
        tmin, tmax = MODE_TONNAGE[mode]
        # 吨位上限在区间内按线路微调，避免完全一致
        tmax = tmax - (i % 5) * 50
        # 合作社/小船东只做玉米小麦（取 idx 能整除 3 的线路）
        varieties = LIMITED_VARIETIES if idx % 3 == 0 else FULL_VARIETIES

        db.add(
            LogisticsService(
                service_code=f"YUN-SVC-{i:03d}",
                carrier=carrier,
                segment_code=seg_code,
                varieties=varieties,
                tonnage_min=tmin,
                tonnage_max=tmax,
                dispatch_window=window,
                loading_note=loading,
                performance_note=perf,
            )
        )
    db.commit()
