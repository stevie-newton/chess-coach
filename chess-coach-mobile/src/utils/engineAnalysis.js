import { Chess } from "chess.js";

const pieceValues = {
  p: 1,
  n: 3.2,
  b: 3.3,
  r: 5,
  q: 9,
  k: 0,
};

function materialScore(chess) {
  return chess.board().flat().reduce((score, piece) => {
    if (!piece) {
      return score;
    }

    const value = pieceValues[piece.type] || 0;
    return piece.color === "w" ? score + value : score - value;
  }, 0);
}

function mobilityScore(chess) {
  const turn = chess.turn();
  const legalMoves = chess.moves().length;
  const fenParts = chess.fen().split(" ");
  fenParts[1] = turn === "w" ? "b" : "w";

  try {
    const opponent = new Chess(fenParts.join(" "));
    return (turn === "w" ? 1 : -1) * (legalMoves - opponent.moves().length) * 0.025;
  } catch {
    return 0;
  }
}

function centerScore(chess) {
  const centerSquares = ["d4", "e4", "d5", "e5"];

  return centerSquares.reduce((score, square) => {
    const piece = chess.get(square);
    if (!piece) {
      return score;
    }

    const value = piece.type === "p" ? 0.18 : 0.1;
    return piece.color === "w" ? score + value : score - value;
  }, 0);
}

function evaluateFen(fen) {
  try {
    const chess = new Chess(fen);
    const raw = materialScore(chess) + mobilityScore(chess) + centerScore(chess);
    return Number(Math.max(-8, Math.min(8, raw)).toFixed(1));
  } catch {
    return 0;
  }
}

function formatEval(value) {
  if (value > 0) {
    return `+${value.toFixed(1)}`;
  }

  return value.toFixed(1);
}

function classifySwing(delta) {
  const absoluteDelta = Math.abs(delta);

  if (absoluteDelta >= 2) {
    return "Blunder";
  }

  if (absoluteDelta >= 1) {
    return "Mistake";
  }

  if (absoluteDelta >= 0.5) {
    return "Inaccuracy";
  }

  return "Stable";
}

export function buildEngineLineAnalysis(mainLine, moveExplanations = []) {
  const chess = new Chess();
  const moves = mainLine
    .flatMap((line) => line.split(/\s+/))
    .filter((token) => token && !/^\d+\.+$/.test(token));
  let previousEval = evaluateFen(chess.fen());

  return moves
    .map((san, index) => {
      const move = chess.move(san, { sloppy: true });

      if (!move) {
        return null;
      }

      const afterEval = evaluateFen(chess.fen());
      const delta = Number((afterEval - previousEval).toFixed(1));
      const sideAdjustment = move.color === "w" ? delta : -delta;
      const classification = classifySwing(sideAdjustment);
      const analysis = {
        san: move.san,
        moveNumber: Math.floor(index / 2) + 1,
        color: move.color,
        before: previousEval,
        after: afterEval,
        delta: sideAdjustment,
        classification,
        explanation: moveExplanations[index] || `${move.san} changes the position by ${formatEval(sideAdjustment)} from the mover's point of view.`,
      };

      previousEval = afterEval;
      return analysis;
    })
    .filter(Boolean);
}

export function formatEngineEval(value) {
  return formatEval(value);
}
