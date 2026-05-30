function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

// 模块：问答配对元数据。统一把“被回答的 AI 提问”写成稳定字段，避免 userText 和下一问 aiReply 被误读为同一问答。
function normalizeAnsweredPrompt(prompt) {
    if (!prompt || typeof prompt !== 'object') return null;

    const aiPromptText = normalizeText(prompt.aiPromptText || prompt.answeredAiPromptText);
    if (!aiPromptText) return null;

    const promptSource = normalizeText(prompt.promptSource || prompt.answeredAiPromptSource) || 'ai_reply';
    const displayText = normalizeText(prompt.aiPromptDisplayText || prompt.answeredAiPromptDisplayText) || aiPromptText;
    const topicId = normalizeText(prompt.aiPromptTopicId || prompt.answeredAiPromptTopicId);
    const topicTitle = normalizeText(prompt.aiPromptTopicTitle || prompt.answeredAiPromptTopicTitle);
    const nextQuestion = normalizeText(prompt.aiPromptNextQuestion || prompt.answeredAiPromptNextQuestion) || aiPromptText;

    return {
        ...prompt,
        promptSource,
        aiPromptText,
        aiPromptDisplayText: displayText,
        aiPromptTopicId: topicId,
        aiPromptTopicTitle: topicTitle,
        aiPromptNextQuestion: nextQuestion,
        answeredAiPromptText: aiPromptText,
        answeredAiPromptDisplayText: displayText,
        answeredAiPromptSource: promptSource,
        answeredAiPromptTopicId: topicId,
        answeredAiPromptTopicTitle: topicTitle,
        answeredAiPromptNextQuestion: nextQuestion,
    };
}

function buildAnsweredPromptFromPreviousConversation(conversation) {
    const aiPromptText = normalizeText(conversation?.aiReply);
    if (!aiPromptText) return null;

    return normalizeAnsweredPrompt({
        promptSource: 'persisted_previous_ai_reply',
        aiPromptText,
        aiPromptDisplayText: aiPromptText,
        aiPromptTopicId: conversation?.topicId || '',
        aiPromptTopicTitle: conversation?.topicTitle || '',
        aiPromptNextQuestion: aiPromptText,
    });
}

function resolveAnsweredPromptForTurn(session, fallbackPrompt = null) {
    return normalizeAnsweredPrompt(session?.pendingAnsweredPrompt) ||
        normalizeAnsweredPrompt(session?.lastAiPrompt) ||
        normalizeAnsweredPrompt(fallbackPrompt);
}

function rememberAiPromptForNextTurn(session, {
    text,
    source = 'ai_reply',
    topicId = '',
    topicTitle = '',
} = {}) {
    if (!session) return null;

    const aiPromptText = normalizeText(text);
    if (!aiPromptText) {
        session.lastAiPrompt = null;
        return null;
    }

    session.lastAiPrompt = normalizeAnsweredPrompt({
        promptSource: source,
        aiPromptText,
        aiPromptDisplayText: aiPromptText,
        aiPromptTopicId: topicId,
        aiPromptTopicTitle: topicTitle,
        aiPromptNextQuestion: aiPromptText,
    });
    return session.lastAiPrompt;
}

function clearLastAiPrompt(session) {
    if (session) session.lastAiPrompt = null;
}

function appendAnsweredPromptToHistoryIfMissing(session, answeredPrompt) {
    const promptText = normalizeText(answeredPrompt?.aiPromptText);
    if (!session || !promptText) return false;

    const history = session.conversationHistory || [];
    const last = history[history.length - 1];
    if (last?.Role === 'assistant' && normalizeText(last.Content) === promptText) {
        return false;
    }

    history.push({ Role: 'assistant', Content: promptText });
    session.conversationHistory = history;
    return true;
}

function formatConversationForSummary(conversation, index, fallbackTopicTitle = '') {
    const topicLabel = conversation.topicTitle || fallbackTopicTitle || '未标记主题';
    const answeredPrompt = normalizeText(conversation.answeredAiPromptText || conversation.aiPromptText);
    const lines = [`【第${index + 1}轮｜主题：${topicLabel}】`];

    if (answeredPrompt) {
        lines.push(`AI提问：${answeredPrompt}`);
    }
    lines.push(`老人回答：${conversation.userText || ''}`);
    if (conversation.aiReply) {
        lines.push(`AI下一问：${conversation.aiReply}`);
    }

    return lines.join('\n');
}

module.exports = {
    appendAnsweredPromptToHistoryIfMissing,
    buildAnsweredPromptFromPreviousConversation,
    clearLastAiPrompt,
    formatConversationForSummary,
    normalizeAnsweredPrompt,
    rememberAiPromptForNextTurn,
    resolveAnsweredPromptForTurn,
};
