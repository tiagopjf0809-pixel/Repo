/**
 * Lumi Affiliate Link Engine
 *
 * Strategy (priority order):
 *  1. Brand-specific affiliate link  → highest commission, requires per-brand signup
 *  2. Skimlinks universal wrapper    → covers all merchants, one signup, 75% revenue share
 *  3. Direct URL                     → no commission, fallback only
 *
 * ─── HOW TO SET UP ───────────────────────────────────────────────────────────
 *
 * STEP 1 — Skimlinks (do this first, covers everything automatically)
 *   Sign up at: https://skimlinks.com/join-us/publishers/
 *   Get your Publisher ID from: Dashboard → Tools → Your API key / Publisher ID
 *   It looks like: 123456X1234567
 *   Paste it below as SKIMLINKS_ID.
 *   Commission: 3–15% depending on merchant (Skimlinks takes 25% cut of that).
 *
 * STEP 2 — Brand-specific programs (optional, higher rates)
 *   Each network below has better commission rates than Skimlinks for those brands.
 *   Sign up, get approved, add your ID to the relevant section.
 *
 *   Network       URL                          Brands covered
 *   ──────────────────────────────────────────────────────────
 *   Impact        impact.com                   Reformation, Everlane, Ganni, Rare Beauty
 *   CJ Affiliate  cj.com                       Uniqlo, Levi's, Aritzia
 *   AWIN          awin.com                     H&M, COS, Charlotte Tilbury
 *   Rakuten       rakuten.com/publishers        Fenty Beauty, Zara*
 *   LTK           shopltk.com                  Most fashion brands (influencer-focused)
 *
 *   * Zara/Acne Studios rarely approve affiliate applications — Skimlinks is the
 *     only reliable route for those brands.
 *
 * ─── COMMISSION RATES (approximate) ─────────────────────────────────────────
 *   Rare Beauty        10–12%    Reformation     10%
 *   Charlotte Tilbury   8%       Ganni           10%
 *   Fenty Beauty        7–10%    Aritzia         5–10%
 *   H&M / COS           5–7%     Everlane        5–8%
 *   Levi's              4–6%     Uniqlo          3–5%
 *   Zara / Acne         3–5%     (Skimlinks only)
 */

// ─── STEP 1: Skimlinks ────────────────────────────────────────────────────────
// Replace with your Publisher ID from skimlinks.com
const SKIMLINKS_ID = "";  // e.g. "123456X1234567"

// ─── STEP 2: Brand-specific affiliate IDs ────────────────────────────────────
// Fill these in after getting approved by each network.
// Leave blank to fall back to Skimlinks for that brand.

const IMPACT_ID        = "";  // from impact.com → Settings → Publisher Info
const CJ_PUBLISHER_ID  = "";  // from cj.com → Account → CID
const AWIN_PUBLISHER_ID = ""; // from awin.com → Account → Publisher ID
const RAKUTEN_ID       = "";  // from rakuten.com/publishers → Your ID

// Merchant IDs on each network (don't change these)
const MERCHANT_IDS = {
  impact: {
    "Reformation":  "1455",    // impact.com merchant ID
    "Everlane":     "6171",
    "Ganni":        "3076",
    "Rare Beauty":  "2970",
  },
  cj: {
    "Uniqlo":       "3696841",
    "Levi's":       "3161541",
    "Aritzia":      "5472591",
  },
  awin: {
    "H&M":          "18468",
    "COS":          "18468",   // H&M Group
    "Charlotte Tilbury": "6137",
  },
  rakuten: {
    "Fenty Beauty": "45086",
    "Zara":         "35898",
  },
};

// ─── URL builders per network ─────────────────────────────────────────────────

function impactUrl(merchantId: string, destinationUrl: string): string {
  return `https://r.impact.com/c/${IMPACT_ID}/${merchantId}?u=${encodeURIComponent(destinationUrl)}`;
}

function cjUrl(publisherId: string, merchantId: string, destinationUrl: string): string {
  return `https://www.jdoqocy.com/click-${publisherId}-${merchantId}?url=${encodeURIComponent(destinationUrl)}`;
}

function awinUrl(publisherId: string, merchantId: string, destinationUrl: string): string {
  return `https://www.awin1.com/cread.php?awinmid=${merchantId}&awinaffid=${publisherId}&clickref=lumi&p=${encodeURIComponent(destinationUrl)}`;
}

