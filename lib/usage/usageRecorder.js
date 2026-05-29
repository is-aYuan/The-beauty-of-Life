// 模块：API 用量账本。封装 CloudBase 事件写入与管理端聚合，业务调用失败时不反向影响主流程。

const {
    DEFAULT_PRICE_CATALOG,
    estimateUsageCost,
} = require('./costCatalog');

const NUMERIC_FIELDS = [
    'inputTokens',
    'cachedInputTokens',
    'outputTokens',
    'totalTokens',
    'audioSeconds',
    'ttsChars',
    'outputAudioKB',
    'latencyMs',
    'calls',
];

function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
}

function round(value, decimals = 6) {
    const factor = 10 ** decimals;
    return Math.round((toNumber(value) + Number.EPSILON) * factor) / factor;
}

function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value.toDate === 'function') {
        const parsed = value.toDate();
        return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    }
    return null;
}

function isSameLocalDay(left, right) {
    return left.getFullYear() === right.getFullYear() &&
        left.getMonth() === right.getMonth() &&
        left.getDate() === right.getDate();
}

function isSameLocalMonth(left, right) {
    return left.getFullYear() === right.getFullYear() &&
        left.getMonth() === right.getMonth();
}

function normalizeUsageEvent(event = {}, options = {}) {
    const now = options.now || new Date();
    const normalized = {
        userId: event.userId || null,
        sessionId: event.sessionId || null,
        provider: event.provider || 'unknown',
        model: event.model || '',
        operation: event.operation || 'unknown',
        status: event.status === 'failed' ? 'failed' : 'success',
        errorMessage: event.errorMessage ? String(event.errorMessage).slice(0, 500) : '',
        pricingConfigured: false,
        estimatedCostCny: 0,
        createdAt: event.createdAt || event.occurredAt || now.toISOString(),
    };

    for (const field of NUMERIC_FIELDS) {
        normalized[field] = toNumber(event[field]);
    }

    if (!normalized.totalTokens) {
        normalized.totalTokens = normalized.inputTokens + normalized.outputTokens;
    }

    const cost = estimateUsageCost({
        ...normalized,
        occurredAt: event.occurredAt || event.createdAt || now,
    }, options.priceCatalog || DEFAULT_PRICE_CATALOG);

    normalized.estimatedCostCny = round(cost.estimatedCostCny);
    normalized.pricingConfigured = Boolean(cost.pricingConfigured);

    return normalized;
}

function getRangeStart(range, now) {
    const start = new Date(now);
    if (range === '24h') {
        start.setHours(start.getHours() - 24);
        return start;
    }
    const days = range === '30d' ? 30 : 7;
    start.setDate(start.getDate() - days + 1);
    start.setHours(0, 0, 0, 0);
    return start;
}

