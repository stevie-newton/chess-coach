import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
} from "react-native";
import { Svg, Line, Circle, Polygon, Defs, Marker } from "react-native-svg";
import Chessboard from "react-native-chessboard";

export default function ChessboardWithArrows({
  fen,
  boardSize = 320,
  withLetters = true,
  withNumbers = true,
  onMove = null,
  arrows = [],
  highlights = [],
  animateMoves = true,
  moveAnimationDuration = 220,
  autoMove = null,
  onAutoMoveEnd = null,
  resetToken = null,
  durations,
  ...props
}) {
  const [selectedSquare, setSelectedSquare] = useState(null);
  const chessboardRef = useRef(null);
  const isAnimatingMoveRef = useRef(false);
  const selectedSquareRef = useRef(null);
  const onMoveRef = useRef(onMove);
  const onAutoMoveEndRef = useRef(onAutoMoveEnd);
  const pieceMapRef = useRef({});
  const squareSize = boardSize / 8;
  const boardSquares = React.useMemo(() => {
    return Array.from({ length: 64 }, (_, index) => {
      const column = index % 8;
      const row = Math.floor(index / 8);
      const file = String.fromCharCode(97 + column);
      const rank = 8 - row;

      return {
        id: `${file}${rank}`,
        left: column * squareSize,
        top: row * squareSize,
      };
    });
  }, [squareSize]);

  const pieceMap = React.useMemo(() => {
    const pieces = {};
    const boardFen = fen?.split(" ")[0] || "";
    const rows = boardFen.split("/");

    rows.forEach((row, rowIndex) => {
      let fileIndex = 0;

      row.split("").forEach((char) => {
        const emptySquares = Number(char);
        if (Number.isInteger(emptySquares) && emptySquares > 0) {
          fileIndex += emptySquares;
          return;
        }

        const file = String.fromCharCode(97 + fileIndex);
        const rank = 8 - rowIndex;
        pieces[`${file}${rank}`] = char;
        fileIndex += 1;
      });
    });

    return pieces;
  }, [fen]);

  const activeColor = React.useMemo(() => {
    const color = fen?.trim().split(/\s+/)[1];

    return color === "b" ? "black" : "white";
  }, [fen]);

  onMoveRef.current = onMove;
  onAutoMoveEndRef.current = onAutoMoveEnd;
  pieceMapRef.current = pieceMap;

  const mergedDurations = React.useMemo(
    () => ({
      ...durations,
      move: durations?.move ?? moveAnimationDuration,
    }),
    [durations, moveAnimationDuration]
  );

  useEffect(() => {
    chessboardRef.current?.resetBoard?.(fen);
    setSelected(null);
  }, [fen, resetToken]);

  useEffect(() => {
    if (!autoMove?.from || !autoMove?.to || !chessboardRef.current?.move) {
      return;
    }

    let isCurrent = true;

    const runAutoMove = async () => {
      isAnimatingMoveRef.current = true;
      chessboardRef.current.resetBoard?.(fen);

      try {
        const playedMove = await chessboardRef.current.move({
          from: autoMove.from,
          to: autoMove.to,
        });

        if (isCurrent) {
          onAutoMoveEndRef.current?.(playedMove);
        }
      } finally {
        if (isCurrent) {
          isAnimatingMoveRef.current = false;
        }
      }
    };

    void runAutoMove();

    return () => {
      isCurrent = false;
    };
  }, [autoMove?.id, autoMove?.from, autoMove?.to, fen]);

  const getPieceColor = (piece) => {
    if (!piece) {
      return null;
    }

    return piece === piece.toUpperCase() ? "white" : "black";
  };

  // Convert square position to board coordinates (for drawing)
  const getCoordsFromSquare = (square) => {
    if (!square || square.length !== 2) return null;
    const file = square.charCodeAt(0) - 97; // a-h to 0-7
    const rank = parseInt(square[1]) - 1; // 1-8 to 0-7

    const x = file * squareSize + squareSize / 2;
    const y = (7 - rank) * squareSize + squareSize / 2;
    return { x, y };
  };

  const buildUciMove = (from, to) => {
    const piece = pieceMapRef.current[from];
    const toRank = to?.[1];
    const isPawn = piece?.toLowerCase() === "p";
    const isPromotion = isPawn && (toRank === "1" || toRank === "8");

    return `${from}${to}${isPromotion ? "q" : ""}`;
  };

  const emitMove = async (from, to) => {
    if (!from || !to || from === to || !onMoveRef.current) {
      return;
    }

    if (animateMoves && chessboardRef.current?.move) {
      isAnimatingMoveRef.current = true;
      chessboardRef.current.resetBoard?.(fen);

      try {
        const playedMove = await chessboardRef.current.move({ from, to });
        if (!playedMove) {
          return;
        }
      } finally {
        isAnimatingMoveRef.current = false;
      }
    }

    onMoveRef.current(buildUciMove(from, to));
  };

  const setSelected = (square) => {
    selectedSquareRef.current = square;
    setSelectedSquare(square);
  };

  const handleSquareTap = (square) => {
    if (isAnimatingMoveRef.current) {
      return;
    }

    if (!square) {
      setSelected(null);
      return;
    }

    const selected = selectedSquareRef.current;

    if (!selected) {
      const piece = pieceMapRef.current[square];
      if (piece && getPieceColor(piece) === activeColor) {
        setSelected(square);
      }
      return;
    }

    if (selected === square) {
      setSelected(null);
      return;
    }

    const targetPiece = pieceMapRef.current[square];
    if (targetPiece && getPieceColor(targetPiece) === activeColor) {
      setSelected(square);
      return;
    }

    void emitMove(selected, square);
    setSelected(null);
  };

  const renderSquareHighlight = (
    square,
    color = "rgba(212, 175, 55, 0.34)",
    borderColor = "rgba(212, 175, 55, 0.95)",
    key = null,
    showDot = false
  ) => {
    if (!square) {
      return null;
    }

    const coords = getCoordsFromSquare(square);
    if (!coords) {
      return null;
    }

    return (
      <View
        key={key}
        pointerEvents="none"
        style={[
          styles.squareHighlight,
          {
            backgroundColor: color,
            borderColor,
            width: squareSize,
            height: squareSize,
            left: coords.x - squareSize / 2,
            top: coords.y - squareSize / 2,
          },
        ]}
      >
        {showDot ? <View style={styles.selectionDot} /> : null}
      </View>
    );
  };

  const renderArrow = ({ from, to, color = "rgba(255, 193, 7, 0.7)", id = "arrow" }) => {
    if (!from || !to || from === to) {
      return null;
    }

    const startCoords = getCoordsFromSquare(from);
    const endCoords = getCoordsFromSquare(to);

    if (!startCoords || !endCoords) return null;

    return (
      <Svg
        key={id}
        width={boardSize}
        height={boardSize}
        style={styles.arrowOverlay}
        pointerEvents="none"
      >
        <Defs>
          <Marker
            id={`${id}-arrowhead`}
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <Polygon points="0 0, 10 3, 0 6" fill={color} />
          </Marker>
        </Defs>
        <Line
          x1={startCoords.x}
          y1={startCoords.y}
          x2={endCoords.x}
          y2={endCoords.y}
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          markerEnd={`url(#${id}-arrowhead)`}
        />
        <Circle
          cx={startCoords.x}
          cy={startCoords.y}
          r="8"
          fill={color}
        />
      </Svg>
    );
  };

  return (
    <View
      style={[styles.container, { width: boardSize, height: boardSize }]}
    >
      <View style={{ width: boardSize, height: boardSize }}>
        <Chessboard
          ref={chessboardRef}
          fen={fen}
          boardSize={boardSize}
          durations={mergedDurations}
          gestureEnabled={false}
          withLetters={withLetters}
          withNumbers={withNumbers}
          {...props}
        />
      </View>
      {renderSquareHighlight(selectedSquare, undefined, undefined, "selected-square", true)}
      {highlights.map((highlight, index) =>
        renderSquareHighlight(
          highlight.square,
          highlight.color,
          highlight.borderColor,
          highlight.id || `highlight-${index}`
        )
      )}
      {arrows.map((arrow, index) =>
        renderArrow({
          ...arrow,
          id: arrow.id || `static-arrow-${index}`,
        })
      )}
      <View pointerEvents="box-none" style={styles.tapGrid}>
        {boardSquares.map((square) => (
          <Pressable
            key={square.id}
            accessibilityLabel={`Chess square ${square.id}`}
            accessibilityRole="button"
            onPressIn={() => handleSquareTap(square.id)}
            style={[
              styles.tapSquare,
              {
                height: squareSize,
                left: square.left,
                top: square.top,
                width: squareSize,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  arrowOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  tapGrid: {
    ...StyleSheet.absoluteFillObject,
    elevation: 30,
    zIndex: 30,
  },
  tapSquare: {
    position: "absolute",
  },
  squareHighlight: {
    backgroundColor: "rgba(212, 175, 55, 0.34)",
    alignItems: "center",
    borderColor: "rgba(212, 175, 55, 0.95)",
    borderWidth: 3,
    justifyContent: "center",
    position: "absolute",
  },
  selectionDot: {
    backgroundColor: "rgba(215,179,90,0.96)",
    borderRadius: 8,
    height: 16,
    width: 16,
  },
});
