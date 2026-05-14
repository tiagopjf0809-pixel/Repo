import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, useAuth } from "../src/api";
import { colors, radii, spacing, typography, shadows } from "../src/theme";

const STEPS = [
  { key: "colors", title: "Colors you love", multi: true,
    options: ["neutrals", "earth tones", "monochrome", "pastels", "jewel tones", "bold brights"] },
  { key: "fit", title: "Preferred fit", multi: false,
    options: ["fitted", "tailored", "oversized", "relaxed"] },
  { key: "inspiration", title: "Inspiration", multi: true,
    options: ["minimalist", "streetwear", "quiet luxury", "old money", "vintage", "athletic"] },
  { key: "budget", title: "Average budget per piece", multi: false,
    options: ["Under $50", "$50–$150", "$150–$300", "$300+"] },
  { key: "lifestyle", title: "Your lifestyle", multi: false,
    options: ["student", "corporate", "casual", "nightlife", "creative", "athletic"] },
];

type Answers = Record<string, string | string[]>;

export default function Quiz() {
  const { refreshUser } = useAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ colors: [], inspiration: [] });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const current = STEPS[step];
  const value = answers[current.key];
  const isAnswered = current.multi ? (value as string[])?.length > 0 : !!value;

  const toggle = (opt: string) => {
    if (current.multi) {
      const arr = (answers[current.key] as string[]) || [];
      setAnswers({
        ...answers,
        [current.key]: arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt],
      });
    } else {
      setAnswers({ ...answers, [current.key]: opt });
    }
  };

  const next = async () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      setSubmitting(true);
      try {
        const payload = {
          colors: answers.colors as string[],
          fit: answers.fit as string,
          inspiration: answers.inspiration as string[],
          budget: answers.budget as string,
          lifestyle: answers.lifestyle as string,
        };
        const res = await api.post("/style/quiz", payload);
        setResult(res.data);
        refreshUser();
      } catch (e: any) {
        // fall back gracefully
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (result) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.resultScroll}>
          <Ionicons name="sparkles" size={40} color={colors.primary} style={{ alignSelf: "center" }} />
          <Text style={styles.resultEyebrow}>Your style identity</Text>
          <Text style={styles.resultName} testID="quiz-result-name">{result.identity}</Text>
          <Text style={styles.resultDesc}>{result.description}</Text>

          {result.suggested_products?.length > 0 && (
            <>
              <Text style={[typography.overline, { marginTop: 32 }]}>Curated for you</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                {result.suggested_products.map((p: any) => (
                  <View key={p.id} style={styles.miniCard}>
                    <View style={styles.miniImg} />
                    <Text style={styles.miniBrand}>{p.brand}</Text>
                    <Text style={styles.miniName} numberOfLines={2}>{p.name}</Text>
                    <Text style={styles.miniPrice}>${p.price.toFixed(2)}</Text>
                  </View>
                ))}
              </ScrollView>
            </>
          )}

          <TouchableOpacity
            testID="quiz-done-button"
            style={styles.cta}
            onPress={() => router.replace("/discover")}
          >
            <Text style={styles.ctaText}>Start exploring</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity testID="quiz-close" onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.progress}>{step + 1} / {STEPS.length}</Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={typography.overline}>Step {step + 1}</Text>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={typography.body}>
          {current.multi ? "Pick all that apply." : "Pick one."}
        </Text>

        <View style={styles.optionsWrap}>
          {current.options.map((opt) => {
            const selected = current.multi
              ? ((answers[current.key] as string[]) || []).includes(opt)
              : answers[current.key] === opt;
            return (
              <TouchableOpacity
                key={opt}
                testID={`quiz-option-${opt.replace(/\s+/g, "-")}`}
                onPress={() => toggle(opt)}
                activeOpacity={0.85}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{opt}</Text>
                {selected && <Ionicons name="checkmark-circle" size={16} color="#fff" />}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          testID="quiz-next-button"
          disabled={!isAnswered || submitting}
          style={[styles.cta, (!isAnswered || submitting) && { opacity: 0.4 }]}
          onPress={next}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.ctaText}>
              {step === STEPS.length - 1 ? "See my style" : "Continue"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  progress: { ...typography.small, fontWeight: "600" },
  progressBar: { height: 3, marginHorizontal: spacing.xl, backgroundColor: colors.border, borderRadius: 999 },
  progressFill: { height: 3, backgroundColor: colors.primary, borderRadius: 999 },
  body: { padding: spacing.xl, paddingTop: spacing.xxl },
  title: { fontSize: 30, fontWeight: "300", color: colors.textMain, marginVertical: 8, letterSpacing: -0.5 },
  optionsWrap: { marginTop: 24, gap: 10 },
  option: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 16, borderRadius: radii.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  optionSelected: { backgroundColor: colors.ctaBg, borderColor: colors.ctaBg },
  optionText: { fontSize: 15, color: colors.textMain, fontWeight: "500", textTransform: "capitalize" },
  optionTextSelected: { color: "#fff" },
  footer: { padding: spacing.xl },
  cta: {
    backgroundColor: colors.ctaBg, paddingVertical: 16,
    borderRadius: radii.pill, alignItems: "center", ...shadows.cta,
  },
  ctaText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  resultScroll: { padding: spacing.xl, paddingTop: spacing.xxl, paddingBottom: 60 },
  resultEyebrow: { ...typography.overline, textAlign: "center", marginTop: 16 },
  resultName: {
    fontSize: 44, fontWeight: "300", letterSpacing: -1, color: colors.textMain,
    textAlign: "center", marginTop: 6, fontStyle: "italic",
  },
  resultDesc: { ...typography.body, textAlign: "center", marginTop: 14, paddingHorizontal: 8 },
  miniCard: {
    width: 130, marginRight: 10, padding: 10,
    backgroundColor: colors.surface, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  miniImg: { height: 110, backgroundColor: colors.surfaceSecondary, borderRadius: radii.sm, marginBottom: 8 },
  miniBrand: { ...typography.brand, fontSize: 9 },
  miniName: { fontSize: 11, color: colors.textMain, fontWeight: "500", marginTop: 2 },
  miniPrice: { fontSize: 12, fontWeight: "600", color: colors.textMain, marginTop: 4 },
});
