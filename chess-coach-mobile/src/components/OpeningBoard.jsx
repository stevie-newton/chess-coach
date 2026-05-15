import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Chess } from "chess.js";
import ChessboardWithArrows from "./ChessboardWithArrows";
import { PremiumPanel, PrimaryButton, StatPill, palette } from "./PremiumUI";

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

function sideToMoveLabel(fen) {
  const activeColor = fen?.trim().split(/\s+/)[1];
  if (activeColor === "w") return "White";
  if (activeColor === "b") return "Black";
  return "Unknown";
}

function makeChess(fen) {
  try {
    return new Chess(fen);
  } catch {
    return null;
  }
}

function legalMovesForFen(fen) {
  const chess = makeChess(fen);
  if (!chess) {
    return [];
  }

  return chess.moves({ verbose: true }).map((move) => ({
    from: move.from,
    to: move.to,
    san: move.san,
    uci: `${move.from}${move.to}${move.promotion || ""}`,
  }));
}

function validateMove(fen, move) {
  const chess = makeChess(fen);
  const squares = moveToSquares(move);

  if (!chess || !squares) {
    return false;
  }

  return Boolean(
    chess.move({
      from: squares.from,
      to: squares.to,
      promotion: move.length > 4 ? move[4] : "q",
    })
  );
}

export default function OpeningBoard({
  fen,
  bestMove,
  userMove: initialUserMove = "",
  explanation,
  boardSize = 300,
  question = null,
  submitTitle = "Submit board move",
  hideBestMoveUntilSubmitted = false,
  onSubmitMove = null,
}) {
  const [userMove, setUserMove] = useState(initialUserMove);
  const [submittedMove, setSubmittedMove] = useState(initialUserMove);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const legalMoves = useMemo(() => legalMovesForFen(fen), [fen]);
  const bestMoveSquares = moveToSquares(bestMove);
  const userMoveSquares = moveToSquares(submittedMove || userMove);
  const isLegal = submittedMove ? validateMove(fen, submittedMove) : null;
  const isCorrect = submittedMove
    ? submittedMove.trim().toLowerCase() === bestMove?.trim().toLowerCase()
    : null;

  const arrows = [];
  const highlights = [];

  if (userMoveSquares) {
    const color = isCorrect
      ? "rgba(30, 142, 84, 0.82)"
      : submittedMove
        ? "rgba(201, 90, 106, 0.78)"
        : "rgba(215, 179, 90, 0.72)";

    arrows.push({ ...userMoveSquares, id: "opening-user-move", color });
    highlights.push(
      {
        square: userMoveSquares.from,
        color: isCorrect
          ? "rgba(30, 142, 84, 0.24)"
          : submittedMove
            ? "rgba(201, 90, 106, 0.24)"
            : "rgba(215, 179, 90, 0.22)",
        borderColor: isCorrect
          ? "rgba(30, 142, 84, 0.84)"
          : submittedMove
            ? "rgba(201, 90, 106, 0.84)"
            : "rgba(215, 179, 90, 0.78)",
      },
      {
        square: userMoveSquares.to,
        color: isCorrect
          ? "rgba(30, 142, 84, 0.3)"
          : submittedMove
            ? "rgba(201, 90, 106, 0.3)"
            : "rgba(215, 179, 90, 0.28)",
        borderColor: isCorrect
          ? "rgba(30, 142, 84, 0.94)"
          : submittedMove
            ? "rgba(201, 90, 106, 0.92)"
            : "rgba(215, 179, 90, 0.88)",
      }
    );
  }

  if (submittedMove && !isCorrect && bestMoveSquares) {
    arrows.push({
      ...bestMoveSquares,
      id: "opening-best-move",
      color: "rgba(30, 142, 84, 0.86)",
    });
  }

  const feedbackTitle = !submittedMove
    ? "Choose a move"
    : !isLegal
      ? "Illegal move"
      : isCorrect
        ? "Correct opening move"
        : "Different from repertoire";

  const feedbackBody = !submittedMove
    ? "Drag or tap a piece to enter your move, then submit it."
    : !isLegal
      ? "That move is not legal from this FEN position."
      : isCorrect
        ? explanation || "This is the prepared move for the line."
        : `Your move is legal, but this line expects ${bestMove}.`;

  const submitMove = async () => {
    if (!userMove) {
      return;
    }

    setSubmittedMove(userMove);

    if (!onSubmitMove) {
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmitMove(userMove);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PremiumPanel style={styles.panel}>
      {question ? <Text style={styles.question}>{question}</Text> : null}

      <View style={styles.statsRow}>
        <StatPill icon="chess-king" value={sideToMoveLabel(fen)} label="to move" tone="sage" />
        <StatPill icon="source-branch" value={legalMoves.length} label="legal moves" tone="gold" />
      </View>

      <View style={styles.boardWrap}>
        <ChessboardWithArrows
          fen={fen}
          boardSize={boardSize}
          withLetters
          withNumbers
          onMove={(move) => {
            setUserMove(move);
            setSubmittedMove("");
          }}
          arrows={arrows}
          highlights={highlights}
        />
      </View>

      <View style={styles.feedbackPanel}>
        <Text style={isCorrect ? styles.correctTitle : styles.feedbackTitle}>{feedbackTitle}</Text>
        <Text style={styles.feedbackBody}>{feedbackBody}</Text>
        {userMove ? <Text style={styles.moveText}>User move: {userMove}</Text> : null}
        {!hideBestMoveUntilSubmitted || submittedMove ? (
          <Text style={styles.moveText}>Best move: {bestMove}</Text>
        ) : null}
      </View>

      <View style={styles.legalMovesPanel}>
        <Text style={styles.legalMovesTitle}>Legal moves</Text>
        <View style={styles.legalMoveGrid}>
          {legalMoves.slice(0, 18).map((move) => (
            <View key={move.uci} style={styles.legalMoveChip}>
              <Text style={styles.legalMoveText}>{move.san}</Text>
            </View>
          ))}
        </View>
      </View>

      <PrimaryButton
        title={isSubmitting ? "Submitting..." : submitTitle}
        icon="send"
        onPress={submitMove}
        disabled={!userMove || isSubmitting}
      />
    </PremiumPanel>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 12,
    marginBottom: 18,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  boardWrap: {
    alignItems: "center",
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
  },
  question: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 24,
  },
  feedbackPanel: {
    backgroundColor: palette.charcoal,
    borderColor: palette.lineDark,
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
  correctTitle: {
    color: "#1E8E54",
    fontSize: 17,
    fontWeight: "900",
  },
  feedbackBody: {
    color: palette.mutedDark,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  moveText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  legalMovesPanel: {
    gap: 8,
  },
  legalMovesTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  legalMoveGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  legalMoveChip: {
    backgroundColor: "#252A34",
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  legalMoveText: {
    color: palette.mutedDark,
    fontSize: 12,
    fontWeight: "800",
  },
});
