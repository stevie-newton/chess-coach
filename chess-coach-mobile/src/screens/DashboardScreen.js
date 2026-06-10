import { router } from "expo-router";
import { useContext, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
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
} from "../components/PremiumUI";
import { AuthContext } from "../context/AuthContext";

const trainingLinks = [
  ["Games", "Review imports, notes, and analysis queues.", "chess-knight", "/(tabs)/games", palette.sage],
  ["Training", "Replay mistakes and keep your daily work moving.", "target", "/(tabs)/training", palette.teal],
  ["Coach", "Ask OpenAI for summaries, mistake explanations, and plans.", "account-tie-voice", "/(tabs)/coach", palette.gold],
  ["Puzzles", "Work through tactics shaped around your progress.", "puzzle", "/(tabs)/puzzles", palette.wine],
  ["Opening Board", "Prepare tournaments, drill memory, and build your repertoire.", "book-open-page-variant", "/openings", palette.gold],
];

const clampPercent = (value) => Math.max(0, Math.min(100, Number(value) || 0));
const roadmapLevels = [
  ["beginner", "Beginner", "Build reliable habits and stop the biggest one-move losses.", 35, 20, 20, 10, 15],
  ["club_player", "Club Player", "Play complete games with basic plans and fewer simple blunders.", 55, 40, 40, 35, 40],
  ["intermediate", "Intermediate", "Convert advantages, calculate short lines, and follow a stable repertoire.", 70, 60, 60, 60, 60],
  ["advanced", "Advanced", "Prepare deeply, calculate under pressure, and review games like a tournament player.", 85, 78, 78, 80, 80],
];

