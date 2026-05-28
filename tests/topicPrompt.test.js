const test = require('node:test');
const assert = require('node:assert/strict');

const { createDefaultTopicProfile } = require('../lib/topicProfiles');
const {
    buildTopicInterviewPrompt,
    buildTopicTurnAnalysisPrompt,
} = require('../lib/topicPrompt');

test('builds an interview prompt with the selected topic context', () => {
    const profile = createDefaultTopicProfile('user_1');
    profile.currentTopicId = 'childhood';
    profile.personProfile = { hometown: '河南', age: 78 };
    profile.topics = profile.topics.map((topic) => {
        if (topic.id !== 'childhood') return topic;
        return {
            ...topic,
            progress: 55,
            status: 'has_story',
            summary: '用户提到小时候住在河南农村，经常去河边玩。',
            knownFacts: ['小时候住在河南农村'],
            concreteStories: ['常去河边玩'],
            missingInfo: ['玩伴名字', '当时感受'],
            suggestedNextQuestion: '您小时候去河边玩，最难忘的是哪一次？',
        };
    });

    const prompt = buildTopicInterviewPrompt('基础提示', profile, 'childhood');

    assert.match(prompt, /基础提示/);
    assert.match(prompt, /当前采访主题：我的孩童时代/);
    assert.match(prompt, /当前主题进度：55%/);
    assert.match(prompt, /用户提到小时候住在河南农村/);
    assert.match(prompt, /玩伴名字/);
    assert.match(prompt, /每次只问一个问题/);
    assert.match(prompt, /不要像登记表/);
});

test('includes a gentle richness rule for topics at or above 85 percent', () => {
    const profile = createDefaultTopicProfile('user_1');
    profile.currentTopicId = 'parents_home';
    profile.topics = profile.topics.map((topic) => {
        if (topic.id !== 'parents_home') return topic;
        return {
            ...topic,
            progress: 88,
            status: 'rich',
            summary: '用户已经讲了父亲、母亲和家里的规矩。',
        };
    });

    const prompt = buildTopicInterviewPrompt('基础提示', profile, 'parents_home');

    assert.match(prompt, /当前采访主题：我的父母和家/);
    assert.match(prompt, /当前主题进度：88%/);
    assert.match(prompt, /素材已经很丰富/);
    assert.match(prompt, /允许老人继续讲/);
});

test('deprioritizes sensitive profile fields and avoids registry-style questions', () => {
    const profile = createDefaultTopicProfile('user_1');
    profile.currentTopicId = 'childhood';
    profile.personProfile = {
        hometown: '河南',
        age: 78,
    };

    const prompt = buildTopicInterviewPrompt('基础提示', profile, 'childhood');

    assert.match(prompt, /基础档案补充/);
    assert.match(prompt, /已知基础档案：籍贯\/老家：河南；年龄：78/);
    assert.match(prompt, /仍缺：性别、民族/);
    assert.match(prompt, /不要在开场主动追问性别、民族/);
    assert.match(prompt, /禁止问“您小时候是男孩还是女孩/);
    assert.match(prompt, /优先从地点、家人、场景、日常生活、印象深的人或事开始/);
    assert.doesNotMatch(prompt, /优先只自然询问「性别」/);
    assert.match(prompt, /老人可以跳过/);
    assert.match(prompt, /不要重复询问已知字段/);
});

test('does not ask elder profile questions when profile is complete', () => {
    const profile = createDefaultTopicProfile('user_1');
    profile.currentTopicId = 'childhood';
    profile.personProfile = {
        gender: '男',
        hometown: '河南',
        ethnicity: '汉族',
        birthYear: '1948',
    };

    const prompt = buildTopicInterviewPrompt('基础提示', profile, 'childhood');

    assert.match(prompt, /基础档案补充/);
    assert.match(prompt, /基础档案已经足够/);
    assert.match(prompt, /不要再主动追问性别、籍贯、民族、年龄/);
    assert.doesNotMatch(prompt, /仍缺：/);
});

test('builds a per-turn topic analysis prompt with the current turn and topic profile', () => {
    const profile = createDefaultTopicProfile('user_1');
    profile.currentTopicId = 'work_livelihood';
    profile.topics = profile.topics.map((topic) => (
        topic.id === 'work_livelihood'
            ? { ...topic, progress: 35, summary: '用户提到年轻时进厂工作。' }
            : topic
    ));

    const prompt = buildTopicTurnAnalysisPrompt(
        profile,
        'work_livelihood',
        '我年轻时候在纺织厂上班，最累的是夜班。',
        '那时候夜班一定很辛苦，您还记得第一次上夜班是什么情景吗？',
    );

    assert.match(prompt, /当前主题 ID：work_livelihood/);
    assert.match(prompt, /当前主题名：工作与生计/);
    assert.match(prompt, /当前已有进度：35%/);
    assert.match(prompt, /用户本轮发言：我年轻时候在纺织厂上班/);
    assert.match(prompt, /严格输出 JSON/);
    assert.match(prompt, /topicAnalysis/);
    assert.match(prompt, /userFacingCue/);
    assert.match(prompt, /可以直接朗读给用户听/);
    assert.match(prompt, /禁止写“用户提到/);
    assert.match(prompt, /如果本轮没有形成可展示记忆，就返回空字符串/);
});
