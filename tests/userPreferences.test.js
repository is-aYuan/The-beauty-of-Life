const test = require('node:test');
const assert = require('node:assert/strict');

const {
    DEFAULT_USER_PREFERENCES,
    normalizeUserPreferences,
    speechRateToTtsSpeed,
    getUserPreferences,
    saveUserPreferences,
} = require('../lib/userPreferences');

function createMockPreferenceDb(initialDocs = []) {
    const docs = initialDocs.map((doc) => ({ ...doc }));
    const updates = [];
    const adds = [];

    return {
        docs,
        updates,
        adds,
        serverDate() {
            return 'SERVER_DATE';
        },
        collection(collectionName) {
            assert.equal(collectionName, 'user_preferences');
            return {
                where(query) {
                    return {
                        limit() {
                            return this;
                        },
                        async get() {
                            return {
                                data: docs.filter((doc) => doc.userId === query.userId),
                            };
                        },
                    };
                },
                doc(id) {
                    return {
                        async update(payload) {
                            updates.push({ id, payload });
                            const index = docs.findIndex((doc) => doc._id === id);
                            if (index >= 0) {
                                docs[index] = { ...docs[index], ...payload };
                            }
                        },
                    };
                },
                async add(payload) {
                    adds.push(payload);
                    const id = `pref_${adds.length}`;
                    docs.push({ _id: id, ...payload });
                    return { id };
                },
            };
        },
    };
}

test('normalizes missing and invalid user preference values to safe defaults', () => {
    const prefs = normalizeUserPreferences({
        speechRatePreset: 'very-fast',
        speechRate: 9,
        fontSizePreset: 'tiny',
        fontScale: 0.4,
    });

    assert.deepEqual(prefs, DEFAULT_USER_PREFERENCES);
});

test('keeps custom slider values inside the safe elder-friendly range', () => {
    const prefs = normalizeUserPreferences({
        speechRatePreset: 'custom',
        speechRate: 0.72,
        fontSizePreset: 'custom',
        fontScale: 1.18,
    });

    assert.equal(prefs.speechRatePreset, 'custom');
    assert.equal(prefs.speechRate, 0.72);
    assert.equal(prefs.fontSizePreset, 'custom');
    assert.equal(prefs.fontScale, 1.18);
});

test('maps speech rate preference to Tencent TTS Speed parameter, where slow values are negative', () => {
    assert.equal(speechRateToTtsSpeed({ speechRatePreset: 'slow' }), -1.5);
    assert.equal(speechRateToTtsSpeed({ speechRatePreset: 'normal' }), 0.85);
    assert.equal(speechRateToTtsSpeed({ speechRatePreset: 'fast' }), 2);
    assert.equal(speechRateToTtsSpeed({ speechRatePreset: 'custom', speechRate: -2 }), -2);
});

test('loads default preferences when user has no stored document', async () => {
    const db = createMockPreferenceDb();

    const prefs = await getUserPreferences(db, 'user_1');

    assert.deepEqual(prefs, DEFAULT_USER_PREFERENCES);
});

test('updates an existing user preference document', async () => {
    const db = createMockPreferenceDb([
        { _id: 'pref_1', userId: 'user_1', speechRatePreset: 'normal', speechRate: 0.85 },
    ]);

    const prefs = await saveUserPreferences(db, 'user_1', {
        speechRatePreset: 'fast',
        fontSizePreset: 'large',
    });

    assert.equal(prefs.speechRatePreset, 'fast');
    assert.equal(prefs.speechRate, 2);
    assert.equal(prefs.fontSizePreset, 'large');
    assert.equal(prefs.fontScale, 1.12);
    assert.equal(db.updates.length, 1);
    assert.equal(db.updates[0].id, 'pref_1');
    assert.equal(db.updates[0].payload.updatedAt, 'SERVER_DATE');
});

test('creates a preference document for a user on first save', async () => {
    const db = createMockPreferenceDb();

    const prefs = await saveUserPreferences(db, 'user_2', {
        speechRatePreset: 'custom',
        speechRate: -2,
        fontSizePreset: 'extraLarge',
    });

    assert.equal(prefs.speechRate, -2);
    assert.equal(prefs.fontScale, 1.25);
    assert.equal(db.adds.length, 1);
    assert.equal(db.adds[0].userId, 'user_2');
    assert.equal(db.adds[0].createdAt, 'SERVER_DATE');
    assert.equal(db.adds[0].updatedAt, 'SERVER_DATE');
});
