import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useContext, useEffect, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { api } from "../api/client";
import ChessboardWithArrows from "../components/ChessboardWithArrows";
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
import { AuthContext } from "../context/AuthContext";

export default function MistakeReplayScreen() {
  const { logout } = useContext(AuthContext);
  const { width } = useWindowDimensions();
  const [position, setPosition] = useState(null);
  const [userMove, setUserMove] = useState("");
  const [hintLevel, setHintLevel] = useState(1);
  const [hint, setHint] = useState(null);
  const [hintHistory, setHintHistory] = useState([]);
  const [attemptFeedback, setAttemptFeedback] = useState(null);
  const [loading, setLoading] = useState(true);

  const boardSize = Math.min(Math.max(width - 72, 240), 334);

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

  const loadNextMistake = useCallback(async () => {
    try {
      setLoading(true);
      setHint(null);
      setHintHistory([]);
      setHintLevel(1);
      setUserMove("");
      setAttemptFeedback(null);

      const response = await api.get("/mistake-replay/next");
      setPosition(response.data);
    } catch (error) {
      if (error.response?.status === 401) {
        await logout();
        router.replace("/auth/login");
        return;
      }

      Alert.alert(
        "Error",
        error.response?.data?.detail || "Could not load mistake replay"
      );
    } finally {
      setLoading(false);
    }
  }, [logout]);

  const getHint = async () => {
    if (!position?.move_analysis_id) {
      return;
    }

    try {
      const response = await api.get(
        `/mistake-replay/${position.move_analysis_id}/hint/${hintLevel}`
      );

      const nextHint = {
        level: response.data.hint_level || hintLevel,
        text: response.data.hint,
      };

      setHint(nextHint.text);
      setHintHistory((current) => {
        const withoutSameLevel = current.filter((item) => item.level !== nextHint.level);
        return [...withoutSameLevel, nextHint].sort((a, b) => a.level - b.level);
      });

      if (nextHint.level < 4) {
        setHintLevel(nextHint.level + 1);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        await logout();
        router.replace("/auth/login");
        return;
      }

      Alert.alert(
        "Hint failed",
        error.response?.data?.detail || "Could not get hint"
      );
    }
  };

  const submitAttempt = async (detectedMove = null) => {
    const moveToSubmit = detectedMove || userMove.trim();

    if (!moveToSubmit) {
      Alert.alert("Missing move", "Tap a piece, then tap its destination square.");
      return;
    }

    try {
      const response = await api.post(
        `/mistake-replay/${position.move_analysis_id}/attempt`,
        {
          user_move: moveToSubmit,
          time_taken_seconds: null,
        }
      );

      setUserMove(moveToSubmit);
      setAttemptFeedback(response.data);

      if (response.data.is_correct) {
        Alert.alert("Correct", "Great job. The explanation is shown below.");
      } else {
        Alert.alert("Incorrect", "Not the best move. The correct move is shown on the board.");
      }
    } catch (error) {
      if (error.response?.status === 401) {
        await logout();
        router.replace("/auth/login");
        return;
      }

      Alert.alert(
        "Attempt failed",
        error.response?.data?.detail || "Could not submit attempt"
      );
    }
  };

  useEffect(() => {
    loadNextMistake();
  }, [loadNextMistake]);

  if (loading) {
    return (
      <AppShell scroll={false} showTopBar={false} contentStyle={styles.centerShell}>
        <LoadingState
          title="Preparing the position"
          body="Loading your next mistake replay drill."
        />
      </AppShell>
    );
  }

  if (position?.message) {
    return (
      <AppShell
        showBack
        eyebrow="Mistake Replay"
        title="No position is due."
        subtitle="When the analysis queue finds a missed chance, it will appear here as a replay drill."
      >
        <EmptyState
          icon="check-decagram"
          title="Review queue is clear"
          body={position.message}
          actionTitle="Refresh"
          onAction={loadNextMistake}
        />
      </AppShell>
    );
  }

  if (!position) {
    return (
      <AppShell showBack eyebrow="Mistake Replay" title="No position available.">
        <EmptyState
          icon="database-off"
          title="Nothing to replay"
          body="Import analyzed games to generate mistake replay drills."
          actionTitle="Try again"
          onAction={loadNextMistake}
        />
      </AppShell>
    );
  }

  const submittedSquares = moveToSquares(userMove);
  const bestMove = attemptFeedback?.best_move || position.best_move;
  const bestSquares = moveToSquares(bestMove);
  const showBestMove = attemptFeedback && bestSquares;
  const arrows = [];
  const highlights = [];

  if (attemptFeedback && submittedSquares) {
    arrows.push({
      ...submittedSquares,
      id: "mistake-replay-submitted",
      color: attemptFeedback.is_correct ? "rgba(30, 142, 84, 0.82)" : "rgba(201, 90, 106, 0.78)",
    });
    highlights.push(
      {
        square: submittedSquares.from,
        color: attemptFeedback.is_correct ? "rgba(30, 142, 84, 0.22)" : "rgba(201, 90, 106, 0.22)",
        borderColor: attemptFeedback.is_correct ? "rgba(30, 142, 84, 0.82)" : "rgba(201, 90, 106, 0.78)",
      },
      {
        square: submittedSquares.to,
        color: attemptFeedback.is_correct ? "rgba(30, 142, 84, 0.3)" : "rgba(201, 90, 106, 0.3)",
        borderColor: attemptFeedback.is_correct ? "rgba(30, 142, 84, 0.94)" : "rgba(201, 90, 106, 0.9)",
      }
    );
  }

  if (showBestMove && !attemptFeedback.is_correct) {
    arrows.push({
      ...bestSquares,
      id: "mistake-replay-best",
      color: "rgba(30, 142, 84, 0.88)",
    });
    highlights.push(
      {
        square: bestSquares.from,
        color: "rgba(30, 142, 84, 0.2)",
        borderColor: "rgba(30, 142, 84, 0.82)",
      },
      {
        square: bestSquares.to,
        color: "rgba(30, 142, 84, 0.3)",
        borderColor: "rgba(30, 142, 84, 0.94)",
      }
    );
  }

  return (
    <AppShell
      showBack
      eyebrow="Mistake Replay"
      title="Find the move you missed."
      subtitle="Rebuild the thought process, use progressive hints, then play the best move on the board."
    >
      <View style={styles.statsRow}>
        <StatPill icon="counter" value={`#${position.move_number}`} label="move" tone="gold" />
        <StatPill icon="chess-king" value={position.color || "-"} label="to move" />
        <StatPill icon="alert" value={position.mistake_type || "Tactic"} label="theme" tone="wine" />
      </View>

      <PremiumPanel dark style={styles.boardPanel}>
        <View style={styles.boardHeader}>
          <View>
            <Text style={styles.boardKicker}>Critical position</Text>
            <Text style={styles.boardTitle}>Replay the decision point</Text>
          </View>
          <MaterialCommunityIcons name="crosshairs-question" size={28} color={palette.goldSoft} />
        </View>

        <View style={styles.boardWrap}>
          <ChessboardWithArrows
            fen={position.fen_before}
            boardSize={boardSize}
            withLetters={true}
            withNumbers={true}
            onMove={attemptFeedback ? null : submitAttempt}
            arrows={arrows}
            highlights={highlights}
          />
        </View>

        <Text style={styles.fenText} selectable>
          {position.fen_before}
        </Text>
      </PremiumPanel>

      <PremiumPanel style={styles.previousMovePanel}>
        <Text style={styles.panelLabel}>Your previous move</Text>
        <View style={styles.moveRow}>
          <Text style={styles.moveSan}>{position.played_move || "Unknown"}</Text>
          <Text style={styles.moveUci}>{position.played_move_uci || "No UCI"}</Text>
        </View>
      </PremiumPanel>

      <PremiumPanel style={styles.answerPanel}>
        <Text style={styles.panelLabel}>Best move attempt</Text>
        <Text style={styles.movePrompt}>
          {userMove
            ? `Last move: ${userMove}`
            : "Tap a piece, then tap the destination square."}
        </Text>

        {hintHistory.length > 0 ? (
          <View style={styles.hintBox}>
            <MaterialCommunityIcons name="lightbulb-on" size={20} color={palette.gold} />
            <View style={styles.hintCopy}>
              {hintHistory.map((item) => (
                <View key={item.level} style={styles.hintLine}>
                  <Text style={styles.hintLevel}>Hint {item.level}</Text>
                  <Text style={styles.hintText}>{item.text}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {showBestMove ? (
          <View style={styles.solutionBox}>
            <MaterialCommunityIcons name="target" size={20} color={palette.sage} />
            <View style={styles.solutionCopy}>
              <Text style={styles.solutionLabel}>
                {attemptFeedback.is_correct ? "Why this move works" : "Correct move"}
              </Text>
              <Text style={styles.solutionMove}>{bestMove}</Text>
              {attemptFeedback.explanation ? (
                <Text style={styles.solutionExplanation}>{attemptFeedback.explanation}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <SecondaryButton
            title={hintLevel >= 4 && hint ? "Final hint" : `Hint ${hintLevel}`}
            icon="lightbulb-outline"
            onPress={getHint}
          />
          <PrimaryButton
            title={attemptFeedback ? "Next position" : "Submit"}
            icon={attemptFeedback ? "skip-next" : "send"}
            onPress={attemptFeedback ? loadNextMistake : submitAttempt}
          />
        </View>
        <SecondaryButton title="Skip this position" icon="skip-next" onPress={loadNextMistake} />
      </PremiumPanel>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  centerShell: {
    justifyContent: "center",
  },
  loadingPanel: {
    alignItems: "center",
    gap: 10,
  },
  loadingTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "900",
  },
  loadingText: {
    color: palette.muted,
    fontSize: 14,
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginBottom: 14,
  },
  boardPanel: {
    gap: 14,
    marginBottom: 12,
  },
  boardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  boardKicker: {
    color: palette.goldSoft,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 3,
    textTransform: "uppercase",
  },
  boardTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "900",
  },
  boardWrap: {
    alignItems: "center",
    backgroundColor: palette.ivory,
    borderColor: palette.lineDark,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
  },
  fenText: {
    color: palette.mutedDark,
    fontSize: 12,
    lineHeight: 18,
  },
  previousMovePanel: {
    gap: 10,
    marginBottom: 12,
  },
  panelLabel: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  moveRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  moveSan: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: "900",
  },
  moveUci: {
    backgroundColor: palette.charcoal,
    borderRadius: 8,
    color: palette.ink,
    fontSize: 13,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  answerPanel: {
    gap: 12,
  },
  movePrompt: {
    color: palette.mutedDark,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
    textAlign: "center",
  },
  hintBox: {
    alignItems: "flex-start",
    backgroundColor: "#3A3219",
    borderColor: palette.gold,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    padding: 12,
  },
  hintCopy: {
    flex: 1,
    gap: 8,
  },
  hintLine: {
    gap: 3,
  },
  hintLevel: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  hintText: {
    color: palette.ink,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  solutionBox: {
    alignItems: "flex-start",
    backgroundColor: "#243A2D",
    borderColor: palette.sage,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    padding: 12,
  },
  solutionCopy: {
    flex: 1,
    gap: 3,
  },
  solutionLabel: {
    color: palette.sage,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  solutionMove: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  solutionExplanation: {
    color: palette.mutedDark,
    fontSize: 14,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
});
