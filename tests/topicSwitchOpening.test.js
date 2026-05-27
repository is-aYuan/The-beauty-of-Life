const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildAnsweredTopicSwitchOpeningTurn,
    buildTopicSwitchOpening,
} = require('../lib/topicSwitchOpening');
const {
    createDefaultTopicProfile,
} = require('../lib/topicProfiles');

test('builds a fresh opening question after switching to a new empty topic', () => {
    const profile = createDefaultTopicProfile('user_1');
    profile.currentTopicId = 'youth_days';

    const opening = buildTopicSwitchOpening({
        topicProfile: profile,
        topicId: 'youth_days',
    });

    assert.equal(opening.promptSource, 'topic_switch_opening');
    assert.equal(opening.topicId, 'youth_days');
    assert.equal(opening.topicTitle, '年轻时候的日子');
    assert.match(opening.text, /年轻时候/);
    assert.match(opening.text, /最常待在哪里|一直记得/);
    assert.doesNotMatch(opening.text, /母亲|父母|教育子女|妈妈/);
});

test('uses the selected topic suggested question when it already has one', () => {
    const profile = createDefaultTopicProfile('user_1');
    profile.currentTopicId = 'work_livelihood';
    profile.topics = profile.topics.map((topic) => topic.id === 'work_livelihood'
        ? {
            ...topic,
            progress: 30,
            suggestedNextQuestion: '您第一份工作是在什么地方？',
        }
        : topic);

    const opening = buildTopicSwitchOpening({
        topicProfile: profile,
        topicId: 'work_livelihood',
    });

    assert.equal(opening.topicId, 'work_livelihood');
    assert.match(opening.text, /工作与生计/);
    assert.match(opening.text, /第一份工作是在什么地方/);
});

test('builds metadata when the switched topic opening is answered', () => {
    const result = buildAnsweredTopicSwitchOpeningTurn({
        topicId: 'youth_days',
        topicTitle: '年轻时候的日子',
        text: '那我们聊聊您年轻时候的日子。那时候您最常待在哪里？',
    });

    assert.deepEqual(result, {
        promptSource: 'topic_switch_opening',
        aiPromptText: '那我们聊聊您年轻时候的日子。那时候您最常待在哪里？',
        aiPromptDisplayText: '那我们聊聊您年轻时候的日子。那时候您最常待在哪里？',
        aiPromptTopicId: 'youth_days',
        aiPromptTopicTitle: '年轻时候的日子',
        aiPromptNextQuestion: '那我们聊聊您年轻时候的日子。那时候您最常待在哪里？',
        excludeAiPromptFromSummary: true,
        excludeAiPromptFromStats: true,
        excludeAiPromptFromBiography: true,
    });
});
