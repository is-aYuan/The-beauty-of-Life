const test = require('node:test');
const assert = require('node:assert/strict');

const {
    DEFAULT_TOPIC_ID,
    createDefaultTopicProfile,
} = require('../lib/topicProfiles');
const {
    buildSessionEntryGuidance,
} = require('../lib/sessionEntryGuidance');

test('builds first-time guidance with childhood selected and concise display copy', () => {
    const profile = createDefaultTopicProfile('user_1');

    const guidance = buildSessionEntryGuidance({
        userName: '胡敏先',
        topicProfile: profile,
        conversations: [],
        summaries: [],
    });

    assert.equal(guidance.mode, 'new_user');
    assert.equal(guidance.topicId, DEFAULT_TOPIC_ID);
    assert.equal(guidance.topicTitle, '我的孩童时代');
    assert.equal(guidance.shouldAutoSpeak, true);
    assert.equal(
        guidance.displayText,
        '我们可以先从“我的孩童时代”开始。您也可以在右边选择其他想聊的主题。选好后，按住下面的话筒，像聊天一样讲。',
    );
    assert.match(guidance.speechText, /您好，胡敏先。/);
    assert.match(guidance.speechText, /也可以在右边选择其他想聊的主题/);
    assert.match(guidance.speechText, /我会帮您慢慢整理成回忆录/);
});

test('does not read numeric account names aloud for first-time guidance', () => {
    const guidance = buildSessionEntryGuidance({
        userName: '123123',
        topicProfile: createDefaultTopicProfile('user_2'),
        conversations: [],
        summaries: [],
    });

    assert.match(guidance.displayText, /我的孩童时代/);
    assert.doesNotMatch(guidance.speechText, /123123/);
    assert.match(guidance.speechText, /^您好。/);
});

test('builds returning guidance from latest summary question and topic summary', () => {
    const profile = createDefaultTopicProfile('user_3');
    profile.topics[0] = {
        ...profile.topics[0],
        progress: 30,
        status: 'started',
        suggestedNextQuestion: '小时候家里谁最照顾您？',
    };

    const guidance = buildSessionEntryGuidance({
        userName: '胡敏先',
        topicProfile: profile,
        conversations: [
            {
                topicId: 'childhood',
                topicTitle: '我的孩童时代',
                userText: '我小时候常和母亲去河边。',
                timestamp: '2026-05-18T08:00:00.000Z',
            },
        ],
        summaries: [
            {
                createdAt: '2026-05-18T09:00:00.000Z',
                topicAnalysis: {
                    topicId: 'childhood',
                    summary: '您提到小时候常和母亲去河边。',
                    suggestedNextQuestion: '小时候跟母亲去河边，您印象最深的是哪一次？',
                },
            },
        ],
    });

    assert.equal(guidance.mode, 'returning_user');
    assert.equal(guidance.topicId, 'childhood');
    assert.equal(guidance.topicTitle, '我的孩童时代');
    assert.equal(guidance.nextQuestion, '小时候跟母亲去河边，您印象最深的是哪一次？');
    assert.equal(
        guidance.displayText,
        '上次您讲到小时候常和母亲去河边。今天可以接着聊聊：小时候跟母亲去河边，您印象最深的是哪一次？',
    );
    assert.match(guidance.speechText, /^欢迎回来，胡敏先。/);
});

test('uses latest topic suggested question when summary question is unavailable', () => {
    const profile = createDefaultTopicProfile('user_4');
    profile.currentTopicId = 'parents_home';
    profile.topics = profile.topics.map((topic) => topic.id === 'parents_home'
        ? {
            ...topic,
            lastDiscussedAt: '2026-05-18T10:00:00.000Z',
            suggestedNextQuestion: '家里的老房子是什么样子的？',
        }
        : topic);

    const guidance = buildSessionEntryGuidance({
        userName: '胡敏先',
        topicProfile: profile,
        conversations: [
            {
                topicId: 'parents_home',
                topicTitle: '我的父母和家',
                userText: '我父母那时候住在老房子里。',
                timestamp: '2026-05-18T10:00:00.000Z',
            },
        ],
        summaries: [],
    });

    assert.equal(guidance.mode, 'returning_user');
    assert.equal(guidance.topicId, 'parents_home');
    assert.equal(guidance.nextQuestion, '家里的老房子是什么样子的？');
    assert.equal(
        guidance.displayText,
        '上次您讲到您父母那时候住在老房子里。今天可以接着聊聊：家里的老房子是什么样子的？',
    );
});

