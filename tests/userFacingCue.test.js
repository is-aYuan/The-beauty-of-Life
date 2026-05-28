const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildFallbackCueFromTopic,
    sanitizeUserFacingCue,
} = require('../lib/userFacingCue');

test('keeps a natural second-person user-facing cue', () => {
    assert.equal(
        sanitizeUserFacingCue('您上次提到第一份工作是在五金店帮忙。'),
        '您上次提到第一份工作是在五金店帮忙',
    );
});

test('rejects internal analysis wording and truncated summaries', () => {
    const unsafeValues = [
        '用户已选择讲述第二段恋爱，但尚未提供具体细节。AI已追问该段恋爱的开...',
        '未提供任何关于工作与生计的信息，对话主要围绕恋爱经历但用户拒绝讲述。',
        '该主题缺失具体故事，需要继续分析。',
    ];

    for (const value of unsafeValues) {
        assert.equal(sanitizeUserFacingCue(value), '');
    }
});

test('rewrites simple first-person memory cues into second person', () => {
    assert.equal(
        sanitizeUserFacingCue('我年轻时候在纺织厂上班，最累的是夜班。'),
        '您年轻时候在纺织厂上班，最累的是夜班',
    );
});

test('builds fallback cue only from safe target-topic material', () => {
    const cue = buildFallbackCueFromTopic({
        summary: '未提供任何关于工作与生计的信息，对话主要围绕恋爱经历。',
        concreteStories: ['我年轻时候在纺织厂上班，最累的是夜班。'],
        knownFacts: ['用户拒绝讲述工作内容。'],
    });

    assert.equal(cue, '您年轻时候在纺织厂上班，最累的是夜班');
});
