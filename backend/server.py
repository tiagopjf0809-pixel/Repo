"""Lumi backend — fashion & beauty discovery platform."""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import json
import re
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import stripe
import anthropic

from seed_data import build_fashion_products, build_beauty_products
from stores_seed import build_stores, CITY_CENTER

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('ACCESS_TOKEN_EXPIRE_MINUTES', 43200))
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')   # optional — AI features only
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')
if STRIPE_API_KEY:
    stripe.api_key = STRIPE_API_KEY
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:8081')

# Motor is lazy — actual TCP+TLS handshake happens on first query.
# Pass a short serverSelectionTimeoutMS so startup doesn't hang indefinitely
# if the Atlas cluster is slow or the network blocks TLS (e.g. corporate wifi).
client = AsyncIOMotorClient(
    MONGO_URL,
    serverSelectionTimeoutMS=15000,   # fail fast so Railway doesn't time out
    connectTimeoutMS=10000,
    socketTimeoutMS=10000,
)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("lumi")

app = FastAPI(title="Lumi API")
api = APIRouter(prefix="/api")
bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------- Models ----------------------
class SignupReq(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class TokenResp(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


class StyleQuizReq(BaseModel):
    colors: List[str]
    fit: str
    inspiration: List[str]
    budget: str
    lifestyle: str


class CartItemReq(BaseModel):
    product_id: str
    size: Optional[str] = None
    color: Optional[str] = None
    quantity: int = 1


class CartUpdateReq(BaseModel):
    quantity: int


class WishlistReq(BaseModel):
    product_id: str


class FaceScanReq(BaseModel):
    image_base64: str


class StylistChatReq(BaseModel):
    session_id: Optional[str] = None
    message: str


class PriceAlertReq(BaseModel):
    product_id: str
    target_price: float


class ReserveReq(BaseModel):
    product_id: str
    size: Optional[str] = None
    color: Optional[str] = None


class TrackEventReq(BaseModel):
    product_id: str
    event: str  # "view" | "click" | "purchase"


class CheckoutReq(BaseModel):
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class OutfitCreateReq(BaseModel):
    name: str
    product_ids: List[str]
    occasion: Optional[str] = None


class OutfitStyleReq(BaseModel):
    product_ids: List[str]
    occasion: Optional[str] = None  # e.g., "first date", "office", "beach wedding"


# ---------------------- Auth helpers ----------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "exp": expire, "iat": datetime.now(timezone.utc)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> Dict[str, Any]:
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------------------- Startup: seed ----------------------
@app.on_event("startup")
async def on_startup():
    """Seed the database on first boot. Non-fatal — server starts even if DB is unreachable."""
    try:
        fashion_count = await db.products.count_documents({"type": "fashion"})
        if fashion_count == 0:
            await db.products.insert_many(build_fashion_products())
            logger.info("Seeded fashion products")
        beauty_count = await db.products.count_documents({"type": "beauty"})
        if beauty_count == 0:
            await db.products.insert_many(build_beauty_products())
            logger.info("Seeded beauty products")
        stores_count = await db.stores.count_documents({})
        if stores_count == 0:
            await db.stores.insert_many(build_stores())
            logger.info("Seeded stores")
        logger.info("Database ready ✅")
    except Exception as exc:
        # Don't crash the server — Railway/health checks still pass.
        # The first real user request will surface a proper DB error if needed.
        logger.warning(f"Startup seeding skipped (DB unreachable): {exc}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# ---------------------- Auth routes ----------------------
@api.post("/auth/signup", response_model=TokenResp)
async def signup(req: SignupReq):
    email = req.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "password": hash_password(req.password),
        "full_name": req.full_name or email.split("@")[0],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "style_identity": None,
    }
    await db.users.insert_one(user_doc)
    token = create_access_token(user_id)
    safe_user = {k: v for k, v in user_doc.items() if k not in ("password", "_id")}
    return TokenResp(access_token=token, user=safe_user)


@api.post("/auth/login", response_model=TokenResp)
async def login(req: LoginReq):
    email = req.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"])
    safe_user = {k: v for k, v in user.items() if k not in ("password", "_id")}
    return TokenResp(access_token=token, user=safe_user)


@api.get("/auth/me")
async def me(current=Depends(get_current_user)):
    return current


# ---------------------- Products (Fashion) ----------------------
@api.get("/products")
async def list_products(
    style: Optional[str] = None,
    brand: Optional[str] = None,
    color: Optional[str] = None,
    size: Optional[str] = None,
    sustainable: Optional[bool] = None,
    budget: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    skip: int = 0,
    limit: int = 24,
):
    q: Dict[str, Any] = {"type": "fashion"}
    if style:
        q["style"] = style
    if brand:
        q["brand"] = brand
    if color:
        q["colors"] = color
    if size:
        q["sizes"] = size
    if sustainable is not None:
        q["sustainable"] = sustainable
    if budget:
        q["budget_category"] = budget
    price_q: Dict[str, Any] = {}
    if min_price is not None:
        price_q["$gte"] = min_price
    if max_price is not None:
        price_q["$lte"] = max_price
    if price_q:
        q["price"] = price_q
    cursor = db.products.find(q, {"_id": 0}).skip(skip).limit(limit)
    items = await cursor.to_list(length=limit)
    total = await db.products.count_documents(q)
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@api.get("/products/filters")
async def get_filters():
    brands = await db.products.distinct("brand", {"type": "fashion"})
    styles = await db.products.distinct("style", {"type": "fashion"})
    colors = await db.products.distinct("colors", {"type": "fashion"})
    sizes = await db.products.distinct("sizes", {"type": "fashion"})
    return {
        "brands": sorted(brands),
        "styles": sorted(styles),
        "colors": sorted(colors),
        "sizes": sizes,
        "budgets": ["Under $50", "$50–$100", "$100+"],
    }


@api.get("/products/{product_id}")
async def get_product(product_id: str):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Product not found")
    return p


@api.get("/products/{product_id}/similar")
async def similar_products(product_id: str):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Product not found")
    if p.get("type") == "fashion":
        q = {"type": "fashion", "style": p["style"], "id": {"$ne": product_id}}
    else:
        q = {"type": "beauty", "category": p.get("category"), "id": {"$ne": product_id}}
    items = await db.products.find(q, {"_id": 0}).limit(8).to_list(length=8)
    return {"items": items}


# ---------------------- Beauty Products ----------------------
@api.get("/beauty/products")
async def list_beauty(category: Optional[str] = None, brand: Optional[str] = None):
    q: Dict[str, Any] = {"type": "beauty"}
    if category:
        q["category"] = category
    if brand:
        q["brand"] = brand
    items = await db.products.find(q, {"_id": 0}).to_list(length=200)
    return {"items": items}


# ---------------------- Wishlist ----------------------
@api.get("/wishlist")
async def get_wishlist(current=Depends(get_current_user)):
    entries = await db.wishlist.find({"user_id": current["id"]}, {"_id": 0}).to_list(length=500)
    product_ids = [e["product_id"] for e in entries]
    products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(length=500)
    return {"items": products}


@api.post("/wishlist")
async def add_wishlist(req: WishlistReq, current=Depends(get_current_user)):
    existing = await db.wishlist.find_one({"user_id": current["id"], "product_id": req.product_id})
    if existing:
        return {"status": "already_added"}
    await db.wishlist.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current["id"],
        "product_id": req.product_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"status": "added"}


@api.delete("/wishlist/{product_id}")
async def remove_wishlist(product_id: str, current=Depends(get_current_user)):
    await db.wishlist.delete_one({"user_id": current["id"], "product_id": product_id})
    return {"status": "removed"}


# ---------------------- Cart ----------------------
@api.get("/cart")
async def get_cart(current=Depends(get_current_user)):
    items = await db.cart.find({"user_id": current["id"]}, {"_id": 0}).to_list(length=200)
    # enrich with product info
    product_ids = [i["product_id"] for i in items]
    products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(length=200)
    product_map = {p["id"]: p for p in products}
    enriched = []
    subtotal = 0.0
    for it in items:
        p = product_map.get(it["product_id"])
        if not p:
            continue
        line_total = p["price"] * it["quantity"]
        subtotal += line_total
        enriched.append({**it, "product": p, "line_total": round(line_total, 2)})
    return {"items": enriched, "subtotal": round(subtotal, 2)}


@api.post("/cart")
async def add_cart(req: CartItemReq, current=Depends(get_current_user)):
    existing = await db.cart.find_one({
        "user_id": current["id"],
        "product_id": req.product_id,
        "size": req.size,
        "color": req.color,
    })
    if existing:
        await db.cart.update_one({"id": existing["id"]}, {"$inc": {"quantity": req.quantity}})
        return {"status": "updated"}
    await db.cart.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current["id"],
        "product_id": req.product_id,
        "size": req.size,
        "color": req.color,
        "quantity": req.quantity,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"status": "added"}


