import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
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
const playModes = [
  { label: "AI opponent", value: "ai" },
  { label: "Training game", value: "training" },
  { label: "Record PGN", value: "record" },
];
const aiLevels = [
  { label: "Calm", value: "calm" },
  { label: "Sharp", value: "sharp" },
  { label: "Coach", value: "coach" },
];

const pieceValues = {
  p: 1,
  n: 3,
  b: 3.2,
  r: 5,
  q: 9,
  k: 0,
};

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

function getHistory(moves) {
  return createGameFromMoves(moves).history({ verbose: true });
}

function evaluateMaterial(game) {
  return game.board().flat().reduce((score, piece) => {
    if (!piece) {
      return score;
    }

    const value = pieceValues[piece.type] || 0;
    return piece.color === "w" ? score + value : score - value;
  }, 0);
}

function chooseAiMove(game, level) {
  const legalMoves = game.moves({ verbose: true });

  if (legalMoves.length === 0) {
    return null;
  }

  const scoredMoves = legalMoves
    .map((move) => {
      const nextGame = new Chess(game.fen());
      nextGame.move(move);
      const material = evaluateMaterial(nextGame);
      const captureBonus = move.captured ? pieceValues[move.captured] || 0 : 0;
      const checkBonus = move.san.includes("+") ? 0.18 : 0;
      const mateBonus = move.san.includes("#") ? 100 : 0;
      const side = move.color === "w" ? 1 : -1;

      return {
        move,
        score: material * side + captureBonus + checkBonus + mateBonus,
      };
    })
    .sort((a, b) => b.score - a.score);

  const poolSize = level === "calm" ? 5 : level === "sharp" ? 3 : 2;
  const pool = scoredMoves.slice(0, Math.min(poolSize, scoredMoves.length));
  const pick = pool[Math.floor(Math.random() * pool.length)];

  return pick?.move || legalMoves[0];
}

function parseTimeControl(timeControl) {
  if (timeControl === "Classical") {
    return { baseSeconds: 90 * 60, incrementSeconds: 30 };
  }

  const [minutes, increment] = timeControl.split("+").map((value) => Number(value));
  return {
    baseSeconds: Number.isFinite(minutes) ? minutes * 60 : 10 * 60,
    incrementSeconds: Number.isFinite(increment) ? increment : 0,
  };
}

function formatClock(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getGameResult(game, fallbackResult) {
  if (fallbackResult !== "*") {
    return fallbackResult;
  }

  if (game.in_checkmate()) {
    return game.turn() === "w" ? "0-1" : "1-0";
  }

  if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition() || game.insufficient_material()) {
    return "1/2-1/2";
  }

  return fallbackResult;
}

function describeStatus(game, result, playMode, playerColor) {
  if (result !== "*") {
    if (result === "1/2-1/2") {
      return "Game drawn.";
    }

    return result === "1-0" ? "White wins." : "Black wins.";
  }

  if (game.in_checkmate()) {
    return game.turn() === "w" ? "Checkmate. Black wins." : "Checkmate. White wins.";
  }

  if (game.in_stalemate()) {
    return "Stalemate.";
  }

  if (game.in_draw()) {
    return "Draw.";
  }

  const side = game.turn() === "w" ? "White" : "Black";
  const actor = playMode !== "record" && game.turn() !== playerColor ? "AI" : side;

  return `${actor} to move${game.in_check() ? " - check" : ""}.`;
}

function buildCoachingNote(history, game) {
  const lastMove = history[history.length - 1];

  if (!lastMove) {
    return "Develop pieces, contest the center, and castle before the position gets sharp.";
  }

  if (lastMove.san.includes("#")) {
    return "That finished the game. Review the final forcing sequence while it is fresh.";
  }

  if (lastMove.san.includes("+")) {
    return `${lastMove.san} gives check. Look for the forcing reply before playing quickly.`;
  }

  if (lastMove.captured) {
    return `${lastMove.san} changed the material balance. Recount captures and check loose pieces.`;
  }

  if (game.in_check()) {
    return "You are in check. List every legal response, then choose the one that improves the position most.";
  }

  if (history.length < 12) {
    return "Opening phase: finish development and keep your king safe before hunting tactics.";
  }

  return "Pause for candidate moves: forcing checks, captures, threats, then quieter improving moves.";
}

