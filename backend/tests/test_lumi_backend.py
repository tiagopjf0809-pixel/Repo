"""End-to-end backend tests for Lumi API."""
import uuid
import time
import pytest


# ---------------- Health ----------------
def test_health(api_client, base_url):
    r = api_client.get(f"{base_url}/api/")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------------- Auth ----------------
class TestAuth:
    def test_signup_valid(self, api_client, base_url):
        email = f"TEST_{uuid.uuid4().hex[:10]}@lumi.app"
        r = api_client.post(f"{base_url}/api/auth/signup",
                            json={"email": email, "password": "secret123", "full_name": "Test"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data
        assert data["user"]["email"] == email.lower()
        assert data["user"].get("style_identity") is None

    def test_signup_duplicate(self, api_client, base_url, auth_user):
        r = api_client.post(f"{base_url}/api/auth/signup",
                            json={"email": auth_user["email"], "password": "secret123"})
        assert r.status_code == 409

    def test_signup_weak_password(self, api_client, base_url):
        email = f"TEST_{uuid.uuid4().hex[:8]}@lumi.app"
        r = api_client.post(f"{base_url}/api/auth/signup",
                            json={"email": email, "password": "abc"})
        assert r.status_code == 400

    def test_login_valid(self, api_client, base_url, auth_user):
        r = api_client.post(f"{base_url}/api/auth/login",
                            json={"email": auth_user["email"], "password": auth_user["password"]})
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_login_wrong_password(self, api_client, base_url, auth_user):
        r = api_client.post(f"{base_url}/api/auth/login",
                            json={"email": auth_user["email"], "password": "wrongpass"})
        assert r.status_code == 401

    def test_me_with_jwt(self, api_client, base_url, auth_user):
        r = api_client.get(f"{base_url}/api/auth/me", headers=auth_user["headers"])
        assert r.status_code == 200
        assert r.json()["email"] == auth_user["email"].lower()
        assert "password" not in r.json()

    def test_me_without_jwt(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401


# ---------------- Products (fashion) ----------------
class TestProducts:
    def test_list_no_filters(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/products")
        assert r.status_code == 200
        data = r.json()
        assert data["total"] > 0
        assert len(data["items"]) > 0
        assert "_id" not in data["items"][0]

    @pytest.mark.parametrize("params,key,val", [
        ({"style": "streetwear"}, "style", "streetwear"),
        ({"brand": "Zara"}, "brand", "Zara"),
        ({"color": "black"}, None, None),
        ({"size": "M"}, None, None),
        ({"sustainable": "true"}, "sustainable", True),
        ({"budget": "$100+"}, "budget_category", "$100+"),
    ])
    def test_list_with_filter(self, api_client, base_url, params, key, val):
        r = api_client.get(f"{base_url}/api/products", params=params)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["total"] >= 0
        if data["items"] and key:
            for item in data["items"]:
                assert item[key] == val
        if params.get("color") and data["items"]:
            for item in data["items"]:
                assert "black" in item["colors"]
        if params.get("size") and data["items"]:
            for item in data["items"]:
                assert "M" in item["sizes"]

    def test_filters(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/products/filters")
        assert r.status_code == 200
        d = r.json()
        for k in ("brands", "styles", "colors", "sizes", "budgets"):
            assert k in d and isinstance(d[k], list) and len(d[k]) > 0

    def test_get_product_valid_and_404(self, api_client, base_url):
        listing = api_client.get(f"{base_url}/api/products", params={"limit": 1}).json()
        pid = listing["items"][0]["id"]
        r = api_client.get(f"{base_url}/api/products/{pid}")
        assert r.status_code == 200
        assert r.json()["id"] == pid

        r2 = api_client.get(f"{base_url}/api/products/does-not-exist")
        assert r2.status_code == 404

    def test_similar(self, api_client, base_url):
        listing = api_client.get(f"{base_url}/api/products", params={"limit": 1}).json()
        pid = listing["items"][0]["id"]
        style = listing["items"][0]["style"]
        r = api_client.get(f"{base_url}/api/products/{pid}/similar")
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) <= 8
        for it in items:
            assert it["style"] == style
            assert it["id"] != pid


# ---------------- Beauty ----------------
class TestBeauty:
    def test_list_all(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/beauty/products")
        assert r.status_code == 200
        assert len(r.json()["items"]) > 0

    def test_list_foundation(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/beauty/products", params={"category": "foundation"})
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) > 0
        for it in items:
            assert it["category"] == "foundation"


# ---------------- Wishlist ----------------
class TestWishlist:
    def test_full_flow(self, api_client, base_url, auth_user):
        h = auth_user["headers"]
        pid = api_client.get(f"{base_url}/api/products", params={"limit": 1}).json()["items"][0]["id"]
        # add
        r = api_client.post(f"{base_url}/api/wishlist", json={"product_id": pid}, headers=h)
        assert r.status_code == 200 and r.json()["status"] == "added"
        # idempotent
        r2 = api_client.post(f"{base_url}/api/wishlist", json={"product_id": pid}, headers=h)
        assert r2.json()["status"] == "already_added"
        # list (enriched)
        rl = api_client.get(f"{base_url}/api/wishlist", headers=h)
        assert rl.status_code == 200
        ids = [p["id"] for p in rl.json()["items"]]
        assert pid in ids
        # remove
        rd = api_client.delete(f"{base_url}/api/wishlist/{pid}", headers=h)
        assert rd.status_code == 200
        rl2 = api_client.get(f"{base_url}/api/wishlist", headers=h)
        assert pid not in [p["id"] for p in rl2.json()["items"]]


# ---------------- Cart ----------------
class TestCart:
    def test_full_flow(self, api_client, base_url, auth_user):
        h = auth_user["headers"]
        prods = api_client.get(f"{base_url}/api/products", params={"limit": 2}).json()["items"]
        p1, p2 = prods[0], prods[1]
        # add 2 items
        api_client.post(f"{base_url}/api/cart",
                        json={"product_id": p1["id"], "size": "M", "color": "black", "quantity": 1},
                        headers=h)
        api_client.post(f"{base_url}/api/cart",
                        json={"product_id": p2["id"], "quantity": 2},
                        headers=h)
        # GET enriched
        rg = api_client.get(f"{base_url}/api/cart", headers=h)
        assert rg.status_code == 200
        body = rg.json()
        assert len(body["items"]) >= 2
        expected = 0.0
        for it in body["items"]:
            assert "product" in it and "line_total" in it
            assert it["line_total"] == round(it["product"]["price"] * it["quantity"], 2)
            expected += it["line_total"]
        assert abs(body["subtotal"] - round(expected, 2)) < 0.05

        # Update qty
        item = body["items"][0]
        ru = api_client.patch(f"{base_url}/api/cart/{item['id']}",
                              json={"quantity": 5}, headers=h)
        assert ru.status_code == 200
        rg2 = api_client.get(f"{base_url}/api/cart", headers=h)
        updated = [i for i in rg2.json()["items"] if i["id"] == item["id"]][0]
        assert updated["quantity"] == 5

        # qty=0 removes
        r0 = api_client.patch(f"{base_url}/api/cart/{item['id']}",
                              json={"quantity": 0}, headers=h)
        assert r0.json()["status"] == "removed"
        rg3 = api_client.get(f"{base_url}/api/cart", headers=h).json()
        assert item["id"] not in [i["id"] for i in rg3["items"]]

        # DELETE remaining
        remaining = rg3["items"]
        if remaining:
            rd = api_client.delete(f"{base_url}/api/cart/{remaining[0]['id']}", headers=h)
            assert rd.status_code == 200


# ---------------- Style Quiz ----------------
class TestStyle:
    VALID_IDENTITIES = {"Minimalist", "Quiet Luxury", "Streetwear", "Old Money", "Vintage", "Athleisure"}

    def test_quiz_streetwear(self, api_client, base_url, auth_user):
        payload = {
            "colors": ["black", "grey"],
            "fit": "oversized",
            "inspiration": ["streetwear", "urban"],
            "budget": "$50-$100",
            "lifestyle": "student",
        }
        r = api_client.post(f"{base_url}/api/style/quiz", json=payload, headers=auth_user["headers"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["identity"] in self.VALID_IDENTITIES
        assert d["identity"] == "Streetwear"
        assert "filter_style" in d
        assert "suggested_products" in d and isinstance(d["suggested_products"], list)

        # Verify persisted on user
        prof = api_client.get(f"{base_url}/api/style/profile", headers=auth_user["headers"]).json()
        assert prof["style_identity"] == "Streetwear"

    def test_quiz_minimalist(self, api_client, base_url):
        # fresh user for variety
        email = f"TEST_{uuid.uuid4().hex[:10]}@lumi.app"
        sig = api_client.post(f"{base_url}/api/auth/signup",
                              json={"email": email, "password": "lumipass123"}).json()
        h = {"Authorization": f"Bearer {sig['access_token']}"}
        payload = {
            "colors": ["white", "beige"],
            "fit": "fitted",
            "inspiration": ["minimal", "clean"],
            "budget": "$100+",
            "lifestyle": "corporate",
        }
        r = api_client.post(f"{base_url}/api/style/quiz", json=payload, headers=h)
        assert r.status_code == 200
        assert r.json()["identity"] == "Minimalist"


# ---------------- Face Scan (LLM) ----------------
class TestFaceScan:
    VALID_TONES = {"fair", "light", "medium", "tan", "deep"}
    VALID_UNDERTONES = {"cool", "neutral", "warm"}
    VALID_SKIN_TYPES = {"dry", "oily", "combination", "normal"}
    VALID_FACE_SHAPES = {"oval", "round", "square", "heart", "long", "diamond"}

    def test_face_scan_and_latest(self, api_client, base_url, auth_user, face_jpeg_b64):
        r = api_client.post(
            f"{base_url}/api/beauty/face-scan",
            json={"image_base64": face_jpeg_b64},
            headers=auth_user["headers"],
            timeout=120,
        )
        assert r.status_code == 200, f"face-scan failed: {r.status_code} {r.text[:300]}"
        d = r.json()
        assert "id" in d
        a = d["analysis"]
        assert a["skin_tone"] in self.VALID_TONES
        assert a["undertone"] in self.VALID_UNDERTONES
        assert a["skin_type"] in self.VALID_SKIN_TYPES
        assert a["face_shape"] in self.VALID_FACE_SHAPES
        for key in ("under_eye_tone", "lip_shape", "eye_shape"):
            assert key in a and isinstance(a[key], str) and len(a[key]) > 0
        recs = d["recommendations"]
        for cat in ("foundation", "concealer", "blush", "contour", "lip", "eye"):
            assert cat in recs, f"missing recommendation category: {cat}"
            assert isinstance(recs[cat], list)
            assert len(recs[cat]) > 0, f"no products for {cat}"
            for p in recs[cat]:
                assert p["category"] == cat

        # latest
        rl = api_client.get(f"{base_url}/api/beauty/face-scan/latest", headers=auth_user["headers"])
        assert rl.status_code == 200
        body = rl.json()
        assert body.get("id") == d["id"]


# ---------------- Stylist Chat (LLM) ----------------
class TestStylist:
    def test_chat_flow(self, api_client, base_url, auth_user):
        h = auth_user["headers"]
        r1 = api_client.post(f"{base_url}/api/stylist/chat",
                             json={"message": "What should I wear to a coffee date in autumn?"},
                             headers=h, timeout=90)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1.get("session_id")
        assert isinstance(d1.get("reply"), str) and len(d1["reply"]) > 10
        sid = d1["session_id"]

        # continue
        r2 = api_client.post(f"{base_url}/api/stylist/chat",
                             json={"session_id": sid, "message": "Make it more casual."},
                             headers=h, timeout=90)
        assert r2.status_code == 200
        assert r2.json()["session_id"] == sid

        # session messages
        rs = api_client.get(f"{base_url}/api/stylist/sessions/{sid}", headers=h)
        assert rs.status_code == 200
        msgs = rs.json()["messages"]
        assert len(msgs) >= 4
        # ordered by created_at asc => first should be user
        assert msgs[0]["role"] == "user"
        # roles balanced
        roles = [m["role"] for m in msgs]
        assert roles.count("user") >= 2 and roles.count("assistant") >= 2

        # sessions list contains this session
        rl = api_client.get(f"{base_url}/api/stylist/sessions", headers=h)
        assert rl.status_code == 200
        session_ids = [s["session_id"] for s in rl.json()["sessions"]]
        assert sid in session_ids
