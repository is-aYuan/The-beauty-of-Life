const test = require('node:test');
const assert = require('node:assert/strict');

const {
    createAiProvider,
    createChatProviderEntries,
} = require('../lib/ai');
const {
    mapMessagesToArk,
} = require('../lib/ai/providers/doubaoArkProvider');

test('Hunyuan provider keeps the existing Tencent message shape and parameters', async () => {
    let receivedParams = null;
    const provider = createAiProvider(
        {
            llmProvider: 'hunyuan',
            tencent: { hunyuanModel: 'hunyuan-test' },
        },
        {
            hunyuanClient: {
                async ChatCompletions(params) {
                    receivedParams = params;
                    return {
                        Choices: [{ Message: { Content: '混元回复' } }],
                        Usage: {
                            PromptTokens: 12,
                            CompletionTokens: 8,
                            TotalTokens: 20,
                        },
                    };
                },
            },
        },
    );

    const reply = await provider.completeChat({
        messages: [{ Role: 'user', Content: '你好' }],
        temperature: 0.7,
        topP: 0.9,
    });

    assert.deepEqual(reply, {
        text: '混元回复',
        usage: {
            inputTokens: 12,
            outputTokens: 8,
            totalTokens: 20,
        },
        provider: 'hunyuan',
        model: 'hunyuan-test',
    });
    assert.deepEqual(receivedParams, {
        Model: 'hunyuan-test',
        Messages: [{ Role: 'user', Content: '你好' }],
        Temperature: 0.7,
        TopP: 0.9,
    });
});

test('Doubao Ark provider converts Tencent messages to OpenAI-compatible messages', () => {
    assert.deepEqual(
        mapMessagesToArk([
            { Role: 'system', Content: '系统提示' },
            { Role: 'user', Content: '你好' },
            { Role: 'assistant', Content: '您好' },
        ]),
        [
            { role: 'system', content: '系统提示' },
            { role: 'user', content: '你好' },
            { role: 'assistant', content: '您好' },
        ],
    );
});

test('Doubao Ark provider calls the configured ep endpoint through an OpenAI-compatible client', async () => {
    let receivedParams = null;
    const provider = createAiProvider(
        {
            llmProvider: 'doubao',
            ark: {
                apiKey: 'ark-key',
                baseURL: 'https://ark.example.com/api/v3',
                chatModel: 'ep-123',
            },
        },
        {
            arkClient: {
                chat: {
                    completions: {
                        async create(params) {
                            receivedParams = params;
                            return {
                                choices: [{ message: { content: '豆包回复' } }],
                                usage: {
                                    prompt_tokens: 10,
                                    prompt_cache_hit_tokens: 6,
                                    completion_tokens: 5,
                                    total_tokens: 15,
                                },
                            };
                        },
                    },
                },
            },
        },
    );

    const reply = await provider.completeChat({
        messages: [{ Role: 'user', Content: '你好' }],
        temperature: 0.7,
        topP: 0.9,
    });

    assert.deepEqual(reply, {
        text: '豆包回复',
        usage: {
            inputTokens: 10,
            cachedInputTokens: 6,
            outputTokens: 5,
            totalTokens: 15,
        },
        provider: 'doubao_ark',
        model: 'ep-123',
    });
    assert.deepEqual(receivedParams, {
        model: 'ep-123',
        messages: [{ role: 'user', content: '你好' }],
        temperature: 0.7,
        top_p: 0.9,
    });
});

test('creates ordered chat provider entries for primary and fallback models', () => {
    const entries = createChatProviderEntries(
        {
            llmProvider: 'doubao',
            chat: {
                primaryProvider: 'doubao',
                fallbackProvider: 'hunyuan',
                primaryTimeoutMs: 9000,
                fallbackTimeoutMs: 7000,
            },
            ark: {
                apiKey: 'ark-key',
                baseURL: 'https://ark.example.com/api/v3',
                chatModel: 'ep-123',
            },
            tencent: { hunyuanModel: 'hunyuan-test' },
        },
        {
            arkClient: { chat: { completions: { create() {} } } },
            hunyuanClient: { ChatCompletions() {} },
        },
    );

    assert.equal(entries.length, 2);
    assert.equal(entries[0].role, 'primary');
    assert.equal(entries[0].provider.name, 'doubao');
    assert.equal(entries[0].timeoutMs, 9000);
    assert.equal(entries[1].role, 'fallback');
    assert.equal(entries[1].provider.name, 'hunyuan');
    assert.equal(entries[1].timeoutMs, 7000);
});