function buildMistakeSignal(moves, playerColor) {
  const history = getHistory(moves);
  const lastPlayerMoveIndex = [...history].reverse().findIndex((move) => move.color === playerColor);

  if (lastPlayerMoveIndex < 0) {
    return null;
  }

  const moveIndex = history.length - 1 - lastPlayerMoveIndex;
  const beforeGame = new Chess();
  history.slice(0, moveIndex).forEach((move) => beforeGame.move(move.san, { sloppy: true }));
  const beforeEval = evaluateMaterial(beforeGame);
  beforeGame.move(history[moveIndex].san, { sloppy: true });
  const afterEval = evaluateMaterial(beforeGame);
  const swing = playerColor === "w" ? afterEval - beforeEval : beforeEval - afterEval;

  if (swing <= -3) {
    return { label: "Blunder risk", tone: "high", detail: "Material dropped sharply. This is a good review target." };
  }

  if (swing <= -1) {
    return { label: "Mistake candidate", tone: "medium", detail: "The position got worse materially. Check the tactic." };
  }

  if (swing < 0) {
    return { label: "Inaccuracy candidate", tone: "low", detail: "Small concession. Ask what improved for the opponent." };
  }

  return { label: "Stable", tone: "stable", detail: "No obvious material mistake detected locally." };
}

