// 模块：火山方舟对话 provider。将项目内腾讯消息格式转换为 OpenAI 兼容格式。

function mapMessagesToArk(messages = []) {
    return messages.map((message) => ({
        role: String(message.Role || message.role || 'user').toLowerCase(),
        content: message.Content ?? message.content ?? '',
    }));
}

function createArkClient({ apiKey, baseURL, OpenAI }) {
    const OpenAIClient = OpenAI || require('openai');
    return new OpenAIClient({
        apiKey,
        baseURL,
    });
}

function mapArkUsage(usage = {}) {
    return {
        inputTokens: usage.prompt_tokens || 0,
        cachedInputTokens: usage.prompt_cache_hit_tokens || usage.cached_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
    };
}

function createDoubaoArkProvider({ client, apiKey, baseURL, model, OpenAI }) {
    if (!client && !apiKey) {
        throw new Error('Doubao Ark provider requires ARK_API_KEY');
    }

    const arkClient = client || createArkClient({ apiKey, baseURL, OpenAI });

    if (!model) {
        throw new Error('Doubao Ark provider requires ARK_CHAT_MODEL');
    }

    return {
        name: 'doubao',
        async completeChat({ messages, temperature = 0.7, topP = 0.9 }) {
            const result = await arkClient.chat.completions.create({
                model,
                messages: mapMessagesToArk(messages),
                temperature,
                top_p: topP,
            });

            return {
                text: result.choices?.[0]?.message?.content || '',
                usage: mapArkUsage(result.usage),
                provider: 'doubao_ark',
                model,
            };
        },
    };
}

module.exports = {
    mapMessagesToArk,
    mapArkUsage,
    createDoubaoArkProvider,
};
