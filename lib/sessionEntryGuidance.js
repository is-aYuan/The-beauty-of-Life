const {
    BIOGRAPHY_TOPICS,
    DEFAULT_TOPIC_ID,
} = require('./topicProfiles');
const { normalizeQuestionForElder } = require('./questionSafety');

const DEFAULT_TOPIC_TITLE = '我的孩童时代';
const INTERNAL_ANALYSIS_PATTERNS = [
    /用户/u,
    /回避/u,
    /没有谈到/u,
    /未谈到/u,
    /缺失/u,
    /不足/u,
    /素材/u,
    /分析/u,
    /主题进度/u,
    /提取/u,
    /总结为/u,
];

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
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

function byNewest(a, b) {
    return toTimestamp(b.createdAt || b.timestamp || b.lastDiscussedAt) -
        toTimestamp(a.createdAt || a.timestamp || a.lastDiscussedAt);
}

function stripEndingPunctuation(text) {
    return normalizeText(text).replace(/[。！？!?]+$/u, '');
}

function trimMemoryCue(value, maxLength = 42) {
    const text = stripEndingPunctuation(value);
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
}

function hasUnsafeUserFacingText(text) {
    const normalized = normalizeText(text);
    if (!normalized) return true;
    if (normalized.includes('...') || normalized.includes('…')) return true;
    return INTERNAL_ANALYSIS_PATTERNS.some((pattern) => pattern.test(normalized));
}

function sanitizeUserFacingText(value, maxLength = 42) {
    const text = stripEndingPunctuation(value)
        .replace(/^您提到/u, '')
        .replace(/^上次您提到/u, '')
        .replace(/^提到/u, '')
        .trim();
    if (hasUnsafeUserFacingText(text)) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength);
}

function sanitizeQuestion(value, topicId, topicTitle) {
    const normalized = normalizeText(value)
        .replace(/您刚才提到/gu, '您上次提到')
        .replace(/刚才/gu, '上次');
    return normalizeQuestionForElder({
        question: normalized,
        currentTopicId: topicId,
        topicTitle,
    }).question;
}

function splitSentences(text) {
    return normalizeText(text)
        .split(/[。！？!?]+/u)
        .map((sentence) => sentence.trim())
        .filter(Boolean);
}

function buildIdentityFactCue(text) {
    const normalized = normalizeText(text);
    const mentionsHan = /汉族/u.test(normalized);
    const mentionsMiao = /苗族/u.test(normalized);
    const mentionsSchoolPeers = /(小学|同学|周围|身边|大家)/u.test(normalized);

    if (mentionsHan && mentionsMiao && mentionsSchoolPeers) {
        return '您聊到自己是汉族，也说小学时身边有很多苗族同学';
    }

    if (mentionsHan) {
        return '您聊到自己是汉族';
    }

    return '';
}

function createMemoryCue(text, style = 'story') {
    return {
        text: normalizeText(text),
        style,
    };
}

function rewriteFirstPersonForPlayback(text) {
    return normalizeText(text)
        .replace(/我是/gu, '您是')
        .replace(/我父母/gu, '您父母')
        .replace(/我的父母/gu, '您的父母')
        .replace(/我妈妈|我妈/gu, '您妈妈')
        .replace(/我哥哥/gu, '您哥哥')
        .replace(/我姐姐/gu, '您姐姐')
        .replace(/我弟弟/gu, '您弟弟')
        .replace(/我妹妹/gu, '您妹妹')
        .replace(/我家/gu, '您家')
        .replace(/我们家/gu, '您家里')
        .replace(/我小时候/gu, '您小时候')
        .replace(/我那时候/gu, '您那时候')
        .replace(/我会/gu, '您会')
        .replace(/我周围/gu, '您身边')
        .replace(/我的/gu, '您的');
}

function buildConversationMemoryCue(text, maxLength = 48) {
    const safeText = sanitizeUserFacingText(text, 120);
    if (!safeText) return '';

    const identityCue = buildIdentityFactCue(safeText);
    if (identityCue) return createMemoryCue(identityCue, 'self_contained');

    const rewritten = rewriteFirstPersonForPlayback(safeText);
    const firstSentence = splitSentences(rewritten)[0] || rewritten;
    if (!firstSentence) return '';
    const cueText = firstSentence.length <= maxLength ? firstSentence : firstSentence.slice(0, maxLength);
    return createMemoryCue(cueText, 'story');
}

function getTopicTitle(topicProfile, topicId) {
    const topic = (topicProfile?.topics || []).find((item) => item.id === topicId);
    if (topic?.title) return topic.title;
    return BIOGRAPHY_TOPICS.find((topicItem) => topicItem.id === topicId)?.title || DEFAULT_TOPIC_TITLE;
}

function getTopic(topicProfile, topicId) {
    return (topicProfile?.topics || []).find((item) => item.id === topicId) || {
        id: topicId || DEFAULT_TOPIC_ID,
        title: getTopicTitle(topicProfile, topicId || DEFAULT_TOPIC_ID),
    };
}

function hasConversationHistory(input) {
    return Number(input.totalConversations || 0) > 0 ||
        (input.conversations || []).length > 0 ||
        (input.summaries || []).length > 0;
}

function isSpeechFriendlyName(userName) {
    const name = normalizeText(userName);
    if (!name) return false;
    if (/^\d+$/u.test(name)) return false;
    if (/^\+?\d[\d\s-]{5,}$/u.test(name)) return false;
    return true;
}

