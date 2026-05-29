import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import {
  AppShell,
  FeatureRow,
  PremiumPanel,
  PrimaryButton,
  SectionHeader,
  StatPill,
  palette,
} from "../components/PremiumUI";

const playTraining = [
  {
    title: "Practice Game",
    subtitle: "Play a full coach game, then save, analyze, and turn it into review work.",
    icon: "chess-board",
    accent: palette.sage,
    href: "/game-session",
  },
];

const skillDrills = [
  {
    title: "Tactics Trainer",
    subtitle: "Solve generated tactical positions and sharpen forcing moves.",
    icon: "puzzle",
    accent: palette.gold,
    href: "/(tabs)/puzzles",
  },
  {
    title: "Opening Trainer",
    subtitle: "Build a repertoire, study lines, and drill recall from your board.",
    icon: "book-open-page-variant",
    accent: palette.teal,
    href: "/openings",
  },
  {
    title: "Endgame Trainer",
    subtitle: "Practice conversion, opposition, pawn races, and technical saves.",
    icon: "chess-king",
    accent: palette.sage,
    href: "/endgames",
  },
  {
    title: "Positional Play",
    subtitle: "Train plans, weak squares, pawn structure, and piece improvement.",
    icon: "checkerboard",
    accent: palette.wine,
    href: "/positional-play",
  },
  {
    title: "Checkmate Patterns",
    subtitle: "Recognize classic mating nets before the chance disappears.",
    icon: "chess-queen",
    accent: palette.gold,
    href: "/checkmate-patterns",
  },
  {
    title: "Calculation Training",
    subtitle: "Work through candidate moves, variations, and blunder checks.",
    icon: "brain",
    accent: palette.teal,
    href: "/calculation-training",
  },
];

const reviewAndPlanning = [
  {
    title: "AI Coach Analysis",
    subtitle: "Ask the coach to explain mistakes, plans, and next study blocks.",
    icon: "account-tie-voice",
    accent: palette.sage,
    href: "/(tabs)/coach",
  },
  {
    title: "Custom Training Plan",
    subtitle: "Shape a weekly plan around your weaknesses and available time.",
    icon: "calendar-check",
    accent: palette.wine,
    href: "/study-schedule",
  },
];

const trainingPathCount = playTraining.length + skillDrills.length + reviewAndPlanning.length;

export default function TrainingScreen({ showBack = false }) {
  const [skillProfile, setSkillProfile] = useState(null);

  useEffect(() => {
    async function loadSkillProfile() {
      try {
        const response = await api.get("/dashboard/summary");
        setSkillProfile(response.data?.skill_profile || null);
      } catch (error) {
        console.log(error.response?.data || error.message);
      }
    }

    loadSkillProfile();
  }, []);

  const adaptation = skillProfile?.adaptation;

  return (
    <AppShell
      showBack={showBack}
      eyebrow="Training"
      title="Choose a training path."
      subtitle="Play a full practice game, drill a specific chess skill, or follow the daily plan built from your recent work."
    >
      <View style={styles.statsRow}>
        <StatPill icon="target" value={trainingPathCount} label="paths" tone="gold" />
        <StatPill icon="school" value={skillProfile?.detected_level || "Detecting"} label="skill" tone="sage" />
      </View>

      {skillProfile ? (
        <PremiumPanel style={styles.skillPanel}>
          <View style={styles.skillTopLine}>
            <View style={styles.skillTitleWrap}>
              <Text style={styles.panelLabel}>Skill Detection</Text>
              <Text style={styles.skillTitle}>{skillProfile.detected_level}</Text>
            </View>
            <Text style={styles.confidenceBadge}>{skillProfile.confidence}</Text>
          </View>
          <View style={styles.adaptationGrid}>
            <View style={styles.adaptationItem}>
              <Text style={styles.adaptationLabel}>Puzzle difficulty</Text>
              <Text style={styles.adaptationText}>{adaptation?.puzzle_difficulty}</Text>
            </View>
            <View style={styles.adaptationItem}>
              <Text style={styles.adaptationLabel}>Lessons</Text>
              <Text style={styles.adaptationText}>{adaptation?.lesson_complexity}</Text>
            </View>
            <View style={styles.adaptationItem}>
              <Text style={styles.adaptationLabel}>Engine depth</Text>
              <Text style={styles.adaptationText}>Depth {adaptation?.engine_depth}</Text>
            </View>
            <View style={styles.adaptationItem}>
              <Text style={styles.adaptationLabel}>Coach language</Text>
              <Text style={styles.adaptationText}>{adaptation?.coaching_language}</Text>
            </View>
          </View>
        </PremiumPanel>
      ) : null}

      <PremiumPanel dark style={styles.dailyPanel}>
        <Text style={styles.panelLabel}>Recommended</Text>
        <Text style={styles.panelTitle}>{"Continue today's training session."}</Text>
        <Text style={styles.panelText}>
          Use your schedule, due mistake reviews, puzzles, and weaknesses for one focused workout.
        </Text>
        <PrimaryButton
          title="Open daily training"
          icon="play"
          tone="light"
          onPress={() => router.push("/daily-training")}
        />
      </PremiumPanel>

      <SectionHeader label="Play A Game" />
      {playTraining.map((category) => (
        <FeatureRow
          key={category.title}
          title={category.title}
          subtitle={category.subtitle}
          icon={category.icon}
          accent={category.accent}
          onPress={() => router.push(category.href)}
        />
      ))}

      <SectionHeader label="Focused Drills" />
      {skillDrills.map((category) => (
        <FeatureRow
          key={category.title}
          title={category.title}
          subtitle={category.subtitle}
          icon={category.icon}
          accent={category.accent}
          onPress={() => router.push(category.href)}
        />
      ))}

      <SectionHeader label="Review And Planning" />
      {reviewAndPlanning.map((category) => (
        <FeatureRow
          key={category.title}
          title={category.title}
          subtitle={category.subtitle}
          icon={category.icon}
          accent={category.accent}
          onPress={() => router.push(category.href)}
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
  dailyPanel: {
    gap: 10,
    marginBottom: 18,
  },
  skillPanel: {
    gap: 14,
    marginBottom: 14,
  },
  skillTopLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  skillTitleWrap: {
    flex: 1,
    gap: 4,
  },
  skillTitle: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: "900",
  },
  confidenceBadge: {
    backgroundColor: "#3A3219",
    borderColor: palette.gold,
    borderRadius: 8,
    borderWidth: 1,
    color: palette.goldSoft,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
    textTransform: "uppercase",
  },
  adaptationGrid: {
    gap: 9,
  },
  adaptationItem: {
    backgroundColor: palette.ivory,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 11,
  },
  adaptationLabel: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  adaptationText: {
    color: palette.mutedDark,
    fontSize: 13,
    lineHeight: 18,
  },
  panelLabel: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  panelTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 27,
  },
  panelText: {
    color: palette.mutedDark,
    fontSize: 14,
    lineHeight: 20,
  },
});
