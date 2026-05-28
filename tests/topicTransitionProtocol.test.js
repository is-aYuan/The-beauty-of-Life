const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const serverPath = path.join(repoRoot, 'server.js');
const enginePath = path.join(repoRoot, 'lovable_ui', 'src', 'hooks', 'useStoryEngine.ts');
const routePath = path.join(repoRoot, 'lovable_ui', 'src', 'routes', 'index.tsx');
const frontendPromptPath = path.join(
    repoRoot,
    'lovable_ui',
    'src',
    'lib',
    'topicTransitionPrompt.js',
);

test('server wires rich topic transition prompts into websocket flow', () => {
    const source = fs.readFileSync(serverPath, 'utf8');

    assert.match(source, /buildTopicTransitionPrompt/);
    assert.match(source, /parseTopicTransitionChoice/);
    assert.match(source, /buildTopicSwitchOpening/);
    assert.match(source, /buildAnsweredTopicSwitchOpeningTurn/);
    assert.match(source, /topic_transition_prompt/);
    assert.match(source, /topic_transition_choice/);
    assert.match(source, /topic_transition_resolved/);
    assert.match(source, /topic_switch_opening/);
    assert.match(source, /richTopicPromptedTopicIds/);
    assert.match(source, /topicTransitionSuppressTurns/);
    assert.match(source, /pendingTopicOpening/);
});

test('manual topic selection resets stale context and starts the selected topic opening', () => {
    const source = fs.readFileSync(serverPath, 'utf8');
    const start = source.indexOf("if (msg.type === 'select_topic')");
    const end = source.indexOf("// 处理个性化设置更新", start);
    const selectTopicBlock = source.slice(start, end);

    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    assert.match(selectTopicBlock, /session\.conversationHistory = \[\];/);
    assert.match(selectTopicBlock, /session\.pendingEntryGuidance = null;/);
    assert.match(selectTopicBlock, /session\.pendingRecommendationQuestion = null;/);
    assert.match(selectTopicBlock, /buildTopicSwitchOpening\(\{/);
    assert.match(selectTopicBlock, /await speakTopicSwitchOpening\(sessionId, session, opening\);/);
});

test('archive recommendation questions are saved only after user answers', () => {
    const source = fs.readFileSync(serverPath, 'utf8');

    assert.match(source, /buildAnsweredRecommendationQuestionTurn/);
    assert.match(source, /pendingRecommendationQuestion/);
    assert.doesNotMatch(source, /await saveConversation\(sessionId, userId, record\);/);
});

test('frontend exposes rich topic transition controls', () => {
    const engineSource = fs.readFileSync(enginePath, 'utf8');
    const routeSource = fs.readFileSync(routePath, 'utf8');
    const promptSource = fs.readFileSync(frontendPromptPath, 'utf8');

    assert.match(engineSource, /pendingTopicTransition/);
    assert.match(engineSource, /topic_transition_prompt/);
    assert.match(engineSource, /topic_switch_opening/);
    assert.match(engineSource, /respondTopicTransition/);
    assert.match(routeSource, /继续这个主题/);
    assert.match(promptSource, /换个话题/);
});
