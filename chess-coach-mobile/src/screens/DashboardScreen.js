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

function ProgressMetric({ label, value, detail, color = palette.gold }) {
  const percent = clampPercent(value);

  return (
    <View style={styles.metricBlock}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{percent}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: color }]} />
      </View>
      {detail ? <Text style={styles.metricDetail}>{detail}</Text> : null}
    </View>
  );
}

function CountBar({ label, value, max, color = palette.sage }) {
  const percent = max > 0 ? Math.max(8, Math.round((value / max) * 100)) : 0;

  return (
    <View style={styles.countRow}>
      <View style={styles.countLabelWrap}>
        <Text style={styles.countLabel}>{label}</Text>
        <Text style={styles.countValue}>{value}</Text>
      </View>
      <View style={styles.countTrack}>
        <View style={[styles.countFill, { width: `${percent}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function ProgressStatusRow({ label, status, score, detail }) {
  const statusColor = status === "Strong" ? "#1E8E54" : status === "Weak" ? palette.danger : palette.gold;

  return (
    <View style={styles.statusRow}>
      <View style={styles.statusCopy}>
        <Text style={styles.statusLabel}>{label}</Text>
        {detail ? <Text style={styles.statusDetail}>{detail}</Text> : null}
      </View>
      <View style={[styles.statusBadge, { borderColor: statusColor }]}>
        <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
        {typeof score === "number" ? <Text style={styles.statusScore}>{Math.round(score)}%</Text> : null}
      </View>
    </View>
  );
}

function YourProgress({ summary }) {
  const progress = summary.progress || {};
  const puzzles = summary.puzzles || {};
  const games = summary.games || {};
  const openings = summary.openings || {};
  const streaks = progress.streaks || {};

  return (
    <>
      <SectionHeader label="Your Progress" />
      <PremiumPanel dark style={styles.progressPanel}>
        <ProgressStatusRow
          label="Tactics"
          status={progress.tactics?.label || "Improving"}
          score={progress.tactics?.score}
          detail={progress.tactics?.detail}
        />
        <ProgressStatusRow
          label="Endgames"
          status={progress.endgames?.label || "Weak"}
          score={progress.endgames?.score}
          detail={progress.endgames?.detail}
        />
        <ProgressStatusRow
          label="Openings"
          status={progress.openings?.label || "Improving"}
          score={progress.openings?.score}
          detail={progress.openings?.detail}
        />
      </PremiumPanel>

      <View style={styles.statsRow}>
        <StatPill icon="chart-line" value={puzzles.rating ?? 1200} label="puzzle rating" tone="gold" />
        <StatPill icon="bookshelf" value={`${openings.mastery ?? 0}%`} label="opening mastery" tone="sage" />
        <StatPill icon="target" value={`${games.average_accuracy ?? 0}%`} label="accuracy" tone="wine" />
        <StatPill icon="fire" value={streaks.training ?? 0} label="training streak" />
        <StatPill icon="puzzle-star" value={streaks.puzzles ?? 0} label="puzzle streak" tone="gold" />
      </View>
    </>
  );
}

function AnalyticsGraphs({ summary }) {
  const games = summary.games || {};
  const training = summary.training || {};
  const puzzles = summary.puzzles || {};
  const tournaments = summary.tournaments || {};
  const weaknesses = summary.weaknesses || [];
  const totalIssues = (games.total_mistakes || 0) + (games.total_blunders || 0);
  const maxIssueCount = Math.max(games.total_mistakes || 0, games.total_blunders || 0, 1);
  const maxWeaknessScore = Math.max(
    ...weaknesses.map((weakness) => Math.max(weakness.severity || 0, weakness.frequency || 0)),
    1
  );

  return (
    <>
      <SectionHeader label="Analytics" action={`${games.analyzed || 0} analyzed`} />
      <PremiumPanel style={styles.analyticsPanel}>
        <Text style={styles.analyticsTitle}>Performance graph</Text>
        <ProgressMetric
          label="Average accuracy"
          value={games.average_accuracy}
          detail={`${games.total || 0} games imported`}
          color={palette.gold}
        />
        <ProgressMetric
          label="Training completion"
          value={training.completion_rate}
          detail={`${training.completed_sessions || 0} of ${training.total_sessions || 0} sessions complete`}
          color={palette.teal}
        />
        <ProgressMetric
          label="Puzzle success"
          value={puzzles.success_rate}
          detail={`${puzzles.correct || 0} correct from ${puzzles.attempts || 0} attempts`}
          color={palette.sage}
        />
        <ProgressMetric
          label="Tournament win rate"
          value={tournaments.win_rate}
          detail={`${tournaments.wins || 0} wins from ${tournaments.simulations || 0} simulations`}
          color={palette.wine}
        />
      </PremiumPanel>

      <PremiumPanel style={styles.analyticsPanel}>
        <View style={styles.analyticsTopLine}>
          <Text style={styles.analyticsTitle}>Mistake mix</Text>
          <Text style={styles.analyticsBadge}>{totalIssues} issues</Text>
        </View>
        <CountBar label="Mistakes" value={games.total_mistakes || 0} max={maxIssueCount} color={palette.gold} />
        <CountBar label="Blunders" value={games.total_blunders || 0} max={maxIssueCount} color={palette.wine} />
      </PremiumPanel>

      {weaknesses.length > 0 ? (
        <PremiumPanel style={styles.analyticsPanel}>
          <Text style={styles.analyticsTitle}>Weakness breakdown</Text>
          {weaknesses.map((weakness) => (
            <View key={weakness.category} style={styles.weaknessGraph}>
              <View style={styles.weaknessTop}>
                <Text style={styles.weaknessName}>{weakness.category}</Text>
                <Text style={styles.weaknessMeta}>
                  S{weakness.severity} / F{weakness.frequency}
                </Text>
              </View>
              <CountBar
                label="Severity"
                value={weakness.severity || 0}
                max={maxWeaknessScore}
                color={palette.wine}
              />
              <CountBar
                label="Frequency"
                value={weakness.frequency || 0}
                max={maxWeaknessScore}
                color={palette.teal}
              />
            </View>
          ))}
        </PremiumPanel>
      ) : null}
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

          <YourProgress summary={summary} />
          <AnalyticsGraphs summary={summary} />
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
  progressPanel: {
    gap: 11,
    marginBottom: 14,
  },
  statusRow: {
    alignItems: "center",
    backgroundColor: "rgba(15,17,21,0.54)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    minHeight: 72,
    padding: 12,
  },
  statusCopy: {
    flex: 1,
    gap: 4,
  },
  statusLabel: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "900",
  },
  statusDetail: {
    color: palette.mutedDark,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  statusBadge: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 96,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "900",
  },
  statusScore: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 2,
  },
  analyticsPanel: {
    gap: 14,
    marginBottom: 14,
  },
  analyticsTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  analyticsTopLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  analyticsBadge: {
    backgroundColor: "#2A2E38",
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    color: palette.gold,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  metricBlock: {
    gap: 7,
  },
  metricHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  metricLabel: {
    color: palette.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  metricValue: {
    color: palette.gold,
    fontSize: 14,
    fontWeight: "900",
  },
  metricDetail: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  progressTrack: {
    backgroundColor: "#252A34",
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    height: 13,
    overflow: "hidden",
  },
  progressFill: {
    borderRadius: 8,
    height: "100%",
  },
  countRow: {
    gap: 7,
  },
  countLabelWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  countLabel: {
    color: palette.mutedDark,
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
  },
  countValue: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  countTrack: {
    backgroundColor: "#252A34",
    borderRadius: 8,
    height: 18,
    overflow: "hidden",
  },
  countFill: {
    borderRadius: 8,
    height: "100%",
    minWidth: 2,
  },
  weaknessGraph: {
    borderTopColor: palette.line,
    borderTopWidth: 1,
    gap: 10,
    paddingTop: 13,
  },
  weaknessTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  weaknessName: {
    color: palette.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  weaknessMeta: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "800",
  },
});
