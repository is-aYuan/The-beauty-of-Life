// 模块：腾讯语音 provider。封装现有 ASR/TTS 参数，保持默认路径行为不变。

function defaultSessionIdFactory() {
    return `tts_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createTencentVoiceProvider({
    asrClient,
    ttsClient,
    speechRateToTtsSpeed,
    sessionIdFactory = defaultSessionIdFactory,
}) {
    if (!asrClient || !ttsClient) {
        throw new Error('Tencent voice provider requires asrClient and ttsClient');
    }

    return {
        name: 'tencent',
        async recognizeSpeech(audioBuffer) {
            const audioBase64 = audioBuffer.toString('base64');
            const result = await asrClient.SentenceRecognition({
                EngSerViceType: '16k_zh',
                SourceType: 1,
                VoiceFormat: 'pcm',
                Data: audioBase64,
                DataLen: audioBuffer.length,
            });

            return result.Result || null;
        },
        async synthesizeSpeech(text, userPreferences) {
            const result = await ttsClient.TextToVoice({
                Text: text,
                SessionId: sessionIdFactory(),
                VoiceType: 1002,
                Codec: 'mp3',
                SampleRate: 16000,
                Speed: speechRateToTtsSpeed(userPreferences),
                Volume: 8,
            });

            return result.Audio ? Buffer.from(result.Audio, 'base64') : null;
        },
    };
}

module.exports = {
    createTencentVoiceProvider,
};
