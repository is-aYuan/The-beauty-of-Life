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
            userFacingCue: '您上次提到第一份工作是在五金店帮忙',
            summary: '用户讲到自己第一份工作是在五金店帮忙。',
            suggestedNextQuestion: '您第一份工作是在什么地方？',
        }
        : topic.id === 'love_marriage'
            ? {
                ...topic,
                progress: 40,
                summary: '用户刚刚在聊第二段恋爱经历。',
                suggestedNextQuestion: '那第二段恋爱是怎么开始的？',
            }
        : topic);

    const opening = buildTopicSwitchOpening({
        topicProfile: profile,
        topicId: 'work_livelihood',
    });

    assert.equal(opening.topicId, 'work_livelihood');
    assert.match(opening.text, /工作与生计/);
    assert.match(opening.text, /您上次提到第一份工作是在五金店帮忙/);
    assert.match(opening.text, /第一份工作是在什么地方/);
    assert.doesNotMatch(opening.text, /恋爱|爱情|婚姻/);
});

test('falls back to a clean opening when topic cue contains internal analysis', () => {
    const profile = createDefaultTopicProfile('user_1');
    profile.currentTopicId = 'work_livelihood';
    profile.topics = profile.topics.map((topic) => topic.id === 'work_livelihood'
        ? {
            ...topic,
            progress: 0,
            userFacingCue: '未提供任何关于工作与生计的信息，对话主要围绕恋爱经历但用户拒绝讲述。',
            summary: '用户已选择讲述第二段恋爱，但尚未提供具体细节。AI已追问该段恋爱的开...',
            suggestedNextQuestion: '您目前从事什么工作呢？',
        }
        : topic);

    const opening = buildTopicSwitchOpening({
        topicProfile: profile,
        topicId: 'work_livelihood',
    });

    assert.equal(opening.text, '那我们换到“工作与生计”。您目前从事什么工作呢？');
    assert.doesNotMatch(opening.text, /未提供|用户|AI|拒绝|对话主要|尚未|开\.\.\./);
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
