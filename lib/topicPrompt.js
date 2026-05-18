const { DEFAULT_TOPIC_ID } = require('./topicProfiles');

function safeList(items) {
    return Array.isArray(items) && items.length > 0 ? items.join('；') : '暂无';
}

function hasProfileValue(personProfile, key) {
    const value = personProfile?.[key];
    return value !== undefined && value !== null && String(value).trim() !== '';
}

function buildPersonProfileStatus(personProfile = {}) {
    const known = [];
    const missing = [];

    if (hasProfileValue(personProfile, 'gender')) {
        known.push(`性别：${personProfile.gender}`);
    } else {
        missing.push({ key: 'gender', label: '性别' });
    }

    if (hasProfileValue(personProfile, 'hometown')) {
        known.push(`籍贯/老家：${personProfile.hometown}`);
    } else {
        missing.push({ key: 'hometown', label: '籍贯/老家' });
    }

    if (hasProfileValue(personProfile, 'ethnicity')) {
        known.push(`民族：${personProfile.ethnicity}`);
    } else {
        missing.push({ key: 'ethnicity', label: '民族' });
    }

    if (hasProfileValue(personProfile, 'age')) {
        known.push(`年龄：${personProfile.age}`);
    } else if (hasProfileValue(personProfile, 'birthYear')) {
        known.push(`出生年份：${personProfile.birthYear}`);
    } else {
        missing.push({ key: 'age', label: '年龄/出生年份' });
    }

    return { known, missing };
}

// 主题采访模块：把基础档案缺口转换成 AI 可执行的自然追问规则。
function buildPersonProfileGuidance(personProfile = {}) {
    const { known, missing } = buildPersonProfileStatus(personProfile);
    const knownText = known.length > 0 ? known.join('；') : '暂无';

    if (missing.length === 0) {
        return `基础档案补充：已知基础档案：${knownText}。基础档案已经足够，不要再主动追问性别、籍贯、民族、年龄；除非老人主动提到，否则直接围绕当前主题继续聊。`;
    }

    const missingLabels = missing.map((field) => field.label).join('、');

    return `基础档案补充：已知基础档案：${knownText}。仍缺：${missingLabels}。不要在开场主动追问性别、民族；性别、民族等身份信息只有在用户自然提到、或确实影响称呼时，才礼貌确认。不要像登记表，不要为了补档案打断当前主题；老人可以跳过。禁止问“您小时候是男孩还是女孩呀？”“您是男是女？”这类容易让老人困惑或不舒服的问题。优先从地点、家人、场景、日常生活、印象深的人或事开始。不要重复询问已知字段。`;
}

function getSelectedTopic(topicProfile, topicId) {
    const selectedTopicId = topicId || topicProfile?.currentTopicId || DEFAULT_TOPIC_ID;
    return (topicProfile?.topics || []).find((topic) => topic.id === selectedTopicId) ||
        (topicProfile?.topics || [])[0] ||
        null;
}

// 传记主题采访模块：将主题档案转换为 AI 对话可用的上下文提示词。
function buildTopicInterviewPrompt(basePrompt, topicProfile, topicId) {
    const topic = getSelectedTopic(topicProfile, topicId);
    if (!topic) return basePrompt;

    const progress = Math.max(0, Math.min(100, Math.round(Number(topic.progress) || 0)));
    const personProfile = topicProfile?.personProfile || {};
    const profileGuidance = buildPersonProfileGuidance(personProfile);
    const profileText = buildPersonProfileStatus(personProfile).known.join('；') || '暂无';

    const richRule = progress >= 85
        ? '\n- 当前主题素材已经很丰富。你可以温柔提示这一点，但必须允许老人继续讲；不要强制切换主题。'
        : '';

    return `${basePrompt}

## 当前传记采访上下文

当前采访主题：${topic.title}
当前主题进度：${progress}%
用户基础档案：${profileText}
该主题已有摘要：${topic.summary || '暂无'}
已知事实：${safeList(topic.knownFacts)}
具体故事：${safeList(topic.concreteStories)}
缺失信息：${safeList(topic.missingInfo)}
建议下一问：${topic.suggestedNextQuestion || '暂无'}
${profileGuidance}

## 主题采访规则

- 每次只问一个问题，问题要短、自然、适合老人用口语回答。
- 不要像登记表，不要连续追问多个基础信息。
- 如果基础档案缺失，不要为了补档案打断当前主题；只有话题自然经过时，才轻轻确认一个不敏感信息，用户可以跳过，跳过后继续当前主题。
- 如果当前主题没有历史内容，使用通用开场并围绕当前主题交流；优先从地点、家人、场景、日常生活、印象深的人或事开始。
- 如果当前主题已有摘要，优先引用一个已聊过但信息不足的点，再追问细节。
- 如果信息已经比较丰富，继续补充画面、人物、情绪、时间、地点、人生影响。${richRule}`;
}

function buildTopicTurnAnalysisPrompt(topicProfile, topicId, userText, aiReply) {
    const topic = getSelectedTopic(topicProfile, topicId);
    if (!topic) return '';

    const progress = Math.max(0, Math.min(100, Math.round(Number(topic.progress) || 0)));

    return `你是一位传记素材分析师。请根据当前主题档案和本轮对话，评估这个主题的素材进度。

当前主题 ID：${topic.id}
当前主题名：${topic.title}
当前已有进度：${progress}%
当前主题摘要：${topic.summary || '暂无'}
已知事实：${safeList(topic.knownFacts)}
具体故事：${safeList(topic.concreteStories)}
缺失信息：${safeList(topic.missingInfo)}

用户本轮发言：${userText}
AI 本轮回应：${aiReply}

评分规则：
- 基础事实、具体事件、细节画面、情绪感受、人生影响，每项最高 20 分，总分 0-100。
- 不要降低已有进度，除非本轮没有有效信息时可以保持原分数。
- 不要编造用户没有说过的事实。
- personProfileUpdates 只记录用户自然说出的性别、籍贯、民族、年龄、出生年份；没有就留空。

严格输出 JSON，不要输出任何其他文字：
{
  "topicAnalysis": {
    "topicId": "${topic.id}",
    "progress": 0,
    "summary": "2-4句话概括该主题已获得素材",
    "knownFacts": [],
    "concreteStories": [],
    "missingInfo": [],
    "suggestedNextQuestion": "下一句自然追问",
    "personProfileUpdates": {
      "gender": "",
      "hometown": "",
      "ethnicity": "",
      "age": "",
      "birthYear": ""
    }
  }
}`;
}

module.exports = {
    buildTopicInterviewPrompt,
    buildTopicTurnAnalysisPrompt,
    buildPersonProfileGuidance,
    getSelectedTopic,
};
