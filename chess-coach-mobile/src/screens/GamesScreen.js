import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import {
  AppShell,
  EmptyState,
  LoadingState,
  PremiumPanel,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatPill,
  palette,
} from "../components/PremiumUI";

export default function GamesScreen({ showBack = true }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionByGame, setActionByGame] = useState({});

  const loadGames = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/games/");
      setGames(response.data || []);
    } catch (error) {
      console.log(error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadGames();
    }, [loadGames])
  );

  const refreshGames = () => {
    loadGames();
  };

  const setGameAction = (gameId, action) => {
    setActionByGame((current) => ({ ...current, [gameId]: action }));
  };

  const clearGameAction = (gameId) => {
    setActionByGame((current) => {
      const next = { ...current };
      delete next[gameId];
      return next;
    });
  };

  const analyzeGame = async (gameId) => {
    if (actionByGame[gameId]) {
      return;
    }

    try {
      setGameAction(gameId, "analysis");
      const response = await api.post(`/analysis/${gameId}`);
      const focusMessage = response.data.personalized_training_focus?.message;
      const generatedPuzzles = response.data.generated_puzzles ?? 0;
      Alert.alert(
        "Analysis complete",
        `Accuracy: ${response.data.accuracy}%\nMistakes: ${response.data.mistakes}\nBlunders: ${response.data.blunders}\nBest Moves: ${response.data.best_moves_found}\nGenerated puzzles: ${generatedPuzzles}${focusMessage ? `\n${focusMessage}` : ""}`,
        [
          { text: "Stay here", style: "cancel" },
          { text: "Train tactics", onPress: () => router.push("/(tabs)/puzzles") },
          { text: "Dashboard", onPress: () => router.push("/(tabs)/dashboard") },
        ]
      );
    } catch (error) {
      Alert.alert(
        "Analysis failed",
        error.response?.data?.detail || "Could not analyze this game"
      );
    } finally {
      clearGameAction(gameId);
    }
  };

  const generatePuzzles = async (gameId) => {
    if (actionByGame[gameId]) {
      return;
    }

    try {
      setGameAction(gameId, "puzzles");
      const response = await api.post(`/puzzles/from-game/${gameId}`);
      const count = response.data?.length || 0;

      Alert.alert(
        count > 0 ? "Puzzles generated" : "No puzzles generated",
        count > 0
          ? `${count} puzzle${count === 1 ? "" : "s"} added from this game.`
          : "Analyze this game first, or choose a game with inaccuracies, mistakes, or blunders.",
        count > 0
          ? [
              { text: "Stay here", style: "cancel" },
              { text: "Open puzzles", onPress: () => router.push("/(tabs)/puzzles") },
            ]
          : undefined
      );
    } catch (error) {
      Alert.alert(
        "Puzzle generation failed",
        error.response?.data?.detail || "Could not generate puzzles for this game"
      );
    } finally {
      clearGameAction(gameId);
    }
  };

  return (
    <AppShell
      showBack={showBack}
      eyebrow="Game Library"
      title="Your analysis room."
      subtitle="Imported games and coach notes appear here after you sync or upload PGNs."
    >
      <View style={styles.statsRow}>
        <StatPill icon="chess-pawn" value={games.length} label="games" tone="gold" />
      </View>

      <PremiumPanel dark style={styles.importPanel}>
        <View style={styles.importCopy}>
          <Text style={styles.importTitle}>Fresh analysis starts with fresh games.</Text>
          <Text style={styles.importText}>Sync an account or paste a PGN to populate your review queue.</Text>
        </View>
        <View style={styles.importActions}>
          <PrimaryButton title="New training game" icon="chess-board" tone="light" onPress={() => router.push("/game-session")} />
          <PrimaryButton title="Import" icon="download" tone="light" onPress={() => router.push("/import-games")} />
          <SecondaryButton title="Refresh" icon="refresh" onPress={refreshGames} />
        </View>
      </PremiumPanel>

      {loading ? (
        <LoadingState />
      ) : games.length === 0 ? (
        <EmptyState
          icon="database-search"
          title="No games yet"
          body="Import your games to start building a real analysis library."
          actionTitle="Import games"
          onAction={() => router.push("/import-games")}
        />
      ) : (
        <>
          <SectionHeader label="Recent Games" />
          {games.map((game) => (
            <PremiumPanel key={game.id} style={styles.reviewCard}>
              <View style={styles.reviewTopLine}>
                <Text style={styles.reviewTitle}>{game.opponent || "Unknown opponent"}</Text>
                <Text style={styles.reviewTag}>{game.result || "No result"}</Text>
              </View>
              <Text style={styles.reviewText}>
                {game.source || "Manual"} | {game.color_played || "Color unknown"} | {game.time_control || "Time control unknown"}
              </Text>
              <View style={styles.actionRow}>
                <SecondaryButton
                  title="Details"
                  icon="file-document-outline"
                  style={styles.actionButton}
                  onPress={() => router.push({ pathname: "/game-detail", params: { id: game.id } })}
                />
                <SecondaryButton
                  title={actionByGame[game.id] === "analysis" ? "Analyzing..." : "Analyze game"}
                  icon="chart-timeline-variant"
                  disabled={!!actionByGame[game.id]}
                  style={styles.actionButton}
                  onPress={() => analyzeGame(game.id)}
                />
                <PrimaryButton
                  title={actionByGame[game.id] === "puzzles" ? "Generating..." : "Generate puzzles"}
                  icon="puzzle-plus"
                  disabled={!!actionByGame[game.id]}
                  style={styles.actionButton}
                  onPress={() => generatePuzzles(game.id)}
                />
              </View>
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
    marginBottom: 14,
  },
  importPanel: {
    gap: 14,
    marginBottom: 18,
  },
  importActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  importCopy: {
    gap: 6,
  },
  importTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 25,
  },
  importText: {
    color: palette.mutedDark,
    fontSize: 14,
    lineHeight: 20,
  },
  loadingPanel: {
    alignItems: "center",
  },
  reviewCard: {
    gap: 12,
    marginBottom: 10,
  },
  reviewTopLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  reviewTitle: {
    color: palette.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
  },
  reviewTag: {
    backgroundColor: "#3A3219",
    borderRadius: 8,
    color: palette.ink,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  reviewText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionButton: {
    flexGrow: 1,
    minWidth: 150,
  },
});
