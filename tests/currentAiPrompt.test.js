const test = require('node:test');
const assert = require('node:assert/strict');

test('current AI prompt prefers the latest AI chat message over stale entry guidance', async () => {
    const { buildCurrentAiPrompt } = await import('../lovable_ui/src/lib/currentAiPrompt.js');

    const prompt = buildCurrentAiPrompt({
        entryPrompt: '上次您讲到他的厨艺很好，今天可以接着聊聊。',
        chatHistory: [
            { id: 1, role: 'ai', text: '旧的 AI 开场' },
            { id: 2, role: 'user', text: '我妈做回锅肉很好吃。' },
            { id: 3, role: 'ai', text: '您母亲真厉害。那您母亲做回锅肉时，是不是会放一些特别的调料呀？' },
        ],
        convoState: 'idle',
    });

    assert.deepEqual(prompt, {
        text: '您母亲真厉害。那您母亲做回锅肉时，是不是会放一些特别的调料呀？',
        shouldShow: true,
    });
});

test('current AI prompt falls back to entry guidance before any AI message exists', async () => {
    const { buildCurrentAiPrompt } = await import('../lovable_ui/src/lib/currentAiPrompt.js');

    const prompt = buildCurrentAiPrompt({
        entryPrompt: '欢迎回来，今天可以接着聊聊。',
        chatHistory: [],
        convoState: 'idle',
    });

    assert.deepEqual(prompt, {
        text: '欢迎回来，今天可以接着聊聊。',
        shouldShow: true,
    });
});

test('current AI prompt keeps the last AI message after a user transcript is appended', async () => {
    const { buildCurrentAiPrompt } = await import('../lovable_ui/src/lib/currentAiPrompt.js');

    const prompt = buildCurrentAiPrompt({
        entryPrompt: '旧入口提示',
        chatHistory: [
            { id: 1, role: 'ai', text: '您母亲做回锅肉时，是不是会放一些特别的调料呀？' },
            { id: 2, role: 'user', text: '会放豆瓣酱。' },
        ],
        convoState: 'idle',
    });

    assert.deepEqual(prompt, {
        text: '您母亲做回锅肉时，是不是会放一些特别的调料呀？',
        shouldShow: true,
    });
});

test('current AI prompt hides while the user is recording', async () => {
    const { buildCurrentAiPrompt } = await import('../lovable_ui/src/lib/currentAiPrompt.js');

    const prompt = buildCurrentAiPrompt({
        entryPrompt: '欢迎回来，今天可以接着聊聊。',
        chatHistory: [{ id: 1, role: 'ai', text: '最新 AI 追问' }],
        convoState: 'userRecording',
    });

    assert.deepEqual(prompt, {
        text: '最新 AI 追问',
        shouldShow: false,
    });
});
