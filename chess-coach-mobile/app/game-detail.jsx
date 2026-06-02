import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
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
  const [analysis, setAnalysis] = useState(null);
  const [positions, setPositions] = useState([]);
  const [mistakes, setMistakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [coachLoadingByMove, setCoachLoadingByMove] = useState({});

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
          const analysisResponse = await api.get(`/analysis/${id}`);
          setAnalysis(analysisResponse.data);
        } catch (error) {
          if (error.response?.status !== 404) {
            console.log(error.response?.data || error.message);
          }
        }

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
  const positionId = (position) => position?.move_id ?? position?.id;
  const mistakeCount = mistakes.length || positions.filter((position) => badMoveTypes.includes(position.mistake_type)).length;
  const blunderCount = analysis?.blunders ?? positions.filter((position) => position.mistake_type === "blunder").length;
  const mistakeOnlyCount = analysis?.mistakes ?? positions.filter((position) => position.mistake_type === "mistake").length;
  const accuracy = analysis?.accuracy ?? (positions.length > 0 ? Math.round(((positions.length - mistakeCount) / positions.length) * 100) : null);
  const bestMovesFound = analysis?.best_moves_found ?? positions.filter((position) => position.mistake_type === "good").length;
  const focusedReview = analysis?.focused_review;
  const tacticalMisses = positions.filter((position) => position.tactical_miss);
  const mistakePositions = positions.filter((position) => badMoveTypes.includes(position.mistake_type));
  const replayPosition = positions[replayIndex] || mistakes[0] || positions.find((position) => position.fen_before) || null;
  const currentMistakeIndex = mistakePositions.findIndex(
    (position) => positionId(position) === positionId(replayPosition)
  );
  const nextMistakeTitle =
    currentMistakeIndex >= 0 && currentMistakeIndex < mistakePositions.length - 1
      ? "Next mistake"
      : "First mistake";
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
    const nextIndex = positions.findIndex((position) => positionId(position) === moveId);

    if (nextIndex >= 0) {
      goToReplayIndex(nextIndex);
    }
  };

  const jumpToNextMistake = () => {
    if (!mistakePositions.length) {
      return;
    }

    if (currentMistakeIndex >= 0) {
      const nextIndex = (currentMistakeIndex + 1) % mistakePositions.length;
      jumpToPosition(positionId(mistakePositions[nextIndex]));
      return;
    }

    const nextMistake = mistakePositions.find((position) => {
      const positionIndex = positions.findIndex((item) => positionId(item) === positionId(position));
      return positionIndex >= replayIndex;
    });

    if (nextMistake) {
      jumpToPosition(positionId(nextMistake));
    } else {
      jumpToPosition(positionId(mistakePositions[0]));
    }
  };

  const updateMoveExplanation = (moveId, explanation) => {
    const applyExplanation = (items) =>
      items.map((item) =>
        positionId(item) === moveId ? { ...item, explanation } : item
      );

    setPositions(applyExplanation);
    setMistakes(applyExplanation);
    setAnalysis((current) =>
      current?.moves
        ? { ...current, moves: applyExplanation(current.moves) }
        : current
    );
  };

  const askAiCoachForMove = async (position) => {
    const moveId = positionId(position);

    if (!moveId || coachLoadingByMove[moveId]) {
      return;
    }

    try {
      setCoachLoadingByMove((current) => ({ ...current, [moveId]: true }));
      const response = await api.post(`/board/move/${moveId}/coach-explanation`);
      updateMoveExplanation(moveId, response.data.answer);
    } catch (error) {
      Alert.alert(
        "Coach unavailable",
        error.response?.data?.detail || "Could not generate an AI coach explanation."
      );
    } finally {
      setCoachLoadingByMove((current) => {
        const next = { ...current };
        delete next[moveId];
        return next;
      });
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
        <StatPill icon="target" value={accuracy !== null ? `${accuracy}%` : "-"} label="accuracy" tone="gold" />
        <StatPill icon="alert-octagon" value={blunderCount} label="blunders" tone="wine" />
        <StatPill icon="alert-circle" value={mistakeOnlyCount} label="mistakes" tone="sage" />
        <StatPill icon="star-check" value={bestMovesFound} label="best moves" tone="gold" />
      </View>

      <PremiumPanel dark style={styles.summaryPanel}>
        <Text style={styles.panelLabel}>Post-game report</Text>
        <View style={styles.reportGrid}>
          <View style={styles.reportTile}>
            <Text style={styles.reportValue}>{accuracy !== null ? `${accuracy}%` : "-"}</Text>
            <Text style={styles.reportLabel}>Accuracy</Text>
          </View>
          <View style={styles.reportTile}>
            <Text style={styles.reportValue}>{blunderCount}</Text>
            <Text style={styles.reportLabel}>Blunders</Text>
          </View>
          <View style={styles.reportTile}>
            <Text style={styles.reportValue}>{mistakeOnlyCount}</Text>
            <Text style={styles.reportLabel}>Mistakes</Text>
          </View>
          <View style={styles.reportTile}>
            <Text style={styles.reportValue}>{bestMovesFound}</Text>
            <Text style={styles.reportLabel}>Best Moves</Text>
          </View>
        </View>
        <Text style={styles.summaryLine}>
          {analyzedCount > 0
            ? `${analyzedCount} analyzed moves, ${mistakeCount} review targets, ${tacticalMisses.length} tactical misses.`
            : "Analyze this game to unlock the move-by-move review."}
        </Text>
        {focusedReview ? (
          <View style={styles.focusBox}>
            <Text style={styles.focusTitle}>{focusedReview.label}</Text>
            <Text style={styles.summaryLine}>
              {focusedReview.accuracy}% over {focusedReview.reviewed_moves} focus moves, with {focusedReview.mistakes} focus mistakes.
            </Text>
            <Text style={styles.focusText}>{focusedReview.summary}</Text>
          </View>
        ) : null}
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
            {mistakePositions.length > 0 ? (
              <SecondaryButton
                title={nextMistakeTitle}
                icon="alert-octagon"
                style={styles.jumpButton}
                onPress={jumpToNextMistake}
              />
            ) : null}
            {currentMistakeIndex >= 0 ? (
              <Text style={styles.replayCount}>
                Mistake {currentMistakeIndex + 1} of {mistakePositions.length}
              </Text>
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

      <SectionHeader label="Explain Mistakes" />
      {mistakes.length > 0 ? (
        mistakes.map((mistake) => (
          <PremiumPanel key={positionId(mistake)} style={[styles.itemCard, mistake.tactical_miss && styles.tacticalCard]}>
            <View style={styles.itemTop}>
              <Text style={styles.itemTitle}>
                Move {mistake.move_number} {mistake.color}
              </Text>
              <Text style={styles.badge}>{mistake.mistake_type}</Text>
            </View>
            <Text style={styles.mutedText}>Played: {mistake.played_move || "Unknown"}</Text>
            <Text style={styles.bestMoveText}>Best move: {mistake.best_move_san || mistake.best_move || "Unknown"}</Text>
            {mistake.tactical_miss_reason ? (
              <Text style={styles.tacticalText}>{mistake.tactical_miss_reason}</Text>
            ) : null}
            {mistake.focus_note ? (
              <Text style={styles.focusText}>{mistake.focus_note}</Text>
            ) : null}
            <Text style={styles.explanation}>{mistake.explanation || "No explanation yet."}</Text>
            <SecondaryButton
              title="Show on board"
              icon="chess-board"
              style={styles.inlineButton}
              onPress={() => jumpToPosition(positionId(mistake))}
            />
            <SecondaryButton
              title={coachLoadingByMove[positionId(mistake)] ? "Thinking..." : "Ask AI coach"}
              icon="creation"
              disabled={!!coachLoadingByMove[positionId(mistake)]}
              style={styles.inlineButton}
              onPress={() => askAiCoachForMove(mistake)}
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

      <SectionHeader label="Tactical Misses" />
      {tacticalMisses.length > 0 ? (
        tacticalMisses.map((position) => (
          <PremiumPanel key={`tactical-${positionId(position)}`} style={[styles.itemCard, styles.tacticalCard]}>
            <View style={styles.itemTop}>
              <Text style={styles.itemTitle}>
                Move {position.move_number} {position.color}
              </Text>
              <Text style={styles.badge}>{position.mistake_type}</Text>
            </View>
            <Text style={styles.mutedText}>Played: {position.played_move || "Unknown"}</Text>
            <Text style={styles.bestMoveText}>Best move: {position.best_move_san || position.best_move || "Unknown"}</Text>
            <Text style={styles.tacticalText}>{position.tactical_miss_reason}</Text>
            {position.focus_note ? (
              <Text style={styles.focusText}>{position.focus_note}</Text>
            ) : null}
            <SecondaryButton
              title="Review tactic"
              icon="crosshairs-gps"
              style={styles.inlineButton}
              onPress={() => jumpToPosition(positionId(position))}
            />
          </PremiumPanel>
        ))
      ) : (
        <EmptyState
          icon="shield-check"
          title="No tactical misses found"
          body="After analysis, forcing checks, captures, and critical resources will appear here."
        />
      )}

      <SectionHeader label="Move-By-Move Review" />
      {positions.length > 0 ? (
        positions.map((position) => (
          <PremiumPanel key={positionId(position)} style={[styles.itemCard, position.tactical_miss && styles.tacticalCard]}>
            <View style={styles.itemTop}>
              <Text style={styles.itemTitle}>
                Move {position.move_number} {position.color}
              </Text>
              <Text style={styles.badge}>{position.mistake_type || "good"}</Text>
            </View>
            <Text style={styles.mutedText}>Played: {position.played_move || "Unknown"}</Text>
            <Text style={styles.bestMoveText}>Best move: {position.best_move_san || position.best_move || "Unknown"}</Text>
            {position.tactical_miss_reason ? (
              <Text style={styles.tacticalText}>{position.tactical_miss_reason}</Text>
            ) : null}
            {position.focus_note ? (
              <Text style={styles.focusText}>{position.focus_note}</Text>
            ) : null}
            <Text style={styles.explanation}>{position.explanation || "No explanation yet."}</Text>
            <Text style={styles.mutedText}>
              Eval: {position.evaluation_before ?? "-"} to {position.evaluation_after ?? "-"}
            </Text>
            <SecondaryButton
              title="Show on board"
              icon="chess-board"
              style={styles.inlineButton}
              onPress={() => jumpToPosition(positionId(position))}
            />
            {badMoveTypes.includes(position.mistake_type) ? (
              <SecondaryButton
                title={coachLoadingByMove[positionId(position)] ? "Thinking..." : "Ask AI coach"}
                icon="creation"
                disabled={!!coachLoadingByMove[positionId(position)]}
                style={styles.inlineButton}
                onPress={() => askAiCoachForMove(position)}
              />
            ) : null}
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
    gap: 12,
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
  focusBox: {
    backgroundColor: "rgba(15,17,21,0.58)",
    borderColor: "rgba(215,179,90,0.42)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  focusTitle: {
    color: palette.gold,
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  focusText: {
    color: palette.goldSoft,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
  reportGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  reportTile: {
    backgroundColor: "rgba(15,17,21,0.58)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    minHeight: 78,
    minWidth: 130,
    padding: 12,
  },
  reportValue: {
    color: palette.gold,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 29,
  },
  reportLabel: {
    color: palette.mutedDark,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 4,
    textTransform: "uppercase",
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
  bestMoveText: {
    color: palette.gold,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
  },
  tacticalText: {
    color: palette.mutedDark,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
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
  tacticalCard: {
    borderColor: "rgba(215,179,90,0.58)",
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
