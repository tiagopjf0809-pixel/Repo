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

from seed_data import build_fashion_products, build_beauty_products
from stores_seed import build_stores, CITY_CENTER

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('ACCESS_TOKEN_EXPIRE_MINUTES', 43200))
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']

client = AsyncIOMotorClient(MONGO_URL)
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
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    except Exception as e:
        raise HTTPException(500, f"LLM integration unavailable: {e}")

    # Strip any data URL prefix from the base64
    img_b64 = req.image_base64
    if img_b64.startswith("data:"):
        img_b64 = img_b64.split(",", 1)[-1]

    session_id = str(uuid.uuid4())
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=FACE_SCAN_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    msg = UserMessage(
        text="Analyze this selfie according to the system instructions. Return only the JSON object.",
        file_contents=[ImageContent(image_base64=img_b64)],
    )

    try:
        response = await chat.send_message(msg)
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
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as e:
        raise HTTPException(500, f"LLM integration unavailable: {e}")

    session_id = req.session_id or str(uuid.uuid4())

    # Build system message with user context
    user = await db.users.find_one({"id": current["id"]}, {"_id": 0})
    style_id = user.get("style_identity") if user else None
    system = STYLIST_SYSTEM
    if style_id:
        system += f"\n\nThe user's style identity is: {style_id}."

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    try:
        response = await chat.send_message(UserMessage(text=req.message))
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
