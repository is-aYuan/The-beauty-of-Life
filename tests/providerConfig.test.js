const test = require('node:test');
const assert = require('node:assert/strict');

const {
    getProviderConfig,
    validateProviderConfig,
} = require('../lib/providerConfig');

test('defaults provider switches to the current Hunyuan and Tencent voice stack', () => {
    const config = getProviderConfig({});

    assert.equal(config.llmProvider, 'hunyuan');
    assert.equal(config.voiceProvider, 'tencent');
    assert.equal(config.tencent.region, 'ap-guangzhou');
    assert.equal(config.tencent.hunyuanModel, 'hunyuan-turbos-latest');
});

test('reads Doubao Ark and speech placeholders without changing DeepSeek settings', () => {
    const config = getProviderConfig({
        LLM_PROVIDER: 'doubao',
        VOICE_PROVIDER: 'doubao',
        ARK_API_KEY: 'ark-key',
        ARK_BASE_URL: 'https://ark.example.com/api/v3',
        ARK_CHAT_MODEL: 'ep-123',
        DOUBAO_SPEECH_API_KEY: 'speech-key',
        DOUBAO_ASR_RESOURCE_ID: 'volc.bigasr.auc_turbo',
        DOUBAO_TTS_RESOURCE_ID: 'volc.service_type.10029',
        DOUBAO_TTS_VOICE: 'zh_female_vv_uranus_bigtts',
    });

    assert.equal(config.llmProvider, 'doubao');
    assert.equal(config.voiceProvider, 'doubao');
    assert.equal(config.chat.primaryProvider, 'doubao');
    assert.equal(config.chat.fallbackProvider, 'hunyuan');
    assert.equal(config.chat.primaryTimeoutMs, 15000);
    assert.equal(config.chat.fallbackTimeoutMs, 15000);
    assert.equal(config.chat.ttsTimeoutMs, 12000);
    assert.equal(config.ark.apiKey, 'ark-key');
    assert.equal(config.ark.chatModel, 'ep-123');
    assert.equal(config.doubaoSpeech.apiKey, 'speech-key');
    assert.equal(config.doubaoSpeech.asrResourceId, 'volc.bigasr.auc_turbo');
    assert.equal(config.doubaoSpeech.ttsVoice, 'zh_female_vv_uranus_bigtts');
});

test('reads explicit chat fallback providers and timeout budgets', () => {
    const config = getProviderConfig({
        LLM_PROVIDER: 'doubao',
        CHAT_PRIMARY_PROVIDER: 'doubao',
        CHAT_FALLBACK_PROVIDER: 'hunyuan',
        CHAT_PRIMARY_TIMEOUT_MS: '9000',
        CHAT_FALLBACK_TIMEOUT_MS: '7000',
        TURN_TOTAL_TIMEOUT_MS: '25000',
        TTS_TIMEOUT_MS: '5000',
    });

    assert.equal(config.chat.primaryProvider, 'doubao');
    assert.equal(config.chat.fallbackProvider, 'hunyuan');
    assert.equal(config.chat.primaryTimeoutMs, 9000);
    assert.equal(config.chat.fallbackTimeoutMs, 7000);
    assert.equal(config.chat.turnTotalTimeoutMs, 25000);
    assert.equal(config.chat.ttsTimeoutMs, 5000);
});

test('throws a clear error when an unknown provider is configured', () => {
    assert.throws(
        () => getProviderConfig({ LLM_PROVIDER: 'unknown' }),
        /LLM_PROVIDER must be one of hunyuan, doubao/,
    );

    assert.throws(
        () => getProviderConfig({ VOICE_PROVIDER: 'unknown' }),
        /VOICE_PROVIDER must be one of tencent, doubao/,
    );
});

test('validates only the selected provider credentials', () => {
    const defaultConfig = getProviderConfig({
        TENCENT_SECRET_ID: 'id',
        TENCENT_SECRET_KEY: 'key',
    });

    assert.doesNotThrow(() => validateProviderConfig(defaultConfig));

    const doubaoConfig = getProviderConfig({
        LLM_PROVIDER: 'doubao',
        VOICE_PROVIDER: 'doubao',
    });

    assert.throws(
        () => validateProviderConfig(doubaoConfig),
        /ARK_API_KEY/,
    );
});
