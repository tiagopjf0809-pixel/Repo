import { Stack } from "expo-router";
import { AuthProvider } from "../src/api";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FAFAF8" } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="quiz" options={{ presentation: "modal" }} />
          <Stack.Screen name="facescan" options={{ presentation: "modal" }} />
          <Stack.Screen name="product/[id]" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
