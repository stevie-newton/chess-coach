import * as SecureStore from "expo-secure-store";

const REPERTOIRE_KEY = "saved_opening_repertoire";
const ADAPTIVE_PROGRESS_KEY = "opening_adaptive_progress";

export async function getSavedRepertoire() {
  try {
    const stored = await SecureStore.getItemAsync(REPERTOIRE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveRepertoire(openings) {
  const uniqueOpenings = [...new Set(openings)].sort();
  await SecureStore.setItemAsync(REPERTOIRE_KEY, JSON.stringify(uniqueOpenings));
  return uniqueOpenings;
}

export async function toggleSavedOpening(openingName) {
  const current = await getSavedRepertoire();
  const exists = current.includes(openingName);
  const next = exists
    ? current.filter((opening) => opening !== openingName)
    : [...current, openingName];

  return {
    saved: !exists,
    repertoire: await saveRepertoire(next),
  };
}

export async function getOpeningProgress() {
  try {
    const stored = await SecureStore.getItemAsync(ADAPTIVE_PROGRESS_KEY);
    const parsed = stored ? JSON.parse(stored) : {};

    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveOpeningProgress(progress) {
  await SecureStore.setItemAsync(ADAPTIVE_PROGRESS_KEY, JSON.stringify(progress));
  return progress;
}

export async function recordOpeningMistake(openingName, mistake) {
  const progress = await getOpeningProgress();
  const current = progress[openingName] || {
    forgottenLines: {},
    mistakes: 0,
    weakVariations: {},
    lastMistakeAt: null,
  };
  const lineKey = mistake.line || "Main line";
  const variationKey = mistake.variation || "Main line";

  const nextOpeningProgress = {
    ...current,
    mistakes: (current.mistakes || 0) + 1,
    lastMistakeAt: new Date().toISOString(),
    forgottenLines: {
      ...(current.forgottenLines || {}),
      [lineKey]: ((current.forgottenLines || {})[lineKey] || 0) + 1,
    },
    weakVariations: {
      ...(current.weakVariations || {}),
      [variationKey]: ((current.weakVariations || {})[variationKey] || 0) + 1,
    },
  };

  progress[openingName] = nextOpeningProgress;
  await saveOpeningProgress(progress);

  return nextOpeningProgress;
}

export async function recordOpeningSuccess(openingName) {
  const progress = await getOpeningProgress();
  const current = progress[openingName] || {
    forgottenLines: {},
    mistakes: 0,
    weakVariations: {},
    lastMistakeAt: null,
  };

  progress[openingName] = {
    ...current,
    successes: (current.successes || 0) + 1,
    lastSuccessAt: new Date().toISOString(),
  };

  await saveOpeningProgress(progress);
  return progress[openingName];
}

export function buildAdaptiveOpeningReport(progress, savedRepertoire = []) {
  return Object.entries(progress)
    .map(([openingName, data]) => {
      const weakVariation = Object.entries(data.weakVariations || {})
        .sort((a, b) => b[1] - a[1])[0];
      const forgottenLine = Object.entries(data.forgottenLines || {})
        .sort((a, b) => b[1] - a[1])[0];
      const mistakes = data.mistakes || 0;
      const successes = data.successes || 0;

      return {
        openingName,
        mistakes,
        successes,
        weakVariation: weakVariation?.[0] || "Main line",
        weakVariationMistakes: weakVariation?.[1] || mistakes,
        forgottenLine: forgottenLine?.[0] || "Main line",
        forgottenLineMistakes: forgottenLine?.[1] || mistakes,
        priority: mistakes * 2 - successes + (savedRepertoire.includes(openingName) ? 2 : 0),
      };
    })
    .filter((item) => item.mistakes > 0)
    .sort((a, b) => b.priority - a.priority || b.mistakes - a.mistakes);
}
