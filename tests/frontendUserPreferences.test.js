const test = require('node:test');
const assert = require('node:assert/strict');

function createStorage(seed = {}) {
    const state = { ...seed };
    return {
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(state, key) ? state[key] : null;
        },
        setItem(key, value) {
            state[key] = value;
        },
        removeItem(key) {
            delete state[key];
        },
        state,
    };
}

test('loads default local user preferences when storage is empty', async () => {
    const {
        DEFAULT_USER_PREFERENCES,
        loadLocalUserPreferences,
    } = await import('../lovable_ui/src/lib/userPreferences.js');

    const prefs = loadLocalUserPreferences(createStorage());

    assert.deepEqual(prefs, DEFAULT_USER_PREFERENCES);
});

test('loads default local user preferences during server rendering without window', async () => {
    const {
        DEFAULT_USER_PREFERENCES,
        loadLocalUserPreferences,
    } = await import('../lovable_ui/src/lib/userPreferences.js');

    const prefs = loadLocalUserPreferences();

    assert.deepEqual(prefs, DEFAULT_USER_PREFERENCES);
});

test('saves normalized user preferences to local storage', async () => {
    const {
        USER_PREFERENCES_STORAGE_KEY,
        saveLocalUserPreferences,
    } = await import('../lovable_ui/src/lib/userPreferences.js');
    const storage = createStorage();

    const prefs = saveLocalUserPreferences(storage, {
        speechRatePreset: 'custom',
        speechRate: 0.92,
        fontSizePreset: 'custom',
        fontScale: 1.19,
    });

    assert.equal(prefs.speechRate, 0.92);
    assert.equal(prefs.fontScale, 1.19);
    assert.deepEqual(JSON.parse(storage.state[USER_PREFERENCES_STORAGE_KEY]), prefs);
});

test('builds a root font scale style value from preferences', async () => {
    const {
        buildFontScaleCssValue,
    } = await import('../lovable_ui/src/lib/userPreferences.js');

    assert.equal(buildFontScaleCssValue(), '85%');
    assert.equal(buildFontScaleCssValue({ fontSizePreset: 'small' }), '50%');
    assert.equal(buildFontScaleCssValue({ fontSizePreset: 'normal' }), '85%');
    assert.equal(buildFontScaleCssValue({ fontSizePreset: 'large' }), '125%');
    assert.equal(buildFontScaleCssValue({ fontSizePreset: 'extraLarge' }), '150%');
    assert.equal(buildFontScaleCssValue({ fontSizePreset: 'custom', fontScale: 0.55 }), '55%');
});

test('normalizes shortcut-matching custom font scale for local preferences', async () => {
    const {
        normalizeUserPreferences,
        saveLocalUserPreferences,
        getFontSizePresetByScale,
        USER_PREFERENCES_STORAGE_KEY,
    } = await import('../lovable_ui/src/lib/userPreferences.js');
    const storage = createStorage();

    assert.equal(getFontSizePresetByScale(0.85), 'normal');
    assert.equal(getFontSizePresetByScale(0.9), null);

    const prefs = saveLocalUserPreferences(storage, {
        fontSizePreset: 'custom',
        fontScale: 0.85,
    });

    assert.equal(prefs.fontSizePreset, 'normal');
    assert.equal(prefs.fontScale, 0.85);
    assert.deepEqual(JSON.parse(storage.state[USER_PREFERENCES_STORAGE_KEY]), prefs);

    const customPrefs = normalizeUserPreferences({
        fontSizePreset: 'custom',
        fontScale: 0.9,
    });
    assert.equal(customPrefs.fontSizePreset, 'custom');
    assert.equal(customPrefs.fontScale, 0.9);
});

test('maps Tencent TTS speed parameter to browser preview rate', async () => {
    const {
        speechRateToPreviewRate,
    } = await import('../lovable_ui/src/lib/userPreferences.js');

    assert.equal(speechRateToPreviewRate({ speechRatePreset: 'custom', speechRate: -2 }), 0.6);
    assert.equal(speechRateToPreviewRate({ speechRatePreset: 'normal' }), 1.17);
    assert.equal(speechRateToPreviewRate({ speechRatePreset: 'fast' }), 1.5);
});
