const test = require('node:test');
const assert = require('node:assert/strict');

const {
    aggregateUsageEvents,
    createUsageRecorder,
    normalizeUsageEvent,
} = require('../lib/usage/usageRecorder');

test('normalizes usage events with safe numeric defaults and failure details', () => {
    const normalized = normalizeUsageEvent({
        provider: 'deepseek',
        operation: 'summary',
        status: 'failed',
        errorMessage: 'quota exceeded',
    }, {
        now: new Date('2026-05-29T10:20:00+08:00'),
    });

    assert.equal(normalized.provider, 'deepseek');
    assert.equal(normalized.status, 'failed');
    assert.equal(normalized.errorMessage, 'quota exceeded');
    assert.equal(normalized.inputTokens, 0);
    assert.equal(normalized.outputTokens, 0);
    assert.equal(normalized.audioSeconds, 0);
    assert.equal(normalized.ttsChars, 0);
});

test('aggregates usage by summary, timeline, providers, and operations', () => {
    const events = [
        {
            provider: 'deepseek',
            operation: 'chat',
            totalTokens: 1500,
            inputTokens: 1000,
            outputTokens: 500,
            estimatedCostCny: 0.8,
            pricingConfigured: true,
            createdAt: '2026-05-29T09:10:00+08:00',
        },
        {
            provider: 'doubao_voice',
            operation: 'asr',
            audioSeconds: 90,
            estimatedCostCny: 0.15,
            pricingConfigured: true,
            createdAt: '2026-05-29T09:20:00+08:00',
        },
        {
            provider: 'doubao_voice',
            operation: 'tts',
            ttsChars: 1200,
            estimatedCostCny: 0.36,
            pricingConfigured: true,
            createdAt: '2026-05-28T23:50:00+08:00',
        },
    ];

    const usage = aggregateUsageEvents(events, {
        now: new Date('2026-05-29T12:00:00+08:00'),
        range: '7d',
    });

    assert.equal(usage.summary.todayCostCny, 0.95);
    assert.equal(usage.summary.monthCostCny, 1.31);
    assert.equal(usage.summary.todayTokens, 1500);
    assert.equal(usage.summary.todayAudioMinutes, 1.5);
    assert.equal(usage.summary.pricingConfigured, true);
    assert.equal(usage.timeline.some((point) => point.costCny > 0), true);
    assert.deepEqual(usage.providers.map((item) => item.provider), ['doubao_voice', 'deepseek']);
    assert.deepEqual(usage.operations.map((item) => item.operation), ['chat', 'tts', 'asr']);
});

test('recordUsage writes normalized events and does not throw when persistence fails', async () => {
    const written = [];
    const db = {
        serverDate() {
            return 'SERVER_DATE';
        },
        collection(name) {
            assert.equal(name, 'api_usage_events');
            return {
                async add(record) {
                    written.push(record);
                },
            };
        },
    };
    const recorder = createUsageRecorder({ db });

    const result = await recorder.recordUsage({
        provider: 'doubao_voice',
        operation: 'tts',
        ttsChars: 10_000,
    });

    assert.deepEqual(result, { recorded: true });
    assert.equal(written.length, 1);
    assert.equal(written[0].estimatedCostCny, 3);
    assert.equal(written[0].createdAt, 'SERVER_DATE');

    const failingRecorder = createUsageRecorder({
        db: {
            collection() {
                return {
                    async add() {
                        throw new Error('write failed');
                    },
                };
            },
        },
        logger: { warn() {} },
    });

    assert.deepEqual(await failingRecorder.recordUsage({ provider: 'deepseek' }), {
        recorded: false,
    });
});

test('getAdminUsage returns an empty aggregate when the usage collection is unavailable', async () => {
    const warnings = [];
    const recorder = createUsageRecorder({
        db: {
            collection(name) {
                assert.equal(name, 'api_usage_events');
                return {
                    async get() {
                        throw new Error('collection not found');
                    },
                };
            },
        },
        logger: {
            warn(message, detail) {
                warnings.push([message, detail]);
            },
        },
    });

    const usage = await recorder.getAdminUsage({
        range: '7d',
        now: new Date('2026-05-29T12:00:00+08:00'),
    });

    assert.equal(usage.summary.todayCostCny, 0);
    assert.equal(usage.summary.monthCostCny, 0);
    assert.equal(usage.summary.pricingConfigured, false);
    assert.equal(usage.timeline.length, 7);
    assert.deepEqual(usage.providers, []);
    assert.deepEqual(usage.operations, []);
    assert.equal(warnings.length, 1);
});
