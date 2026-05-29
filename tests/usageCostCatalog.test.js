const test = require('node:test');
const assert = require('node:assert/strict');

const {
    estimateUsageCost,
    DEFAULT_PRICE_CATALOG,
} = require('../lib/usage/costCatalog');

test('estimates DeepSeek token cost with cached and uncached input tokens', () => {
    const result = estimateUsageCost({
        provider: 'deepseek',
        model: 'deepseek-chat',
        operation: 'chat',
        inputTokens: 1_000_000,
        cachedInputTokens: 500_000,
        outputTokens: 250_000,
    }, DEFAULT_PRICE_CATALOG);

    assert.equal(result.pricingConfigured, true);
    assert.equal(result.estimatedCostCny, 1.01);
});

test('switches DeepSeek pro from promotional price after the expiry date', () => {
    const promotional = estimateUsageCost({
        provider: 'deepseek',
        model: 'deepseek-v4-pro',
        operation: 'biography',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        occurredAt: '2026-05-30T12:00:00+08:00',
    }, DEFAULT_PRICE_CATALOG);
    const standard = estimateUsageCost({
        provider: 'deepseek',
        model: 'deepseek-v4-pro',
        operation: 'biography',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        occurredAt: '2026-06-01T00:00:00+08:00',
    }, DEFAULT_PRICE_CATALOG);

    assert.equal(promotional.estimatedCostCny, 9);
    assert.equal(standard.estimatedCostCny, 36);
});

test('estimates Doubao Ark character model cost by input length tier', () => {
    const shortContext = estimateUsageCost({
        provider: 'doubao_ark',
        model: 'Doubao-Seed-Character',
        operation: 'chat',
        inputTokens: 50_000,
        cachedInputTokens: 40_000,
        outputTokens: 1_000_000,
        inputContextTokens: 10_000,
    }, DEFAULT_PRICE_CATALOG);
    const longContext = estimateUsageCost({
        provider: 'doubao_ark',
        model: 'Doubao-Seed-Character',
        operation: 'chat',
        inputTokens: 40_000,
        outputTokens: 1_000_000,
        inputContextTokens: 40_000,
    }, DEFAULT_PRICE_CATALOG);

    assert.equal(shortContext.estimatedCostCny, 2.0144);
    assert.equal(longContext.estimatedCostCny, 6.048);
});

test('estimates voice ASR by rounded-up minutes and TTS by characters', () => {
    const asr = estimateUsageCost({
        provider: 'doubao_voice',
        operation: 'asr',
        audioSeconds: 61,
    }, DEFAULT_PRICE_CATALOG);
    const tts = estimateUsageCost({
        provider: 'doubao_voice',
        operation: 'tts',
        ttsChars: 12_000,
    }, DEFAULT_PRICE_CATALOG);

    assert.equal(asr.estimatedCostCny, 0.15);
    assert.equal(tts.estimatedCostCny, 3.6);
});

test('returns zero cost for unknown provider prices', () => {
    const result = estimateUsageCost({
        provider: 'missing_provider',
        operation: 'chat',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
    }, DEFAULT_PRICE_CATALOG);

    assert.equal(result.estimatedCostCny, 0);
    assert.equal(result.pricingConfigured, false);
});
