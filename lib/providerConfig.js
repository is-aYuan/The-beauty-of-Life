// 模块：AI/语音供应商配置。集中读取和校验 provider 开关，避免环境变量散落在业务流程里。

const LLM_PROVIDERS = Object.freeze(['hunyuan', 'doubao']);
const VOICE_PROVIDERS = Object.freeze(['tencent', 'doubao']);

function readString(env, key, fallback = '') {
    const value = env?.[key];
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return trimmed || fallback;
}

function readInteger(env, key, fallback) {
    const value = Number.parseInt(readString(env, key), 10);
    return Number.isFinite(value) ? value : fallback;
}

function normalizeProvider(env, key, allowedValues, fallback) {
    const value = readString(env, key, fallback).toLowerCase();
    if (!allowedValues.includes(value)) {
        throw new Error(`${key} must be one of ${allowedValues.join(', ')}`);
    }
    return value;
}

function getProviderConfig(env = process.env) {
    const llmProvider = normalizeProvider(env, 'LLM_PROVIDER', LLM_PROVIDERS, 'hunyuan');
    const voiceProvider = normalizeProvider(env, 'VOICE_PROVIDER', VOICE_PROVIDERS, 'tencent');

    return {
        llmProvider,
        voiceProvider,
        tencent: {
            secretId: readString(env, 'TENCENT_SECRET_ID'),
            secretKey: readString(env, 'TENCENT_SECRET_KEY'),
            region: readString(env, 'TENCENT_REGION', 'ap-guangzhou'),
            hunyuanModel: readString(env, 'HUNYUAN_MODEL', 'hunyuan-turbos-latest'),
        },
        ark: {
            apiKey: readString(env, 'ARK_API_KEY'),
            baseURL: readString(env, 'ARK_BASE_URL', 'https://ark.cn-beijing.volces.com/api/v3'),
            chatModel: readString(env, 'ARK_CHAT_MODEL'),
        },
        doubaoSpeech: {
            apiKey: readString(env, 'DOUBAO_SPEECH_API_KEY'),
            appKey: readString(env, 'DOUBAO_SPEECH_APP_KEY'),
            appId: readString(env, 'DOUBAO_SPEECH_APP_ID'),
            accessKey: readString(env, 'DOUBAO_SPEECH_ACCESS_KEY'),
            asrResourceId: readString(env, 'DOUBAO_ASR_RESOURCE_ID', 'volc.bigasr.auc_turbo'),
            asrUrl: readString(env, 'DOUBAO_ASR_URL', 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash'),
            ttsResourceId: readString(env, 'DOUBAO_TTS_RESOURCE_ID'),
            ttsUrl: readString(env, 'DOUBAO_TTS_URL', 'https://openspeech.bytedance.com/api/v3/tts/unidirectional'),
            ttsVoice: readString(env, 'DOUBAO_TTS_VOICE'),
            ttsFormat: readString(env, 'DOUBAO_TTS_FORMAT', 'mp3'),
            ttsSampleRate: readInteger(env, 'DOUBAO_TTS_SAMPLE_RATE', 16000),
            ttsNamespace: readString(env, 'DOUBAO_TTS_NAMESPACE', 'BidirectionalTTS'),
            userId: readString(env, 'DOUBAO_SPEECH_USER_ID', 'story-workshop'),
        },
    };
}

function assertRequired(value, name) {
    if (!value) {
        throw new Error(`Missing required provider configuration: ${name}`);
    }
}

function validateProviderConfig(config) {
    if (config.llmProvider === 'hunyuan') {
        assertRequired(config.tencent.secretId, 'TENCENT_SECRET_ID');
        assertRequired(config.tencent.secretKey, 'TENCENT_SECRET_KEY');
    }

    if (config.llmProvider === 'doubao') {
        assertRequired(config.ark.apiKey, 'ARK_API_KEY');
        assertRequired(config.ark.chatModel, 'ARK_CHAT_MODEL');
    }

    if (config.voiceProvider === 'tencent') {
        assertRequired(config.tencent.secretId, 'TENCENT_SECRET_ID');
        assertRequired(config.tencent.secretKey, 'TENCENT_SECRET_KEY');
    }

    if (config.voiceProvider === 'doubao') {
        if (!config.doubaoSpeech.apiKey && !(config.doubaoSpeech.appKey && config.doubaoSpeech.accessKey)) {
            throw new Error('Missing required provider configuration: DOUBAO_SPEECH_API_KEY or DOUBAO_SPEECH_APP_KEY + DOUBAO_SPEECH_ACCESS_KEY');
        }
        assertRequired(config.doubaoSpeech.asrResourceId, 'DOUBAO_ASR_RESOURCE_ID');
        assertRequired(config.doubaoSpeech.ttsResourceId, 'DOUBAO_TTS_RESOURCE_ID');
        assertRequired(config.doubaoSpeech.ttsVoice, 'DOUBAO_TTS_VOICE');
    }
}

function getProviderSummary(config) {
    return {
        llmProvider: config.llmProvider,
        voiceProvider: config.voiceProvider,
        hunyuanModel: config.tencent.hunyuanModel,
        arkChatModel: config.ark.chatModel || '(not configured)',
        doubaoAsrResourceId: config.doubaoSpeech.asrResourceId,
        doubaoTtsResourceId: config.doubaoSpeech.ttsResourceId || '(not configured)',
    };
}

module.exports = {
    LLM_PROVIDERS,
    VOICE_PROVIDERS,
    getProviderConfig,
    validateProviderConfig,
    getProviderSummary,
};
