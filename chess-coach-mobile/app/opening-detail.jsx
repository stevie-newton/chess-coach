import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Speech from "expo-speech";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Chess } from "chess.js";
import {
  AppShell,
  PremiumPanel,
  PrimaryButton,
  SectionHeader,
  StatPill,
  palette,
} from "../src/components/PremiumUI";
import ChessboardWithArrows from "../src/components/ChessboardWithArrows";
import { openingDetails } from "../src/data/openingLibrary";
import { buildEngineLineAnalysis, formatEngineEval } from "../src/utils/engineAnalysis";
import {
  getSavedRepertoire,
  recordOpeningMistake,
  recordOpeningSuccess,
  toggleSavedOpening,
} from "../src/utils/repertoireStorage";

function flattenMainLine(mainLine) {
  return mainLine.flatMap((line) =>
    line
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean)
      .filter((token) => !/^\d+\.+$/.test(token))
  );
}

function createPositionFromSans(sans) {
  const chess = new Chess();
  const played = [];

  sans.forEach((san) => {
    const move = chess.move(san, { sloppy: true });
    if (move) {
      played.push({
        san: move.san,
        uci: `${move.from}${move.to}${move.promotion || ""}`,
        from: move.from,
        to: move.to,
      });
    }
  });

  return {
    fen: chess.fen(),
    played,
  };
}

function firstTrapForOpening(opening) {
  if (opening.commonTraps?.length) {
    return opening.commonTraps[0];
  }

  return {
    name: opening.traps?.[0] || "Opening trap",
    setup: "Watch how one careless move can change the position.",
    payoff: "The key is to connect the tactical idea with the opening plan.",
    moves: flattenMainLine(opening.mainLine),
  };
}

function sanForMove(fen, uci) {
  try {
    const chess = new Chess(fen);
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : "q",
    });

    return move?.san || uci;
  } catch {
    return uci;
  }
}

function explainWrongMove({ opening, plyIndex, expectedMove, userMove, fen }) {
  const userSan = sanForMove(fen, userMove);
  const expectedExplanation = opening.moveExplanations?.[plyIndex] || `${expectedMove.san} is the prepared move in this line.`;

  return `Incorrect.\n\n${userSan} is not the move for this position.\n${expectedMove.san} is better: ${expectedExplanation}`;
}

function moveToSquares(move) {
  const normalized = move?.trim().toLowerCase();
  if (!normalized || normalized.length < 4) {
    return null;
  }

  return {
    from: normalized.slice(0, 2),
    to: normalized.slice(2, 4),
  };
}

function legalAttackArrows(fen, limit = 12) {
  try {
    const chess = new Chess(fen);
    const color = chess.turn();
    const arrowColor = color === "w" ? "rgba(30, 142, 84, 0.46)" : "rgba(201, 90, 106, 0.46)";

    return chess.moves({ verbose: true })
      .slice(0, limit)
      .map((move, index) => ({
        from: move.from,
        to: move.to,
        color: arrowColor,
        id: `attack-${index}-${move.from}-${move.to}`,
      }));
  } catch {
    return [];
  }
}

function colorToTurn(color) {
  return color?.toLowerCase() === "black" ? "b" : "w";
}

function turnForPly(plyIndex) {
  return plyIndex % 2 === 0 ? "w" : "b";
}

