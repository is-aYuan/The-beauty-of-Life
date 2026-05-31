const { BIOGRAPHY_TOPICS, DEFAULT_TOPIC_ID, clampProgress } = require('./topicProfiles');

const DEFAULT_MEMORY_ARCHIVE = {
    people: [],
    places: [],
    events: [],
    emotions: [],
};

const DEFAULT_READINESS = {
    timeline: { status: false, reason: '素材仍在积累中' },
    keyPeople: { status: false, reason: '关键人物素材仍在积累中' },
    depth: { status: false, reason: '叙述深度仍在积累中' },
    stories: { status: false, reason: '完整故事仍在积累中' },
    emotions: { status: false, reason: '情感表达仍在积累中' },
};

const TOPIC_THEME_MAP = {
    childhood: '童年',
    parents_home: '家庭',
    school_days: '求学',
    youth_days: '其他',
    work_livelihood: '工作',
    love_marriage: '婚姻',
    family_children: '子女',
    life_turning_points: '重大事件',
    unforgettable_era: '重大事件',
    words_to_family: '晚年',
};

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonObject(candidate) {
    const parsed = JSON.parse(candidate);
    if (!isPlainObject(parsed)) {
        throw new Error('无法解析 AI 返回的 JSON');
    }
    return parsed;
}

function extractBalancedJsonObject(rawContent) {
    const text = String(rawContent || '');
    const start = text.indexOf('{');
    if (start === -1) return '';

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index++) {
        const char = text[index];

        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === '\\') {
            escaped = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            continue;
        }
        if (inString) continue;

        if (char === '{') depth++;
        if (char === '}') depth--;
        if (depth === 0) {
            return text.slice(start, index + 1);
        }
    }

    return '';
}

// 模块：摘要 JSON 解析。兼容纯 JSON、Markdown 代码块，以及前后夹带说明文字的对象输出。
function parseAiJsonObject(rawContent) {
    const text = typeof rawContent === 'string' ? rawContent.trim() : '';
    if (!text) {
        throw new Error('无法解析 AI 返回的 JSON');
    }

    try {
        return parseJsonObject(text);
    } catch (_) {
        // Continue with fenced or embedded extraction.
    }

    const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch) {
        try {
            return parseJsonObject(fencedMatch[1].trim());
        } catch (_) {
            // Continue with balanced object extraction.
        }
    }

    const balancedObject = extractBalancedJsonObject(text);
    if (balancedObject) {
        try {
            return parseJsonObject(balancedObject);
        } catch (_) {
            // Fall through to the stable error message.
        }
    }

    throw new Error('无法解析 AI 返回的 JSON');
}

function normalizeArray(value) {
    return Array.isArray(value) ? [...value] : [];
}

function normalizeMemoryArchive(value) {
    return {
        people: normalizeArray(value?.people),
        places: normalizeArray(value?.places),
        events: normalizeArray(value?.events),
        emotions: normalizeArray(value?.emotions),
    };
}

function normalizeReadiness(value) {
    return {
        timeline: { ...(isPlainObject(value?.timeline) ? value.timeline : DEFAULT_READINESS.timeline) },
        keyPeople: { ...(isPlainObject(value?.keyPeople) ? value.keyPeople : DEFAULT_READINESS.keyPeople) },
        depth: { ...(isPlainObject(value?.depth) ? value.depth : DEFAULT_READINESS.depth) },
        stories: { ...(isPlainObject(value?.stories) ? value.stories : DEFAULT_READINESS.stories) },
        emotions: { ...(isPlainObject(value?.emotions) ? value.emotions : DEFAULT_READINESS.emotions) },
    };
}

function normalizeTopicId(topicId, fallbackTopicId) {
    const knownIds = new Set(BIOGRAPHY_TOPICS.map((topic) => topic.id));
    if (knownIds.has(topicId)) return topicId;
    if (knownIds.has(fallbackTopicId)) return fallbackTopicId;
    return DEFAULT_TOPIC_ID;
}

