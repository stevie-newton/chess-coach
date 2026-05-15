import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  PanResponder,
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
  ...props
}) {
  const [dragStart, setDragStart] = useState(null);
  const [dragCurrent, setDragCurrent] = useState(null);
  const boardContainerRef = useRef(null);
  const squareSize = boardSize / 8;

  // Convert board coordinates to square position
  const getSquareFromCoords = (x, y) => {
    const column = Math.floor(x / squareSize);
    const row = Math.floor(y / squareSize);

    if (column < 0 || column > 7 || row < 0 || row > 7) {
      return null;
    }

    // Convert to chess notation (a-h, 1-8)
    const file = String.fromCharCode(97 + column); // a-h
    const rank = 8 - row; // 8-1
    return `${file}${rank}`;
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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const square = getSquareFromCoords(locationX, locationY);

        if (square) {
          setDragStart(square);
          setDragCurrent(square);
        }
      },

      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const currentSquare = getSquareFromCoords(locationX, locationY);

        if (currentSquare) {
          setDragCurrent(currentSquare);
        }
      },

      onPanResponderRelease: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const endSquare = getSquareFromCoords(locationX, locationY);

        if (dragStart && endSquare && dragStart !== endSquare) {
          // Call the onMove callback with the move in UCI format
          const uciMove = `${dragStart}${endSquare}`;
          if (onMove) {
            onMove(uciMove);
          }
        }

        // Clear drag state
        setDragStart(null);
        setDragCurrent(null);
      },

      onPanResponderTerminate: () => {
        setDragStart(null);
        setDragCurrent(null);
      },
    })
  ).current;

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

  const renderDragArrow = () => {
    return renderArrow({
      from: dragStart,
      to: dragCurrent,
      id: "drag-arrow",
      color: "rgba(255, 193, 7, 0.7)",
    });
  };

  return (
    <View
      ref={boardContainerRef}
      style={styles.container}
      {...panResponder.panHandlers}
    >
      <View style={{ width: boardSize, height: boardSize }}>
        <Chessboard
          fen={fen}
          boardSize={boardSize}
          gestureEnabled={false}
          withLetters={withLetters}
          withNumbers={withNumbers}
          {...props}
        />
      </View>
      {arrows.map((arrow, index) =>
        renderArrow({
          ...arrow,
          id: arrow.id || `static-arrow-${index}`,
        })
      )}
      {renderDragArrow()}
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
});
