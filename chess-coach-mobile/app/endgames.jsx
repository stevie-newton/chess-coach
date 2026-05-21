import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { api } from "../src/api/client";
import ChessboardWithArrows from "../src/components/ChessboardWithArrows";
import {
  AppShell,
  EmptyState,
  FeatureRow,
  LoadingState,
  PremiumPanel,
  PrimaryButton,
  SectionHeader,
  StatPill,
  palette,
} from "../src/components/PremiumUI";

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

export default function Endgames() {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [fen, setFen] = useState(null);
  const [plyIndex, setPlyIndex] = useState(0);
  const [stagedMove, setStagedMove] = useState("");
  const [result, setResult] = useState(null);
  const [mistakes, setMistakes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadEndgames() {
      try {
        const response = await api.get("/endgames/");
        const loadedTemplates = response.data || [];
        setTemplates(loadedTemplates);

        if (loadedTemplates.length > 0) {
          setSelected(loadedTemplates[0]);
          setFen(loadedTemplates[0].start_fen);
        }
      } catch (error) {
        console.log(error.response?.data || error.message);
      } finally {
        setLoading(false);
      }
    }

    loadEndgames();
  }, []);

  const chooseTemplate = (template) => {
    setSelected(template);
    setFen(template.start_fen);
    setPlyIndex(0);
    setStagedMove("");
    setResult(null);
    setMistakes(0);
  };

  const submitMove = async () => {
    if (!selected || !stagedMove) {
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.post(`/endgames/${selected.key}/move`, {
        ply_index: plyIndex,
        user_move: stagedMove,
        mistakes,
      });

      setResult(response.data);
      setFen(response.data.fen);
      setPlyIndex(response.data.next_ply_index);
      setMistakes(response.data.mistakes);
      setStagedMove("");
    } catch (error) {
      Alert.alert(
        "Endgame move failed",
        error.response?.data?.detail || "Could not evaluate this endgame move"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const stagedSquares = moveToSquares(stagedMove);
  const expectedSquares = moveToSquares(result?.expected_move);
  const replySquares = moveToSquares(result?.ai_reply?.move);
  const arrows = [];

  if (stagedSquares) {
    arrows.push({
      ...stagedSquares,
      id: "endgame-staged",
      color: "rgba(215, 179, 90, 0.78)",
    });
  }

  if (result && !result.is_correct && expectedSquares) {
    arrows.push({
      ...expectedSquares,
      id: "endgame-expected",
      color: "rgba(30, 142, 84, 0.86)",
    });
  }

  if (replySquares) {
    arrows.push({
      ...replySquares,
      id: "endgame-ai-reply",
      color: "rgba(46, 125, 136, 0.82)",
    });
  }

  return (
    <AppShell
      showBack
      eyebrow="Endgames"
      title="Practical endgame training."
      subtitle="Convert core positions with precision, efficiency, and clean technique."
    >
      {loading ? (
        <LoadingState />
      ) : templates.length === 0 ? (
        <EmptyState
          icon="chess-king"
          title="No endgames available"
          body="Endgame templates could not be loaded from the coach."
        />
      ) : (
        <>
          <SectionHeader label="Practical Endgames" />
          {templates.map((template) => (
            <FeatureRow
              key={template.key}
              title={template.title}
              subtitle={`${template.goal} | ${template.description}`}
              icon={template.category.includes("Rook") ? "chess-rook" : template.category.includes("Pawn") ? "chess-pawn" : "chess-queen"}
              accent={selected?.key === template.key ? palette.gold : palette.sage}
              meta={template.difficulty}
              onPress={() => chooseTemplate(template)}
            />
          ))}

          {selected && fen ? (
            <>
              <View style={styles.statsRow}>
                <StatPill icon="timer-outline" value={selected.max_moves} label="move goal" tone="gold" />
                <StatPill icon="bullseye-arrow" value={result?.precision ?? 100} label="precision" />
                <StatPill icon="chart-line" value={result?.efficiency ?? 100} label="efficiency" tone="wine" />
              </View>

              <PremiumPanel dark style={styles.sessionPanel}>
                <Text style={styles.panelLabel}>{selected.category}</Text>
                <Text style={styles.panelTitle}>{selected.title}</Text>
                <Text style={styles.panelText}>{selected.goal}</Text>
                <Text style={styles.panelText}>Play as {selected.user_color}. The defender replies automatically.</Text>
              </PremiumPanel>

              <View style={styles.boardWrap}>
                <ChessboardWithArrows
                  fen={fen}
                  boardSize={300}
                  withLetters
                  withNumbers
                  onMove={setStagedMove}
                  arrows={arrows}
                />
              </View>

              <PremiumPanel style={styles.feedbackPanel}>
                <Text style={result?.is_correct ? styles.correctTitle : styles.feedbackTitle}>
                  {result?.message || "Find the practical move"}
                </Text>
                <Text style={styles.feedbackText}>
                  {result?.feedback || "Choose the move that converts or holds the endgame within the target."}
                </Text>
                {stagedMove ? <Text style={styles.moveText}>Selected move: {stagedMove}</Text> : null}
                {result?.ai_reply ? (
                  <Text style={styles.replyText}>AI reply: {result.ai_reply.san}</Text>
                ) : null}
                <Text style={styles.moveText}>Mistakes: {mistakes}</Text>
              </PremiumPanel>

              <PrimaryButton
                title={submitting ? "Checking..." : result?.completed ? "Line complete" : "Submit endgame move"}
                icon="send"
                onPress={submitMove}
                disabled={!stagedMove || submitting || result?.completed}
              />
            </>
          ) : null}
        </>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  loadingPanel: {
    alignItems: "center",
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginBottom: 14,
  },
  sessionPanel: {
    gap: 8,
    marginBottom: 14,
  },
  panelLabel: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  panelTitle: {
    color: palette.ink,
    fontSize: 23,
    fontWeight: "900",
  },
  panelText: {
    color: palette.mutedDark,
    fontSize: 14,
    lineHeight: 20,
  },
  boardWrap: {
    alignItems: "center",
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 8,
  },
  feedbackPanel: {
    gap: 7,
    marginBottom: 14,
  },
  feedbackTitle: {
    color: palette.gold,
    fontSize: 18,
    fontWeight: "900",
  },
  correctTitle: {
    color: "#1E8E54",
    fontSize: 18,
    fontWeight: "900",
  },
  feedbackText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  moveText: {
    color: palette.mutedDark,
    fontSize: 13,
    fontWeight: "800",
  },
  replyText: {
    color: palette.goldSoft,
    fontSize: 14,
    fontWeight: "900",
  },
});
