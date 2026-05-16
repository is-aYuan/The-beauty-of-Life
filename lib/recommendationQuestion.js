function normalizeRecommendationQuestion(input = {}) {
    const topicId = typeof input.topicId === 'string' ? input.topicId.trim() : '';
    const question = typeof input.question === 'string' ? input.question.trim() : '';

    if (!topicId) throw new Error('推荐问题缺少主题');
    if (!question) throw new Error('推荐问题不能为空');

    return {
        topicId,
        question,
        title: typeof input.title === 'string' ? input.title.trim() : '继续讲讲这个故事',
        sourceType: typeof input.sourceType === 'string' ? input.sourceType.trim() : '',
        sourceId: typeof input.sourceId === 'string' ? input.sourceId.trim() : '',
    };
}

// AI整理模块：把“继续讲讲”推荐转成正式 AI 提问记录，保持对话链路完整。
function buildRecommendationConversationRecord({ recommendation, selectedTopic }) {
    const normalized = normalizeRecommendationQuestion(recommendation);
    const topic = selectedTopic || {};

    return {
        userText: '',
        aiReply: normalized.question,
        topicId: topic.id || normalized.topicId,
        topicTitle: topic.title || '',
        topicProgress: topic.progress || 0,
        source: 'archive_recommendation',
        recommendation: {
            title: normalized.title,
            sourceType: normalized.sourceType,
            sourceId: normalized.sourceId,
        },
    };
}

module.exports = {
    buildRecommendationConversationRecord,
    normalizeRecommendationQuestion,
};
