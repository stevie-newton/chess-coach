import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../api/client";
import {
  AppShell,
  EmptyState,
  PremiumPanel,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatPill,
  palette,
  uiStyles,
} from "../components/PremiumUI";

const features = [
  ["ask", "Ask Coach", "chat-question", "Ask anything about your games or training."],
  ["game-summary", "Game Summary", "file-chart", "Summarize one analyzed game."],
  ["explain-mistake", "Explain Mistake", "alert-decagram", "Explain why a move was bad and what was better."],
  ["weekly-plan", "Weekly Plan", "calendar-week", "Find your biggest weakness and plan the week."],
  ["tournament-advice", "Tournament Advice", "trophy", "Prepare for an event or time control."],
];

export default function CoachScreen({ showBack = true }) {
  const [feedback, setFeedback] = useState(null);
  const [activeFeature, setActiveFeature] = useState("ask");
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [coachLoading, setCoachLoading] = useState(false);
  const [form, setForm] = useState({
    question: "",
    gameId: "",
    moveAnalysisId: "",
    minutes: "30",
    eventName: "",
    timeControl: "",
    goal: "",
  });

  useEffect(() => {
    async function loadFeedback() {
      try {
        const response = await api.get("/coach/feedback");
        setFeedback(response.data);
      } catch (error) {
        console.log(error.response?.data || error.message);
      } finally {
        setLoading(false);
      }
    }

    loadFeedback();
  }, []);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const runCoachFeature = async () => {
    try {
      setCoachLoading(true);
      setAnswer(null);

      let endpoint = "/coach/ask";
      let payload = {};

      if (activeFeature === "ask") {
        if (!form.question.trim()) {
          Alert.alert("Ask Coach", "Enter a question first.");
          return;
        }

        endpoint = "/coach/ask";
        payload = {
          question: form.question.trim(),
          game_id: form.gameId ? Number(form.gameId) : null,
          move_analysis_id: form.moveAnalysisId ? Number(form.moveAnalysisId) : null,
        };
      }

      if (activeFeature === "game-summary") {
        if (!form.gameId) {
          Alert.alert("Game Summary", "Enter a game id first.");
          return;
        }

        endpoint = "/coach/game-summary";
        payload = { game_id: Number(form.gameId) };
      }

      if (activeFeature === "explain-mistake") {
        if (!form.moveAnalysisId) {
          Alert.alert("Explain Mistake", "Enter a move analysis id first.");
          return;
        }

        endpoint = "/coach/explain-mistake";
        payload = { move_analysis_id: Number(form.moveAnalysisId) };
      }

      if (activeFeature === "weekly-plan") {
        endpoint = "/coach/weekly-plan";
        payload = { focus_minutes_per_day: Number(form.minutes) || 30 };
      }

      if (activeFeature === "tournament-advice") {
        endpoint = "/coach/tournament-advice";
        payload = {
          event_name: form.eventName.trim() || null,
          time_control: form.timeControl.trim() || null,
          goal: form.goal.trim() || null,
        };
      }

      const response = await api.post(endpoint, payload);
      setAnswer(response.data);
    } catch (error) {
      Alert.alert(
        "Coach unavailable",
        error.response?.data?.detail || "Could not get coach response"
      );
    } finally {
      setCoachLoading(false);
    }
  };

  const selectedFeature = features.find(([key]) => key === activeFeature);

  return (
    <AppShell
      showBack={showBack}
      eyebrow="AI Coach"
      title="OpenAI coach."
      subtitle="Ask questions, summarize games, explain mistakes, plan training, and prepare for tournaments."
    >
      {loading ? (
        <PremiumPanel style={styles.loadingPanel}>
          <ActivityIndicator size="large" color={palette.gold} />
        </PremiumPanel>
      ) : feedback ? (
        <View style={styles.statsRow}>
          <StatPill icon="chart-line" value={`${feedback.average_accuracy}%`} label="accuracy" tone="gold" />
          <StatPill icon="alert-octagon" value={feedback.total_blunders} label="blunders" tone="wine" />
          <StatPill icon="puzzle" value={`${feedback.puzzle_success_rate}%`} label="puzzles" />
        </View>
      ) : null}

      <SectionHeader label="Coach Tools" />
      <View style={styles.featureGrid}>
        {features.map(([key, label, icon, description]) => (
          <SecondaryButton
            key={key}
            title={label}
            icon={icon}
            style={styles.featureButton}
            onPress={() => {
              setActiveFeature(key);
              setAnswer(null);
            }}
          />
        ))}
      </View>

      <PremiumPanel dark style={styles.toolPanel}>
        <Text style={styles.toolTitle}>{selectedFeature?.[1]}</Text>
        <Text style={styles.toolText}>{selectedFeature?.[3]}</Text>

        {activeFeature === "ask" ? (
          <TextInput
            style={[uiStyles.input, styles.textArea]}
            placeholder="Ask about your games, openings, mistakes, or training..."
            placeholderTextColor={palette.muted}
            multiline
            textAlignVertical="top"
            value={form.question}
            onChangeText={(value) => updateField("question", value)}
          />
        ) : null}

        {["ask", "game-summary"].includes(activeFeature) ? (
          <TextInput
            style={uiStyles.input}
            placeholder="Game id"
            placeholderTextColor={palette.muted}
            keyboardType="numeric"
            value={form.gameId}
            onChangeText={(value) => updateField("gameId", value)}
          />
        ) : null}

        {["ask", "explain-mistake"].includes(activeFeature) ? (
          <TextInput
            style={uiStyles.input}
            placeholder="Move analysis id"
            placeholderTextColor={palette.muted}
            keyboardType="numeric"
            value={form.moveAnalysisId}
            onChangeText={(value) => updateField("moveAnalysisId", value)}
          />
        ) : null}

        {activeFeature === "weekly-plan" ? (
          <TextInput
            style={uiStyles.input}
            placeholder="Minutes per day"
            placeholderTextColor={palette.muted}
            keyboardType="numeric"
            value={form.minutes}
            onChangeText={(value) => updateField("minutes", value)}
          />
        ) : null}

        {activeFeature === "tournament-advice" ? (
          <>
            <TextInput
              style={uiStyles.input}
              placeholder="Event name"
              placeholderTextColor={palette.muted}
              value={form.eventName}
              onChangeText={(value) => updateField("eventName", value)}
            />
            <TextInput
              style={uiStyles.input}
              placeholder="Time control"
              placeholderTextColor={palette.muted}
              value={form.timeControl}
              onChangeText={(value) => updateField("timeControl", value)}
            />
            <TextInput
              style={[uiStyles.input, styles.textAreaSmall]}
              placeholder="Goal for the event"
              placeholderTextColor={palette.muted}
              multiline
              textAlignVertical="top"
              value={form.goal}
              onChangeText={(value) => updateField("goal", value)}
            />
          </>
        ) : null}

        <PrimaryButton
          title={coachLoading ? "Thinking..." : "Ask OpenAI Coach"}
          icon="creation"
          disabled={coachLoading}
          onPress={runCoachFeature}
        />
      </PremiumPanel>

      {answer ? (
        <>
          <SectionHeader label={answer.feature} />
          <PremiumPanel style={styles.answerPanel}>
            <Text style={styles.answerText}>{answer.answer}</Text>
          </PremiumPanel>
        </>
      ) : (
        <EmptyState
          icon="account-tie-voice"
          title="Choose a coach tool"
          body="Use analyzed games and mistakes for the richest coach responses."
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
    marginBottom: 16,
  },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  featureButton: {
    flexGrow: 1,
    minWidth: 150,
  },
  toolPanel: {
    gap: 12,
    marginBottom: 16,
  },
  toolTitle: {
    color: palette.goldSoft,
    fontSize: 20,
    fontWeight: "900",
  },
  toolText: {
    color: palette.mutedDark,
    fontSize: 14,
    lineHeight: 20,
  },
  textArea: {
    minHeight: 112,
    paddingTop: 14,
  },
  textAreaSmall: {
    minHeight: 84,
    paddingTop: 14,
  },
  answerPanel: {
    marginBottom: 10,
  },
  answerText: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 23,
  },
});
