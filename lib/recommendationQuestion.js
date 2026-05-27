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

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
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

// AI整理模块：推荐问题只在用户回答后作为本轮 AI 提问上下文保存，避免未回答问题污染对话库。
function buildAnsweredRecommendationQuestionTurn(recommendationQuestion) {
    if (!recommendationQuestion || typeof recommendationQuestion !== 'object') return null;

    const question = normalizeText(recommendationQuestion.question);
    if (!question) return null;

    return {
        promptSource: 'archive_recommendation',
        aiPromptText: question,
        aiPromptDisplayText: question,
        aiPromptTopicId: normalizeText(recommendationQuestion.topicId),
        aiPromptTopicTitle: normalizeText(recommendationQuestion.topicTitle),
        aiPromptNextQuestion: question,
        excludeAiPromptFromSummary: true,
        excludeAiPromptFromStats: true,
        excludeAiPromptFromBiography: true,
        recommendation: {
            title: normalizeText(recommendationQuestion.title),
            sourceType: normalizeText(recommendationQuestion.sourceType),
            sourceId: normalizeText(recommendationQuestion.sourceId),
        },
    };
}

module.exports = {
    buildAnsweredRecommendationQuestionTurn,
    buildRecommendationConversationRecord,
    normalizeRecommendationQuestion,
};
