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

            return result.Choices?.[0]?.Message?.Content || '';
        },
    };
}

module.exports = {
    createHunyuanProvider,
};
