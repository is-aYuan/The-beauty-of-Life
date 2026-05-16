const { getTopicStatus, clampProgress } = require('./topicProfiles');

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

// 传记主题采访模块：安全合并 AI 主题分析，避免进度回退或覆盖已有有效档案。
function applyTopicAnalysisToProfile(profile, analysis, timestamp = new Date().toISOString()) {
    if (!profile || !analysis?.topicId) return profile;

    const topics = (profile.topics || []).map((topic) => {
        if (topic.id !== analysis.topicId) return topic;

        const nextProgress = Math.max(
            clampProgress(topic.progress),
            clampProgress(analysis.progress),
        );

        return {
            ...topic,
            progress: nextProgress,
            status: getTopicStatus(nextProgress),
            summary: analysis.summary || topic.summary || '',
            knownFacts: mergeUnique(topic.knownFacts, analysis.knownFacts),
            concreteStories: mergeUnique(topic.concreteStories, analysis.concreteStories),
            missingInfo: mergeUnique(topic.missingInfo, analysis.missingInfo),
            suggestedNextQuestion: analysis.suggestedNextQuestion || topic.suggestedNextQuestion || '',
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
