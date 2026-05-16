const test = require('node:test');
const assert = require('node:assert/strict');

const {
    BIOGRAPHY_TOPICS,
    DEFAULT_TOPIC_ID,
    createDefaultTopicProfile,
    getTopicStatus,
    findNextIncompleteTopicId,
} = require('../lib/topicProfiles');

test('creates a default topic profile with ten topics and childhood selected', () => {
    const profile = createDefaultTopicProfile('user_1');

    assert.equal(profile.userId, 'user_1');
    assert.equal(profile.currentTopicId, DEFAULT_TOPIC_ID);
    assert.equal(profile.currentTopicId, 'childhood');
    assert.equal(profile.topics.length, 10);
    assert.deepEqual(
        profile.topics.map((topic) => topic.id),
        BIOGRAPHY_TOPICS.map((topic) => topic.id),
    );
    assert.ok(profile.topics.every((topic) => topic.progress === 0));
    assert.ok(profile.topics.every((topic) => topic.status === 'not_started'));
});

test('maps topic progress to user-facing status buckets', () => {
    assert.equal(getTopicStatus(0), 'not_started');
    assert.equal(getTopicStatus(1), 'started');
    assert.equal(getTopicStatus(34), 'started');
    assert.equal(getTopicStatus(35), 'has_story');
    assert.equal(getTopicStatus(64), 'has_story');
    assert.equal(getTopicStatus(65), 'needs_detail');
    assert.equal(getTopicStatus(84), 'needs_detail');
    assert.equal(getTopicStatus(85), 'rich');
    assert.equal(getTopicStatus(100), 'rich');
});

test('finds the next topic below the richness threshold without forcing a switch', () => {
    const profile = createDefaultTopicProfile('user_1');
    const topics = profile.topics.map((topic) => ({
        ...topic,
        progress: topic.id === 'childhood' ? 85 : topic.progress,
    }));

    assert.equal(findNextIncompleteTopicId(topics, 'childhood'), 'parents_home');
});

test('returns null when every topic is rich enough', () => {
    const profile = createDefaultTopicProfile('user_1');
    const topics = profile.topics.map((topic) => ({ ...topic, progress: 85 }));

    assert.equal(findNextIncompleteTopicId(topics, 'family_children'), null);
});
