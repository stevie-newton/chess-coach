import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from "react-native";
import Chessboard from "react-native-chessboard";
import { api } from "../api/client";
import {
  AppShell,
  EmptyState,
  PremiumPanel,
  PrimaryButton,
  SectionHeader,
  StatPill,
  palette,
  uiStyles,
} from "../components/PremiumUI";

export default function PuzzlesScreen({ showBack = true }) {
  const [puzzles, setPuzzles] = useState([]);
  const [moves, setMoves] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(null);

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

  const updateMove = (puzzleId, value) => {
    setMoves((current) => ({ ...current, [puzzleId]: value }));
  };

  const submitAttempt = async (puzzle) => {
    const userMove = moves[puzzle.id]?.trim();

    if (!userMove) {
      Alert.alert("Missing move", "Enter your move in UCI format, like e2e4.");
      return;
    }

    try {
      setSubmitting(puzzle.id);
      const response = await api.post(`/puzzles/${puzzle.id}/attempt`, {
        user_move: userMove,
        time_taken_seconds: null,
      });

      Alert.alert(
        response.data.is_correct ? "Correct" : "Incorrect",
        response.data.is_correct
          ? "Good work. You found the move."
          : `Not quite. The solution is ${puzzle.solution}.`
      );
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
          {puzzles.map((puzzle) => (
            <PremiumPanel key={puzzle.id} style={styles.puzzleCard}>
              <View style={styles.cardTop}>
                <Text style={styles.theme}>{puzzle.theme || "Best move training"}</Text>
                <Text style={styles.difficulty}>{puzzle.difficulty}</Text>
              </View>

              <View style={styles.boardWrap}>
                <Chessboard
                  fen={puzzle.fen}
                  boardSize={300}
                  gestureEnabled={false}
                  withLetters={true}
                  withNumbers={true}
                />
              </View>

              <Text style={styles.fenText} selectable>{puzzle.fen}</Text>

              <TextInput
                style={uiStyles.input}
                placeholder="Best move, e.g. e2e4"
                placeholderTextColor={palette.muted}
                autoCapitalize="none"
                value={moves[puzzle.id] || ""}
                onChangeText={(value) => updateMove(puzzle.id, value)}
              />

              <PrimaryButton
                title={submitting === puzzle.id ? "Submitting..." : "Submit move"}
                icon="send"
                onPress={() => submitAttempt(puzzle)}
              />
            </PremiumPanel>
          ))}
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
});
