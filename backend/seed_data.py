"""Seed data for Lumi: fashion products + beauty products."""
from datetime import datetime, timezone
import uuid

# Fashion product images (curated Unsplash + sample)
FASHION_IMAGES = [
    "https://images.unsplash.com/photo-1581338834647-b0fb40704e21?w=600&q=80",  # minimal beige
    "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=600&q=80",  # streetwear
    "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&q=80",  # vintage
    "https://images.unsplash.com/photo-1485518882345-15568b007407?w=600&q=80",  # neutral knit
    "https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=600&q=80",  # old money
    "https://images.unsplash.com/photo-1551803091-e20673f15770?w=600&q=80",  # casual tee
    "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&q=80",  # white shirt
    "https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&q=80",  # denim
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80",  # blazer
    "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80",  # quiet luxury
    "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&q=80",  # oversized
    "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&q=80",  # earthy
    "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&q=80",  # athletic
    "https://images.unsplash.com/photo-1564859228273-274232fdb516?w=600&q=80",  # boots
    "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&q=80",  # trench
    "https://images.unsplash.com/photo-1532453288672-3a27e9be9efd?w=600&q=80",  # minimal coat
    "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80",  # streetwear hoodie
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80",  # nightlife
    "https://images.unsplash.com/photo-1518049362265-d5b2a6467637?w=600&q=80",  # silk shirt
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80",  # corporate
]

BRANDS = ["Zara", "H&M", "Uniqlo", "COS", "Aritzia", "Reformation", "Everlane", "Ganni", "Levi's", "Acne Studios"]
STYLES = ["minimal", "streetwear", "old money", "vintage", "athletic", "quiet luxury", "corporate", "casual"]
COLORS = ["beige", "black", "white", "cream", "olive", "navy", "brown", "grey", "rust", "stone"]
SIZES = ["XS", "S", "M", "L", "XL"]

FASHION_PRODUCTS = [
    # Each product has its own image matched to the item type
    {"name": "Oversized Linen Blazer", "brand": "COS", "price": 175.00, "style": "quiet luxury", "sustainable": True, "colors": ["beige", "stone"],
     "image": "https://images.unsplash.com/photo-1581338834647-b0fb40704e21?w=600&q=80"},  # beige blazer
    {"name": "Wide Leg Trousers", "brand": "Aritzia", "price": 128.00, "style": "minimal", "sustainable": False, "colors": ["black", "cream"],
     "image": "https://images.unsplash.com/photo-1594938298603-c8148c4b4e50?w=600&q=80"},  # wide-leg trousers
    {"name": "Vintage Wash Denim", "brand": "Levi's", "price": 89.00, "style": "vintage", "sustainable": True, "colors": ["navy", "grey"],
     "image": "https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&q=80"},  # denim jeans
    {"name": "Cashmere Crew Neck", "brand": "Uniqlo", "price": 99.00, "style": "minimal", "sustainable": False, "colors": ["cream", "beige", "black"],
     "image": "https://images.unsplash.com/photo-1485518882345-15568b007407?w=600&q=80"},  # knit sweater
    {"name": "Sculpted Trench Coat", "brand": "Acne Studios", "price": 890.00, "style": "old money", "sustainable": True, "colors": ["beige"],
     "image": "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&q=80"},  # trench coat
    {"name": "Boxy Cropped Tee", "brand": "Zara", "price": 25.99, "style": "streetwear", "sustainable": False, "colors": ["white", "black"],
     "image": "https://images.unsplash.com/photo-1551803091-e20673f15770?w=600&q=80"},  # cropped tee
    {"name": "Pleated Midi Skirt", "brand": "H&M", "price": 49.99, "style": "minimal", "sustainable": True, "colors": ["olive", "stone"],
     "image": "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&q=80"},  # midi skirt
    {"name": "Silk Slip Dress", "brand": "Reformation", "price": 248.00, "style": "old money", "sustainable": True, "colors": ["rust", "cream"],
     "image": "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80"},  # silk slip dress
    {"name": "Logo Knit Cardigan", "brand": "Ganni", "price": 295.00, "style": "vintage", "sustainable": True, "colors": ["brown", "olive"],
     "image": "https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=600&q=80"},  # knit cardigan
    {"name": "Heavyweight Hoodie", "brand": "Everlane", "price": 78.00, "style": "casual", "sustainable": True, "colors": ["grey", "navy", "black"],
     "image": "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80"},  # hoodie
    {"name": "Tailored Wool Coat", "brand": "COS", "price": 350.00, "style": "corporate", "sustainable": True, "colors": ["camel", "black"],
     "image": "https://images.unsplash.com/photo-1532453288672-3a27e9be9efd?w=600&q=80"},  # wool coat
    {"name": "Cargo Pants", "brand": "Zara", "price": 59.99, "style": "streetwear", "sustainable": False, "colors": ["olive", "stone"],
     "image": "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=600&q=80"},  # streetwear cargo
    {"name": "Cropped Athletic Tank", "brand": "Uniqlo", "price": 19.99, "style": "athletic", "sustainable": False, "colors": ["black", "white"],
     "image": "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&q=80"},  # athletic top
    {"name": "Leather Chelsea Boots", "brand": "Acne Studios", "price": 540.00, "style": "old money", "sustainable": False, "colors": ["black", "brown"],
     "image": "https://images.unsplash.com/photo-1564859228273-274232fdb516?w=600&q=80"},  # boots
    {"name": "Linen Button-Up", "brand": "Everlane", "price": 88.00, "style": "minimal", "sustainable": True, "colors": ["white", "stone"],
     "image": "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&q=80"},  # white shirt
    {"name": "High Rise Mom Jeans", "brand": "Levi's", "price": 98.00, "style": "vintage", "sustainable": True, "colors": ["navy"],
     "image": "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&q=80"},  # vintage denim
    {"name": "Ribbed Tank Top", "brand": "H&M", "price": 12.99, "style": "minimal", "sustainable": False, "colors": ["white", "black", "cream"],
     "image": "https://images.unsplash.com/photo-1518049362265-d5b2a6467637?w=600&q=80"},  # minimal tank
    {"name": "Satin Slip Skirt", "brand": "Aritzia", "price": 138.00, "style": "quiet luxury", "sustainable": False, "colors": ["rust", "olive"],
     "image": "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80"},  # satin/luxury
    {"name": "Graphic Crewneck", "brand": "Zara", "price": 35.99, "style": "streetwear", "sustainable": False, "colors": ["grey", "black"],
     "image": "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&q=80"},  # crewneck
    {"name": "Performance Leggings", "brand": "Uniqlo", "price": 39.99, "style": "athletic", "sustainable": False, "colors": ["black", "navy"],
     "image": "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=600&q=80"},  # athletic leggings
]


