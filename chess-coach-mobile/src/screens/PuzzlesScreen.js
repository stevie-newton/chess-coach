import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import ChessboardWithArrows from "../components/ChessboardWithArrows";
import {
  AppShell,
  EmptyState,
  PremiumPanel,
  PrimaryButton,
  SectionHeader,
  SecondaryButton,
  StatPill,
  palette,
} from "../components/PremiumUI";

const SOLUTION_REVEAL_FAILS = 3;

export default function PuzzlesScreen({ showBack = true }) {
  const [puzzles, setPuzzles] = useState([]);
  const [moves, setMoves] = useState({});
  const [feedbackByPuzzle, setFeedbackByPuzzle] = useState({});
  const [hintsByPuzzle, setHintsByPuzzle] = useState({});
  const [failedAttemptsByPuzzle, setFailedAttemptsByPuzzle] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(null);

  const moveToSquares = (move) => {
    const normalized = move?.trim().toLowerCase();
    if (!normalized || normalized.length < 4) {
      return null;
    }

    return {
      from: normalized.slice(0, 2),
      to: normalized.slice(2, 4),
    };
  };

  const getSideToMove = (fen) => {
    const activeColor = fen?.trim().split(/\s+/)[1];

    if (activeColor === "w") {
      return "White";
    }

    if (activeColor === "b") {
      return "Black";
    }

    return "Unknown";
  };

  const buildSolvedMoveFeedback = (puzzle) => {
    const feedback = feedbackByPuzzle[puzzle.id];
    const submittedMove = feedback?.is_correct ? feedback.user_move : moves[puzzle.id];
    const moveSquares = moveToSquares(submittedMove);
    const solutionSquares = moveToSquares(puzzle.solution);
    const isSolved = feedback?.is_correct;
    const isIllegal = feedback && feedback.is_legal === false;
    const isIncorrect = feedback && !feedback.is_correct && feedback.user_move && !isIllegal;
    const shouldRevealSolution = failedAttemptsByPuzzle[puzzle.id] >= SOLUTION_REVEAL_FAILS;
    const arrows = [];
    const highlights = [];

    if (moveSquares) {
      arrows.push({
        ...moveSquares,
        id: `puzzle-${puzzle.id}-${isSolved ? "correct" : isIncorrect ? "mistake" : "pending"}`,
        color: isSolved
          ? "rgba(30, 142, 84, 0.82)"
          : isIllegal
            ? "rgba(201, 90, 106, 0.5)"
          : isIncorrect
            ? "rgba(201, 90, 106, 0.78)"
            : "rgba(215, 179, 90, 0.72)",
      });

      highlights.push(
        {
          square: moveSquares.from,
          color: isSolved
            ? "rgba(30, 142, 84, 0.26)"
            : isIllegal
              ? "rgba(201, 90, 106, 0.16)"
            : isIncorrect
              ? "rgba(201, 90, 106, 0.24)"
              : "rgba(215, 179, 90, 0.22)",
          borderColor: isSolved
            ? "rgba(30, 142, 84, 0.86)"
            : isIllegal
              ? "rgba(201, 90, 106, 0.62)"
            : isIncorrect
              ? "rgba(201, 90, 106, 0.84)"
              : "rgba(215, 179, 90, 0.78)",
        },
        {
          square: moveSquares.to,
          color: isSolved
            ? "rgba(30, 142, 84, 0.32)"
            : isIllegal
              ? "rgba(201, 90, 106, 0.18)"
            : isIncorrect
              ? "rgba(201, 90, 106, 0.3)"
              : "rgba(215, 179, 90, 0.28)",
          borderColor: isSolved
            ? "rgba(30, 142, 84, 0.95)"
            : isIllegal
              ? "rgba(201, 90, 106, 0.66)"
            : isIncorrect
              ? "rgba(201, 90, 106, 0.92)"
              : "rgba(215, 179, 90, 0.88)",
        }
      );
    }

    if (shouldRevealSolution && solutionSquares && !isSolved) {
      arrows.push({
        ...solutionSquares,
        id: `puzzle-${puzzle.id}-solution`,
        color: "rgba(30, 142, 84, 0.88)",
      });

      highlights.push(
        {
          square: solutionSquares.from,
          color: "rgba(30, 142, 84, 0.2)",
          borderColor: "rgba(30, 142, 84, 0.82)",
        },
        {
          square: solutionSquares.to,
          color: "rgba(30, 142, 84, 0.3)",
          borderColor: "rgba(30, 142, 84, 0.94)",
        }
      );
    }

    return {
      feedback,
      arrows,
      highlights,
      shouldRevealSolution,
    };
  };

  const stageMove = (puzzleId, move) => {
    setMoves((current) => ({ ...current, [puzzleId]: move }));
    setFeedbackByPuzzle((current) => {
      const next = { ...current };
      delete next[puzzleId];
      return next;
    });
  };

  const retryPuzzle = (puzzleId) => {
    setMoves((current) => {
      const next = { ...current };
      delete next[puzzleId];
      return next;
    });
    setFeedbackByPuzzle((current) => {
      const next = { ...current };
      delete next[puzzleId];
      return next;
    });
  };

  const showHint = (puzzle) => {
    const solution = moveToSquares(puzzle.solution);
    const hint = solution
      ? `Look for the tactic starting from ${solution.from}.`
      : "Look for a forcing move that changes the position immediately.";

    setHintsByPuzzle((current) => ({ ...current, [puzzle.id]: hint }));
  };

  useEffect(() => {
    async function loadPuzzles() {
      try {
        const response = await api.get("/puzzles/");
        setPuzzles(response.data || []);
      } catch (error) {
        console.log(error.response?.data || error.message);
      } finally {
        setLoading(false);
      }
    }

    loadPuzzles();
  }, []);

  const submitAttempt = async (puzzle, detectedMove = null) => {
    const userMove = detectedMove || moves[puzzle.id]?.trim();

    if (!userMove) {
      setFeedbackByPuzzle((current) => ({
        ...current,
        [puzzle.id]: {
          is_correct: false,
          message: "Choose a move",
          feedback: "Tap a piece, tap its destination square, then press Submit move.",
        },
      }));
      return;
    }

    try {
      setSubmitting(puzzle.id);
      const response = await api.post(`/puzzles/${puzzle.id}/attempt`, {
        user_move: userMove,
        time_taken_seconds: null,
      });
      const isCorrect = response.data.is_correct;

      setMoves((current) => ({ ...current, [puzzle.id]: userMove }));
      setFailedAttemptsByPuzzle((current) => ({
        ...current,
        [puzzle.id]: isCorrect ? 0 : (current[puzzle.id] || 0) + 1,
      }));
      setFeedbackByPuzzle((current) => ({
        ...current,
        [puzzle.id]: response.data,
      }));
    } catch (error) {
      Alert.alert(
        "Attempt failed",
        error.response?.data?.detail || "Could not submit this puzzle"
      );
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <AppShell
      showBack={showBack}
      eyebrow="Puzzles"
      title="Generated tactics."
      subtitle="Puzzles are created from inaccuracies, mistakes, and blunders in your analyzed games."
    >
      <View style={styles.statsRow}>
        <StatPill icon="puzzle" value={puzzles.length} label="puzzles" tone="gold" />
      </View>

      {loading ? (
        <PremiumPanel style={styles.loadingPanel}>
          <ActivityIndicator size="large" color={palette.gold} />
        </PremiumPanel>
      ) : puzzles.length === 0 ? (
        <EmptyState
          icon="puzzle-outline"
          title="No puzzles yet"
          body="Analyze a game, then tap Generate puzzles from the Games screen."
        />
      ) : (
        <>
          <SectionHeader label="Puzzle Queue" />
          {puzzles.map((puzzle) => {
            const { feedback, arrows, highlights, shouldRevealSolution } = buildSolvedMoveFeedback(puzzle);

            return (
              <PremiumPanel key={puzzle.id} style={styles.puzzleCard}>
                <View style={styles.cardTop}>
                  <Text style={styles.theme}>{puzzle.theme || "Best move training"}</Text>
                  <Text style={styles.difficulty}>{puzzle.difficulty}</Text>
                </View>

                <View style={styles.toMoveRow}>
                  <StatPill
                    icon="chess-king"
                    value={getSideToMove(puzzle.fen)}
                    label="to move"
                    tone="sage"
                  />
                </View>

                {feedback ? (
                  <View style={feedback.is_correct ? styles.correctPanel : styles.incorrectPanel}>
                    <Text style={feedback.is_correct ? styles.correctTitle : styles.incorrectTitle}>
                      {feedback.message}
                    </Text>
                    <Text style={styles.correctBody}>{feedback.feedback}</Text>
                    {feedback.explanation ? (
                      <View style={styles.explanationPanel}>
                        <View style={styles.explanationTopLine}>
                          <Text style={styles.explanationLabel}>Why</Text>
                          {feedback.explanation_source ? (
                            <Text style={styles.explanationSource}>
                              {feedback.explanation_source === "openai" ? "AI" : "Coach"}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.explanation}>{feedback.explanation}</Text>
                      </View>
                    ) : null}
                    {!feedback.is_legal ? (
                      <View style={styles.solutionPanel}>
                        <Text style={styles.solutionLabel}>Position check</Text>
                        <Text style={styles.solutionExplanation}>
                          The move was rejected before engine comparison because it is not legal in this position.
                        </Text>
                      </View>
                    ) : feedback.is_correct ? (
                      <View style={styles.progressRow}>
                        <StatPill icon="chart-line" value={feedback.puzzle_rating} label="rating" tone="sage" />
                        <StatPill icon="fire" value={feedback.puzzle_streak} label="streak" tone="gold" />
                        {feedback.spaced_repetition ? (
                          <StatPill
                            icon="calendar-sync"
                            value={`${feedback.spaced_repetition.interval_days}d`}
                            label="next review"
                            tone="wine"
                          />
                        ) : null}
                      </View>
                    ) : feedback.user_move ? (
                      <>
                        <View style={styles.progressRow}>
                          <StatPill icon="chart-line" value={feedback.puzzle_rating} label="mastery" tone="wine" />
                          <StatPill icon="fire-off" value={feedback.puzzle_streak} label="streak" tone="wine" />
                          {feedback.spaced_repetition ? (
                            <StatPill
                              icon="calendar-clock"
                              value={`${feedback.spaced_repetition.interval_days}d`}
                              label="review in"
                              tone="gold"
                            />
                          ) : null}
                        </View>
                        {hintsByPuzzle[puzzle.id] ? (
                          <Text style={styles.hintText}>{hintsByPuzzle[puzzle.id]}</Text>
                        ) : null}
                        {shouldRevealSolution ? (
                          <View style={styles.solutionPanel}>
                            <Text style={styles.solutionLabel}>Engine best move</Text>
                            <Text style={styles.solutionMove}>{feedback.best_move || puzzle.solution}</Text>
                            <Text style={styles.solutionExplanation}>
                              {feedback.explanation ||
                                "This move was the best tactical opportunity found in your game analysis. Replay the position and compare it with your move to see what threat, capture, or forcing sequence it creates."}
                            </Text>
                          </View>
                        ) : null}
                        <View style={styles.actionRow}>
                          <SecondaryButton
                            title="Hint"
                            icon="lightbulb-on-outline"
                            onPress={() => showHint(puzzle)}
                            style={styles.actionButton}
                          />
                          <SecondaryButton
                            title="Retry"
                            icon="refresh"
                            onPress={() => retryPuzzle(puzzle.id)}
                            style={styles.actionButton}
                          />
                        </View>
                      </>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.boardWrap}>
                  <ChessboardWithArrows
                    fen={puzzle.fen}
                    boardSize={300}
                    withLetters={true}
                    withNumbers={true}
                    onMove={(move) => stageMove(puzzle.id, move)}
                    arrows={arrows}
                    highlights={highlights}
                  />
                </View>

                <Text style={styles.fenText} selectable>{puzzle.fen}</Text>

                <Text style={[styles.moveHint, feedback?.is_correct && styles.correctMoveHint]}>
                  {moves[puzzle.id]
                    ? feedback
                      ? `Submitted move: ${moves[puzzle.id]}`
                      : `Selected move: ${moves[puzzle.id]}`
                    : "Tap a piece, then tap the destination square."}
                </Text>

                <PrimaryButton
                  title={submitting === puzzle.id ? "Submitting..." : "Submit move"}
                  icon="send"
                  onPress={() => submitAttempt(puzzle)}
                  disabled={submitting === puzzle.id}
                />
              </PremiumPanel>
            );
          })}
        </>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginBottom: 16,
  },
  loadingPanel: {
    alignItems: "center",
  },
  puzzleCard: {
    gap: 12,
    marginBottom: 12,
  },
  cardTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  theme: {
    color: palette.ink,
    flex: 1,
    fontSize: 17,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  difficulty: {
    backgroundColor: "#3A3219",
    borderRadius: 8,
    color: palette.ink,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 5,
    textTransform: "capitalize",
  },
  toMoveRow: {
    alignSelf: "stretch",
  },
  boardWrap: {
    alignItems: "center",
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
  },
  fenText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  moveHint: {
    color: palette.mutedDark,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  correctMoveHint: {
    color: "#1E8E54",
  },
  correctPanel: {
    backgroundColor: "rgba(30, 142, 84, 0.12)",
    borderColor: "rgba(30, 142, 84, 0.35)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 7,
    padding: 12,
  },
  correctTitle: {
    color: "#1E8E54",
    fontSize: 19,
    fontWeight: "900",
  },
  incorrectPanel: {
    backgroundColor: "rgba(201, 90, 106, 0.12)",
    borderColor: "rgba(201, 90, 106, 0.38)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 7,
    padding: 12,
  },
  incorrectTitle: {
    color: palette.danger,
    fontSize: 19,
    fontWeight: "900",
  },
  correctBody: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  explanation: {
    color: palette.mutedDark,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  explanationPanel: {
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 7,
    padding: 11,
  },
  explanationTopLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  explanationLabel: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  explanationSource: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  hintText: {
    color: palette.goldSoft,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
  solutionPanel: {
    backgroundColor: "rgba(30, 142, 84, 0.14)",
    borderColor: "rgba(30, 142, 84, 0.42)",
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  solutionLabel: {
    color: palette.mutedDark,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  solutionMove: {
    color: "#1E8E54",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3,
  },
  solutionExplanation: {
    color: palette.mutedDark,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 7,
  },
  progressRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 3,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    minWidth: 118,
  },
});
