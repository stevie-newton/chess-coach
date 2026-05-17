import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { Chess } from "chess.js";
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

function sideToMove(fen) {
  try {
    const chess = new Chess(fen);
    return chess.turn() === "w" ? "white" : "black";
  } catch {
    return null;
  }
}

export default function OpeningPractice() {
  const [opening, setOpening] = useState(null);
  const [lines, setLines] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [attempt, setAttempt] = useState(null);
  const [progress, setProgress] = useState(null);
  const [theoryMoves, setTheoryMoves] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProgress = async (openingId) => {
    const progressResponse = await api.get(`/openings/${openingId}/progress`);
    setProgress(progressResponse.data);
  };

  const advanceToUserTurn = (openingData, lineList, startIndex, extraTheoryMoves = []) => {
    const userColor = openingData?.color?.toLowerCase();
    const nextTheoryMoves = [...extraTheoryMoves];
    let nextIndex = startIndex;

    while (nextIndex < lineList.length && sideToMove(lineList[nextIndex].fen) !== userColor) {
      nextTheoryMoves.push(lineList[nextIndex]);
      nextIndex += 1;
    }

    setTheoryMoves(nextTheoryMoves);
    setCurrentIndex(Math.min(nextIndex, lineList.length));
    setIsComplete(nextIndex >= lineList.length);
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

        const sessionResponse = await api.get(`/openings/${firstOpening.id}/practice/session`);
        const sessionLines = sessionResponse.data.lines || [];
        setLines(sessionLines);
        setProgress(sessionResponse.data.progress);
        advanceToUserTurn(firstOpening, sessionLines, 0);
      } catch (error) {
        console.log(error.response?.data || error.message);
      } finally {
        setLoading(false);
      }
    }

    loadPracticeLine();
  }, []);

  const submitAttempt = async (userMove) => {
    const line = lines[currentIndex];

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

      if (response.data.is_correct) {
        const nextTheoryMoves = response.data.theory_response
          ? [...theoryMoves, response.data.theory_response]
          : theoryMoves;
        advanceToUserTurn(opening, lines, currentIndex + 1, nextTheoryMoves);
      }
    } catch (error) {
      Alert.alert(
        "Attempt failed",
        error.response?.data?.detail || "Could not save this opening practice attempt"
      );
    }
  };

  const line = lines[currentIndex];

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
      ) : isComplete ? (
        <PremiumPanel dark style={styles.completePanel}>
          <Text style={styles.modelLabel}>Line Complete</Text>
          <Text style={styles.completeTitle}>You reached the end of this opening line.</Text>
          <Text style={styles.attemptText}>
            The coach followed the stored theory tree and stopped after the final prepared move.
          </Text>
        </PremiumPanel>
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
            <StatPill icon="chess-board" value={`${currentIndex + 1}/${lines.length}`} label="tree step" tone="wine" />
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

          {theoryMoves.length > 0 ? (
            <>
              <SectionHeader label="AI Theory Replies" />
              <PremiumPanel style={styles.theoryPanel}>
                {theoryMoves.slice(-4).map((theoryLine) => (
                  <View key={`${theoryLine.id}-${theoryLine.move_order}`} style={styles.theoryRow}>
                    <View style={styles.theoryCopy}>
                      <Text style={styles.theoryTitle}>Move {theoryLine.move_order}</Text>
                      <Text style={styles.theoryText}>
                        {theoryLine.explanation || "The coach follows the saved theory move for this branch."}
                      </Text>
                    </View>
                    <Text style={styles.theoryMove}>{theoryLine.best_move}</Text>
                  </View>
                ))}
              </PremiumPanel>
            </>
          ) : null}

          <SectionHeader label="Quiz" />
          <OpeningBoard
            key={line.id}
            fen={line.fen}
            bestMove={line.best_move}
            explanation={line.explanation}
            question="Play the expected move from your repertoire."
            submitTitle="Submit quiz move"
            hideBestMoveUntilSubmitted
            onSubmitMove={submitAttempt}
          />

          {attempt ? (
            <PremiumPanel dark style={styles.attemptPanel}>
              <Text style={styles.modelLabel}>OpeningPracticeAttempt</Text>
              <Text style={attempt.is_correct ? styles.correctText : styles.incorrectText}>
                {attempt.message || (attempt.is_correct ? "Correct" : "Incorrect")}
              </Text>
              <Text style={styles.attemptText}>{attempt.feedback}</Text>
              {attempt.theory_response ? (
                <Text style={styles.attemptText}>
                  AI responds with theory: {attempt.theory_response.best_move}
                </Text>
              ) : null}
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
  completePanel: {
    gap: 10,
  },
  completeTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 27,
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
  theoryPanel: {
    gap: 10,
    marginBottom: 16,
  },
  theoryRow: {
    alignItems: "center",
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingBottom: 10,
  },
  theoryCopy: {
    flex: 1,
    gap: 3,
  },
  theoryTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  theoryText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  theoryMove: {
    backgroundColor: "#243A2D",
    borderRadius: 8,
    color: palette.ink,
    fontSize: 15,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});
