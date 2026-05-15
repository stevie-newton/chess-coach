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
  StatPill,
  palette,
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

  const submitAttempt = async (puzzle, detectedMove = null) => {
    const userMove = detectedMove || moves[puzzle.id]?.trim();

    if (!userMove) {
      Alert.alert("Missing move", "Tap a piece, then tap its destination square.");
      return;
    }

    try {
      setSubmitting(puzzle.id);
      const response = await api.post(`/puzzles/${puzzle.id}/attempt`, {
        user_move: userMove,
        time_taken_seconds: null,
      });

      setMoves((current) => ({ ...current, [puzzle.id]: userMove }));

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
                <ChessboardWithArrows
                  fen={puzzle.fen}
                  boardSize={300}
                  withLetters={true}
                  withNumbers={true}
                  onMove={(move) => submitAttempt(puzzle, move)}
                />
              </View>

              <Text style={styles.fenText} selectable>{puzzle.fen}</Text>

              <Text style={styles.moveHint}>
                {moves[puzzle.id]
                  ? `Last move: ${moves[puzzle.id]}`
                  : "Tap a piece, then tap the destination square."}
              </Text>

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
  moveHint: {
    color: palette.mutedDark,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
});
