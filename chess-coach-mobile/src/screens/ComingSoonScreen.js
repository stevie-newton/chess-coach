import { router } from "expo-router";
import { StyleSheet, Text } from "react-native";
import {
  AppShell,
  EmptyState,
  PremiumPanel,
  PrimaryButton,
  palette,
} from "../components/PremiumUI";

export default function ComingSoonScreen({
  eyebrow = "Coach Lab",
  title = "Training room in progress.",
  subtitle = "This section is styled and ready for product logic.",
  icon = "hammer-wrench",
  showBack = true,
}) {
  return (
    <AppShell showBack={showBack} eyebrow={eyebrow} title={title} subtitle={subtitle}>
      <EmptyState
        icon={icon}
        title="Premium shell ready"
        body="Use this route for focused tools, generated lessons, and chess-specific workflows without dropping back to a blank page."
      />
      <PremiumPanel dark style={styles.panel}>
        <Text style={styles.panelTitle}>Design baseline</Text>
        <Text style={styles.panelText}>
          The route now inherits the app palette, spacing, back navigation, and product-grade empty state.
        </Text>
        <PrimaryButton title="Back to dashboard" icon="view-dashboard" tone="light" onPress={() => router.push("/(tabs)/dashboard")} />
      </PremiumPanel>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 10,
    marginTop: 12,
  },
  panelTitle: {
    color: palette.goldSoft,
    fontSize: 18,
    fontWeight: "900",
  },
  panelText: {
    color: palette.mutedDark,
    fontSize: 14,
    lineHeight: 20,
  },
});
