const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildBiographyGenerationDecision,
    getMaxTopicProgress,
    getLatestBiography,
} = require('../lib/biographyGeneration');

test('blocks biography generation until at least one topic reaches 85 percent', () => {
    const decision = buildBiographyGenerationDecision({
        topics: [
            { id: 'childhood', progress: 84 },
            { id: 'parents_home', progress: 20 },
        ],
        biographies: [],
    });

    assert.equal(decision.canGenerate, false);
    assert.equal(decision.reason, 'needs_story');
    assert.equal(decision.message, '先去讲讲您的故事吧，至少需要一个主题进度达到85%。');
});

test('allows direct generation when one topic is ready and no biography exists', () => {
    const decision = buildBiographyGenerationDecision({
        topics: [
            { id: 'childhood', progress: 85 },
            { id: 'parents_home', progress: 10 },
        ],
        biographies: [],
    });

    assert.equal(decision.canGenerate, true);
    assert.equal(decision.requiresConfirmation, false);
    assert.equal(decision.maxTopicProgress, 85);
});

test('requires confirmation when regenerating an existing biography', () => {
    const decision = buildBiographyGenerationDecision({
        topics: [{ id: 'school_days', progress: 90 }],
        biographies: [{ _id: 'bio_1', title: '旧版回忆录' }],
    });

    assert.equal(decision.canGenerate, true);
    assert.equal(decision.requiresConfirmation, true);
    assert.equal(decision.message, '您已经有一版回忆录了。再次生成会用最新内容更新这一版，是否继续？');
});

test('calculates max topic progress defensively', () => {
    assert.equal(getMaxTopicProgress([{ progress: 120 }, { progress: -10 }, { progress: '75' }]), 100);
    assert.equal(getMaxTopicProgress(null), 0);
});

test('selects the newest biography for latest-version updates', () => {
    const latest = getLatestBiography([
        { _id: 'older', createdAt: '2026-05-01T00:00:00.000Z' },
        { _id: 'newer', createdAt: '2026-05-10T00:00:00.000Z' },
    ]);

    assert.equal(latest._id, 'newer');
    assert.equal(getLatestBiography([]), null);
});
