// 模块：豆包语音 provider。接入录音文件识别 2.0 和语音合成 2.0，并统一返回文本/音频 Buffer。

const { randomUUID } = require('crypto');
const { pcm16leToWav } = require('../audioFormat');
const {
    DEFAULT_USER_PREFERENCES,
    normalizeUserPreferences,
} = require('../../userPreferences');

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function tencentSpeechRateToDoubaoSpeechRate(value) {
    const normal = DEFAULT_USER_PREFERENCES.speechRate;
    const speechRate = typeof value === 'number' && Number.isFinite(value) ? value : normal;
    if (speechRate <= normal) {
        return Math.round(((speechRate + 2) / (normal + 2)) * 50 - 50);
    }
    return Math.round(((speechRate - normal) / (2 - normal)) * 100);
}

function createHeaders(config, resourceId, requestId) {
    const headers = {
        'Content-Type': 'application/json',
        'X-Api-Resource-Id': resourceId,
        'X-Api-Request-Id': requestId,
    };

    if (config.apiKey) {
        headers['X-Api-Key'] = config.apiKey;
    }

    if (config.appKey) {
        headers['X-Api-App-Key'] = config.appKey;
        headers['X-Api-App-Id'] = config.appKey;
    }

    if (config.appId) {
        headers['X-Api-App-Id'] = config.appId;
    }

    if (config.accessKey) {
        headers['X-Api-Access-Key'] = config.accessKey;
    }

    return headers;
}

function getHeader(headers, name) {
    if (!headers || typeof headers.get !== 'function') return '';
    return headers.get(name) || headers.get(name.toLowerCase()) || '';
}

async function assertDoubaoResponse(response) {
    const statusCode = getHeader(response.headers, 'X-Api-Status-Code');
    if (!response.ok || (statusCode && statusCode !== '20000000')) {
        const statusMessage = getHeader(response.headers, 'X-Api-Status-Message');
        throw new Error(`Doubao speech request failed: ${statusCode || response.status} ${statusMessage || response.statusText || ''}`.trim());
    }
}

function extractAsrText(payload) {
    return payload?.result?.text ||
        payload?.result?.utterances?.map((item) => item.text).filter(Boolean).join('') ||
        payload?.text ||
        payload?.data?.text ||
        payload?.data?.result?.text ||
        null;
}

function collectBase64Audio(payload, chunks = []) {
    if (!payload || typeof payload !== 'object') return chunks;

    const directValue = payload.audio || payload.audio_data || payload.data || payload.result?.audio || payload.result?.audio_data || payload.result?.data;
    if (typeof directValue === 'string') {
        chunks.push(directValue.replace(/^data:audio\/[^;]+;base64,/, ''));
    }

    const nestedValues = [payload.result, payload.response, payload.payload];
    for (const nestedValue of nestedValues) {
        if (nestedValue && nestedValue !== payload) {
            collectBase64Audio(nestedValue, chunks);
        }
    }

    if (Array.isArray(payload.segments)) {
        for (const segment of payload.segments) {
            collectBase64Audio(segment, chunks);
        }
    }

    return chunks;
}

function parseTtsTextResponse(rawText) {
    const chunks = [];
    const trimmed = rawText.trim();

    if (!trimmed) return null;

    try {
        collectBase64Audio(JSON.parse(trimmed), chunks);
    } catch (err) {
        const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        for (const line of lines) {
            const jsonText = line.startsWith('data:') ? line.slice(5).trim() : line;
            if (!jsonText || jsonText === '[DONE]') continue;
            try {
                collectBase64Audio(JSON.parse(jsonText), chunks);
            } catch (lineErr) {
                // Ignore keep-alive or non-JSON transport lines from chunked/SSE responses.
            }
        }
    }

    if (chunks.length === 0) return null;
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk, 'base64')));
}

function createDoubaoVoiceProvider({
    config,
    fetchImpl = globalThis.fetch,
    requestIdFactory = randomUUID,
    pcmToWav = pcm16leToWav,
}) {
    if (typeof fetchImpl !== 'function') {
        throw new Error('Doubao voice provider requires fetch support');
    }

    const speechConfig = config || {};
    if (!speechConfig.apiKey && !(speechConfig.appKey && speechConfig.accessKey)) {
        throw new Error('Doubao voice provider requires DOUBAO_SPEECH_API_KEY or DOUBAO_SPEECH_APP_KEY + DOUBAO_SPEECH_ACCESS_KEY');
    }
    if (!speechConfig.ttsResourceId) {
        throw new Error('Doubao voice provider requires DOUBAO_TTS_RESOURCE_ID');
    }
    if (!speechConfig.ttsVoice) {
        throw new Error('Doubao voice provider requires DOUBAO_TTS_VOICE');
    }

    return {
        name: 'doubao',
        async recognizeSpeech(audioBuffer) {
            const requestId = requestIdFactory();
            const wavBuffer = pcmToWav(audioBuffer, {
                sampleRate: 16000,
                channels: 1,
                bitsPerSample: 16,
            });
            const response = await fetchImpl(speechConfig.asrUrl, {
                method: 'POST',
                headers: createHeaders(speechConfig, speechConfig.asrResourceId, requestId),
                body: JSON.stringify({
                    user: { uid: speechConfig.userId || speechConfig.appKey || speechConfig.appId || 'story-workshop' },
                    request: {
                        model_name: 'bigmodel',
                        enable_punc: true,
                    },
                    audio: {
                        format: 'wav',
                        data: wavBuffer.toString('base64'),
                    },
                }),
            });

            await assertDoubaoResponse(response);
            const payload = await response.json();
            return extractAsrText(payload);
        },
        async synthesizeSpeech(text, userPreferences = DEFAULT_USER_PREFERENCES) {
            const requestId = requestIdFactory();
            const preferences = normalizeUserPreferences(userPreferences);
            const response = await fetchImpl(speechConfig.ttsUrl, {
                method: 'POST',
                headers: createHeaders(speechConfig, speechConfig.ttsResourceId, requestId),
                body: JSON.stringify({
                    user: { uid: speechConfig.userId || speechConfig.appKey || speechConfig.appId || 'story-workshop' },
                    namespace: speechConfig.ttsNamespace || 'BidirectionalTTS',
                    req_params: {
                        text,
                        speaker: speechConfig.ttsVoice,
                        audio_params: {
                            format: speechConfig.ttsFormat || 'mp3',
                            sample_rate: speechConfig.ttsSampleRate || 16000,
                            speech_rate: clamp(tencentSpeechRateToDoubaoSpeechRate(preferences.speechRate), -50, 100),
                        },
                    },
                }),
            });

            await assertDoubaoResponse(response);
            return parseTtsTextResponse(await response.text());
        },
    };
}

module.exports = {
    createDoubaoVoiceProvider,
    tencentSpeechRateToDoubaoSpeechRate,
    parseTtsTextResponse,
};
