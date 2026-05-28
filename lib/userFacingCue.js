function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function stripEndingPunctuation(text) {
    return normalizeText(text).replace(/[。！？!?]+$/u, '');
}

const INTERNAL_PATTERNS = [
    /AI/iu,
    /未提供/u,
    /尚未/u,
    /拒绝/u,
    /缺少/u,
    /缺失/u,
    /没有谈到/u,
    /未谈到/u,
    /对话主要/u,
    /分析/u,
    /主题进度/u,
    /已追问/u,
    /暂无/u,
    /\.\.\.|…/u,
];

const INTERNAL_USER_PATTERNS = [
    /用户已/u,
    /用户未/u,
    /用户尚未/u,
    /用户拒绝/u,
    /用户没有/u,
    /用户需要/u,
    /用户选择/u,
    /用户正在/u,
];

function hasInternalAnalysisPattern(text) {
    return INTERNAL_PATTERNS.some((pattern) => pattern.test(text)) ||
        INTERNAL_USER_PATTERNS.some((pattern) => pattern.test(text));
}

function rewriteToSecondPerson(text) {
    return stripEndingPunctuation(text)
        .replace(/^用户(曾经|之前|上次)?(讲到|提到|聊到|说到)/u, '您$1$2')
        .replace(/^用户/u, '您')
        .replace(/^我/u, '您')
        .replace(/我的/gu, '您的')
        .replace(/我在/gu, '您在')
        .replace(/我年轻/gu, '您年轻')
        .replace(/我小时候/gu, '您小时候')
        .trim();
}

// 模块：用户可见承接句过滤。保守处理，不确定时返回空，避免把系统分析语读给用户。
function sanitizeUserFacingCue(value, maxLength = 60) {
    const normalized = normalizeText(value);
    if (!normalized) return '';
    if (hasInternalAnalysisPattern(normalized)) return '';

    const rewritten = rewriteToSecondPerson(normalized);
    if (!rewritten || hasInternalAnalysisPattern(rewritten)) return '';

    return rewritten.length <= maxLength ? rewritten : rewritten.slice(0, maxLength);
}

function buildFallbackCueFromTopic(topic) {
    const sources = [
        topic?.summary,
        ...(Array.isArray(topic?.concreteStories) ? topic.concreteStories : []),
        ...(Array.isArray(topic?.knownFacts) ? topic.knownFacts : []),
    ];

    for (const source of sources) {
        const cue = sanitizeUserFacingCue(source);
        if (cue) return cue;
    }

    return '';
}

module.exports = {
    buildFallbackCueFromTopic,
    sanitizeUserFacingCue,
};