function normalizeTopicAnalysis(value, context = {}) {
    const topicId = normalizeTopicId(value?.topicId, context.topicId);
    const topicTitle = context.topicTitle || BIOGRAPHY_TOPICS.find((topic) => topic.id === topicId)?.title || '当前主题';

    return {
        topicId,
        progress: clampProgress(value?.progress),
        summary: typeof value?.summary === 'string' ? value.summary : `本次围绕“${topicTitle}”留下了原始讲述素材。`,
        knownFacts: normalizeArray(value?.knownFacts),
        concreteStories: normalizeArray(value?.concreteStories),
        missingInfo: normalizeArray(value?.missingInfo),
        userFacingCue: typeof value?.userFacingCue === 'string' ? value.userFacingCue : '',
        suggestedNextQuestion: typeof value?.suggestedNextQuestion === 'string' ? value.suggestedNextQuestion : '',
        personProfileUpdates: isPlainObject(value?.personProfileUpdates) ? value.personProfileUpdates : {},
    };
}

function normalizeSummaryData(summaryData, context = {}) {
    const safeSummary = isPlainObject(summaryData) ? summaryData : {};

    return {
        profile: isPlainObject(safeSummary.profile) ? safeSummary.profile : {},
        narratives: normalizeArray(safeSummary.narratives),
        coverage: {
            discussed: normalizeArray(safeSummary.coverage?.discussed),
            unexplored: normalizeArray(safeSummary.coverage?.unexplored),
        },
        emotionalNote: typeof safeSummary.emotionalNote === 'string' ? safeSummary.emotionalNote : '',
        memoryArchive: normalizeMemoryArchive(safeSummary.memoryArchive),
        readiness: normalizeReadiness(safeSummary.readiness),
        topicAnalysis: normalizeTopicAnalysis(safeSummary.topicAnalysis, context),
    };
}

function quoteUserText(text) {
    const normalized = String(text || '').trim();
    return normalized ? `“${normalized}”` : '';
}

function buildFallbackSummary({ conversations = [], topicId = DEFAULT_TOPIC_ID, topicTitle = '' } = {}) {
    const safeTopicId = normalizeTopicId(topicId, topicId);
    const safeTopicTitle = topicTitle || BIOGRAPHY_TOPICS.find((topic) => topic.id === safeTopicId)?.title || '当前主题';
    const userQuotes = conversations
        .map((conversation) => quoteUserText(conversation?.userText))
        .filter(Boolean);

    const rawNarrative = userQuotes.length > 0
        ? `本次会话围绕“${safeTopicTitle}”留下了这些原始讲述：${userQuotes.join(' ')}`
        : `本次会话围绕“${safeTopicTitle}”开始，但暂未留下可整理的原始讲述。`;

    return normalizeSummaryData({
        profile: {},
        narratives: userQuotes.length > 0
            ? [{
                theme: TOPIC_THEME_MAP[safeTopicId] || '其他',
                title: '原始讲述',
                content: rawNarrative,
                keyFacts: [],
            }]
            : [],
        coverage: {
            discussed: [safeTopicTitle],
            unexplored: [],
        },
        emotionalNote: '本次摘要由系统兜底生成，仅保留原始讲述素材，不额外推断情绪或事实。',
        memoryArchive: DEFAULT_MEMORY_ARCHIVE,
        readiness: DEFAULT_READINESS,
        topicAnalysis: {
            topicId: safeTopicId,
            progress: 0,
            summary: `本次围绕“${safeTopicTitle}”保留了原始讲述素材。`,
            knownFacts: [],
            concreteStories: userQuotes,
            missingInfo: [],
            suggestedNextQuestion: '',
            personProfileUpdates: {},
        },
    }, { topicId: safeTopicId, topicTitle: safeTopicTitle, conversations });
}

module.exports = {
    buildFallbackSummary,
    normalizeSummaryData,
    parseAiJsonObject,
};
