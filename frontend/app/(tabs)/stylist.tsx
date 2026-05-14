import { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";
import { colors, radii, spacing, typography, shadows } from "../../src/theme";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Outfit for a first date next week",
  "Build a capsule wardrobe under $300",
  "What to wear to a beach wedding",
  "Athleisure for a coffee run",
];

export default function Stylist() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Greet
    setMessages([{
      role: "assistant",
      content: "Hi, I'm your Lumi stylist. Tell me about an occasion, your vibe, or just say what's on your mind — I'll build a look around you.",
    }]);
  }, []);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const res = await api.post("/stylist/chat", { session_id: sessionId, message: msg });
      setSessionId(res.data.session_id);
      setMessages((m) => [...m, { role: "assistant", content: res.data.reply }]);
    } catch (e: any) {
      setMessages((m) => [...m, {
        role: "assistant",
        content: "Sorry — I had trouble responding. Please try again.",
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Stylist</Text>
            <Text style={styles.sub}>Your AI personal shopper</Text>
          </View>
          <View style={styles.avatar}><Ionicons name="sparkles" size={20} color={colors.primary} /></View>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.chatContainer}
          showsVerticalScrollIndicator={false}
          testID="stylist-chat"
        >
          {messages.map((m, i) => (
            <View
              key={i}
              style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.aiBubble]}
              testID={`msg-${i}-${m.role}`}
            >
              {m.role === "assistant" && (
                <View style={styles.aiHeader}>
                  <Ionicons name="sparkles" size={11} color={colors.primary} />
                  <Text style={styles.aiName}>Lumi</Text>
                </View>
              )}
              <Text style={[styles.msgText, m.role === "user" && { color: colors.textMain }]}>{m.content}</Text>
            </View>
          ))}
          {loading && (
            <View style={[styles.bubble, styles.aiBubble]}>
              <ActivityIndicator color={colors.primary} size="small" />
            </View>
          )}
          {messages.length <= 1 && (
            <View style={styles.suggestionsCol}>
              {SUGGESTIONS.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.suggestionChip}
                  onPress={() => send(s)}
                  testID={`suggestion-${i}`}
                >
                  <Text style={styles.suggestionText}>{s}</Text>
                  <Ionicons name="arrow-forward" size={13} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            testID="stylist-input"
            style={styles.input}
            placeholder="Ask your stylist..."
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send()}
            returnKeyType="send"
            editable={!loading}
          />
          <TouchableOpacity
            testID="stylist-send"
            style={[styles.sendBtn, (!input.trim() || loading) && { opacity: 0.4 }]}
            onPress={() => send()}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="arrow-up" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
    paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md,
  },
  brand: { fontSize: 32, fontWeight: "300", fontStyle: "italic", color: colors.textMain },
  sub: { ...typography.small },
  avatar: {
    width: 44, height: 44, borderRadius: 999, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  chatContainer: { padding: spacing.lg, paddingBottom: 20 },
  bubble: { maxWidth: "85%", padding: 14, borderRadius: radii.lg, marginBottom: 10 },
  userBubble: { alignSelf: "flex-end", backgroundColor: colors.surfaceSecondary, borderTopRightRadius: 4 },
  aiBubble: {
    alignSelf: "flex-start", backgroundColor: colors.surface,
    borderTopLeftRadius: 4, borderWidth: 1, borderColor: colors.borderSoft, ...shadows.card,
  },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  aiName: { fontSize: 10, fontWeight: "700", color: colors.primary, letterSpacing: 1, textTransform: "uppercase" },
  msgText: { fontSize: 14.5, color: colors.textMain, lineHeight: 21 },
  suggestionsCol: { gap: 8, marginTop: 12 },
  suggestionChip: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: radii.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  suggestionText: { fontSize: 13, color: colors.textMain, flex: 1 },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1, backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: radii.pill,
    fontSize: 14.5, color: colors.textMain,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 999, backgroundColor: colors.ctaBg,
    alignItems: "center", justifyContent: "center",
  },
});
