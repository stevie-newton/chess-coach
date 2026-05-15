import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Share, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import {
  AppShell,
  EmptyState,
  PremiumPanel,
  PrimaryButton,
  StatPill,
  palette,
} from "../components/PremiumUI";

export default function ProfileScreen({ showBack = true }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/dashboard/summary");
      setSummary(response.data);
    } catch (error) {
      console.log(error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  if (loading) {
    return (
      <AppShell scroll={false} contentStyle={styles.centerShell}>
        <ActivityIndicator size="large" color={palette.gold} />
      </AppShell>
    );
  }

  const user = summary?.user;

  const exportProgressReport = async () => {
    try {
      const response = await api.get("/dashboard/progress-report");
      await Share.share({
        title: "Chess Coach Progress Report",
        message: response.data.report,
      });
    } catch (error) {
      Alert.alert(
        "Export failed",
        error.response?.data?.detail || "Could not export progress report"
      );
    }
  };

  return (
    <AppShell
      showBack={showBack}
      eyebrow="Player Profile"
      title="Your coach settings."
      subtitle="Profile details are loaded from your account and training history."
    >
      {user ? (
        <>
          <PremiumPanel dark style={styles.identityPanel}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.username?.charAt(0)?.toUpperCase() || "?"}</Text>
            </View>
            <View style={styles.identityCopy}>
              <Text style={styles.name}>{user.username}</Text>
              <Text style={styles.identityText}>Level: {user.chess_level || "Not set"}</Text>
              <Text style={styles.identityText}>Target rating: {user.target_rating || "Not set"}</Text>
            </View>
          </PremiumPanel>

          <View style={styles.statsRow}>
            <StatPill icon="chess-pawn" value={summary.games?.total ?? 0} label="games" tone="gold" />
            <StatPill icon="target" value={summary.training?.completed_sessions ?? 0} label="sessions" />
            <StatPill icon="puzzle" value={summary.puzzles?.attempts ?? 0} label="puzzles" tone="wine" />
          </View>

          <PremiumPanel style={styles.connectedPanel}>
            <Text style={styles.panelTitle}>Connected profiles</Text>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Chess.com</Text>
              <Text style={styles.profileValue}>{user.chesscom_username || "Not connected"}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Lichess</Text>
              <Text style={styles.profileValue}>{user.lichess_username || "Not connected"}</Text>
            </View>
          </PremiumPanel>
        </>
      ) : (
        <EmptyState
          icon="account-outline"
          title="No profile data"
          body="Log in or create an account to load your coach profile."
          actionTitle="Log in"
          onAction={() => router.replace("/auth/login")}
        />
      )}

      <PrimaryButton title="Import games" icon="download" onPress={() => router.push("/import-games")} />
      <View style={styles.actionSpacer} />
      <PrimaryButton title="Export progress report" icon="file-export" onPress={exportProgressReport} />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  centerShell: {
    alignItems: "center",
    justifyContent: "center",
  },
  identityPanel: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    marginBottom: 14,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: palette.goldSoft,
    borderRadius: 8,
    height: 64,
    justifyContent: "center",
    width: 64,
  },
  avatarText: {
    color: palette.ivory,
    fontSize: 30,
    fontWeight: "900",
  },
  identityCopy: {
    flex: 1,
  },
  name: {
    color: palette.ink,
    fontSize: 23,
    fontWeight: "900",
  },
  identityText: {
    color: palette.mutedDark,
    fontSize: 14,
    marginTop: 3,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginBottom: 18,
  },
  connectedPanel: {
    gap: 12,
    marginBottom: 18,
  },
  panelTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  profileRow: {
    borderTopColor: palette.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingTop: 12,
  },
  profileLabel: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: "800",
  },
  profileValue: {
    color: palette.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "right",
  },
  actionSpacer: {
    height: 10,
  },
});
