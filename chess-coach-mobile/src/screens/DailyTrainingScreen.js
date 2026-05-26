import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { Alert, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../api/client";
import {
  AppShell,
  EmptyState,
  LoadingState,
  PremiumPanel,
  PrimaryButton,
  SectionHeader,
  StatPill,
  palette,
  uiStyles,
} from "../components/PremiumUI";

export default function DailyTrainingScreen({ showBack = true }) {
  const [training, setTraining] = useState(null);
  const [completionReport, setCompletionReport] = useState(null);
  const [postTrainingReport, setPostTrainingReport] = useState(null);
  const [progression, setProgression] = useState(null);
  const [coachQuestion, setCoachQuestion] = useState("");
  const [coachAnswer, setCoachAnswer] = useState(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
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
  const patterns = training?.detected_patterns || [];
  const skillProfile = training?.skill_profile;

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

  const completeTraining = async () => {
    try {
      setCompleting(true);
      const response = await api.post("/daily-training/complete");
      setCompletionReport(response.data.completion_report);
      setPostTrainingReport(response.data.post_training_report);
      setProgression(response.data.progression);
      setTraining((current) => ({
        ...current,
        study_schedule: {
          ...current.study_schedule,
          ...response.data.study_schedule,
        },
      }));
    } catch (error) {
      Alert.alert(
        "Training complete",
        error.response?.data?.detail || "Could not complete this training session"
      );
    } finally {
      setCompleting(false);
    }
  };

  const askDailyCoach = async () => {
    const question = coachQuestion.trim();

    if (!question) {
      Alert.alert("Ask Coach", "Enter a question about today's training first.");
      return;
    }

    try {
      setCoachLoading(true);
      const response = await api.post("/daily-training/ask", { question });
      setCoachAnswer(response.data?.answer || "");
    } catch (error) {
      Alert.alert(
        "Coach unavailable",
        error.response?.data?.detail || "Could not answer this training question"
      );
    } finally {
      setCoachLoading(false);
    }
  };

  return (
    <AppShell
      showBack={showBack}
      eyebrow="Daily Training"
      title="Today's training."
      subtitle="Your session uses only your saved schedule, due reviews, puzzles, and weaknesses."
    >
      {loading ? (
        <LoadingState />
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
              <Text style={styles.panelLabel}>
                {schedule.generated_today ? "Generated Today" : "Today's Focus"}
              </Text>
              <Text style={styles.startTitle}>{schedule.focus_area}</Text>
              <Text style={styles.startText}>{schedule.activity}</Text>
              {skillProfile ? (
                <View style={styles.adaptationBox}>
                  <Text style={styles.adaptationLabel}>Adaptive difficulty</Text>
                  <Text style={styles.adaptationText}>
                    {skillProfile.detected_level} | {skillProfile.adaptation.puzzle_difficulty}
                  </Text>
                </View>
              ) : null}
              <PrimaryButton title="Begin session" icon="play" tone="light" onPress={() => router.push("/mistake-replay")} />
              <PrimaryButton
                title={completing ? "Scoring..." : schedule.completed ? "Training complete" : "Finish and score"}
                icon="check-decagram"
                tone="light"
                disabled={completing}
                onPress={completeTraining}
              />
            </PremiumPanel>
          ) : (
            <EmptyState
              icon="calendar-blank"
              title="No study schedule today"
              body="Create or import training data to generate real daily work."
            />
          )}

          <PremiumPanel style={styles.askCoachPanel}>
            <Text style={styles.askCoachTitle}>Ask Coach</Text>
            <TextInput
              style={[uiStyles.input, styles.askCoachInput]}
              placeholder="Ask about today's focus, schedule, or what to do first..."
              placeholderTextColor={palette.muted}
              multiline
              textAlignVertical="top"
              value={coachQuestion}
              onChangeText={setCoachQuestion}
            />
            <PrimaryButton
              title={coachLoading ? "Thinking..." : "Ask about today's training"}
              icon="chat-question"
              onPress={askDailyCoach}
              disabled={coachLoading}
            />
            {coachAnswer ? (
              <View style={styles.coachAnswerPanel}>
                <Text style={styles.coachAnswerLabel}>Coach answer</Text>
                <Text style={styles.coachAnswerText}>{coachAnswer}</Text>
              </View>
            ) : null}
          </PremiumPanel>

          {completionReport ? (
            <PremiumPanel style={styles.completionPanel}>
              <Text style={styles.completionTitle}>{completionReport.title}</Text>
              <View style={styles.completionDivider} />
              <Text style={styles.accuracyText}>Accuracy: {completionReport.accuracy}%</Text>
              <View style={styles.scoreRows}>
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreLabel}>Tactics</Text>
                  <Text style={styles.scoreValue}>{completionReport.categories.tactics.label}</Text>
                </View>
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreLabel}>Openings</Text>
                  <Text style={styles.scoreValue}>{completionReport.categories.openings.label}</Text>
                </View>
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreLabel}>Endgames</Text>
                  <Text
                    style={[
                      styles.scoreValue,
                      completionReport.categories.endgames.label === "Weak" && styles.weakScore,
                    ]}
                  >
                    {completionReport.categories.endgames.label}
                  </Text>
                </View>
              </View>
              <Text style={styles.nextFocus}>Next focus: {completionReport.next_focus}</Text>
              {progression ? (
                <View style={styles.xpAward}>
                  <Text style={styles.xpText}>+{progression.xp_awarded} XP</Text>
                  <Text style={styles.xpSubText}>
                    Level {progression.level} | {progression.xp_to_next_level} XP to next level
                  </Text>
                  {progression.leveled_up ? <Text style={styles.levelUpText}>Level up!</Text> : null}
                </View>
              ) : null}
            </PremiumPanel>
          ) : null}

          {postTrainingReport ? (
            <PremiumPanel dark style={styles.coachReportPanel}>
              <View style={styles.reportTopLine}>
                <Text style={styles.reportTitle}>{postTrainingReport.headline}</Text>
                <Text style={styles.reportSource}>
                  {postTrainingReport.source === "openai" ? "OpenAI" : "Coach"}
                </Text>
              </View>
              <Text style={styles.reportBody}>{postTrainingReport.body}</Text>
              <Text style={styles.reportFocusTitle}>Recommended focus</Text>
              {postTrainingReport.recommended_focus.map((item) => (
                <View key={item} style={styles.focusRow}>
                  <Text style={styles.focusCheck}>✓</Text>
                  <Text style={styles.focusText}>{item}</Text>
                </View>
              ))}
              {postTrainingReport.coach_note ? (
                <Text style={styles.coachNote}>{postTrainingReport.coach_note}</Text>
              ) : null}
            </PremiumPanel>
          ) : null}

          {patterns.length > 0 ? (
            <>
              <SectionHeader label="AI Noticed" />
              {patterns.map((pattern) => (
                <PremiumPanel key={pattern.key} style={styles.patternCard}>
                  <View style={styles.patternTopLine}>
                    <Text style={styles.patternTitle}>{pattern.label}</Text>
                    <Text style={styles.patternScore}>{pattern.score}</Text>
                  </View>
                  <Text style={styles.patternText}>{pattern.description}</Text>
                </PremiumPanel>
              ))}
            </>
          ) : null}

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
  panelLabel: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
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
  adaptationBox: {
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 11,
  },
  adaptationLabel: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  adaptationText: {
    color: palette.mutedDark,
    fontSize: 13,
    lineHeight: 18,
  },
  askCoachPanel: {
    gap: 10,
    marginBottom: 18,
  },
  askCoachTitle: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  askCoachInput: {
    minHeight: 88,
    paddingTop: 12,
  },
  coachAnswerPanel: {
    backgroundColor: "rgba(215, 179, 90, 0.13)",
    borderColor: "rgba(215, 179, 90, 0.35)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    padding: 10,
  },
  coachAnswerLabel: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  coachAnswerText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  completionPanel: {
    gap: 12,
    marginBottom: 18,
  },
  completionTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "900",
  },
  completionDivider: {
    backgroundColor: palette.line,
    height: 1,
  },
  accuracyText: {
    color: palette.gold,
    fontSize: 24,
    fontWeight: "900",
  },
  scoreRows: {
    gap: 9,
  },
  scoreRow: {
    alignItems: "center",
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
  },
  scoreLabel: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: "900",
  },
  scoreValue: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  weakScore: {
    color: palette.danger,
  },
  nextFocus: {
    color: palette.mutedDark,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  xpAward: {
    backgroundColor: "#243A2D",
    borderColor: palette.sage,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  coachReportPanel: {
    gap: 11,
    marginBottom: 18,
  },
  reportTopLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  reportTitle: {
    color: palette.ink,
    flex: 1,
    fontSize: 21,
    fontWeight: "900",
  },
  reportSource: {
    backgroundColor: "#3A3219",
    borderColor: palette.gold,
    borderRadius: 8,
    borderWidth: 1,
    color: palette.goldSoft,
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 5,
    textTransform: "uppercase",
  },
  reportBody: {
    color: palette.mutedDark,
    fontSize: 15,
    lineHeight: 22,
  },
  reportFocusTitle: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  focusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
  },
  focusCheck: {
    color: palette.goldSoft,
    fontSize: 16,
    fontWeight: "900",
  },
  focusText: {
    color: palette.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  coachNote: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  xpText: {
    color: palette.goldSoft,
    fontSize: 20,
    fontWeight: "900",
  },
  xpSubText: {
    color: palette.mutedDark,
    fontSize: 13,
    fontWeight: "800",
  },
  levelUpText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  patternCard: {
    gap: 8,
    marginBottom: 11,
  },
  patternTopLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  patternTitle: {
    color: palette.ink,
    flex: 1,
    fontSize: 17,
    fontWeight: "900",
  },
  patternScore: {
    backgroundColor: "#3A3219",
    borderColor: palette.gold,
    borderRadius: 8,
    borderWidth: 1,
    color: palette.goldSoft,
    fontSize: 12,
    fontWeight: "900",
    minWidth: 38,
    paddingHorizontal: 9,
    paddingVertical: 5,
    textAlign: "center",
  },
  patternText: {
    color: palette.muted,
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