function buildLocalRoadmap(summary) {
  const progress = summary.progress || {};
  const skills = {
    tactics: clampPercent(progress.tactics?.score),
    openings: clampPercent(progress.openings?.score ?? summary.openings?.mastery),
    endgames: clampPercent(progress.endgames?.score),
    calculation: clampPercent((summary.progression?.calculation_completions || 0) * 5),
    time_management: clampPercent(
      ((summary.progression?.training_streak || summary.user?.training_streak || 0) * 3)
      + ((summary.training?.completion_rate || 0) * 0.35)
      + ((summary.tournaments?.win_rate || 0) * 0.25)
    ),
  };
  const skillKeys = ["tactics", "openings", "endgames", "calculation", "time_management"];
  let currentLevel = "Beginner";
  const levels = roadmapLevels.map(([key, title, description, tactics, openings, endgames, calculation, timeManagement]) => {
    const targets = { tactics, openings, endgames, calculation, time_management: timeManagement };
    const skillRows = skillKeys.map((skillKey) => ({
      key: skillKey,
      label: skillKey.replace("_", " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      score: skills[skillKey],
      target: targets[skillKey],
      complete: skills[skillKey] >= targets[skillKey],
    }));
    const complete = skillRows.every((skill) => skill.complete);
    const levelProgress = Math.round(
      skillRows.reduce((total, skill) => total + Math.min(skill.score, skill.target) / skill.target, 0)
      / skillRows.length
      * 100
    );

    if (complete) {
      currentLevel = title;
    }

    return { key, title, description, progress: levelProgress, complete, skills: skillRows };
  });
  const nextLevel = levels.find((level) => !level.complete) || levels[levels.length - 1];
  const nextFocus = nextLevel.skills.reduce((weakest, skill) =>
    skill.score / skill.target < weakest.score / weakest.target ? skill : weakest
  );

  return {
    current_level: currentLevel,
    next_level: nextLevel.title,
    next_focus: nextFocus,
    skills,
    levels,
  };
}

function TodayMission({ mission }) {
  if (!mission) {
    return null;
  }

  return (
    <>
      <SectionHeader label="Today's Mission" action={`${mission.estimated_minutes || 0} min`} />
      <PremiumPanel dark style={styles.missionPanel}>
        <Text style={styles.panelLabel}>{mission.focus || "Personal training"}</Text>
        <Text style={styles.missionTitle}>{mission.title}</Text>
        <Text style={styles.missionText}>{mission.message}</Text>
      </PremiumPanel>
      {(mission.tasks || []).map((task, index) => (
        <FeatureRow
          key={`${task.title}-${index}`}
          title={task.title}
          subtitle={task.detail}
          icon={task.icon || "target"}
          meta={`${task.minutes || 0}m`}
          accent={index === 0 ? palette.gold : index === 1 ? palette.teal : palette.sage}
          onPress={() => task.href && router.push(task.href)}
        />
      ))}
    </>
  );
}

function PlayerRoadmap({ roadmap }) {
  if (!roadmap) {
    return null;
  }

  return (
    <>
      <SectionHeader label="Player Roadmap" action={roadmap.current_level} />
      <PremiumPanel dark style={styles.roadmapPanel}>
        <Text style={styles.panelLabel}>Next focus</Text>
        <Text style={styles.roadmapTitle}>
          {roadmap.next_level}: {roadmap.next_focus?.label || "Keep training"}
        </Text>
        <Text style={styles.roadmapText}>
          Reach {Math.round(roadmap.next_focus?.target || 0)}% in this skill to move closer to the next level.
        </Text>
      </PremiumPanel>

      {(roadmap.levels || []).map((level, index) => (
        <PremiumPanel key={level.key} style={[styles.roadmapLevel, level.complete && styles.roadmapLevelComplete]}>
          <View style={styles.roadmapLevelTop}>
            <View style={styles.roadmapStep}>
              <Text style={styles.roadmapStepText}>{index + 1}</Text>
            </View>
            <View style={styles.roadmapLevelCopy}>
              <Text style={styles.roadmapLevelTitle}>{level.title}</Text>
              <Text style={styles.roadmapLevelText}>{level.description}</Text>
            </View>
            <Text style={styles.roadmapPercent}>{Math.round(level.progress || 0)}%</Text>
          </View>
          <View style={styles.roadmapTrack}>
            <View style={[styles.roadmapFill, { width: `${clampPercent(level.progress)}%` }]} />
          </View>
          <View style={styles.skillGrid}>
            {(level.skills || []).map((skill) => (
              <View key={skill.key} style={[styles.skillChip, skill.complete && styles.skillChipComplete]}>
                <Text style={styles.skillChipLabel}>{skill.label}</Text>
                <Text style={styles.skillChipValue}>
                  {Math.round(skill.score || 0)}/{Math.round(skill.target || 0)}
                </Text>
              </View>
            ))}
          </View>
        </PremiumPanel>
      ))}
    </>
  );
}

export default function DashboardScreen() {
  const { logout } = useContext(AuthContext);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    try {
      const response = await api.get("/dashboard/summary");
      setSummary(response.data);
    } catch (error) {
      console.log(error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/auth/login");
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <AppShell scroll={false} showTopBar={false} contentStyle={styles.centerShell}>
        <LoadingState
          title="Loading your dashboard"
          body="Pulling together your training snapshot."
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      eyebrow="Dashboard"
      title="Your chess cockpit."
      subtitle="Track games, training, puzzles, and the next focused work session."
      action={<PrimaryButton title="Logout" icon="logout" onPress={handleLogout} />}
    >
      {summary ? (
        <>
          <View style={styles.statsRow}>
            <StatPill icon="chess-pawn" value={summary.games?.total ?? 0} label="games" tone="gold" />
            <StatPill icon="target" value={`${summary.training?.completion_rate ?? 0}%`} label="training" />
            <StatPill icon="puzzle" value={`${summary.puzzles?.success_rate ?? 0}%`} label="puzzles" tone="wine" />
          </View>

          <PremiumPanel dark style={styles.profilePanel}>
            <Text style={styles.panelLabel}>Player profile</Text>
            <Text style={styles.playerName}>{summary.user?.username || "Chess Coach player"}</Text>
            <Text style={styles.profileText}>
              Level: {summary.user?.chess_level || "Not set"} | Target: {summary.user?.target_rating || "Not set"}
            </Text>
          </PremiumPanel>

          <TodayMission mission={summary.today_mission} />
          <PlayerRoadmap roadmap={summary.player_roadmap || buildLocalRoadmap(summary)} />
        </>
      ) : (
        <EmptyState
          icon="chart-box-outline"
          title="No dashboard data yet"
          body="Start by importing games so the coach can build your training picture."
          actionTitle="Import games"
          onAction={() => router.push("/import-games")}
        />
      )}

      <SectionHeader label="Training Areas" action="Bottom tabs" />
      {trainingLinks.map(([title, subtitle, icon, href, accent]) => (
        <FeatureRow
          key={title}
          title={title}
          subtitle={subtitle}
          icon={icon}
          accent={accent}
          onPress={() => router.push(href)}
        />
      ))}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  centerShell: {
    justifyContent: "center",
  },
  loadingPanel: {
    alignItems: "center",
    gap: 10,
  },
  loadingTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "900",
  },
  loadingText: {
    color: palette.muted,
    fontSize: 14,
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginBottom: 14,
  },
  profilePanel: {
    gap: 7,
    marginBottom: 18,
  },
  panelLabel: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  playerName: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: "900",
  },
  profileText: {
    color: palette.mutedDark,
    fontSize: 14,
  },
  missionPanel: {
    gap: 8,
    marginBottom: 11,
  },
  missionTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 27,
  },
  missionText: {
    color: palette.mutedDark,
    fontSize: 14,
    lineHeight: 20,
  },
  roadmapPanel: {
    gap: 8,
    marginBottom: 11,
  },
  roadmapTitle: {
    color: palette.ink,
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 26,
  },
  roadmapText: {
    color: palette.mutedDark,
    fontSize: 14,
    lineHeight: 20,
  },
  roadmapLevel: {
    gap: 12,
    marginBottom: 11,
  },
  roadmapLevelComplete: {
    borderColor: "rgba(30,142,84,0.58)",
  },
  roadmapLevelTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  roadmapStep: {
    alignItems: "center",
    backgroundColor: "#3A3219",
    borderColor: palette.gold,
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  roadmapStepText: {
    color: palette.goldSoft,
    fontSize: 16,
    fontWeight: "900",
  },
  roadmapLevelCopy: {
    flex: 1,
    gap: 3,
  },
  roadmapLevelTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "900",
  },
  roadmapLevelText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  roadmapPercent: {
    color: palette.gold,
    fontSize: 15,
    fontWeight: "900",
  },
  roadmapTrack: {
    backgroundColor: "#252A34",
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    height: 12,
    overflow: "hidden",
  },
  roadmapFill: {
    backgroundColor: palette.gold,
    borderRadius: 8,
    height: "100%",
  },
  skillGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  skillChip: {
    backgroundColor: "rgba(15,17,21,0.48)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 112,
    padding: 9,
  },
  skillChipComplete: {
    backgroundColor: "rgba(30,142,84,0.14)",
    borderColor: "rgba(30,142,84,0.42)",
  },
  skillChipLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  skillChipValue: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 3,
  },
});
