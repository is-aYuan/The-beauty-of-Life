// 模块：对话模型兜底执行器。主模型超时或失败后自动切换备用模型，最终交给本地兜底文案。

const {
    buildLocalFallbackReply,
} = require('./localFallbackReply');

class TimeoutError extends Error {
    constructor(label, timeoutMs) {
        super(`${label} timed out after ${timeoutMs}ms`);
        this.name = 'TimeoutError';
        this.timeoutMs = timeoutMs;
    }
}

function withTimeout(promise, timeoutMs, label = 'operation') {
    const safeTimeoutMs = Number(timeoutMs);
    if (!Number.isFinite(safeTimeoutMs) || safeTimeoutMs <= 0) return promise;

    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new TimeoutError(label, safeTimeoutMs)), safeTimeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
    });
}

function normalizeProviderEntry(entry, index) {
    if (!entry) return null;
    const provider = entry.provider || entry;
    if (!provider || typeof provider.completeChat !== 'function') return null;
    return {
        role: entry.role || (index === 0 ? 'primary' : 'fallback'),
        provider,
        timeoutMs: entry.timeoutMs,
    };
}

function normalizeAiText(result) {
    if (typeof result === 'string') return result.trim();
    return String(result?.text || '').trim();
}

async function recordChatUsage(usageRecorder, event) {
    if (!usageRecorder || typeof usageRecorder.recordUsage !== 'function') return;
    await usageRecorder.recordUsage(event);
}

async function completeChatWithFallback({
    providerEntries = [],
    messages = [],
    temperature = 0.7,
    topP = 0.9,
    usageRecorder = null,
    usageContext = {},
    localFallbackContext = {},
} = {}) {
    const entries = providerEntries
        .map(normalizeProviderEntry)
        .filter(Boolean);
    const attempts = [];

    for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        const providerName = entry.provider.name || entry.role || `provider_${index}`;
        const usageStartTime = Date.now();

        try {
            const result = await withTimeout(
                entry.provider.completeChat({ messages, temperature, topP }),
                entry.timeoutMs,
                `chat:${providerName}`,
            );
            const text = normalizeAiText(result);
            if (!text) {
                throw new Error(`${providerName} returned empty chat text`);
            }

            await recordChatUsage(usageRecorder, {
                userId: usageContext.userId || null,
                sessionId: usageContext.sessionId || null,
                provider: result?.provider || providerName,
                model: result?.model || '',
                operation: 'chat',
                ...(result?.usage || {}),
                inputContextTokens: result?.usage?.inputTokens || 0,
                status: 'success',
                latencyMs: Date.now() - usageStartTime,
            });

            return {
                text,
                provider: result?.provider || providerName,
                model: result?.model || '',
                usage: result?.usage || {},
                fallbackLevel: index,
                localFallback: false,
                attempts,
            };
        } catch (err) {
            attempts.push({
                provider: providerName,
                role: entry.role,
                errorMessage: err.message || String(err),
                timeout: err instanceof TimeoutError,
            });
            await recordChatUsage(usageRecorder, {
                userId: usageContext.userId || null,
                sessionId: usageContext.sessionId || null,
                provider: providerName,
                operation: 'chat',
                status: 'failed',
                errorMessage: err.message || String(err),
                latencyMs: Date.now() - usageStartTime,
            });
        }
    }

    return {
        text: buildLocalFallbackReply(localFallbackContext),
        provider: 'local',
        model: 'local-fallback',
        usage: {},
        fallbackLevel: entries.length,
        localFallback: true,
        attempts,
    };
}

module.exports = {
    TimeoutError,
    completeChatWithFallback,
    withTimeout,
};
