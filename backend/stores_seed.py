"""Mock stores for Lumi — realistic city locations and inventory."""
from datetime import datetime, timezone, timedelta
import random
import uuid

# Default city: NYC SoHo / Lower Manhattan
CITY_CENTER = {"lat": 40.7233, "lng": -74.0030}

STORE_TEMPLATES = [
    {"name": "Zara SoHo", "brand": "Zara", "address": "503 Broadway, New York, NY", "lat": 40.7239, "lng": -74.0010},
    {"name": "Zara Fifth Avenue", "brand": "Zara", "address": "666 5th Ave, New York, NY", "lat": 40.7614, "lng": -73.9755},
    {"name": "H&M Times Square", "brand": "H&M", "address": "1472 Broadway, New York, NY", "lat": 40.7559, "lng": -73.9863},
    {"name": "H&M Herald Square", "brand": "H&M", "address": "111 W 34th St, New York, NY", "lat": 40.7505, "lng": -73.9881},
    {"name": "Uniqlo SoHo", "brand": "Uniqlo", "address": "546 Broadway, New York, NY", "lat": 40.7246, "lng": -74.0006},
    {"name": "Uniqlo 5th Avenue", "brand": "Uniqlo", "address": "666 5th Ave, New York, NY", "lat": 40.7616, "lng": -73.9760},
    {"name": "COS SoHo", "brand": "COS", "address": "129 Spring St, New York, NY", "lat": 40.7250, "lng": -74.0010},
    {"name": "Aritzia Flatiron", "brand": "Aritzia", "address": "89 5th Ave, New York, NY", "lat": 40.7373, "lng": -73.9919},
    {"name": "Reformation NoLita", "brand": "Reformation", "address": "23 Howard St, New York, NY", "lat": 40.7195, "lng": -74.0000},
    {"name": "Everlane SoHo", "brand": "Everlane", "address": "28 Prince St, New York, NY", "lat": 40.7232, "lng": -73.9956},
    {"name": "Ganni West Village", "brand": "Ganni", "address": "374 Bleecker St, New York, NY", "lat": 40.7344, "lng": -74.0054},
    {"name": "Levi's Times Square", "brand": "Levi's", "address": "1535 Broadway, New York, NY", "lat": 40.7589, "lng": -73.9851},
    {"name": "Acne Studios SoHo", "brand": "Acne Studios", "address": "33 Greene St, New York, NY", "lat": 40.7220, "lng": -74.0017},
]


def build_stores():
    out = []
    for s in STORE_TEMPLATES:
        out.append({
            "id": str(uuid.uuid4()),
            "name": s["name"],
            "brand": s["brand"],
            "address": s["address"],
            "lat": s["lat"],
            "lng": s["lng"],
            "hours": "Mon-Sat 10am-9pm, Sun 11am-7pm",
            "phone": f"+1 (212) {random.randint(200, 999)}-{random.randint(1000, 9999):04d}",
        })
    return out
