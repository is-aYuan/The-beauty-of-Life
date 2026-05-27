const {
    BIOGRAPHY_TOPICS,
    DEFAULT_TOPIC_ID,
    RICH_PROGRESS_THRESHOLD,
    clampProgress,
    findNextIncompleteTopicId,
} = require('./topicProfiles');

const TOPIC_KEYWORDS = {
    childhood: ['孩童', '童年', '小时候'],
    parents_home: ['父母', '母亲', '父亲', '妈妈', '爸爸', '老妈', '老爸'],
    school_days: ['求学', '上学', '读书', '学校', '老师', '同学'],
    youth_days: ['年轻', '青年', '青春'],
    work_livelihood: ['工作', '生计', '上班', '职业', '挣钱', '赚钱'],
    love_marriage: ['爱情', '婚姻', '恋爱', '结婚', '爱人'],
    family_children: ['家庭', '子女', '孩子', '儿女'],
    life_turning_points: ['转折', '人生转折', '重大变化'],
    unforgettable_era: ['难忘', '年代', '时代'],
    words_to_family: ['留给', '家人的话', '想说的话', '嘱咐'],
};

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function hasPrompted(promptedTopicIds, topicId) {
    if (!topicId || !promptedTopicIds) return false;
    if (typeof promptedTopicIds.has === 'function') return promptedTopicIds.has(topicId);
    if (Array.isArray(promptedTopicIds)) return promptedTopicIds.includes(topicId);
    return false;
}

function getTopicTitle(topics, topicId) {
    const topic = (topics || []).find((item) => item.id === topicId) ||
        BIOGRAPHY_TOPICS.find((item) => item.id === topicId);
    return topic?.title || '';
}

function getTopicById(topics, topicId) {
    return (topics || []).find((topic) => topic.id === topicId) ||
        BIOGRAPHY_TOPICS.find((topic) => topic.id === topicId) ||
        null;
}

// 模块：富主题换题策略。只判断“是否应该打断式提示”，不读写数据库，便于单测覆盖。
function shouldPromptTopicTransition({
    currentTopic,
    promptedTopicIds = new Set(),
    suppressTurns = 0,
} = {}) {
    if (!currentTopic?.id) return false;
    if (suppressTurns > 0) return false;
    if (hasPrompted(promptedTopicIds, currentTopic.id)) return false;
    return clampProgress(currentTopic.progress) >= RICH_PROGRESS_THRESHOLD;
}

function buildTopicTransitionPrompt({
    topicProfile,
    promptedTopicIds = new Set(),
    suppressTurns = 0,
} = {}) {
    const topics = Array.isArray(topicProfile?.topics) ? topicProfile.topics : [];
    const currentTopicId = topicProfile?.currentTopicId || DEFAULT_TOPIC_ID;
    const currentTopic = topics.find((topic) => topic.id === currentTopicId);

    if (!shouldPromptTopicTransition({ currentTopic, promptedTopicIds, suppressTurns })) {
        return { shouldPrompt: false };
    }

    const currentTopicTitle = getTopicTitle(topics, currentTopicId);
    const nextTopicId = findNextIncompleteTopicId(topics, currentTopicId);
    const nextTopicTitle = getTopicTitle(topics, nextTopicId);

    if (!nextTopicId) {
        return {
            shouldPrompt: true,
            kind: 'all_rich',
            currentTopicId,
            currentTopicTitle,
            nextTopicId: '',
            nextTopicTitle: '',
            text: `“${currentTopicTitle}”这个主题已经讲得很丰富了。现在所有主题的素材都很丰富了。您想继续补充这个主题，还是去回忆库看看整理好的内容？`,
        };
    }

    return {
        shouldPrompt: true,
        kind: 'switch',
        currentTopicId,
        currentTopicTitle,
        nextTopicId,
        nextTopicTitle,
        text: `“${currentTopicTitle}”这个主题已经讲得很丰富了。您想继续讲这个主题，还是换到“${nextTopicTitle}”？您说“继续”或者“换一个”都可以。`,
    };
}

function getTopicAliases(topic) {
    const title = normalizeText(topic?.title);
    const titleWithoutPrefix = title.replace(/^我的/, '');
    return [
        title,
        titleWithoutPrefix,
        ...(TOPIC_KEYWORDS[topic?.id] || []),
    ].filter(Boolean);
}

function parseTopicTransitionChoice(text, topics = []) {
    const value = normalizeText(text);
    if (!value) return { intent: 'unknown', topicId: '' };

    if (/回忆库|整理|生成|自传|看看/.test(value)) {
        return { intent: 'review', topicId: '' };
    }

    const topicPool = Array.isArray(topics) && topics.length > 0 ? topics : BIOGRAPHY_TOPICS;
    const matchedTopic = topicPool.find((topic) =>
        getTopicAliases(getTopicById(topicPool, topic.id) || topic).some((alias) => value.includes(alias)),
    );
    if (matchedTopic) return { intent: 'switch', topicId: matchedTopic.id };

    if (/换|切换|下一个|别的|其他|另一个/.test(value)) {
        return { intent: 'switch', topicId: '' };
    }
    if (/继续|接着|还想|当前|这个/.test(value)) {
        return { intent: 'continue', topicId: '' };
    }

    return { intent: 'unknown', topicId: '' };
}

module.exports = {
    buildTopicTransitionPrompt,
    parseTopicTransitionChoice,
    shouldPromptTopicTransition,
};
