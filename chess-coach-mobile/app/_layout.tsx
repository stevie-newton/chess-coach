import { Stack } from "expo-router";
import { AuthProvider } from "../src/context/AuthContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/register" />
        <Stack.Screen name="import-games" />
        <Stack.Screen name="game-session" />
        <Stack.Screen name="game-detail" />
        <Stack.Screen name="daily-training" />
        <Stack.Screen name="mistake-replay" />
        <Stack.Screen name="coach" />
        <Stack.Screen name="study-schedule" />
        <Stack.Screen name="openings" />
        <Stack.Screen name="opening-practice" />
        <Stack.Screen name="opening-detail" />
        <Stack.Screen name="opening-lines" />
        <Stack.Screen name="endgames" />
        <Stack.Screen name="calculation-training" />
        <Stack.Screen name="tournaments" />
        <Stack.Screen name="weaknesses" />
      </Stack>
    </AuthProvider>
  );
}