function DetailList({ items, icon = "check-circle-outline" }) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View key={item} style={styles.listRow}>
          <MaterialCommunityIcons name={icon} size={18} color={palette.gold} />
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function AudioVisualTeaching({ opening }) {
  const { width } = useWindowDimensions();
  const lineSans = useMemo(() => flattenMainLine(opening.mainLine), [opening.mainLine]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showAttacks, setShowAttacks] = useState(false);
  const boardSize = Math.max(220, Math.min(300, width - 74));
  const position = useMemo(() => createPositionFromSans(lineSans.slice(0, step)), [lineSans, step]);
  const lastMove = position.played[position.played.length - 1];
  const lastMoveSquares = moveToSquares(lastMove?.uci);
  const explanation = step === 0
    ? opening.overview
    : opening.moveExplanations?.[step - 1] || `${lastMove?.san || "This move"} follows the opening plan.`;
  const arrows = [];
  const highlights = [
    {
      square: "d4",
      color: "rgba(30, 142, 84, 0.16)",
      borderColor: "rgba(30, 142, 84, 0.5)",
      id: "center-d4",
    },
    {
      square: "e4",
      color: "rgba(30, 142, 84, 0.16)",
      borderColor: "rgba(30, 142, 84, 0.5)",
      id: "center-e4",
    },
    {
      square: "d5",
      color: "rgba(30, 142, 84, 0.16)",
      borderColor: "rgba(30, 142, 84, 0.5)",
      id: "center-d5",
    },
    {
      square: "e5",
      color: "rgba(30, 142, 84, 0.16)",
      borderColor: "rgba(30, 142, 84, 0.5)",
      id: "center-e5",
    },
  ];

  if (lastMoveSquares) {
    arrows.push({
      ...lastMoveSquares,
      id: "teaching-last-move",
      color: "rgba(215, 179, 90, 0.78)",
    });
    highlights.push(
      {
        square: lastMoveSquares.from,
        color: "rgba(215, 179, 90, 0.18)",
        borderColor: "rgba(215, 179, 90, 0.62)",
        id: "teaching-from",
      },
      {
        square: lastMoveSquares.to,
        color: "rgba(215, 179, 90, 0.26)",
        borderColor: "rgba(215, 179, 90, 0.82)",
        id: "teaching-to",
      }
    );
  }

  if (showAttacks) {
    arrows.push(...legalAttackArrows(position.fen));
  }

  useEffect(() => {
    if (!playing) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setStep((current) => {
        if (current >= lineSans.length) {
          setPlaying(false);
          return current;
        }

        return current + 1;
      });
    }, step === 0 ? 450 : 1050);

    return () => clearTimeout(timer);
  }, [lineSans.length, playing, step]);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const speakExplanation = () => {
    Speech.stop();
    Speech.speak(explanation, {
      pitch: 1,
      rate: 0.92,
    });
  };

  const resetLesson = () => {
    Speech.stop();
    setPlaying(false);
    setStep(0);
  };

  const nextStep = () => {
    setPlaying(false);
    setStep((current) => Math.min(lineSans.length, current + 1));
  };

  return (
    <PremiumPanel dark style={styles.teachingPanel}>
      <View style={styles.trainerTopLine}>
        <Text style={styles.panelLabel}>Audio / Visual Teaching</Text>
        <Text style={styles.trainerStep}>{step}/{lineSans.length}</Text>
      </View>
      <Text style={styles.bodyText}>
        Listen to the lesson, watch the move arrow, study highlighted center squares, and turn on attack visualization for the current position.
      </Text>

      <View style={styles.boardWrap}>
        <ChessboardWithArrows
          fen={position.fen}
          boardSize={boardSize}
          withLetters
          withNumbers
          arrows={arrows}
          highlights={highlights}
        />
      </View>

      <View style={styles.teachingExplanation}>
        <Text style={styles.teachingMove}>{lastMove ? `Move: ${lastMove.san}` : "Starting position"}</Text>
        <Text style={styles.bodyText}>{explanation}</Text>
      </View>

      <View style={styles.teachingControls}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setPlaying((current) => !current)}
          style={({ pressed }) => [styles.teachingButton, pressed && styles.quizOptionPressed]}
        >
          <MaterialCommunityIcons name={playing ? "pause" : "play"} size={20} color={palette.goldSoft} />
          <Text style={styles.teachingButtonText}>{playing ? "Pause" : "Play"}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={nextStep}
          style={({ pressed }) => [styles.teachingButton, pressed && styles.quizOptionPressed]}
        >
          <MaterialCommunityIcons name="step-forward" size={20} color={palette.goldSoft} />
          <Text style={styles.teachingButtonText}>Next</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={speakExplanation}
          style={({ pressed }) => [styles.teachingButton, pressed && styles.quizOptionPressed]}
        >
          <MaterialCommunityIcons name="volume-high" size={20} color={palette.goldSoft} />
          <Text style={styles.teachingButtonText}>Voice</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowAttacks((current) => !current)}
          style={({ pressed }) => [
            styles.teachingButton,
            showAttacks && styles.teachingButtonActive,
            pressed && styles.quizOptionPressed,
          ]}
        >
          <MaterialCommunityIcons name="target" size={20} color={palette.goldSoft} />
          <Text style={styles.teachingButtonText}>Attacks</Text>
        </Pressable>
      </View>

      <PrimaryButton
        title="Restart lesson"
        icon="restart"
        tone="light"
        onPress={resetLesson}
      />
    </PremiumPanel>
  );
}

function FamousGames({ games }) {
  return (
    <View style={styles.legendaryGames}>
      {games.map((game) => (
        <View key={`${game.player}-${game.game}`} style={styles.legendaryGameCard}>
          <View style={styles.legendaryGameHeader}>
            <View style={styles.legendaryIcon}>
              <MaterialCommunityIcons name="trophy-outline" size={20} color={palette.goldSoft} />
            </View>
            <View style={styles.legendaryGameTitleWrap}>
              <Text style={styles.legendaryPlayer}>{game.player}</Text>
              <Text style={styles.legendaryGameTitle}>{game.game}</Text>
            </View>
          </View>
          <Text style={styles.legendaryMeta}>
            {game.event} - {game.year}
          </Text>
          <Text style={styles.legendaryLesson}>{game.lesson}</Text>
        </View>
      ))}
    </View>
  );
}

