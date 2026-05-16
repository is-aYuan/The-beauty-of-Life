const { DEFAULT_TOPIC_ID } = require('./topicProfiles');

const MAX_TODAY_ITEMS = 3;
const MAX_STORY_SNIPPETS = 6;
const MAX_TAGS = 8;
const MAX_RAW_RECORDS = 3;

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

function trimText(value, maxLength = 88) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
}

function topicTitleById(topicProfile, topicId) {
    const topic = (topicProfile?.topics || []).find((item) => item.id === topicId);
    return topic?.title || '';
}

function normalizeArchiveItem(item) {
    if (!item?.name) return null;
    return {
        name: String(item.name).trim(),
        relation: item.relation || '',
        context: item.context || item.details || item.significance || '',
    };
}

function dedupeByName(items) {
    const result = [];
    const seen = new Set();
    for (const item of items) {
        const normalized = normalizeArchiveItem(item);
        if (!normalized?.name || seen.has(normalized.name)) continue;
        seen.add(normalized.name);
        result.push(normalized);
    }
    return result.slice(0, MAX_TAGS);
}

function extractPeopleAndPlaces(summaries, memoryProfile) {
    const people = [];
    const places = [];

    for (const summary of summaries || []) {
        people.push(...(summary.memoryArchive?.people || []));
        places.push(...(summary.memoryArchive?.places || []));
    }

    people.push(...(memoryProfile?.memoryArchive?.people || []), ...(memoryProfile?.people || []));
    places.push(...(memoryProfile?.memoryArchive?.places || []), ...(memoryProfile?.places || []));

    return {
        people: dedupeByName(people),
        places: dedupeByName(places),
    };
}

function buildStorySnippets(summaries) {
    const snippets = [];
    const sortedSummaries = [...(summaries || [])].sort(byNewest);

    for (const summary of sortedSummaries) {
        for (const narrative of (summary.narratives || [])) {
            if (!narrative?.title && !narrative?.content) continue;
            snippets.push({
                title: narrative.title || narrative.theme || '一段回忆',
                text: trimText(narrative.content || ''),
                theme: narrative.theme || '',
                sourceType: 'summary_narrative',
                sourceId: summary._id || '',
                topicId: summary.topicAnalysis?.topicId || '',
            });
            if (snippets.length >= MAX_STORY_SNIPPETS) return snippets;
        }
    }

    return snippets;
}

function buildTodayDigest(summaries, topicProfile) {
    const latestSummary = [...(summaries || [])].sort(byNewest)[0];
    if (!latestSummary) return { items: [] };

    const items = [];
    const topicId = latestSummary.topicAnalysis?.topicId || DEFAULT_TOPIC_ID;
    const topicTitle = topicTitleById(topicProfile, topicId);
    const sourceId = latestSummary._id || '';

    const narrative = (latestSummary.narratives || [])[0];
    if (narrative) {
        items.push({
            type: 'story',
            title: narrative.title || narrative.theme || '一段回忆',
            text: trimText(narrative.content || ''),
            topicId,
            topicTitle,
            sourceType: 'recent_summary',
            sourceId,
        });
    }

    const person = (latestSummary.memoryArchive?.people || [])[0];
    if (person?.name) {
        items.push({
            type: 'person',
            title: person.name,
            text: trimText(person.details || person.relation || 'AI 已经记录了这个重要人物。'),
            topicId,
            topicTitle,
            sourceType: 'recent_summary',
            sourceId,
        });
    }

    const place = (latestSummary.memoryArchive?.places || [])[0];
    if (place?.name) {
        items.push({
            type: 'place',
            title: place.name,
            text: trimText(place.context || place.significance || 'AI 已经记录了这个重要地方。'),
            topicId,
            topicTitle,
            sourceType: 'recent_summary',
            sourceId,
        });
    }

    return { items: items.slice(0, MAX_TODAY_ITEMS) };
}

function hasRecentContent(conversations, summaries) {
    return (conversations || []).length > 0 || (summaries || []).length > 0;
}

function buildContinueRecommendation({ conversations, summaries, topicProfile }) {
    if (!hasRecentContent(conversations, summaries)) return null;

    const sortedSummaries = [...(summaries || [])].sort(byNewest);
    const latestSummary = sortedSummaries[0];
    const summaryQuestion = latestSummary?.topicAnalysis?.suggestedNextQuestion;
    const summaryTopicId = latestSummary?.topicAnalysis?.topicId;

    if (summaryQuestion && summaryTopicId) {
        return {
            type: 'continue_recent',
            title: '继续讲讲刚才的故事',
            question: summaryQuestion,
            topicId: summaryTopicId,
            topicTitle: topicTitleById(topicProfile, summaryTopicId),
            sourceType: 'recent_summary',
            sourceId: latestSummary._id || '',
        };
    }

    const latestTopic = [...(topicProfile?.topics || [])]
        .filter((topic) => topic.lastDiscussedAt && topic.suggestedNextQuestion)
        .sort(byNewest)[0];

    if (latestTopic) {
        return {
            type: 'continue_recent',
            title: `继续讲讲${latestTopic.title}`,
            question: latestTopic.suggestedNextQuestion,
            topicId: latestTopic.id,
            topicTitle: latestTopic.title,
            sourceType: 'recent_topic',
            sourceId: latestTopic.id,
        };
    }

    return null;
}

function buildRawRecordPreview(conversations) {
    const sorted = [...(conversations || [])].sort(byNewest);
    return {
        total: (conversations || []).length,
        latest: sorted.slice(0, MAX_RAW_RECORDS).map((item) => ({
            id: item._id || '',
            userText: trimText(item.userText || ''),
            aiReply: trimText(item.aiReply || ''),
            topicId: item.topicId || DEFAULT_TOPIC_ID,
            topicTitle: item.topicTitle || '',
            timestamp: item.timestamp || null,
        })),
    };
}

// AI整理模块：把后台资料整理成老人端可读、轻量、可继续聊天的视图模型。
function buildArchiveView({ conversations = [], summaries = [], memoryProfile = null, topicProfile = null }) {
    const sortedSummaries = [...summaries].sort(byNewest);

    return {
        todayDigest: buildTodayDigest(sortedSummaries, topicProfile),
        continueRecommendation: buildContinueRecommendation({
            conversations,
            summaries: sortedSummaries,
            topicProfile,
        }),
        storySnippets: buildStorySnippets(sortedSummaries),
        peopleAndPlaces: extractPeopleAndPlaces(sortedSummaries, memoryProfile),
        rawRecordPreview: buildRawRecordPreview(conversations),
    };
}

module.exports = {
    buildArchiveView,
};
