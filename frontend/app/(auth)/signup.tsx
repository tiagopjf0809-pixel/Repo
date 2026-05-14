import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router } from "expo-router";
import { useAuth } from "../../src/api";
import { colors, radii, spacing, typography, shadows } from "../../src/theme";

export default function Signup() {
  const { signup } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signup(email.trim().toLowerCase(), password, fullName.trim() || undefined);
      router.replace("/quiz");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandBlock}>
            <Text style={styles.brand}>Lumi</Text>
            <Text style={styles.tagline}>fashion · beauty · you</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>Create your account</Text>
            <Text style={styles.sub}>Discover style and beauty tailored to you.</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              testID="signup-name-input"
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              value={fullName}
              onChangeText={setFullName}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="signup-email-input"
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              testID="signup-password-input"
              style={styles.input}
              secureTextEntry
              placeholder="At least 6 characters"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
            />

            {error && (
              <Text testID="signup-error" style={styles.error}>{error}</Text>
            )}

            <TouchableOpacity
              testID="signup-submit-button"
              style={[styles.btn, loading && { opacity: 0.6 }]}
              onPress={onSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create account</Text>}
            </TouchableOpacity>

            <Link href="/(auth)/login" asChild>
              <TouchableOpacity testID="signup-go-login" style={styles.linkRow}>
                <Text style={styles.muted}>Have an account? </Text>
                <Text style={styles.link}>Sign in</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, padding: spacing.xl, justifyContent: "center" },
  brandBlock: { alignItems: "center", marginBottom: spacing.xl },
  brand: { fontSize: 48, fontWeight: "300", fontStyle: "italic", color: colors.textMain, letterSpacing: -1 },
  tagline: { ...typography.small, marginTop: 4, letterSpacing: 2, textTransform: "uppercase", fontSize: 10 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadows.card,
  },
  heading: { ...typography.h2, marginBottom: 6 },
  sub: { ...typography.body, marginBottom: spacing.lg },
  label: { ...typography.overline, marginTop: spacing.md, marginBottom: 8 },
  input: {
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.textMain,
  },
  btn: {
    marginTop: spacing.xl,
    backgroundColor: colors.ctaBg,
    paddingVertical: 16,
    borderRadius: radii.pill,
    alignItems: "center",
    ...shadows.cta,
  },
  btnText: { color: colors.ctaText, fontSize: 15, fontWeight: "600", letterSpacing: 0.3 },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg, padding: 4 },
  muted: { ...typography.small, color: colors.textMuted },
  link: { ...typography.small, color: colors.primary, fontWeight: "600" },
  error: { color: "#B23A3A", marginTop: spacing.md, fontSize: 13 },
});
