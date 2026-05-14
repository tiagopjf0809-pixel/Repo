import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";
import { colors, radii, spacing, typography, shadows } from "../../src/theme";

type Beauty = {
  id: string; name: string; brand: string; price: number; image: string;
  category: string; shades?: string[]; cruelty_free: boolean;
  ingredient_safety: string; derm_rating: number; reviews: number; trending?: boolean;
};

const CATEGORIES = [
  { key: "all", label: "All", icon: "sparkles-outline" as const },
  { key: "foundation", label: "Foundation", icon: "color-palette-outline" as const },
  { key: "concealer", label: "Concealer", icon: "brush-outline" as const },
  { key: "blush", label: "Blush", icon: "rose-outline" as const },
  { key: "lip", label: "Lip", icon: "happy-outline" as const },
  { key: "eye", label: "Eye", icon: "eye-outline" as const },
  { key: "contour", label: "Contour", icon: "ellipse-outline" as const },
];

export default function Beauty() {
  const [items, setItems] = useState<Beauty[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [latestScan, setLatestScan] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    const params: any = {};
    if (category !== "all") params.category = category;
    api.get("/beauty/products", { params })
      .then((r) => setItems(r.data.items))
      .finally(() => setLoading(false));
  }, [category]);

  useEffect(() => {
    api.get("/beauty/face-scan/latest").then((r) => setLatestScan(r.data)).catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.header}>
          <Text style={styles.brand}>Beauty</Text>
          <Text style={styles.sub}>Curated for your unique features</Text>
        </View>

        {/* Face scan CTA */}
        <View style={styles.scanCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.overline}>AI · Face Scan</Text>
            <Text style={styles.scanTitle}>
              {latestScan?.analysis ? "Re-scan your look" : "Find your perfect match"}
            </Text>
            <Text style={styles.scanSub}>
              {latestScan?.analysis
                ? `Last analysis: ${latestScan.analysis.skin_tone} · ${latestScan.analysis.undertone}`
                : "Upload a selfie. We'll analyze your skin tone, type, and features."}
            </Text>
            <TouchableOpacity
              testID="open-face-scan-button"
              style={styles.scanBtn}
              onPress={() => router.push("/facescan")}
              activeOpacity={0.85}
            >
              <Ionicons name="scan-outline" size={16} color="#fff" />
              <Text style={styles.scanBtnText}>{latestScan?.analysis ? "Scan again" : "Start Face Scan"}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.scanIcon}>
            <Ionicons name="sparkles" size={36} color={colors.primary} />
          </View>
        </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.key}
              onPress={() => setCategory(c.key)}
              testID={`beauty-cat-${c.key}`}
              style={[styles.catChip, category === c.key && styles.catChipActive]}
            >
              <Ionicons name={c.icon} size={14} color={category === c.key ? "#fff" : colors.textMain} />
              <Text style={[styles.catText, category === c.key && { color: "#fff" }]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Products grid */}
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.grid}>
            {items.map((p) => (
              <BeautyCard key={p.id} p={p} />
            ))}
            {items.length === 0 && (
              <Text style={[typography.body, { textAlign: "center", marginTop: 40 }]}>No products in this category.</Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function BeautyCard({ p }: { p: Beauty }) {
  return (
    <TouchableOpacity
      style={styles.bcard}
      activeOpacity={0.9}
      onPress={() => router.push(`/product/${p.id}` as any)}
      testID={`beauty-card-${p.id}`}
    >
      <View style={styles.bImageWrap}>
        <Image source={{ uri: p.image }} style={styles.bImage} />
        {p.trending && (
          <View style={styles.trending}>
            <Ionicons name="trending-up" size={11} color="#fff" />
            <Text style={styles.trendingText}>Trending</Text>
          </View>
        )}
      </View>
      <View style={{ padding: 10 }}>
        <Text style={styles.bBrand} numberOfLines={1}>{p.brand}</Text>
        <Text style={styles.bName} numberOfLines={2}>{p.name}</Text>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={11} color={colors.warning} />
          <Text style={styles.ratingText}>{p.derm_rating}</Text>
          <Text style={styles.reviewsText}>({(p.reviews / 1000).toFixed(1)}k)</Text>
        </View>
        <View style={styles.badgeRow}>
          {p.cruelty_free && (
            <View style={[styles.miniBadge, { backgroundColor: colors.sustainBg }]}>
              <Ionicons name="paw-outline" size={10} color={colors.sustainText} />
              <Text style={[styles.miniBadgeText, { color: colors.sustainText }]}>Cruelty-free</Text>
            </View>
          )}
        </View>
        <Text style={styles.bPrice}>${p.price.toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md },
  brand: { fontSize: 32, fontWeight: "300", fontStyle: "italic", color: colors.textMain },
  sub: { ...typography.small },
  overline: { ...typography.overline, color: colors.primary },
  scanCard: {
    marginHorizontal: spacing.xl, marginVertical: spacing.md,
    backgroundColor: colors.surface, borderRadius: radii.xl,
    padding: spacing.lg, flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1, borderColor: colors.borderSoft, ...shadows.card,
  },
  scanTitle: { fontSize: 18, fontWeight: "600", color: colors.textMain, marginTop: 4 },
  scanSub: { fontSize: 12.5, color: colors.textMuted, marginTop: 4, lineHeight: 18 },
  scanBtn: {
    flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 6,
    backgroundColor: colors.ctaBg, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: radii.pill, marginTop: 12,
  },
  scanBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  scanIcon: {
    width: 64, height: 64, borderRadius: 999, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  catRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: 6 },
  catChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    marginRight: 8,
  },
  catChipActive: { backgroundColor: colors.ctaBg, borderColor: colors.ctaBg },
  catText: { fontSize: 12.5, fontWeight: "500", color: colors.textMain },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.md, gap: 10, justifyContent: "space-between" },
  bcard: {
    width: "48%", marginBottom: 14, backgroundColor: colors.surface, borderRadius: radii.lg,
    overflow: "hidden", borderWidth: 1, borderColor: colors.borderSoft, ...shadows.card,
  },
  bImageWrap: { width: "100%", height: 160, backgroundColor: colors.surfaceSecondary },
  bImage: { width: "100%", height: "100%" },
  trending: {
    position: "absolute", top: 8, left: 8, backgroundColor: colors.ctaBg,
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill,
  },
  trendingText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  bBrand: { ...typography.brand, marginBottom: 2 },
  bName: { fontSize: 13, color: colors.textMain, fontWeight: "500" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 },
  ratingText: { fontSize: 11, color: colors.textMain, fontWeight: "600" },
  reviewsText: { fontSize: 10, color: colors.textMuted },
  badgeRow: { flexDirection: "row", gap: 4, marginTop: 6, flexWrap: "wrap" },
  miniBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.pill,
  },
  miniBadgeText: { fontSize: 9, fontWeight: "600" },
  bPrice: { ...typography.price, marginTop: 6 },
});
