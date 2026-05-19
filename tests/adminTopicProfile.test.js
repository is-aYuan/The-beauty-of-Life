const test = require('node:test');
const assert = require('node:assert/strict');

const { buildAdminTopicProfileResponse } = require('../lib/adminTopicProfile');
const { BIOGRAPHY_TOPICS } = require('../lib/topicProfiles');

test('builds an admin topic profile response with all biography topics', () => {
    const response = buildAdminTopicProfileResponse({
        userId: 'user_1',
        currentTopicId: 'school_days',
        topics: [
            {
                id: 'school_days',
                title: '求学时候的日子',
                progress: 72,
                status: 'needs_detail',
                summary: '用户讲到了初中打篮球和老师。',
                knownFacts: ['初中喜欢篮球'],
                concreteStories: ['腿骨折后朋友来看望'],
                missingInfo: ['学校名字'],
                suggestedNextQuestion: '那位老师最让您难忘的事是什么？',
                lastDiscussedAt: '2026-05-18T10:00:00.000Z',
            },
        ],
    }, 'user_1');

    assert.equal(response.userId, 'user_1');
    assert.equal(response.currentTopicId, 'school_days');
    assert.equal(response.topics.length, BIOGRAPHY_TOPICS.length);

    const schoolTopic = response.topics.find((topic) => topic.id === 'school_days');
    assert.equal(schoolTopic.progress, 72);
    assert.equal(schoolTopic.summary, '用户讲到了初中打篮球和老师。');
    assert.deepEqual(schoolTopic.knownFacts, ['初中喜欢篮球']);

    const childhoodTopic = response.topics.find((topic) => topic.id === 'childhood');
    assert.equal(childhoodTopic.progress, 0);
    assert.equal(childhoodTopic.status, 'not_started');
    assert.deepEqual(childhoodTopic.missingInfo, []);
});