# Brand search URL templates — {q} is replaced with the URL-encoded product name
BRAND_SEARCH_URLS: dict = {
    "Zara":         "https://www.zara.com/us/en/search?searchTerm={q}",
    "H&M":          "https://www2.hm.com/en_us/search-results.html?q={q}",
    "Uniqlo":       "https://www.uniqlo.com/us/en/search?q={q}",
    "COS":          "https://www.cos.com/en_usd/search/?q={q}",
    "Aritzia":      "https://www.aritzia.com/us/en/search?q={q}",
    "Reformation":  "https://www.thereformation.com/search?q={q}",
    "Everlane":     "https://www.everlane.com/search?query={q}",
    "Ganni":        "https://www.ganni.com/en-us/search?q={q}",
    "Levi's":       "https://www.levi.com/US/en_US/search?keywords={q}",
    "Acne Studios": "https://www.acnestudios.com/us/en/search?q={q}",
    "Fenty Beauty": "https://fentybeauty.com/search?q={q}",
    "Rare Beauty":  "https://www.rarebeauty.com/search?q={q}",
    "Charlotte Tilbury": "https://www.charlottetilbury.com/us/search/{q}",
}


def get_budget_category(price: float) -> str:
    if price < 50:
        return "Under $50"
    if price < 100:
        return "$50–$100"
    return "$100+"


def build_fashion_products():
    out = []
    for i, p in enumerate(FASHION_PRODUCTS):
        # Use per-product image if set, otherwise fall back to pool by index
        image = p.get("image") or FASHION_IMAGES[i % len(FASHION_IMAGES)]
        out.append({
            "id": str(uuid.uuid4()),
            "type": "fashion",
            "name": p["name"],
            "brand": p["brand"],
            "price": p["price"],
            "image": image,
            "colors": p["colors"],
            "sizes": SIZES,
            "style": p["style"],
            "sustainable": p["sustainable"],
            "budget_category": get_budget_category(p["price"]),
            "description": f"A {p['style']} {p['name'].lower()} crafted by {p['brand']}. Versatile, refined, and made to layer.",
            "created_at": datetime.now(timezone.utc).isoformat(),
            # Direct retailer search URL for this product
            "retailer_url": BRAND_SEARCH_URLS.get(p["brand"], "").replace("{q}", p["name"].replace(" ", "+")),
        })
    return out


