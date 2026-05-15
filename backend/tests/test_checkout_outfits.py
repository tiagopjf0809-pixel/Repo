"""Tests for Lumi Checkout (Stripe demo) + Outfits (multi-product AI styling) features."""
import uuid
import pytest
import requests


# ---------------------- helpers ----------------------
def _signup(api_client, base_url):
    email = f"TEST_{uuid.uuid4().hex[:10]}@lumi.app"
    r = api_client.post(
        f"{base_url}/api/auth/signup",
        json={"email": email, "password": "lumipass123", "full_name": "TEST User"},
    )
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    data = r.json()
    return {
        "email": email,
        "token": data["access_token"],
        "headers": {"Authorization": f"Bearer {data['access_token']}",
                    "Content-Type": "application/json"},
        "user": data["user"],
    }


def _list_product_ids(base_url, n=3):
    r = requests.get(f"{base_url}/api/products?limit={n}")
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) >= n
    return [p["id"] for p in items[:n]]


# ---------------------- AUTH PROTECTION ----------------------
class TestAuthProtection:
    """All checkout/order/outfit endpoints must return 401 without token."""

    def test_checkout_session_post_requires_auth(self, base_url):
        r = requests.post(f"{base_url}/api/checkout/session", json={})
        assert r.status_code == 401

    def test_checkout_session_get_requires_auth(self, base_url):
        r = requests.get(f"{base_url}/api/checkout/session/demo_xyz")
        assert r.status_code == 401

    def test_orders_requires_auth(self, base_url):
        r = requests.get(f"{base_url}/api/orders")
        assert r.status_code == 401

    def test_outfits_list_requires_auth(self, base_url):
        r = requests.get(f"{base_url}/api/outfits")
        assert r.status_code == 401

    def test_outfits_create_requires_auth(self, base_url):
        r = requests.post(f"{base_url}/api/outfits", json={"name": "x", "product_ids": []})
        assert r.status_code == 401

    def test_outfits_style_requires_auth(self, base_url):
        r = requests.post(f"{base_url}/api/outfits/style", json={"product_ids": []})
        assert r.status_code == 401

    def test_outfits_add_to_cart_requires_auth(self, base_url):
        r = requests.post(f"{base_url}/api/outfits/abc/add-to-cart")
        assert r.status_code == 401

    def test_outfits_delete_requires_auth(self, base_url):
        r = requests.delete(f"{base_url}/api/outfits/abc")
        assert r.status_code == 401


# ---------------------- CHECKOUT ----------------------
class TestCheckout:
    """Stripe Checkout (DEMO mode fallback due to placeholder key)."""

    def test_empty_cart_returns_400(self, api_client, base_url):
        u = _signup(api_client, base_url)
        r = requests.post(f"{base_url}/api/checkout/session", json={}, headers=u["headers"])
        assert r.status_code == 400, f"expected 400 got {r.status_code} {r.text}"

    def test_create_session_with_items_returns_demo(self, api_client, base_url):
        u = _signup(api_client, base_url)
        pids = _list_product_ids(base_url, 2)
        # Add 2 items to cart
        for pid in pids:
            r = requests.post(f"{base_url}/api/cart",
                              json={"product_id": pid, "quantity": 1},
                              headers=u["headers"])
            assert r.status_code == 200
        r = requests.post(f"{base_url}/api/checkout/session", json={}, headers=u["headers"])
        assert r.status_code == 200, r.text
        data = r.json()
        assert "session_id" in data
        assert "url" in data
        assert "order_id" in data
        # placeholder key => demo mode true, session_id prefixed demo_
        assert data["demo_mode"] is True
        assert data["session_id"].startswith("demo_")
        # Verify pending order is in /api/orders
        r2 = requests.get(f"{base_url}/api/orders", headers=u["headers"])
        assert r2.status_code == 200
        orders = r2.json()["items"]
        match = [o for o in orders if o["id"] == data["order_id"]]
        assert len(match) == 1
        assert match[0]["status"] == "pending"
        assert match[0]["session_id"] == data["session_id"]

    def test_verify_demo_session_pays_and_clears_cart(self, api_client, base_url):
        u = _signup(api_client, base_url)
        pids = _list_product_ids(base_url, 2)
        for pid in pids:
            requests.post(f"{base_url}/api/cart",
                          json={"product_id": pid, "quantity": 1},
                          headers=u["headers"])
        create = requests.post(f"{base_url}/api/checkout/session", json={},
                               headers=u["headers"]).json()
        sid = create["session_id"]

        # Verify session
        v = requests.get(f"{base_url}/api/checkout/session/{sid}", headers=u["headers"])
        assert v.status_code == 200, v.text
        body = v.json()
        assert body["paid"] is True
        assert body["status"] == "completed"
        assert body.get("demo_mode") is True

        # Cart should be empty
        c = requests.get(f"{base_url}/api/cart", headers=u["headers"])
        assert c.status_code == 200
        assert c.json()["items"] == []

        # Order persisted as completed
        orders = requests.get(f"{base_url}/api/orders", headers=u["headers"]).json()["items"]
        assert any(o["session_id"] == sid and o["status"] == "completed" for o in orders)

    def test_verify_invalid_session_returns_404(self, api_client, base_url):
        u = _signup(api_client, base_url)
        # Use a demo_-prefixed but unknown id => order lookup miss => 404
        r = requests.get(f"{base_url}/api/checkout/session/demo_{uuid.uuid4()}",
                         headers=u["headers"])
        assert r.status_code == 404

    def test_other_user_cannot_verify_session(self, api_client, base_url):
        # User1 creates session
        u1 = _signup(api_client, base_url)
        pids = _list_product_ids(base_url, 1)
        requests.post(f"{base_url}/api/cart",
                      json={"product_id": pids[0], "quantity": 1},
                      headers=u1["headers"])
        create = requests.post(f"{base_url}/api/checkout/session", json={},
                               headers=u1["headers"]).json()
        sid = create["session_id"]
        # User2 tries to retrieve => 404 (acceptable per request spec) for demo
        u2 = _signup(api_client, base_url)
        r = requests.get(f"{base_url}/api/checkout/session/{sid}", headers=u2["headers"])
        assert r.status_code == 404, f"expected 404 (demo), got {r.status_code} {r.text}"

    def test_orders_sorted_desc(self, api_client, base_url):
        u = _signup(api_client, base_url)
        pids = _list_product_ids(base_url, 1)
        sids = []
        for _ in range(2):
            requests.post(f"{base_url}/api/cart",
                          json={"product_id": pids[0], "quantity": 1},
                          headers=u["headers"])
            d = requests.post(f"{base_url}/api/checkout/session", json={},
                              headers=u["headers"]).json()
            sids.append(d["session_id"])
        orders = requests.get(f"{base_url}/api/orders", headers=u["headers"]).json()["items"]
        assert len(orders) >= 2
        created_dates = [o["created_at"] for o in orders]
        assert created_dates == sorted(created_dates, reverse=True)


