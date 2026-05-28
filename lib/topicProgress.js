const { getTopicStatus, clampProgress } = require('./topicProfiles');
const { normalizeQuestionForElder } = require('./questionSafety');
const { sanitizeUserFacingCue } = require('./userFacingCue');

function mergeUnique(existing, incoming) {
    const result = [];
    for (const value of [...(existing || []), ...(incoming || [])]) {
        if (typeof value !== 'string') continue;
        const trimmed = value.trim();
        if (trimmed && !result.includes(trimmed)) {
            result.push(trimmed);
        }
    }
    return result;
}

function mergePersonProfile(existing, updates) {
    const merged = { ...(existing || {}) };
    for (const [key, value] of Object.entries(updates || {})) {
        if (value !== undefined && value !== null && value !== '') {
            merged[key] = value;
        }
    }
    return merged;
}

function normalizeSuggestedNextQuestion(question, topic) {
    return normalizeQuestionForElder({
        question,
        currentTopicId: topic.id,
        topicTitle: topic.title,
    }).question;
}

// 传记主题采访模块：安全合并 AI 主题分析，避免进度回退或覆盖已有有效档案。
function applyTopicAnalysisToProfile(profile, analysis, timestamp = new Date().toISOString()) {
    if (!profile || !analysis?.topicId) return profile;

    const topics = (profile.topics || []).map((topic) => {
        if (topic.id !== analysis.topicId) return topic;

        const nextProgress = Math.max(
            clampProgress(topic.progress),
            clampProgress(analysis.progress),
        );
        const safeUserFacingCue = sanitizeUserFacingCue(analysis.userFacingCue);

        return {
            ...topic,
            progress: nextProgress,
            status: getTopicStatus(nextProgress),
            summary: analysis.summary || topic.summary || '',
            knownFacts: mergeUnique(topic.knownFacts, analysis.knownFacts),
            concreteStories: mergeUnique(topic.concreteStories, analysis.concreteStories),
            missingInfo: mergeUnique(topic.missingInfo, analysis.missingInfo),
            userFacingCue: safeUserFacingCue || topic.userFacingCue || '',
            suggestedNextQuestion: normalizeSuggestedNextQuestion(
                analysis.suggestedNextQuestion || topic.suggestedNextQuestion || '',
                topic,
            ),
            lastDiscussedAt: timestamp,
        };
    });

    return {
        ...profile,
        personProfile: mergePersonProfile(profile.personProfile, analysis.personProfileUpdates),
        topics,
    };
}

module.exports = {
    applyTopicAnalysisToProfile,
    mergeUnique,
};