function buildPgn({ moves, sessionType, timeControl, color, playerColor, result, opponent }) {
  const game = createGameFromMoves(moves);
  const sessionLabel = sessionTypes.find((type) => type.value === sessionType)?.label || sessionType;
  const resolvedPlayerColor = color === "Random" ? playerColor : color === "Black" ? "b" : "w";
  const white = resolvedPlayerColor === "b" ? opponent || "Training Opponent" : "Chess Coach Player";
  const black = resolvedPlayerColor === "b" ? "Chess Coach Player" : opponent || "Training Opponent";

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
  const [playMode, setPlayMode] = useState(playModes[0].value);
  const [sessionType, setSessionType] = useState(sessionTypes[0].value);
  const [timeControl, setTimeControl] = useState(timeControls[0]);
  const [color, setColor] = useState(colors[0]);
  const [playerColor, setPlayerColor] = useState("w");
  const [aiLevel, setAiLevel] = useState(aiLevels[1].value);
  const [result, setResult] = useState(results[0]);
  const [opponent, setOpponent] = useState("");
  const [moves, setMoves] = useState([]);
  const [manualMove, setManualMove] = useState("");
  const [savedGame, setSavedGame] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [puzzleCount, setPuzzleCount] = useState(null);
  const [trainingFocus, setTrainingFocus] = useState(null);
  const [coachFeedback, setCoachFeedback] = useState("");
  const [busyAction, setBusyAction] = useState(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [clock, setClock] = useState(() => {
    const { baseSeconds } = parseTimeControl(timeControls[0]);
    return { w: baseSeconds, b: baseSeconds };
  });
  const [gameStarted, setGameStarted] = useState(false);
  const [lastAiMove, setLastAiMove] = useState(null);

  const game = useMemo(() => createGameFromMoves(moves), [moves]);
  const fen = game.fen();
  const finalResult = getGameResult(game, result);
  const pgn = buildPgn({ moves, sessionType, timeControl, color, playerColor, result: finalResult, opponent });
  const legalMoves = game.moves({ verbose: true });
  const history = useMemo(() => getHistory(moves), [moves]);
  const movePairs = [];
  for (let index = 0; index < history.length; index += 2) {
    movePairs.push({
      number: index / 2 + 1,
      white: history[index]?.san || "",
      black: history[index + 1]?.san || "",
    });
  }
  const { baseSeconds, incrementSeconds } = useMemo(() => parseTimeControl(timeControl), [timeControl]);
  const gameOver = finalResult !== "*" || game.game_over();
  const statusText = describeStatus(game, finalResult, playMode, playerColor);
  const coachingNote = coachFeedback || buildCoachingNote(history, game);
  const mistakeSignal = buildMistakeSignal(moves, playerColor);

  const addMove = useCallback((move, options = {}) => {
    if (gameOver) {
      Alert.alert("Game over", "Start a new session to play more moves.");
      return;
    }

    if (playMode !== "record" && options.source !== "ai" && game.turn() !== playerColor) {
      Alert.alert("AI to move", "Press Start game if you are playing Black, or wait for the AI reply.");
      return;
    }

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

    setGameStarted(true);
    setMoves((current) => [...current, move.toLowerCase()]);
    setClock((current) => ({
      ...current,
      [playedMove.color]: current[playedMove.color] + incrementSeconds,
    }));
    setLastAiMove(options.source === "ai" ? `${playedMove.from}${playedMove.to}` : null);
    setManualMove("");
    setSavedGame(null);
    setAnalysis(null);
    setPuzzleCount(null);
    setTrainingFocus(null);
    if (options.source !== "ai") {
      setCoachFeedback("");
    }
  }, [game, gameOver, incrementSeconds, moves, playerColor, playMode]);

  useEffect(() => {
    if (moves.length > 0) {
      return;
    }

    if (color === "Black") {
      setPlayerColor("b");
    } else if (color === "White") {
      setPlayerColor("w");
    } else {
      setPlayerColor(Math.random() > 0.5 ? "w" : "b");
    }
  }, [color, moves.length]);

  useEffect(() => {
    if (moves.length > 0) {
      return;
    }

    setClock({ w: baseSeconds, b: baseSeconds });
  }, [baseSeconds, moves.length]);

  useEffect(() => {
    if (!gameStarted || gameOver || playMode === "record") {
      return undefined;
    }

    const timer = setInterval(() => {
      const side = game.turn();
      setClock((current) => {
        const nextValue = Math.max(0, current[side] - 1);

        if (nextValue === 0) {
          setResult(side === "w" ? "0-1" : "1-0");
        }

        return { ...current, [side]: nextValue };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [game, gameOver, gameStarted, playMode]);

  useEffect(() => {
    if (!gameStarted || gameOver || playMode === "record" || game.turn() === playerColor) {
      setAiThinking(false);
      return undefined;
    }

    let cancelled = false;
    const aiFen = game.fen();
    const level = playMode === "training" ? "coach" : aiLevel;
    const timer = setTimeout(() => {
      const playAiMove = async () => {
        setAiThinking(true);
        let uciMove = null;

        try {
          const response = await api.post("/board/best-move", {
            fen: aiFen,
            level,
          });
          uciMove = response.data?.move;
        } catch (error) {
          console.log(error.response?.data || error.message);
          const fallbackMove = chooseAiMove(game, level);
          uciMove = fallbackMove ? `${fallbackMove.from}${fallbackMove.to}${fallbackMove.promotion || ""}` : null;
        }

        if (!cancelled && uciMove) {
          addMove(uciMove, { source: "ai" });
        }

        if (!cancelled) {
          setAiThinking(false);
        }
      };

      void playAiMove();
    }, playMode === "training" ? 850 : 520);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setAiThinking(false);
    };
  }, [addMove, aiLevel, game, gameOver, gameStarted, playerColor, playMode]);

  const undoMove = () => {
    setMoves((current) => {
      if (playMode === "record") {
        return current.slice(0, -1);
      }

      return current.slice(0, Math.max(0, current.length - 2));
    });
    setResult("*");
    setLastAiMove(null);
  };

  const startGame = () => {
    setGameStarted(true);
  };

  const resetSession = () => {
    const nextPlayerColor = color === "Black" ? "b" : color === "White" ? "w" : Math.random() > 0.5 ? "w" : "b";

    setPlayerColor(nextPlayerColor);
    setMoves([]);
    setManualMove("");
    setSavedGame(null);
    setAnalysis(null);
    setPuzzleCount(null);
    setTrainingFocus(null);
    setCoachFeedback("");
    setResult("*");
    setClock({ w: baseSeconds, b: baseSeconds });
    setGameStarted(false);
    setLastAiMove(null);
  };

  const resign = () => {
    const losingColor = playMode === "record" ? game.turn() : playerColor;
    setResult(losingColor === "w" ? "0-1" : "1-0");
    setGameStarted(false);
  };

  const offerDraw = () => {
    setResult("1/2-1/2");
    setGameStarted(false);
  };

  const exportPgn = async () => {
    try {
      await Share.share({
        title: "Chess Coach PGN",
        message: pgn,
      });
    } catch (error) {
      Alert.alert("Export failed", error.message || "Could not share this PGN.");
    }
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
        opponent: opponent || (playMode === "record" ? "Training Opponent" : "Chess Coach AI"),
        color_played: playerColor === "w" ? "white" : "black",
        result: finalResult,
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
      setTrainingFocus(response.data.personalized_training_focus || null);
      if (typeof response.data.generated_puzzles === "number") {
        setPuzzleCount(response.data.generated_puzzles);
      }
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

      const generatedCount = puzzlesResponse.data?.length || 0;
      setPuzzleCount((current) => generatedCount || current || 0);
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
      title="Play, save, analyze."
      subtitle="Play against the coach AI, run a training game, export PGN, then turn mistakes into follow-up work."
    >
      <View style={styles.statsRow}>
        <StatPill icon="timer-outline" value={formatClock(clock.w)} label="white clock" tone="gold" />
        <StatPill icon="timer" value={formatClock(clock.b)} label="black clock" tone="sage" />
        <StatPill icon="chess-pawn" value={moves.length} label="plies" tone="wine" />
      </View>

      <SectionHeader label="Session Setup" />
      <PremiumPanel style={styles.setupPanel}>
        <SegmentedOptions label="Mode" options={playModes} value={playMode} onChange={setPlayMode} />
        <SegmentedOptions label="Session type" options={sessionTypes} value={sessionType} onChange={setSessionType} />
        <SegmentedOptions label="Time control" options={timeControls} value={timeControl} onChange={setTimeControl} />
        <SegmentedOptions label="Color" options={colors} value={color} onChange={setColor} />
        {playMode !== "record" ? (
          <SegmentedOptions label="AI level" options={aiLevels} value={aiLevel} onChange={setAiLevel} />
        ) : null}
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
        <View style={styles.statusPanel}>
          <Text style={styles.statusText}>{statusText}</Text>
          <Text style={styles.statusMeta}>
            You are {playerColor === "w" ? "White" : "Black"}{playMode === "record" ? " in PGN recording mode." : aiThinking ? " against Stockfish. AI is thinking." : " against Stockfish."}
          </Text>
        </View>
        <View style={styles.boardWrap}>
          <ChessboardWithArrows
            fen={fen}
            boardSize={300}
            withLetters
            withNumbers
            onMove={addMove}
            arrows={lastAiMove ? [{ from: lastAiMove.slice(0, 2), to: lastAiMove.slice(2, 4), color: "rgba(46, 125, 136, 0.82)" }] : []}
          />
        </View>
        <Text style={styles.sideText}>{game.in_check() ? "Check on the board" : "Legal moves enforced"}</Text>
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
          <PrimaryButton title="Start game" icon="play" onPress={startGame} disabled={gameStarted || moves.length > 0 || playMode === "record"} style={styles.actionButton} />
          <SecondaryButton title="Undo" icon="undo" onPress={undoMove} disabled={moves.length === 0} style={styles.actionButton} />
          <SecondaryButton title="Draw" icon="handshake" onPress={offerDraw} disabled={gameOver && finalResult !== "*"} style={styles.actionButton} />
          <SecondaryButton title="Resign" icon="flag" onPress={resign} disabled={gameOver && finalResult !== "*"} style={styles.actionButton} />
          <SecondaryButton title="New session" icon="refresh" onPress={resetSession} style={styles.actionButton} />
        </View>
        <Text style={styles.legalText}>
          Legal moves: {legalMoves.slice(0, 16).map((move) => move.san).join(", ")}
        </Text>
      </PremiumPanel>

      <SectionHeader label="Game History" />
      <PremiumPanel style={styles.historyPanel}>
        {movePairs.length === 0 ? (
          <Text style={styles.mutedText}>No moves yet.</Text>
        ) : (
          movePairs.map((pair) => (
            <View key={pair.number} style={styles.historyRow}>
              <Text style={styles.historyNumber}>{pair.number}.</Text>
              <Text style={styles.historyMove}>{pair.white}</Text>
              <Text style={styles.historyMove}>{pair.black}</Text>
            </View>
          ))
        )}
      </PremiumPanel>

      <SectionHeader label="Coaching" />
      <PremiumPanel dark style={styles.coachPanel}>
        {mistakeSignal ? (
          <View style={styles.mistakeLine}>
            <Text style={styles.mistakeLabel}>{mistakeSignal.label}</Text>
            <Text style={styles.pipelineText}>{mistakeSignal.detail}</Text>
          </View>
        ) : null}
        <Text style={styles.pipelineText}>{coachingNote}</Text>
      </PremiumPanel>

      <SectionHeader label="Final PGN" />
      <PremiumPanel style={styles.pgnPanel}>
        <Text style={styles.pgnText} selectable>{pgn || "Play a move to build PGN."}</Text>
        <SecondaryButton title="Export PGN" icon="share-variant" onPress={exportPgn} disabled={moves.length === 0} style={styles.exportButton} />
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
            Analysis: {analysis.accuracy}% accuracy, {analysis.blunders} blunders, {analysis.mistakes} mistakes, {analysis.best_moves_found} best moves
          </Text>
        ) : null}
        {puzzleCount !== null ? <Text style={styles.pipelineText}>Generated puzzles: {puzzleCount}</Text> : null}
        {trainingFocus?.message ? <Text style={styles.pipelineText}>{trainingFocus.message}</Text> : null}
        {coachFeedback ? <Text style={styles.pipelineText}>{coachFeedback}</Text> : null}
        {savedGame ? (
          <SecondaryButton
            title="Open move-by-move review"
            icon="clipboard-text-search"
            onPress={() => router.push({ pathname: "/game-detail", params: { id: savedGame.id } })}
          />
        ) : null}
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
  statusPanel: {
    backgroundColor: "rgba(15,17,21,0.72)",
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  statusText: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "900",
  },
  statusMeta: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
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
  historyPanel: {
    gap: 7,
    marginBottom: 16,
  },
  historyRow: {
    alignItems: "center",
    borderBottomColor: "rgba(255,255,255,0.08)",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 32,
    paddingBottom: 7,
  },
  historyNumber: {
    color: palette.gold,
    fontSize: 13,
    fontWeight: "900",
    width: 34,
  },
  historyMove: {
    color: palette.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  coachPanel: {
    gap: 10,
    marginBottom: 16,
  },
  mistakeLine: {
    borderBottomColor: "rgba(255,255,255,0.1)",
    borderBottomWidth: 1,
    gap: 5,
    paddingBottom: 10,
  },
  mistakeLabel: {
    color: palette.gold,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  mutedText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  pgnPanel: {
    gap: 12,
    marginBottom: 16,
  },
  pgnText: {
    color: palette.mutedDark,
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 18,
  },
  exportButton: {
    alignSelf: "flex-start",
    minWidth: 150,
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