function rakutenUrl(publisherId: string, merchantId: string, destinationUrl: string): string {
  return `https://click.linksynergy.com/deeplink?id=${publisherId}&mid=${merchantId}&murl=${encodeURIComponent(destinationUrl)}`;
}

function skimlinkUrl(destinationUrl: string): string {
  return `https://go.skimresources.com?id=${SKIMLINKS_ID}&url=${encodeURIComponent(destinationUrl)}`;
}

// ─── Brand search URL templates ───────────────────────────────────────────────

export const BRAND_SEARCH_URLS: Record<string, (productName: string) => string> = {
  "Zara":              (n) => `https://www.zara.com/us/en/search?searchTerm=${encodeURIComponent(n)}`,
  "H&M":               (n) => `https://www2.hm.com/en_us/search-results.html?q=${encodeURIComponent(n)}`,
  "Uniqlo":            (n) => `https://www.uniqlo.com/us/en/search?q=${encodeURIComponent(n)}`,
  "COS":               (n) => `https://www.cos.com/en_usd/search/?q=${encodeURIComponent(n)}`,
  "Aritzia":           (n) => `https://www.aritzia.com/us/en/search?q=${encodeURIComponent(n)}`,
  "Reformation":       (n) => `https://www.thereformation.com/search?q=${encodeURIComponent(n)}`,
  "Everlane":          (n) => `https://www.everlane.com/search?query=${encodeURIComponent(n)}`,
  "Ganni":             (n) => `https://www.ganni.com/en-us/search?q=${encodeURIComponent(n)}`,
  "Levi's":            (n) => `https://www.levi.com/US/en_US/search?keywords=${encodeURIComponent(n)}`,
  "Acne Studios":      (n) => `https://www.acnestudios.com/us/en/search?q=${encodeURIComponent(n)}`,
  "Fenty Beauty":      (n) => `https://fentybeauty.com/search?q=${encodeURIComponent(n)}`,
  "Rare Beauty":       (n) => `https://www.rarebeauty.com/search?q=${encodeURIComponent(n)}`,
  "Charlotte Tilbury": (n) => `https://www.charlottetilbury.com/us/search/${encodeURIComponent(n)}`,
};

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Returns the best affiliate URL for a product.
 * Priority: brand-specific network → Skimlinks → direct URL
 */
export function buildAffiliateUrl(brand: string, productName: string, storedUrl?: string): string {
  // Build the destination URL (what we want the user to land on)
  const searchUrlFn = BRAND_SEARCH_URLS[brand];
  const destination = storedUrl || (searchUrlFn ? searchUrlFn(productName) : null);

  if (!destination) return "";

  // ── 1. Brand-specific affiliate programs (best commission rates) ─────────────

  if (IMPACT_ID) {
    const mid = MERCHANT_IDS.impact[brand as keyof typeof MERCHANT_IDS.impact];
    if (mid) return impactUrl(mid, destination);
  }

  if (CJ_PUBLISHER_ID) {
    const mid = MERCHANT_IDS.cj[brand as keyof typeof MERCHANT_IDS.cj];
    if (mid) return cjUrl(CJ_PUBLISHER_ID, mid, destination);
  }

  if (AWIN_PUBLISHER_ID) {
    const mid = MERCHANT_IDS.awin[brand as keyof typeof MERCHANT_IDS.awin];
    if (mid) return awinUrl(AWIN_PUBLISHER_ID, mid, destination);
  }

  if (RAKUTEN_ID) {
    const mid = MERCHANT_IDS.rakuten[brand as keyof typeof MERCHANT_IDS.rakuten];
    if (mid) return rakutenUrl(RAKUTEN_ID, mid, destination);
  }

  // ── 2. Skimlinks universal fallback (covers all merchants) ──────────────────
  if (SKIMLINKS_ID) return skimlinkUrl(destination);

  // ── 3. Direct URL — no commission ──────────────────────────────────────────
  return destination;
}

/**
 * Returns true if affiliate tracking is active (at least Skimlinks is configured).
 */
export function isAffiliateReady(): boolean {
  return !!(SKIMLINKS_ID || IMPACT_ID || CJ_PUBLISHER_ID || AWIN_PUBLISHER_ID || RAKUTEN_ID);
}
