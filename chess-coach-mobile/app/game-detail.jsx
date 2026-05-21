import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api } from "../src/api/client";
import ChessboardWithArrows from "../src/components/ChessboardWithArrows";
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
} from "../src/components/PremiumUI";

const badMoveTypes = ["inaccuracy", "mistake", "blunder"];

export default function GameDetail() {
  const { id } = useLocalSearchParams();
  const [game, setGame] = useState(null);
  const [positions, setPositions] = useState([]);
  const [mistakes, setMistakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    async function loadGameDetail() {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const gameResponse = await api.get(`/games/${id}`);
        setGame(gameResponse.data);

        try {
          const positionsResponse = await api.get(`/board/game/${id}/positions`);
          setPositions(positionsResponse.data.positions || []);
        } catch (error) {
          if (error.response?.status !== 404) {
            console.log(error.response?.data || error.message);
          }
        }

        try {
          const mistakesResponse = await api.get(`/board/game/${id}/mistakes`);
          setMistakes(mistakesResponse.data.mistakes || []);
        } catch (error) {
          if (error.response?.status !== 404) {
            console.log(error.response?.data || error.message);
          }
        }
      } catch (error) {
        console.log(error.response?.data || error.message);
      } finally {
        setLoading(false);
      }
    }

    loadGameDetail();
  }, [id]);

  useEffect(() => {
    if (!isPlaying || positions.length <= 1) {
      return undefined;
    }

    const timer = setInterval(() => {
      setReplayIndex((current) => {
        if (current >= positions.length - 1) {
          setIsPlaying(false);
          return current;
        }

        return current + 1;
      });
    }, 1400);

    return () => clearInterval(timer);
  }, [isPlaying, positions.length]);

  const analyzedCount = positions.length;
  const mistakeCount = mistakes.length || positions.filter((position) => badMoveTypes.includes(position.mistake_type)).length;
  const replayPosition = positions[replayIndex] || mistakes[0] || positions.find((position) => position.fen_before) || null;

  const moveToArrow = (uci, color) => {
    if (!uci || uci.length < 4) {
      return null;
    }

    return {
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      color,
    };
  };

  const replayArrows = [
    moveToArrow(replayPosition?.played_move_uci, "rgba(138, 61, 82, 0.78)"),
    moveToArrow(replayPosition?.best_move, "rgba(212, 175, 55, 0.82)"),
  ].filter(Boolean);

  const evalToPercent = (value) => {
    if (typeof value !== "number") {
      return 50;
    }

    const clamped = Math.max(-5, Math.min(5, value));
    return Math.round(((clamped + 5) / 10) * 100);
  };

  const evalPercent = evalToPercent(replayPosition?.evaluation_after ?? replayPosition?.evaluation_before);
  const canReplay = positions.length > 0;
  const canGoBack = replayIndex > 0;
  const canGoForward = replayIndex < positions.length - 1;

  const goToReplayIndex = (index) => {
    if (!positions.length) {
      return;
    }

    setIsPlaying(false);
    setReplayIndex(Math.max(0, Math.min(positions.length - 1, index)));
  };

  const jumpToPosition = (moveId) => {
    const nextIndex = positions.findIndex((position) => position.move_id === moveId);

    if (nextIndex >= 0) {
      goToReplayIndex(nextIndex);
    }
  };

  const jumpToFirstMistake = () => {
    const firstMistake = positions.find((position) => badMoveTypes.includes(position.mistake_type));

    if (firstMistake) {
      jumpToPosition(firstMistake.move_id);
    }
  };

  if (loading) {
    return (
      <AppShell scroll={false} showTopBar={false} contentStyle={styles.centerShell}>
        <LoadingState panel={false} />
      </AppShell>
    );
  }

  if (!game) {
    return (
      <AppShell showBack eyebrow="Game Detail" title="Game not found.">
        <EmptyState
          icon="database-off"
          title="No game data"
          body="Open a game from your Games list to view details and analysis."
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      showBack
      eyebrow="Game Detail"
      title={game.opponent || "Unknown opponent"}
      subtitle="Opponent, result, PGN, analyzed positions, mistakes, and a board replay preview."
    >
      <View style={styles.statsRow}>
        <StatPill icon="chess-knight" value={game.result || "-"} label="result" tone="gold" />
        <StatPill icon="map-marker-path" value={analyzedCount} label="positions" />
        <StatPill icon="alert-octagon" value={mistakeCount} label="mistakes" tone="wine" />
      </View>

      <PremiumPanel dark style={styles.summaryPanel}>
        <Text style={styles.panelLabel}>Game summary</Text>
        <Text style={styles.summaryLine}>Opponent: {game.opponent || "Unknown opponent"}</Text>
        <Text style={styles.summaryLine}>Result: {game.result || "No result"}</Text>
        <Text style={styles.summaryLine}>Color: {game.color_played || "Unknown"}</Text>
        <Text style={styles.summaryLine}>Source: {game.source || "Manual"}</Text>
        <Text style={styles.summaryLine}>Time control: {game.time_control || "Unknown"}</Text>
      </PremiumPanel>

      <SectionHeader label="Board Replay" action="Preview" />
      {replayPosition?.fen_before ? (
        <PremiumPanel style={styles.boardPanel}>
          <View style={styles.replayTop}>
            <Text style={styles.boardText}>
              Move {replayPosition.move_number} {replayPosition.color}: {replayPosition.played_move || "unknown move"}
            </Text>
            <Text style={styles.badge}>{replayPosition.mistake_type || "good"}</Text>
          </View>

          <View style={styles.boardStage}>
            <View style={styles.evalBar}>
              <View style={[styles.evalTop, { flex: 100 - evalPercent }]} />
              <View style={[styles.evalBottom, { flex: evalPercent }]} />
            </View>
            <View style={styles.boardWrap}>
              <ChessboardWithArrows
                fen={replayPosition.fen_before}
                boardSize={300}
                withLetters={true}
                withNumbers={true}
                arrows={replayArrows}
              />
            </View>
          </View>

          <View style={styles.legendRow}>
            <Text style={styles.playedLegend}>Played move</Text>
            <Text style={styles.bestLegend}>Best move</Text>
            <Text style={styles.mutedText}>Eval: {replayPosition.evaluation_before ?? "-"} to {replayPosition.evaluation_after ?? "-"}</Text>
          </View>

          <View style={styles.replayControls}>
            <SecondaryButton
              title="First"
              icon="skip-previous"
              disabled={!canGoBack}
              style={styles.replayButton}
              onPress={() => goToReplayIndex(0)}
            />
            <SecondaryButton
              title="Previous"
              icon="chevron-left"
              disabled={!canGoBack}
              style={styles.replayButton}
              onPress={() => goToReplayIndex(replayIndex - 1)}
            />
            <PrimaryButton
              title={isPlaying ? "Pause" : "Play"}
              icon={isPlaying ? "pause" : "play"}
              disabled={!canReplay || (!canGoForward && !isPlaying)}
              style={styles.replayButton}
              onPress={() => {
                if (!canGoForward && !isPlaying) {
                  return;
                }

                setIsPlaying((current) => !current);
              }}
            />
            <SecondaryButton
              title="Next"
              icon="chevron-right"
              disabled={!canGoForward}
              style={styles.replayButton}
              onPress={() => goToReplayIndex(replayIndex + 1)}
            />
            <SecondaryButton
              title="Last"
              icon="skip-next"
              disabled={!canGoForward}
              style={styles.replayButton}
              onPress={() => goToReplayIndex(positions.length - 1)}
            />
          </View>

          <View style={styles.replayMetaRow}>
            <Text style={styles.replayCount}>
              Position {Math.min(replayIndex + 1, positions.length || 1)} of {positions.length || 1}
            </Text>
            {mistakeCount > 0 ? (
              <SecondaryButton
                title="First mistake"
                icon="alert-octagon"
                style={styles.jumpButton}
                onPress={jumpToFirstMistake}
              />
            ) : null}
          </View>
        </PremiumPanel>
      ) : (
        <EmptyState
          icon="chess-board"
          title="No analyzed board positions yet"
          body="Analyze this game from the Games screen to populate board replay positions."
        />
      )}

      <SectionHeader label="Mistakes" />
      {mistakes.length > 0 ? (
        mistakes.map((mistake) => (
          <PremiumPanel key={mistake.move_id} style={styles.itemCard}>
            <View style={styles.itemTop}>
              <Text style={styles.itemTitle}>
                Move {mistake.move_number} {mistake.color}
              </Text>
              <Text style={styles.badge}>{mistake.mistake_type}</Text>
            </View>
            <Text style={styles.mutedText}>Played: {mistake.played_move || "Unknown"}</Text>
            <Text style={styles.mutedText}>Best: {mistake.best_move || "Unknown"}</Text>
            <Text style={styles.explanation}>{mistake.explanation || "No explanation yet."}</Text>
            <SecondaryButton
              title="Show on board"
              icon="chess-board"
              style={styles.inlineButton}
              onPress={() => jumpToPosition(mistake.move_id)}
            />
          </PremiumPanel>
        ))
      ) : (
        <EmptyState
          icon="shield-check"
          title="No mistakes found"
          body="After analysis, mistakes and blunders from this game will appear here."
        />
      )}

      <SectionHeader label="Analysis Positions" />
      {positions.length > 0 ? (
        positions.slice(0, 20).map((position) => (
          <PremiumPanel key={position.move_id} style={styles.itemCard}>
            <View style={styles.itemTop}>
              <Text style={styles.itemTitle}>
                Move {position.move_number} {position.color}
              </Text>
              <Text style={styles.badge}>{position.mistake_type || "good"}</Text>
            </View>
            <Text style={styles.mutedText}>Played: {position.played_move || "Unknown"}</Text>
            <Text style={styles.mutedText}>UCI: {position.played_move_uci || "Unknown"}</Text>
            <Text style={styles.mutedText}>Best: {position.best_move || "Unknown"}</Text>
            <Text style={styles.mutedText}>
              Eval: {position.evaluation_before ?? "-"} to {position.evaluation_after ?? "-"}
            </Text>
            <SecondaryButton
              title="Show on board"
              icon="chess-board"
              style={styles.inlineButton}
              onPress={() => jumpToPosition(position.move_id)}
            />
          </PremiumPanel>
        ))
      ) : (
        <EmptyState
          icon="chart-timeline-variant"
          title="No analysis positions"
          body="Analyze this game to list evaluated positions."
        />
      )}

      <SectionHeader label="PGN" />
      <PremiumPanel style={styles.pgnPanel}>
        <Text style={styles.pgnText} selectable>{game.pgn}</Text>
      </PremiumPanel>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  centerShell: {
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginBottom: 14,
  },
  summaryPanel: {
    gap: 7,
    marginBottom: 18,
  },
  panelLabel: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  summaryLine: {
    color: palette.ink,
    fontSize: 14,
    lineHeight: 21,
  },
  boardPanel: {
    gap: 12,
    marginBottom: 18,
  },
  replayTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  boardStage: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  evalBar: {
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    height: 318,
    overflow: "hidden",
    width: 18,
  },
  evalTop: {
    backgroundColor: "#2C2C2C",
  },
  evalBottom: {
    backgroundColor: "#F2F0E8",
  },
  boardWrap: {
    alignItems: "center",
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
  },
  boardText: {
    color: palette.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  playedLegend: {
    color: palette.wine,
    fontSize: 13,
    fontWeight: "900",
  },
  bestLegend: {
    color: palette.gold,
    fontSize: 13,
    fontWeight: "900",
  },
  replayControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  replayButton: {
    flexGrow: 1,
    minWidth: 120,
  },
  replayMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  replayCount: {
    color: palette.mutedDark,
    fontSize: 13,
    fontWeight: "900",
  },
  jumpButton: {
    flexGrow: 1,
    minWidth: 150,
  },
  inlineButton: {
    alignSelf: "flex-start",
    marginTop: 4,
  },
  itemCard: {
    gap: 7,
    marginBottom: 10,
  },
  itemTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  itemTitle: {
    color: palette.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  badge: {
    backgroundColor: "#3A3219",
    borderRadius: 8,
    color: palette.ink,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 5,
    textTransform: "capitalize",
  },
  mutedText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  explanation: {
    color: palette.mutedDark,
    fontSize: 14,
    lineHeight: 20,
  },
  pgnPanel: {
    marginBottom: 8,
  },
  pgnText: {
    color: palette.mutedDark,
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 18,
  },
});
