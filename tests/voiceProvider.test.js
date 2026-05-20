const test = require('node:test');
const assert = require('node:assert/strict');

const {
    createVoiceProvider,
} = require('../lib/voice');
const {
    tencentSpeechRateToDoubaoSpeechRate,
} = require('../lib/voice/providers/doubaoVoiceProvider');

test('Tencent voice provider keeps the existing ASR and TTS request parameters', async () => {
    let asrParams = null;
    let ttsParams = null;
    const provider = createVoiceProvider(
        { voiceProvider: 'tencent' },
        {
            asrClient: {
                async SentenceRecognition(params) {
                    asrParams = params;
                    return { Result: '识别结果' };
                },
            },
            ttsClient: {
                async TextToVoice(params) {
                    ttsParams = params;
                    return { Audio: Buffer.from('mp3').toString('base64') };
                },
            },
            speechRateToTtsSpeed: () => 0.85,
            sessionIdFactory: () => 'tts_test',
        },
    );

    const text = await provider.recognizeSpeech(Buffer.from([1, 2, 3]));
    const audio = await provider.synthesizeSpeech('您好', { speechRatePreset: 'normal' });

    assert.equal(text, '识别结果');
    assert.equal(audio.toString(), 'mp3');
    assert.equal(asrParams.EngSerViceType, '16k_zh');
    assert.equal(asrParams.VoiceFormat, 'pcm');
    assert.equal(ttsParams.SessionId, 'tts_test');
    assert.equal(ttsParams.Codec, 'mp3');
    assert.equal(ttsParams.Speed, 0.85);
});

test('Doubao speech provider sends WAV audio for recording-file recognition', async () => {
    let request = null;
    const provider = createVoiceProvider(
        {
            voiceProvider: 'doubao',
            doubaoSpeech: {
                apiKey: 'speech-key',
                asrResourceId: 'volc.bigasr.auc_turbo',
                asrUrl: 'https://speech.example.com/asr',
                ttsUrl: 'https://speech.example.com/tts',
                ttsResourceId: 'volc.service_type.10029',
                ttsVoice: 'voice-id',
                ttsFormat: 'mp3',
                ttsSampleRate: 16000,
            },
        },
        {
            fetchImpl: async (url, options) => {
                request = { url, options, body: JSON.parse(options.body) };
                return {
                    ok: true,
                    headers: { get: () => '20000000' },
                    async json() {
                        return { result: { text: '豆包识别结果' } };
                    },
                };
            },
            requestIdFactory: () => 'req-asr',
        },
    );

    const text = await provider.recognizeSpeech(Buffer.from([1, 0, 2, 0]));

    assert.equal(text, '豆包识别结果');
    assert.equal(request.url, 'https://speech.example.com/asr');
    assert.equal(request.options.headers['X-Api-Key'], 'speech-key');
    assert.equal(request.options.headers['X-Api-Resource-Id'], 'volc.bigasr.auc_turbo');
    assert.equal(request.options.headers['X-Api-Request-Id'], 'req-asr');
    assert.equal(
        Buffer.from(request.body.audio.data, 'base64').toString('ascii', 0, 4),
        'RIFF',
    );
});

test('Doubao speech provider parses base64 TTS audio from a chunked JSON response', async () => {
    let request = null;
    const provider = createVoiceProvider(
        {
            voiceProvider: 'doubao',
            doubaoSpeech: {
                apiKey: 'speech-key',
                asrResourceId: 'volc.bigasr.auc_turbo',
                asrUrl: 'https://speech.example.com/asr',
                ttsUrl: 'https://speech.example.com/tts',
                ttsResourceId: 'volc.service_type.10029',
                ttsVoice: 'voice-id',
                ttsFormat: 'mp3',
                ttsSampleRate: 16000,
            },
        },
        {
            fetchImpl: async (url, options) => {
                request = { url, options, body: JSON.parse(options.body) };
                return {
                    ok: true,
                    headers: { get: () => '20000000' },
                    async text() {
                        return `${JSON.stringify({ data: Buffer.from('mp3-audio').toString('base64') })}\n`;
                    },
                };
            },
            requestIdFactory: () => 'req-tts',
        },
    );

    const audio = await provider.synthesizeSpeech('您好', { speechRatePreset: 'fast' });

    assert.equal(audio.toString(), 'mp3-audio');
    assert.equal(request.url, 'https://speech.example.com/tts');
    assert.equal(request.options.headers['X-Api-Resource-Id'], 'volc.service_type.10029');
    assert.equal(request.body.req_params.text, '您好');
    assert.equal(request.body.req_params.speaker, 'voice-id');
    assert.equal(request.body.req_params.audio_params.format, 'mp3');
    assert.equal(request.body.req_params.audio_params.sample_rate, 16000);
    assert.equal(request.body.req_params.audio_params.speech_rate, 100);
});

test('maps existing Tencent-style speech preferences to Doubao speech_rate semantics', () => {
    assert.equal(tencentSpeechRateToDoubaoSpeechRate(-2), -50);
    assert.equal(tencentSpeechRateToDoubaoSpeechRate(0.85), 0);
    assert.equal(tencentSpeechRateToDoubaoSpeechRate(2), 100);
});
