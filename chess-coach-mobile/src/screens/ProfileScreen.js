import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Share, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import {
  AppShell,
  EmptyState,
  LoadingState,
  PremiumPanel,
  PrimaryButton,
  SecondaryButton,
  StatPill,
  palette,
} from "../components/PremiumUI";

const coachPersonalities = [
  ["friendly", "Friendly", "heart-outline", "Encouraging feedback with simple next steps."],
  ["strict", "Strict", "clipboard-check-outline", "Direct correction and disciplined rules."],
  ["grandmaster", "Grandmaster", "chess-king", "Candidate moves and deeper positional detail."],
];

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
      <AppShell scroll={false} showTopBar={false} contentStyle={styles.centerShell}>
        <LoadingState panel={false} />
      </AppShell>
    );
  }

  const user = summary?.user;
  const progression = summary?.progression;
  const selectedPersonality = user?.coach_personality || "friendly";

  const updateCoachPersonality = async (coachPersonality) => {
    try {
      const response = await api.put("/profiles/coach-settings", {
        coach_personality: coachPersonality,
      });
      setSummary((current) => ({
        ...current,
        user: {
          ...current.user,
          coach_personality: response.data.coach_personality,
        },
      }));
    } catch (error) {
      Alert.alert(
        "Coach settings",
        error.response?.data?.detail || "Could not update coach personality"
      );
    }
  };

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
            <StatPill icon="star-four-points" value={progression?.xp_points ?? 0} label="XP" tone="gold" />
            <StatPill icon="medal" value={progression?.level ?? 1} label="level" />
            <StatPill icon="fire" value={progression?.training_streak ?? 0} label="streak" tone="wine" />
          </View>

          {progression ? (
            <PremiumPanel style={styles.progressionPanel}>
              <Text style={styles.panelTitle}>Progression</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progression.level_progress}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {progression.xp_to_next_level} XP to level {progression.level + 1}
              </Text>

              <View style={styles.badgeGrid}>
                {progression.achievements.map((achievement) => (
                  <View
                    key={achievement.key}
                    style={achievement.unlocked ? styles.badgeUnlocked : styles.badgeLocked}
                  >
                    <Text style={styles.badgeTitle}>
                      {achievement.unlocked ? "✓ " : ""}
                      {achievement.title}
                    </Text>
                    <Text style={styles.badgeText}>
                      {achievement.progress}/{achievement.target} | {achievement.description}
                    </Text>
                  </View>
                ))}
              </View>
            </PremiumPanel>
          ) : null}

          <PremiumPanel style={styles.coachPanel}>
            <Text style={styles.panelTitle}>Coach personality</Text>
            <View style={styles.personalityGrid}>
              {coachPersonalities.map(([key, label, icon, description]) => {
                const selected = selectedPersonality === key;

                return (
                  <View key={key} style={styles.personalityItem}>
                    <SecondaryButton
                      title={label}
                      icon={icon}
                      onPress={() => updateCoachPersonality(key)}
                      style={selected ? styles.personalitySelected : styles.personalityButton}
                    />
                    <Text style={selected ? styles.personalityTextSelected : styles.personalityText}>
                      {description}
                    </Text>
                  </View>
                );
              })}
            </View>
          </PremiumPanel>

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
  progressionPanel: {
    gap: 12,
    marginBottom: 18,
  },
  progressTrack: {
    backgroundColor: "#252A34",
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    height: 14,
    overflow: "hidden",
  },
  progressFill: {
    backgroundColor: palette.gold,
    borderRadius: 8,
    height: "100%",
  },
  progressText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  badgeGrid: {
    gap: 8,
  },
  badgeUnlocked: {
    backgroundColor: "#243A2D",
    borderColor: palette.sage,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 11,
  },
  badgeLocked: {
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    opacity: 0.74,
    padding: 11,
  },
  badgeTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  badgeText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  coachPanel: {
    gap: 12,
    marginBottom: 18,
  },
  personalityGrid: {
    gap: 10,
  },
  personalityItem: {
    gap: 7,
  },
  personalityButton: {
    justifyContent: "flex-start",
  },
  personalitySelected: {
    backgroundColor: "#3A3219",
    borderColor: palette.gold,
    justifyContent: "flex-start",
  },
  personalityText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  personalityTextSelected: {
    color: palette.goldSoft,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
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
