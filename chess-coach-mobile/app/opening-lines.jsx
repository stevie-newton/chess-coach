import { StyleSheet, Text, View } from "react-native";
import {
  AppShell,
  PremiumPanel,
  SectionHeader,
  StatPill,
  palette,
} from "../src/components/PremiumUI";

const lineFields = [
  ["FEN position", "Exact board state where the line is trained."],
  ["Best move", "The move the user should know from this position."],
  ["Move order", "The sequence number inside the variation."],
  ["Explanation", "Why the move works and what plan it supports."],
  ["Variation name", "Human label such as Main Line or Anti-Fried Liver."],
  ["Difficulty", "Easy, medium, hard, or another training level."],
];

const sampleMoves = [
  ["Move 1", "e2e4"],
  ["Move 2", "g1f3"],
  ["Move 3", "f1c4"],
];

export default function OpeningLines() {
  return (
    <AppShell
      showBack
      eyebrow="Opening Lines"
      title="Positions and moves inside a repertoire."
      subtitle="Each line belongs to an opening repertoire and stores the exact position, best move, order, explanation, variation name, and difficulty."
    >
      <View style={styles.statsRow}>
        <StatPill icon="source-branch" value="Line" label="unit" tone="gold" />
        <StatPill icon="chess-knight" value="FEN" label="position" tone="sage" />
      </View>

      <PremiumPanel dark style={styles.examplePanel}>
        <Text style={styles.panelLabel}>Example</Text>
        <Text style={styles.panelTitle}>Italian Game to Main Line</Text>
        <View style={styles.moveList}>
          {sampleMoves.map(([label, move]) => (
            <View key={label} style={styles.moveRow}>
              <Text style={styles.moveLabel}>{label}</Text>
              <Text style={styles.moveValue}>{move}</Text>
            </View>
          ))}
        </View>
      </PremiumPanel>

      <SectionHeader label="Line Storage" />
      <PremiumPanel style={styles.fieldPanel}>
        {lineFields.map(([title, body]) => (
          <View key={title} style={styles.fieldRow}>
            <Text style={styles.fieldTitle}>{title}</Text>
            <Text style={styles.fieldBody}>{body}</Text>
          </View>
        ))}
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
  examplePanel: {
    gap: 12,
    marginBottom: 18,
  },
  panelLabel: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  panelTitle: {
    color: palette.ink,
    fontSize: 21,
    fontWeight: "900",
  },
  moveList: {
    gap: 8,
  },
  moveRow: {
    alignItems: "center",
    backgroundColor: palette.paper,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 12,
  },
  moveLabel: {
    color: palette.mutedDark,
    fontSize: 13,
    fontWeight: "800",
  },
  moveValue: {
    color: palette.goldSoft,
    fontSize: 16,
    fontWeight: "900",
  },
  fieldPanel: {
    gap: 12,
  },
  fieldRow: {
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    paddingBottom: 11,
  },
  fieldTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  fieldBody: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
});
