const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
    appendAnsweredPromptToHistoryIfMissing,
    buildAnsweredPromptFromPreviousConversation,
    formatConversationForSummary,
    rememberAiPromptForNextTurn,
    resolveAnsweredPromptForTurn,
} = require('../lib/conversationTurnPairing');

function readSource(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

function sliceFunction(source, functionName) {
    const start = source.indexOf(`function ${functionName}`);
    assert.notEqual(start, -1, `${functionName} should exist`);
    const nextFunction = source.indexOf('\nasync function ', start + 1);
    const nextPlainFunction = source.indexOf('\nfunction ', start + 1);
    const candidates = [nextFunction, nextPlainFunction].filter((index) => index > start);
    const end = candidates.length > 0 ? Math.min(...candidates) : source.length;
    return source.slice(start, end);
}

test('normal AI replies are remembered as the answered prompt for the next saved turn', () => {
    const source = readSource('server.js');
    const sessionInit = source.slice(source.indexOf('sessions.set(sessionId'), source.indexOf('sendJson(ws', source.indexOf('sessions.set(sessionId')));
    const processUserTextInteraction = sliceFunction(source, 'processUserTextInteraction');

    assert.match(sessionInit, /lastAiPrompt:\s*null/);
    assert.match(processUserTextInteraction, /getLatestConversationForAnsweredPrompt/);
    assert.match(processUserTextInteraction, /buildAnsweredPromptFromPreviousConversation/);
    assert.match(processUserTextInteraction, /resolveAnsweredPromptForTurn\(session,\s*persistedAnsweredPrompt\)/);
    assert.match(processUserTextInteraction, /answeredAiPromptText/);
    assert.match(processUserTextInteraction, /rememberAiPromptForNextTurn\(session,[\s\S]*text:\s*aiReply/);
});

test('admin conversation cards render answered question, elder answer, and next AI question separately', () => {
    const source = readSource('lovable_ui/src/routes/admin.tsx');

    assert.match(source, /AI 提问/);
    assert.match(source, /老人回答/);
    assert.match(source, /AI 下一问/);
    assert.match(source, /answeredAiPromptText/);
    assert.match(source, /c\.aiReply/);
});

test('summary extraction prefers the answered prompt over the next AI reply', () => {
    const source = readSource('server.js');
    const extractNarrativeSummary = sliceFunction(source, 'extractNarrativeSummary');
    const formatted = formatConversationForSummary({
        topicTitle: '我的孩童时代',
        answeredAiPromptText: '您和小伙伴们还唱过什么歌？',
        userText: '大海，还有青藏高原。',
        aiReply: '那谁唱得最好呀？',
    }, 0, '备用主题');

    assert.match(extractNarrativeSummary, /formatConversationForSummary/);
    assert.match(formatted, /AI提问：您和小伙伴们还唱过什么歌？/);
    assert.match(formatted, /老人回答：大海，还有青藏高原。/);
    assert.match(formatted, /AI下一问：那谁唱得最好呀？/);
});

test('conversation pairing helper resolves ordinary AI reply as next answered prompt', () => {
    const session = { lastAiPrompt: null };

    rememberAiPromptForNextTurn(session, {
        text: '那您和小伙伴们，谁唱得最好呀？',
        topicId: 'childhood',
        topicTitle: '我的孩童时代',
    });

    const answeredPrompt = resolveAnsweredPromptForTurn(session);
    assert.equal(answeredPrompt.answeredAiPromptText, '那您和小伙伴们，谁唱得最好呀？');
    assert.equal(answeredPrompt.answeredAiPromptSource, 'ai_reply');
    assert.equal(answeredPrompt.answeredAiPromptTopicId, 'childhood');
    assert.equal(answeredPrompt.answeredAiPromptTopicTitle, '我的孩童时代');
});

test('special pending prompts override remembered ordinary AI prompts for the current answer', () => {
    const session = { lastAiPrompt: null };
    rememberAiPromptForNextTurn(session, { text: '旧问题' });
    session.pendingAnsweredPrompt = {
        promptSource: 'topic_switch_opening',
        aiPromptText: '那我们聊聊您的工作与生计。',
    };

    const answeredPrompt = resolveAnsweredPromptForTurn(session);
    assert.equal(answeredPrompt.answeredAiPromptText, '那我们聊聊您的工作与生计。');
    assert.equal(answeredPrompt.answeredAiPromptSource, 'topic_switch_opening');
});

test('answered prompts are not duplicated in AI context when already present', () => {
    const session = {
        conversationHistory: [{ Role: 'assistant', Content: '那谁唱得最好呀？' }],
    };
    const inserted = appendAnsweredPromptToHistoryIfMissing(session, {
        aiPromptText: '那谁唱得最好呀？',
    });

    assert.equal(inserted, false);
    assert.deepEqual(session.conversationHistory, [
        { Role: 'assistant', Content: '那谁唱得最好呀？' },
    ]);
});

test('previous persisted conversation can become the answered prompt when memory state is missing', () => {
    const session = { lastAiPrompt: null };
    const persistedAnsweredPrompt = buildAnsweredPromptFromPreviousConversation({
        aiReply: '您母亲说得太对啦。那您做自媒体的时候，她有没有在背后默默支持您呀？',
        topicId: 'family',
        topicTitle: '我的父母与家庭',
    });

    const answeredPrompt = resolveAnsweredPromptForTurn(session, persistedAnsweredPrompt);

    assert.equal(
        answeredPrompt.answeredAiPromptText,
        '您母亲说得太对啦。那您做自媒体的时候，她有没有在背后默默支持您呀？',
    );
    assert.equal(answeredPrompt.answeredAiPromptSource, 'persisted_previous_ai_reply');
    assert.equal(answeredPrompt.answeredAiPromptTopicId, 'family');
    assert.equal(answeredPrompt.answeredAiPromptTopicTitle, '我的父母与家庭');
});
