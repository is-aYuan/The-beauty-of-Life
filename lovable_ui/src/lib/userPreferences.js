// 模块：前端用户偏好。负责本地持久化和 UI 可直接消费的设置值。

export const USER_PREFERENCES_STORAGE_KEY = "story_user_preferences";

export const SPEECH_RATE_PRESETS = {
  slow: -1.5,
  normal: 0.85,
  fast: 2,
};

export const FONT_SCALE_PRESETS = {
  normal: 1,
  large: 1.12,
  extraLarge: 1.25,
};

export const DEFAULT_USER_PREFERENCES = Object.freeze({
  speechRatePreset: "normal",
  speechRate: SPEECH_RATE_PRESETS.normal,
  fontSizePreset: "normal",
  fontScale: FONT_SCALE_PRESETS.normal,
});

export const SPEECH_RATE_RANGE = Object.freeze({ min: -2, max: 2, step: 0.01 });
export const FONT_SCALE_RANGE = Object.freeze({ min: 1, max: 1.35, step: 0.01 });

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

function getBrowserStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function normalizeUserPreferences(input = {}) {
  const speechRatePreset = normalizePreset(input.speechRatePreset, SPEECH_RATE_PRESETS);
  const fontSizePreset = normalizePreset(input.fontSizePreset, FONT_SCALE_PRESETS);
  const speechRate = speechRatePreset === "custom"
    ? clampNumber(input.speechRate, SPEECH_RATE_RANGE.min, SPEECH_RATE_RANGE.max)
    : SPEECH_RATE_PRESETS[speechRatePreset];
  const fontScale = fontSizePreset === "custom"
    ? clampNumber(input.fontScale, FONT_SCALE_RANGE.min, FONT_SCALE_RANGE.max)
    : FONT_SCALE_PRESETS[fontSizePreset];

  if (speechRate === null || fontScale === null) {
    return { ...DEFAULT_USER_PREFERENCES };
  }

  return {
    speechRatePreset,
    speechRate,
    fontSizePreset,
    fontScale,
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
