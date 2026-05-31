const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    buildFallbackSummary,
    normalizeSummaryData,
    parseAiJsonObject,
} = require('../lib/summaryJson');

const repoRoot = path.join(__dirname, '..');

test('parses direct AI JSON summary output', () => {
    const parsed = parseAiJsonObject('{"profile":{},"narratives":[]}');

    assert.deepEqual(parsed, { profile: {}, narratives: [] });
});

test('parses fenced AI JSON summary output', () => {
    const parsed = parseAiJsonObject('```json\n{"emotionalNote":"愿意继续讲"}\n```');

    assert.deepEqual(parsed, { emotionalNote: '愿意继续讲' });
});

test('parses JSON object embedded in explanatory text', () => {
    const parsed = parseAiJsonObject('整理如下：\n{"coverage":{"discussed":["母亲"]}}\n请查收。');

    assert.deepEqual(parsed, { coverage: { discussed: ['母亲'] } });
});

test('throws a clear error when AI output has no valid JSON object', () => {
    assert.throws(
        () => parseAiJsonObject('这次素材很短，我无法整理成 JSON。'),
        /无法解析 AI 返回的 JSON/,
    );
});

test('builds fallback summary without losing original conversation material', () => {
    const summary = buildFallbackSummary({
        conversations: [
            {
                userText: '我小时候在贵州读书，老师姓王。',
                aiReply: '那王老师给您留下什么印象？',
            },
            {
                userText: '他对我很好，经常鼓励我。',
                aiReply: '这份鼓励后来影响您了吗？',
            },
        ],
        topicId: 'school_days',
        topicTitle: '求学时候的日子',
    });

    assert.equal(summary.narratives.length, 1);
    assert.equal(summary.narratives[0].theme, '求学');
    assert.match(summary.narratives[0].content, /“我小时候在贵州读书，老师姓王。”/);
    assert.match(summary.narratives[0].content, /“他对我很好，经常鼓励我。”/);
    assert.deepEqual(summary.coverage.discussed, ['求学时候的日子']);
    assert.equal(summary.topicAnalysis.topicId, 'school_days');
    assert.equal(summary.topicAnalysis.progress, 0);
    assert.match(summary.topicAnalysis.summary, /求学时候的日子/);
});

test('normalizes partial summary data to the persisted summary shape', () => {
    const normalized = normalizeSummaryData({
        narratives: 'bad',
        topicAnalysis: { topicId: 'unknown', progress: 150 },
    }, {
        topicId: 'parents_home',
        topicTitle: '我的父母和家',
        conversations: [],
    });

    assert.deepEqual(normalized.profile, {});
    assert.deepEqual(normalized.narratives, []);
    assert.deepEqual(normalized.memoryArchive, {
        people: [],
        places: [],
        events: [],
        emotions: [],
    });
    assert.equal(normalized.topicAnalysis.topicId, 'parents_home');
    assert.equal(normalized.topicAnalysis.progress, 100);
    assert.deepEqual(normalized.topicAnalysis.knownFacts, []);
});

test('server summary extraction falls back instead of failing on malformed AI JSON', () => {
    const serverSource = fs.readFileSync(path.join(repoRoot, 'server.js'), 'utf8');

    assert.match(serverSource, /parseAiJsonObject\(rawContent\)/);
    assert.match(serverSource, /buildFallbackSummary\(\{/);
    assert.match(serverSource, /AI 返回 JSON 解析失败，使用原始对话兜底摘要/);
    assert.doesNotMatch(serverSource, /throw new Error\('无法解析 AI 返回的 JSON'\)/);
});
