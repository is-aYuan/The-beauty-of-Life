const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const enginePath = path.join(repoRoot, 'lovable_ui', 'src', 'hooks', 'useStoryEngine.ts');

function readEngineSource() {
    return fs.readFileSync(enginePath, 'utf8');
}

test('story engine distinguishes intentional websocket closes from reconnect-worthy drops', () => {
    const source = readEngineSource();

    assert.match(source, /intentionalWsCloseRef/);
    assert.match(source, /intentionalWsCloseRef\.current = true/);
    assert.match(source, /intentionalWsCloseRef\.current = false/);
    assert.match(source, /close\(1000/);
    assert.match(source, /if \(!intentionalWsCloseRef\.current && userRef\.current && e\.code !== 1000\)/);
});

test('story engine clears stale reconnect timers after websocket opens', () => {
    const source = readEngineSource();

    assert.match(source, /if \(reconnectTimerRef\.current\)/);
    assert.match(source, /clearTimeout\(reconnectTimerRef\.current\)/);
    assert.match(source, /reconnectTimerRef\.current = null/);
});
