const test = require('node:test');
const assert = require('node:assert/strict');

test('summarizes admin topic progress for the detail modal', async () => {
    const {
        buildTopicProgressSummary,
        getTopicStatusMeta,
    } = await import('../lovable_ui/src/lib/adminTopicProgress.js');

    const summary = buildTopicProgressSummary({
        currentTopicId: 'school_days',
        topics: [
            { id: 'childhood', title: '我的孩童时代', progress: 0, status: 'not_started' },
            { id: 'school_days', title: '求学时候的日子', progress: 72, status: 'needs_detail' },
            { id: 'work_livelihood', title: '工作与生计', progress: 90, status: 'rich' },
        ],
    });

    assert.equal(summary.averageProgress, 54);
    assert.equal(summary.richCount, 1);
    assert.equal(summary.notStartedCount, 1);
    assert.equal(summary.currentTopicTitle, '求学时候的日子');

    assert.deepEqual(getTopicStatusMeta('rich', 90), { label: '素材丰富', tone: 'emerald' });
    assert.deepEqual(getTopicStatusMeta('needs_detail', 72), { label: '需补细节', tone: 'amber' });
    assert.deepEqual(getTopicStatusMeta('not_started', 0), { label: '未开始', tone: 'neutral' });
});
