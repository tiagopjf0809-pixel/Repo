import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, RefreshControl, ScrollView, Modal, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";
import { colors, radii, spacing, typography, shadows } from "../../src/theme";

type Product = {
  id: string;
  name: string;
  brand: string;
  price: number;
  image: string;
  colors: string[];
  sizes: string[];
  style: string;
  sustainable: boolean;
  budget_category: string;
};

type Filters = {
  brands: string[];
  styles: string[];
  colors: string[];
  sizes: string[];
  budgets: string[];
};

type ActiveFilter = {
  style?: string;
  brand?: string;
  color?: string;
  size?: string;
  budget?: string;
  sustainable?: boolean;
};

const COLUMN_HEIGHTS = [220, 280, 240, 260, 200, 290, 230, 270]; // varied masonry

export default function Discover() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtersMeta, setFiltersMeta] = useState<Filters | null>(null);
  const [active, setActive] = useState<ActiveFilter>({});
  const [showFilters, setShowFilters] = useState(false);
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);

  const fetchProducts = useCallback(async (reset = false) => {
    try {
      const params: any = { skip: reset ? 0 : skip, limit: 24, ...active };
      const res = await api.get("/products", { params });
      setItems((prev) => (reset ? res.data.items : [...prev, ...res.data.items]));
      setTotal(res.data.total);
      setSkip((reset ? 0 : skip) + res.data.items.length);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [active, skip]);

  useEffect(() => {
    api.get("/products/filters").then((r) => setFiltersMeta(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setSkip(0);
    fetchProducts(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const onRefresh = () => {
    setRefreshing(true);
    setSkip(0);
    fetchProducts(true);
  };

  const onEndReached = () => {
    if (items.length < total && !loading) fetchProducts();
  };

  const handleWishlist = async (id: string) => {
    try { await api.post("/wishlist", { product_id: id }); } catch {}
  };

  const handleCart = async (p: Product) => {
    try {
      await api.post("/cart", {
        product_id: p.id, size: p.sizes[0], color: p.colors[0], quantity: 1,
      });
    } catch {}
  };

  // split into two columns for masonry
  const cols = useMemo(() => {
    const left: { p: Product; h: number }[] = [];
    const right: { p: Product; h: number }[] = [];
    items.forEach((p, i) => {
      const h = COLUMN_HEIGHTS[i % COLUMN_HEIGHTS.length];
      (i % 2 === 0 ? left : right).push({ p, h });
    });
    return { left, right };
  }, [items]);

  const activeCount = Object.values(active).filter((v) => v !== undefined && v !== null && v !== "").length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>Lumi</Text>
          <Text style={styles.sub}>Discover your edit</Text>
        </View>
        <TouchableOpacity
          testID="open-filters-button"
          style={styles.filterBtn}
          onPress={() => setShowFilters(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="options-outline" size={18} color={colors.textMain} />
          <Text style={styles.filterBtnText}>Filters</Text>
          {activeCount > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{activeCount}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      {/* style chips horizontal scroll */}
      {filtersMeta && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          <Chip
            label="All"
            active={!active.style}
            onPress={() => setActive((a) => ({ ...a, style: undefined }))}
            testID="chip-style-all"
          />
          {filtersMeta.styles.map((s) => (
            <Chip
              key={s}
              label={s}
              active={active.style === s}
              onPress={() => setActive((a) => ({ ...a, style: a.style === s ? undefined : s }))}
              testID={`chip-style-${s.replace(/\s+/g, "-")}`}
            />
          ))}
        </ScrollView>
      )}

      {loading && items.length === 0 ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={[0]}
          keyExtractor={(i) => String(i)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.6}
          testID="discover-feed"
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={() => (
            <View style={styles.masonryRow}>
              <View style={styles.masonryCol}>
                {cols.left.map(({ p, h }) => (
                  <ProductCard key={p.id} p={p} h={h} onWish={handleWishlist} onCart={handleCart} />
                ))}
              </View>
              <View style={styles.masonryCol}>
                {cols.right.map(({ p, h }) => (
                  <ProductCard key={p.id} p={p} h={h} onWish={handleWishlist} onCart={handleCart} />
                ))}
              </View>
            </View>
          )}
          ListFooterComponent={
            items.length < total ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
            ) : null
          }
        />
      )}

      <FiltersSheet
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filtersMeta}
        active={active}
        setActive={setActive}
      />
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress, testID }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      testID={testID}
      style={[styles.chip, active && styles.chipActive]}
      activeOpacity={0.85}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ProductCard({ p, h, onWish, onCart }: {
  p: Product; h: number; onWish: (id: string) => void; onCart: (p: Product) => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.card}
      onPress={() => router.push({ pathname: "/product/[id]", params: { id: p.id } })}
      testID={`product-card-${p.id}`}
    >
      <View style={{ position: "relative" }}>
        <Image source={{ uri: p.image }} style={[styles.cardImage, { height: h }]} />
        {p.sustainable && (
          <View style={[styles.tagOnImage, styles.tagSustain]}>
            <Ionicons name="leaf-outline" size={11} color={colors.success} />
            <Text style={[styles.tagText, { color: colors.success }]}>Sustainable</Text>
          </View>
        )}
        <TouchableOpacity
          testID={`wish-${p.id}`}
          onPress={(e) => { e.stopPropagation(); onWish(p.id); }}
          style={styles.iconBtnTopRight}
        >
          <Ionicons name="heart-outline" size={18} color={colors.textMain} />
        </TouchableOpacity>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.brandText} numberOfLines={1}>{p.brand}</Text>
        <Text style={styles.nameText} numberOfLines={2}>{p.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.priceText}>${p.price.toFixed(2)}</Text>
          <TouchableOpacity
            testID={`cart-${p.id}`}
            onPress={(e) => { e.stopPropagation(); onCart(p); }}
            style={styles.bagBtn}
          >
            <Ionicons name="bag-add-outline" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.swatchRow}>
          {p.colors.slice(0, 4).map((c, i) => (
            <View key={i} style={[styles.swatch, { backgroundColor: colorMap[c] || c }]} />
          ))}
          <View style={[styles.budgetTag]}>
            <Text style={styles.budgetText}>{p.budget_category}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const colorMap: Record<string, string> = {
  beige: "#D6C2A8", black: "#1a1a1a", white: "#F5F1EB", cream: "#EDE4D3",
  olive: "#6B7141", navy: "#243047", brown: "#5C3A20", grey: "#888378",
  rust: "#A8442A", stone: "#B8AA94", camel: "#B68B57",
};

function FiltersSheet({ visible, onClose, filters, active, setActive }: any) {
  if (!filters) return null;
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.sheet} testID="filters-sheet">
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={typography.h3}>Filters</Text>
          <TouchableOpacity testID="filters-clear" onPress={() => setActive({})}>
            <Text style={styles.clearText}>Clear all</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ maxHeight: "75%" }} contentContainerStyle={{ paddingBottom: 20 }}>
          <SectionRow title="Brand">
            {filters.brands.map((b: string) => (
              <Chip key={b} label={b} active={active.brand === b}
                onPress={() => setActive((a: any) => ({ ...a, brand: a.brand === b ? undefined : b }))}
                testID={`filter-brand-${b}`}
              />
            ))}
          </SectionRow>
          <SectionRow title="Budget">
            {filters.budgets.map((b: string) => (
              <Chip key={b} label={b} active={active.budget === b}
                onPress={() => setActive((a: any) => ({ ...a, budget: a.budget === b ? undefined : b }))}
                testID={`filter-budget-${b}`}
              />
            ))}
          </SectionRow>
          <SectionRow title="Color">
            {filters.colors.map((c: string) => (
              <Chip key={c} label={c} active={active.color === c}
                onPress={() => setActive((a: any) => ({ ...a, color: a.color === c ? undefined : c }))}
                testID={`filter-color-${c}`}
              />
            ))}
          </SectionRow>
          <SectionRow title="Size">
            {filters.sizes.map((s: string) => (
              <Chip key={s} label={s} active={active.size === s}
                onPress={() => setActive((a: any) => ({ ...a, size: a.size === s ? undefined : s }))}
                testID={`filter-size-${s}`}
              />
            ))}
          </SectionRow>
          <SectionRow title="Sustainability">
            <Chip label="Sustainable only" active={!!active.sustainable}
              onPress={() => setActive((a: any) => ({ ...a, sustainable: a.sustainable ? undefined : true }))}
              testID="filter-sustainable"
            />
          </SectionRow>
        </ScrollView>
        <TouchableOpacity testID="filters-apply" style={styles.applyBtn} onPress={onClose}>
          <Text style={styles.applyText}>Apply</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function SectionRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md,
  },
  brand: { fontSize: 32, fontWeight: "300", fontStyle: "italic", color: colors.textMain },
  sub: { ...typography.small, color: colors.textMuted, letterSpacing: 0.5 },
  filterBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.pill,
  },
  filterBtnText: { fontSize: 13, fontWeight: "600", color: colors.textMain },
  badge: {
    backgroundColor: colors.ctaBg, borderRadius: 999, minWidth: 18, height: 18,
    paddingHorizontal: 5, alignItems: "center", justifyContent: "center", marginLeft: 4,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  chipsRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: 6 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    marginRight: 8, marginBottom: 8,
  },
  chipActive: { backgroundColor: colors.ctaBg, borderColor: colors.ctaBg },
  chipText: { fontSize: 12.5, color: colors.textMain, textTransform: "capitalize", fontWeight: "500" },
  chipTextActive: { color: "#fff" },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  masonryRow: { flexDirection: "row", paddingHorizontal: 10, gap: 8 },
  masonryCol: { flex: 1 },
  card: {
    backgroundColor: colors.surface, borderRadius: radii.lg,
    overflow: "hidden", marginBottom: 10, borderWidth: 1, borderColor: colors.borderSoft,
    ...shadows.card,
  },
  cardImage: { width: "100%", backgroundColor: colors.surfaceSecondary },
  cardBody: { padding: 10 },
  brandText: { ...typography.brand, marginBottom: 2 },
  nameText: { fontSize: 13, color: colors.textMain, fontWeight: "500", marginBottom: 6 },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  priceText: { ...typography.price },
  bagBtn: { backgroundColor: colors.ctaBg, padding: 8, borderRadius: radii.pill },
  swatchRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 4, flexWrap: "wrap" },
  swatch: { width: 12, height: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.borderSoft },
  budgetTag: {
    marginLeft: "auto", backgroundColor: colors.budgetBg,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: radii.pill,
  },
  budgetText: { fontSize: 10, color: colors.budgetText, fontWeight: "600" },
  tagOnImage: {
    position: "absolute", top: 8, left: 8, flexDirection: "row", gap: 4, alignItems: "center",
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.pill,
  },
  tagSustain: { backgroundColor: "#FFFFFFE6" },
  tagText: { fontSize: 10, fontWeight: "600" },
  iconBtnTopRight: {
    position: "absolute", top: 8, right: 8, backgroundColor: "#FFFFFFE6",
    width: 30, height: 30, borderRadius: 999, alignItems: "center", justifyContent: "center",
  },
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: spacing.xl, paddingTop: 10, paddingBottom: 24, maxHeight: "85%",
  },
  sheetHandle: {
    alignSelf: "center", width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border, marginBottom: 12,
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  clearText: { fontSize: 13, color: colors.primary, fontWeight: "600" },
  sectionTitle: { ...typography.overline, marginBottom: 10 },
  applyBtn: {
    backgroundColor: colors.ctaBg, paddingVertical: 16, borderRadius: radii.pill,
    alignItems: "center", marginTop: 14,
  },
  applyText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
