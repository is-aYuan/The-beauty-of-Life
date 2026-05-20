// 模块：AI 对话 provider 路由。server.js 只调用统一接口，由配置选择混元或火山方舟。

const { createHunyuanProvider } = require('./providers/hunyuanProvider');
const { createDoubaoArkProvider } = require('./providers/doubaoArkProvider');

function createAiProvider(config, deps = {}) {
    if (config.llmProvider === 'doubao') {
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

module.exports = {
    createAiProvider,
};