function buildFirstTimeSpeechText(userName, topicTitle) {
    const greeting = isSpeechFriendlyName(userName)
        ? `您好，${normalizeText(userName)}。`
        : '您好。';

    return `${greeting}我们先从一个简单的话题开始吧。您可以从“${topicTitle}”开始，按住下面的话筒，像聊天一样讲。我会帮您慢慢整理成回忆录。`;
}

function buildReturningGreeting(userName) {
    return isSpeechFriendlyName(userName)
        ? `欢迎回来，${normalizeText(userName)}。`
        : '欢迎回来。';
}

function getLatestSummaryRecommendation(summaries) {
    const latestSummary = [...(summaries || [])]
        .filter((summary) => summary?.topicAnalysis?.topicId)
        .sort(byNewest)[0];

    if (!latestSummary) return null;

    const topicAnalysis = latestSummary.topicAnalysis || {};
    const topicTitle = getTopicTitle(null, topicAnalysis.topicId);
    return {
        topicId: topicAnalysis.topicId,
        question: sanitizeQuestion(
            topicAnalysis.suggestedNextQuestion,
            topicAnalysis.topicId,
            topicTitle,
        ),
        memoryCue: sanitizeUserFacingText(topicAnalysis.summary),
        sourceType: 'summary',
    };
}

function getLatestTopicRecommendation(topicProfile) {
    const currentTopic = (topicProfile?.topics || [])
        .find((topic) => topic.id === topicProfile?.currentTopicId);
    if (currentTopic && normalizeText(currentTopic.suggestedNextQuestion)) {
        return {
            topicId: currentTopic.id,
            question: sanitizeQuestion(currentTopic.suggestedNextQuestion, currentTopic.id, currentTopic.title),
            memoryCue: sanitizeUserFacingText(currentTopic.summary),
            sourceType: 'current_topic',
        };
    }

    const latestTopic = [...(topicProfile?.topics || [])]
        .filter((topic) => topic.lastDiscussedAt && normalizeText(topic.suggestedNextQuestion))
        .sort(byNewest)[0];

    if (!latestTopic) return null;

    return {
        topicId: latestTopic.id,
        question: sanitizeQuestion(latestTopic.suggestedNextQuestion, latestTopic.id, latestTopic.title),
        memoryCue: sanitizeUserFacingText(latestTopic.summary),
        sourceType: 'topic',
    };
}

function getLatestConversationCue(conversations, topicId) {
    const latestConversation = [...(conversations || [])]
        .filter((item) => !topicId || item.topicId === topicId)
        .sort(byNewest)[0];

    return buildConversationMemoryCue(latestConversation?.userText || '', 48);
}

function buildFallbackQuestion(topicTitle) {
    return `关于“${topicTitle}”，您还想再补充哪一件印象深的事？`;
}

function buildFirstTimeGuidance(input) {
    const topicId = DEFAULT_TOPIC_ID;
    const topicTitle = getTopicTitle(input.topicProfile, topicId);

    return {
        mode: 'new_user',
        topicId,
        topicTitle,
        displayText: `我们先从“${topicTitle}”开始吧。按住下面的话筒，像聊天一样讲。`,
        speechText: buildFirstTimeSpeechText(input.userName, topicTitle),
        nextQuestion: '',
        shouldAutoSpeak: true,
    };
}

function buildReturningGuidance(input) {
    const recommendation = getLatestSummaryRecommendation(input.summaries) ||
        getLatestTopicRecommendation(input.topicProfile);
    const topicId = recommendation?.topicId ||
        input.topicProfile?.currentTopicId ||
        DEFAULT_TOPIC_ID;
    const topic = getTopic(input.topicProfile, topicId);
    const topicTitle = topic.title || getTopicTitle(input.topicProfile, topicId);
    const nextQuestion = recommendation?.question ||
        sanitizeQuestion(topic.suggestedNextQuestion, topicId, topicTitle) ||
        buildFallbackQuestion(topicTitle);
    const rawMemoryCue = recommendation?.memoryCue ||
        sanitizeUserFacingText(topic.summary) ||
        getLatestConversationCue(input.conversations, topicId);
    const memoryCue = typeof rawMemoryCue === 'string'
        ? createMemoryCue(rawMemoryCue, 'story')
        : rawMemoryCue;

    const recapText = memoryCue
        ? `${memoryCue.style === 'self_contained' ? `上次${memoryCue.text}` : `上次您讲到${memoryCue.text}`}。今天可以接着聊聊：${nextQuestion}`
        : `上次我们聊到“${topicTitle}”。今天可以接着聊聊：${nextQuestion}`;

    return {
        mode: 'returning_user',
        topicId,
        topicTitle,
        displayText: recapText,
        speechText: `${buildReturningGreeting(input.userName)}${recapText}`,
        nextQuestion,
        shouldAutoSpeak: true,
    };
}

// 模块：会话入口引导决策。只根据已有用户资料推导开场，不写入对话素材，避免污染回忆录内容。
function buildSessionEntryGuidance(input = {}) {
    if (!hasConversationHistory(input)) {
        return buildFirstTimeGuidance(input);
    }

    return buildReturningGuidance(input);
}

module.exports = {
    buildSessionEntryGuidance,
};
