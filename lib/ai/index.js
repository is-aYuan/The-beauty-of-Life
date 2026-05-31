// 模块：AI 对话 provider 路由。server.js 只调用统一接口，由配置选择混元或火山方舟。

const { createHunyuanProvider } = require('./providers/hunyuanProvider');
const { createDoubaoArkProvider } = require('./providers/doubaoArkProvider');

function createAiProviderByName(providerName, config, deps = {}) {
    if (providerName === 'doubao') {
        return createDoubaoArkProvider({
            client: deps.arkClient,
            OpenAI: deps.OpenAI,
            apiKey: config.ark?.apiKey,
            baseURL: config.ark?.baseURL,
            model: config.ark?.chatModel,
        });
    }

    return createHunyuanProvider({
        client: deps.hunyuanClient,
        model: config.tencent?.hunyuanModel,
    });
}

function createAiProvider(config, deps = {}) {
    return createAiProviderByName(config.llmProvider, config, deps);
}

function tryCreateAiProviderByName(providerName, config, deps = {}, logger = console) {
    try {
        return createAiProviderByName(providerName, config, deps);
    } catch (err) {
        logger.warn?.(`[AI] ${providerName} provider unavailable:`, err.message || err);
        return null;
    }
}

function createChatProviderEntries(config, deps = {}, logger = console) {
    const primaryName = config.chat?.primaryProvider || config.llmProvider;
    const fallbackName = config.chat?.fallbackProvider;
    const primary = createAiProviderByName(primaryName, config, deps);
    const entries = [{
        role: 'primary',
        provider: primary,
        timeoutMs: config.chat?.primaryTimeoutMs || 15000,
    }];

    if (fallbackName && fallbackName !== primaryName) {
        const fallback = tryCreateAiProviderByName(fallbackName, config, deps, logger);
        if (fallback) {
            entries.push({
                role: 'fallback',
                provider: fallback,
                timeoutMs: config.chat?.fallbackTimeoutMs || 15000,
            });
        }
    }

    return entries;
}

module.exports = {
    createAiProvider,
    createAiProviderByName,
    createChatProviderEntries,
};
