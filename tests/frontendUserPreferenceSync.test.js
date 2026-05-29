const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const engineSource = fs.readFileSync(
    path.join(__dirname, '../lovable_ui/src/hooks/useStoryEngine.ts'),
    'utf8',
);
const serverSource = fs.readFileSync(
    path.join(__dirname, '../server.js'),
    'utf8',
);

test('frontend preference sync ignores stale server responses after a newer local update', () => {
    assert.match(engineSource, /preferenceSyncVersionRef/);
    assert.match(engineSource, /applyIncomingUserPreferences/);
    assert.match(engineSource, /const requestVersion = \+\+preferenceSyncVersionRef\.current/);
    assert.match(engineSource, /requestVersion !== preferenceSyncVersionRef\.current/);
    assert.match(engineSource, /sourceVersion < preferenceSyncVersionRef\.current/);
    assert.match(engineSource, /syncVersion: requestVersion/);
    assert.match(serverSource, /syncVersion: msg\.syncVersion/);
});
