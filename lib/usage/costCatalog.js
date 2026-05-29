// 模块：API 用量成本目录。集中维护模型与语音服务单价，供成本监控账本统一估算。

const DEEPSEEK_PRO_PROMOTION_END = '2026-05-31T23:59:00+08:00';

const DEFAULT_PRICE_CATALOG = Object.freeze({
    deepseek: {
        models: {
            'deepseek-chat': {
                inputPerMillionTokensCny: 1,
                cachedInputPerMillionTokensCny: 0.02,
                outputPerMillionTokensCny: 2,
            },
            'deepseek-v4-flash': {
                inputPerMillionTokensCny: 1,
                cachedInputPerMillionTokensCny: 0.02,
                outputPerMillionTokensCny: 2,
            },
            'deepseek-v4-pro': {
                inputPerMillionTokensCny: 3,
                cachedInputPerMillionTokensCny: 0.025,
                outputPerMillionTokensCny: 6,
                effectiveUntil: DEEPSEEK_PRO_PROMOTION_END,
                next: {
                    inputPerMillionTokensCny: 12,
                    cachedInputPerMillionTokensCny: 0.1,
                    outputPerMillionTokensCny: 24,
                },
            },
        },
    },
    doubao_ark: {
        models: {
            'Doubao-Seed-Character': {
                tiers: [
                    {
                        maxInputContextTokens: 32_000,
                        inputPerMillionTokensCny: 0.8,
                        cachedInputPerMillionTokensCny: 0.16,
                        outputPerMillionTokensCny: 2,
                    },
                    {
                        maxInputContextTokens: 128_000,
                        inputPerMillionTokensCny: 1.2,
                        cachedInputPerMillionTokensCny: 0.16,
                        outputPerMillionTokensCny: 6,
                    },
                ],
            },
            'ep-20260520152836-gj2hd': {
                aliasOf: 'Doubao-Seed-Character',
            },
        },
    },
    doubao_voice: {
        asrPerMinuteCny: 4.5 / 60,
        ttsPerTenThousandCharsCny: 3,
    },
    tencent_voice: {
        asrPerThousandCallsCny: 3.2,
        ttsPerTenThousandCharsCny: 0.3,
    },
});

function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
}

function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function resolveTimedPrice(price, occurredAt) {
    if (!price?.effectiveUntil || !price.next) return price;
    const currentTime = occurredAt ? new Date(occurredAt).getTime() : Date.now();
    const endTime = new Date(price.effectiveUntil).getTime();
    if (!Number.isFinite(currentTime) || !Number.isFinite(endTime)) return price;
    return currentTime <= endTime ? price : price.next;
}

function resolveModelPrice(providerPrice, model, event = {}) {
    const models = providerPrice?.models || {};
    const direct = models[model] || models.defaultModel;
    const aliasTarget = direct?.aliasOf ? models[direct.aliasOf] : direct;
    if (!aliasTarget) return null;

    if (Array.isArray(aliasTarget.tiers)) {
        const inputContextTokens = toNumber(event.inputContextTokens) || toNumber(event.inputTokens);
        return aliasTarget.tiers.find((tier) => inputContextTokens <= tier.maxInputContextTokens) ||
            aliasTarget.tiers[aliasTarget.tiers.length - 1];
    }

    return resolveTimedPrice(aliasTarget, event.occurredAt || event.createdAt);
}

function estimateTokenCost(event, modelPrice) {
    const inputTokens = toNumber(event.inputTokens);
    const cachedInputTokens = Math.min(toNumber(event.cachedInputTokens), inputTokens);
    const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
    const outputTokens = toNumber(event.outputTokens);

    return (
        uncachedInputTokens * toNumber(modelPrice.inputPerMillionTokensCny) / 1_000_000 +
        cachedInputTokens * toNumber(modelPrice.cachedInputPerMillionTokensCny) / 1_000_000 +
        outputTokens * toNumber(modelPrice.outputPerMillionTokensCny) / 1_000_000
    );
}

function estimateVoiceCost(event, providerPrice) {
    if (event.operation === 'asr') {
        if (providerPrice.asrPerMinuteCny) {
            const minutes = Math.ceil(toNumber(event.audioSeconds) / 60);
            return minutes * toNumber(providerPrice.asrPerMinuteCny);
        }
        if (providerPrice.asrPerThousandCallsCny) {
            return toNumber(event.calls || 1) * toNumber(providerPrice.asrPerThousandCallsCny) / 1000;
        }
    }

    if (event.operation === 'tts') {
        return toNumber(event.ttsChars) * toNumber(providerPrice.ttsPerTenThousandCharsCny) / 10_000;
    }

    return 0;
}

function estimateUsageCost(event = {}, catalog = DEFAULT_PRICE_CATALOG) {
    const providerPrice = catalog?.[event.provider];
    if (!providerPrice) {
        return { estimatedCostCny: 0, pricingConfigured: false };
    }

    const modelPrice = resolveModelPrice(providerPrice, event.model, event);
    if (modelPrice) {
        return {
            estimatedCostCny: roundMoney(estimateTokenCost(event, modelPrice)),
            pricingConfigured: true,
        };
    }

    const voiceCost = estimateVoiceCost(event, providerPrice);
    if (voiceCost > 0 || event.operation === 'asr' || event.operation === 'tts') {
        return {
            estimatedCostCny: roundMoney(voiceCost),
            pricingConfigured: voiceCost > 0,
        };
    }

    return { estimatedCostCny: 0, pricingConfigured: false };
}

module.exports = {
    DEFAULT_PRICE_CATALOG,
    estimateUsageCost,
};
