const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const serverPath = path.join(repoRoot, 'server.js');
const enginePath = path.join(repoRoot, 'lovable_ui', 'src', 'hooks', 'useStoryEngine.ts');
const routePath = path.join(repoRoot, 'lovable_ui', 'src', 'routes', 'index.tsx');
const recorderPath = path.join(
    repoRoot,
    'lovable_ui',
    'src',
    'components',
    'story',
    'RecorderControls.tsx',
);

test('server persists turn tasks and exposes recovery events for mobile reconnects', () => {
    const source = fs.readFileSync(serverPath, 'utf8');

    assert.match(source, /createTurnTaskStore\(\{ db \}\)/);
    assert.match(source, /turn_tasks/);
    assert.match(source, /event: 'turn_accepted'/);
    assert.match(source, /event: 'turn_completed'/);
    assert.match(source, /turn_recovered/);
    assert.match(source, /recover_latest_turn/);
    assert.match(source, /runReliableTurn/);
    assert.match(source, /completeChatWithFallback/);
    assert.match(source, /withTimeout\(\s*voiceProvider\.synthesizeSpeech/);
    assert.match(source, /safeFindByTurnId/);
    assert.match(source, /answered-prompt:previous-conversation/);
    assert.match(source, /topic-profile:load/);
    const processUserTextInteraction = source.slice(source.indexOf('async function processUserTextInteraction'));
    assert.ok(
        processUserTextInteraction.indexOf("event: 'turn_accepted'") <
            processUserTextInteraction.indexOf('getLatestConversationForAnsweredPrompt'),
        'server should acknowledge the user turn before non-critical history recovery queries',
    );
    assert.match(source, /Object\.prototype\.hasOwnProperty\.call\(options, 'topicProfile'\)/);
});

test('frontend sends turnId for typed input and recovers latest turn after login-ready websocket state', () => {
    const source = fs.readFileSync(enginePath, 'utf8');

    assert.match(source, /createTurnId\("text"\)/);
    assert.match(source, /turnId,/);
    assert.match(source, /type: "recover_latest_turn"/);
    assert.match(source, /msg\.event === "turn_accepted"/);
    assert.match(source, /msg\.event === "turn_completed"/);
    assert.match(source, /msg\.event === "turn_recovered"/);
    assert.match(source, /appendUserMessage\(msg\.userText, msg\.turnId\)/);
    assert.match(source, /prev\.some\(\(item\) => item\.role === "ai" && item\.turnId === turnId\)/);
});

test('mobile and desktop waiting copy no longer tells users to resend while fallback is running', () => {
    const engineSource = fs.readFileSync(enginePath, 'utf8');
    const routeSource = fs.readFileSync(routePath, 'utf8');
    const recorderSource = fs.readFileSync(recorderPath, 'utf8');

    assert.match(engineSource, /我在接着整理您的故事/);
    assert.match(engineSource, /网络有点慢，我正在换个方式接上/);
    assert.match(routeSource, /aiThinkingText/);
    assert.match(recorderSource, /aiThinkingText/);
    assert.doesNotMatch(routeSource, /我在帮您整理故事，马上就好/);
    assert.doesNotMatch(recorderSource, /请再说一次/);
});
