import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import {
  AppShell,
  EmptyState,
  PremiumPanel,
  PrimaryButton,
  SectionHeader,
  StatPill,
  palette,
} from "../components/PremiumUI";

export default function DailyTrainingScreen({ showBack = true }) {
  const [training, setTraining] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTraining() {
      try {
        const response = await api.get("/daily-training/today");
        setTraining(response.data);
      } catch (error) {
        console.log(error.response?.data || error.message);
      } finally {
        setLoading(false);
      }
    }

    loadTraining();
  }, []);

  const actions = training?.recommended_actions || [];
  const schedule = training?.study_schedule;

  const scheduleDailyReminder = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Daily reminder", "Push notifications are available on iOS and Android builds.");
      return;
    }

    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Notifications disabled", "Enable notifications to receive daily training reminders.");
      return;
    }

    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Chess Coach training",
        body: "Your daily training session is ready.",
      },
      trigger: {
        hour: 19,
        minute: 0,
        repeats: true,
      },
    });

    Alert.alert("Reminder set", "Daily training reminders are scheduled for 7:00 PM.");
  };

  return (
    <AppShell
      showBack={showBack}
      eyebrow="Daily Training"
      title="Today's training."
      subtitle="Your session uses only your saved schedule, due reviews, puzzles, and weaknesses."
    >
      {loading ? (
        <PremiumPanel style={styles.loadingPanel}>
          <ActivityIndicator size="large" color={palette.gold} />
        </PremiumPanel>
      ) : training ? (
        <>
          <View style={styles.statsRow}>
            <StatPill icon="timer-outline" value={schedule?.duration_minutes ?? 0} label="minutes" tone="gold" />
            <StatPill icon="bullseye-arrow" value={training.mistake_replay?.due_now ?? 0} label="due reviews" />
            <StatPill icon="puzzle" value={training.puzzles?.attempts ?? 0} label="puzzles" tone="wine" />
          </View>

          <PremiumPanel style={styles.reminderPanel}>
            <Text style={styles.reminderTitle}>Daily reminder</Text>
            <Text style={styles.reminderText}>Get a local notification every evening for your training session.</Text>
            <PrimaryButton title="Set 7 PM reminder" icon="bell-plus" onPress={scheduleDailyReminder} />
          </PremiumPanel>

          {schedule ? (
            <PremiumPanel dark style={styles.startPanel}>
              <Text style={styles.startTitle}>{schedule.focus_area}</Text>
              <Text style={styles.startText}>{schedule.activity}</Text>
              <PrimaryButton title="Begin session" icon="play" tone="light" onPress={() => router.push("/mistake-replay")} />
            </PremiumPanel>
          ) : (
            <EmptyState
              icon="calendar-blank"
              title="No study schedule today"
              body="Create or import training data to generate real daily work."
            />
          )}

          {actions.length > 0 ? (
            <>
              <SectionHeader label="Recommended Actions" />
              {actions.map((action) => (
                <PremiumPanel key={action} style={styles.blockCard}>
                  <Text style={styles.blockText}>{action}</Text>
                </PremiumPanel>
              ))}
            </>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="clipboard-text-outline"
          title="No training data"
          body="Import games or build a schedule before starting daily training."
        />
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  loadingPanel: {
    alignItems: "center",
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginBottom: 14,
  },
  startPanel: {
    gap: 11,
    marginBottom: 18,
  },
  reminderPanel: {
    gap: 10,
    marginBottom: 14,
  },
  reminderTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  reminderText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  startTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 27,
  },
  startText: {
    color: palette.mutedDark,
    fontSize: 14,
    lineHeight: 20,
  },
  blockCard: {
    gap: 12,
    marginBottom: 11,
  },
  blockText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
