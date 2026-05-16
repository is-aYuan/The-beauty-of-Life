const RICH_PROGRESS_THRESHOLD = 85;
const DEFAULT_TOPIC_ID = 'childhood';

// 传记主题采访模块：统一维护第一版主题顺序、默认状态和进度分桶。
const BIOGRAPHY_TOPICS = [
    { id: 'childhood', title: '我的孩童时代' },
    { id: 'parents_home', title: '我的父母和家' },
    { id: 'school_days', title: '求学时候的日子' },
    { id: 'youth_days', title: '年轻时候的日子' },
    { id: 'work_livelihood', title: '工作与生计' },
    { id: 'love_marriage', title: '爱情与婚姻' },
    { id: 'family_children', title: '家庭与子女' },
    { id: 'life_turning_points', title: '人生的转折点' },
    { id: 'unforgettable_era', title: '难忘的年代' },
    { id: 'words_to_family', title: '留给家人的话' },
];

function clampProgress(progress) {
    const numericProgress = Number(progress);
    if (!Number.isFinite(numericProgress)) return 0;
    return Math.min(100, Math.max(0, Math.round(numericProgress)));
}

function getTopicStatus(progress) {
    const safeProgress = clampProgress(progress);
    if (safeProgress === 0) return 'not_started';
    if (safeProgress < 35) return 'started';
    if (safeProgress < 65) return 'has_story';
    if (safeProgress < RICH_PROGRESS_THRESHOLD) return 'needs_detail';
    return 'rich';
}

function createDefaultTopic(topic) {
    return {
        id: topic.id,
        title: topic.title,
        progress: 0,
        status: 'not_started',
        summary: '',
        knownFacts: [],
        concreteStories: [],
        missingInfo: [],
        suggestedNextQuestion: '',
        lastDiscussedAt: null,
    };
}

function createDefaultTopicProfile(userId) {
    return {
        userId,
        currentTopicId: DEFAULT_TOPIC_ID,
        personProfile: {},
        topics: BIOGRAPHY_TOPICS.map(createDefaultTopic),
        allRichPromptShown: false,
    };
}

function findNextIncompleteTopicId(topics, currentTopicId) {
    const orderedIds = BIOGRAPHY_TOPICS.map((topic) => topic.id);
    const topicMap = new Map((topics || []).map((topic) => [topic.id, topic]));
    const currentIndex = Math.max(0, orderedIds.indexOf(currentTopicId));

    for (let offset = 1; offset <= orderedIds.length; offset++) {
        const id = orderedIds[(currentIndex + offset) % orderedIds.length];
        const topic = topicMap.get(id);
        if (!topic || clampProgress(topic.progress) < RICH_PROGRESS_THRESHOLD) {
            return id;
        }
    }

    return null;
}

module.exports = {
    BIOGRAPHY_TOPICS,
    DEFAULT_TOPIC_ID,
    RICH_PROGRESS_THRESHOLD,
    clampProgress,
    createDefaultTopicProfile,
    findNextIncompleteTopicId,
    getTopicStatus,
};
