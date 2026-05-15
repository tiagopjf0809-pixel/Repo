import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator,
  TextInput, Modal, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { colors, radii, spacing, typography, shadows } from "../src/theme";

type Product = { id: string; name: string; brand: string; price: number; image: string; style?: string };

const OCCASIONS = ["First date", "Office", "Brunch", "Beach wedding", "Cocktails", "Travel"];

export default function OutfitBuilder() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [occasion, setOccasion] = useState<string>("");
  const [styling, setStyling] = useState<string | null>(null);
  const [stylingProducts, setStylingProducts] = useState<Product[]>([]);
  const [styleLoading, setStyleLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [outfitName, setOutfitName] = useState("");
  const [activeStyle, setActiveStyle] = useState<string | null>(null);

  useEffect(() => {
    const params: any = { limit: 30 };
    if (activeStyle) params.style = activeStyle;
    api.get("/products", { params }).then((r) => setProducts(r.data.items));
  }, [activeStyle]);

  const toggle = (id: string) => {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length < 6 ? [...s, id] : s);
  };

  const generate = async () => {
    if (selected.length < 2) {
      Alert.alert("Pick at least 2 pieces", "An outfit needs more than one item.");
      return;
    }
    setStyleLoading(true);
    setStyling(null);
    try {
      const res = await api.post("/outfits/style", { product_ids: selected, occasion: occasion || undefined });
      setStyling(res.data.styling);
      setStylingProducts(res.data.products);
    } catch (e: any) {
      Alert.alert("Styling failed", e?.response?.data?.detail || "Try again");
    } finally {
      setStyleLoading(false);
    }
  };

  const addAllToCart = async () => {
    for (const p of stylingProducts) {
      try {
        await api.post("/cart", { product_id: p.id, quantity: 1 });
      } catch {}
    }
    Alert.alert("Added", `${stylingProducts.length} items added to your cart`);
  };

  const saveOutfit = async () => {
    if (!outfitName.trim()) return;
    setSaving(true);
    try {
      await api.post("/outfits", {
        name: outfitName.trim(),
        product_ids: stylingProducts.map((p) => p.id),
        occasion: occasion || undefined,
      });
      setShowSave(false);
      setOutfitName("");
      Alert.alert("Outfit saved", "Find it in your profile soon.");
    } catch (e: any) {
      Alert.alert("Save failed", e?.response?.data?.detail || "Try again");
    } finally {
      setSaving(false);
    }
  };

  const total = stylingProducts.reduce((sum, p) => sum + p.price, 0);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity testID="outfit-close" onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.title}>Build an outfit</Text>
        <Text style={[typography.small, { color: colors.primary, fontWeight: "700" }]}>{selected.length}/6</Text>
      </View>

      {!styling ? (
        <>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}>
            <Text style={typography.overline}>Occasion (optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8, marginBottom: 14 }}>
              {OCCASIONS.map((o) => (
                <TouchableOpacity
                  key={o}
                  testID={`occasion-${o}`}
                  onPress={() => setOccasion(occasion === o ? "" : o)}
                  style={[styles.chip, occasion === o && styles.chipActive]}
                >
                  <Text style={[styles.chipText, occasion === o && { color: "#fff" }]}>{o}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={typography.overline}>Style filter</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8, marginBottom: 14 }}>
              {["minimal", "streetwear", "old money", "quiet luxury", "vintage", "athletic"].map((s) => (
                <TouchableOpacity
                  key={s}
                  testID={`style-filter-${s}`}
                  onPress={() => setActiveStyle(activeStyle === s ? null : s)}
                  style={[styles.chip, activeStyle === s && styles.chipActive]}
                >
                  <Text style={[styles.chipText, activeStyle === s && { color: "#fff" }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[typography.overline, { marginTop: 4, marginBottom: 10 }]}>
              Pick 2-6 pieces
            </Text>
            <View style={styles.grid}>
              {products.map((p) => {
                const isSel = selected.includes(p.id);
                return (
                  <TouchableOpacity
                    key={p.id}
                    testID={`pick-${p.id}`}
                    onPress={() => toggle(p.id)}
                    style={[styles.pickCard, isSel && styles.pickCardSel]}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri: p.image }} style={styles.pickImg} />
                    {isSel && (
                      <View style={styles.checkBadge}>
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      </View>
                    )}
                    <Text style={typography.brand} numberOfLines={1}>{p.brand}</Text>
                    <Text style={styles.pickName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.pickPrice}>${p.price.toFixed(0)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.bottomBar}>
            <TouchableOpacity
              testID="outfit-generate"
              style={[styles.genBtn, (selected.length < 2 || styleLoading) && { opacity: 0.5 }]}
              onPress={generate}
              disabled={selected.length < 2 || styleLoading}
            >
              {styleLoading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="sparkles" size={16} color="#fff" />
                  <Text style={styles.genText}>Style this outfit</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
          <View style={styles.stylingCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Ionicons name="sparkles" size={14} color={colors.primary} />
              <Text style={styles.aiName}>Lumi Stylist</Text>
            </View>
            <Text style={styles.stylingText}>{styling}</Text>
          </View>

          <Text style={[typography.overline, { marginTop: spacing.xl, marginBottom: 10 }]}>
            Your outfit · ${total.toFixed(2)}
          </Text>
          <View style={styles.grid}>
            {stylingProducts.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.outfitItem}
                onPress={() => router.push(`/product/${p.id}` as any)}
                testID={`outfit-item-${p.id}`}
              >
                <Image source={{ uri: p.image }} style={styles.pickImg} />
                <Text style={typography.brand} numberOfLines={1}>{p.brand}</Text>
                <Text style={styles.pickName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.pickPrice}>${p.price.toFixed(0)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity testID="outfit-save" style={styles.outlineBtn} onPress={() => setShowSave(true)}>
              <Ionicons name="bookmark-outline" size={15} color={colors.textMain} />
              <Text style={styles.outlineBtnText}>Save outfit</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="outfit-add-all" style={styles.solidBtn} onPress={addAllToCart}>
              <Ionicons name="bag-add" size={15} color="#fff" />
              <Text style={styles.solidBtnText}>Add all to cart</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity testID="outfit-restart" style={styles.linkBtn} onPress={() => { setStyling(null); setSelected([]); }}>
            <Text style={styles.linkText}>Start over</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <Modal visible={showSave} transparent animationType="slide" onRequestClose={() => setShowSave(false)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setShowSave(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={typography.h3}>Name your outfit</Text>
          <TextInput
            testID="outfit-name-input"
            style={styles.input}
            placeholder="e.g. Sunset dinner look"
            placeholderTextColor={colors.textMuted}
            value={outfitName}
            onChangeText={setOutfitName}
            autoFocus
          />
          <TouchableOpacity
            testID="outfit-save-confirm"
            style={[styles.solidBtn, { width: "100%", justifyContent: "center", marginTop: 12 }, (!outfitName.trim() || saving) && { opacity: 0.5 }]}
            onPress={saveOutfit}
            disabled={!outfitName.trim() || saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.solidBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  title: { fontSize: 16, fontWeight: "600", color: colors.textMain },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginRight: 8,
  },
  chipActive: { backgroundColor: colors.ctaBg, borderColor: colors.ctaBg },
  chipText: { fontSize: 12.5, color: colors.textMain, fontWeight: "500", textTransform: "capitalize" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 },
  pickCard: {
    width: "48%", padding: 8, backgroundColor: colors.surface, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.borderSoft, marginBottom: 8, ...shadows.card,
  },
  pickCardSel: { borderWidth: 2, borderColor: colors.ctaBg },
  pickImg: { width: "100%", height: 130, borderRadius: radii.md, backgroundColor: colors.surfaceSecondary, marginBottom: 6 },
  pickName: { fontSize: 12, color: colors.textMain, fontWeight: "500", marginTop: 2 },
  pickPrice: { fontSize: 12.5, fontWeight: "700", color: colors.textMain, marginTop: 2 },
  checkBadge: {
    position: "absolute", top: 14, right: 14, width: 24, height: 24, borderRadius: 999,
    backgroundColor: colors.ctaBg, alignItems: "center", justifyContent: "center",
  },
  bottomBar: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    padding: spacing.lg, backgroundColor: "#FFFFFFEE", borderTopWidth: 1, borderTopColor: colors.border,
  },
  genBtn: {
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6,
    backgroundColor: colors.ctaBg, paddingVertical: 16, borderRadius: radii.pill, ...shadows.cta,
  },
  genText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  stylingCard: {
    padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.borderSoft, ...shadows.card,
  },
  aiName: { fontSize: 10, fontWeight: "700", color: colors.primary, letterSpacing: 1.5, textTransform: "uppercase" },
  stylingText: { fontSize: 14.5, color: colors.textMain, lineHeight: 22 },
  outfitItem: {
    width: "48%", padding: 8, backgroundColor: colors.surface, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.borderSoft, marginBottom: 8,
  },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: spacing.lg },
  outlineBtn: {
    flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6,
    paddingVertical: 14, borderRadius: radii.pill, backgroundColor: colors.surfaceSecondary,
  },
  outlineBtnText: { color: colors.textMain, fontWeight: "600", fontSize: 13 },
  solidBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 14, paddingHorizontal: 14, borderRadius: radii.pill, backgroundColor: colors.ctaBg, ...shadows.cta,
  },
  solidBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  linkBtn: { alignItems: "center", paddingVertical: 14, marginTop: 8 },
  linkText: { color: colors.textMuted, fontSize: 13, textDecorationLine: "underline" },
  modalBg: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    padding: spacing.xl, paddingBottom: 36, backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginBottom: spacing.md },
  input: {
    marginTop: 12, backgroundColor: colors.surfaceSecondary, paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: radii.md, fontSize: 15, color: colors.textMain,
  },
});