# Beauty products
BEAUTY_IMAGES = [
    "https://images.unsplash.com/photo-1631214540242-3cd8c4b0b3b8?w=600&q=80",  # foundation
    "https://images.unsplash.com/photo-1599733589046-8a35aef5b3f4?w=600&q=80",  # concealer
    "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&q=80",  # lipstick
    "https://images.unsplash.com/photo-1583241800698-9c2e3b6c0c6e?w=600&q=80",  # blush
    "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=600&q=80",  # eyeshadow
    "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&q=80",  # bronzer
    "https://images.unsplash.com/photo-1522335789203-aaa6efa3f5ed?w=600&q=80",  # makeup
    "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600&q=80",  # serum
    "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80",  # mascara
    "https://images.unsplash.com/photo-1631730486572-226d1f595b68?w=600&q=80",  # contour
]

BEAUTY_PRODUCTS = [
    # Foundations
    {"name": "Pro Filt'r Soft Matte Foundation", "brand": "Fenty Beauty", "category": "foundation", "price": 41.00,
     "shades": ["110", "150", "180", "230", "290", "330", "380", "430", "480"],
     "skin_tones": ["fair", "light", "medium", "tan", "deep"], "skin_types": ["oily", "combination", "normal"],
     "cruelty_free": True, "ingredient_safety": "Clean (no parabens)", "derm_rating": 4.6, "reviews": 12450},
    {"name": "Liquid Touch Weightless Foundation", "brand": "Rare Beauty", "category": "foundation", "price": 30.00,
     "shades": ["120N", "200W", "260W", "320N", "400W", "470N"],
     "skin_tones": ["light", "medium", "tan", "deep"], "skin_types": ["dry", "normal", "combination"],
     "cruelty_free": True, "ingredient_safety": "Vegan, clean", "derm_rating": 4.7, "reviews": 8920},
    {"name": "Airbrush Flawless Foundation", "brand": "Charlotte Tilbury", "category": "foundation", "price": 55.00,
     "shades": ["2 Fair", "5 Neutral", "8 Warm", "11 Tan", "14 Deep"],
     "skin_tones": ["fair", "light", "medium", "tan", "deep"], "skin_types": ["normal", "combination", "dry"],
     "cruelty_free": True, "ingredient_safety": "Hyaluronic-acid based", "derm_rating": 4.5, "reviews": 6780},
    # Concealers
    {"name": "Pro Filt'r Instant Retouch Concealer", "brand": "Fenty Beauty", "category": "concealer", "price": 29.00,
     "shades": ["120", "210", "290", "340", "410"],
     "skin_tones": ["fair", "light", "medium", "tan", "deep"], "skin_types": ["all"],
     "cruelty_free": True, "ingredient_safety": "Clean", "derm_rating": 4.4, "reviews": 9100},
    {"name": "Liquid Touch Brightening Concealer", "brand": "Rare Beauty", "category": "concealer", "price": 22.00,
     "shades": ["150N", "240W", "330C", "440W"],
     "skin_tones": ["light", "medium", "tan", "deep"], "skin_types": ["dry", "normal"],
     "cruelty_free": True, "ingredient_safety": "Vegan, niacinamide", "derm_rating": 4.6, "reviews": 7340},
    # Lips
    {"name": "Soft Pinch Tinted Lip Oil", "brand": "Rare Beauty", "category": "lip", "price": 22.00,
     "shades": ["Joy", "Hope", "Faith", "Believe", "Inspire"],
     "skin_tones": ["all"], "skin_types": ["all"],
     "cruelty_free": True, "ingredient_safety": "Jojoba + avocado oil", "derm_rating": 4.8, "reviews": 15200},
    {"name": "Pillow Talk Lipstick", "brand": "Charlotte Tilbury", "category": "lip", "price": 38.00,
     "shades": ["Original", "Medium", "Intense", "Big"],
     "skin_tones": ["all"], "skin_types": ["all"],
     "cruelty_free": True, "ingredient_safety": "Clean", "derm_rating": 4.9, "reviews": 18420},
    {"name": "Gloss Bomb Universal Lip Luminizer", "brand": "Fenty Beauty", "category": "lip", "price": 21.00,
     "shades": ["Fenty Glow", "Diamond Milk", "Hot Chocolit", "Riri"],
     "skin_tones": ["all"], "skin_types": ["all"],
     "cruelty_free": True, "ingredient_safety": "Shea butter base", "derm_rating": 4.7, "reviews": 21000},
    # Blush
    {"name": "Soft Pinch Liquid Blush", "brand": "Rare Beauty", "category": "blush", "price": 23.00,
     "shades": ["Joy", "Bliss", "Hope", "Encourage", "Grateful"],
     "skin_tones": ["all"], "skin_types": ["all"],
     "cruelty_free": True, "ingredient_safety": "Vegan", "derm_rating": 4.8, "reviews": 26000},
    {"name": "Cheek-Hugging Blush", "brand": "Fenty Beauty", "category": "blush", "price": 24.00,
     "shades": ["Strawberry Drip", "Petal Poppin", "Daiquiri Dip"],
     "skin_tones": ["all"], "skin_types": ["all"],
     "cruelty_free": True, "ingredient_safety": "Clean", "derm_rating": 4.5, "reviews": 8800},
    # Contour
    {"name": "Match Stix Matte Contour Skinstick", "brand": "Fenty Beauty", "category": "contour", "price": 27.00,
     "shades": ["Amber", "Truffle", "Mocha", "Espresso"],
     "skin_tones": ["light", "medium", "tan", "deep"], "skin_types": ["all"],
     "cruelty_free": True, "ingredient_safety": "Clean", "derm_rating": 4.6, "reviews": 7400},
    {"name": "Hollywood Contour Wand", "brand": "Charlotte Tilbury", "category": "contour", "price": 42.00,
     "shades": ["Fair", "Medium", "Tan", "Deep"],
     "skin_tones": ["fair", "light", "medium", "tan", "deep"], "skin_types": ["normal", "dry"],
     "cruelty_free": True, "ingredient_safety": "Hyaluronic-acid", "derm_rating": 4.7, "reviews": 5600},
    # Eyes
    {"name": "Perfect Strokes Matte Liquid Liner", "brand": "Rare Beauty", "category": "eye", "price": 20.00,
     "shades": ["Daring", "Bold", "Mysterious"],
     "skin_tones": ["all"], "skin_types": ["all"],
     "cruelty_free": True, "ingredient_safety": "Vegan", "derm_rating": 4.5, "reviews": 4200},
    {"name": "Pillow Talk Eyeshadow Palette", "brand": "Charlotte Tilbury", "category": "eye", "price": 56.00,
     "shades": ["Original", "Dreams"],
     "skin_tones": ["all"], "skin_types": ["all"],
     "cruelty_free": True, "ingredient_safety": "Clean", "derm_rating": 4.8, "reviews": 9200},
    {"name": "Snap Shadows Mix & Match Palette", "brand": "Fenty Beauty", "category": "eye", "price": 29.00,
     "shades": ["Cool Neutrals", "Rose", "Smoky"],
     "skin_tones": ["all"], "skin_types": ["all"],
     "cruelty_free": True, "ingredient_safety": "Clean", "derm_rating": 4.4, "reviews": 5300},
]


def build_beauty_products():
    out = []
    for i, p in enumerate(BEAUTY_PRODUCTS):
        image = p.get("image") or BEAUTY_IMAGES[i % len(BEAUTY_IMAGES)]
        retailer_url = BRAND_SEARCH_URLS.get(p["brand"], "").replace("{q}", p["name"].replace(" ", "+"))
        out.append({
            "id": str(uuid.uuid4()),
            "type": "beauty",
            "name": p["name"],
            "brand": p["brand"],
            "category": p["category"],
            "price": p["price"],
            "image": image,
            "shades": p["shades"],
            "compatible_skin_tones": p["skin_tones"],
            "compatible_skin_types": p["skin_types"],
            "cruelty_free": p["cruelty_free"],
            "ingredient_safety": p["ingredient_safety"],
            "derm_rating": p["derm_rating"],
            "reviews": p["reviews"],
            "trending": p["reviews"] > 10000,
            "description": f"{p['name']} from {p['brand']} — beloved for its formula and shade range.",
            "retailer_url": retailer_url,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    return out
