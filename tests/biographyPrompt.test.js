const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    buildBiographyUserPrompt,
    validateBiographyIdentity,
} = require('../lib/biographyPrompt');

test('builds biography prompt with account name as the highest-priority identity', () => {
    const prompt = buildBiographyUserPrompt({
        accountName: '郑远',
        tier: { chapterRange: [5, 8], wordsPerChapter: [800, 1500] },
        summaries: [
            {
                profile: { name: '阿杰', approxAge: '70多岁', location: '贵州安顺' },
                narratives: [
                    {
                        theme: '童年',
                        title: '少年时光',
                        content: '用户说起朋友阿杰，也讲到自己在安顺求学。',
                        keyFacts: ['阿杰是朋友', '用户在安顺求学'],
                    },
                ],
            },
        ],
        memoryProfile: null,
    });

    assert.match(prompt, /本书主人公姓名：郑远/);
    assert.match(prompt, /最高优先级/);
    assert.match(prompt, /摘要模型推测姓名：阿杰（低可信，仅作参考，不能覆盖账号姓名“郑远”）/);
    assert.doesNotMatch(prompt, /用户姓名：阿杰/);
    assert.match(prompt, /自传第一人称必须是郑远/);
});

test('rejects generated biography when first-person identity conflicts with account name', () => {
    const result = validateBiographyIdentity({
        accountName: '郑远',
        bioData: {
            title: '青春不设限',
            chapters: [
                {
                    number: 1,
                    title: '少年时光',
                    content: '我叫阿杰，出生在广东深圳。',
                },
            ],
        },
    });

    assert.equal(result.valid, false);
    assert.match(result.error, /身份冲突/);
});

test('summary extraction prompt forbids treating story characters as the user', () => {
    const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

    assert.match(serverSource, /不要把朋友、同学、家人、故事中的人物姓名当作用户姓名/);
    assert.match(serverSource, /如果不确定，必须留空/);
});
