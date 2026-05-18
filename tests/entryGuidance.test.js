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

    assert.match(guidance.storyPrompt, /像聊天一样讲/);
    assert.match(guidance.storyPrompt, /我的孩童时代/);
    assert.doesNotMatch(guidance.storyPrompt, /继续/);
    assert.equal(guidance.idleStatus, '选一个主题，按住话筒开始讲第一段回忆');
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
    assert.equal(guidance.idleStatus, '请点击开始讲述');
});
