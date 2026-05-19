// 模块：用户个性化偏好。集中管理朗读语速和字体大小，避免设置值散落在接口与 TTS 逻辑里。

const SPEECH_RATE_PRESETS = {
    slow: -1.5,
    normal: 0.85,
    fast: 2,
};

const FONT_SCALE_PRESETS = {
    normal: 1,
    large: 1.12,
    extraLarge: 1.25,
};

const DEFAULT_USER_PREFERENCES = Object.freeze({
    speechRatePreset: 'normal',
    speechRate: SPEECH_RATE_PRESETS.normal,
    fontSizePreset: 'normal',
    fontScale: FONT_SCALE_PRESETS.normal,
});

const CUSTOM_PRESET = 'custom';
const MIN_SPEECH_RATE = -2;
const MAX_SPEECH_RATE = 2;
const MIN_FONT_SCALE = 1;
const MAX_FONT_SCALE = 1.35;

function roundToTwo(value) {
    return Math.round(value * 100) / 100;
}

function clampNumber(value, min, max) {
    if (typeof value !== 'number' || Number.isNaN(value)) return null;
    return roundToTwo(Math.min(max, Math.max(min, value)));
}

function normalizePreset(value, presets, fallback = 'normal') {
    if (value === CUSTOM_PRESET) return CUSTOM_PRESET;
    return Object.prototype.hasOwnProperty.call(presets, value) ? value : fallback;
}

function normalizeUserPreferences(input = {}) {
    const speechRatePreset = normalizePreset(input.speechRatePreset, SPEECH_RATE_PRESETS);
    const fontSizePreset = normalizePreset(input.fontSizePreset, FONT_SCALE_PRESETS);

    const speechRate = speechRatePreset === CUSTOM_PRESET
        ? clampNumber(input.speechRate, MIN_SPEECH_RATE, MAX_SPEECH_RATE)
        : SPEECH_RATE_PRESETS[speechRatePreset];
    const fontScale = fontSizePreset === CUSTOM_PRESET
        ? clampNumber(input.fontScale, MIN_FONT_SCALE, MAX_FONT_SCALE)
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

function speechRateToTtsSpeed(preferences = {}) {
    return normalizeUserPreferences(preferences).speechRate;
}

async function getUserPreferences(db, userId) {
    if (!userId) return { ...DEFAULT_USER_PREFERENCES };

    const result = await db.collection('user_preferences')
        .where({ userId })
        .limit(1)
        .get();

    if (!result.data || result.data.length === 0) {
        return { ...DEFAULT_USER_PREFERENCES };
    }

    return normalizeUserPreferences(result.data[0]);
}

async function saveUserPreferences(db, userId, input) {
    if (!userId) {
        throw new Error('缺少用户 ID');
    }

    const preferences = normalizeUserPreferences(input);
    const result = await db.collection('user_preferences')
        .where({ userId })
        .limit(1)
        .get();

    const payload = {
        ...preferences,
        updatedAt: db.serverDate(),
    };

    if (result.data && result.data.length > 0) {
        await db.collection('user_preferences').doc(result.data[0]._id).update(payload);
    } else {
        await db.collection('user_preferences').add({
            userId,
            ...payload,
            createdAt: db.serverDate(),
        });
    }

    return preferences;
}

module.exports = {
    DEFAULT_USER_PREFERENCES,
    SPEECH_RATE_PRESETS,
    FONT_SCALE_PRESETS,
    normalizeUserPreferences,
    speechRateToTtsSpeed,
    getUserPreferences,
    saveUserPreferences,
};
