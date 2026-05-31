const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const repoRoot = path.join(__dirname, '..');
const helperPath = path.join(repoRoot, 'lovable_ui', 'src', 'lib', 'pendingTurnRecovery.js');

function createMemoryStorage() {
    const values = new Map();
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        removeItem(key) {
            values.delete(key);
        },
        clear() {
            values.clear();
        },
    };
}

async function loadHelper() {
    return import(pathToFileURL(helperPath).href);
}

test('pending turn helper saves and loads the current user turn', async () => {
    const {
        savePendingTurn,
        loadPendingTurn,
    } = await loadHelper();
    const storage = createMemoryStorage();
    const now = 1000;

    savePendingTurn(storage, {
        userId: 'user-a',
        turnId: 'turn-a',
        inputMode: 'text',
    }, now);

    assert.deepEqual(loadPendingTurn(storage, 'user-a', now + 1000), {
        userId: 'user-a',
        turnId: 'turn-a',
        inputMode: 'text',
        createdAt: now,
    });
});

test('pending turn helper refuses to recover another user turn', async () => {
    const {
        savePendingTurn,
        loadPendingTurn,
    } = await loadHelper();
    const storage = createMemoryStorage();

    savePendingTurn(storage, {
        userId: 'user-a',
        turnId: 'turn-a',
        inputMode: 'voice',
    }, 2000);

    assert.equal(loadPendingTurn(storage, 'user-b', 2500), null);
});

test('pending turn helper expires stale turns after fifteen minutes', async () => {
    const {
        PENDING_TURN_MAX_AGE_MS,
        savePendingTurn,
        loadPendingTurn,
    } = await loadHelper();
    const storage = createMemoryStorage();

    savePendingTurn(storage, {
        userId: 'user-a',
        turnId: 'turn-a',
        inputMode: 'text',
    }, 3000);

    assert.equal(loadPendingTurn(storage, 'user-a', 3000 + PENDING_TURN_MAX_AGE_MS + 1), null);
    assert.equal(loadPendingTurn(storage, 'user-a', 3000 + PENDING_TURN_MAX_AGE_MS + 2), null);
});

test('pending turn helper clears completed, recovered, or failed turns', async () => {
    const {
        savePendingTurn,
        loadPendingTurn,
        clearPendingTurn,
    } = await loadHelper();
    const storage = createMemoryStorage();

    savePendingTurn(storage, {
        userId: 'user-a',
        turnId: 'turn-a',
        inputMode: 'text',
    }, 4000);
    clearPendingTurn(storage);

    assert.equal(loadPendingTurn(storage, 'user-a', 4500), null);
});
