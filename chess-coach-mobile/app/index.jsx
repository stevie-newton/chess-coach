import { router } from "expo-router";
import { useContext, useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { BrandMark, palette } from "../src/components/PremiumUI";
import { AuthContext } from "../src/context/AuthContext";

export default function Index() {
  const { loading, isAuthenticated } = useContext(AuthContext);

  useEffect(() => {
    if (!loading) {
      router.replace(isAuthenticated ? "/(tabs)/dashboard" : "/auth/login");
    }
  }, [loading, isAuthenticated]);

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: palette.ivory,
        flex: 1,
        gap: 14,
        justifyContent: "center",
        padding: 24,
      }}
    >
      <BrandMark />
      <ActivityIndicator size="large" color={palette.gold} />
      <Text style={{ color: palette.muted, fontSize: 15, fontWeight: "800" }}>
        Loading Chess Coach...
      </Text>
    </View>
  );
}
