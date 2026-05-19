const {
    createDefaultTopicProfile,
} = require('./topicProfiles');

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

// 管理员主题档案响应模块：统一补齐默认主题结构，避免后台展示遇到历史脏数据时缺字段。
function buildAdminTopicProfileResponse(profile, userId) {
    const defaults = createDefaultTopicProfile(userId);
    const sourceTopics = new Map(asArray(profile?.topics).map((topic) => [topic.id, topic]));
    const topics = defaults.topics.map((defaultTopic) => {
        const sourceTopic = sourceTopics.get(defaultTopic.id) || {};
        return {
            ...defaultTopic,
            ...sourceTopic,
            knownFacts: asArray(sourceTopic.knownFacts),
            concreteStories: asArray(sourceTopic.concreteStories),
            missingInfo: asArray(sourceTopic.missingInfo),
        };
    });
    const currentTopicId = topics.some((topic) => topic.id === profile?.currentTopicId)
        ? profile.currentTopicId
        : defaults.currentTopicId;

    return {
        ...defaults,
        ...profile,
        userId,
        currentTopicId,
        topics,
        personProfile: profile?.personProfile || {},
        allRichPromptShown: Boolean(profile?.allRichPromptShown),
    };
}

module.exports = {
    buildAdminTopicProfileResponse,
};