test('rewrites first-person identity facts into second-person returning guidance', () => {
    const profile = createDefaultTopicProfile('user_5a');
    profile.currentTopicId = 'parents_home';

    const guidance = buildSessionEntryGuidance({
        userName: '郑远',
        topicProfile: profile,
        conversations: [
            {
                topicId: 'parents_home',
                topicTitle: '我的父母和家',
                userText: '我是汉族，虽然我是贵州的，但是我是汉族。我周围小学的时候，大家很多人都是苗族。',
                timestamp: '2026-05-18T10:00:00.000Z',
            },
        ],
        summaries: [
            {
                createdAt: '2026-05-18T11:00:00.000Z',
                topicAnalysis: {
                    topicId: 'parents_home',
                    summary: '',
                    suggestedNextQuestion: '您刚才提到妈妈和哥哥，能说说您妈妈是个什么样的人吗？',
                },
            },
        ],
    });

    assert.doesNotMatch(guidance.displayText, /上次您讲到我是/);
    assert.doesNotMatch(guidance.displayText, /我周围/);
    assert.doesNotMatch(guidance.displayText, /刚才/);
    assert.equal(
        guidance.displayText,
        '上次您聊到自己是汉族，也说小学时身边有很多苗族同学。今天可以接着聊聊：您上次提到妈妈和哥哥，能说说您妈妈是个什么样的人吗？',
    );
});

test('normalizes unsafe historical suggested questions in returning guidance', () => {
    const profile = createDefaultTopicProfile('user_5b');
    profile.currentTopicId = 'childhood';
    profile.topics = profile.topics.map((topic) => topic.id === 'childhood'
        ? {
            ...topic,
            suggestedNextQuestion: '您小时候是男孩还是女孩呀？这能让我更好了解您的童年呢。',
            lastDiscussedAt: '2026-05-18T10:00:00.000Z',
        }
        : topic);

    const guidance = buildSessionEntryGuidance({
        userName: '关元',
        topicProfile: profile,
        conversations: [
            {
                topicId: 'childhood',
                topicTitle: '我的孩童时代',
                userText: '我能听到你说话。',
                timestamp: '2026-05-18T10:00:00.000Z',
            },
        ],
        summaries: [],
    });

    assert.equal(
        guidance.nextQuestion,
        '您小时候最常跟谁一起玩？是在家附近，还是学校附近？',
    );
    assert.doesNotMatch(guidance.displayText, /男孩|女孩|性别/);
});

test('normalizes unsafe summary suggested questions in returning guidance', () => {
    const profile = createDefaultTopicProfile('user_5c');

    const guidance = buildSessionEntryGuidance({
        userName: '关元',
        topicProfile: profile,
        conversations: [
            {
                topicId: 'childhood',
                topicTitle: '我的孩童时代',
                userText: '我小时候住在村口。',
                timestamp: '2026-05-18T10:00:00.000Z',
            },
        ],
        summaries: [
            {
                createdAt: '2026-05-18T11:00:00.000Z',
                topicAnalysis: {
                    topicId: 'childhood',
                    summary: '小时候住在村口',
                    suggestedNextQuestion: '您小时候是男孩还是女孩呀？这能让我更好了解您的童年呢。',
                },
            },
        ],
    });

    assert.equal(
        guidance.nextQuestion,
        '您小时候最常跟谁一起玩？是在家附近，还是学校附近？',
    );
    assert.doesNotMatch(guidance.displayText, /男孩|女孩|性别/);
});

test('does not read internal analysis or truncated summary aloud in returning guidance', () => {
    const profile = createDefaultTopicProfile('user_5');
    profile.currentTopicId = 'parents_home';

    const guidance = buildSessionEntryGuidance({
        userName: '郑远',
        topicProfile: profile,
        conversations: [
            {
                topicId: 'parents_home',
                topicTitle: '我的父母和家',
                userText: '小时候过年我会去舅舅家，大家一起去竹林砍竹子，还会杀年猪。',
                timestamp: '2026-05-18T10:00:00.000Z',
            },
        ],
        summaries: [
            {
                createdAt: '2026-05-18T11:00:00.000Z',
                topicAnalysis: {
                    topicId: 'parents_home',
                    summary: '用户回避了直接谈论父母，但分享了童年过年去舅舅家的经历，包括竹林砍竹子和杀年猪两个故...',
                    suggestedNextQuestion: '您刚才提到妈妈和哥哥，能说说您妈妈是个什么样的人吗？',
                },
            },
        ],
    });

    assert.equal(guidance.mode, 'returning_user');
    assert.equal(guidance.topicId, 'parents_home');
    assert.doesNotMatch(guidance.displayText, /用户|回避|故\.\.\./);
    assert.doesNotMatch(guidance.speechText, /用户|回避|故\.\.\./);
    assert.doesNotMatch(guidance.displayText, /刚才/);
    assert.equal(
        guidance.displayText,
        '上次您讲到小时候过年您会去舅舅家，大家一起去竹林砍竹子，还会杀年猪。今天可以接着聊聊：您上次提到妈妈和哥哥，能说说您妈妈是个什么样的人吗？',
    );
});
