import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { api } from "../../src/api";
import { colors, radii, spacing, typography, shadows } from "../../src/theme";

// Brand-specific product search URLs — opens directly to search results for the item
const BRAND_SEARCH_URLS: Record<string, (name: string) => string> = {
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

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [p, setP] = useState<any>(null);
  const [similar, setSimilar] = useState<any[]>([]);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [alertTarget, setAlertTarget] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("No product specified");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api.get(`/products/${id}`)
      .then((r) => {
        setP(r.data);
        setSize(r.data.sizes?.[0] || null);
        setColor(r.data.colors?.[0] || r.data.shades?.[0] || null);
        // Track view for retailer analytics (fire-and-forget)
        api.post(`/products/${id}/track`, { product_id: id, event: "view" }).catch(() => {});
      })
      .catch((e) => {
        setError(e?.response?.status === 404 ? "Product not found" : "Failed to load product");
      })
      .finally(() => setLoading(false));
    api.get(`/products/${id}/similar`).then((r) => setSimilar(r.data.items)).catch(() => {});
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !p) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
          <Text style={[typography.h3, { marginTop: 12, textAlign: "center" }]}>
            {error || "Product unavailable"}
          </Text>
          <TouchableOpacity
            testID="error-back-button"
            style={styles.errorBtn}
            onPress={() => router.back()}
          >
            <Text style={styles.errorBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isBeauty = p.type === "beauty";

  const addCart = async () => {
    try {
      await api.post("/cart", { product_id: p.id, size, color, quantity: 1 });
      api.post(`/products/${p.id}/track`, { product_id: p.id, event: "click" }).catch(() => {});
      setFeedback("Added to cart");
      setTimeout(() => setFeedback(null), 1800);
    } catch {
      setFeedback("Failed to add — try again");
      setTimeout(() => setFeedback(null), 1800);
    }
  };
  const wish = async () => {
    try {
      await api.post("/wishlist", { product_id: p.id });
      setFeedback("Saved to wishlist");
      setTimeout(() => setFeedback(null), 1800);
    } catch {
      setFeedback("Failed to save");
      setTimeout(() => setFeedback(null), 1800);
    }
  };
  const createAlert = async () => {
    try {
      const target = Math.round(p.price * 0.9 * 100) / 100;
      await api.post("/price-alerts", { product_id: p.id, target_price: target });
      setAlertTarget(target);
      setFeedback(`Price alert set: $${target}`);
      setTimeout(() => setFeedback(null), 1800);
    } catch {
      setFeedback("Failed to set alert");
      setTimeout(() => setFeedback(null), 1800);
    }
  };
  const openRetailer = async () => {
    // Use the stored retailer_url from the product (product-specific search), or build one from brand map
    const storedUrl: string | undefined = p.retailer_url;
    const buildUrl = BRAND_SEARCH_URLS[p.brand];

    const url = storedUrl || (buildUrl ? buildUrl(p.name) : null);

    if (!url) {
      Alert.alert(
        "Retailer site unavailable",
        `We don't have a direct link for ${p.brand} yet. Try searching their website manually.`
      );
      return;
    }

    api.post(`/products/${p.id}/track`, { product_id: p.id, event: "click" }).catch(() => {});

    // Open in in-app browser — user stays in Lumi, can come back easily
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
      toolbarColor: colors.background,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }}>
        <View style={styles.imgWrap}>
          <Image source={{ uri: p.image }} style={styles.img} />
          <TouchableOpacity testID="back-button" style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={colors.textMain} />
          </TouchableOpacity>
          <TouchableOpacity testID="detail-wish-button" style={styles.wishBtn} onPress={wish}>
            <Ionicons name="heart-outline" size={20} color={colors.textMain} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <Text style={typography.brand}>{p.brand}</Text>
          <Text style={styles.name}>{p.name}</Text>
          <Text style={styles.price}>${p.price.toFixed(2)}</Text>

          {p.description && <Text style={[typography.body, { marginTop: 12 }]}>{p.description}</Text>}

          {/* Fashion-specific */}
          {!isBeauty && p.colors?.length > 0 && (
            <Section title={`Color · ${color || ""}`}>
              <View style={styles.row}>
                {p.colors.map((c: string) => (
                  <TouchableOpacity
                    key={c}
                    testID={`color-${c}`}
                    style={[styles.colorPicker, color === c && styles.colorPickerActive]}
                    onPress={() => setColor(c)}
                  >
                    <View style={[styles.swatch, { backgroundColor: colorMap[c] || c }]} />
                    <Text style={styles.swatchText}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Section>
          )}

          {!isBeauty && p.sizes?.length > 0 && (
            <Section title="Size">
              <View style={styles.row}>
                {p.sizes.map((s: string) => (
                  <TouchableOpacity
                    key={s}
                    testID={`size-${s}`}
                    style={[styles.sizePicker, size === s && styles.sizePickerActive]}
                    onPress={() => setSize(s)}
                  >
                    <Text style={[styles.sizeText, size === s && { color: "#fff" }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Section>
          )}

          {/* Beauty-specific */}
          {isBeauty && (
            <>
              {p.shades?.length > 0 && (
                <Section title={`Shade · ${color || ""}`}>
                  <View style={styles.row}>
                    {p.shades.map((s: string) => (
                      <TouchableOpacity
                        key={s}
                        testID={`shade-${s}`}
                        style={[styles.sizePicker, color === s && styles.sizePickerActive]}
                        onPress={() => setColor(s)}
                      >
                        <Text style={[styles.sizeText, color === s && { color: "#fff" }]}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Section>
              )}
              <Section title="Transparency">
                <View style={styles.transparencyGrid}>
                  <TBadge icon="paw-outline" label={p.cruelty_free ? "Cruelty-free" : "Not certified"} ok={!!p.cruelty_free} />
                  <TBadge icon="leaf-outline" label={p.ingredient_safety || "Clean"} ok />
                  <TBadge icon="star" label={`Derm ${p.derm_rating}`} ok />
                  <TBadge icon="people-outline" label={`${(p.reviews / 1000).toFixed(1)}k reviews`} ok />
                </View>
              </Section>
            </>
          )}

          {p.sustainable && !isBeauty && (
            <View style={styles.sustainBanner}>
              <Ionicons name="leaf-outline" size={14} color={colors.success} />
              <Text style={styles.sustainText}>Sustainable / ethical brand</Text>
            </View>
          )}

          {/* Universal CTA: Shop at retailer */}
          <TouchableOpacity
            testID="shop-at-retailer"
            style={styles.retailerCta}
            onPress={openRetailer}
            activeOpacity={0.85}
          >
            <View style={styles.retailerIcon}>
              <Ionicons name="storefront-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.retailerTitle}>
                {isBeauty ? "Buy on Official Site" : "Shop This Item"}
              </Text>
              <Text style={styles.retailerSub}>
                Search {p.brand} for "{p.name.length > 28 ? p.name.slice(0, 28) + "…" : p.name}"
              </Text>
            </View>
            <Ionicons name="open-outline" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          {!isBeauty && (
            <View style={styles.actionTwoCol}>
              <TouchableOpacity
                testID="find-in-store"
                style={styles.actionCol}
                onPress={() => router.push(`/stores?product_id=${p.id}` as any)}
              >
                <Ionicons name="location-outline" size={16} color={colors.textMain} />
                <View>
                  <Text style={styles.actionTitle}>Find in store</Text>
                  <Text style={styles.actionSub}>Reserve · compare prices</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={{ marginLeft: "auto" }} />
              </TouchableOpacity>
              <TouchableOpacity
                testID="price-alert"
                style={styles.actionCol}
                onPress={createAlert}
              >
                <Ionicons name="notifications-outline" size={16} color={colors.textMain} />
                <View>
                  <Text style={styles.actionTitle}>{alertTarget ? `Alert at $${alertTarget}` : "Price alert"}</Text>
                  <Text style={styles.actionSub}>Notify on sale (-10%)</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={{ marginLeft: "auto" }} />
              </TouchableOpacity>
            </View>
          )}

          {similar.length > 0 && (
            <Section title="You might also like">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {similar.map((s: any) => (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.simCard}
                    onPress={() => router.push(`/product/${s.id}` as any)}
                    testID={`similar-${s.id}`}
                  >
                    <Image source={{ uri: s.image }} style={styles.simImg} />
                    <Text style={styles.simBrand}>{s.brand}</Text>
                    <Text style={styles.simPrice}>${s.price.toFixed(2)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Section>
          )}
        </View>
      </ScrollView>

      {feedback && (
        <View style={styles.toast}><Text style={styles.toastText}>{feedback}</Text></View>
      )}

      <View style={styles.bottomBar}>
        <TouchableOpacity testID="detail-wish-bottom" style={styles.wishSide} onPress={wish}>
          <Ionicons name="heart-outline" size={20} color={colors.textMain} />
        </TouchableOpacity>
        <TouchableOpacity testID="detail-add-cart" style={styles.addCartBtn} onPress={addCart}>
          <Ionicons name="bag-add-outline" size={18} color="#fff" />
          <Text style={styles.addCartText}>Add to cart</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const colorMap: Record<string, string> = {
  beige: "#D6C2A8", black: "#1a1a1a", white: "#F5F1EB", cream: "#EDE4D3",
  olive: "#6B7141", navy: "#243047", brown: "#5C3A20", grey: "#888378",
  rust: "#A8442A", stone: "#B8AA94", camel: "#B68B57",
};

function Section({ title, children }: any) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={[typography.overline, { marginBottom: 10 }]}>{title}</Text>
      {children}
    </View>
  );
}

function TBadge({ icon, label, ok }: { icon: any; label: string; ok: boolean }) {
  return (
    <View style={[styles.tbadge, !ok && { opacity: 0.5 }]}>
      <Ionicons name={icon} size={14} color={ok ? colors.success : colors.textMuted} />
      <Text style={styles.tbadgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  imgWrap: { width: "100%", height: 460, backgroundColor: colors.surfaceSecondary },
  img: { width: "100%", height: "100%" },
  backBtn: {
    position: "absolute", top: spacing.md, left: spacing.md,
    width: 38, height: 38, borderRadius: 999, backgroundColor: "#FFFFFFE6",
    alignItems: "center", justifyContent: "center",
  },
  wishBtn: {
    position: "absolute", top: spacing.md, right: spacing.md,
    width: 38, height: 38, borderRadius: 999, backgroundColor: "#FFFFFFE6",
    alignItems: "center", justifyContent: "center",
  },
  body: { padding: spacing.xl },
  name: { fontSize: 24, fontWeight: "500", color: colors.textMain, marginTop: 4, letterSpacing: -0.4 },
  price: { fontSize: 20, fontWeight: "600", color: colors.textMain, marginTop: 6 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  colorPicker: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: radii.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  colorPickerActive: { borderColor: colors.ctaBg, borderWidth: 1.5 },
  swatch: { width: 14, height: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.borderSoft },
  swatchText: { fontSize: 11.5, color: colors.textMain, textTransform: "capitalize" },
  sizePicker: {
    minWidth: 50, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center",
  },
  sizePickerActive: { backgroundColor: colors.ctaBg, borderColor: colors.ctaBg },
  sizeText: { fontSize: 13, color: colors.textMain, fontWeight: "600" },
  transparencyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tbadge: {
    flexDirection: "row", gap: 6, alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: radii.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  tbadgeText: { fontSize: 12, color: colors.textMain, fontWeight: "500" },
  sustainBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.sustainBg, padding: 12, borderRadius: radii.md, marginTop: spacing.lg,
  },
  sustainText: { color: colors.sustainText, fontSize: 13, fontWeight: "600" },
  actionTwoCol: { gap: 8, marginTop: spacing.lg },
  actionCol: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
    backgroundColor: colors.surface, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  actionTitle: { fontSize: 13.5, fontWeight: "600", color: colors.textMain },
  actionSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  retailerCta: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface, padding: 14, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.primary,
    marginTop: spacing.lg,
  },
  retailerIcon: {
    width: 36, height: 36, borderRadius: 999,
    backgroundColor: colors.budgetBg, alignItems: "center", justifyContent: "center",
  },
  retailerTitle: { fontSize: 14, fontWeight: "700", color: colors.textMain },
  retailerSub: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorBtn: { marginTop: 18, paddingVertical: 12, paddingHorizontal: 28, borderRadius: radii.pill, backgroundColor: colors.ctaBg },
  errorBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  simCard: { width: 130, marginRight: 10 },
  simImg: { width: "100%", height: 150, borderRadius: radii.md, backgroundColor: colors.surfaceSecondary },
  simBrand: { ...typography.brand, marginTop: 8 },
  simPrice: { fontSize: 13, fontWeight: "600", color: colors.textMain, marginTop: 2 },
  bottomBar: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    flexDirection: "row", gap: 10, padding: spacing.lg,
    backgroundColor: "#FFFFFFE6", borderTopWidth: 1, borderTopColor: colors.border,
  },
  wishSide: {
    width: 52, height: 52, borderRadius: 999, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  addCartBtn: {
    flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8,
    backgroundColor: colors.ctaBg, borderRadius: radii.pill, paddingVertical: 16, ...shadows.cta,
  },
  addCartText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  toast: {
    position: "absolute", bottom: 100, alignSelf: "center",
    backgroundColor: colors.ctaBg, paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: radii.pill, ...shadows.cta,
  },
  toastText: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