@api.patch("/cart/{item_id}")
async def update_cart(item_id: str, req: CartUpdateReq, current=Depends(get_current_user)):
    if req.quantity <= 0:
        await db.cart.delete_one({"id": item_id, "user_id": current["id"]})
        return {"status": "removed"}
    await db.cart.update_one({"id": item_id, "user_id": current["id"]}, {"$set": {"quantity": req.quantity}})
    return {"status": "updated"}


@api.delete("/cart/{item_id}")
async def delete_cart(item_id: str, current=Depends(get_current_user)):
    await db.cart.delete_one({"id": item_id, "user_id": current["id"]})
    return {"status": "removed"}


# ---------------------- Style Quiz ----------------------
def derive_style_identity(req: StyleQuizReq) -> Dict[str, Any]:
    """Simple deterministic mapping from quiz answers to style identity."""
    inspiration = [s.lower() for s in req.inspiration]
    score = {
        "Minimalist": 0,
        "Quiet Luxury": 0,
        "Streetwear": 0,
        "Old Money": 0,
        "Vintage": 0,
        "Athleisure": 0,
    }
    for tag in inspiration:
        if "minimal" in tag:
            score["Minimalist"] += 2
        if "luxury" in tag or "quiet" in tag:
            score["Quiet Luxury"] += 2
        if "street" in tag:
            score["Streetwear"] += 2
        if "old money" in tag or "preppy" in tag:
            score["Old Money"] += 2
        if "vintage" in tag or "retro" in tag:
            score["Vintage"] += 2
        if "athletic" in tag or "sport" in tag:
            score["Athleisure"] += 2
    fit = (req.fit or "").lower()
    if "oversized" in fit:
        score["Streetwear"] += 1
    if "tailored" in fit:
        score["Old Money"] += 1
        score["Quiet Luxury"] += 1
    if "fitted" in fit:
        score["Minimalist"] += 1
    lifestyle = (req.lifestyle or "").lower()
    if "corporate" in lifestyle:
        score["Quiet Luxury"] += 1
    if "student" in lifestyle:
        score["Streetwear"] += 1
    if "nightlife" in lifestyle:
        score["Old Money"] += 1
    identity = max(score, key=score.get)
    style_to_filter = {
        "Minimalist": "minimal",
        "Quiet Luxury": "quiet luxury",
        "Streetwear": "streetwear",
        "Old Money": "old money",
        "Vintage": "vintage",
        "Athleisure": "athletic",
    }
    descriptions = {
        "Minimalist": "Clean lines, neutral palettes, and timeless silhouettes define your style.",
        "Quiet Luxury": "Understated elegance and elevated essentials in muted, refined tones.",
        "Streetwear": "Oversized fits, graphic energy, and a confident, urban edge.",
        "Old Money": "Preppy, classic, and timeless — think trench coats and tailored knits.",
        "Vintage": "Retro silhouettes, washed denim, and nostalgic textures.",
        "Athleisure": "Sport-luxe pieces that move with you — performance meets style.",
    }
    return {
        "identity": identity,
        "description": descriptions[identity],
        "filter_style": style_to_filter[identity],
        "score": score,
    }


