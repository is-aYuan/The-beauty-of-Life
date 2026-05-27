const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildAnsweredRecommendationQuestionTurn,
    buildRecommendationConversationRecord,
    normalizeRecommendationQuestion,
} = require('../lib/recommendationQuestion');

test('normalizes a valid archive recommendation question', () => {
    const recommendation = normalizeRecommendationQuestion({
        topicId: 'childhood',
        question: '小时候跟母亲去河边，您印象最深的是哪一次？',
        title: '继续讲讲小时候的河边',
        sourceType: 'recent_summary',
        sourceId: 'summary_1',
    });

    assert.equal(recommendation.topicId, 'childhood');
    assert.equal(recommendation.question, '小时候跟母亲去河边，您印象最深的是哪一次？');
    assert.equal(recommendation.sourceType, 'recent_summary');
});

test('rejects recommendation question without topic or question', () => {
    assert.throws(
        () => normalizeRecommendationQuestion({ topicId: '', question: '讲讲吧' }),
        /推荐问题缺少主题/,
    );
    assert.throws(
        () => normalizeRecommendationQuestion({ topicId: 'childhood', question: '' }),
        /推荐问题不能为空/,
    );
});

test('builds a formal conversation record for archive recommendation question', () => {
    const record = buildRecommendationConversationRecord({
        recommendation: {
            topicId: 'childhood',
            question: '小时候跟母亲去河边，您印象最深的是哪一次？',
            title: '继续讲讲小时候的河边',
            sourceType: 'recent_summary',
            sourceId: 'summary_1',
        },
        selectedTopic: {
            id: 'childhood',
            title: '我的孩童时代',
            progress: 45,
        },
    });

    assert.equal(record.userText, '');
    assert.equal(record.aiReply, '小时候跟母亲去河边，您印象最深的是哪一次？');
    assert.equal(record.topicId, 'childhood');
    assert.equal(record.topicTitle, '我的孩童时代');
    assert.equal(record.topicProgress, 45);
    assert.equal(record.source, 'archive_recommendation');
    assert.deepEqual(record.recommendation, {
        title: '继续讲讲小时候的河边',
        sourceType: 'recent_summary',
        sourceId: 'summary_1',
    });
});

test('builds answered recommendation metadata only after the user replies', () => {
    const result = buildAnsweredRecommendationQuestionTurn({
        topicId: 'childhood',
        topicTitle: '我的孩童时代',
        question: '小时候跟母亲去河边，您印象最深的是哪一次？',
        title: '继续讲讲小时候的河边',
        sourceType: 'recent_summary',
        sourceId: 'summary_1',
    });

    assert.deepEqual(result, {
        promptSource: 'archive_recommendation',
        aiPromptText: '小时候跟母亲去河边，您印象最深的是哪一次？',
        aiPromptDisplayText: '小时候跟母亲去河边，您印象最深的是哪一次？',
        aiPromptTopicId: 'childhood',
        aiPromptTopicTitle: '我的孩童时代',
        aiPromptNextQuestion: '小时候跟母亲去河边，您印象最深的是哪一次？',
        excludeAiPromptFromSummary: true,
        excludeAiPromptFromStats: true,
        excludeAiPromptFromBiography: true,
        recommendation: {
            title: '继续讲讲小时候的河边',
            sourceType: 'recent_summary',
            sourceId: 'summary_1',
        },
    });
});