# ---------------------- OUTFITS ----------------------
class TestOutfits:
    """Build-an-outfit multi-product picker with AI styling."""

    def test_style_empty_returns_400(self, api_client, base_url):
        u = _signup(api_client, base_url)
        r = requests.post(f"{base_url}/api/outfits/style",
                          json={"product_ids": []}, headers=u["headers"])
        assert r.status_code == 400

    def test_style_invalid_ids_returns_404(self, api_client, base_url):
        u = _signup(api_client, base_url)
        r = requests.post(f"{base_url}/api/outfits/style",
                          json={"product_ids": ["nope-1", "nope-2"]},
                          headers=u["headers"])
        assert r.status_code == 404

    def test_style_returns_ai_text_and_products(self, api_client, base_url):
        u = _signup(api_client, base_url)
        pids = _list_product_ids(base_url, 3)
        r = requests.post(f"{base_url}/api/outfits/style",
                          json={"product_ids": pids, "occasion": "first date"},
                          headers=u["headers"], timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body.get("styling"), str) and len(body["styling"]) > 20
        assert len(body.get("products", [])) == 3
        assert body["total_price"] > 0
        assert body["occasion"] == "first date"

    def test_create_outfit(self, api_client, base_url):
        u = _signup(api_client, base_url)
        pids = _list_product_ids(base_url, 2)
        r = requests.post(f"{base_url}/api/outfits",
                          json={"name": "TEST_outfit", "product_ids": pids,
                                "occasion": "office"}, headers=u["headers"])
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "saved"
        assert "id" in body

    def test_create_outfit_empty_400(self, api_client, base_url):
        u = _signup(api_client, base_url)
        r = requests.post(f"{base_url}/api/outfits",
                          json={"name": "x", "product_ids": []}, headers=u["headers"])
        assert r.status_code == 400

    def test_list_outfits_enriched(self, api_client, base_url):
        u = _signup(api_client, base_url)
        pids = _list_product_ids(base_url, 2)
        requests.post(f"{base_url}/api/outfits",
                      json={"name": "TEST_listed", "product_ids": pids},
                      headers=u["headers"])
        r = requests.get(f"{base_url}/api/outfits", headers=u["headers"])
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 1
        first = items[0]
        assert "products" in first
        assert len(first["products"]) == 2
        assert first["total_price"] > 0

    def test_outfit_add_to_cart(self, api_client, base_url):
        u = _signup(api_client, base_url)
        pids = _list_product_ids(base_url, 2)
        create = requests.post(f"{base_url}/api/outfits",
                               json={"name": "TEST_cartit", "product_ids": pids},
                               headers=u["headers"]).json()
        r = requests.post(f"{base_url}/api/outfits/{create['id']}/add-to-cart",
                          headers=u["headers"])
        assert r.status_code == 200
        assert r.json()["added"] == 2
        cart = requests.get(f"{base_url}/api/cart", headers=u["headers"]).json()
        product_ids_in_cart = {it["product_id"] for it in cart["items"]}
        assert set(pids).issubset(product_ids_in_cart)

    def test_outfit_add_to_cart_invalid_id_404(self, api_client, base_url):
        u = _signup(api_client, base_url)
        r = requests.post(f"{base_url}/api/outfits/{uuid.uuid4()}/add-to-cart",
                          headers=u["headers"])
        assert r.status_code == 404

    def test_delete_outfit(self, api_client, base_url):
        u = _signup(api_client, base_url)
        pids = _list_product_ids(base_url, 2)
        c = requests.post(f"{base_url}/api/outfits",
                          json={"name": "TEST_del", "product_ids": pids},
                          headers=u["headers"]).json()
        r = requests.delete(f"{base_url}/api/outfits/{c['id']}", headers=u["headers"])
        assert r.status_code == 200
        assert r.json()["status"] == "removed"
        # Should not appear in list
        items = requests.get(f"{base_url}/api/outfits", headers=u["headers"]).json()["items"]
        assert all(o["id"] != c["id"] for o in items)