@api.post("/style/quiz")
async def submit_quiz(req: StyleQuizReq, current=Depends(get_current_user)):
    result = derive_style_identity(req)
    await db.users.update_one(
        {"id": current["id"]},
        {"$set": {
            "style_identity": result["identity"],
            "style_filter": result["filter_style"],
            "style_description": result["description"],
            "quiz_answers": req.dict(),
            "quiz_completed_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    # Suggest products
    suggested = await db.products.find(
        {"type": "fashion", "style": result["filter_style"]}, {"_id": 0}
    ).limit(8).to_list(length=8)
    return {**result, "suggested_products": suggested}


@api.get("/style/profile")
async def get_profile(current=Depends(get_current_user)):
    user = await db.users.find_one({"id": current["id"]}, {"_id": 0, "password": 0})
    return user


# ---------------------- Beauty: Face Scan AI ----------------------
def _strip_json(text: str) -> Optional[Dict[str, Any]]:
    """Extract the first JSON object from a model response."""
    if not text:
        return None
    # Remove markdown fences
    text = re.sub(r"```json\s*", "", text)
    text = re.sub(r"```\s*", "", text)
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


FACE_SCAN_PROMPT = """You are a professional beauty analyst. Analyze the selfie and return ONLY a JSON object with these exact keys:
{
  "skin_tone": "fair|light|medium|tan|deep",
  "undertone": "cool|neutral|warm",
  "skin_type": "dry|oily|combination|normal",
  "face_shape": "oval|round|square|heart|long|diamond",
  "under_eye_tone": "neutral|blue|purple|brown",
  "lip_shape": "full|thin|heart|wide|bow",
  "eye_shape": "almond|round|hooded|monolid|downturned|upturned",
  "notes": "one short sentence of professional observation"
}
No markdown, no extra text — only the JSON object."""


@api.post("/beauty/face-scan")
async def face_scan(req: FaceScanReq, current=Depends(get_current_user)):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(503, "AI features require ANTHROPIC_API_KEY in backend .env")

    # Strip any data URL prefix from the base64
    img_b64 = req.image_base64
    if img_b64.startswith("data:"):
        img_b64 = img_b64.split(",", 1)[-1]

    try:
        ai = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        result = ai.messages.create(
            model="claude-opus-4-5",
            max_tokens=1024,
            system=FACE_SCAN_PROMPT,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": img_b64}},
                    {"type": "text", "text": "Analyze this selfie according to the system instructions. Return only the JSON object."},
                ],
            }],
        )
        response = result.content[0].text
    except Exception as e:
        logger.exception("Face scan LLM error")
        raise HTTPException(502, f"AI analysis failed: {str(e)[:200]}")

    parsed = _strip_json(response) or {}
    # Defaults if some fields missing
    analysis = {
        "skin_tone": parsed.get("skin_tone", "medium"),
        "undertone": parsed.get("undertone", "neutral"),
        "skin_type": parsed.get("skin_type", "normal"),
        "face_shape": parsed.get("face_shape", "oval"),
        "under_eye_tone": parsed.get("under_eye_tone", "neutral"),
        "lip_shape": parsed.get("lip_shape", "full"),
        "eye_shape": parsed.get("eye_shape", "almond"),
        "notes": parsed.get("notes", "Balanced, healthy complexion."),
    }

    # Recommendations: pull beauty products matching skin tone/type
    beauty = await db.products.find({"type": "beauty"}, {"_id": 0}).to_list(length=500)
    recs: Dict[str, List[Dict[str, Any]]] = {}
    categories = ["foundation", "concealer", "blush", "contour", "lip", "eye"]
    for cat in categories:
        cat_items = [p for p in beauty if p.get("category") == cat]
        # Score by skin tone/type compatibility
        scored = []
        for p in cat_items:
            score = 0
            tones = p.get("compatible_skin_tones") or []
            types = p.get("compatible_skin_types") or []
            if analysis["skin_tone"] in tones or "all" in tones:
                score += 2
            if analysis["skin_type"] in types or "all" in types:
                score += 1
            score += min(p.get("derm_rating", 0), 5) * 0.5
            scored.append((score, p))
        scored.sort(key=lambda x: x[0], reverse=True)
        recs[cat] = [p for _, p in scored[:3]]

    # Persist
    scan_id = str(uuid.uuid4())
    await db.face_scans.insert_one({
        "id": scan_id,
        "user_id": current["id"],
        "analysis": analysis,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "id": scan_id,
        "analysis": analysis,
        "recommendations": recs,
    }


@api.get("/beauty/face-scan/latest")
async def latest_scan(current=Depends(get_current_user)):
    scan = await db.face_scans.find_one(
        {"user_id": current["id"]},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    return scan or {}


# ---------------------- AI Stylist Chat ----------------------
STYLIST_SYSTEM = """You are Lumi, a warm and stylish AI personal shopper. You help users build outfits, suggest looks for specific occasions (weddings, work, dates, nightlife), recommend pieces by style identity, and consider weather and budget. Keep responses concise (3-5 sentences), friendly, and visual — describe textures, silhouettes, colors. Suggest specific item types (e.g., 'an oversized linen blazer in stone'). Never invent brand stock or links. Ask one short follow-up question when helpful."""


@api.post("/stylist/chat")
async def stylist_chat(req: StylistChatReq, current=Depends(get_current_user)):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(503, "AI features require ANTHROPIC_API_KEY in backend .env")

    session_id = req.session_id or str(uuid.uuid4())

    # Build system message with user context
    user = await db.users.find_one({"id": current["id"]}, {"_id": 0})
    style_id = user.get("style_identity") if user else None
    system = STYLIST_SYSTEM
    if style_id:
        system += f"\n\nThe user's style identity is: {style_id}."

    # Load prior messages in this session for context
    prior = await db.chat_messages.find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(length=20)
    history = [{"role": m["role"], "content": m["content"]} for m in prior]
    history.append({"role": "user", "content": req.message})

    try:
        ai = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        result = ai.messages.create(
            model="claude-opus-4-5",
            max_tokens=512,
            system=system,
            messages=history,
        )
        response = result.content[0].text
    except Exception as e:
        logger.exception("Stylist chat LLM error")
        raise HTTPException(502, f"AI stylist failed: {str(e)[:200]}")

    now = datetime.now(timezone.utc).isoformat()
    await db.chat_messages.insert_many([
        {"id": str(uuid.uuid4()), "session_id": session_id, "user_id": current["id"],
         "role": "user", "content": req.message, "created_at": now},
        {"id": str(uuid.uuid4()), "session_id": session_id, "user_id": current["id"],
         "role": "assistant", "content": response, "created_at": now},
    ])

    return {"session_id": session_id, "reply": response}


@api.get("/stylist/sessions/{session_id}")
async def get_session(session_id: str, current=Depends(get_current_user)):
    msgs = await db.chat_messages.find(
        {"session_id": session_id, "user_id": current["id"]},
        {"_id": 0}
    ).sort("created_at", 1).to_list(length=200)
    return {"session_id": session_id, "messages": msgs}


@api.get("/stylist/sessions")
async def list_sessions(current=Depends(get_current_user)):
    pipeline = [
        {"$match": {"user_id": current["id"]}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$session_id",
            "last_message": {"$first": "$content"},
            "last_at": {"$first": "$created_at"},
        }},
        {"$sort": {"last_at": -1}},
        {"$limit": 20},
    ]
    items = await db.chat_messages.aggregate(pipeline).to_list(length=20)
    return {"sessions": [{"session_id": i["_id"], "last_message": i["last_message"], "last_at": i["last_at"]} for i in items]}


# ---------------------- Stores / Map ----------------------
import math


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _price_with_jitter(base: float, store_index: int) -> float:
    """Deterministic per-store price variation up to ±12%."""
    factor = 1.0 + ((store_index * 37) % 25 - 12) / 100.0
    return round(base * factor, 2)


@api.get("/stores/nearby")
async def stores_nearby(
    product_id: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: float = 25.0,
):
    user_lat = lat if lat is not None else CITY_CENTER["lat"]
    user_lng = lng if lng is not None else CITY_CENTER["lng"]
    stores = await db.stores.find({}, {"_id": 0}).to_list(length=200)
    product = None
    if product_id:
        product = await db.products.find_one({"id": product_id}, {"_id": 0})
        if not product:
            raise HTTPException(404, "Product not found")
    out = []
    for idx, s in enumerate(stores):
        dist = _haversine_km(user_lat, user_lng, s["lat"], s["lng"])
        if dist > radius_km:
            continue
        # Inventory rules: store carries product if brand matches
        if product:
            in_stock = s["brand"] == product["brand"]
            # Stylish twist: occasional cross-stock
            if not in_stock and (idx % 5 == 0):
                in_stock = True
            stock_count = (idx * 7 + 3) % 12 if in_stock else 0
            price = _price_with_jitter(product["price"], idx) if in_stock else None
        else:
            in_stock = True
            stock_count = (idx * 7 + 3) % 12
            price = None
        out.append({
            **s,
            "distance_km": round(dist, 2),
            "in_stock": in_stock,
            "stock_count": stock_count,
            "price": price,
            "is_partner": s["brand"] in {"Zara", "H&M", "Uniqlo"},
        })
    out.sort(key=lambda x: (not x["in_stock"], x["distance_km"]))
    return {
        "user_location": {"lat": user_lat, "lng": user_lng},
        "stores": out,
        "city_center": CITY_CENTER,
        "product": product,
    }


@api.post("/stores/{store_id}/reserve")
async def reserve_at_store(store_id: str, req: ReserveReq, current=Depends(get_current_user)):
    store = await db.stores.find_one({"id": store_id}, {"_id": 0})
    if not store:
        raise HTTPException(404, "Store not found")
    product = await db.products.find_one({"id": req.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Product not found")
    reservation = {
        "id": str(uuid.uuid4()),
        "user_id": current["id"],
        "store_id": store_id,
        "product_id": req.product_id,
        "size": req.size,
        "color": req.color,
        "status": "reserved",
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.reservations.insert_one(reservation)
    return {"status": "reserved", "reservation_id": reservation["id"],
            "store_name": store["name"], "expires_at": reservation["expires_at"]}


@api.get("/reservations")
async def list_reservations(current=Depends(get_current_user)):
    rs = await db.reservations.find({"user_id": current["id"]}, {"_id": 0}).sort("created_at", -1).to_list(length=50)
    return {"items": rs}


# ---------------------- Price Alerts ----------------------
@api.get("/price-alerts")
async def list_alerts(current=Depends(get_current_user)):
    alerts = await db.price_alerts.find({"user_id": current["id"]}, {"_id": 0}).to_list(length=100)
    product_ids = [a["product_id"] for a in alerts]
    products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(length=200)
    p_map = {p["id"]: p for p in products}
    out = []
    for a in alerts:
        p = p_map.get(a["product_id"])
        if not p:
            continue
        triggered = p["price"] <= a["target_price"]
        out.append({**a, "product": p, "current_price": p["price"], "triggered": triggered})
    return {"items": out}


@api.post("/price-alerts")
async def create_alert(req: PriceAlertReq, current=Depends(get_current_user)):
    product = await db.products.find_one({"id": req.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Product not found")
    existing = await db.price_alerts.find_one({"user_id": current["id"], "product_id": req.product_id})
    if existing:
        await db.price_alerts.update_one(
            {"id": existing["id"]},
            {"$set": {"target_price": req.target_price, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"status": "updated", "id": existing["id"]}
    alert = {
        "id": str(uuid.uuid4()),
        "user_id": current["id"],
        "product_id": req.product_id,
        "target_price": req.target_price,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.price_alerts.insert_one(alert)
    return {"status": "created", "id": alert["id"]}


@api.delete("/price-alerts/{alert_id}")
async def delete_alert(alert_id: str, current=Depends(get_current_user)):
    await db.price_alerts.delete_one({"id": alert_id, "user_id": current["id"]})
    return {"status": "removed"}


# ---------------------- Analytics / Retailer ----------------------
@api.post("/products/{product_id}/track")
async def track_event(product_id: str, req: TrackEventReq, current=Depends(get_current_user)):
    """Track a view/click event for analytics."""
    await db.product_events.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current["id"],
        "product_id": product_id,
        "event": req.event,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"status": "ok"}


@api.get("/retailer/brands")
async def retailer_brands():
    brands = await db.products.distinct("brand", {"type": "fashion"})
    return {"brands": sorted(brands)}


@api.get("/retailer/{brand}/analytics")
async def retailer_analytics(brand: str):
    """Aggregate analytics for a brand. Combines real events + style-compat baseline."""
    # All products of this brand
    products = await db.products.find({"brand": brand}, {"_id": 0}).to_list(length=500)
    if not products:
        raise HTTPException(404, "Brand not found")
    product_ids = [p["id"] for p in products]

    # Real events
    views = await db.product_events.count_documents({"product_id": {"$in": product_ids}, "event": "view"})
    clicks = await db.product_events.count_documents({"product_id": {"$in": product_ids}, "event": "click"})
    purchases = await db.product_events.count_documents({"product_id": {"$in": product_ids}, "event": "purchase"})
    # Wishlist saves
    wishlist_saves = await db.wishlist.count_documents({"product_id": {"$in": product_ids}})
    cart_adds = await db.cart.count_documents({"product_id": {"$in": product_ids}})

    # Baseline simulation so dashboard is meaningful even before real traffic
    baseline_views = sum((hash(pid) % 800) + 200 for pid in product_ids)
    baseline_clicks = int(baseline_views * 0.08)
    baseline_purchases = int(baseline_clicks * 0.05)
    total_views = views + baseline_views
    total_clicks = clicks + baseline_clicks
    total_purchases = purchases + baseline_purchases
    ctr = round((total_clicks / total_views) * 100, 2) if total_views else 0
    conversion = round((total_purchases / total_clicks) * 100, 2) if total_clicks else 0

    # Per-product breakdown
    product_breakdown = []
    for p in products:
        pid = p["id"]
        p_views = await db.product_events.count_documents({"product_id": pid, "event": "view"})
        p_clicks = await db.product_events.count_documents({"product_id": pid, "event": "click"})
        p_wish = await db.wishlist.count_documents({"product_id": pid})
        # Baseline
        bv = (hash(pid) % 800) + 200
        bc = int(bv * 0.08)
        # Trending score
        trending_score = p_wish * 5 + (p_clicks + bc) + (p_views + bv) // 10
        product_breakdown.append({
            "id": pid,
            "name": p["name"],
            "image": p["image"],
            "price": p["price"],
            "style": p.get("style"),
            "views": p_views + bv,
            "clicks": p_clicks + bc,
            "wishlist_saves": p_wish,
            "trending_score": trending_score,
        })
    product_breakdown.sort(key=lambda x: x["trending_score"], reverse=True)

    # Style compatibility — count users who have this brand's style in their identity
    style_counts: Dict[str, int] = {}
    for p in products:
        style_counts[p.get("style", "other")] = style_counts.get(p.get("style", "other"), 0) + 1
    # Actual user matches
    user_style_matches: Dict[str, int] = {}
    for style, _ in style_counts.items():
        c = await db.users.count_documents({"style_filter": style})
        user_style_matches[style] = c

    return {
        "brand": brand,
        "summary": {
            "products": len(products),
            "views": total_views,
            "clicks": total_clicks,
            "purchases": total_purchases,
            "wishlist_saves": wishlist_saves,
            "cart_adds": cart_adds,
            "ctr_percent": ctr,
            "conversion_percent": conversion,
        },
        "top_products": product_breakdown[:6],
        "all_products": product_breakdown,
        "style_compatibility": [
            {"style": s, "products_count": c, "user_matches": user_style_matches.get(s, 0)}
            for s, c in style_counts.items()
        ],
    }


# ---------------------- Checkout (Stripe) ----------------------
@api.post("/checkout/session")
async def create_checkout_session(req: CheckoutReq, current=Depends(get_current_user)):
    """Create Stripe Checkout Session from server-side cart."""
    cart_items = await db.cart.find({"user_id": current["id"]}, {"_id": 0}).to_list(length=200)
    if not cart_items:
        raise HTTPException(400, "Cart is empty")

    product_ids = [c["product_id"] for c in cart_items]
    products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(length=200)
    p_map = {p["id"]: p for p in products}

    line_items = []
    total_cents = 0
    for it in cart_items:
        p = p_map.get(it["product_id"])
        if not p:
            continue
        unit_amount = int(round(p["price"] * 100))
        line_items.append({
            "price_data": {
                "currency": "usd",
                "product_data": {
                    "name": f"{p['brand']} · {p['name']}"[:120],
                    "images": [p["image"]] if p.get("image") else [],
                    "metadata": {"product_id": p["id"]},
                },
                "unit_amount": unit_amount,
            },
            "quantity": it["quantity"],
        })
        total_cents += unit_amount * it["quantity"]

    if not line_items:
        raise HTTPException(400, "No valid items in cart")

    success_url = (req.success_url or f"{FRONTEND_URL}/cart-success") + "?session_id={CHECKOUT_SESSION_ID}"
    cancel_url = req.cancel_url or f"{FRONTEND_URL}/wishlist"

    demo_mode = False
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=line_items,
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            client_reference_id=current["id"],
            metadata={"user_id": current["id"]},
        )
        session_id = session.id
        session_url = session.url
    except stripe.error.AuthenticationError:
        # No valid Stripe key configured — fall back to DEMO checkout
        logger.warning("Stripe key invalid — using DEMO checkout fallback")
        demo_mode = True
        session_id = f"demo_{uuid.uuid4()}"
        session_url = f"{FRONTEND_URL}/cart-success?session_id={session_id}&demo=1"
    except stripe.error.StripeError as e:
        logger.exception("Stripe error")
        raise HTTPException(502, f"Stripe error: {str(e)[:200]}")

    order = {
        "id": str(uuid.uuid4()),
        "user_id": current["id"],
        "session_id": session_id,
        "status": "pending",
        "demo_mode": demo_mode,
        "total_cents": total_cents,
        "items": [{"product_id": it["product_id"], "quantity": it["quantity"],
                   "size": it.get("size"), "color": it.get("color")} for it in cart_items],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.orders.insert_one(order)
    return {"session_id": session_id, "url": session_url, "order_id": order["id"], "demo_mode": demo_mode}


@api.get("/checkout/session/{session_id}")
async def verify_checkout_session(session_id: str, current=Depends(get_current_user)):
    """Verify session status. Clears cart on success."""
    # Demo-mode session (no real Stripe key configured)
    if session_id.startswith("demo_"):
        order = await db.orders.find_one({"session_id": session_id, "user_id": current["id"]}, {"_id": 0})
        if not order:
            raise HTTPException(404, "Order not found")
        if order.get("status") != "completed":
            # Mark as paid + clear cart + record purchases
            cart_items = await db.cart.find({"user_id": current["id"]}, {"_id": 0}).to_list(length=200)
            for it in cart_items:
                await db.product_events.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": current["id"],
                    "product_id": it["product_id"],
                    "event": "purchase",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
            await db.cart.delete_many({"user_id": current["id"]})
            await db.orders.update_one(
                {"session_id": session_id},
                {"$set": {"status": "completed", "payment_status": "paid",
                          "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            order["status"] = "completed"
        return {
            "session_id": session_id,
            "payment_status": "paid",
            "status": "completed",
            "paid": True,
            "amount_total": order.get("total_cents", 0),
            "order": order,
            "demo_mode": True,
        }

    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.StripeError as e:
        raise HTTPException(404, f"Session not found: {str(e)[:200]}")

    if session.metadata.get("user_id") != current["id"]:
        raise HTTPException(403, "Not your session")

    paid = session.payment_status == "paid"
    new_status = "completed" if paid else session.payment_status
    await db.orders.update_one(
        {"session_id": session_id, "user_id": current["id"]},
        {"$set": {"status": new_status, "payment_status": session.payment_status,
                  "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    if paid:
        # Record purchase events for analytics + clear cart
        cart_items = await db.cart.find({"user_id": current["id"]}, {"_id": 0}).to_list(length=200)
        for it in cart_items:
            await db.product_events.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": current["id"],
                "product_id": it["product_id"],
                "event": "purchase",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        await db.cart.delete_many({"user_id": current["id"]})

    order = await db.orders.find_one({"session_id": session_id}, {"_id": 0})
    return {
        "session_id": session_id,
        "payment_status": session.payment_status,
        "status": new_status,
        "paid": paid,
        "amount_total": session.amount_total,
        "order": order,
    }


@api.get("/orders")
async def list_orders(current=Depends(get_current_user)):
    items = await db.orders.find({"user_id": current["id"]}, {"_id": 0}).sort("created_at", -1).to_list(length=50)
    return {"items": items}


# ---------------------- Outfits ----------------------
OUTFIT_STYLIST_SYSTEM = """You are Lumi's outfit stylist. The user picks several specific items from the catalog. Your job: in 4-6 sentences, describe a complete outfit using THESE exact pieces, calling each by its brand+name, and explain the styling rationale (silhouette, color story, occasion-fit). End with one optional accessory or finishing-touch suggestion. Be specific, warm, and confident — like a personal shopper. No bullet lists, no markdown."""


@api.post("/outfits/style")
async def style_outfit(req: OutfitStyleReq, current=Depends(get_current_user)):
    """Use Claude to describe an outfit composed of selected products."""
    if not req.product_ids:
        raise HTTPException(400, "No products selected")
    products = await db.products.find({"id": {"$in": req.product_ids}}, {"_id": 0}).to_list(length=20)
    if not products:
        raise HTTPException(404, "No products found")

    if not ANTHROPIC_API_KEY:
        raise HTTPException(503, "AI features require ANTHROPIC_API_KEY in backend .env")

    user = await db.users.find_one({"id": current["id"]}, {"_id": 0})
    style_id = user.get("style_identity") if user else None
    sys_msg = OUTFIT_STYLIST_SYSTEM
    if style_id:
        sys_msg += f"\n\nThe user's style identity is: {style_id}."

    items_text = "\n".join(
        f"- {p['brand']} {p['name']} (${p['price']:.0f}, style: {p.get('style', '—')}, colors: {', '.join(p.get('colors', [])[:3]) or '—'})"
        for p in products
    )
    occasion_text = f" The occasion is: {req.occasion}." if req.occasion else ""
    prompt = f"Style this outfit using these {len(products)} pieces:\n{items_text}\n{occasion_text}"

    try:
        ai = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        result = ai.messages.create(
            model="claude-opus-4-5",
            max_tokens=512,
            system=sys_msg,
            messages=[{"role": "user", "content": prompt}],
        )
        response = result.content[0].text
    except Exception as e:
        logger.exception("Outfit styling LLM error")
        raise HTTPException(502, f"AI styling failed: {str(e)[:200]}")

    return {
        "styling": response,
        "products": products,
        "occasion": req.occasion,
        "total_price": round(sum(p["price"] for p in products), 2),
    }


@api.post("/outfits")
async def save_outfit(req: OutfitCreateReq, current=Depends(get_current_user)):
    if not req.product_ids:
        raise HTTPException(400, "No products selected")
    outfit = {
        "id": str(uuid.uuid4()),
        "user_id": current["id"],
        "name": req.name,
        "occasion": req.occasion,
        "product_ids": req.product_ids,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.outfits.insert_one(outfit)
    return {"id": outfit["id"], "status": "saved"}


@api.get("/outfits")
async def list_outfits(current=Depends(get_current_user)):
    outfits = await db.outfits.find({"user_id": current["id"]}, {"_id": 0}).sort("created_at", -1).to_list(length=50)
    # enrich with product previews
    all_ids = list({pid for o in outfits for pid in o["product_ids"]})
    products = await db.products.find({"id": {"$in": all_ids}}, {"_id": 0}).to_list(length=500)
    p_map = {p["id"]: p for p in products}
    for o in outfits:
        o["products"] = [p_map[pid] for pid in o["product_ids"] if pid in p_map]
        o["total_price"] = round(sum(p["price"] for p in o["products"]), 2)
    return {"items": outfits}


@api.post("/outfits/{outfit_id}/add-to-cart")
async def outfit_to_cart(outfit_id: str, current=Depends(get_current_user)):
    outfit = await db.outfits.find_one({"id": outfit_id, "user_id": current["id"]}, {"_id": 0})
    if not outfit:
        raise HTTPException(404, "Outfit not found")
    products = await db.products.find({"id": {"$in": outfit["product_ids"]}}, {"_id": 0}).to_list(length=20)
    added = 0
    for p in products:
        existing = await db.cart.find_one({
            "user_id": current["id"], "product_id": p["id"],
            "size": p.get("sizes", [None])[0], "color": p.get("colors", [None])[0],
        })
        if existing:
            await db.cart.update_one({"id": existing["id"]}, {"$inc": {"quantity": 1}})
        else:
            await db.cart.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": current["id"],
                "product_id": p["id"],
                "size": p.get("sizes", [None])[0],
                "color": p.get("colors", [None])[0],
                "quantity": 1,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        added += 1
    return {"status": "ok", "added": added}


@api.delete("/outfits/{outfit_id}")
async def delete_outfit(outfit_id: str, current=Depends(get_current_user)):
    await db.outfits.delete_one({"id": outfit_id, "user_id": current["id"]})
    return {"status": "removed"}


# ---------------------- Health ----------------------
@api.get("/")
async def root():
    return {"name": "Lumi API", "status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
