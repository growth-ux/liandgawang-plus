from app.liang.mock_seed import seed_liang_mock_data


def test_listings_ok(client, db_session):
    seed_liang_mock_data(db_session)
    resp = client.get("/api/liang/listings")
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 200


def test_listings_filter(client, db_session):
    seed_liang_mock_data(db_session)
    resp = client.get("/api/liang/listings?variety_name=玉米")
    assert resp.status_code == 200
    assert all(i["variety_name"] == "玉米" for i in resp.json()["items"])


def test_listing_detail_and_404(client, db_session):
    seed_liang_mock_data(db_session)
    resp = client.get("/api/liang/listings/1")
    assert resp.status_code == 200
    assert resp.json()["listing_code"] == "LIANG-V1-001"
    assert client.get("/api/liang/listings/99999").status_code == 404


def test_market_summary(client, db_session):
    seed_liang_mock_data(db_session)
    resp = client.get("/api/liang/market/summary")
    assert resp.status_code == 200
    body = resp.json()
    assert body["summary"]["total_listings"] == 200
    assert len(body["discoveries"]) >= 3
