const test = require('node:test');
const assert = require('node:assert/strict');

const {
    completeChatWithFallback,
} = require('../lib/ai/fallbackChat');
const {
    buildLocalFallbackReply,
} = require('../lib/ai/localFallbackReply');
const {
    resolveTurnStatus,
    runReliableTurn,
} = require('../lib/turns/turnOrchestrator');

function createUsageRecorder() {
    const events = [];
    return {
        events,
        async recordUsage(event) {
            events.push(event);
        },
    };
}

test('chat fallback returns primary model response without calling fallback provider', async () => {
    let fallbackCalled = false;
    const usageRecorder = createUsageRecorder();

    const result = await completeChatWithFallback({
        providerEntries: [
            {
                provider: {
                    name: 'primary',
                    async completeChat() {
                        return {
                            text: '主模型回复',
                            provider: 'primary_provider',
                            model: 'primary-model',
                            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                        };
                    },
                },
                timeoutMs: 50,
            },
            {
                provider: {
                    name: 'fallback',
                    async completeChat() {
                        fallbackCalled = true;
                        return { text: '备用模型回复' };
                    },
                },
                timeoutMs: 50,
            },
        ],
        usageRecorder,
        usageContext: { userId: 'u1', sessionId: 's1' },
    });

    assert.equal(result.text, '主模型回复');
    assert.equal(result.provider, 'primary_provider');
    assert.equal(result.fallbackLevel, 0);
    assert.equal(fallbackCalled, false);
    assert.equal(usageRecorder.events.length, 1);
    assert.equal(usageRecorder.events[0].status, 'success');
});

test('chat fallback switches to fallback provider when primary times out', async () => {
    const usageRecorder = createUsageRecorder();

    const result = await completeChatWithFallback({
        providerEntries: [
            {
                provider: {
                    name: 'primary',
                    async completeChat() {
                        await new Promise((resolve) => setTimeout(resolve, 30));
                        return { text: '太慢的主模型回复' };
                    },
                },
                timeoutMs: 5,
            },
            {
                provider: {
                    name: 'hunyuan',
                    async completeChat() {
                        return {
                            text: '备用模型回复',
                            provider: 'hunyuan',
                            model: 'hunyuan-test',
                        };
                    },
                },
                timeoutMs: 50,
            },
        ],
        usageRecorder,
    });

    assert.equal(result.text, '备用模型回复');
    assert.equal(result.provider, 'hunyuan');
    assert.equal(result.fallbackLevel, 1);
    assert.equal(result.localFallback, false);
    assert.equal(usageRecorder.events[0].status, 'failed');
    assert.match(usageRecorder.events[0].errorMessage, /timed out/);
    assert.equal(usageRecorder.events[1].status, 'success');
});

test('chat fallback returns local elder-friendly prompt when every model fails', async () => {
    const result = await completeChatWithFallback({
        providerEntries: [
            {
                provider: {
                    name: 'primary',
                    async completeChat() {
                        throw new Error('primary failed');
                    },
                },
                timeoutMs: 10,
            },
            {
                provider: {
                    name: 'fallback',
                    async completeChat() {
                        throw new Error('fallback failed');
                    },
                },
                timeoutMs: 10,
            },
        ],
        localFallbackContext: {
            topicTitle: '我的孩童时代',
            userText: '小时候我住在村里。',
        },
    });

    assert.equal(result.provider, 'local');
    assert.equal(result.model, 'local-fallback');
    assert.equal(result.fallbackLevel, 2);
    assert.equal(result.localFallback, true);
    assert.match(result.text, /刚才这段我记下了/);
    assert.match(result.text, /我的孩童时代/);
    assert.doesNotMatch(result.text, /重新发送|模型失败|接口失败/);
});

test('local fallback does not pretend to understand missing content', () => {
    const reply = buildLocalFallbackReply();

    assert.match(reply, /我先陪您接着聊/);
    assert.doesNotMatch(reply, /刚才这段我记下了/);
});

test('reliable turn records fallback status and does not throw when conversation save fails', async () => {
    const updates = [];
    const store = {
        async safeUpdateTurn(turnId, userId, patch) {
            updates.push({ turnId, userId, patch });
        },
    };

    const result = await runReliableTurn({
        store,
        turn: {
            turnId: 'turn_1',
            userId: 'user_1',
            userText: '我讲了一段故事',
        },
        async runChat() {
            return {
                text: '备用模型回复',
                provider: 'hunyuan',
                model: 'hunyuan-test',
                fallbackLevel: 1,
                attempts: [{ provider: 'doubao', errorMessage: 'timeout' }],
            };
        },
        async saveTurn() {
            throw new Error('CloudBase save failed');
        },
    });

    assert.equal(result.status, 'completed_with_fallback');
    assert.equal(resolveTurnStatus({ fallbackLevel: 0 }), 'completed');
    assert.equal(resolveTurnStatus({ fallbackLevel: 1 }), 'completed_with_fallback');
    assert.equal(resolveTurnStatus({ localFallback: true }), 'failed_local_fallback');
    assert.deepEqual(updates.map((item) => item.patch.status).filter(Boolean), [
        'processing',
        'completed_with_fallback',
    ]);
    assert.equal(updates.at(-1).patch.saveStatus, 'save_failed');
});

test('reliable turn returns the AI reply even when conversation save hangs', async () => {
    const updates = [];
    const store = {
        async safeUpdateTurn(turnId, userId, patch) {
            updates.push({ turnId, userId, patch });
        },
    };

    const startedAt = Date.now();
    const result = await runReliableTurn({
        store,
        turn: {
            turnId: 'turn_slow_save',
            userId: 'user_1',
            userText: '我讲了一段故事',
        },
        async runChat() {
            return {
                text: '这段我记下了，您继续讲。',
                provider: 'doubao',
                model: 'doubao-test',
                fallbackLevel: 0,
            };
        },
        saveTurn() {
            return new Promise(() => {});
        },
        saveTimeoutMs: 5,
    });

    assert.equal(result.text, '这段我记下了，您继续讲。');
    assert.equal(result.status, 'completed');
    assert.ok(Date.now() - startedAt < 500);
    assert.equal(updates.at(-1).patch.saveStatus, 'save_failed');
    assert.match(updates.at(-1).patch.errorMessage, /save timed out/);
});
