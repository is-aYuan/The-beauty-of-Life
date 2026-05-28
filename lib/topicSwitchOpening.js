const {
    BIOGRAPHY_TOPICS,
    DEFAULT_TOPIC_ID,
} = require('./topicProfiles');
const {
    normalizeQuestionForElder,
} = require('./questionSafety');
const {
    buildFallbackCueFromTopic,
    sanitizeUserFacingCue,
} = require('./userFacingCue');

const DEFAULT_OPENINGS = {
    childhood: '那我们聊聊您的孩童时代。小时候您最常待在哪里？有没有一个人或一件事让您一直记得？',
    parents_home: '那我们聊聊您的父母和家。家里谁给您的印象最深？能从一件小事说起吗？',
    school_days: '那我们聊聊您求学时候的日子。那时候学校是什么样的？有没有一位老师或同学让您记得很清楚？',
    youth_days: '那我们聊聊您年轻时候的日子。那时候您最常待在哪里？有没有一个人或一件事让您一直记得？',
    work_livelihood: '那我们聊聊您的工作与生计。您最早开始工作或挣钱的时候，是在什么地方？当时每天都做些什么？',
    love_marriage: '那我们聊聊爱情与婚姻。您年轻时对成家这件事有什么想法？有没有一段经历让您印象很深？',
    family_children: '那我们聊聊家庭与子女。家里后来发生过哪些让您觉得很重要的事情？',
    life_turning_points: '那我们聊聊人生的转折点。您这一生里，有没有哪一次选择或变化，让后来的日子不一样了？',
    unforgettable_era: '那我们聊聊难忘的年代。有没有一个年份、地方或场景，您现在想起来还很清楚？',
    words_to_family: '那我们聊聊想留给家人的话。有没有一句话，您特别想让家里人记住？',
};

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function getTopic(topicProfile, topicId) {
    const safeTopicId = normalizeText(topicId) || topicProfile?.currentTopicId || DEFAULT_TOPIC_ID;
    return (topicProfile?.topics || []).find((topic) => topic.id === safeTopicId) ||
        BIOGRAPHY_TOPICS.find((topic) => topic.id === safeTopicId) ||
        null;
}

function getOpeningQuestion(topic) {
    return normalizeText(topic?.suggestedNextQuestion) ||
        DEFAULT_OPENINGS[topic?.id] ||
        '那我们换个新话题聊聊。您先想到的是哪件事？';
}

// 模块：换题后的新主题开场。它只使用新主题档案，不引用旧聊天内容，避免跨主题串话。
function buildTopicSwitchOpening({ topicProfile, topicId } = {}) {
    const topic = getTopic(topicProfile, topicId);
    if (!topic) return null;

    const rawQuestion = getOpeningQuestion(topic);
    const safeQuestion = normalizeQuestionForElder({
        question: rawQuestion,
        currentTopicId: topic.id,
        topicTitle: topic.title,
        source: 'topic_switch_opening',
    });
    const question = safeQuestion.question;
    const suggestedQuestion = normalizeText(topic.suggestedNextQuestion);
    const memoryCue = sanitizeUserFacingCue(topic.userFacingCue) || buildFallbackCueFromTopic(topic);
    const text = memoryCue
        ? `那我们换到“${topic.title}”。${memoryCue}。今天可以接着聊聊：${question}`
        : suggestedQuestion
            ? `那我们换到“${topic.title}”。${question}`
            : question;

    return {
        promptSource: 'topic_switch_opening',
        topicId: topic.id,
        topicTitle: topic.title,
        text,
        memoryCue,
        nextQuestion: question,
    };
}

function buildAnsweredTopicSwitchOpeningTurn(opening) {
    if (!opening || typeof opening !== 'object') return null;

    const aiPromptText = normalizeText(opening.text);
    if (!aiPromptText) return null;

    return {
        promptSource: 'topic_switch_opening',
        aiPromptText,
        aiPromptDisplayText: aiPromptText,
        aiPromptTopicId: normalizeText(opening.topicId),
        aiPromptTopicTitle: normalizeText(opening.topicTitle),
        aiPromptNextQuestion: normalizeText(opening.nextQuestion) || aiPromptText,
        excludeAiPromptFromSummary: true,
        excludeAiPromptFromStats: true,
        excludeAiPromptFromBiography: true,
    };
}

module.exports = {
    buildAnsweredTopicSwitchOpeningTurn,
    buildTopicSwitchOpening,
};
