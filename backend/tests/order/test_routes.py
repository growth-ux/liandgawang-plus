def test_purchase_order_can_be_created_and_listed(client):
    created = client.post("/api/market-orders", json={
        "order_type": "grain_purchase",
        "title": "采购 玉米·二等 120 吨",
        "subject_ref": "LY-001",
        "summary": "北方粮贸 · 2380 元/吨（出厂价）",
        "payload": {"listing_code": "LY-001", "quantity_tons": 120},
    })
    assert created.status_code == 200
    data = created.json()
    assert data["status"] == "submitted"
    assert data["order_code"].startswith("CG")
    assert data["payload"]["quantity_tons"] == 120

    listed = client.get("/api/market-orders", params={"order_type": "grain_purchase"})
    assert listed.status_code == 200
    assert listed.json()["items"][0]["order_code"] == data["order_code"]

    # 同日第二张采购单单号递增
    second = client.post("/api/market-orders", json={
        "order_type": "grain_purchase", "title": "再采购一批",
    })
    assert second.json()["order_code"] > data["order_code"]


def test_transport_and_finance_orders_use_own_prefix(client):
    booking = client.post("/api/market-orders", json={
        "order_type": "transport_booking",
        "title": "绥化 → 潍坊 订舱 200 吨",
    })
    assert booking.json()["order_code"].startswith("YD")

    finance = client.post("/api/market-orders", json={
        "order_type": "finance_application",
        "title": "申请 采购周转贷 50 万",
    })
    assert finance.json()["order_code"].startswith("RZ")


def test_unknown_order_type_rejected(client):
    resp = client.post("/api/market-orders", json={
        "order_type": "unknown_type", "title": "非法单据",
    })
    assert resp.status_code == 400
