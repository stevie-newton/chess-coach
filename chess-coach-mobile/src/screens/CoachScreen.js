import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../api/client";
import {
  AppShell,
  EmptyState,
  FeatureRow,
  LoadingState,
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
  const [recentGames, setRecentGames] = useState([]);
  const [gameMistakes, setGameMistakes] = useState([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);
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
    async function loadCoachData() {
      try {
        const [feedbackResponse, gamesResponse] = await Promise.all([
          api.get("/coach/feedback"),
          api.get("/games/"),
        ]);
        setFeedback(feedbackResponse.data);
        setRecentGames((gamesResponse.data || []).slice(0, 5));
      } catch (error) {
        console.log(error.response?.data || error.message);
      } finally {
        setLoading(false);
      }
    }

    loadCoachData();
  }, []);

  const updateField = (field, value) => {
    setAnswer(null);
    setForm((current) => ({ ...current, [field]: value }));
  };

  const selectGame = async (game) => {
    setAnswer(null);
    setGameMistakes([]);
    setForm((current) => ({
      ...current,
      gameId: String(game.id),
      moveAnalysisId: "",
    }));

    try {
      setAnalysisLoading(true);
      const response = await api.get(`/analysis/${game.id}`);
      const mistakes = (response.data?.moves || []).filter((move) =>
        ["inaccuracy", "mistake", "blunder"].includes(move.mistake_type)
      );
      setGameMistakes(mistakes.slice(0, 8));
    } catch (error) {
      console.log(error.response?.data || error.message);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const selectMistake = (move) => {
    setAnswer(null);
    setForm((current) => ({
      ...current,
      moveAnalysisId: String(move.id),
    }));
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
          Alert.alert("Game Summary", "Select a recent game first.");
          return;
        }

        endpoint = "/coach/game-summary";
        payload = { game_id: Number(form.gameId) };
      }

      if (activeFeature === "explain-mistake") {
        if (!form.moveAnalysisId) {
          Alert.alert("Explain Mistake", "Select a mistake from an analyzed game first.");
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
  const selectedGame = recentGames.find((game) => String(game.id) === form.gameId);
  const selectedMistake = gameMistakes.find((move) => String(move.id) === form.moveAnalysisId);
  const needsGameContext = ["ask", "game-summary", "explain-mistake"].includes(activeFeature);
  const needsMistakeContext = ["ask", "explain-mistake"].includes(activeFeature);

  return (
    <AppShell
      showBack={showBack}
      eyebrow="Coach"
      title="Coach."
      subtitle="Ask questions, summarize games, explain mistakes, plan training, and prepare for tournaments."
    >
      {loading ? (
        <LoadingState />
      ) : feedback ? (
        <>
          <View style={styles.statsRow}>
            <StatPill icon="school" value={feedback.skill_profile?.detected_level || "Unknown"} label="skill" tone="gold" />
            <StatPill icon="chart-line" value={`${feedback.average_accuracy}%`} label="accuracy" />
            <StatPill icon="alert-octagon" value={feedback.total_blunders} label="blunders" tone="wine" />
          </View>

          {feedback.skill_profile ? (
            <PremiumPanel style={styles.skillPanel}>
              <View style={styles.skillTopLine}>
                <Text style={styles.skillTitle}>Adaptive coaching</Text>
                <Text style={styles.confidenceBadge}>{feedback.skill_profile.confidence}</Text>
              </View>
              <Text style={styles.skillText}>
                {feedback.skill_profile.adaptation.coaching_language}
              </Text>
              <View style={styles.adaptationRow}>
                <Text style={styles.adaptationText}>
                  {feedback.skill_profile.adaptation.puzzle_difficulty}
                </Text>
                <Text style={styles.engineDepth}>
                  Depth {feedback.skill_profile.adaptation.engine_depth}
                </Text>
              </View>
            </PremiumPanel>
          ) : null}
        </>
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

        {needsGameContext ? (
          <View style={styles.contextBlock}>
            <Text style={styles.contextLabel}>
              {selectedGame ? `Game context: ${selectedGame.opponent || "Unknown opponent"}` : "Choose a game context"}
            </Text>
            {recentGames.length > 0 ? (
              recentGames.map((game) => (
                <FeatureRow
                  key={game.id}
                  title={game.opponent || "Unknown opponent"}
                  subtitle={`${game.result || "No result"} | ${game.color_played || "Color unknown"} | ${game.time_control || "Time control unknown"}`}
                  icon={String(game.id) === form.gameId ? "check-circle" : "chess-pawn"}
                  meta={`#${game.id}`}
                  accent={String(game.id) === form.gameId ? palette.gold : palette.sage}
                  onPress={() => selectGame(game)}
                />
              ))
            ) : (
              <Text style={styles.contextText}>Import or record a game to unlock game-aware coaching.</Text>
            )}
          </View>
        ) : null}

        {needsMistakeContext && form.gameId ? (
          <View style={styles.contextBlock}>
            <Text style={styles.contextLabel}>
              {selectedMistake
                ? `Mistake context: move ${selectedMistake.move_number}`
                : analysisLoading
                  ? "Loading analyzed mistakes..."
                  : "Choose a mistake context"}
            </Text>
            {gameMistakes.length > 0 ? (
              gameMistakes.map((move) => (
                <FeatureRow
                  key={move.id}
                  title={`Move ${move.move_number}: ${move.mistake_type}`}
                  subtitle={`Played ${move.played_move || move.played_move_uci || "unknown"} instead of ${move.best_move_san || move.best_move || "the engine move"}`}
                  icon={String(move.id) === form.moveAnalysisId ? "check-circle" : "alert-decagram"}
                  meta={`#${move.id}`}
                  accent={move.mistake_type === "blunder" ? palette.wine : palette.gold}
                  onPress={() => selectMistake(move)}
                />
              ))
            ) : (
              <Text style={styles.contextText}>
                {analysisLoading
                  ? "Checking this game's analysis."
                  : "Analyze this game first to choose a specific mistake."}
              </Text>
            )}
          </View>
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
          title={coachLoading ? "Thinking..." : "Ask Coach"}
          icon="creation"
          disabled={coachLoading}
          onPress={runCoachFeature}
        />

        {answer ? (
          <View style={styles.answerPanel}>
            <Text style={styles.answerLabel}>{answer.feature}</Text>
            <Text style={styles.answerText}>{answer.answer}</Text>
          </View>
        ) : null}
      </PremiumPanel>

      {!answer ? (
        <EmptyState
          icon="account-tie-voice"
          title="Choose a coach tool"
          body="Use analyzed games and mistakes for the richest coach responses."
        />
      ) : null}
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
  skillPanel: {
    gap: 10,
    marginBottom: 16,
  },
  skillTopLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  skillTitle: {
    color: palette.ink,
    flex: 1,
    fontSize: 18,
    fontWeight: "900",
  },
  skillText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  confidenceBadge: {
    backgroundColor: "#3A3219",
    borderColor: palette.gold,
    borderRadius: 8,
    borderWidth: 1,
    color: palette.goldSoft,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
    textTransform: "uppercase",
  },
  adaptationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  adaptationText: {
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    color: palette.mutedDark,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    minWidth: 190,
    padding: 10,
  },
  engineDepth: {
    backgroundColor: "#243A2D",
    borderRadius: 8,
    color: palette.ink,
    fontSize: 13,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 10,
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
  contextBlock: {
    gap: 8,
  },
  contextLabel: {
    color: palette.goldSoft,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18,
  },
  contextText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
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
    backgroundColor: "rgba(215, 179, 90, 0.13)",
    borderColor: "rgba(215, 179, 90, 0.35)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  answerLabel: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  answerText: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 23,
  },
});
