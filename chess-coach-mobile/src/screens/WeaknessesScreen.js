import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import {
  AppShell,
  EmptyState,
  PremiumPanel,
  SectionHeader,
  StatPill,
  palette,
} from "../components/PremiumUI";

export default function WeaknessesScreen({ showBack = true }) {
  const [weaknesses, setWeaknesses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWeaknesses() {
      try {
        const response = await api.get("/weaknesses/");
        setWeaknesses(response.data || []);
      } catch (error) {
        console.log(error.response?.data || error.message);
      } finally {
        setLoading(false);
      }
    }

    loadWeaknesses();
  }, []);

  const totalFrequency = weaknesses.reduce((sum, weakness) => sum + weakness.frequency, 0);
  const topSeverity = weaknesses[0]?.severity || 0;

  return (
    <AppShell
      showBack={showBack}
      eyebrow="Weaknesses"
      title="Pattern tracker."
      subtitle="Recurring issues discovered from analyzed games are ranked by severity and frequency."
    >
      <View style={styles.statsRow}>
        <StatPill icon="alert-decagram" value={weaknesses.length} label="patterns" tone="gold" />
        <StatPill icon="repeat" value={totalFrequency} label="frequency" />
        <StatPill icon="fire" value={topSeverity} label="top severity" tone="wine" />
      </View>

      {loading ? (
        <PremiumPanel style={styles.loadingPanel}>
          <ActivityIndicator size="large" color={palette.gold} />
        </PremiumPanel>
      ) : weaknesses.length === 0 ? (
        <EmptyState
          icon="shield-check"
          title="No weaknesses detected yet"
          body="Analyze games with mistakes or blunders to build your weakness profile."
        />
      ) : (
        <>
          <SectionHeader label="Detected Patterns" />
          {weaknesses.map((weakness) => (
            <PremiumPanel key={weakness.id} style={styles.weaknessCard}>
              <View style={styles.cardTop}>
                <Text style={styles.category}>{weakness.category}</Text>
                <Text style={styles.severity}>Severity {weakness.severity}</Text>
              </View>
              <Text style={styles.detail}>Frequency: {weakness.frequency}</Text>
            </PremiumPanel>
          ))}
        </>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginBottom: 16,
  },
  loadingPanel: {
    alignItems: "center",
  },
  weaknessCard: {
    gap: 8,
    marginBottom: 10,
  },
  cardTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  category: {
    color: palette.ink,
    flex: 1,
    fontSize: 17,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  severity: {
    backgroundColor: "#3A2028",
    borderRadius: 8,
    color: palette.ink,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  detail: {
    color: palette.muted,
    fontSize: 14,
  },
});
