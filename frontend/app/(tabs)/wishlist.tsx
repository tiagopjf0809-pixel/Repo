import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";
import { colors, radii, spacing, typography, shadows } from "../../src/theme";

type Tab = "wishlist" | "cart";

export default function WishlistTab() {
  const [tab, setTab] = useState<Tab>("wishlist");
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [w, c] = await Promise.all([api.get("/wishlist"), api.get("/cart")]);
      setWishlist(w.data.items);
      setCart(c.data.items);
      setSubtotal(c.data.subtotal);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const removeWish = async (pid: string) => {
    await api.delete(`/wishlist/${pid}`); refresh();
  };
  const updateQty = async (itemId: string, qty: number) => {
    await api.patch(`/cart/${itemId}`, { quantity: qty }); refresh();
  };
  const removeCart = async (itemId: string) => {
    await api.delete(`/cart/${itemId}`); refresh();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.brand}>Saved</Text>
        <Text style={styles.sub}>Wishlist & smart cart</Text>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          testID="tab-wishlist-inner"
          style={[styles.tab, tab === "wishlist" && styles.tabActive]}
          onPress={() => setTab("wishlist")}
        >
          <Ionicons name="heart-outline" size={14} color={tab === "wishlist" ? "#fff" : colors.textMain} />
          <Text style={[styles.tabText, tab === "wishlist" && { color: "#fff" }]}>Wishlist · {wishlist.length}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="tab-cart-inner"
          style={[styles.tab, tab === "cart" && styles.tabActive]}
          onPress={() => setTab("cart")}
        >
          <Ionicons name="bag-outline" size={14} color={tab === "cart" ? "#fff" : colors.textMain} />
          <Text style={[styles.tabText, tab === "cart" && { color: "#fff" }]}>Cart · {cart.length}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : tab === "wishlist" ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          {wishlist.length === 0 && (
            <EmptyState
              icon="heart-outline"
              title="Nothing saved yet"
              subtitle="Tap the heart on items you love to save them here."
            />
          )}
          <View style={styles.grid}>
            {wishlist.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.gcard}
                onPress={() => router.push({ pathname: "/product/[id]", params: { id: p.id } })}
                activeOpacity={0.9}
                testID={`wishlist-item-${p.id}`}
              >
                <Image source={{ uri: p.image }} style={styles.gimg} />
                <TouchableOpacity
                  testID={`wishlist-remove-${p.id}`}
                  style={styles.removeBtn}
                  onPress={() => removeWish(p.id)}
                >
                  <Ionicons name="close" size={14} color={colors.textMain} />
                </TouchableOpacity>
                <View style={{ padding: 10 }}>
                  <Text style={styles.brandText}>{p.brand}</Text>
                  <Text style={styles.nameText} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.priceText}>${p.price.toFixed(2)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {cart.length === 0 ? (
            <EmptyState
              icon="bag-outline"
              title="Your cart is empty"
              subtitle="Add items to start building your look."
            />
          ) : (
            <>
              {cart.map((it) => (
                <View key={it.id} style={styles.cartRow} testID={`cart-item-${it.id}`}>
                  <Image source={{ uri: it.product.image }} style={styles.cartImg} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.brandText}>{it.product.brand}</Text>
                    <Text style={styles.nameText} numberOfLines={2}>{it.product.name}</Text>
                    <Text style={styles.metaText}>
                      Size {it.size || "—"} · {it.color || "—"}
                    </Text>
                    <View style={styles.qtyRow}>
                      <TouchableOpacity
                        testID={`cart-dec-${it.id}`}
                        style={styles.qtyBtn}
                        onPress={() => updateQty(it.id, Math.max(0, it.quantity - 1))}
                      >
                        <Ionicons name="remove" size={14} color={colors.textMain} />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{it.quantity}</Text>
                      <TouchableOpacity
                        testID={`cart-inc-${it.id}`}
                        style={styles.qtyBtn}
                        onPress={() => updateQty(it.id, it.quantity + 1)}
                      >
                        <Ionicons name="add" size={14} color={colors.textMain} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID={`cart-remove-${it.id}`}
                        style={[styles.qtyBtn, { marginLeft: "auto" }]}
                        onPress={() => removeCart(it.id)}
                      >
                        <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.priceText}>${it.line_total.toFixed(2)}</Text>
                </View>
              ))}
              <View style={styles.summary}>
                <Text style={typography.overline}>Subtotal</Text>
                <Text style={styles.subtotalAmt}>${subtotal.toFixed(2)}</Text>
              </View>
              <TouchableOpacity testID="checkout-btn" style={styles.checkoutBtn} activeOpacity={0.85}>
                <Text style={styles.checkoutText}>Checkout · ${subtotal.toFixed(2)}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function EmptyState({ icon, title, subtitle }: any) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={36} color={colors.primary} />
      </View>
      <Text style={[typography.h3, { textAlign: "center" }]}>{title}</Text>
      <Text style={[typography.body, { textAlign: "center", marginTop: 6 }]}>{subtitle}</Text>
      <TouchableOpacity
        style={styles.exploreBtn}
        onPress={() => router.push("/(tabs)/discover")}
        testID="empty-explore"
      >
        <Text style={styles.exploreText}>Explore feed</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md },
  brand: { fontSize: 32, fontWeight: "300", fontStyle: "italic", color: colors.textMain },
  sub: { ...typography.small },
  tabRow: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: 8, marginBottom: spacing.md },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 11, borderRadius: radii.pill, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.ctaBg, borderColor: colors.ctaBg },
  tabText: { fontSize: 13, fontWeight: "600", color: colors.textMain },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  gcard: {
    width: "48%", backgroundColor: colors.surface, borderRadius: radii.lg,
    overflow: "hidden", marginBottom: 12, borderWidth: 1, borderColor: colors.borderSoft, ...shadows.card,
  },
  gimg: { width: "100%", height: 180, backgroundColor: colors.surfaceSecondary },
  removeBtn: {
    position: "absolute", top: 8, right: 8, backgroundColor: "#FFFFFFE6",
    width: 26, height: 26, borderRadius: 999, alignItems: "center", justifyContent: "center",
  },
  brandText: { ...typography.brand },
  nameText: { fontSize: 13, color: colors.textMain, fontWeight: "500", marginTop: 2 },
  priceText: { ...typography.price, marginTop: 4 },
  metaText: { fontSize: 11, color: colors.textMuted, textTransform: "capitalize" },
  cartRow: {
    flexDirection: "row", gap: 12, padding: 12, backgroundColor: colors.surface,
    borderRadius: radii.lg, marginBottom: 10, borderWidth: 1, borderColor: colors.borderSoft, ...shadows.card,
  },
  cartImg: { width: 80, height: 100, borderRadius: radii.md, backgroundColor: colors.surfaceSecondary },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  qtyBtn: {
    width: 26, height: 26, borderRadius: 999, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  qtyText: { fontSize: 13, fontWeight: "600", color: colors.textMain, minWidth: 18, textAlign: "center" },
  summary: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 12, paddingHorizontal: 4,
  },
  subtotalAmt: { fontSize: 22, fontWeight: "600", color: colors.textMain },
  checkoutBtn: {
    backgroundColor: colors.ctaBg, paddingVertical: 16, borderRadius: radii.pill,
    alignItems: "center", marginTop: 16, ...shadows.cta,
  },
  checkoutText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 20 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 999, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  exploreBtn: { marginTop: 18, paddingVertical: 12, paddingHorizontal: 26, borderRadius: radii.pill, backgroundColor: colors.ctaBg },
  exploreText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
