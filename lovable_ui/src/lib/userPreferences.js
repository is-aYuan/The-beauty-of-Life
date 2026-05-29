// 模块：前端用户偏好。负责本地持久化和 UI 可直接消费的设置值。

export const USER_PREFERENCES_STORAGE_KEY = "story_user_preferences";

export const SPEECH_RATE_PRESETS = {
  slow: -1.5,
  normal: 0.85,
  fast: 2,
};

export const FONT_SCALE_PRESETS = {
  small: 0.5,
  normal: 0.85,
  large: 1.25,
  extraLarge: 1.5,
};

export const DEFAULT_USER_PREFERENCES = Object.freeze({
  speechRatePreset: "normal",
  speechRate: SPEECH_RATE_PRESETS.normal,
  fontSizePreset: "normal",
  fontScale: FONT_SCALE_PRESETS.normal,
});

export const SPEECH_RATE_RANGE = Object.freeze({ min: -2, max: 2, step: 0.01 });
export const FONT_SCALE_RANGE = Object.freeze({ min: 0.5, max: 1.5, step: 0.05 });

function roundToTwo(value) {
  return Math.round(value * 100) / 100;
}

function clampNumber(value, min, max) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return roundToTwo(Math.min(max, Math.max(min, value)));
}

function normalizePreset(value, presets, fallback = "normal") {
  if (value === "custom") return "custom";
  return Object.prototype.hasOwnProperty.call(presets, value) ? value : fallback;
}

export function getFontSizePresetByScale(fontScale) {
  const scale = clampNumber(fontScale, FONT_SCALE_RANGE.min, FONT_SCALE_RANGE.max);
  if (scale === null) return null;

  const matched = Object.entries(FONT_SCALE_PRESETS).find(([, presetScale]) => presetScale === scale);
  return matched ? matched[0] : null;
}

function normalizeFontSizePreference(input = {}) {
  if (input.fontSizePreset === "custom") {
    const customScale = clampNumber(input.fontScale, FONT_SCALE_RANGE.min, FONT_SCALE_RANGE.max);
    if (customScale !== null) {
      const matchedPreset = getFontSizePresetByScale(customScale);
      if (matchedPreset) {
        return { fontSizePreset: matchedPreset, fontScale: FONT_SCALE_PRESETS[matchedPreset] };
      }
      return { fontSizePreset: "custom", fontScale: customScale };
    }
    return {
      fontSizePreset: DEFAULT_USER_PREFERENCES.fontSizePreset,
      fontScale: DEFAULT_USER_PREFERENCES.fontScale,
    };
  }

  if (Object.prototype.hasOwnProperty.call(FONT_SCALE_PRESETS, input.fontSizePreset)) {
    return {
      fontSizePreset: input.fontSizePreset,
      fontScale: FONT_SCALE_PRESETS[input.fontSizePreset],
    };
  }

  return {
    fontSizePreset: DEFAULT_USER_PREFERENCES.fontSizePreset,
    fontScale: DEFAULT_USER_PREFERENCES.fontScale,
  };
}

function getBrowserStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function normalizeUserPreferences(input = {}) {
  const source = input || {};
  const speechRatePreset = normalizePreset(source.speechRatePreset, SPEECH_RATE_PRESETS);
  const speechRate = speechRatePreset === "custom"
    ? clampNumber(source.speechRate, SPEECH_RATE_RANGE.min, SPEECH_RATE_RANGE.max)
    : SPEECH_RATE_PRESETS[speechRatePreset];
  const fontPreference = normalizeFontSizePreference(source);

  if (speechRate === null) {
    return { ...DEFAULT_USER_PREFERENCES };
  }

  return {
    speechRatePreset,
    speechRate,
    ...fontPreference,
  };
}

export function loadLocalUserPreferences(storage = getBrowserStorage()) {
  if (!storage) return { ...DEFAULT_USER_PREFERENCES };

  try {
    const raw = storage.getItem(USER_PREFERENCES_STORAGE_KEY);
    return normalizeUserPreferences(raw ? JSON.parse(raw) : null);
  } catch (error) {
    return { ...DEFAULT_USER_PREFERENCES };
  }
}

export function saveLocalUserPreferences(storage = getBrowserStorage(), input) {
  const preferences = normalizeUserPreferences(input);
  if (storage) {
    storage.setItem(USER_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  }
  return preferences;
}

export function buildFontScaleCssValue(input = {}) {
  const { fontScale } = normalizeUserPreferences(input);
  return `${Math.round(fontScale * 100)}%`;
}

export function speechRateToPreviewRate(input = {}) {
  const { speechRate } = normalizeUserPreferences(input);
  if (speechRate <= -2) return 0.6;
  if (speechRate <= -1) return roundToTwo(0.6 + ((speechRate + 2) * 0.2));
  if (speechRate <= 0) return roundToTwo(0.8 + ((speechRate + 1) * 0.2));
  if (speechRate <= 1) return roundToTwo(1 + (speechRate * 0.2));
  return roundToTwo(1.2 + ((speechRate - 1) * 0.3));
}
