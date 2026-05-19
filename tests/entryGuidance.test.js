const test = require('node:test');
const assert = require('node:assert/strict');

test('shows onboarding guidance instead of continuation copy for first-time users', async () => {
    const { buildEntryGuidance } = await import('../lovable_ui/src/lib/entryGuidance.js');

    const guidance = buildEntryGuidance({
        userName: '胡敏先',
        totalConversations: 0,
        chatHistoryLength: 0,
        currentTopicTitle: '我的孩童时代',
        wsConnected: true,
        networkStatus: 'online',
        subtitle: '您好，胡敏先！请继续讲您的故事，我会帮您记录下来。',
    });

    assert.equal(guidance.storyPrompt, '我们先从“我的孩童时代”开始吧。按住下面的话筒，像聊天一样讲。');
    assert.doesNotMatch(guidance.storyPrompt, /继续/);
    assert.equal(guidance.idleStatus, '按住红色按钮，说一段回忆');
});

test('keeps continuation guidance for users who already have conversations', async () => {
    const { buildEntryGuidance } = await import('../lovable_ui/src/lib/entryGuidance.js');

    const guidance = buildEntryGuidance({
        userName: '胡敏先',
        totalConversations: 2,
        chatHistoryLength: 0,
        currentTopicTitle: '我的孩童时代',
        wsConnected: true,
        networkStatus: 'online',
        subtitle: '您好，胡敏先！请继续讲您的故事，我会帮您记录下来。',
    });

    assert.equal(guidance.storyPrompt, '您好，胡敏先！请继续讲您的故事，我会帮您记录下来。');
    assert.equal(guidance.idleStatus, '按住话筒，接着上次的话题继续讲');
});

test('prefers server entry guidance display text and returning status', async () => {
    const { buildEntryGuidance } = await import('../lovable_ui/src/lib/entryGuidance.js');

    const guidance = buildEntryGuidance({
        userName: '胡敏先',
        totalConversations: 3,
        chatHistoryLength: 0,
        currentTopicTitle: '我的孩童时代',
        wsConnected: true,
        networkStatus: 'online',
        subtitle: '旧的后端欢迎语',
        serverEntryGuidance: {
            mode: 'returning_user',
            topicId: 'childhood',
            topicTitle: '我的孩童时代',
            displayText: '上次我们聊到“我的孩童时代”。今天可以接着说说：小时候家里谁最照顾您？',
            speechText: '欢迎回来，胡敏先。上次我们聊到“我的孩童时代”。今天可以接着说说：小时候家里谁最照顾您？',
            nextQuestion: '小时候家里谁最照顾您？',
            shouldAutoSpeak: true,
        },
    });

    assert.equal(guidance.firstTimeUser, false);
    assert.equal(
        guidance.storyPrompt,
        '上次我们聊到“我的孩童时代”。今天可以接着说说：小时候家里谁最照顾您？',
    );
    assert.equal(guidance.idleStatus, '按住话筒，接着上次的话题继续讲');
    assert.equal(guidance.speechText, '欢迎回来，胡敏先。上次我们聊到“我的孩童时代”。今天可以接着说说：小时候家里谁最照顾您？');
    assert.equal(guidance.shouldAutoSpeak, true);
});
