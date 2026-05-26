function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

// 模块：已回答的回访开场元数据。只作为本轮问答上下文保存，不计入回忆录素材。
function buildAnsweredEntryGuidanceTurn(entryGuidance) {
    if (!entryGuidance || typeof entryGuidance !== 'object') return null;

    const aiPromptText = normalizeText(entryGuidance.speechText) ||
        normalizeText(entryGuidance.displayText);
    if (!aiPromptText) return null;

    return {
        promptSource: 'entry_guidance',
        aiPromptText,
        aiPromptDisplayText: normalizeText(entryGuidance.displayText),
        aiPromptTopicId: normalizeText(entryGuidance.topicId),
        aiPromptTopicTitle: normalizeText(entryGuidance.topicTitle),
        aiPromptNextQuestion: normalizeText(entryGuidance.nextQuestion),
        excludeAiPromptFromSummary: true,
        excludeAiPromptFromStats: true,
        excludeAiPromptFromBiography: true,
    };
}

module.exports = {
    buildAnsweredEntryGuidanceTurn,
};
