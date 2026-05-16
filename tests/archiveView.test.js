const test = require('node:test');
const assert = require('node:assert/strict');

const { createDefaultTopicProfile } = require('../lib/topicProfiles');
const {
    buildArchiveView,
} = require('../lib/archiveView');

test('builds elder-friendly archive view from recent summaries and conversations', () => {
    const topicProfile = createDefaultTopicProfile('user_1');
    topicProfile.topics = topicProfile.topics.map((topic) => (
        topic.id === 'childhood'
            ? {
                ...topic,
                progress: 45,
                summary: '用户讲到小时候常和母亲去河边。',
                suggestedNextQuestion: '小时候跟母亲去河边，您印象最深的是哪一次？',
                lastDiscussedAt: '2026-05-16T10:00:00.000Z',
            }
            : topic
    ));

    const archive = buildArchiveView({
        conversations: [
            {
                _id: 'conv_1',
                userText: '我小时候常和母亲去河边。',
                aiReply: '那是一段很有画面感的回忆。',
                topicId: 'childhood',
                topicTitle: '我的孩童时代',
                timestamp: '2026-05-16T10:01:00.000Z',
            },
        ],
        summaries: [
            {
                _id: 'summary_1',
                topicAnalysis: {
                    topicId: 'childhood',
                    suggestedNextQuestion: '小时候跟母亲去河边，您印象最深的是哪一次？',
                },
                narratives: [
                    {
                        title: '小时候的河边',
                        theme: '童年',
                        content: '用户提到小时候常和母亲去河边，那是一段很有画面感的回忆。',
                    },
                ],
                memoryArchive: {
                    people: [{ name: '母亲', relation: '母亲', details: '经常带用户去河边' }],
                    places: [{ name: '河南老家', context: '童年生活的地方' }],
                },
                createdAt: '2026-05-16T10:02:00.000Z',
            },
        ],
        memoryProfile: null,
        topicProfile,
    });

    assert.equal(archive.todayDigest.items.length, 3);
    assert.equal(archive.todayDigest.items[0].title, '小时候的河边');
    assert.equal(archive.continueRecommendation.question, '小时候跟母亲去河边，您印象最深的是哪一次？');
    assert.equal(archive.continueRecommendation.topicId, 'childhood');
    assert.equal(archive.continueRecommendation.sourceType, 'recent_summary');
    assert.equal(archive.storySnippets[0].title, '小时候的河边');
    assert.deepEqual(archive.peopleAndPlaces.people.map((item) => item.name), ['母亲']);
    assert.deepEqual(archive.peopleAndPlaces.places.map((item) => item.name), ['河南老家']);
    assert.equal(archive.rawRecordPreview.total, 1);
    assert.equal(archive.rawRecordPreview.latest[0].topicTitle, '我的孩童时代');
});

test('does not create continue_recent recommendation without recent real content', () => {
    const archive = buildArchiveView({
        conversations: [],
        summaries: [],
        memoryProfile: null,
        topicProfile: createDefaultTopicProfile('user_1'),
    });

    assert.deepEqual(archive.todayDigest.items, []);
    assert.equal(archive.continueRecommendation, null);
    assert.deepEqual(archive.storySnippets, []);
    assert.equal(archive.rawRecordPreview.total, 0);
});

test('deduplicates people and places from summaries and memory profile', () => {
    const archive = buildArchiveView({
        conversations: [],
        summaries: [
            {
                _id: 'summary_1',
                memoryArchive: {
                    people: [{ name: '母亲' }, { name: '父亲' }],
                    places: [{ name: '河南老家' }],
                },
                createdAt: '2026-05-16T10:02:00.000Z',
            },
        ],
        memoryProfile: {
            memoryArchive: {
                people: [{ name: '母亲' }, { name: '老师' }],
                places: [{ name: '河南老家' }, { name: '纺织厂' }],
            },
        },
        topicProfile: createDefaultTopicProfile('user_1'),
    });

    assert.deepEqual(archive.peopleAndPlaces.people.map((item) => item.name), ['母亲', '父亲', '老师']);
    assert.deepEqual(archive.peopleAndPlaces.places.map((item) => item.name), ['河南老家', '纺织厂']);
});
