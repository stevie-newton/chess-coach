import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
import { openingDetails, openingLibrary, recommendedOpenings } from "../src/data/openingLibrary";
import {
  buildAdaptiveOpeningReport,
  getOpeningProgress,
  getSavedRepertoire,
  toggleSavedOpening,
} from "../src/utils/repertoireStorage";

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

const repertoireSections = [
  {
    key: "white",
    title: "White repertoire",
    subtitle: "Openings you can start with the white pieces.",
    icon: "chess-king",
  },
  {
    key: "blackE4",
    title: "Black vs 1.e4",
    subtitle: "Defenses prepared for king-pawn games.",
    icon: "shield-sword",
  },
  {
    key: "blackD4",
    title: "Black vs 1.d4",
    subtitle: "Defenses prepared for queen-pawn and closed games.",
    icon: "shield-half-full",
  },
  {
    key: "backup",
    title: "Backup lines",
    subtitle: "Other saved systems and surprise weapons.",
    icon: "bookmark-multiple-outline",
  },
];

const sampleOpeningPosition = {
  fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 2 3",
  bestMove: "g8f6",
  explanation: "Develop the kingside knight, attack e4, and prepare to castle while staying in the main Italian structure.",
};

function firstLineStartsWith(opening, move) {
  return opening?.mainLine?.[0]?.replace(/\s+/g, " ").startsWith(`1. ${move}`);
}

function repertoireBucketFor(openingName) {
  const opening = openingDetails[openingName];

  if (!opening) {
    return "backup";
  }

  if (opening.color === "White") {
    return "white";
  }

  if (firstLineStartsWith(opening, "e4")) {
    return "blackE4";
  }

  if (firstLineStartsWith(opening, "d4")) {
    return "blackD4";
  }

  return "backup";
}

function buildStructuredRepertoire(savedRepertoire) {
  return savedRepertoire.reduce(
    (groups, opening) => {
      groups[repertoireBucketFor(opening)].push(opening);
      return groups;
    },
    {
      white: [],
      blackE4: [],
      blackD4: [],
      backup: [],
    }
  );
}

