const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildTopicTransitionPrompt,
    parseTopicTransitionChoice,
    shouldPromptTopicTransition,
} = require('../lib/topicTransitionPrompt');
const {
    BIOGRAPHY_TOPICS,
} = require('../lib/topicProfiles');

function buildTopics(progressById) {
    return BIOGRAPHY_TOPICS.map((topic) => ({
        ...topic,
        progress: progressById[topic.id] ?? 90,
    }));
}

test('prompts when current topic is rich and another topic is incomplete', () => {
    const profile = {
        currentTopicId: 'parents_home',
        topics: buildTopics({
            parents_home: 88,
            school_days: 90,
            youth_days: 0,
        }),
    };

    const prompt = buildTopicTransitionPrompt({
        topicProfile: profile,
        promptedTopicIds: new Set(),
        suppressTurns: 0,
    });

    assert.equal(prompt.shouldPrompt, true);
    assert.equal(prompt.kind, 'switch');
    assert.equal(prompt.currentTopicId, 'parents_home');
    assert.equal(prompt.nextTopicId, 'youth_days');
    assert.equal(prompt.currentTopicTitle, '我的父母和家');
    assert.equal(prompt.nextTopicTitle, '年轻时候的日子');
    assert.match(prompt.text, /已经讲得很丰富/);
    assert.match(prompt.text, /继续/);
    assert.match(prompt.text, /换/);
});

test('prompts with a review option when all topics are rich', () => {
    const profile = {
        currentTopicId: 'parents_home',
        topics: buildTopics({
            parents_home: 88,
        }),
    };

    const prompt = buildTopicTransitionPrompt({
        topicProfile: profile,
        promptedTopicIds: new Set(),
        suppressTurns: 0,
    });

    assert.equal(prompt.shouldPrompt, true);
    assert.equal(prompt.kind, 'all_rich');
    assert.equal(prompt.nextTopicId, '');
    assert.match(prompt.text, /所有主题/);
    assert.match(prompt.text, /回忆库/);
});

test('does not prompt for the same rich topic twice in one session', () => {
    const prompt = shouldPromptTopicTransition({
        currentTopic: { id: 'parents_home', progress: 88 },
        promptedTopicIds: new Set(['parents_home']),
        suppressTurns: 0,
    });

    assert.equal(prompt, false);
});

test('suppresses prompts after user chooses to continue', () => {
    const prompt = shouldPromptTopicTransition({
        currentTopic: { id: 'parents_home', progress: 88 },
        promptedTopicIds: new Set(),
        suppressTurns: 2,
    });

    assert.equal(prompt, false);
});

test('parses voice choice to switch topics', () => {
    assert.deepEqual(parseTopicTransitionChoice('换一个吧'), { intent: 'switch', topicId: '' });
});

test('parses voice choice to continue current topic', () => {
    assert.deepEqual(parseTopicTransitionChoice('继续讲这个'), { intent: 'continue', topicId: '' });
});

test('parses concrete topic names', () => {
    const topics = [
        { id: 'work_livelihood', title: '工作与生计' },
        { id: 'youth_days', title: '年轻时候的日子' },
    ];

    assert.deepEqual(parseTopicTransitionChoice('讲工作吧', topics), {
        intent: 'switch',
        topicId: 'work_livelihood',
    });
});

test('parses review intent when all topics are rich', () => {
    assert.deepEqual(parseTopicTransitionChoice('去回忆库看看'), {
        intent: 'review',
        topicId: '',
    });
});
