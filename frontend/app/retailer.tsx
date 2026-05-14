import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { colors, radii, spacing, typography, shadows } from "../src/theme";

type Analytics = {
  brand: string;
  summary: {
    products: number; views: number; clicks: number; purchases: number;
    wishlist_saves: number; cart_adds: number; ctr_percent: number; conversion_percent: number;
  };
  top_products: any[];
  style_compatibility: { style: string; products_count: number; user_matches: number }[];
};

export default function Retailer() {
  const [brands, setBrands] = useState<string[]>([]);
  const [brand, setBrand] = useState<string | null>(null);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/retailer/brands").then((r) => {
      setBrands(r.data.brands);
      if (r.data.brands.length > 0) setBrand(r.data.brands[0]);
    });
  }, []);

  useEffect(() => {
    if (!brand) return;
    setLoading(true);
    api.get(`/retailer/${encodeURIComponent(brand)}/analytics`)
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [brand]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity testID="retailer-back" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.title}>Retailer Dashboard</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.intro}>
          <Text style={typography.overline}>Brand analytics</Text>
          <Text style={styles.bigTitle}>Performance</Text>
          <Text style={typography.body}>
            How your catalog is performing on Lumi. Switch brands to compare partner accounts.
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.brandRow}
        >
          {brands.map((b) => (
            <TouchableOpacity
              key={b}
              testID={`retailer-brand-${b}`}
              onPress={() => setBrand(b)}
              style={[styles.brandChip, brand === b && styles.brandChipActive]}
            >
              <Text style={[styles.brandText, brand === b && { color: "#fff" }]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading || !data ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* KPI grid */}
            <View style={styles.kpiGrid}>
              <Kpi label="CTR" value={`${data.summary.ctr_percent}%`} icon="trending-up" color={colors.success} />
              <Kpi label="Conversion" value={`${data.summary.conversion_percent}%`} icon="cash-outline" color={colors.primary} />
              <Kpi label="Wishlist saves" value={String(data.summary.wishlist_saves)} icon="heart" color="#B23A3A" />
              <Kpi label="Cart adds" value={String(data.summary.cart_adds)} icon="bag-handle-outline" color={colors.textMain} />
            </View>

            <View style={styles.overviewCard}>
              <View style={styles.overviewRow}>
                <View style={styles.overviewCell}>
                  <Text style={styles.overviewLabel}>Products</Text>
                  <Text style={styles.overviewValue}>{data.summary.products}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.overviewCell}>
                  <Text style={styles.overviewLabel}>Views</Text>
                  <Text style={styles.overviewValue}>{data.summary.views.toLocaleString()}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.overviewCell}>
                  <Text style={styles.overviewLabel}>Clicks</Text>
                  <Text style={styles.overviewValue}>{data.summary.clicks.toLocaleString()}</Text>
                </View>
              </View>
            </View>

            {/* Trending items */}
            <Text style={styles.sectionTitle}>Trending items</Text>
            <View style={{ paddingHorizontal: spacing.lg, gap: 8 }}>
              {data.top_products.map((p, i) => (
                <View key={p.id} style={styles.tRow} testID={`trending-${p.id}`}>
                  <View style={styles.tRank}><Text style={styles.tRankText}>#{i + 1}</Text></View>
                  <Image source={{ uri: p.image }} style={styles.tImg} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tName} numberOfLines={1}>{p.name}</Text>
                    <View style={styles.tMetaRow}>
                      <MiniStat icon="eye-outline" value={p.views} />
                      <MiniStat icon="hand-left-outline" value={p.clicks} />
                      <MiniStat icon="heart-outline" value={p.wishlist_saves} />
                    </View>
                  </View>
                  <Text style={styles.tPrice}>${p.price.toFixed(0)}</Text>
                </View>
              ))}
            </View>

            {/* Style compatibility */}
            <Text style={styles.sectionTitle}>Style compatibility</Text>
            <View style={styles.styleCard}>
              {data.style_compatibility.map((s) => (
                <View key={s.style} style={styles.styleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.styleName}>{s.style}</Text>
                    <Text style={styles.styleSub}>{s.products_count} items · {s.user_matches} users match</Text>
                  </View>
                  <View style={styles.bar}>
                    <View style={[styles.barFill, {
                      width: `${Math.min(100, Math.max(8, s.user_matches * 30))}%`,
                    }]} />
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.ctaCard}>
              <Ionicons name="rocket-outline" size={24} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.ctaTitle}>Boost a campaign</Text>
                <Text style={styles.ctaSub}>Target users matching your trending styles with a featured slot.</Text>
              </View>
              <TouchableOpacity testID="retailer-boost" style={styles.ctaBtn}>
                <Text style={styles.ctaBtnText}>Set up</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Kpi({ label, value, icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <View style={styles.kpiCard} testID={`kpi-${label.replace(/\s+/g, "-")}`}>
      <View style={[styles.kpiIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function MiniStat({ icon, value }: { icon: any; value: number }) {
  return (
    <View style={styles.miniStat}>
      <Ionicons name={icon} size={11} color={colors.textMuted} />
      <Text style={styles.miniStatText}>{value.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  title: { fontSize: 16, fontWeight: "600", color: colors.textMain },
  intro: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  bigTitle: { fontSize: 32, fontWeight: "300", color: colors.textMain, marginVertical: 4, letterSpacing: -0.5 },
  brandRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: 6 },
  brandChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginRight: 8,
  },
  brandChipActive: { backgroundColor: colors.ctaBg, borderColor: colors.ctaBg },
  brandText: { fontSize: 12.5, fontWeight: "500", color: colors.textMain },
  kpiGrid: {
    flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, gap: 8, marginTop: 6,
  },
  kpiCard: {
    width: "48%", padding: 14, backgroundColor: colors.surface, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.borderSoft, marginBottom: 8, ...shadows.card,
  },
  kpiIcon: {
    width: 32, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center",
  },
  kpiValue: { fontSize: 22, fontWeight: "600", color: colors.textMain, marginTop: 8, letterSpacing: -0.5 },
  kpiLabel: { ...typography.small, marginTop: 2 },
  overviewCard: {
    marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.lg,
    backgroundColor: colors.ctaBg, borderRadius: radii.xl, ...shadows.cta,
  },
  overviewRow: { flexDirection: "row", justifyContent: "space-between" },
  overviewCell: { flex: 1, alignItems: "center" },
  overviewLabel: { fontSize: 10.5, color: "rgba(255,255,255,0.65)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: "600" },
  overviewValue: { fontSize: 22, fontWeight: "300", color: "#fff", marginTop: 6 },
  divider: { width: 1, backgroundColor: "rgba(255,255,255,0.15)" },
  sectionTitle: { ...typography.overline, paddingHorizontal: spacing.xl, marginTop: spacing.xl, marginBottom: spacing.md },
  tRow: {
    flexDirection: "row", gap: 10, alignItems: "center", padding: 10,
    backgroundColor: colors.surface, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  tRank: { width: 30, alignItems: "center" },
  tRankText: { fontSize: 13, fontWeight: "700", color: colors.primary },
  tImg: { width: 48, height: 58, borderRadius: radii.sm, backgroundColor: colors.surfaceSecondary },
  tName: { fontSize: 13, fontWeight: "500", color: colors.textMain },
  tMetaRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  miniStat: { flexDirection: "row", alignItems: "center", gap: 3 },
  miniStatText: { fontSize: 10.5, color: colors.textMuted },
  tPrice: { fontSize: 13, fontWeight: "700", color: colors.textMain },
  styleCard: {
    marginHorizontal: spacing.lg, padding: spacing.md,
    backgroundColor: colors.surface, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  styleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 7 },
  styleName: { fontSize: 13, fontWeight: "600", color: colors.textMain, textTransform: "capitalize" },
  styleSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  bar: { width: 120, height: 6, backgroundColor: colors.surfaceSecondary, borderRadius: 999, overflow: "hidden" },
  barFill: { height: 6, backgroundColor: colors.primary, borderRadius: 999 },
  ctaCard: {
    flexDirection: "row", gap: 12, alignItems: "center",
    marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radii.lg,
  },
  ctaTitle: { fontSize: 14, fontWeight: "600", color: colors.textMain },
  ctaSub: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  ctaBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.pill, backgroundColor: colors.ctaBg },
  ctaBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
