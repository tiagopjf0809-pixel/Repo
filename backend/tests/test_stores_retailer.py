"""Tests for Lumi NEW endpoints: stores/map, reservations, price-alerts,
product tracking, retailer analytics.

Uses shared fixtures from conftest.py (auth_user, api_client, base_url).
"""
import uuid
import pytest


# ---------------------- Helpers ----------------------
@pytest.fixture(scope="module")
def fashion_product(api_client, base_url):
    """Fetch a real fashion product to use across tests."""
    r = api_client.get(f"{base_url}/api/products?limit=24")
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) > 0, "No fashion products available"
    # Prefer Zara if available, else first
    zara = next((p for p in items if p["brand"] == "Zara"), None)
    return zara or items[0]


@pytest.fixture(scope="module")
def all_stores(api_client, base_url):
    r = api_client.get(f"{base_url}/api/stores/nearby")
    assert r.status_code == 200
    return r.json()["stores"]


# ===================================================================
# Stores / Map
# ===================================================================
class TestStoresNearby:
    """GET /api/stores/nearby"""

    def test_nearby_no_product(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/stores/nearby")
        assert r.status_code == 200, r.text
        data = r.json()
        # Top-level fields
        assert "user_location" in data and "lat" in data["user_location"] and "lng" in data["user_location"]
        assert "city_center" in data and "lat" in data["city_center"]
        assert "stores" in data
        assert isinstance(data["stores"], list) and len(data["stores"]) > 0
        # No product_id was provided -> product should be None/null
        assert data.get("product") in (None, {}, ), f"Expected product=null when no product_id, got: {data.get('product')}"
        # Each store has required fields
        for s in data["stores"]:
            assert "id" in s and "name" in s and "brand" in s
            assert "distance_km" in s and isinstance(s["distance_km"], (int, float))
            assert s["in_stock"] is True, "Without product_id, all stores should be in_stock=True"
            assert isinstance(s["stock_count"], int)
            assert "is_partner" in s and isinstance(s["is_partner"], bool)
        # Partner flag accuracy
        partner_brands = {"Zara", "H&M", "Uniqlo"}
        for s in data["stores"]:
            assert s["is_partner"] == (s["brand"] in partner_brands)

    def test_nearby_with_valid_product(self, api_client, base_url, fashion_product):
        r = api_client.get(f"{base_url}/api/stores/nearby?product_id={fashion_product['id']}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["product"] is not None
        assert data["product"]["id"] == fashion_product["id"]
        stores = data["stores"]
        assert len(stores) > 0
        # Stores matching brand should be in_stock with price; others mostly out (cross-stock allowed for ~1/5)
        matching = [s for s in stores if s["brand"] == fashion_product["brand"]]
        non_matching = [s for s in stores if s["brand"] != fashion_product["brand"]]
        # ALL matching brand stores must be in_stock with a price
        for s in matching:
            assert s["in_stock"] is True, f"Same-brand store {s['name']} should be in_stock"
            assert s["price"] is not None and isinstance(s["price"], (int, float))
            assert s["price"] > 0
        # Most non-matching should be out of stock; price is None when not in stock
        out_of_stock = [s for s in non_matching if not s["in_stock"]]
        assert len(out_of_stock) >= len(non_matching) * 0.5, "Most non-brand stores should be out of stock"
        for s in non_matching:
            if not s["in_stock"]:
                assert s["price"] is None
                assert s["stock_count"] == 0

    def test_nearby_invalid_product_404(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/stores/nearby?product_id=does-not-exist-{uuid.uuid4()}")
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"

    def test_nearby_radius_filter(self, api_client, base_url):
        r_small = api_client.get(f"{base_url}/api/stores/nearby?radius_km=1")
        r_large = api_client.get(f"{base_url}/api/stores/nearby?radius_km=50")
        assert r_small.status_code == 200 and r_large.status_code == 200
        small = r_small.json()["stores"]
        large = r_large.json()["stores"]
        assert len(small) < len(large), f"radius=1 returned {len(small)} >= radius=50 {len(large)}"
        assert len(large) > 0

    def test_nearby_custom_lat_lng(self, api_client, base_url):
        # Use Times Square coords and tiny radius — should still return some nearby stores
        r = api_client.get(f"{base_url}/api/stores/nearby?lat=40.7559&lng=-73.9863&radius_km=2")
        assert r.status_code == 200
        data = r.json()
        assert data["user_location"]["lat"] == 40.7559
        assert data["user_location"]["lng"] == -73.9863

    def test_nearby_is_public(self, base_url):
        # No auth header — should still work
        import requests
        r = requests.get(f"{base_url}/api/stores/nearby")
        assert r.status_code == 200


# ===================================================================
# Reservations
# ===================================================================
class TestReservations:
    """POST /api/stores/{id}/reserve, GET /api/reservations"""

    def test_reserve_requires_auth(self, api_client, base_url, all_stores, fashion_product):
        store_id = all_stores[0]["id"]
        r = api_client.post(
            f"{base_url}/api/stores/{store_id}/reserve",
            json={"product_id": fashion_product["id"]},
        )
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"

    def test_reserve_valid(self, api_client, base_url, all_stores, fashion_product, auth_user):
        store = all_stores[0]
        r = api_client.post(
            f"{base_url}/api/stores/{store['id']}/reserve",
            json={"product_id": fashion_product["id"], "size": "M", "color": "black"},
            headers=auth_user["headers"],
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "reserved"
        assert "reservation_id" in data and data["reservation_id"]
        assert data["store_name"] == store["name"]
        assert "expires_at" in data and data["expires_at"]

    def test_reserve_invalid_store_404(self, api_client, base_url, fashion_product, auth_user):
        r = api_client.post(
            f"{base_url}/api/stores/invalid-store-id-xyz/reserve",
            json={"product_id": fashion_product["id"]},
            headers=auth_user["headers"],
        )
        assert r.status_code == 404

    def test_reserve_invalid_product_404(self, api_client, base_url, all_stores, auth_user):
        r = api_client.post(
            f"{base_url}/api/stores/{all_stores[0]['id']}/reserve",
            json={"product_id": f"bad-product-{uuid.uuid4()}"},
            headers=auth_user["headers"],
        )
        assert r.status_code == 404

    def test_list_reservations(self, api_client, base_url, auth_user):
        r = api_client.get(f"{base_url}/api/reservations", headers=auth_user["headers"])
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and isinstance(data["items"], list)
        # Should contain at least one from test_reserve_valid above
        assert len(data["items"]) >= 1
        first = data["items"][0]
        for f in ("id", "user_id", "store_id", "product_id", "status", "expires_at"):
            assert f in first

    def test_list_reservations_requires_auth(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/reservations")
        assert r.status_code in (401, 403)


# ===================================================================
# Price Alerts
# ===================================================================
class TestPriceAlerts:
    """CRUD for /api/price-alerts"""

    def test_create_requires_auth(self, api_client, base_url, fashion_product):
        r = api_client.post(
            f"{base_url}/api/price-alerts",
            json={"product_id": fashion_product["id"], "target_price": 10.0},
        )
        assert r.status_code in (401, 403)

    def test_list_requires_auth(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/price-alerts")
        assert r.status_code in (401, 403)

    def test_create_alert(self, api_client, base_url, fashion_product, auth_user):
        r = api_client.post(
            f"{base_url}/api/price-alerts",
            json={"product_id": fashion_product["id"], "target_price": 25.0},
            headers=auth_user["headers"],
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "created"
        assert "id" in data and data["id"]

    def test_repost_updates(self, api_client, base_url, fashion_product, auth_user):
        # Re-post for same product — should "update"
        r = api_client.post(
            f"{base_url}/api/price-alerts",
            json={"product_id": fashion_product["id"], "target_price": 30.0},
            headers=auth_user["headers"],
        )
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "updated"
        assert "id" in data

    def test_list_enriched(self, api_client, base_url, fashion_product, auth_user):
        r = api_client.get(f"{base_url}/api/price-alerts", headers=auth_user["headers"])
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 1
        match = next((a for a in items if a["product_id"] == fashion_product["id"]), None)
        assert match is not None
        assert "product" in match and match["product"]["id"] == fashion_product["id"]
        assert "current_price" in match and isinstance(match["current_price"], (int, float))
        assert "triggered" in match and isinstance(match["triggered"], bool)
        # target_price was 30 (updated), product price likely > 30 -> triggered should be False
        # Verify logic: triggered == (current_price <= target_price)
        assert match["triggered"] == (match["current_price"] <= match["target_price"])

    def test_delete_alert(self, api_client, base_url, fashion_product, auth_user):
        # First, list to grab the id
        r = api_client.get(f"{base_url}/api/price-alerts", headers=auth_user["headers"])
        items = r.json()["items"]
        alert = next((a for a in items if a["product_id"] == fashion_product["id"]), None)
        assert alert is not None
        alert_id = alert["id"]
        d = api_client.delete(
            f"{base_url}/api/price-alerts/{alert_id}",
            headers=auth_user["headers"],
        )
        assert d.status_code == 200
        assert d.json()["status"] == "removed"
        # Verify gone
        r2 = api_client.get(f"{base_url}/api/price-alerts", headers=auth_user["headers"])
        ids = [a["id"] for a in r2.json()["items"]]
        assert alert_id not in ids


# ===================================================================
# Product Tracking
# ===================================================================
class TestProductTracking:
    """POST /api/products/{id}/track"""

    def test_track_requires_auth(self, api_client, base_url, fashion_product):
        r = api_client.post(
            f"{base_url}/api/products/{fashion_product['id']}/track",
            json={"product_id": fashion_product["id"], "event": "view"},
        )
        assert r.status_code in (401, 403)

    def test_track_view(self, api_client, base_url, fashion_product, auth_user):
        r = api_client.post(
            f"{base_url}/api/products/{fashion_product['id']}/track",
            json={"product_id": fashion_product["id"], "event": "view"},
            headers=auth_user["headers"],
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "ok"

    def test_track_click(self, api_client, base_url, fashion_product, auth_user):
        r = api_client.post(
            f"{base_url}/api/products/{fashion_product['id']}/track",
            json={"product_id": fashion_product["id"], "event": "click"},
            headers=auth_user["headers"],
        )
        assert r.status_code == 200


# ===================================================================
# Retailer Analytics
# ===================================================================
class TestRetailer:
    """GET /api/retailer/brands, /api/retailer/{brand}/analytics"""

    def test_brands_public(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/retailer/brands")
        assert r.status_code == 200
        data = r.json()
        assert "brands" in data and isinstance(data["brands"], list)
        assert len(data["brands"]) > 0
        # Sorted
        assert data["brands"] == sorted(data["brands"])

    def test_analytics_unknown_404(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/retailer/SomeRandomBrandXYZ123/analytics")
        assert r.status_code == 404

    def test_analytics_valid(self, api_client, base_url):
        # First, find a real brand
        brands = api_client.get(f"{base_url}/api/retailer/brands").json()["brands"]
        brand = "Zara" if "Zara" in brands else brands[0]
        r = api_client.get(f"{base_url}/api/retailer/{brand}/analytics")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["brand"] == brand
        # Summary
        s = data["summary"]
        for key in ("products", "views", "clicks", "purchases", "wishlist_saves",
                    "cart_adds", "ctr_percent", "conversion_percent"):
            assert key in s, f"Missing summary key: {key}"
        assert s["products"] > 0
        assert isinstance(s["ctr_percent"], (int, float))
        assert isinstance(s["conversion_percent"], (int, float))
        # Top products
        assert "top_products" in data
        assert isinstance(data["top_products"], list)
        assert len(data["top_products"]) <= 6
        for p in data["top_products"]:
            for field in ("id", "name", "image", "views", "clicks", "wishlist_saves", "trending_score"):
                assert field in p, f"top_products missing {field}"
        # all_products
        assert "all_products" in data
        assert isinstance(data["all_products"], list)
        assert len(data["all_products"]) == s["products"]
        # style_compatibility
        assert "style_compatibility" in data
        assert isinstance(data["style_compatibility"], list)
        for sc in data["style_compatibility"]:
            assert "style" in sc and "products_count" in sc and "user_matches" in sc

    def test_analytics_is_public(self, base_url):
        import requests
        brands = requests.get(f"{base_url}/api/retailer/brands").json()["brands"]
        brand = brands[0]
        r = requests.get(f"{base_url}/api/retailer/{brand}/analytics")
        assert r.status_code == 200
