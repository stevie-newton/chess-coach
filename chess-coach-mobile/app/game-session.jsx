import { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { Chess } from "chess.js";
import ChessboardWithArrows from "../src/components/ChessboardWithArrows";
import {
  AppShell,
  PremiumPanel,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatPill,
  palette,
  uiStyles,
} from "../src/components/PremiumUI";
import { api } from "../src/api/client";

const sessionTypes = [
  { label: "Practice", value: "practice" },
  { label: "Tournament simulation", value: "tournament_simulation" },
  { label: "Opening training", value: "opening_training" },
  { label: "Endgame training", value: "endgame_training" },
  { label: "Tactics training", value: "tactics_training" },
];
const timeControls = ["10+0", "15+10", "30+0", "Classical"];
const colors = ["White", "Black", "Random"];
const results = ["*", "1-0", "0-1", "1/2-1/2"];

function createGameFromMoves(moves) {
  const game = new Chess();

  moves.forEach((move) => {
    game.move({
      from: move.slice(0, 2),
      to: move.slice(2, 4),
      promotion: move.length > 4 ? move[4] : "q",
    });
  });

  return game;
}

function buildPgn({ moves, sessionType, timeControl, color, result, opponent }) {
  const game = createGameFromMoves(moves);
  const sessionLabel = sessionTypes.find((type) => type.value === sessionType)?.label || sessionType;
  const white = color === "Black" ? opponent || "Training Opponent" : "Chess Coach Player";
  const black = color === "Black" ? "Chess Coach Player" : opponent || "Training Opponent";

  game.header(
    "Event",
    sessionLabel,
    "Site",
    "Chess Coach Game Session",
    "White",
    white,
    "Black",
    black,
    "Result",
    result,
    "TimeControl",
    timeControl
  );

  return game.pgn();
}

function SegmentedOptions({ label, options, value, onChange }) {
  return (
    <View style={styles.optionGroup}>
      <Text style={styles.optionLabel}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map((option) => {
          const optionLabel = typeof option === "string" ? option : option.label;
          const optionValue = typeof option === "string" ? option : option.value;

          return (
          <SecondaryButton
            key={optionValue}
            title={optionLabel}
            icon={optionValue === value ? "check" : undefined}
            onPress={() => onChange(optionValue)}
            style={[styles.optionButton, optionValue === value && styles.optionButtonActive]}
          />
          );
        })}
      </View>
    </View>
  );
}

