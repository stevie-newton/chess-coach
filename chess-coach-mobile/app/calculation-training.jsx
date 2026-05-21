import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
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
  uiStyles,
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

export default function CalculationTraining() {
  const [drills, setDrills] = useState([]);
  const [selected, setSelected] = useState(null);
  const [boardVisible, setBoardVisible] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const startBlindTimer = (drill) => {
    setBoardVisible(true);
    setSecondsLeft(drill.blind_after_seconds);
  };

  useEffect(() => {
    async function loadDrills() {
      try {
        const response = await api.get("/calculation/drills");
        const loadedDrills = response.data || [];
        setDrills(loadedDrills);

        if (loadedDrills.length > 0) {
          setSelected(loadedDrills[0]);
          startBlindTimer(loadedDrills[0]);
        }
      } catch (error) {
        console.log(error.response?.data || error.message);
      } finally {
        setLoading(false);
      }
    }

    loadDrills();
  }, []);

  useEffect(() => {
    if (!selected || !boardVisible || secondsLeft <= 0) {
      if (selected && secondsLeft <= 0) {
        setBoardVisible(false);
      }
      return undefined;
    }

    const timer = setTimeout(() => {
      setSecondsLeft((current) => current - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [boardVisible, secondsLeft, selected]);

  const chooseDrill = (drill) => {
    setSelected(drill);
    setAnswer("");
    setResult(null);
    startBlindTimer(drill);
  };

  const submitAnswer = async () => {
    if (!selected || !answer.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.post(`/calculation/drills/${selected.key}/attempt`, {
        user_move: answer.trim(),
      });
      setResult(response.data);
      setBoardVisible(true);
    } catch (error) {
      Alert.alert(
        "Calculation failed",
        error.response?.data?.detail || "Could not evaluate this continuation"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const bestSquares = moveToSquares(result?.best_move);
  const userSquares = moveToSquares(result?.user_move);
  const arrows = [];

  if (userSquares) {
    arrows.push({
      ...userSquares,
      id: "calculation-user",
      color: result?.is_correct ? "rgba(30, 142, 84, 0.86)" : "rgba(201, 90, 106, 0.78)",
    });
  }

  if (result && !result.is_correct && bestSquares) {
    arrows.push({
      ...bestSquares,
      id: "calculation-best",
      color: "rgba(30, 142, 84, 0.86)",
    });
  }

  return (
    <AppShell
      showBack
      eyebrow="Calculation Training"
      title="Visualize the continuation."
      subtitle="Study the position briefly, then calculate after the board disappears."
    >
      {loading ? (
        <LoadingState />
      ) : drills.length === 0 ? (
        <EmptyState
          icon="brain"
          title="No calculation drills"
          body="The coach could not load visualization drills."
        />
      ) : (
        <>
          <SectionHeader label="Drills" />
          {drills.map((drill) => (
            <FeatureRow
              key={drill.key}
              title={drill.title}
              subtitle={`${drill.theme} | Board hides after ${drill.blind_after_seconds}s`}
              icon="brain"
              accent={selected?.key === drill.key ? palette.gold : palette.teal}
              meta={drill.difficulty}
              onPress={() => chooseDrill(drill)}
            />
          ))}

          {selected ? (
            <>
              <View style={styles.statsRow}>
                <StatPill icon="eye-off" value={`${selected.blind_after_seconds}s`} label="view time" tone="gold" />
                <StatPill icon="source-branch" value={selected.preview_san.length + 1} label="depth" />
                <StatPill icon="bullseye-arrow" value={result?.visualization_score ?? "--"} label="score" tone="wine" />
              </View>

              <PremiumPanel dark style={styles.promptPanel}>
                <Text style={styles.panelLabel}>{selected.theme}</Text>
                <Text style={styles.promptTitle}>{selected.prompt}</Text>
                <Text style={styles.previewLine}>
                  {selected.preview_san.length > 0
                    ? `After: ${selected.preview_san.join(", ")}`
                    : "Start from the displayed position."}
                </Text>
              </PremiumPanel>

              <View style={styles.boardWrap}>
                {boardVisible ? (
                  <ChessboardWithArrows
                    fen={selected.position_fen}
                    boardSize={300}
                    withLetters
                    withNumbers
                    arrows={arrows}
                  />
                ) : (
                  <View style={styles.blindBoard}>
                    <Text style={styles.blindTitle}>Board hidden</Text>
                    <Text style={styles.blindText}>Calculate the best continuation from memory.</Text>
                  </View>
                )}
              </View>

              <PremiumPanel style={styles.answerPanel}>
                <View style={styles.timerRow}>
                  <Text style={styles.timerText}>
                    {boardVisible ? `Board hides in ${secondsLeft}s` : "Blind calculation mode"}
                  </Text>
                  <PrimaryButton
                    title={boardVisible ? "Hide now" : "Show board"}
                    icon={boardVisible ? "eye-off" : "eye"}
                    onPress={() => setBoardVisible((current) => !current)}
                    style={styles.timerButton}
                  />
                </View>
                <TextInput
                  style={uiStyles.input}
                  placeholder="Enter best move, e.g. Qxf7+ or h5f7"
                  placeholderTextColor={palette.muted}
                  value={answer}
                  onChangeText={setAnswer}
                  autoCapitalize="none"
                />
                <PrimaryButton
                  title={submitting ? "Checking..." : "Submit continuation"}
                  icon="send"
                  onPress={submitAnswer}
                  disabled={!answer.trim() || submitting}
                />
              </PremiumPanel>

              {result ? (
                <PremiumPanel dark style={styles.resultPanel}>
                  <Text style={result.is_correct ? styles.correctTitle : styles.incorrectTitle}>
                    {result.message}
                  </Text>
                  <Text style={styles.resultText}>{result.feedback}</Text>
                  {result.missed_tactic ? (
                    <Text style={styles.tacticText}>Missed tactic: {result.missed_tactic}</Text>
                  ) : null}
                  <View style={styles.resultStats}>
                    <StatPill icon="brain" value={result.calculation_depth} label="depth" tone="gold" />
                    <StatPill icon="eye-check" value={result.visualization_score} label="visualization" />
                  </View>
                </PremiumPanel>
              ) : null}
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
  promptPanel: {
    gap: 8,
    marginBottom: 14,
  },
  panelLabel: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  promptTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26,
  },
  previewLine: {
    color: palette.goldSoft,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  boardWrap: {
    alignItems: "center",
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    minHeight: 318,
    padding: 8,
  },
  blindBoard: {
    alignItems: "center",
    backgroundColor: palette.charcoal,
    borderColor: palette.lineDark,
    borderRadius: 8,
    borderWidth: 1,
    height: 300,
    justifyContent: "center",
    padding: 20,
    width: 300,
  },
  blindTitle: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: "900",
  },
  blindText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
  },
  answerPanel: {
    gap: 12,
    marginBottom: 14,
  },
  timerRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  timerText: {
    color: palette.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
    minWidth: 150,
  },
  timerButton: {
    minHeight: 46,
  },
  resultPanel: {
    gap: 10,
  },
  correctTitle: {
    color: "#1E8E54",
    fontSize: 20,
    fontWeight: "900",
  },
  incorrectTitle: {
    color: palette.danger,
    fontSize: 20,
    fontWeight: "900",
  },
  resultText: {
    color: palette.mutedDark,
    fontSize: 14,
    lineHeight: 20,
  },
  tacticText: {
    color: palette.goldSoft,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
  },
  resultStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
