import { Stack } from "expo-router";
import { AuthProvider } from "../src/context/AuthContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: true }}>
        <Stack.Screen name="index" options={{ title: "Chess Coach" }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ title: "Login" }} />
        <Stack.Screen name="auth/register" options={{ title: "Register" }} />
        <Stack.Screen name="import-games" options={{ title: "Import Games" }} />
        <Stack.Screen name="game-session" options={{ title: "Game Session" }} />
        <Stack.Screen name="game-detail" options={{ title: "Game Detail" }} />
        <Stack.Screen name="daily-training" options={{ title: "Daily Training" }} />
        <Stack.Screen name="mistake-replay" options={{ title: "Mistake Replay" }} />
        <Stack.Screen name="coach" options={{ title: "AI Coach" }} />
        <Stack.Screen name="study-schedule" options={{ title: "Study Schedule" }} />
        <Stack.Screen name="openings" options={{ title: "Openings" }} />
        <Stack.Screen name="opening-practice" options={{ title: "Opening Practice" }} />
        <Stack.Screen name="opening-lines" options={{ title: "Opening Lines" }} />
        <Stack.Screen name="tournaments" options={{ title: "Tournaments" }} />
        <Stack.Screen name="weaknesses" options={{ title: "Weaknesses" }} />
      </Stack>
    </AuthProvider>
  );
}
