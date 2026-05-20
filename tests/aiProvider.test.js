const test = require('node:test');
const assert = require('node:assert/strict');

const {
    createAiProvider,
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
                    return { Choices: [{ Message: { Content: '混元回复' } }] };
                },
            },
        },
    );

    const reply = await provider.completeChat({
        messages: [{ Role: 'user', Content: '你好' }],
        temperature: 0.7,
        topP: 0.9,
    });

    assert.equal(reply, '混元回复');
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
                            return { choices: [{ message: { content: '豆包回复' } }] };
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

    assert.equal(reply, '豆包回复');
    assert.deepEqual(receivedParams, {
        model: 'ep-123',
        messages: [{ role: 'user', content: '你好' }],
        temperature: 0.7,
        top_p: 0.9,
    });
});
