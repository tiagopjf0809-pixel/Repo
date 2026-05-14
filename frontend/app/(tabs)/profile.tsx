import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, useAuth } from "../../src/api";
import { colors, radii, spacing, typography, shadows } from "../../src/theme";

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const [latestScan, setLatestScan] = useState<any>(null);

  useFocusEffect(useCallback(() => {
    refreshUser();
    api.get("/beauty/face-scan/latest").then((r) => setLatestScan(r.data)).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarInitial}>{(user?.full_name || user?.email || "L")[0].toUpperCase()}</Text>
          </View>
          <Text style={styles.name} testID="profile-name">{user?.full_name || user?.email?.split("@")[0]}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* Style identity card */}
        <View style={styles.identityCard} testID="style-identity-card">
          <Text style={typography.overline}>Style identity</Text>
          {user?.style_identity ? (
            <>
              <Text style={styles.identityName}>{user.style_identity}</Text>
              <Text style={styles.identityDesc}>
                {(user as any).style_description || "Your curated style."}
              </Text>
              <TouchableOpacity
                testID="retake-quiz-button"
                style={styles.outlineBtn}
                onPress={() => router.push("/quiz")}
              >
                <Ionicons name="reload-outline" size={14} color={colors.textMain} />
                <Text style={styles.outlineBtnText}>Retake quiz</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.identityName}>Untapped</Text>
              <Text style={styles.identityDesc}>
                Take the 60-second style quiz to unlock a personalized identity and feed.
              </Text>
              <TouchableOpacity
                testID="start-quiz-button"
                style={styles.solidBtn}
                onPress={() => router.push("/quiz")}
              >
                <Ionicons name="sparkles" size={14} color="#fff" />
                <Text style={styles.solidBtnText}>Take style quiz</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Face scan card */}
        <View style={styles.card}>
          <Text style={typography.overline}>Beauty profile</Text>
          {latestScan?.analysis ? (
            <View style={{ marginTop: 8 }}>
              <View style={styles.kvRow}>
                <Text style={styles.k}>Skin tone</Text>
                <Text style={styles.v}>{latestScan.analysis.skin_tone}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.k}>Undertone</Text>
                <Text style={styles.v}>{latestScan.analysis.undertone}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.k}>Face shape</Text>
                <Text style={styles.v}>{latestScan.analysis.face_shape}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.k}>Eye shape</Text>
                <Text style={styles.v}>{latestScan.analysis.eye_shape}</Text>
              </View>
            </View>
          ) : (
            <Text style={[typography.body, { marginVertical: 8 }]}>
              No face scan yet. Get tailored makeup recommendations in 30 seconds.
            </Text>
          )}
          <TouchableOpacity
            testID="open-facescan-from-profile"
            style={styles.outlineBtn}
            onPress={() => router.push("/facescan")}
          >
            <Ionicons name="scan-outline" size={14} color={colors.textMain} />
            <Text style={styles.outlineBtnText}>{latestScan?.analysis ? "Re-scan" : "Start face scan"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity testID="logout-button" style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={16} color={colors.textMain} />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Lumi · v1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.xl, paddingBottom: 100 },
  header: { alignItems: "center", marginBottom: spacing.xl },
  avatarLarge: {
    width: 88, height: 88, borderRadius: 999, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center", marginBottom: 12, ...shadows.card,
  },
  avatarInitial: { fontSize: 32, fontWeight: "300", color: colors.textMain },
  name: { fontSize: 22, fontWeight: "600", color: colors.textMain },
  email: { ...typography.small, marginTop: 2 },
  identityCard: {
    backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.borderSoft, marginBottom: spacing.md, ...shadows.card,
  },
  identityName: { fontSize: 28, fontWeight: "300", color: colors.textMain, marginTop: 6, letterSpacing: -0.5 },
  identityDesc: { ...typography.body, marginTop: 6 },
  solidBtn: {
    flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 6,
    backgroundColor: colors.ctaBg, paddingVertical: 11, paddingHorizontal: 18,
    borderRadius: radii.pill, marginTop: 14,
  },
  solidBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  outlineBtn: {
    flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 6,
    backgroundColor: colors.surfaceSecondary, paddingVertical: 11, paddingHorizontal: 18,
    borderRadius: radii.pill, marginTop: 14,
  },
  outlineBtnText: { color: colors.textMain, fontWeight: "600", fontSize: 13 },
  card: {
    backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.borderSoft, marginBottom: spacing.md, ...shadows.card,
  },
  kvRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  k: { fontSize: 13, color: colors.textMuted },
  v: { fontSize: 13, color: colors.textMain, fontWeight: "600", textTransform: "capitalize" },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 14, borderRadius: radii.pill, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, marginTop: spacing.md,
  },
  logoutText: { color: colors.textMain, fontWeight: "600", fontSize: 14 },
  footer: { textAlign: "center", marginTop: 24, fontSize: 11, color: colors.textMuted, letterSpacing: 1 },
});
