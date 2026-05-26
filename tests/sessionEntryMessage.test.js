const test = require('node:test');
const assert = require('node:assert/strict');

test('inserts returning entry guidance as the first AI chat message', async () => {
    const { upsertSessionEntryMessage } = await import('../lovable_ui/src/lib/sessionEntryMessage.js');

    const history = upsertSessionEntryMessage([], {
        entryGuidance: {
            mode: 'returning_user',
            topicId: 'parents_home',
            topicTitle: '我的父母和家',
            displayText: '上次您讲到妈妈做菜。今天可以接着聊聊：她有什么拿手菜？',
            speechText: '欢迎回来，郑远。上次您讲到妈妈做菜。今天可以接着聊聊：她有什么拿手菜？',
            nextQuestion: '她有什么拿手菜？',
            shouldAutoSpeak: true,
        },
        now: () => 1000,
    });

    assert.deepEqual(history, [{
        id: 1000,
        role: 'ai',
        text: '欢迎回来，郑远。上次您讲到妈妈做菜。今天可以接着聊聊：她有什么拿手菜？',
        source: 'entry_guidance',
        entryGuidanceId: 'parents_home:她有什么拿手菜？',
    }]);
});

test('does not duplicate the entry guidance message after reconnect', async () => {
    const { upsertSessionEntryMessage } = await import('../lovable_ui/src/lib/sessionEntryMessage.js');
    const existing = [{
        id: 1000,
        role: 'ai',
        text: '欢迎回来，郑远。上次您讲到妈妈做菜。',
        source: 'entry_guidance',
        entryGuidanceId: 'parents_home:她有什么拿手菜？',
    }];

    const history = upsertSessionEntryMessage(existing, {
        entryGuidance: {
            mode: 'returning_user',
            topicId: 'parents_home',
            topicTitle: '我的父母和家',
            displayText: '上次您讲到妈妈做菜。今天可以接着聊聊：她有什么拿手菜？',
            speechText: '欢迎回来，郑远。上次您讲到妈妈做菜。今天可以接着聊聊：她有什么拿手菜？',
            nextQuestion: '她有什么拿手菜？',
            shouldAutoSpeak: true,
        },
        now: () => 2000,
    });

    assert.equal(history.length, 1);
    assert.equal(history[0].id, 1000);
});
