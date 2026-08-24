"""粮掌柜主演示候选数据：三个粮源、两批运输与履约证据。

内部保留数据集版本用于测试与复现；输出到页面时只保留业务来源标签。
"""

from datetime import date

DEMO_DATASET_VERSION = "zhanggui-demo-v1"

# 主演示的统一“今天”，保证履约证据新鲜度判断可复现
DEMO_TODAY = date(2026, 8, 24)

# 集港发运口径：两个候选粮源都经锦州港发运
DEMO_TRANSPORT_ORIGIN = "锦州港"

# 供应方履约证据（近半年交付记录）
FULFILLMENT_EVIDENCE = {
    "SUP-A": {
        "supplier_code": "SUP-A",
        "supplier_name": "北安粮贸",
        "max_single_delivery_tons": 80,
        "last_delivery_evidence_at": "2026-06-12",
        "evidence_note": "近半年仅有一笔 80 吨交付凭证",
    },
    "SUP-B": {
        "supplier_code": "SUP-B",
        "supplier_name": "锦州港粮贸",
        "max_single_delivery_tons": 500,
        "last_delivery_evidence_at": "2026-08-14",
        "evidence_note": "本月刚完成 500 吨交付，凭证在有效期内",
    },
}

# 三个候选粮源：主推组合中的 A、B 与因等级不符被淘汰的 C
DEMO_LISTINGS = [
    {
        "id": 1,
        "listing_code": "ZG-DEMO-A",
        "supplier_code": "SUP-A",
        "variety_code": "corn",
        "variety_name": "玉米",
        "grade": "二等",
        "crop_year": 2025,
        "origin_province": "黑龙江",
        "origin_city": "绥化",
        "supplier_name": "北安粮贸",
        "supplier_region": "黑龙江绥化",
        "price": "2380",
        "price_type": "出厂价",
        "available_quantity_tons": 300,
        "delivery_type": "散粮",
        "earliest_ship_at": "2026-08-26",
        "latest_ship_at": "2026-09-02",
        "moisture_pct": "14.0",
        "test_weight_g_l": "686",
        "impurity_pct": "1.0",
    },
    {
        "id": 2,
        "listing_code": "ZG-DEMO-B",
        "supplier_code": "SUP-B",
        "variety_code": "corn",
        "variety_name": "玉米",
        "grade": "二等",
        "crop_year": 2025,
        "origin_province": "辽宁",
        "origin_city": "锦州",
        "supplier_name": "锦州港粮贸",
        "supplier_region": "辽宁锦州",
        "price": "2398",
        "price_type": "港口价",
        "available_quantity_tons": 500,
        "delivery_type": "散粮",
        "earliest_ship_at": "2026-08-25",
        "latest_ship_at": "2026-08-31",
        "moisture_pct": "14.0",
        "test_weight_g_l": "687",
        "impurity_pct": "1.0",
    },
    {
        "id": 3,
        "listing_code": "ZG-DEMO-C",
        "supplier_code": "SUP-C",
        "variety_code": "corn",
        "variety_name": "玉米",
        "grade": "三等",
        "crop_year": 2025,
        "origin_province": "辽宁",
        "origin_city": "铁岭",
        "supplier_name": "铁岭粮贸",
        "supplier_region": "辽宁铁岭",
        "price": "2280",
        "price_type": "出厂价",
        "available_quantity_tons": 900,
        "delivery_type": "散粮",
        "earliest_ship_at": "2026-08-25",
        "latest_ship_at": "2026-08-30",
        "moisture_pct": "14.5",
        "test_weight_g_l": "660",
        "impurity_pct": "1.5",
    },
]

# 到厂运输兜底线路：锦州港集港后到厂（数据库中无对应线路时使用）
DEMO_SEGMENT_ROWS = [
    # (segment_code, 起点, 终点, 方式, 里程, 价低, 价高, 时效低, 时效高, 风险备注)
    ("ZG-SEG-01", "锦州港", "潍坊", "road", 650, 105, 125, 2, 3, ""),
    ("ZG-SEG-02", "锦州港", "龙口港", "road", 480, 45, 55, 1, 2, ""),
    ("ZG-SEG-03", "龙口港", "潍坊", "water", 160, 30, 45, 2, 3, "小型散货船排期需提前确认"),
]

DEMO_SERVICE_ROWS = [
    # (service_code, 承运方, segment_code, 品种, 吨位下限, 吨位上限)
    ("ZG-SVC-01", "辽潍干线车队", "ZG-SEG-01", "corn,wheat,soybean,rice", 30, 150),
    ("ZG-SVC-02", "环渤海集港车队", "ZG-SEG-02", "corn,wheat,soybean,rice", 30, 150),
    ("ZG-SVC-03", "龙口近海航运", "ZG-SEG-03", "corn,wheat,soybean,rice", 50, 120),
]

# 综合成本口径常量（两方案共用，保证差额只来自采购价）
DEMO_LOADING_YUAN_PER_TON = "8"
DEMO_LOSS_RATE_PCT = "0.3"
DEMO_BATCH_SPLIT = [("第一批", "120"), ("第二批", "80")]

# 钱小二兜底产品（测试库中未种金融产品时使用）
DEMO_FINANCE_PRODUCT = {
    "id": 0,
    "product_code": "ZG-FIN-PW-01",
    "name": "粮采周转贷",
    "institution_name": "谷穗金融服务中心",
    "category": "purchase_working",
    "scenario": "粮食采购周转资金短期周转",
    "min_amount_yuan": 100_000,
    "max_amount_yuan": 1_000_000,
    "min_days": 15,
    "max_days": 90,
    "annual_rate_pct": "5.200",
    "fee_note": "无额外服务费，提前还款无违约金",
    "purposes": ["grain_purchase"],
    "guarantee_modes": ["credit", "guarantee"],
    "required_credentials": ["purchase_contract"],
    "min_business_years": "1.0",
    "requirements": ["企业持续经营满1年", "具有真实粮食采购合同"],
    "data_updated_at": DEMO_TODAY.isoformat(),
}
