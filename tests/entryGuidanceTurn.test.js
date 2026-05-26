const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildAnsweredEntryGuidanceTurn,
} = require('../lib/entryGuidanceTurn');

test('builds answered entry guidance metadata for a saved conversation turn', () => {
    const result = buildAnsweredEntryGuidanceTurn({
        mode: 'returning_user',
        topicId: 'parents_home',
        topicTitle: '我的父母和家',
        displayText: '上次您讲到妈妈做菜。今天可以接着聊聊：她有什么拿手菜？',
        speechText: '欢迎回来，郑远。上次您讲到妈妈做菜。今天可以接着聊聊：她有什么拿手菜？',
        nextQuestion: '她有什么拿手菜？',
        shouldAutoSpeak: true,
    });

    assert.deepEqual(result, {
        promptSource: 'entry_guidance',
        aiPromptText: '欢迎回来，郑远。上次您讲到妈妈做菜。今天可以接着聊聊：她有什么拿手菜？',
        aiPromptDisplayText: '上次您讲到妈妈做菜。今天可以接着聊聊：她有什么拿手菜？',
        aiPromptTopicId: 'parents_home',
        aiPromptTopicTitle: '我的父母和家',
        aiPromptNextQuestion: '她有什么拿手菜？',
        excludeAiPromptFromSummary: true,
        excludeAiPromptFromStats: true,
        excludeAiPromptFromBiography: true,
    });
});

test('returns null for empty entry guidance', () => {
    assert.equal(buildAnsweredEntryGuidanceTurn(null), null);
});
