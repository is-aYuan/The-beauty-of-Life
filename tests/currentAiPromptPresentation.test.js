const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const routePath = path.join(repoRoot, 'lovable_ui', 'src', 'routes', 'index.tsx');
const bubblePath = path.join(
    repoRoot,
    'lovable_ui',
    'src',
    'components',
    'story',
    'ChatMessageBubble.tsx',
);

test('story route highlights the latest AI bubble instead of rendering a duplicate prompt panel', () => {
    const source = fs.readFileSync(routePath, 'utf8');

    assert.doesNotMatch(source, /buildCurrentAiPrompt/);
    assert.doesNotMatch(source, /shouldShowCurrentAiPrompt/);
    assert.match(source, /latestAiMessageId/);
    assert.match(source, /isLatestAi=\{m\.id === latestAiMessageId\}/);
});

test('chat bubble supports a dedicated latest AI highlight state', () => {
    const source = fs.readFileSync(bubblePath, 'utf8');

    assert.match(source, /isLatestAi\?: boolean/);
    assert.match(source, /message\.role === "ai" && isLatestAi/);
    assert.match(source, /border-blue/);
});
