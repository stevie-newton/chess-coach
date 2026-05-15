import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import {
  AppShell,
  FeatureRow,
  PremiumPanel,
  PrimaryButton,
  SectionHeader,
  StatPill,
  palette,
} from "../src/components/PremiumUI";
import OpeningBoard from "../src/components/OpeningBoard";

const openingLayers = [
  {
    title: "1. Opening Repertoire",
    subtitle: "Parent category for each opening system you prepare, such as Italian Game or Sicilian Defense.",
    icon: "bookshelf",
    accent: palette.gold,
    href: "/opening-lines",
  },
  {
    title: "2. Opening Lines",
    subtitle: "Concrete branches, move orders, notes, traps, and responses stored under a repertoire.",
    icon: "source-branch",
    accent: palette.teal,
    href: "/opening-lines",
  },
  {
    title: "3. Opening Board",
    subtitle: "The board view for studying positions, plans, candidate moves, and common structures.",
    icon: "checkerboard",
    accent: palette.sage,
    href: "/openings",
  },
  {
    title: "4. Opening Practice",
    subtitle: "Memory training that asks you to recall moves from your saved lines under pressure.",
    icon: "chess-bishop",
    accent: palette.wine,
    href: "/opening-practice",
  },
  {
    title: "5. Opening Progress Tracking",
    subtitle: "Measure recall, weak branches, review due dates, and tournament readiness over time.",
    icon: "chart-timeline-variant",
    accent: palette.gold,
    href: "/(tabs)/coach",
  },
];

const repertoireExamples = [
  "Italian Game",
  "Sicilian Defense",
  "Queen's Gambit",
  "King's Indian Defense",
];

const sampleOpeningPosition = {
  fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 2 3",
  bestMove: "g8f6",
  explanation: "Develop the kingside knight, attack e4, and prepare to castle while staying in the main Italian structure.",
};

export default function Openings() {
  return (
    <AppShell
      showBack
      eyebrow="Opening Board"
      title="Five-layer opening system."
      subtitle="Build repertoire categories, save concrete lines, study them on a board, drill from memory, and track progress."
    >
      <View style={styles.statsRow}>
        <StatPill icon="layers-triple" value="5" label="layers" tone="gold" />
        <StatPill icon="bookshelf" value="Repertoire" label="parent" tone="sage" />
      </View>

      <PremiumPanel dark style={styles.systemPanel}>
        <Text style={styles.panelLabel}>Layer 1</Text>
        <Text style={styles.panelTitle}>Opening Repertoire is the parent category.</Text>
        <Text style={styles.panelText}>
          Each repertoire stores the general information for an opening: color, purpose, strategic themes, key plans, model positions, notes, and the lines that belong under it.
        </Text>
        <View style={styles.exampleGrid}>
          {repertoireExamples.map((opening) => (
            <View key={opening} style={styles.exampleChip}>
              <Text style={styles.exampleText}>{opening}</Text>
            </View>
          ))}
        </View>
        <PrimaryButton
          title="Build repertoire"
          icon="source-branch"
          tone="light"
          onPress={() => router.push("/opening-lines")}
        />
      </PremiumPanel>

      <SectionHeader label="Visual Opening Board" />
      <OpeningBoard
        fen={sampleOpeningPosition.fen}
        bestMove={sampleOpeningPosition.bestMove}
        explanation={sampleOpeningPosition.explanation}
      />

      <SectionHeader label="Opening Board Layers" />
      {openingLayers.map((track) => (
        <FeatureRow
          key={track.title}
          title={track.title}
          subtitle={track.subtitle}
          icon={track.icon}
          accent={track.accent}
          onPress={() => router.push(track.href)}
        />
      ))}
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
  systemPanel: {
    gap: 10,
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
    lineHeight: 26,
  },
  panelText: {
    color: palette.mutedDark,
    fontSize: 14,
    lineHeight: 20,
  },
  exampleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  exampleChip: {
    backgroundColor: palette.paper,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  exampleText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "800",
  },
});
