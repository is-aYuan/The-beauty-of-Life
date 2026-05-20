// 模块：语音 provider 路由。server.js 只调用统一 ASR/TTS 接口，由配置选择腾讯或豆包。

const { createTencentVoiceProvider } = require('./providers/tencentVoiceProvider');
const { createDoubaoVoiceProvider } = require('./providers/doubaoVoiceProvider');

function createVoiceProvider(config, deps = {}) {
    if (config.voiceProvider === 'doubao') {
        return createDoubaoVoiceProvider({
            config: config.doubaoSpeech,
            fetchImpl: deps.fetchImpl,
            requestIdFactory: deps.requestIdFactory,
            pcmToWav: deps.pcmToWav,
        });
    }

    return createTencentVoiceProvider({
        asrClient: deps.asrClient,
        ttsClient: deps.ttsClient,
        speechRateToTtsSpeed: deps.speechRateToTtsSpeed,
        sessionIdFactory: deps.sessionIdFactory,
    });
}

module.exports = {
    createVoiceProvider,
};
