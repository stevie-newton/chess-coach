import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { api } from "../src/api/client";
import OpeningBoard from "../src/components/OpeningBoard";
import {
  AppShell,
  EmptyState,
  PremiumPanel,
  SectionHeader,
  StatPill,
  palette,
} from "../src/components/PremiumUI";

export default function OpeningPractice() {
  const [opening, setOpening] = useState(null);
  const [line, setLine] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProgress = async (openingId) => {
    const progressResponse = await api.get(`/openings/${openingId}/progress`);
    setProgress(progressResponse.data);
  };

  useEffect(() => {
    async function loadPracticeLine() {
      try {
        const openingsResponse = await api.get("/openings/");
        const firstOpening = openingsResponse.data?.[0];

        if (!firstOpening) {
          return;
        }

        setOpening(firstOpening);

        const lineResponse = await api.get(`/openings/${firstOpening.id}/practice/next`);
        setLine(lineResponse.data);
        await loadProgress(firstOpening.id);
      } catch (error) {
        console.log(error.response?.data || error.message);
      } finally {
        setLoading(false);
      }
    }

    loadPracticeLine();
  }, []);

  const submitAttempt = async (userMove) => {
    if (!opening || !line) {
      return;
    }

    try {
      const response = await api.post(`/openings/${opening.id}/lines/${line.id}/attempt`, {
        user_move: userMove,
        time_taken_seconds: null,
      });

      setAttempt(response.data);
      await loadProgress(opening.id);
    } catch (error) {
      Alert.alert(
        "Attempt failed",
        error.response?.data?.detail || "Could not save this opening practice attempt"
      );
    }
  };

  return (
    <AppShell
      showBack
      eyebrow="Opening Practice"
      title="Opening quiz mode."
      subtitle="Answer from memory: what is the best move in this opening position?"
    >
      {loading ? (
        <PremiumPanel style={styles.loadingPanel}>
          <ActivityIndicator size="large" color={palette.gold} />
        </PremiumPanel>
      ) : !opening ? (
        <EmptyState
          icon="bookshelf"
          title="No repertoire yet"
          body="Create an opening repertoire and add lines before starting quiz mode."
        />
      ) : !line ? (
        <EmptyState
          icon="source-branch"
          title="No opening lines yet"
          body="Add positions and best moves to this repertoire before practicing."
        />
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatPill icon="bookshelf" value={opening.name} label="repertoire" tone="gold" />
            <StatPill icon="source-branch" value={line.variation_name || "Line"} label="variation" tone="sage" />
          </View>

          {progress ? (
            <PremiumPanel dark style={styles.progressPanel}>
              <Text style={styles.modelLabel}>Opening Progress Tracking</Text>
              <Text style={styles.progressTitle}>{progress.summary}</Text>
              {progress.focus ? <Text style={styles.progressFocus}>{progress.focus}</Text> : null}
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(100, progress.known_percent)}%` }]} />
              </View>
              <View style={styles.progressStats}>
                <Text style={styles.attemptText}>
                  Mastered: {progress.mastered_lines}/{progress.total_lines} lines
                </Text>
                <Text style={styles.attemptText}>
                  Attempts: {progress.correct_attempts}/{progress.total_attempts} correct
                </Text>
              </View>
            </PremiumPanel>
          ) : null}

          <SectionHeader label="Quiz" />
          <OpeningBoard
            fen={line.fen}
            bestMove={line.best_move}
            explanation={line.explanation}
            question="What is the best move in this opening position?"
            submitTitle="Submit quiz move"
            hideBestMoveUntilSubmitted
            onSubmitMove={submitAttempt}
          />

          {attempt ? (
            <PremiumPanel dark style={styles.attemptPanel}>
              <Text style={styles.modelLabel}>OpeningPracticeAttempt</Text>
              <Text style={attempt.is_correct ? styles.correctText : styles.incorrectText}>
                {attempt.is_correct ? "Correct" : "Incorrect"}
              </Text>
              <Text style={styles.attemptText}>Saved move: {attempt.user_move}</Text>
              <Text style={styles.attemptText}>Attempt id: {attempt.id}</Text>
            </PremiumPanel>
          ) : null}
        </>
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
  attemptPanel: {
    gap: 7,
  },
  progressPanel: {
    gap: 10,
    marginBottom: 16,
  },
  modelLabel: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  correctText: {
    color: "#1E8E54",
    fontSize: 20,
    fontWeight: "900",
  },
  incorrectText: {
    color: palette.danger,
    fontSize: 20,
    fontWeight: "900",
  },
  attemptText: {
    color: palette.mutedDark,
    fontSize: 14,
    fontWeight: "700",
  },
  progressTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "900",
  },
  progressFocus: {
    color: palette.goldSoft,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
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
    backgroundColor: palette.sage,
    borderRadius: 8,
    height: "100%",
  },
  progressStats: {
    gap: 5,
  },
});