function getTimelineKey(date, range) {
    if (range === '24h') {
        return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
    }
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function createEmptyPoint(label) {
    return {
        label,
        costCny: 0,
        tokens: 0,
        audioMinutes: 0,
        ttsChars: 0,
        calls: 0,
    };
}

function buildTimeline(rangeStart, now, range) {
    const points = [];
    const cursor = new Date(rangeStart);
    while (cursor <= now) {
        points.push(createEmptyPoint(getTimelineKey(cursor, range)));
        if (range === '24h') {
            cursor.setHours(cursor.getHours() + 1);
        } else {
            cursor.setDate(cursor.getDate() + 1);
        }
    }
    return points;
}

function addBreakdown(map, key, event) {
    if (!map.has(key)) {
        map.set(key, {
            provider: key,
            operation: key,
            costCny: 0,
            calls: 0,
            tokens: 0,
            audioMinutes: 0,
            ttsChars: 0,
        });
    }
    const item = map.get(key);
    item.costCny += toNumber(event.estimatedCostCny);
    item.calls += 1;
    item.tokens += toNumber(event.totalTokens);
    item.audioMinutes += toNumber(event.audioSeconds) / 60;
    item.ttsChars += toNumber(event.ttsChars);
}

function finishBreakdown(items, keyToKeep) {
    return items
        .map((item) => ({
            [keyToKeep]: item[keyToKeep],
            costCny: round(item.costCny, 4),
            calls: item.calls,
            tokens: Math.round(item.tokens),
            audioMinutes: round(item.audioMinutes, 2),
            ttsChars: Math.round(item.ttsChars),
        }))
        .sort((a, b) => b.calls - a.calls || b.costCny - a.costCny || String(a[keyToKeep]).localeCompare(String(b[keyToKeep])));
}

function aggregateUsageEvents(events = [], options = {}) {
    const now = options.now || new Date();
    const range = options.range || '7d';
    const rangeStart = getRangeStart(range, now);
    const timeline = buildTimeline(rangeStart, now, range);
    const timelineMap = new Map(timeline.map((point) => [point.label, point]));
    const providerMap = new Map();
    const operationMap = new Map();

    const summary = {
        todayCostCny: 0,
        monthCostCny: 0,
        todayTokens: 0,
        todayAudioMinutes: 0,
        todayTtsChars: 0,
        pricingConfigured: false,
    };

    for (const event of events) {
        const eventDate = toDate(event.createdAt || event.occurredAt);
        if (!eventDate) continue;

        const eventCost = toNumber(event.estimatedCostCny);
        const eventTokens = toNumber(event.totalTokens);
        const eventAudioMinutes = toNumber(event.audioSeconds) / 60;
        const eventTtsChars = toNumber(event.ttsChars);

        if (isSameLocalDay(eventDate, now)) {
            summary.todayCostCny += eventCost;
            summary.todayTokens += eventTokens;
            summary.todayAudioMinutes += eventAudioMinutes;
            summary.todayTtsChars += eventTtsChars;
        }

        if (isSameLocalMonth(eventDate, now)) {
            summary.monthCostCny += eventCost;
        }

        if (event.pricingConfigured) {
            summary.pricingConfigured = true;
        }

        if (eventDate >= rangeStart && eventDate <= now) {
            const point = timelineMap.get(getTimelineKey(eventDate, range));
            if (point) {
                point.costCny += eventCost;
                point.tokens += eventTokens;
                point.audioMinutes += eventAudioMinutes;
                point.ttsChars += eventTtsChars;
                point.calls += 1;
            }
            addBreakdown(providerMap, event.provider || 'unknown', event);
            addBreakdown(operationMap, event.operation || 'unknown', event);
        }
    }

    summary.todayCostCny = round(summary.todayCostCny, 4);
    summary.monthCostCny = round(summary.monthCostCny, 4);
    summary.todayTokens = Math.round(summary.todayTokens);
    summary.todayAudioMinutes = round(summary.todayAudioMinutes, 2);
    summary.todayTtsChars = Math.round(summary.todayTtsChars);

    return {
        summary,
        timeline: timeline.map((point) => ({
            ...point,
            costCny: round(point.costCny, 4),
            tokens: Math.round(point.tokens),
            audioMinutes: round(point.audioMinutes, 2),
            ttsChars: Math.round(point.ttsChars),
        })),
        providers: finishBreakdown(Array.from(providerMap.values()), 'provider'),
        operations: finishBreakdown(Array.from(operationMap.values()), 'operation'),
    };
}

function applyUsageQuery(collection, offset, batchSize) {
    const ordered = typeof collection.orderBy === 'function'
        ? collection.orderBy('createdAt', 'desc')
        : collection;
    const skipped = typeof ordered.skip === 'function' ? ordered.skip(offset) : ordered;
    return typeof skipped.limit === 'function' ? skipped.limit(batchSize) : skipped;
}

async function readUsageEvents(db) {
    const batchSize = 100;
    let offset = 0;
    const events = [];

    while (true) {
        const query = applyUsageQuery(db.collection('api_usage_events'), offset, batchSize);
        const result = await query.get();
        const records = result.data || [];
        events.push(...records);
        if (records.length < batchSize) break;
        offset += batchSize;
    }

    return events;
}

function createUsageRecorder({ db, priceCatalog = DEFAULT_PRICE_CATALOG, logger = console } = {}) {
    return {
        async recordUsage(event) {
            try {
                const normalized = normalizeUsageEvent(event, {
                    priceCatalog,
                    now: new Date(),
                });
                await db.collection('api_usage_events').add({
                    ...normalized,
                    createdAt: typeof db.serverDate === 'function' ? db.serverDate() : normalized.createdAt,
                });
                return { recorded: true };
            } catch (err) {
                logger.warn?.('[usage] record failed', err.message || err);
                return { recorded: false };
            }
        },
        async getAdminUsage({ range = '7d', now = new Date() } = {}) {
            let events = [];
            try {
                events = await readUsageEvents(db);
            } catch (err) {
                logger.warn?.('[usage] read failed', err.message || err);
            }
            return aggregateUsageEvents(events, { range, now });
        },
    };
}

module.exports = {
    aggregateUsageEvents,
    createUsageRecorder,
    normalizeUsageEvent,
};
