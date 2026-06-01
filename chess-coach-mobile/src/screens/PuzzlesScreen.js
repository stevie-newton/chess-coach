import { useEffect, useRef, useState } from "react";
import { Alert, Keyboard, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Chess } from "chess.js";
import { api } from "../api/client";
import ChessboardWithArrows from "../components/ChessboardWithArrows";
import {
  AppShell,
  EmptyState,
  LoadingState,
  PremiumPanel,
  PrimaryButton,
  SectionHeader,
  SecondaryButton,
  StatPill,
  palette,
  uiStyles,
} from "../components/PremiumUI";

const SOLUTION_REVEAL_FAILS = 3;

export default function PuzzlesScreen({ showBack = true }) {
  const { width } = useWindowDimensions();
  const [boardWrapWidth, setBoardWrapWidth] = useState(0);
  const [puzzles, setPuzzles] = useState([]);
  const [trainingFocus, setTrainingFocus] = useState(null);
  const [moves, setMoves] = useState({});
  const [feedbackByPuzzle, setFeedbackByPuzzle] = useState({});
  const [hintsByPuzzle, setHintsByPuzzle] = useState({});
  const [failedAttemptsByPuzzle, setFailedAttemptsByPuzzle] = useState({});
  const [lineByPuzzle, setLineByPuzzle] = useState({});
  const [autoMoveByPuzzle, setAutoMoveByPuzzle] = useState({});
  const [boardResetByPuzzle, setBoardResetByPuzzle] = useState({});
  const [coachQuestionByPuzzle, setCoachQuestionByPuzzle] = useState({});
  const [coachAnswerByPuzzle, setCoachAnswerByPuzzle] = useState({});
  const [coachLoadingByPuzzle, setCoachLoadingByPuzzle] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(null);
  const autoMoveTimersRef = useRef({});

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

  const boardSize = Math.max(200, Math.min(300, (boardWrapWidth || width - 74) - 18));

  useEffect(() => {
    const timers = autoMoveTimersRef.current;

    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  const normalizeMove = (move) => (move || "").trim().toLowerCase();

  const pieceName = (piece) => {
    const names = {
      p: "pawn",
      n: "knight",
      b: "bishop",
      r: "rook",
      q: "queen",
      k: "king",
    };

    return names[piece] || "piece";
  };

  const moveDetails = (fen, uci) => {
    const normalized = normalizeMove(uci);
    if (!fen || normalized.length < 4) {
      return null;
    }

    try {
      const chess = new Chess(fen);
      const from = normalized.slice(0, 2);
      const to = normalized.slice(2, 4);
      const move = chess.move({
        from,
        to,
        promotion: normalized[4] || "q",
      });

      if (!move) {
        return null;
      }

      return {
        from,
        to,
        san: move.san,
        piece: pieceName(move.piece),
        captured: move.captured ? pieceName(move.captured) : null,
        isCapture: move.flags?.includes("c") || move.flags?.includes("e"),
        isCheck: move.san.includes("+") || move.san.includes("#"),
        isMate: move.san.includes("#"),
      };
    } catch (_error) {
      return null;
    }
  };

  const explainContinuationMiss = (fen, userMove, expectedMove) => {
    const user = moveDetails(fen, userMove);
    const expected = moveDetails(fen, expectedMove?.uci);
    const side = expectedMove?.color === "white" ? "White" : "Black";
    const userSquares = moveToSquares(userMove);
    const expectedSquares = moveToSquares(expectedMove?.uci);

    if (!user || !expected) {
      if (userSquares && expectedSquares) {
        if (userSquares.from === expectedSquares.from && userSquares.to !== expectedSquares.to) {
          return `That uses the right starting square, but it goes to ${userSquares.to} instead of ${expectedSquares.to}. The continuation is ${expectedMove?.san || expectedMove?.uci}.`;
        }

        return `That starts from ${userSquares.from}, but ${side}'s continuation starts from ${expectedSquares.from}: ${expectedMove?.san || expectedMove?.uci}.`;
      }

      return `That is not the continuation. The next move is ${expectedMove?.san || expectedMove?.uci || "the engine move"}.`;
    }

    if (user.from === expected.from && user.to !== expected.to) {
      return `${user.san} uses the right ${user.piece}, but it goes to ${user.to} instead of ${expected.to}. The continuation is ${expected.san}.`;
    }

    if (user.from !== expected.from) {
      return `${user.san} moves the ${user.piece} from ${user.from}, but ${side}'s continuation starts with the ${expected.piece} on ${expected.from}: ${expected.san}.`;
    }

    if (expected.isMate && !user.isMate) {
      return `${user.san} misses checkmate. The continuation is ${expected.san}, which ends the game.`;
    }

    if (expected.isCheck && !user.isCheck) {
      return `${user.san} misses the forcing check. The continuation is ${expected.san}, so the king must respond.`;
    }

    if (expected.isCapture && !user.isCapture) {
      return `${user.san} misses the capture. The continuation is ${expected.san}, which takes the ${expected.captured || "target"}.`;
    }

    return `${user.san} is legal, but it does not create the continuation's threat. The next move is ${expected.san}.`;
  };

  const queueAutoMove = (puzzleId, line, index) => {
    const move = line[index];
    if (!move) {
      return;
    }

    clearTimeout(autoMoveTimersRef.current[puzzleId]);
    autoMoveTimersRef.current[puzzleId] = setTimeout(() => {
      setAutoMoveByPuzzle((current) => ({
        ...current,
        [puzzleId]: {
          from: move.uci.slice(0, 2),
          id: `${puzzleId}-${index}-${move.uci}`,
          index,
          to: move.uci.slice(2, 4),
        },
      }));
    }, 550);
  };

  const advanceLine = (puzzleId, moveIndex) => {
    setLineByPuzzle((current) => {
      const state = current[puzzleId];
      const move = state?.line?.[moveIndex];
      if (!state || !move) {
        return current;
      }

      const nextIndex = moveIndex + 1;
      const nextMove = state.line[nextIndex];
      const isComplete = !nextMove || move.is_checkmate;

      if (nextMove && !nextMove.is_user_move) {
        queueAutoMove(puzzleId, state.line, nextIndex);
      }

      return {
        ...current,
        [puzzleId]: {
          ...state,
          completed: isComplete,
          currentFen: move.fen_after,
          nextIndex,
          status: isComplete
            ? move.is_checkmate
              ? "Checkmate."
              : "Line complete."
            : nextMove.is_user_move
              ? `Your move: find ${nextMove.color === "white" ? "White" : "Black"}'s continuation.`
              : `Opponent replies: ${nextMove.san}`,
        },
      };
    });
  };

  const finishAutoMove = (puzzleId) => {
    const autoMove = autoMoveByPuzzle[puzzleId];
    if (!autoMove) {
      return;
    }

    setAutoMoveByPuzzle((current) => {
      const next = { ...current };
      delete next[puzzleId];
      return next;
    });
    advanceLine(puzzleId, autoMove.index);
  };

  const startSolutionLine = async (puzzle, attemptFeedback) => {
    try {
      const response = await api.get(`/puzzles/${puzzle.id}/line`);
      const line = response.data?.line || [];
      const firstMove = line[0];

      if (!firstMove) {
        return;
      }

      const nextMove = line[1];

      setLineByPuzzle((current) => ({
        ...current,
        [puzzle.id]: {
          completed: !nextMove || firstMove.is_checkmate,
          currentFen: firstMove.fen_after,
          line,
          nextIndex: 1,
          status: !nextMove || firstMove.is_checkmate
            ? firstMove.is_checkmate
              ? "Checkmate."
              : "Line complete."
            : nextMove.is_user_move
              ? "Correct. Find the next move."
              : `Correct. Opponent replies: ${nextMove.san}`,
        },
      }));

      setMoves((current) => ({ ...current, [puzzle.id]: attemptFeedback.user_move }));

      if (nextMove && !nextMove.is_user_move && !firstMove.is_checkmate) {
        queueAutoMove(puzzle.id, line, 1);
      }
    } catch (_error) {
      setLineByPuzzle((current) => ({
        ...current,
        [puzzle.id]: {
          completed: true,
          currentFen: puzzle.fen,
          line: [],
          nextIndex: 0,
          status: "Correct. The coach could not load a continuation for this puzzle.",
        },
      }));
    }
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

  const handleBoardMove = (puzzle, move) => {
    const lineState = lineByPuzzle[puzzle.id];
    const expectedMove = lineState?.line?.[lineState.nextIndex];

    if (!expectedMove?.is_user_move || lineState.completed) {
      stageMove(puzzle.id, move);
      return;
    }

    if (normalizeMove(move) !== normalizeMove(expectedMove.uci)) {
      const status = explainContinuationMiss(lineState.currentFen, move, expectedMove);
      setMoves((current) => ({ ...current, [puzzle.id]: move }));
      setLineByPuzzle((current) => ({
        ...current,
        [puzzle.id]: {
          ...lineState,
          status,
        },
      }));
      setBoardResetByPuzzle((current) => ({
        ...current,
        [puzzle.id]: (current[puzzle.id] || 0) + 1,
      }));
      return;
    }

    setMoves((current) => ({ ...current, [puzzle.id]: move }));
    advanceLine(puzzle.id, lineState.nextIndex);
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

  const askPuzzleCoach = async (puzzle) => {
    const question = coachQuestionByPuzzle[puzzle.id]?.trim();

    if (!question) {
      Alert.alert("Ask Coach", "Enter a question about this puzzle first.");
      return;
    }

    try {
      Keyboard.dismiss();
      setCoachLoadingByPuzzle((current) => ({ ...current, [puzzle.id]: true }));
      const response = await api.post(`/puzzles/${puzzle.id}/ask`, {
        question,
        current_move: moves[puzzle.id] || null,
      });
      const answer = response.data?.answer?.trim();
      setCoachAnswerByPuzzle((current) => ({
        ...current,
        [puzzle.id]: answer || "The coach returned an empty response. Try asking again with a more specific question.",
      }));
    } catch (error) {
      const message = error.response?.data?.detail || "Could not answer this puzzle question";
      setCoachAnswerByPuzzle((current) => ({
        ...current,
        [puzzle.id]: message,
      }));
      Alert.alert("Coach unavailable", message);
    } finally {
      setCoachLoadingByPuzzle((current) => ({ ...current, [puzzle.id]: false }));
    }
  };

  useEffect(() => {
    async function loadPuzzles() {
      try {
        try {
          const response = await api.get("/puzzles/personalized-training");
          setTrainingFocus(response.data?.focus || null);
          setPuzzles(response.data?.puzzles || []);
        } catch (personalizedError) {
          if (personalizedError.response?.status !== 404) {
            console.log(personalizedError.response?.data || personalizedError.message);
          }

          const response = await api.get("/puzzles/");
          setPuzzles(response.data || []);
        }
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

      if (isCorrect) {
        await startSolutionLine(puzzle, response.data);
      }
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
        <LoadingState />
      ) : puzzles.length === 0 ? (
        <EmptyState
          icon="puzzle-outline"
          title="No puzzles yet"
          body="Analyze a game, then tap Generate puzzles from the Games screen."
        />
      ) : (
        <>
          {trainingFocus ? (
            <PremiumPanel dark style={styles.focusPanel}>
              <Text style={styles.focusEyebrow}>Personalized tactical training</Text>
              <Text style={styles.focusTitle}>{trainingFocus.message}</Text>
              <Text style={styles.focusText}>
                The queue is prioritized around this pattern using mistakes from your analyzed games.
              </Text>
            </PremiumPanel>
          ) : null}

          <SectionHeader label="Puzzle Queue" />
          {puzzles.map((puzzle) => {
            const { feedback, arrows, highlights, shouldRevealSolution } = buildSolvedMoveFeedback(puzzle);
            const lineState = lineByPuzzle[puzzle.id];
            const boardFen = lineState?.currentFen || puzzle.fen;
            const isLineActive = Boolean(lineState?.line?.length) && !lineState.completed;
            const expectedLineMove = lineState?.line?.[lineState.nextIndex];

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
                      <>
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
                        {lineState ? (
                          <View style={styles.linePanel}>
                            <Text style={styles.lineLabel}>Continuation</Text>
                            <Text style={styles.lineStatus}>{lineState.status}</Text>
                            {expectedLineMove?.is_user_move && !lineState.completed ? (
                              <Text style={styles.lineHint}>
                                Tap the next move for {expectedLineMove.color === "white" ? "White" : "Black"}.
                              </Text>
                            ) : null}
                          </View>
                        ) : null}
                      </>
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

                <View
                  style={styles.boardWrap}
                  onLayout={(event) => setBoardWrapWidth(event.nativeEvent.layout.width)}
                >
                  <ChessboardWithArrows
                    fen={boardFen}
                    boardSize={boardSize}
                    withLetters={true}
                    withNumbers={true}
                    onMove={(move) => handleBoardMove(puzzle, move)}
                    arrows={isLineActive ? [] : arrows}
                    highlights={isLineActive ? [] : highlights}
                    autoMove={autoMoveByPuzzle[puzzle.id]}
                    onAutoMoveEnd={() => finishAutoMove(puzzle.id)}
                    resetToken={boardResetByPuzzle[puzzle.id] || 0}
                  />
                </View>

                <Text style={styles.fenText} selectable>{boardFen}</Text>

                <Text style={[styles.moveHint, feedback?.is_correct && styles.correctMoveHint]}>
                  {moves[puzzle.id]
                    ? feedback
                      ? `Submitted move: ${moves[puzzle.id]}`
                      : `Selected move: ${moves[puzzle.id]}`
                    : "Tap a piece, then tap the destination square."}
                </Text>

                <View style={styles.askCoachPanel}>
                  <Text style={styles.askCoachTitle}>Ask Coach</Text>
                  <TextInput
                    style={[uiStyles.input, styles.askCoachInput]}
                    placeholder="Ask why the engine prefers this move..."
                    placeholderTextColor={palette.muted}
                    multiline
                    textAlignVertical="top"
                    value={coachQuestionByPuzzle[puzzle.id] || ""}
                    onChangeText={(value) => {
                      setCoachQuestionByPuzzle((current) => ({
                        ...current,
                        [puzzle.id]: value,
                      }));
                      setCoachAnswerByPuzzle((current) => {
                        if (!current[puzzle.id]) {
                          return current;
                        }

                        const next = { ...current };
                        delete next[puzzle.id];
                        return next;
                      });
                    }}
                  />
                  <PrimaryButton
                    title={coachLoadingByPuzzle[puzzle.id] ? "Thinking..." : "Ask about this puzzle"}
                    icon="chat-question"
                    onPress={() => askPuzzleCoach(puzzle)}
                    disabled={coachLoadingByPuzzle[puzzle.id]}
                  />
                  {coachAnswerByPuzzle[puzzle.id] ? (
                    <View style={styles.coachAnswerPanel}>
                      <Text style={styles.coachAnswerLabel}>Coach answer</Text>
                      <Text style={styles.coachAnswerText}>{coachAnswerByPuzzle[puzzle.id]}</Text>
                    </View>
                  ) : null}
                </View>

                <PrimaryButton
                  title={submitting === puzzle.id ? "Submitting..." : "Submit move"}
                  icon="send"
                  onPress={() => submitAttempt(puzzle)}
                  disabled={submitting === puzzle.id || isLineActive}
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
  focusPanel: {
    gap: 7,
    marginBottom: 14,
  },
  focusEyebrow: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  focusTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 25,
  },
  focusText: {
    color: palette.mutedDark,
    fontSize: 14,
    lineHeight: 20,
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
  askCoachPanel: {
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 9,
    padding: 11,
  },
  askCoachTitle: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  askCoachInput: {
    minHeight: 82,
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
  linePanel: {
    backgroundColor: "rgba(215, 179, 90, 0.13)",
    borderColor: "rgba(215, 179, 90, 0.35)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    padding: 10,
  },
  lineLabel: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  lineStatus: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19,
  },
  lineHint: {
    color: palette.mutedDark,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
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
