import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Image, Modal, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { colors, radii, spacing, typography, shadows } from "../src/theme";

type Store = {
  id: string; name: string; brand: string; address: string;
  lat: number; lng: number; hours: string; phone: string;
  distance_km: number; in_stock: boolean; stock_count: number;
  price: number | null; is_partner: boolean;
};

const MAP_WIDTH = 360;
const MAP_HEIGHT = 240;

// Project lat/lng onto a 0-1 canvas relative to bounds
function projectPin(stores: Store[], userLoc: { lat: number; lng: number }) {
  const all = [...stores.map(s => ({ lat: s.lat, lng: s.lng })), userLoc];
  const lats = all.map(p => p.lat);
  const lngs = all.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const padLat = Math.max(0.01, (maxLat - minLat) * 0.18);
  const padLng = Math.max(0.01, (maxLng - minLng) * 0.18);
  const ll = minLat - padLat, lh = maxLat + padLat;
  const gl = minLng - padLng, gh = maxLng + padLng;
  return (lat: number, lng: number) => ({
    x: ((lng - gl) / (gh - gl)) * (MAP_WIDTH - 28) + 14,
    y: (1 - (lat - ll) / (lh - ll)) * (MAP_HEIGHT - 28) + 14,
  });
}

export default function Stores() {
  const { product_id } = useLocalSearchParams<{ product_id?: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Store | null>(null);
  const [reserving, setReserving] = useState(false);
  const [reserveStatus, setReserveStatus] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params: any = { radius_km: 50 };
    if (product_id) params.product_id = product_id;
    api.get("/stores/nearby", { params })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [product_id]);

  const reserve = async (s: Store) => {
    if (!product_id) return;
    setReserving(true);
    try {
      const res = await api.post(`/stores/${s.id}/reserve`, {
        product_id, size: data?.product?.sizes?.[0], color: data?.product?.colors?.[0],
      });
      setReserveStatus(`Reserved at ${res.data.store_name} · holds 24h`);
      setTimeout(() => setReserveStatus(null), 4000);
    } catch (e: any) {
      setReserveStatus("Reservation failed");
    } finally {
      setReserving(false);
    }
  };

  const openDirections = (s: Store) => {
    const q = encodeURIComponent(s.address);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
  };

  if (loading || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  const stores: Store[] = data.stores;
  const project = projectPin(stores, data.user_location);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity testID="stores-close" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.title}>Find in store</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {data.product && (
          <View style={styles.productBanner}>
            <Image source={{ uri: data.product.image }} style={styles.productImg} />
            <View style={{ flex: 1 }}>
              <Text style={typography.brand}>{data.product.brand}</Text>
              <Text style={styles.productName} numberOfLines={1}>{data.product.name}</Text>
              <Text style={styles.productPrice}>${data.product.price.toFixed(2)} online</Text>
            </View>
          </View>
        )}

        {/* Stylized map */}
        <View style={styles.mapWrap}>
          <View style={styles.mapBg} testID="mock-map">
            {/* grid lines */}
            {[0.2, 0.4, 0.6, 0.8].map((t, i) => (
              <View key={`h${i}`} style={[styles.gridLine, { top: MAP_HEIGHT * t }]} />
            ))}
            {[0.2, 0.4, 0.6, 0.8].map((t, i) => (
              <View key={`v${i}`} style={[styles.gridLineV, { left: MAP_WIDTH * t }]} />
            ))}
            {/* curved "river" line for visual texture */}
            <View style={styles.river} />

            {/* user pin */}
            {(() => {
              const p = project(data.user_location.lat, data.user_location.lng);
              return (
                <View style={[styles.userPin, { left: p.x - 9, top: p.y - 9 }]}>
                  <View style={styles.userDot} />
                </View>
              );
            })()}

            {/* store pins */}
            {stores.map((s, i) => {
              const p = project(s.lat, s.lng);
              const active = selected?.id === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  testID={`map-pin-${s.id}`}
                  style={[styles.pin, {
                    left: p.x - 14, top: p.y - 28,
                    opacity: s.in_stock ? 1 : 0.45,
                    transform: [{ scale: active ? 1.15 : 1 }],
                  }]}
                  onPress={() => setSelected(s)}
                >
                  <View style={[styles.pinBubble, s.in_stock && styles.pinBubbleStock, active && styles.pinBubbleActive]}>
                    <Text style={styles.pinText}>{i + 1}</Text>
                  </View>
                  <View style={[styles.pinTail, s.in_stock && styles.pinTailStock, active && styles.pinTailActive]} />
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.mapCaption}>
            Showing {stores.length} stores · {stores.filter(s => s.in_stock).length} with stock
          </Text>
        </View>

        {/* List */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          {stores.map((s, i) => (
            <TouchableOpacity
              key={s.id}
              testID={`store-row-${s.id}`}
              style={[styles.row, selected?.id === s.id && styles.rowActive]}
              onPress={() => setSelected(s)}
              activeOpacity={0.85}
            >
              <View style={styles.rowIndex}><Text style={styles.rowIndexText}>{i + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.storeName}>{s.name}</Text>
                  {s.is_partner && (
                    <View style={styles.partnerBadge}><Text style={styles.partnerText}>Partner</Text></View>
                  )}
                </View>
                <Text style={styles.storeAddr} numberOfLines={1}>{s.address}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={11} color={colors.textMuted} />
                  <Text style={styles.metaText}>{s.distance_km} km</Text>
                  <Text style={styles.dot}>·</Text>
                  {s.in_stock ? (
                    <>
                      <View style={styles.stockDot} />
                      <Text style={[styles.metaText, { color: colors.success }]}>
                        In stock ({s.stock_count})
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.metaText, { color: "#B23A3A" }]}>Out of stock</Text>
                  )}
                </View>
              </View>
              {s.price !== null && (
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.storePrice}>${s.price.toFixed(2)}</Text>
                  {data.product && (
                    <Text style={[styles.metaText, {
                      color: s.price < data.product.price ? colors.success : colors.textMuted,
                    }]}>
                      {s.price < data.product.price ? "Cheaper" : s.price > data.product.price ? "Higher" : "Same"}
                    </Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {reserveStatus && (
        <View style={styles.toast}><Text style={styles.toastText}>{reserveStatus}</Text></View>
      )}

      {/* Bottom sheet for selected store */}
      <Modal transparent visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setSelected(null)} />
        {selected && (
          <View style={styles.sheet} testID="store-detail-sheet">
            <View style={styles.sheetHandle} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={typography.h3}>{selected.name}</Text>
              {selected.is_partner && (
                <View style={styles.partnerBadge}><Text style={styles.partnerText}>Partner</Text></View>
              )}
            </View>
            <Text style={styles.sheetAddr}>{selected.address}</Text>

            <View style={styles.kvRow}><Text style={styles.k}>Distance</Text><Text style={styles.v}>{selected.distance_km} km</Text></View>
            <View style={styles.kvRow}><Text style={styles.k}>Hours</Text><Text style={styles.v}>{selected.hours}</Text></View>
            <View style={styles.kvRow}><Text style={styles.k}>Phone</Text><Text style={styles.v}>{selected.phone}</Text></View>
            <View style={styles.kvRow}>
              <Text style={styles.k}>Stock</Text>
              <Text style={[styles.v, { color: selected.in_stock ? colors.success : "#B23A3A" }]}>
                {selected.in_stock ? `${selected.stock_count} available` : "Out of stock"}
              </Text>
            </View>
            {selected.price !== null && (
              <View style={styles.kvRow}>
                <Text style={styles.k}>In-store price</Text>
                <Text style={styles.v}>${selected.price.toFixed(2)}</Text>
              </View>
            )}

            <View style={styles.actionRow}>
              <TouchableOpacity
                testID="store-directions"
                style={styles.outlineBtn}
                onPress={() => openDirections(selected)}
              >
                <Ionicons name="navigate-outline" size={15} color={colors.textMain} />
                <Text style={styles.outlineBtnText}>Directions</Text>
              </TouchableOpacity>
              {selected.in_stock && product_id && (
                <TouchableOpacity
                  testID="store-reserve"
                  style={[styles.solidBtn, reserving && { opacity: 0.5 }]}
                  onPress={() => reserve(selected)}
                  disabled={reserving}
                >
                  {reserving ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <Ionicons name="bookmark-outline" size={15} color="#fff" />
                      <Text style={styles.solidBtnText}>Reserve (24h hold)</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
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
  title: { fontSize: 17, fontWeight: "600", color: colors.textMain },
  productBanner: {
    flexDirection: "row", gap: 12, alignItems: "center",
    marginHorizontal: spacing.lg, padding: 10, borderRadius: radii.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft, marginBottom: spacing.md,
  },
  productImg: { width: 56, height: 70, borderRadius: radii.sm, backgroundColor: colors.surfaceSecondary },
  productName: { fontSize: 14, fontWeight: "500", color: colors.textMain, marginTop: 2 },
  productPrice: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },

  mapWrap: { alignItems: "center", paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  mapBg: {
    width: MAP_WIDTH, height: MAP_HEIGHT,
    backgroundColor: "#EDE7DE", borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.borderSoft, position: "relative", overflow: "hidden",
    ...shadows.card,
  },
  mapCaption: { ...typography.small, marginTop: 8, color: colors.textMuted },
  gridLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(192,148,115,0.18)" },
  gridLineV: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(192,148,115,0.18)" },
  river: {
    position: "absolute", left: -20, right: -20, top: 100, height: 36,
    backgroundColor: "rgba(120,170,180,0.18)", transform: [{ rotate: "-6deg" }],
  },
  userPin: {
    position: "absolute", width: 18, height: 18, borderRadius: 999,
    backgroundColor: "rgba(192,148,115,0.35)", alignItems: "center", justifyContent: "center",
  },
  userDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.primary, borderWidth: 1.5, borderColor: "#fff" },
  pin: { position: "absolute", alignItems: "center" },
  pinBubble: {
    width: 28, height: 28, borderRadius: 999, backgroundColor: "#FFFFFFE6",
    borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  pinBubbleStock: { backgroundColor: colors.success, borderColor: colors.success },
  pinBubbleActive: { backgroundColor: colors.ctaBg, borderColor: colors.ctaBg },
  pinText: { fontSize: 11, fontWeight: "700", color: colors.textMain },
  pinTail: {
    width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
    borderStyle: "solid", borderLeftColor: "transparent", borderRightColor: "transparent",
    borderTopColor: colors.border, marginTop: -2,
  },
  pinTailStock: { borderTopColor: colors.success },
  pinTailActive: { borderTopColor: colors.ctaBg },

  row: {
    flexDirection: "row", gap: 12, alignItems: "center",
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: radii.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft, marginBottom: 8,
  },
  rowActive: { borderColor: colors.ctaBg, borderWidth: 1.5 },
  rowIndex: {
    width: 28, height: 28, borderRadius: 999,
    backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center",
  },
  rowIndexText: { fontSize: 12, fontWeight: "700", color: colors.textMain },
  storeName: { fontSize: 14, fontWeight: "600", color: colors.textMain },
  storeAddr: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  metaRow: { flexDirection: "row", gap: 4, alignItems: "center", marginTop: 4, flexWrap: "wrap" },
  metaText: { fontSize: 11, color: colors.textMuted },
  dot: { color: colors.textMuted, marginHorizontal: 2 },
  stockDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: colors.success },
  storePrice: { fontSize: 14, fontWeight: "700", color: colors.textMain },
  partnerBadge: {
    backgroundColor: colors.budgetBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.pill,
  },
  partnerText: { fontSize: 9, fontWeight: "700", color: colors.budgetText, letterSpacing: 0.5 },

  modalBg: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, paddingBottom: 36,
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2,
    alignSelf: "center", marginBottom: spacing.md,
  },
  sheetAddr: { ...typography.body, marginTop: 4, marginBottom: spacing.md },
  kvRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7,
    borderTopWidth: 1, borderTopColor: colors.borderSoft },
  k: { fontSize: 13, color: colors.textMuted },
  v: { fontSize: 13, color: colors.textMain, fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: spacing.lg },
  outlineBtn: {
    flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6,
    paddingVertical: 14, borderRadius: radii.pill, backgroundColor: colors.surfaceSecondary,
  },
  outlineBtnText: { fontSize: 13, fontWeight: "600", color: colors.textMain },
  solidBtn: {
    flex: 1.2, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6,
    paddingVertical: 14, borderRadius: radii.pill, backgroundColor: colors.ctaBg, ...shadows.cta,
  },
  solidBtnText: { fontSize: 13, fontWeight: "600", color: "#fff" },

  toast: {
    position: "absolute", bottom: 30, alignSelf: "center",
    backgroundColor: colors.ctaBg, paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: radii.pill, ...shadows.cta,
  },
  toastText: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
