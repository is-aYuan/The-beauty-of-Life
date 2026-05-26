const test = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeQuestionForElder,
} = require('../lib/questionSafety');

test('rewrites identity-probe questions into childhood scene questions', () => {
    const result = normalizeQuestionForElder({
        question: '您小时候是男孩还是女孩呀？这能让我更好了解您的童年呢。',
        topicTitle: '我的孩童时代',
        currentTopicId: 'childhood',
    });

    assert.equal(result.changed, true);
    assert.equal(result.reason, 'identity_probe');
    assert.equal(result.question, '您小时候最常跟谁一起玩？是在家附近，还是学校附近？');
    assert.doesNotMatch(result.question, /男孩|女孩|性别|男是女/);
});

test('rewrites judgmental questions into neutral memory prompts', () => {
    const result = normalizeQuestionForElder({
        question: '您为什么不愿意谈父母？是不是在回避这段经历？',
        topicTitle: '我的父母和家',
        currentTopicId: 'parents_home',
    });

    assert.equal(result.changed, true);
    assert.equal(result.reason, 'judgment_or_diagnosis');
    assert.equal(result.question, '小时候家里最让您有印象的一件小事是什么？');
    assert.doesNotMatch(result.question, /为什么不愿意|回避|是不是/);
});

test('rewrites leading emotional assumptions into neutral questions', () => {
    const result = normalizeQuestionForElder({
        question: '您妈妈那时候是不是很辛苦？您一定很难过吧？',
        topicTitle: '我的父母和家',
        currentTopicId: 'parents_home',
    });

    assert.equal(result.changed, true);
    assert.equal(result.reason, 'leading_assumption');
    assert.equal(result.question, '您记得家里人平时最常忙些什么吗？');
    assert.doesNotMatch(result.question, /是不是|一定/);
});

test('removes machine-analysis questions from user-facing prompts', () => {
    const result = normalizeQuestionForElder({
        question: '当前素材不足，用户没有谈到父母，主题进度不够。',
        topicTitle: '我的父母和家',
        currentTopicId: 'parents_home',
    });

    assert.equal(result.changed, true);
    assert.equal(result.reason, 'machine_analysis');
    assert.equal(result.question, '小时候家里最让您有印象的一件小事是什么？');
});

test('keeps safe concrete memory questions unchanged', () => {
    const result = normalizeQuestionForElder({
        question: '您小时候最常在哪里玩？',
        topicTitle: '我的孩童时代',
        currentTopicId: 'childhood',
    });

    assert.equal(result.changed, false);
    assert.equal(result.reason, '');
    assert.equal(result.question, '您小时候最常在哪里玩？');
});

test('removes non-spoken stage directions from AI replies before display and TTS', () => {
    const result = normalizeQuestionForElder({
        question: '那您是想到了什么吗？（温和地笑着，眼神中充满鼓励）可以慢慢说给我听哦。',
        topicTitle: '我的父母和家',
        currentTopicId: 'parents_home',
    });

    assert.equal(result.changed, true);
    assert.equal(result.reason, 'stage_direction');
    assert.equal(result.question, '那您是想到了什么吗？可以慢慢说给我听哦。');
    assert.doesNotMatch(result.question, /温和|笑着|眼神|鼓励|（|）/);
});

test('removes bracketed action descriptions without deleting normal speech', () => {
    const result = normalizeQuestionForElder({
        question: '我明白了。【轻轻点头】那您后来还记得哪些细节？',
        topicTitle: '我的父母和家',
        currentTopicId: 'parents_home',
    });

    assert.equal(result.changed, true);
    assert.equal(result.reason, 'stage_direction');
    assert.equal(result.question, '我明白了。那您后来还记得哪些细节？');
    assert.doesNotMatch(result.question, /点头|【|】/);
});

test('falls back when an AI reply only contains a stage direction', () => {
    const result = normalizeQuestionForElder({
        question: '（温和地笑着）',
        topicTitle: '我的父母和家',
        currentTopicId: 'parents_home',
    });

    assert.equal(result.changed, true);
    assert.equal(result.reason, 'stage_direction');
    assert.equal(result.question, '小时候家里最让您有印象的一件小事是什么？');
    assert.doesNotMatch(result.question, /温和|笑着|（|）/);
});
