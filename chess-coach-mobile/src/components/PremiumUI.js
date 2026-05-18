import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export const palette = {
  ink: "#FFFFFF",
  charcoal: "#242832",
  ivory: "#0F1115",
  paper: "#181B22",
  line: "#2F3542",
  lineDark: "#404756",
  gold: "#D7B35A",
  goldSoft: "#E3C66B",
  sage: "#3F6D54",
  teal: "#2E7D88",
  wine: "#9A4C61",
  muted: "#AEB6C3",
  mutedDark: "#D5DBE5",
  danger: "#C95A6A",
};

const shadow = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 14 },
  shadowOpacity: 0.12,
  shadowRadius: 24,
  elevation: 5,
};

export function AppShell({
  children,
  eyebrow,
  title,
  subtitle,
  action,
  showBack = false,
  scroll = true,
  contentStyle,
}) {
  const Container = scroll ? ScrollView : View;
  const containerProps = scroll
    ? {
        style: styles.contentLayer,
        contentContainerStyle: [styles.scrollContent, contentStyle],
        automaticallyAdjustKeyboardInsets: Platform.OS === "ios",
        keyboardDismissMode: Platform.OS === "ios" ? "interactive" : "on-drag",
        keyboardShouldPersistTaps: "handled",
        showsVerticalScrollIndicator: false,
      }
    : { style: [styles.staticContent, styles.contentLayer, contentStyle] };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={palette.ivory} />
      <View pointerEvents="none" style={styles.backdrop} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        style={styles.keyboardAvoider}
      >
        <Container {...containerProps}>
          <View style={styles.topBar}>
            {showBack ? (
              <IconButton icon="arrow-left" onPress={() => router.back()} />
            ) : (
              <BrandMark />
            )}
            {action}
          </View>

          {(eyebrow || title || subtitle) && (
            <View style={styles.header}>
              {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          )}

          {children}
        </Container>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function BrandMark({ label = "CC" }) {
  return (
    <View style={styles.brandMark}>
      <MaterialCommunityIcons name="chess-king" size={18} color={palette.gold} />
      <Text style={styles.brandText}>{label}</Text>
    </View>
  );
}

export function IconButton({ icon, onPress, color = palette.ink, variant = "light" }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        variant === "dark" && styles.iconButtonDark,
        pressed && styles.pressed,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={21} color={color} />
    </Pressable>
  );
}

export function PrimaryButton({ title, icon = "arrow-right", onPress, tone = "dark", disabled = false, style }) {
  const isLight = tone === "light";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        isLight && styles.primaryButtonLight,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.primaryButtonText, isLight && styles.primaryButtonTextLight]}>
        {title}
      </Text>
      <MaterialCommunityIcons
        name={icon}
        size={19}
        color={palette.ivory}
      />
    </Pressable>
  );
}

export function SecondaryButton({ title, icon, onPress, disabled = false, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={18} color={palette.ink} /> : null}
      <Text style={styles.secondaryButtonText}>{title}</Text>
    </Pressable>
  );
}

export function StatPill({ label, value, icon, tone = "sage" }) {
  const toneStyle = tone === "gold" ? styles.statGold : tone === "wine" ? styles.statWine : styles.statSage;

  return (
    <View style={[styles.statPill, toneStyle]}>
      {icon ? <MaterialCommunityIcons name={icon} size={18} color={palette.ink} /> : null}
      <View style={styles.statCopy}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

export function FeatureRow({ title, subtitle, icon, meta, onPress, accent = palette.sage }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.featureRow, pressed && styles.pressed]}
    >
      <View style={[styles.featureIcon, { backgroundColor: accent }]}>
        <MaterialCommunityIcons name={icon} size={24} color={palette.ink} />
      </View>
      <View style={styles.featureCopy}>
        <View style={styles.featureTitleLine}>
          <Text style={styles.featureTitle}>{title}</Text>
          {meta ? <Text style={styles.featureMeta}>{meta}</Text> : null}
        </View>
        <Text style={styles.featureSubtitle}>{subtitle}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color={palette.muted} />
    </Pressable>
  );
}

export function SectionHeader({ label, action }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : null}
    </View>
  );
}

