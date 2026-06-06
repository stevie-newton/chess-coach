import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../api/client";
import {
  AppShell,
  LoadingState,
  PremiumPanel,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  palette,
  uiStyles,
} from "../components/PremiumUI";

const providers = [
  {
    key: "chesscom",
    field: "chesscom_username",
    title: "Chess.com",
    helper: "Connect your public Chess.com username.",
  },
  {
    key: "lichess",
    field: "lichess_username",
    title: "Lichess",
    helper: "Connect your public Lichess username.",
  },
];

export default function ImportGamesScreen() {
  const [profiles, setProfiles] = useState({
    chesscom_username: "",
    lichess_username: "",
  });
  const [maxGames, setMaxGames] = useState("5");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(null);
  const [savingPgn, setSavingPgn] = useState(false);
  const [lastImport, setLastImport] = useState(null);
  const [manualGame, setManualGame] = useState({
    opponent: "",
    color_played: "",
    result: "",
    time_control: "",
    pgn: "",
  });

  useEffect(() => {
    async function loadProfiles() {
      try {
        const response = await api.get("/profiles/connected");
        setProfiles({
          chesscom_username: response.data.chesscom_username || "",
          lichess_username: response.data.lichess_username || "",
        });
      } catch (error) {
        console.log(error.response?.data || error.message);
      } finally {
        setLoading(false);
      }
    }

    loadProfiles();
  }, []);

  const updateProfile = (field, value) => {
    setProfiles((current) => ({ ...current, [field]: value }));
  };

  const updateManualGame = (field, value) => {
    setManualGame((current) => ({ ...current, [field]: value }));
  };

  const saveProfiles = async () => {
    try {
      setSaving(true);
      const response = await api.put("/profiles/connected", {
        chesscom_username: profiles.chesscom_username.trim() || null,
        lichess_username: profiles.lichess_username.trim() || null,
      });

      setProfiles({
        chesscom_username: response.data.chesscom_username || "",
        lichess_username: response.data.lichess_username || "",
      });
      Alert.alert("Profiles connected", "Your chess profiles were saved.");
    } catch (error) {
      Alert.alert(
        "Could not save profiles",
        error.response?.data?.detail || "Something went wrong"
      );
    } finally {
      setSaving(false);
    }
  };

  const importGames = async (provider) => {
    const username = profiles[provider.field].trim();

    if (!username) {
      Alert.alert("Username required", `Enter your ${provider.title} username first.`);
      return;
    }

    try {
      setImporting(provider.key);
      await api.put("/profiles/connected", {
        chesscom_username: profiles.chesscom_username.trim() || null,
        lichess_username: profiles.lichess_username.trim() || null,
      });

      const response = await api.post("/profiles/import", {
        platform: provider.key,
        username,
        max_games: Number(maxGames) || 5,
      });

      setLastImport(response.data);
      Alert.alert("Import complete", response.data.message, [
        { text: "Stay here", style: "cancel" },
        { text: "Open games", onPress: () => router.push("/(tabs)/games") },
      ]);
    } catch (error) {
      Alert.alert(
        "Import failed",
        error.response?.data?.detail || "Could not import games"
      );
    } finally {
      setImporting(null);
    }
  };

  const saveManualPgn = async () => {
    const pgn = manualGame.pgn.trim();

    if (!pgn) {
      Alert.alert("PGN required", "Paste the complete game PGN before saving.");
      return;
    }

    try {
      setSavingPgn(true);
      await api.post("/games/upload-pgn", {
        source: "manual",
        opponent: manualGame.opponent.trim() || null,
        color_played: manualGame.color_played.trim().toLowerCase() || null,
        result: manualGame.result.trim() || null,
        time_control: manualGame.time_control.trim() || null,
        pgn,
      });

      setManualGame({
        opponent: "",
        color_played: "",
        result: "",
        time_control: "",
        pgn: "",
      });

      Alert.alert("Game saved", "Your tournament game was added to the library.", [
        { text: "Stay here", style: "cancel" },
        { text: "Analyze it", onPress: () => router.push("/(tabs)/games") },
      ]);
    } catch (error) {
      Alert.alert(
        "Could not save PGN",
        error.response?.data?.detail || "Check that the moves are in valid PGN format."
      );
    } finally {
      setSavingPgn(false);
    }
  };

  return (
    <AppShell
      showBack
      eyebrow="Import Center"
      title="Connect your chess profiles."
      subtitle="Save public Chess.com and Lichess usernames, then import games into your coach library."
    >
      {loading ? (
        <LoadingState />
      ) : (
        <>
          <View style={styles.providerGrid}>
            {providers.map((provider) => (
              <PremiumPanel key={provider.key} style={styles.providerCard}>
                <Text style={styles.providerTitle}>{provider.title}</Text>
                <Text style={styles.providerText}>{provider.helper}</Text>
                <TextInput
                  style={uiStyles.input}
                  placeholder={`${provider.title} username`}
                  placeholderTextColor={palette.muted}
                  autoCapitalize="none"
                  value={profiles[provider.field]}
                  onChangeText={(value) => updateProfile(provider.field, value)}
                />
                <SecondaryButton
                  title={importing === provider.key ? "Importing..." : "Import games"}
                  icon="download"
                  disabled={!!importing}
                  onPress={() => importGames(provider)}
                />
              </PremiumPanel>
            ))}
          </View>

          <PremiumPanel style={styles.settingsPanel}>
            <Text style={styles.providerTitle}>Import settings</Text>
            <TextInput
              style={uiStyles.input}
              placeholder="Max games"
              placeholderTextColor={palette.muted}
              keyboardType="numeric"
              value={maxGames}
              onChangeText={setMaxGames}
            />
            <PrimaryButton
              title={saving ? "Saving..." : "Save connected profiles"}
              icon="content-save"
              disabled={saving}
              onPress={saveProfiles}
            />
          </PremiumPanel>

          <PremiumPanel style={styles.manualPanel}>
            <Text style={styles.providerTitle}>Paste a tournament PGN</Text>
            <Text style={styles.providerText}>
              Enter the complete game notation from your score sheet, then save it for analysis.
            </Text>
            <View style={styles.manualGrid}>
              <TextInput
                style={[uiStyles.input, styles.manualField]}
                placeholder="Opponent"
                placeholderTextColor={palette.muted}
                value={manualGame.opponent}
                onChangeText={(value) => updateManualGame("opponent", value)}
              />
              <TextInput
                style={[uiStyles.input, styles.manualField]}
                placeholder="Color played: white or black"
                placeholderTextColor={palette.muted}
                autoCapitalize="none"
                value={manualGame.color_played}
                onChangeText={(value) => updateManualGame("color_played", value)}
              />
              <TextInput
                style={[uiStyles.input, styles.manualField]}
                placeholder="Result: 1-0, 0-1, or 1/2-1/2"
                placeholderTextColor={palette.muted}
                value={manualGame.result}
                onChangeText={(value) => updateManualGame("result", value)}
              />
              <TextInput
                style={[uiStyles.input, styles.manualField]}
                placeholder="Time control"
                placeholderTextColor={palette.muted}
                value={manualGame.time_control}
                onChangeText={(value) => updateManualGame("time_control", value)}
              />
            </View>
            <TextInput
              style={[uiStyles.input, styles.pgnInput]}
              placeholder={'[Event "Local Tournament"]\n[White "You"]\n[Black "Opponent"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 1-0'}
              placeholderTextColor={palette.muted}
              multiline
              textAlignVertical="top"
              autoCapitalize="none"
              value={manualGame.pgn}
              onChangeText={(value) => updateManualGame("pgn", value)}
            />
            <PrimaryButton
              title={savingPgn ? "Saving game..." : "Save PGN game"}
              icon="content-save"
              disabled={savingPgn}
              onPress={saveManualPgn}
            />
          </PremiumPanel>
        </>
      )}

      {lastImport ? (
        <>
          <SectionHeader label="Last Import" />
          <PremiumPanel dark style={styles.resultPanel}>
            <Text style={styles.resultTitle}>{lastImport.message}</Text>
            <Text style={styles.resultText}>
              {lastImport.platform} profile: {lastImport.username}
            </Text>
            <PrimaryButton title="Open games" icon="chess-knight" tone="light" onPress={() => router.push("/(tabs)/games")} />
          </PremiumPanel>
        </>
      ) : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  loadingPanel: {
    alignItems: "center",
  },
  providerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  providerCard: {
    flex: 1,
    gap: 10,
    minWidth: 180,
  },
  providerTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  providerText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  settingsPanel: {
    gap: 12,
    marginBottom: 14,
  },
  manualPanel: {
    gap: 12,
    marginBottom: 14,
  },
  manualGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  manualField: {
    flex: 1,
    minWidth: 180,
  },
  pgnInput: {
    minHeight: 190,
    paddingTop: 12,
  },
  resultPanel: {
    gap: 6,
  },
  resultTitle: {
    color: palette.goldSoft,
    fontSize: 16,
    fontWeight: "900",
  },
  resultText: {
    color: palette.mutedDark,
    fontSize: 14,
    lineHeight: 20,
  },
});
