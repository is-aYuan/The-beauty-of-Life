const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routePath = path.join(__dirname, '..', 'lovable_ui', 'src', 'routes', 'index.tsx');
const helperPath = path.join(__dirname, '..', 'lovable_ui', 'src', 'lib', 'chatAutoScroll.ts');

test('story route wires chat updates to the latest-message auto-scroll helper', () => {
    const routeSource = fs.readFileSync(routePath, 'utf8');

    assert.match(routeSource, /useChatAutoScroll/);
    assert.match(routeSource, /chatScrollRef/);
    assert.match(routeSource, /chatEndRef/);
    assert.match(routeSource, /ref=\{chatScrollRef\}/);
    assert.match(routeSource, /ref=\{chatEndRef\}/);
});

test('auto-scroll helper defines the guarded story-tab scroll contract', () => {
    const helperSource = fs.readFileSync(helperPath, 'utf8');

    assert.match(helperSource, /function shouldAutoScrollToLatest/);
    assert.match(helperSource, /activeTab !== "story"/);
    assert.match(helperSource, /chatHistoryLength > 0/);
    assert.match(helperSource, /subtitle/);
    assert.match(helperSource, /convoState === "aiThinking"/);
});