export function ChessAccent({ size = 132, compact = false }) {
  const rows = Array.from({ length: 4 });
  const cells = Array.from({ length: 4 });

  return (
    <View style={[styles.accentBoard, { width: size, height: size }]}>
      {rows.map((_, row) => (
        <View key={row} style={styles.accentRow}>
          {cells.map((__, cell) => {
            const dark = (row + cell) % 2 === 0;
            return (
              <View
                key={`${row}-${cell}`}
                style={[
                  styles.accentCell,
                  dark ? styles.accentCellDark : styles.accentCellLight,
                ]}
              >
                {!compact && row === 1 && cell === 2 ? (
                  <MaterialCommunityIcons name="chess-knight" size={22} color={palette.ink} />
                ) : null}
                {!compact && row === 2 && cell === 1 ? (
                  <MaterialCommunityIcons name="chess-pawn" size={18} color={palette.ink} />
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function PremiumPanel({ children, style, dark = false }) {
  return (
    <View style={[styles.panel, dark && styles.panelDark, style]}>
      {children}
    </View>
  );
}

export function EmptyState({ icon, title, body, actionTitle, onAction }) {
  return (
    <PremiumPanel style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name={icon} size={28} color={palette.gold} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {actionTitle ? <PrimaryButton title={actionTitle} onPress={onAction} icon="plus" /> : null}
    </PremiumPanel>
  );
}

export const uiStyles = StyleSheet.create({
  input: {
    backgroundColor: palette.paper,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 15,
  },
  inputDark: {
    backgroundColor: palette.charcoal,
    borderColor: palette.lineDark,
    color: palette.ink,
  },
});

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: palette.ivory,
    flex: 1,
  },
  keyboardAvoider: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.ivory,
  },
  contentLayer: {
    position: "relative",
    zIndex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 118,
  },
  staticContent: {
    flex: 1,
    padding: 20,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
  },
  header: {
    marginBottom: 22,
    marginTop: 12,
  },
  eyebrow: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    marginBottom: 7,
    textTransform: "uppercase",
  },
  title: {
    color: palette.ink,
    fontSize: 31,
    fontWeight: "900",
    lineHeight: 36,
  },
  subtitle: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 9,
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: "rgba(36,40,50,0.86)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 11,
  },
  brandText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: palette.paper,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  iconButtonDark: {
    backgroundColor: palette.charcoal,
    borderColor: palette.lineDark,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.52,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: palette.gold,
    borderRadius: 8,
    flexDirection: "row",
    gap: 9,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === "web" ? 12 : 0,
  },
  primaryButtonLight: {
    backgroundColor: palette.goldSoft,
  },
  primaryButtonText: {
    color: palette.ivory,
    fontSize: 15,
    fontWeight: "900",
  },
  primaryButtonTextLight: {
    color: palette.ivory,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "rgba(24,27,34,0.86)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "web" ? 11 : 0,
  },
  secondaryButtonText: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  statPill: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    flex: 1,
    gap: 10,
    minHeight: 70,
    minWidth: 112,
    padding: 12,
  },
  statSage: {
    backgroundColor: "#243A2D",
  },
  statGold: {
    backgroundColor: "#3B311C",
  },
  statWine: {
    backgroundColor: "#3D222C",
  },
  statCopy: {
    flex: 1,
  },
  statValue: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "900",
  },
  statLabel: {
    color: palette.mutedDark,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  featureRow: {
    alignItems: "center",
    backgroundColor: palette.paper,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 11,
    minHeight: 90,
    padding: 13,
    ...shadow,
  },
  featureIcon: {
    alignItems: "center",
    borderRadius: 8,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  featureCopy: {
    flex: 1,
  },
  featureTitleLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  featureTitle: {
    color: palette.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
  },
  featureMeta: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: "900",
  },
  featureSubtitle: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 4,
  },
  sectionLabel: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  sectionAction: {
    color: palette.gold,
    fontSize: 13,
    fontWeight: "800",
  },
  accentBoard: {
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    transform: [{ rotate: "-3deg" }],
  },
  accentRow: {
    flex: 1,
    flexDirection: "row",
  },
  accentCell: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  accentCellDark: {
    backgroundColor: "#2C2C2C",
  },
  accentCellLight: {
    backgroundColor: "#D4AF37",
  },
  panel: {
    backgroundColor: "rgba(24,27,34,0.88)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 8,
    borderWidth: 1,
    padding: 17,
    ...shadow,
  },
  panelDark: {
    backgroundColor: "rgba(36,40,50,0.9)",
    borderColor: "rgba(255,255,255,0.16)",
  },
  emptyState: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 30,
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: "#3A3219",
    borderRadius: 8,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyBody: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 290,
    textAlign: "center",
  },
});