function OpeningQuiz({ openingName, questions }) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [score, setScore] = useState(0);
  const question = questions[questionIndex];
  const answered = Boolean(selectedAnswer);
  const isCorrect = selectedAnswer === question.answer;

  const handleAnswer = (option) => {
    if (answered) {
      return;
    }

    setSelectedAnswer(option);
    if (option === question.answer) {
      setScore((current) => current + 1);
      recordOpeningSuccess(openingName);
      return;
    }

    recordOpeningMistake(openingName, {
      line: question.prompt,
      variation: "Opening concepts",
    });
  };

  const goNext = () => {
    if (questionIndex >= questions.length - 1) {
      setQuestionIndex(0);
      setSelectedAnswer(null);
      setScore(0);
      return;
    }

    setQuestionIndex((current) => current + 1);
    setSelectedAnswer(null);
  };

  return (
    <PremiumPanel dark style={styles.quizPanel}>
      <View style={styles.trainerTopLine}>
        <Text style={styles.panelLabel}>Opening Quiz</Text>
        <Text style={styles.trainerStep}>{questionIndex + 1}/{questions.length}</Text>
      </View>
      <Text style={styles.quizQuestion}>{question.prompt}</Text>

      <View style={styles.quizOptions}>
        {question.options.map((option) => {
          const correctOption = answered && option === question.answer;
          const wrongOption = answered && option === selectedAnswer && option !== question.answer;

          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              disabled={answered}
              onPress={() => handleAnswer(option)}
              style={({ pressed }) => [
                styles.quizOption,
                pressed && styles.quizOptionPressed,
                correctOption && styles.quizOptionCorrect,
                wrongOption && styles.quizOptionWrong,
              ]}
            >
              <Text style={styles.quizOptionText}>{option}</Text>
              {correctOption ? (
                <MaterialCommunityIcons name="check-circle" size={20} color="#1E8E54" />
              ) : null}
              {wrongOption ? (
                <MaterialCommunityIcons name="close-circle" size={20} color={palette.danger} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {answered ? (
        <View style={styles.quizFeedback}>
          <Text style={isCorrect ? styles.correctText : styles.incorrectText}>
            {isCorrect ? "Correct." : "Incorrect."}
          </Text>
          <Text style={styles.bodyText}>{question.explanation}</Text>
        </View>
      ) : null}

      <View style={styles.quizFooter}>
        <Text style={styles.expectedHint}>Score: {score}/{questions.length}</Text>
        <PrimaryButton
          title={questionIndex >= questions.length - 1 ? "Restart quiz" : "Next question"}
          icon={questionIndex >= questions.length - 1 ? "restart" : "arrow-right"}
          tone="light"
          disabled={!answered}
          onPress={goNext}
        />
      </View>
    </PremiumPanel>
  );
}

function EngineAnalysisPanel({ opening }) {
  const engineLines = useMemo(
    () => buildEngineLineAnalysis(opening.mainLine, opening.moveExplanations),
    [opening.mainLine, opening.moveExplanations]
  );
  const biggestSwing = engineLines
    .filter((line) => line.classification !== "Stable")
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];

  return (
    <PremiumPanel dark style={styles.enginePanel}>
      <View style={styles.trainerTopLine}>
        <Text style={styles.panelLabel}>Stockfish-style analysis</Text>
        <Text style={styles.engineDepth}>Depth 12</Text>
      </View>
      <Text style={styles.bodyText}>
        Compare the evaluation before and after each move. Advanced players can see when a move improves the position or loses evaluation.
      </Text>

      {biggestSwing ? (
        <View style={styles.engineAlert}>
          <MaterialCommunityIcons name="chart-line-variant" size={21} color={palette.danger} />
          <View style={styles.engineAlertText}>
            <Text style={styles.engineAlertTitle}>
              {biggestSwing.san} changes the evaluation from {formatEngineEval(biggestSwing.before)} to {formatEngineEval(biggestSwing.after)}.
            </Text>
            <Text style={styles.engineAlertBody}>
              {biggestSwing.classification}: {biggestSwing.explanation}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.engineMoveList}>
        {engineLines.map((line) => {
          const moveLabel = `${line.moveNumber}.${line.color === "b" ? ".." : ""} ${line.san}`;
          const isProblem = line.classification !== "Stable";

          return (
            <View key={`${line.moveNumber}-${line.color}-${line.san}`} style={styles.engineMoveCard}>
              <View style={styles.engineMoveTop}>
                <Text style={styles.engineMove}>{moveLabel}</Text>
                <Text style={[styles.engineBadge, isProblem && styles.engineBadgeProblem]}>
                  {line.classification}
                </Text>
              </View>
              <View style={styles.engineEvalRow}>
                <Text style={styles.engineEvalText}>Before {formatEngineEval(line.before)}</Text>
                <MaterialCommunityIcons name="arrow-right" size={16} color={palette.gold} />
                <Text style={styles.engineEvalText}>After {formatEngineEval(line.after)}</Text>
              </View>
              <Text style={styles.engineExplanation}>{line.explanation}</Text>
            </View>
          );
        })}
      </View>
    </PremiumPanel>
  );
}

function VariationTree({ openingName, branches }) {
  const [expandedBranch, setExpandedBranch] = useState(branches?.[0]?.name || null);

  return (
    <PremiumPanel style={styles.treePanel}>
      <View style={styles.treeRoot}>
        <MaterialCommunityIcons name="source-branch" size={20} color={palette.gold} />
        <Text style={styles.treeRootText}>{openingName}</Text>
      </View>

      <View style={styles.treeBranches}>
        {branches.map((branch, index) => {
          const expanded = expandedBranch === branch.name;
          const connector = index === branches.length - 1 ? "└──" : "├──";

          return (
            <Pressable
              key={branch.name}
              accessibilityRole="button"
              onPress={() => setExpandedBranch(expanded ? null : branch.name)}
              style={({ pressed }) => [styles.treeBranch, pressed && styles.treeBranchPressed]}
            >
              <View style={styles.treeBranchLine}>
                <Text style={styles.treeConnector}>{connector}</Text>
                <Text style={styles.treeBranchName}>{branch.name}</Text>
                <MaterialCommunityIcons
                  name={expanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={palette.muted}
                />
              </View>
              {expanded ? (
                <View style={styles.treeBranchDetail}>
                  <Text style={styles.treeLine}>{branch.line}</Text>
                  <Text style={styles.treeIdea}>{branch.idea}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </PremiumPanel>
  );
}

function InteractiveOpeningTrainer({ opening, openingName }) {
  const { width } = useWindowDimensions();
  const lineSans = useMemo(() => flattenMainLine(opening.mainLine), [opening.mainLine]);
  const [plyIndex, setPlyIndex] = useState(0);
  const userTurn = colorToTurn(opening.color);
  const [feedback, setFeedback] = useState({
    title: "Ready",
    body: userTurn === "w" ? "Your turn. Play the first move." : "App is ready to play the first move.",
    tone: "neutral",
  });
  const [lastMove, setLastMove] = useState(null);
  const [selectedMove, setSelectedMove] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [correctMoves, setCorrectMoves] = useState(0);
  const [streak, setStreak] = useState(0);
  const [mistakesByPly, setMistakesByPly] = useState({});
  const boardSize = Math.max(220, Math.min(300, width - 74));
  const isComplete = plyIndex >= lineSans.length;
  const waitingForUser = !isComplete && turnForPly(plyIndex) === userTurn;
  const position = useMemo(() => createPositionFromSans(lineSans.slice(0, plyIndex)), [lineSans, plyIndex]);
  const expectedMove = useMemo(() => {
    if (!waitingForUser) {
      return null;
    }

    const nextPosition = createPositionFromSans(lineSans.slice(0, plyIndex + 1));
    return nextPosition.played[nextPosition.played.length - 1] || null;
  }, [lineSans, plyIndex, waitingForUser]);
  const conceptExplanation = opening.moveExplanations?.[plyIndex] || "Focus on development, center control, and king safety in this position.";
  const lastMoveSquares = moveToSquares(lastMove?.uci);
  const selectedSquares = moveToSquares(selectedMove);
  const arrows = [];
  const highlights = [];

  if (lastMoveSquares) {
    arrows.push({
      ...lastMoveSquares,
      id: "opening-trainer-last",
      color: lastMove?.by === "user" ? "rgba(30, 142, 84, 0.84)" : "rgba(215, 179, 90, 0.72)",
    });
  }

  if (selectedSquares) {
    highlights.push(
      {
        square: selectedSquares.from,
        color: "rgba(215, 179, 90, 0.22)",
        borderColor: "rgba(215, 179, 90, 0.78)",
      },
      {
        square: selectedSquares.to,
        color: "rgba(215, 179, 90, 0.28)",
        borderColor: "rgba(215, 179, 90, 0.88)",
      }
    );
  }

  useEffect(() => {
    if (isComplete || waitingForUser) {
      return;
    }

    const timer = setTimeout(() => {
      const nextPosition = createPositionFromSans(lineSans.slice(0, plyIndex + 1));
      const playedMove = nextPosition.played[nextPosition.played.length - 1];

      setLastMove(playedMove ? { ...playedMove, by: "app" } : null);
      setSelectedMove("");
      setFeedback({
        title: "App move",
        body: playedMove ? `App played ${playedMove.san}. Your turn.` : "Your turn.",
        tone: "neutral",
      });
      setPlyIndex((current) => current + 1);
    }, plyIndex === 0 ? 350 : 650);

    return () => clearTimeout(timer);
  }, [isComplete, lineSans, plyIndex, waitingForUser]);

  const resetTrainer = () => {
    setPlyIndex(0);
    setFeedback({
      title: "Ready",
      body: userTurn === "w" ? "Your turn. Play the first move." : "App is ready to play the first move.",
      tone: "neutral",
    });
    setLastMove(null);
    setSelectedMove("");
    setAttempts(0);
    setCorrectMoves(0);
    setStreak(0);
    setMistakesByPly({});
  };

  const handleUserMove = (move) => {
    if (!waitingForUser || !expectedMove) {
      return;
    }

    const normalizedMove = move.toLowerCase();
    setSelectedMove(normalizedMove);
    setAttempts((current) => current + 1);

    if (normalizedMove !== expectedMove.uci) {
      const variationName = opening.variationTree?.[Math.min(Math.floor(plyIndex / 2), opening.variationTree.length - 1)]?.name || "Main line";

      setStreak(0);
      setMistakesByPly((current) => ({
        ...current,
        [plyIndex]: (current[plyIndex] || 0) + 1,
      }));
      recordOpeningMistake(openingName, {
        line: `Move ${Math.floor(plyIndex / 2) + 1}: expected ${expectedMove.san}`,
        variation: variationName,
      });
      setFeedback({
        title: "Incorrect.",
        body: explainWrongMove({
          opening,
          plyIndex,
          expectedMove,
          userMove: normalizedMove,
          fen: position.fen,
        }),
        tone: "danger",
      });
      return;
    }

    setLastMove({ ...expectedMove, by: "user" });
    recordOpeningSuccess(openingName);
    setCorrectMoves((current) => current + 1);
    setStreak((current) => current + 1);
    setFeedback({
      title: "Correct move.",
      body: opening.moveExplanations?.[plyIndex] || `${expectedMove.san} keeps the line on track.`,
      tone: "success",
    });
    setSelectedMove("");
    setPlyIndex((current) => current + 1);
  };

  return (
    <PremiumPanel dark style={styles.trainerPanel}>
      <View style={styles.trainerTopLine}>
        <Text style={styles.panelLabel}>Interactive Board</Text>
        <Text style={styles.trainerStep}>{Math.min(plyIndex + 1, lineSans.length)}/{lineSans.length}</Text>
      </View>
      <Text style={styles.bodyText}>
        Play the next move from memory. The app repeats the theory line and checks each response before continuing.
      </Text>

      <View style={styles.practiceStats}>
        <StatPill icon="counter" value={attempts} label="attempts" tone="gold" />
        <StatPill icon="check-decagram" value={correctMoves} label="correct" tone="sage" />
        <StatPill icon="fire" value={streak} label="streak" tone="wine" />
      </View>

      <View style={styles.boardWrap}>
        <ChessboardWithArrows
          fen={position.fen}
          boardSize={boardSize}
          withLetters
          withNumbers
          onMove={handleUserMove}
          arrows={arrows}
          highlights={highlights}
        />
      </View>

      <View style={styles.trainerFeedback}>
        <Text style={isComplete || feedback.tone === "success" ? styles.correctText : feedback.tone === "danger" ? styles.incorrectText : styles.feedbackTitle}>
          {isComplete ? "Line complete" : waitingForUser ? "Play the next move" : "App move"}
        </Text>
        <Text style={[styles.bodyText, feedback.tone === "danger" && styles.explanationText]}>
          {isComplete ? "You completed the interactive main line." : feedback.body}
        </Text>
        {waitingForUser && expectedMove && feedback.tone !== "danger" ? (
          <Text style={styles.expectedHint}>Expected response is hidden until you play.</Text>
        ) : null}
      </View>

      {isComplete ? (
        <CoachPracticeFeedback
          attempts={attempts}
          correctMoves={correctMoves}
          lineLength={lineSans.length}
          mistakesByPly={mistakesByPly}
          opening={opening}
        />
      ) : null}

      {!isComplete ? (
        <View style={styles.conceptPanel}>
          <Text style={styles.conceptLabel}>Concept</Text>
          <Text style={styles.conceptText}>
            {waitingForUser
              ? conceptExplanation
              : "Watch the app move, then connect the response to the same opening idea."}
          </Text>
        </View>
      ) : null}

      <PrimaryButton
        title="Restart line"
        icon="restart"
        tone="light"
        onPress={resetTrainer}
      />
    </PremiumPanel>
  );
}

function CoachPracticeFeedback({ attempts, correctMoves, lineLength, mistakesByPly, opening }) {
  const userMoveCount = Math.floor(lineLength / 2);
  const mistakeEntries = Object.entries(mistakesByPly)
    .map(([ply, count]) => ({ ply: Number(ply), count }))
    .sort((a, b) => b.count - a.count || a.ply - b.ply);
  const firstTrouble = mistakeEntries[0];
  const knownMoves = Math.max(0, correctMoves - Object.keys(mistakesByPly).length);
  const struggleMoveNumber = firstTrouble ? Math.floor(firstTrouble.ply / 2) + 1 : null;
  const expectedConcept = firstTrouble
    ? opening.moveExplanations?.[firstTrouble.ply]
    : null;
  const summary = firstTrouble
    ? `You know the first ${knownMoves} response${knownMoves === 1 ? "" : "s"} well, but you struggle around move ${struggleMoveNumber}.`
    : `You know this line well. You completed ${userMoveCount} response${userMoveCount === 1 ? "" : "s"} without a repeated trouble spot.`;

  return (
    <View style={styles.coachFeedbackPanel}>
      <Text style={styles.coachFeedbackLabel}>Coach Feedback</Text>
      <Text style={styles.coachFeedbackTitle}>{summary}</Text>
      <Text style={styles.bodyText}>
        {firstTrouble
          ? `Review this idea: ${expectedConcept || "connect the move to development, center control, and king safety."}`
          : `Next goal: repeat the line faster, then explore the variation tree.`}
      </Text>
      <Text style={styles.expectedHint}>Practice score: {correctMoves}/{Math.max(1, attempts)} correct attempts.</Text>
    </View>
  );
}

function TrapAnimator({ opening }) {
  const { width } = useWindowDimensions();
  const trap = useMemo(() => firstTrapForOpening(opening), [opening]);
  const [trapPly, setTrapPly] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const boardSize = Math.max(220, Math.min(300, width - 74));
  const position = useMemo(() => createPositionFromSans(trap.moves.slice(0, trapPly)), [trap.moves, trapPly]);
  const lastMove = position.played[position.played.length - 1];
  const lastMoveSquares = moveToSquares(lastMove?.uci);
  const arrows = lastMoveSquares
    ? [{ ...lastMoveSquares, id: "trap-last-move", color: "rgba(201, 90, 106, 0.86)" }]
    : [];

  useEffect(() => {
    if (!isPlaying) {
      return undefined;
    }

    if (trapPly >= trap.moves.length) {
      setIsPlaying(false);
      return undefined;
    }

    const timer = setTimeout(() => {
      setTrapPly((current) => current + 1);
    }, trapPly === 0 ? 300 : 850);

    return () => clearTimeout(timer);
  }, [isPlaying, trap.moves.length, trapPly]);

  const playTrap = () => {
    setTrapPly(0);
    setIsPlaying(true);
  };

  return (
    <PremiumPanel dark style={styles.trapPanel}>
      <View style={styles.trainerTopLine}>
        <Text style={styles.panelLabel}>Trap</Text>
        <Text style={styles.trainerStep}>{Math.min(trapPly, trap.moves.length)}/{trap.moves.length}</Text>
      </View>
      <Text style={styles.trapTitle}>{trap.name}</Text>
      <Text style={styles.bodyText}>{trap.setup}</Text>

      <View style={styles.boardWrap}>
        <ChessboardWithArrows
          fen={position.fen}
          boardSize={boardSize}
          withLetters
          withNumbers
          arrows={arrows}
          highlights={[]}
        />
      </View>

      <View style={styles.trainerFeedback}>
        <Text style={styles.incorrectText}>
          {trapPly >= trap.moves.length ? "Trap complete" : lastMove ? `Move: ${lastMove.san}` : "Ready"}
        </Text>
        <Text style={styles.bodyText}>
          {trapPly >= trap.moves.length ? trap.payoff : "Tap play to animate the trap move by move."}
        </Text>
      </View>

      <PrimaryButton
        title={isPlaying ? "Animating..." : "Animate trap"}
        icon="play-circle"
        tone="light"
        disabled={isPlaying}
        onPress={playTrap}
      />
    </PremiumPanel>
  );
}

export default function OpeningDetail() {
  const { name, practice } = useLocalSearchParams();
  const openingName = Array.isArray(name) ? name[0] : name;
  const opening = openingDetails[openingName] || openingDetails["Italian Game"];
  const displayName = openingName || "Italian Game";
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    let active = true;

    getSavedRepertoire().then((repertoire) => {
      if (active) {
        setIsSaved(repertoire.includes(displayName));
      }
    });

    return () => {
      active = false;
    };
  }, [displayName]);

  const handleToggleSaved = async () => {
    const result = await toggleSavedOpening(displayName);
    setIsSaved(result.saved);
  };

  return (
    <AppShell
      showBack
      eyebrow="Opening Details"
      title={openingName || "Italian Game"}
      subtitle="Study the main line, plans, traps, model games, and then move into practice."
    >
      <View style={styles.statsRow}>
        <StatPill icon="chess-king" value={opening.color} label="side" tone="gold" />
        <StatPill icon="source-branch" value={opening.variations.length} label="variations" tone="sage" />
      </View>

      <PremiumPanel style={styles.saveRepertoirePanel}>
        <View style={styles.saveRepertoireTextWrap}>
          <Text style={styles.saveRepertoireTitle}>My Repertoire</Text>
          <Text style={styles.saveRepertoireText}>
            {isSaved ? `${displayName} is saved for practice.` : `Save ${displayName} to your personal opening list.`}
          </Text>
        </View>
        <PrimaryButton
          title={isSaved ? "Remove saved" : "Save opening"}
          icon={isSaved ? "bookmark-check" : "bookmark-plus-outline"}
          onPress={handleToggleSaved}
        />
      </PremiumPanel>

      {opening.stats ? (
        <>
          <SectionHeader label="Opening Statistics" />
          <PremiumPanel style={styles.statisticsPanel}>
            <View style={styles.statGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Win Rate</Text>
                <Text style={styles.statValue}>{opening.stats.winRate}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Popularity</Text>
                <Text style={styles.statValue}>{opening.stats.popularity}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Difficulty</Text>
                <Text style={styles.statValue}>{opening.stats.difficulty}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Style</Text>
                <Text style={styles.statValue}>{opening.stats.style}</Text>
              </View>
            </View>
            <View style={styles.famousPlayers}>
              <Text style={styles.famousPlayersLabel}>Famous players</Text>
              <Text style={styles.famousPlayersText}>{opening.stats.famousPlayers.join(", ")}</Text>
            </View>
          </PremiumPanel>
        </>
      ) : null}

      <PremiumPanel dark style={styles.mainLinePanel}>
        <Text style={styles.panelLabel}>Main line</Text>
        <Text style={styles.openingTitle}>{displayName}</Text>
        <View style={styles.moveList}>
          {opening.mainLine.map((move, index) => (
            <View key={move} style={styles.moveCard}>
              <Text style={styles.moveText}>{move}</Text>
              <Text style={styles.moveExplanation}>
                {opening.moveExplanations?.[index * 2] || "This move supports development and central control."}
              </Text>
            </View>
          ))}
        </View>
      </PremiumPanel>

      <SectionHeader label="Audio / Visual Teaching" />
      <AudioVisualTeaching opening={opening} />

      <SectionHeader label="Interactive Opening Board" />
      <InteractiveOpeningTrainer key={`${displayName}-${practice || "default"}`} opening={opening} openingName={displayName} />

      <SectionHeader label="Engine Analysis" />
      <EngineAnalysisPanel opening={opening} />

      <SectionHeader label="Opening Quiz" />
      <OpeningQuiz openingName={displayName} questions={opening.quiz || []} />

      <SectionHeader label="Opening Concepts" />
      <PremiumPanel style={styles.sectionPanel}>
        <DetailList items={opening.concepts} icon="checkbox-marked-circle-outline" />
      </PremiumPanel>

      <SectionHeader label="Overview" />
      <PremiumPanel style={styles.sectionPanel}>
        <Text style={styles.bodyText}>{opening.overview}</Text>
      </PremiumPanel>

      <SectionHeader label="Variations" />
      <VariationTree openingName={displayName} branches={opening.variationTree || []} />

      <SectionHeader label="Key Ideas" />
      <PremiumPanel style={styles.sectionPanel}>
        <DetailList items={opening.keyIdeas} icon="lightbulb-on-outline" />
      </PremiumPanel>

      <SectionHeader label="Traps" />
      <PremiumPanel style={styles.sectionPanel}>
        <DetailList items={opening.traps} icon="alert-decagram" />
      </PremiumPanel>

      <SectionHeader label="Common Traps" />
      <TrapAnimator opening={opening} />

      <SectionHeader label="Famous Games" />
      <PremiumPanel style={styles.sectionPanel}>
        <FamousGames games={opening.legendaryGames || []} />
        <DetailList items={opening.famousGames} icon="chess-knight" />
      </PremiumPanel>

      <SectionHeader label="Practice Mode" />
      <PremiumPanel dark style={styles.practicePanel}>
        <Text style={styles.bodyText}>
          Use the interactive board above to repeatedly answer: Play the next move. The app tracks attempts, correct moves, and your streak as you remember the theory.
        </Text>
        <PrimaryButton
          title="Restart practice"
          icon="restart"
          tone="light"
          onPress={() => router.setParams({ practice: Date.now().toString() })}
        />
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
  statisticsPanel: {
    gap: 12,
    marginBottom: 18,
  },
  saveRepertoirePanel: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 18,
  },
  saveRepertoireTextWrap: {
    flex: 1,
    minWidth: 190,
  },
  saveRepertoireTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  saveRepertoireText: {
    color: palette.mutedDark,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 4,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  statCard: {
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    minHeight: 74,
    minWidth: 128,
    padding: 12,
  },
  statLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  statValue: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 7,
  },
  famousPlayers: {
    backgroundColor: "#243A2D",
    borderRadius: 8,
    gap: 5,
    padding: 12,
  },
  famousPlayersLabel: {
    color: palette.goldSoft,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  famousPlayersText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  mainLinePanel: {
    gap: 12,
    marginBottom: 18,
  },
  panelLabel: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  openingTitle: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 33,
  },
  moveList: {
    gap: 8,
  },
  moveCard: {
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  moveText: {
    color: palette.goldSoft,
    fontSize: 17,
    fontWeight: "900",
  },
  moveExplanation: {
    color: palette.mutedDark,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  sectionPanel: {
    gap: 10,
    marginBottom: 16,
  },
  bodyText: {
    color: palette.mutedDark,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
  },
  list: {
    gap: 9,
  },
  listRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  listText: {
    color: palette.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  legendaryGames: {
    gap: 10,
  },
  legendaryGameCard: {
    backgroundColor: "#243A2D",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  legendaryGameHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  legendaryIcon: {
    alignItems: "center",
    backgroundColor: "rgba(215, 179, 90, 0.16)",
    borderRadius: 8,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  legendaryGameTitleWrap: {
    flex: 1,
  },
  legendaryPlayer: {
    color: palette.goldSoft,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  legendaryGameTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22,
  },
  legendaryMeta: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: "900",
  },
  legendaryLesson: {
    color: palette.mutedDark,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  treePanel: {
    gap: 12,
    marginBottom: 16,
  },
  treeRoot: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
  },
  treeRootText: {
    color: palette.ink,
    flex: 1,
    fontSize: 18,
    fontWeight: "900",
  },
  treeBranches: {
    gap: 8,
  },
  treeBranch: {
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    padding: 11,
  },
  treeBranchPressed: {
    opacity: 0.78,
  },
  treeBranchLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  treeConnector: {
    color: palette.gold,
    fontSize: 15,
    fontWeight: "900",
    width: 34,
  },
  treeBranchName: {
    color: palette.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
  },
  treeBranchDetail: {
    borderLeftColor: palette.lineDark,
    borderLeftWidth: 2,
    gap: 5,
    marginLeft: 34,
    marginTop: 9,
    paddingLeft: 10,
  },
  treeLine: {
    color: palette.goldSoft,
    fontSize: 14,
    fontWeight: "900",
  },
  treeIdea: {
    color: palette.mutedDark,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  practicePanel: {
    gap: 12,
    marginBottom: 10,
  },
  teachingPanel: {
    gap: 12,
    marginBottom: 18,
  },
  teachingExplanation: {
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  teachingMove: {
    color: palette.goldSoft,
    fontSize: 16,
    fontWeight: "900",
  },
  teachingControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  teachingButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 11,
  },
  teachingButtonActive: {
    backgroundColor: "rgba(215, 179, 90, 0.18)",
    borderColor: "rgba(215, 179, 90, 0.48)",
  },
  teachingButtonText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  trapPanel: {
    gap: 12,
    marginBottom: 18,
  },
  trapTitle: {
    color: palette.ink,
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 26,
  },
  trainerPanel: {
    gap: 12,
    marginBottom: 18,
  },
  trainerTopLine: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  practiceStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  trainerStep: {
    color: palette.goldSoft,
    fontSize: 13,
    fontWeight: "900",
  },
  quizPanel: {
    gap: 12,
    marginBottom: 18,
  },
  quizQuestion: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26,
  },
  quizOptions: {
    gap: 9,
  },
  quizOption: {
    alignItems: "center",
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quizOptionPressed: {
    opacity: 0.78,
  },
  quizOptionCorrect: {
    backgroundColor: "rgba(30, 142, 84, 0.14)",
    borderColor: "rgba(30, 142, 84, 0.72)",
  },
  quizOptionWrong: {
    backgroundColor: "rgba(201, 90, 106, 0.14)",
    borderColor: "rgba(201, 90, 106, 0.72)",
  },
  quizOptionText: {
    color: palette.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
  },
  quizFeedback: {
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  quizFooter: {
    gap: 10,
  },
  enginePanel: {
    gap: 12,
    marginBottom: 18,
  },
  engineDepth: {
    color: palette.goldSoft,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  engineAlert: {
    alignItems: "flex-start",
    backgroundColor: "rgba(201, 90, 106, 0.13)",
    borderColor: "rgba(201, 90, 106, 0.5)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  engineAlertText: {
    flex: 1,
    gap: 4,
  },
  engineAlertTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 21,
  },
  engineAlertBody: {
    color: palette.mutedDark,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  engineMoveList: {
    gap: 9,
  },
  engineMoveCard: {
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 7,
    padding: 12,
  },
  engineMoveTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  engineMove: {
    color: palette.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
  },
  engineBadge: {
    backgroundColor: "rgba(30, 142, 84, 0.14)",
    borderRadius: 8,
    color: "#1E8E54",
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
  engineBadgeProblem: {
    backgroundColor: "rgba(201, 90, 106, 0.16)",
    color: palette.danger,
  },
  engineEvalRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  engineEvalText: {
    color: palette.goldSoft,
    fontSize: 13,
    fontWeight: "900",
  },
  engineExplanation: {
    color: palette.mutedDark,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  boardWrap: {
    alignItems: "center",
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
  },
  trainerFeedback: {
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  feedbackTitle: {
    color: palette.gold,
    fontSize: 17,
    fontWeight: "900",
  },
  correctText: {
    color: "#1E8E54",
    fontSize: 17,
    fontWeight: "900",
  },
  incorrectText: {
    color: palette.danger,
    fontSize: 17,
    fontWeight: "900",
  },
  explanationText: {
    lineHeight: 22,
  },
  expectedHint: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  conceptPanel: {
    backgroundColor: "#243A2D",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    padding: 12,
  },
  conceptLabel: {
    color: palette.goldSoft,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  conceptText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 21,
  },
  coachFeedbackPanel: {
    backgroundColor: "#243A2D",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 7,
    padding: 12,
  },
  coachFeedbackLabel: {
    color: palette.goldSoft,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  coachFeedbackTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 23,
  },
});
