const MIN_READY_TOPIC_PROGRESS = 80;
const NEEDS_STORY_MESSAGE = '先去讲讲您的故事吧，至少需要一个主题进度达到80%。';
const REGENERATE_CONFIRM_MESSAGE = '您已经有一版回忆录了。再次生成会用最新内容更新这一版，是否继续？';

function clampProgress(value) {
    const progress = Math.round(Number(value) || 0);
    return Math.max(0, Math.min(100, progress));
}

function getMaxTopicProgress(topics) {
    if (!Array.isArray(topics) || topics.length === 0) return 0;
    return topics.reduce((max, topic) => Math.max(max, clampProgress(topic?.progress)), 0);
}

function toTimestamp(value) {
    if (!value) return 0;
    if (typeof value === 'string') return Date.parse(value) || 0;
    if (typeof value === 'number') return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'object') {
        if (typeof value.getTime === 'function') return value.getTime();
        if (typeof value._seconds === 'number') return value._seconds * 1000;
        if (typeof value.seconds === 'number') return value.seconds * 1000;
    }
    return 0;
}

function getLatestBiography(biographies) {
    if (!Array.isArray(biographies) || biographies.length === 0) return null;
    return [...biographies].sort((a, b) => toTimestamp(b?.createdAt) - toTimestamp(a?.createdAt))[0] || null;
}

// 回忆录生成门槛模块：统一用户端和服务端的生成前置判断，避免 UI 与接口口径不一致。
function buildBiographyGenerationDecision({ topics = [], biographies = [] } = {}) {
    const maxTopicProgress = getMaxTopicProgress(topics);

    if (maxTopicProgress < MIN_READY_TOPIC_PROGRESS) {
        return {
            canGenerate: false,
            requiresConfirmation: false,
            reason: 'needs_story',
            maxTopicProgress,
            message: NEEDS_STORY_MESSAGE,
        };
    }

    const hasBiography = Array.isArray(biographies) && biographies.length > 0;
    return {
        canGenerate: true,
        requiresConfirmation: hasBiography,
        reason: hasBiography ? 'regenerate' : 'ready',
        maxTopicProgress,
        message: hasBiography ? REGENERATE_CONFIRM_MESSAGE : '',
    };
}

module.exports = {
    MIN_READY_TOPIC_PROGRESS,
    NEEDS_STORY_MESSAGE,
    REGENERATE_CONFIRM_MESSAGE,
    buildBiographyGenerationDecision,
    getLatestBiography,
    getMaxTopicProgress,
};
