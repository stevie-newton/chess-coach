import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useContext, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  AppShell,
  BrandMark,
  ChessAccent,
  PremiumPanel,
  PrimaryButton,
  palette,
  uiStyles,
} from "../components/PremiumUI";
import { AuthContext } from "../context/AuthContext";

export default function LoginScreen() {
  const { login } = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      await login(email, password);
      router.replace("/(tabs)/dashboard");
    } catch (error) {
      Alert.alert(
        "Login failed",
        error.response?.data?.detail || "Something went wrong"
      );
    }
  };

  return (
    <AppShell contentStyle={styles.container} showTopBar={false}>
      <View style={styles.hero}>
        <BrandMark size="hero" transparent />
        <ChessAccent size={146} />
      </View>

      <PremiumPanel style={styles.formPanel}>
        <Text style={styles.kicker}>Premium chess training</Text>
        <Text style={styles.title}>Welcome back.</Text>
        <Text style={styles.subtitle}>
          Pick up your analysis queue, replay old mistakes, and keep your training streak alive.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={uiStyles.input}
            placeholder="you@example.com"
            placeholderTextColor={palette.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={uiStyles.input}
            placeholder="Your password"
            placeholderTextColor={palette.muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <PrimaryButton title="Log in" icon="login" onPress={handleLogin} />

        <Pressable style={styles.linkRow} onPress={() => router.push("/auth/register")}>
          <MaterialCommunityIcons name="account-plus" size={18} color={palette.gold} />
          <Text style={styles.linkText}>Create an account</Text>
        </Pressable>
      </PremiumPanel>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
  },
  hero: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  formPanel: {
    gap: 14,
  },
  kicker: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: palette.ink,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 39,
  },
  subtitle: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  fieldGroup: {
    gap: 7,
  },
  label: {
    color: palette.mutedDark,
    fontSize: 13,
    fontWeight: "900",
  },
  linkRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    paddingVertical: 6,
  },
  linkText: {
    color: palette.gold,
    fontSize: 14,
    fontWeight: "900",
  },
});
