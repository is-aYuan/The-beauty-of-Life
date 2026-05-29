// 模块：腾讯混元对话 provider。保留现有 ChatCompletions 参数形态，便于无行为变化地回滚。

function createHunyuanProvider({ client, model }) {
    if (!client) {
        throw new Error('Hunyuan provider requires hunyuanClient');
    }

    return {
        name: 'hunyuan',
        async completeChat({ messages, temperature = 0.7, topP = 0.9 }) {
            const result = await client.ChatCompletions({
                Model: model,
                Messages: messages,
                Temperature: temperature,
                TopP: topP,
            });

            const usage = result.Usage || {};
            return {
                text: result.Choices?.[0]?.Message?.Content || '',
                usage: {
                    inputTokens: usage.PromptTokens || usage.InputTokens || 0,
                    outputTokens: usage.CompletionTokens || usage.OutputTokens || 0,
                    totalTokens: usage.TotalTokens || 0,
                },
                provider: 'hunyuan',
                model,
            };
        },
    };
}

module.exports = {
    createHunyuanProvider,
};