export default function Openings() {
  const [savedRepertoire, setSavedRepertoire] = useState([]);
  const [adaptiveReport, setAdaptiveReport] = useState([]);
  const structuredRepertoire = buildStructuredRepertoire(savedRepertoire);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      Promise.all([getSavedRepertoire(), getOpeningProgress()]).then(([repertoire, progress]) => {
        if (active) {
          setSavedRepertoire(repertoire);
          setAdaptiveReport(buildAdaptiveOpeningReport(progress, repertoire));
        }
      });

      return () => {
        active = false;
      };
    }, [])
  );

  const handleToggleOpening = async (opening) => {
    const result = await toggleSavedOpening(opening);
    setSavedRepertoire(result.repertoire);
    const progress = await getOpeningProgress();
    setAdaptiveReport(buildAdaptiveOpeningReport(progress, result.repertoire));
  };

  const renderOpeningRow = (opening, recommended = false) => {
    const saved = savedRepertoire.includes(opening);

    return (
      <Pressable
        key={opening}
        accessibilityRole="button"
        onPress={() => router.push({ pathname: "/opening-detail", params: { name: opening } })}
        style={({ pressed }) => [
          recommended ? styles.recommendedRow : styles.openingRow,
          pressed && styles.openingRowPressed,
        ]}
      >
        <MaterialCommunityIcons name={saved ? "check-circle" : "circle-outline"} size={19} color={palette.gold} />
        <Text style={styles.openingName}>{opening}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? `Remove ${opening} from repertoire` : `Save ${opening} to repertoire`}
          hitSlop={10}
          onPress={(event) => {
            event.stopPropagation();
            handleToggleOpening(opening);
          }}
          style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
        >
          <MaterialCommunityIcons
            name={saved ? "bookmark-check" : "bookmark-outline"}
            size={22}
            color={saved ? palette.goldSoft : palette.muted}
          />
        </Pressable>
        <MaterialCommunityIcons name="chevron-right" size={21} color={palette.muted} />
      </Pressable>
    );
  };

  return (
    <AppShell
      showBack
      eyebrow="Opening Board"
      title="Five-layer opening system."
      subtitle="Build repertoire categories, save concrete lines, study them on a board, drill from memory, and track progress."
    >
      <View style={styles.statsRow}>
        <StatPill icon="layers-triple" value="5" label="layers" tone="gold" />
        <StatPill icon="bookshelf" value={savedRepertoire.length} label="saved" tone="sage" />
        <StatPill icon="target" value={adaptiveReport.length} label="weak spots" tone="wine" />
      </View>

      <SectionHeader label="Adaptive Learning" />
      <PremiumPanel dark style={styles.adaptivePanel}>
        <View style={styles.adaptiveHeader}>
          <MaterialCommunityIcons name="brain" size={24} color={palette.goldSoft} />
          <View style={styles.adaptiveHeaderText}>
            <Text style={styles.adaptiveTitle}>Automatic retraining queue.</Text>
            <Text style={styles.adaptiveText}>
              The app tracks forgotten lines, mistakes, and weak variations, then pushes the hardest openings back into practice.
            </Text>
          </View>
        </View>

        {adaptiveReport.length ? (
          <View style={styles.adaptiveList}>
            {adaptiveReport.slice(0, 3).map((item) => (
              <Pressable
                key={item.openingName}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: "/opening-detail", params: { name: item.openingName, practice: Date.now().toString() } })}
                style={({ pressed }) => [styles.adaptiveCard, pressed && styles.openingRowPressed]}
              >
                <View style={styles.adaptiveCardTop}>
                  <Text style={styles.adaptiveOpeningName}>{item.openingName}</Text>
                  <Text style={styles.adaptiveMistakes}>{item.mistakes} mistakes</Text>
                </View>
                <Text style={styles.adaptiveIssue}>Forgotten line: {item.forgottenLine}</Text>
                <Text style={styles.adaptiveIssue}>Weak variation: {item.weakVariation}</Text>
                <View style={styles.adaptiveAction}>
                  <Text style={styles.adaptiveActionText}>Retrain now</Text>
                  <MaterialCommunityIcons name="arrow-right" size={18} color={palette.goldSoft} />
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.adaptiveEmpty}>
            <Text style={styles.adaptiveEmptyTitle}>No weak openings yet.</Text>
            <Text style={styles.adaptiveText}>
              Practice an opening board or quiz. Missed moves will appear here for automatic review.
            </Text>
          </View>
        )}
      </PremiumPanel>

      <SectionHeader label="My Repertoire" />
      <PremiumPanel style={styles.myRepertoirePanel}>
        {savedRepertoire.length ? (
          <View style={styles.repertoireGroups}>
            {repertoireSections.map((section) => (
              <View key={section.key} style={styles.repertoireSection}>
                <View style={styles.repertoireSectionHeader}>
                  <View style={styles.repertoireIcon}>
                    <MaterialCommunityIcons name={section.icon} size={20} color={palette.goldSoft} />
                  </View>
                  <View style={styles.repertoireCopy}>
                    <Text style={styles.repertoireTitle}>{section.title}</Text>
                    <Text style={styles.repertoireSubtitle}>{section.subtitle}</Text>
                  </View>
                  <Text style={styles.repertoireCount}>{structuredRepertoire[section.key].length}</Text>
                </View>
                {structuredRepertoire[section.key].length ? (
                  <View style={styles.openingList}>
                    {structuredRepertoire[section.key].map((opening) => renderOpeningRow(opening))}
                  </View>
                ) : (
                  <Text style={styles.repertoireEmptyText}>No saved openings here yet.</Text>
                )}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyRepertoire}>
            <MaterialCommunityIcons name="bookmark-plus-outline" size={24} color={palette.gold} />
            <Text style={styles.emptyRepertoireTitle}>Save favorite openings here.</Text>
            <Text style={styles.emptyRepertoireText}>
              Tap the bookmark beside openings like London System, Sicilian Defense, or French Defense to build your repertoire.
            </Text>
          </View>
        )}
      </PremiumPanel>

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

      <SectionHeader label="Recommended Openings" />
      <PremiumPanel style={styles.recommendationPanel}>
        {recommendedOpenings.map((group) => (
          <View key={group.style} style={styles.recommendationGroup}>
            <Text style={styles.recommendationTitle}>{group.style}</Text>
            <Text style={styles.recommendationNote}>{group.note}</Text>
            <View style={styles.openingList}>
              {group.openings.map((opening) => (
                renderOpeningRow(opening, true)
              ))}
            </View>
          </View>
        ))}
      </PremiumPanel>

      <SectionHeader label="Opening Library" />
      <PremiumPanel style={styles.libraryPanel}>
        {Object.entries(openingLibrary).map(([color, openings]) => (
          <View key={color} style={styles.libraryGroup}>
            <Text style={styles.libraryGroupTitle}>For {color}</Text>
            <View style={styles.openingList}>
              {openings.map((opening) => (
                renderOpeningRow(opening)
              ))}
            </View>
          </View>
        ))}
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
  myRepertoirePanel: {
    gap: 12,
    marginBottom: 18,
  },
  repertoireGroups: {
    gap: 14,
  },
  repertoireSection: {
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 11,
  },
  repertoireSectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  repertoireIcon: {
    alignItems: "center",
    backgroundColor: "#3A3219",
    borderRadius: 8,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  repertoireCopy: {
    flex: 1,
    gap: 3,
  },
  repertoireTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  repertoireSubtitle: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  repertoireCount: {
    color: palette.gold,
    fontSize: 18,
    fontWeight: "900",
  },
  repertoireEmptyText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  adaptivePanel: {
    gap: 13,
    marginBottom: 18,
  },
  adaptiveHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
  },
  adaptiveHeaderText: {
    flex: 1,
  },
  adaptiveTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 25,
  },
  adaptiveText: {
    color: palette.mutedDark,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 4,
  },
  adaptiveList: {
    gap: 9,
  },
  adaptiveCard: {
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 7,
    padding: 12,
  },
  adaptiveCardTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  adaptiveOpeningName: {
    color: palette.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
  },
  adaptiveMistakes: {
    color: palette.danger,
    fontSize: 12,
    fontWeight: "900",
  },
  adaptiveIssue: {
    color: palette.mutedDark,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
  adaptiveAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 2,
  },
  adaptiveActionText: {
    color: palette.goldSoft,
    fontSize: 13,
    fontWeight: "900",
  },
  adaptiveEmpty: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  adaptiveEmptyTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  emptyRepertoire: {
    alignItems: "flex-start",
    gap: 7,
  },
  emptyRepertoireTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  emptyRepertoireText: {
    color: palette.mutedDark,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
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
  libraryPanel: {
    gap: 18,
    marginBottom: 18,
  },
  recommendationPanel: {
    gap: 18,
    marginBottom: 18,
  },
  recommendationGroup: {
    gap: 9,
  },
  recommendationTitle: {
    color: palette.goldSoft,
    fontSize: 16,
    fontWeight: "900",
  },
  recommendationNote: {
    color: palette.mutedDark,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  libraryGroup: {
    gap: 10,
  },
  libraryGroupTitle: {
    color: palette.goldSoft,
    fontSize: 15,
    fontWeight: "900",
  },
  openingList: {
    gap: 8,
  },
  openingRow: {
    alignItems: "center",
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  recommendedRow: {
    alignItems: "center",
    backgroundColor: "#243A2D",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  openingRowPressed: {
    opacity: 0.76,
    transform: [{ scale: 0.99 }],
  },
  saveButton: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  saveButtonPressed: {
    opacity: 0.68,
  },
  openingName: {
    color: palette.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
});
