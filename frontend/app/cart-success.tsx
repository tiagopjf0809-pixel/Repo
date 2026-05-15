import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { colors, radii, spacing, typography, shadows } from "../src/theme";

export default function CartSuccess() {
  const params = useLocalSearchParams<{ session_id?: string; demo?: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    if (!params.session_id) {
      setError("No session id");
      setLoading(false);
      return;
    }
    api.get(`/checkout/session/${params.session_id}`)
      .then(async (r) => {
        setData(r.data);
        const ids = (r.data.order?.items || []).map((i: any) => i.product_id);
        if (ids.length > 0) {
          // fetch product previews
          const fetches = await Promise.all(ids.map((id: string) => api.get(`/products/${id}`).catch(() => null)));
          setProducts(fetches.map((f) => f?.data).filter(Boolean));
        }
      })
      .catch((e) => setError(e?.response?.data?.detail || "Verification failed"))
      .finally(() => setLoading(false));
  }, [params.session_id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[typography.body, { marginTop: 14 }]}>Verifying payment…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data?.paid) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={56} color="#B23A3A" />
          <Text style={[typography.h2, { marginTop: 12, textAlign: "center" }]}>Payment not completed</Text>
          <Text style={[typography.body, { marginTop: 6, textAlign: "center" }]}>{error || "Try again from your cart."}</Text>
          <TouchableOpacity testID="success-back-cart" style={styles.btn} onPress={() => router.replace("/wishlist")}>
            <Text style={styles.btnText}>Back to cart</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const total = (data.amount_total || 0) / 100;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 60 }}>
        <View style={styles.heroIcon}>
          <Ionicons name="checkmark" size={36} color="#fff" />
        </View>
        <Text style={styles.title}>Order confirmed</Text>
        <Text style={[typography.body, { textAlign: "center", marginTop: 6 }]}>
          {data.demo_mode
            ? "Demo checkout completed. (Configure a real Stripe key for live payments.)"
            : "Your payment was successful and your order is on its way."}
        </Text>

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.k}>Order #</Text>
            <Text style={styles.v}>{data.order?.id?.slice(0, 8)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.k}>Items</Text>
            <Text style={styles.v}>{data.order?.items?.length || 0}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.k}>Total paid</Text>
            <Text style={styles.bigPrice}>${total.toFixed(2)}</Text>
          </View>
        </View>

        {products.length > 0 && (
          <>
            <Text style={[typography.overline, { marginTop: spacing.xl, marginBottom: spacing.sm }]}>What you bought</Text>
            <View style={styles.itemsGrid}>
              {products.map((p) => (
                <View key={p.id} style={styles.itemCard} testID={`success-item-${p.id}`}>
                  <Image source={{ uri: p.image }} style={styles.itemImg} />
                  <Text style={typography.brand} numberOfLines={1}>{p.brand}</Text>
                  <Text style={styles.itemName} numberOfLines={2}>{p.name}</Text>
                  <Text style={styles.itemPrice}>${p.price.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity
          testID="success-continue-shopping"
          style={styles.btn}
          onPress={() => router.replace("/discover")}
        >
          <Text style={styles.btnText}>Continue shopping</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  heroIcon: {
    alignSelf: "center", width: 72, height: 72, borderRadius: 999,
    backgroundColor: colors.success, alignItems: "center", justifyContent: "center",
    marginTop: 12, ...shadows.cta,
  },
  title: { fontSize: 28, fontWeight: "500", color: colors.textMain, textAlign: "center", marginTop: 16, letterSpacing: -0.5 },
  summary: {
    marginTop: spacing.xl, padding: spacing.lg, backgroundColor: colors.surface,
    borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderSoft, ...shadows.card,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7 },
  k: { fontSize: 13, color: colors.textMuted },
  v: { fontSize: 13, color: colors.textMain, fontWeight: "600" },
  bigPrice: { fontSize: 18, color: colors.textMain, fontWeight: "700" },
  itemsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 },
  itemCard: {
    width: "48%", padding: 10, backgroundColor: colors.surface, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.borderSoft, marginBottom: 8,
  },
  itemImg: { width: "100%", height: 130, borderRadius: radii.md, backgroundColor: colors.surfaceSecondary, marginBottom: 8 },
  itemName: { fontSize: 13, color: colors.textMain, fontWeight: "500", marginTop: 2 },
  itemPrice: { fontSize: 13, fontWeight: "700", color: colors.textMain, marginTop: 4 },
  btn: {
    marginTop: spacing.xl, backgroundColor: colors.ctaBg, paddingVertical: 16,
    borderRadius: radii.pill, alignItems: "center", ...shadows.cta,
  },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
