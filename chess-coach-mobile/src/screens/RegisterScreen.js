import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useContext, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  AppShell,
  BrandMark,
  PremiumPanel,
  PrimaryButton,
  palette,
  uiStyles,
} from "../components/PremiumUI";
import { AuthContext } from "../context/AuthContext";

export default function RegisterScreen() {
  const { register } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [chessLevel, setChessLevel] = useState("");
  const [targetRating, setTargetRating] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    try {
      const response = await register({
        email,
        username,
        password,
        chess_level: chessLevel,
        target_rating: targetRating ? Number(targetRating) : null,
      });

      Alert.alert(
        "Account created",
        response.data?.is_email_verified
          ? "You can now log in."
          : "Check your email to confirm your account before logging in."
      );
      router.replace("/auth/login");
    } catch (error) {
      Alert.alert(
        "Registration failed",
        error.response?.data?.detail || "Something went wrong"
      );
    }
  };

  return (
    <AppShell scroll={false} contentStyle={styles.container}>
      <View style={styles.hero}>
        <BrandMark />
      </View>

      <PremiumPanel style={styles.formPanel}>
        <Text style={styles.kicker}>Build your coach profile</Text>
        <Text style={styles.title}>Create account.</Text>
        <Text style={styles.subtitle}>
          Set your rating target and training level so the coach can shape the work around you.
        </Text>

        <TextInput style={uiStyles.input} placeholder="Email" placeholderTextColor={palette.muted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={uiStyles.input} placeholder="Username" placeholderTextColor={palette.muted} value={username} onChangeText={setUsername} />
        <TextInput style={uiStyles.input} placeholder="Chess level, e.g. beginner" placeholderTextColor={palette.muted} value={chessLevel} onChangeText={setChessLevel} />
        <TextInput style={uiStyles.input} placeholder="Target rating, e.g. 1800" placeholderTextColor={palette.muted} keyboardType="numeric" value={targetRating} onChangeText={setTargetRating} />
        <TextInput style={uiStyles.input} placeholder="Password" placeholderTextColor={palette.muted} secureTextEntry value={password} onChangeText={setPassword} />

        <PrimaryButton title="Create account" icon="account-plus" onPress={handleRegister} />

        <Pressable style={styles.linkRow} onPress={() => router.replace("/auth/login")}>
          <MaterialCommunityIcons name="login" size={18} color={palette.gold} />
          <Text style={styles.linkText}>Already have an account?</Text>
        </Pressable>
      </PremiumPanel>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
  },
  hero: {
    alignItems: "flex-start",
    marginBottom: 22,
  },
  formPanel: {
    gap: 12,
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