export default function GameSession() {
  const [sessionType, setSessionType] = useState(sessionTypes[0].value);
  const [timeControl, setTimeControl] = useState(timeControls[0]);
  const [color, setColor] = useState(colors[0]);
  const [result, setResult] = useState(results[0]);
  const [opponent, setOpponent] = useState("");
  const [moves, setMoves] = useState([]);
  const [manualMove, setManualMove] = useState("");
  const [savedGame, setSavedGame] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [puzzleCount, setPuzzleCount] = useState(null);
  const [coachFeedback, setCoachFeedback] = useState("");
  const [busyAction, setBusyAction] = useState(null);

  const game = useMemo(() => createGameFromMoves(moves), [moves]);
  const fen = game.fen();
  const pgn = buildPgn({ moves, sessionType, timeControl, color, result, opponent });
  const legalMoves = game.moves({ verbose: true });

  const addMove = (move) => {
    const nextGame = createGameFromMoves(moves);
    const playedMove = nextGame.move({
      from: move.slice(0, 2),
      to: move.slice(2, 4),
      promotion: move.length > 4 ? move[4] : "q",
    });

    if (!playedMove) {
      Alert.alert("Illegal move", "That move is not legal in the current position.");
      return;
    }

    setMoves((current) => [...current, move.toLowerCase()]);
    setManualMove("");
    setSavedGame(null);
    setAnalysis(null);
    setPuzzleCount(null);
    setCoachFeedback("");
  };

  const undoMove = () => {
    setMoves((current) => current.slice(0, -1));
  };

  const resetSession = () => {
    setMoves([]);
    setManualMove("");
    setSavedGame(null);
    setAnalysis(null);
    setPuzzleCount(null);
    setCoachFeedback("");
  };

  const saveGame = async () => {
    if (moves.length === 0) {
      Alert.alert("No moves recorded", "Play or record at least one move before saving PGN.");
      return null;
    }

    try {
      setBusyAction("save");
      const response = await api.post("/games/upload-pgn", {
        source: `training-session:${sessionType}`,
        opponent: opponent || "Training Opponent",
        color_played: color.toLowerCase(),
        result,
        time_control: timeControl,
        pgn,
      });

      setSavedGame(response.data);
      return response.data;
    } catch (error) {
      Alert.alert("Save failed", error.response?.data?.detail || "Could not save this PGN.");
      return null;
    } finally {
      setBusyAction(null);
    }
  };

  const analyzeSavedGame = async (gameToAnalyze = savedGame) => {
    if (!gameToAnalyze) {
      return null;
    }

    try {
      setBusyAction("analysis");
      const response = await api.post(`/analysis/${gameToAnalyze.id}`);
      setAnalysis(response.data);
      return response.data;
    } catch (error) {
      Alert.alert("Analysis failed", error.response?.data?.detail || "Could not analyze this game.");
      return null;
    } finally {
      setBusyAction(null);
    }
  };

  const generateTraining = async (gameToUse = savedGame) => {
    if (!gameToUse) {
      return;
    }

    try {
      setBusyAction("training");
      const [puzzlesResponse, feedbackResponse] = await Promise.all([
        api.post(`/puzzles/from-game/${gameToUse.id}`),
        api.get("/coach/feedback"),
      ]);

      setPuzzleCount(puzzlesResponse.data?.length || 0);
      setCoachFeedback(feedbackResponse.data?.message || feedbackResponse.data?.feedback || "");
    } catch (error) {
      Alert.alert(
        "Training generation failed",
        error.response?.data?.detail || "Could not generate follow-up training."
      );
    } finally {
      setBusyAction(null);
    }
  };

  const runFullPipeline = async () => {
    const gameRecord = savedGame || await saveGame();
    if (!gameRecord) {
      return;
    }

    const analysisRecord = analysis || await analyzeSavedGame(gameRecord);
    if (!analysisRecord) {
      return;
    }

    await generateTraining(gameRecord);
  };

  return (
    <AppShell
      showBack
      eyebrow="Game Session"
      title="Training game workspace."
      subtitle="Start a game, choose the session setup, record moves, save PGN, then turn the game into analysis and training."
    >
      <View style={styles.statsRow}>
        <StatPill icon="chess-pawn" value={moves.length} label="plies" tone="gold" />
        <StatPill icon="clock-outline" value={timeControl} label="time" tone="sage" />
      </View>

      <SectionHeader label="Session Setup" />
      <PremiumPanel style={styles.setupPanel}>
        <SegmentedOptions label="Session type" options={sessionTypes} value={sessionType} onChange={setSessionType} />
        <SegmentedOptions label="Time control" options={timeControls} value={timeControl} onChange={setTimeControl} />
        <SegmentedOptions label="Color" options={colors} value={color} onChange={setColor} />
        <SegmentedOptions label="Result" options={results} value={result} onChange={setResult} />
        <TextInput
          style={uiStyles.input}
          placeholder="Opponent or focus note"
          placeholderTextColor={palette.muted}
          value={opponent}
          onChangeText={setOpponent}
        />
      </PremiumPanel>

      <SectionHeader label="Play Or Record Moves" />
      <PremiumPanel style={styles.boardPanel}>
        <View style={styles.boardWrap}>
          <ChessboardWithArrows
            fen={fen}
            boardSize={300}
            withLetters
            withNumbers
            onMove={addMove}
          />
        </View>
        <Text style={styles.sideText}>{game.turn() === "w" ? "White" : "Black"} to move</Text>
        <View style={styles.manualRow}>
          <TextInput
            style={[uiStyles.input, styles.manualInput]}
            placeholder="Record UCI move, e.g. e2e4"
            placeholderTextColor={palette.muted}
            value={manualMove}
            autoCapitalize="none"
            onChangeText={setManualMove}
          />
          <PrimaryButton title="Add" icon="plus" onPress={() => addMove(manualMove.trim())} />
        </View>
        <View style={styles.actionRow}>
          <SecondaryButton title="Undo" icon="undo" onPress={undoMove} disabled={moves.length === 0} style={styles.actionButton} />
          <SecondaryButton title="New session" icon="refresh" onPress={resetSession} style={styles.actionButton} />
        </View>
        <Text style={styles.legalText}>
          Legal moves: {legalMoves.slice(0, 16).map((move) => move.san).join(", ")}
        </Text>
      </PremiumPanel>

      <SectionHeader label="Final PGN" />
      <PremiumPanel style={styles.pgnPanel}>
        <Text style={styles.pgnText} selectable>{pgn || "Play a move to build PGN."}</Text>
      </PremiumPanel>

      <SectionHeader label="Analyze And Generate Training" />
      <PremiumPanel dark style={styles.pipelinePanel}>
        <PrimaryButton
          title={busyAction === "save" ? "Saving..." : "Save final PGN"}
          icon="content-save"
          tone="light"
          onPress={saveGame}
          disabled={!!busyAction}
        />
        <PrimaryButton
          title={busyAction === "analysis" ? "Analyzing..." : "Analyze game"}
          icon="chart-timeline-variant"
          tone="light"
          onPress={() => analyzeSavedGame()}
          disabled={!!busyAction || !savedGame}
        />
        <PrimaryButton
          title={busyAction === "training" ? "Generating..." : "Generate mistakes, puzzles, weaknesses, coach feedback"}
          icon="auto-fix"
          tone="light"
          onPress={runFullPipeline}
          disabled={!!busyAction}
        />

        {savedGame ? <Text style={styles.pipelineText}>Saved game id: {savedGame.id}</Text> : null}
        {analysis ? (
          <Text style={styles.pipelineText}>
            Analysis: {analysis.accuracy}% accuracy, {analysis.mistakes} mistakes, {analysis.blunders} blunders
          </Text>
        ) : null}
        {puzzleCount !== null ? <Text style={styles.pipelineText}>Generated puzzles: {puzzleCount}</Text> : null}
        {coachFeedback ? <Text style={styles.pipelineText}>{coachFeedback}</Text> : null}
      </PremiumPanel>
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
  setupPanel: {
    gap: 14,
    marginBottom: 16,
  },
  optionGroup: {
    gap: 8,
  },
  optionLabel: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionButton: {
    flexGrow: 1,
    minWidth: 118,
  },
  optionButtonActive: {
    borderColor: palette.gold,
  },
  boardPanel: {
    gap: 12,
    marginBottom: 16,
  },
  boardWrap: {
    alignItems: "center",
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
  },
  sideText: {
    color: palette.goldSoft,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  manualRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  manualInput: {
    flex: 1,
    minWidth: 190,
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
  legalText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  pgnPanel: {
    marginBottom: 16,
  },
  pgnText: {
    color: palette.mutedDark,
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 18,
  },
  pipelinePanel: {
    gap: 10,
  },
  pipelineText: {
    color: palette.mutedDark,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
});
