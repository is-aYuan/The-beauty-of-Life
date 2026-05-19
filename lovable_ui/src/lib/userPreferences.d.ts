export type SpeechRatePreset = "slow" | "normal" | "fast" | "custom";
export type FontSizePreset = "normal" | "large" | "extraLarge" | "custom";

export type UserPreferences = {
  speechRatePreset: SpeechRatePreset;
  speechRate: number;
  fontSizePreset: FontSizePreset;
  fontScale: number;
};

export const USER_PREFERENCES_STORAGE_KEY: string;
export const SPEECH_RATE_PRESETS: Record<Exclude<SpeechRatePreset, "custom">, number>;
export const FONT_SCALE_PRESETS: Record<Exclude<FontSizePreset, "custom">, number>;
export const DEFAULT_USER_PREFERENCES: UserPreferences;
export const SPEECH_RATE_RANGE: { min: number; max: number; step: number };
export const FONT_SCALE_RANGE: { min: number; max: number; step: number };

export function normalizeUserPreferences(input?: Partial<UserPreferences> | null): UserPreferences;
export function loadLocalUserPreferences(storage?: Storage): UserPreferences;
export function saveLocalUserPreferences(storage: Storage | undefined, input: Partial<UserPreferences>): UserPreferences;
export function buildFontScaleCssValue(input?: Partial<UserPreferences> | null): string;
export function speechRateToPreviewRate(input?: Partial<UserPreferences> | null): number;
