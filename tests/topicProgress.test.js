const test = require('node:test');
const assert = require('node:assert/strict');

const { createDefaultTopicProfile } = require('../lib/topicProfiles');
const { applyTopicAnalysisToProfile } = require('../lib/topicProgress');

test('applies topic analysis without decreasing existing progress', () => {
    const profile = createDefaultTopicProfile('user_1');
    profile.topics = profile.topics.map((topic) => (
        topic.id === 'childhood' ? { ...topic, progress: 60, status: 'has_story' } : topic
    ));

    const updated = applyTopicAnalysisToProfile(profile, {
        topicId: 'childhood',
        progress: 45,
        summary: '用户讲到小时候住在河南农村。',
        knownFacts: ['住在河南农村'],
        concreteStories: ['去河边玩'],
        missingInfo: ['玩伴名字'],
        suggestedNextQuestion: '您小时候常和谁去河边玩？',
    }, '2026-05-16T00:00:00.000Z');

    const topic = updated.topics.find((item) => item.id === 'childhood');
    assert.equal(topic.progress, 60);
    assert.equal(topic.status, 'has_story');
    assert.equal(topic.summary, '用户讲到小时候住在河南农村。');
    assert.deepEqual(topic.knownFacts, ['住在河南农村']);
    assert.deepEqual(topic.concreteStories, ['去河边玩']);
    assert.deepEqual(topic.missingInfo, ['玩伴名字']);
    assert.equal(topic.suggestedNextQuestion, '您小时候常和谁去河边玩？');
    assert.equal(topic.lastDiscussedAt, '2026-05-16T00:00:00.000Z');
});

test('merges topic analysis arrays and person profile updates', () => {
    const profile = createDefaultTopicProfile('user_1');
    profile.personProfile = { hometown: '河南' };
    profile.topics = profile.topics.map((topic) => (
        topic.id === 'parents_home'
            ? { ...topic, knownFacts: ['父亲很严厉'], missingInfo: ['母亲性格'] }
            : topic
    ));

    const updated = applyTopicAnalysisToProfile(profile, {
        topicId: 'parents_home',
        progress: 88,
        knownFacts: ['父亲很严厉', '母亲很勤快'],
        missingInfo: ['母亲性格', '家里规矩'],
        personProfileUpdates: { ethnicity: '汉族', hometown: '' },
    }, '2026-05-16T00:00:00.000Z');

    const topic = updated.topics.find((item) => item.id === 'parents_home');
    assert.equal(topic.progress, 88);
    assert.equal(topic.status, 'rich');
    assert.deepEqual(topic.knownFacts, ['父亲很严厉', '母亲很勤快']);
    assert.deepEqual(topic.missingInfo, ['母亲性格', '家里规矩']);
    assert.deepEqual(updated.personProfile, { hometown: '河南', ethnicity: '汉族' });
});

test('normalizes unsafe suggested next questions before saving topic profile', () => {
    const profile = createDefaultTopicProfile('user_1');

    const updated = applyTopicAnalysisToProfile(profile, {
        topicId: 'childhood',
        progress: 10,
        suggestedNextQuestion: '您小时候是男孩还是女孩呀？这能让我更好了解您的童年呢。',
    }, '2026-05-16T00:00:00.000Z');

    const topic = updated.topics.find((item) => item.id === 'childhood');
    assert.equal(
        topic.suggestedNextQuestion,
        '您小时候最常跟谁一起玩？是在家附近，还是学校附近？',
    );
});
