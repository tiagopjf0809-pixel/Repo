import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
  Image, Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { api } from "../src/api";
import { colors, radii, spacing, typography, shadows } from "../src/theme";

export default function FaceScan() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const pickImage = async (camera: boolean) => {
    setError(null);
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Camera permission needed", "Enable camera access to take a selfie.");
        return;
      }
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Photos permission needed", "Enable photo access to upload a selfie.");
        return;
      }
    }
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    };
    const res = camera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled && res.assets[0]) {
      setImageUri(res.assets[0].uri);
      setImageBase64(res.assets[0].base64 || null);
      setResult(null);
    }
  };

  const analyze = async () => {
    if (!imageBase64) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await api.post("/beauty/face-scan", { image_base64: imageBase64 });
      setResult(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity testID="facescan-close" onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.title}>Face Scan</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 80 }}>
        {!result ? (
          <>
            <Text style={typography.overline}>AI Beauty Analysis</Text>
            <Text style={styles.heading}>Find your perfect match</Text>
            <Text style={typography.body}>
              Take or upload a selfie in good lighting, looking straight ahead, no filters.
              We'll analyze your features and curate makeup just for you.
            </Text>

            <View style={styles.previewWrap}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.preview} />
              ) : (
                <View style={[styles.preview, styles.previewEmpty]}>
                  <Ionicons name="person-circle-outline" size={64} color={colors.textMuted} />
                  <Text style={[typography.small, { marginTop: 8 }]}>No image yet</Text>
                </View>
              )}
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.buttonRow}>
              {Platform.OS !== "web" && (
                <TouchableOpacity testID="facescan-camera" style={styles.outlineBtn} onPress={() => pickImage(true)}>
                  <Ionicons name="camera-outline" size={16} color={colors.textMain} />
                  <Text style={styles.outlineBtnText}>Camera</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity testID="facescan-upload" style={styles.outlineBtn} onPress={() => pickImage(false)}>
                <Ionicons name="image-outline" size={16} color={colors.textMain} />
                <Text style={styles.outlineBtnText}>Upload</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              testID="facescan-analyze"
              style={[styles.cta, (!imageBase64 || analyzing) && { opacity: 0.5 }]}
              onPress={analyze}
              disabled={!imageBase64 || analyzing}
            >
              {analyzing ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="sparkles" size={16} color="#fff" />
                  <Text style={styles.ctaText}>Analyze my face</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={typography.overline}>Your analysis</Text>
            <Text style={styles.heading}>Beauty profile</Text>

            <View style={styles.analysisCard} testID="facescan-analysis-card">
              <AnalysisRow label="Skin tone" value={result.analysis.skin_tone} />
              <AnalysisRow label="Undertone" value={result.analysis.undertone} />
              <AnalysisRow label="Skin type" value={result.analysis.skin_type} />
              <AnalysisRow label="Face shape" value={result.analysis.face_shape} />
              <AnalysisRow label="Under-eye" value={result.analysis.under_eye_tone} />
              <AnalysisRow label="Lip shape" value={result.analysis.lip_shape} />
              <AnalysisRow label="Eye shape" value={result.analysis.eye_shape} />
              {result.analysis.notes && (
                <Text style={styles.notes}>"{result.analysis.notes}"</Text>
              )}
            </View>

            {Object.entries(result.recommendations).map(([cat, items]: any) => (
              <View key={cat} style={{ marginTop: 24 }}>
                <Text style={[typography.overline, { marginBottom: 10 }]}>{cat}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {(items as any[]).map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.recCard}
                      onPress={() => router.push(`/product/${p.id}` as any)}
                      testID={`rec-${p.id}`}
                    >
                      <Image source={{ uri: p.image }} style={styles.recImg} />
                      <Text style={styles.recBrand}>{p.brand}</Text>
                      <Text style={styles.recName} numberOfLines={2}>{p.name}</Text>
                      <Text style={styles.recPrice}>${p.price.toFixed(2)}</Text>
                      {p.cruelty_free && (
                        <View style={styles.recBadge}>
                          <Ionicons name="paw-outline" size={9} color={colors.sustainText} />
                          <Text style={styles.recBadgeText}>Cruelty-free</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ))}

            <TouchableOpacity
              testID="facescan-done"
              style={[styles.cta, { marginTop: 28 }]}
              onPress={() => router.replace("/beauty")}
            >
              <Text style={styles.ctaText}>View all beauty</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AnalysisRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.arow}>
      <Text style={styles.alabel}>{label}</Text>
      <Text style={styles.avalue}>{value}</Text>
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
  heading: { fontSize: 30, fontWeight: "300", color: colors.textMain, marginVertical: 6, letterSpacing: -0.5 },
  previewWrap: { alignItems: "center", marginVertical: 28 },
  preview: { width: 220, height: 220, borderRadius: 999, backgroundColor: colors.surfaceSecondary, ...shadows.card },
  previewEmpty: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderStyle: "dashed" },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  outlineBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 13, borderRadius: radii.pill, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  outlineBtnText: { color: colors.textMain, fontWeight: "600", fontSize: 13 },
  cta: {
    marginTop: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6,
    backgroundColor: colors.ctaBg, paddingVertical: 16, borderRadius: radii.pill, ...shadows.cta,
  },
  ctaText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  error: { color: "#B23A3A", fontSize: 13, textAlign: "center", marginBottom: 8 },
  analysisCard: {
    marginTop: 14, padding: spacing.lg, backgroundColor: colors.surface,
    borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderSoft, ...shadows.card,
  },
  arow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7 },
  alabel: { fontSize: 13, color: colors.textMuted },
  avalue: { fontSize: 13, color: colors.textMain, fontWeight: "600", textTransform: "capitalize" },
  notes: { fontSize: 13, color: colors.textMuted, fontStyle: "italic", marginTop: 8 },
  recCard: {
    width: 150, padding: 10, marginRight: 10, backgroundColor: colors.surface,
    borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderSoft,
  },
  recImg: { width: "100%", height: 120, borderRadius: radii.md, backgroundColor: colors.surfaceSecondary },
  recBrand: { ...typography.brand, marginTop: 8 },
  recName: { fontSize: 11.5, color: colors.textMain, fontWeight: "500", marginTop: 2 },
  recPrice: { fontSize: 13, fontWeight: "600", color: colors.textMain, marginTop: 4 },
  recBadge: {
    marginTop: 6, flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: colors.sustainBg, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: radii.pill, alignSelf: "flex-start",
  },
  recBadgeText: { fontSize: 9, color: colors.sustainText, fontWeight: "600" },
});
