"""Shared pytest fixtures for Lumi backend tests."""
import os
import io
import base64
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFilter

# Load frontend .env for EXPO_PUBLIC_BACKEND_URL (external preview URL)
load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or ""
).rstrip("/")

if not BASE_URL:
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL not configured in frontend/.env")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _make_face_jpeg_base64() -> str:
    """Generate a realistic-enough JPEG containing visual features (edges,
    shadows, gradients, textures) so that Claude vision considers it a
    real image. Returns pure base64 (no data: prefix)."""
    W, H = 384, 480
    img = Image.new("RGB", (W, H), (228, 200, 178))  # warm skin background
    d = ImageDraw.Draw(img)

    # Background gradient
    for y in range(H):
        shade = int(220 - (y / H) * 60)
        d.line([(0, y), (W, y)], fill=(shade, shade - 10, shade - 20))

    # Face oval
    d.ellipse([72, 80, 312, 420], fill=(232, 196, 170), outline=(150, 100, 80), width=2)
    # Forehead shadow
    d.ellipse([90, 100, 294, 220], fill=(238, 204, 178))
    # Cheeks (blush)
    d.ellipse([100, 260, 170, 320], fill=(225, 160, 145))
    d.ellipse([214, 260, 284, 320], fill=(225, 160, 145))
    # Eyes
    d.ellipse([120, 220, 165, 245], fill=(255, 255, 255), outline=(60, 40, 30), width=2)
    d.ellipse([219, 220, 264, 245], fill=(255, 255, 255), outline=(60, 40, 30), width=2)
    d.ellipse([135, 225, 152, 242], fill=(70, 50, 35))
    d.ellipse([234, 225, 251, 242], fill=(70, 50, 35))
    # Eyebrows
    d.rectangle([118, 200, 168, 208], fill=(70, 45, 30))
    d.rectangle([216, 200, 266, 208], fill=(70, 45, 30))
    # Nose
    d.polygon([(192, 240), (180, 320), (204, 320)], fill=(218, 180, 158), outline=(160, 120, 100))
    # Lips
    d.ellipse([162, 340, 222, 372], fill=(180, 90, 90), outline=(120, 60, 60))
    d.line([(165, 356), (219, 356)], fill=(120, 60, 60), width=2)
    # Hair
    d.pieslice([60, 60, 324, 240], start=180, end=360, fill=(60, 40, 30))

    img = img.filter(ImageFilter.GaussianBlur(radius=1.0))
    # Add a touch of texture
    import random
    px = img.load()
    random.seed(7)
    for _ in range(4000):
        x = random.randint(0, W - 1); y = random.randint(0, H - 1)
        r, g, b = px[x, y]
        n = random.randint(-12, 12)
        px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)))

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode("ascii")


@pytest.fixture(scope="session")
def face_jpeg_b64():
    return _make_face_jpeg_base64()


@pytest.fixture(scope="session")
def auth_user(api_client, base_url):
    """Create a fresh test user and return (token, user, headers)."""
    email = f"TEST_{uuid.uuid4().hex[:10]}@lumi.app"
    password = "lumipass123"
    r = api_client.post(f"{base_url}/api/auth/signup",
                        json={"email": email, "password": password, "full_name": "TEST User"})
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    data = r.json()
    token = data["access_token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    return {"email": email, "password": password, "token": token,
            "user": data["user"], "headers": headers}
