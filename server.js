/**
 * 故事坊 MVP - 腾讯云后端服务
 *
 * 功能链路：
 * 前端音频(PCM) → 腾讯云ASR(语音识别) → 混元大模型(AI对话) → 腾讯云TTS(语音合成) → 前端播放
 *
 * 数据持久化：
 * - 用户资料 → CloudBase users 集合
 * - 会话记录 → CloudBase sessions 集合（关联 userId）
 * - 对话记录 → CloudBase conversations 集合（关联 userId + sessionId）
 * - 音频文件 → 本地存储
 */

require('dotenv').config();
const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const {
    BIOGRAPHY_TOPICS,
    DEFAULT_TOPIC_ID,
    createDefaultTopicProfile,
    getTopicStatus,
} = require('./lib/topicProfiles');
const {
    buildTopicInterviewPrompt,
    buildTopicTurnAnalysisPrompt,
    getSelectedTopic,
} = require('./lib/topicPrompt');
const {
    applyTopicAnalysisToProfile,
} = require('./lib/topicProgress');

// ==================== CloudBase 初始化 ====================
const cloudbase = require('@cloudbase/node-sdk');

const tcbApp = cloudbase.init({
    env: process.env.TCB_ENV_ID,
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
});

const db = tcbApp.database();
const _ = db.command; // 数据库操作符
console.log('[CloudBase] 云数据库已连接');

// ==================== 腾讯云 SDK 导入 ====================
const AsrClient = require('tencentcloud-sdk-nodejs-asr').asr.v20190614.Client;
const HunyuanClient = require('tencentcloud-sdk-nodejs-hunyuan').hunyuan.v20230901.Client;
const TtsClient = require('tencentcloud-sdk-nodejs-tts').tts.v20190823.Client;

// ==================== 配置 ====================
const PORT = 8000;
const SECRET_ID = process.env.TENCENT_SECRET_ID;
const SECRET_KEY = process.env.TENCENT_SECRET_KEY;
const REGION = process.env.TENCENT_REGION || 'ap-guangzhou';
const HUNYUAN_MODEL = process.env.HUNYUAN_MODEL || 'hunyuan-turbos-latest';
const AI_SYSTEM_PROMPT = process.env.AI_SYSTEM_PROMPT || '你是故事坊的AI助手，专门帮助老年人记录家庭故事和记忆。请用温暖、耐心、简洁的语气回复，每次回复不超过100字。鼓励老人继续讲述，适当提问引导。';

const AUDIO_ROOT = path.join(__dirname, 'data', 'records');

// ==================== 初始化腾讯云客户端 ====================
const commonConfig = {
    credential: { secretId: SECRET_ID, secretKey: SECRET_KEY },
    region: REGION,
    profile: { httpProfile: { endpoint: undefined } },
};

const asrClient = new AsrClient({
    ...commonConfig,
    profile: { ...commonConfig.profile, httpProfile: { endpoint: 'asr.tencentcloudapi.com' } },
});

const hunyuanClient = new HunyuanClient({
    ...commonConfig,
    profile: { ...commonConfig.profile, httpProfile: { endpoint: 'hunyuan.tencentcloudapi.com' } },
});

const ttsClient = new TtsClient({
    ...commonConfig,
    profile: { ...commonConfig.profile, httpProfile: { endpoint: 'tts.tencentcloudapi.com' } },
});

// ==================== DeepSeek 客户端（叙事摘要提取） ====================
const OpenAI = require('openai');

const deepseekClient = new OpenAI({
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY,
});

const SUMMARY_SYSTEM_PROMPT = `你是一位专业的传记作者兼记忆分析师。你的任务是从老年人的语音对话记录中，同时完成两项工作：提取叙事摘要，以及构建记忆档案。

## 输出格式
严格输出以下 JSON，不要输出任何其他文字：

{
  "profile": {
    "name": "对话中明确提到的用户姓名，未提及则留空字符串",
    "approxAge": "用户的大致年龄或出生年代，需要从对话中推断，未提及则留空",
    "location": "用户的居住地或籍贯，未提及则留空"
  },
  "narratives": [
    {
      "theme": "主题分类，只能从以下选项中选择：童年、家庭、求学、工作、婚姻、子女、晚年、兴趣爱好、重大事件、其他",
      "title": "简短标题，6个字以内，概括这段叙事的核心",
      "content": "完整的叙事段落，必须包含：(1)用户原话用引号保留 (2)情感状态用括号标注 (3)具体细节不省略。至少3句话，像写传记一样叙述。",
      "keyFacts": ["提取的具体事实，每条一个，包含时间/地点/人物等关键信息"]
    }
  ],
  "coverage": {
    "discussed": ["本次对话中用户明确谈到的话题，简短概括"],
    "unexplored": ["根据本次对话内容，用户提到但未深入、或明显相关但未涉及的话题，给出具体方向"]
  },
  "emotionalNote": "用户本次对话的整体情感状态和沟通意愿，2-3句话描述",

  "memoryArchive": {
    "people": [
      {
        "name": "人物全名或称呼",
        "relation": "与用户的关系（如：母亲、同事、邻居、朋友）",
        "mentionedIn": "用户提到此人时的原话片段，保留上下文",
        "details": "关于此人的具体信息（年龄、外貌、性格、事件等），尽可能丰富"
      }
    ],
    "places": [
      {
        "name": "地名",
        "context": "用户提到此地时的原话片段和背景",
        "significance": "这个地方对用户意味着什么"
      }
    ],
    "events": [
      {
        "time": "事件发生的大致时间（年份或年代，如1958年、六十年代、小时候）",
        "description": "事件描述，保留用户原话中的关键表述",
        "people": ["与此事件相关的人物"],
        "emotionalWeight": "high/medium/low，根据用户谈及此事时的情绪强度判断"
      }
    ],
    "emotions": [
      {
        "feeling": "具体情感描述（如：对母亲的愧疚、对工作的自豪、对往事的怀念）",
        "trigger": "什么话题触发了这个情感",
        "intensity": "strong/moderate/weak"
      }
    ]
  },

  "readiness": {
    "timeline": { "status": true或false, "reason": "判断依据" },
    "keyPeople": { "status": true或false, "reason": "判断依据" },
    "depth": { "status": true或false, "reason": "判断依据" },
    "stories": { "status": true或false, "reason": "判断依据" },
    "emotions": { "status": true或false, "reason": "判断依据" }
  },

  "topicAnalysis": {
    "topicId": "当前会话所属主题 ID，必须使用输入中提供的当前主题 ID",
    "progress": 0到100的整数,
    "summary": "该主题目前已获得的素材摘要，2-4句话，不要编造",
    "knownFacts": ["该主题下已经明确的事实，如时间、地点、人物、身份关系"],
    "concreteStories": ["该主题下已经出现的具体故事"],
    "missingInfo": ["该主题接下来最值得补充的信息"],
    "suggestedNextQuestion": "下次围绕这个主题最自然的一句追问",
    "personProfileUpdates": {
      "gender": "自然提到的性别，未提及则留空字符串",
      "hometown": "自然提到的籍贯或老家，未提及则留空字符串",
      "ethnicity": "自然提到的民族，未提及则留空字符串",
      "age": "自然提到的年龄，未提及则留空字符串",
      "birthYear": "自然提到的出生年份，未提及则留空字符串"
    }
  }
}

## 叙事摘要提取规则

1. **保留原话**：用户的原话必须用引号完整保留，不得改写、概括或提炼。
   正确：他说"那年冬天特别冷，我妈把最后一碗米煮成粥，分给我们三个娃"
   错误：他说那年冬天母亲把米分给了孩子们

2. **情感标记**：在叙事段落中用括号标注可推断的情感状态。
   正确：说到母亲时，他停了很久（沉默约五秒），才继续说……
   错误：他说到母亲时很感动

3. **具体细节**：保留所有具体信息，宁多勿少。包括人名、地名、年份、日期、数字、职业、单位名称、物价、天气、穿着、食物、建筑等任何生活细节。

4. **叙事而非概括**：content 字段必须是完整的叙事段落（至少3句话），要像写传记一样叙述，有起承转合。

5. **多个主题**：如果对话涉及多个主题，narratives 数组中应有多个元素，每个主题独立一段。

6. **诚实原则**：如果对话内容过少或没有实质故事内容，narratives 可以为空数组，不要编造内容。

## 记忆档案提取规则

7. **people 字段**：记录用户提到的每一个人，不仅是亲属，包括家人、朋友、同事、邻居、老师、领导等。mentionedIn 必须是用户原话片段。

8. **places 字段**：记录用户提到的每一个具体地名，包括出生地、居住地、工作地点、学校、医院等。

9. **events 字段**：记录用户提到的每一个具体事件。emotionalWeight 判断标准：high=语速变化/停顿/重复提及/感叹词，medium=正常叙述有情感色彩，low=平淡提及。

10. **emotions 字段**：记录用户表达的每一种情感，不要猜测，只记录有明确表达依据的。

## 就绪度判断规则

11. **timeline**：true=能梳理出从出生到现在的大致人生轨迹，false=时间线有大段空白。

12. **keyPeople**：true=至少提到了父母、配偶、子女中的两类，false=只提到了一类或没有。

13. **depth**：true=至少有一个话题讲了3轮以上或有超过200字的连续叙述，false=所有话题浅尝辄止。

14. **stories**：true=至少有一个包含时间、地点、人物、经过的完整故事，false=只有概括性描述。

15. **emotions**：true=至少有一次表达过内心感受、反思、遗憾、珍惜等深层情感，false=只是客观叙述。

## 主题素材进度判断规则

16. topicAnalysis 只评估输入中提供的“当前会话主要主题”。不要为其他主题打分。

17. progress 按五个维度评分，每个维度最高 20 分：基础事实、具体事件、细节画面、情绪感受、人生影响。总分为 0-100 的整数。

18. 如果用户没有讲到实质故事，progress 可以保持较低，不要为了显得完整而抬高分数。

19. personProfileUpdates 只记录用户自然说出的基础档案。不要为了补齐字段而猜测。`;

// ==================== 自传撰写 Prompt ====================

const BIOGRAPHY_SYSTEM_PROMPT = `你是一位专业的传记作家。你的任务是根据老年人通过语音聊天提供的素材，撰写一本个人自传。

## 输入说明

你将收到两部分内容：

1. **叙事摘要素材**：按会话时间排列的叙事段落，每段包含用户的原话引用、情感状态和具体事实。这些是自传的核心素材。

2. **记忆档案**：从对话中提取的人物、地点、事件、情感的结构化数据。这是自传的骨架参考。

## 输出格式

严格输出以下 JSON，不要输出任何其他文字：

{
  "title": "自传标题，从用户的故事中提炼，有个人特色，不超过15个字",
  "chapters": [
    {
      "number": 1,
      "title": "章节标题，6个字以内",
      "content": "章节正文，800-3000字"
    }
  ]
}

## 章节划分规则

1. **以时间线为主轴**：按用户的人生阶段划分章节，如童年、求学、工作、婚姻、晚年等。不要按对话轮次或素材来源划分。

2. **以主题为补充**：如果用户的某些故事跨越多个时间段（如与母亲的关系贯穿一生），可以单独成章。

3. **章节顺序**：默认按时间线从早到晚排列。如果用户的人生故事有特别的叙事结构，可以调整，但必须有清晰的逻辑。

4. **章节数量**：根据素材量决定——素材少则5-8章，素材多则12-20章。每章应该是完整的一段人生经历。

5. **每章字数**：根据素材量决定——素材少则每章800-1500字，素材多则每章2000-3000字。宁可写得充实，不要注水。

## 写作规则（必须严格遵守）

### 忠实性规则

1. **不编造事实**：自传中的所有事件、人物、时间、地点必须来自素材。绝不能为了故事完整性而虚构任何细节。

2. **素材不足时留白**：如果某个时期或话题的素材很少，不要硬写。可以用一两句话带过，或者直接跳过。留白比编造好。

3. **保留原话**：用户说过的原话是自传最珍贵的部分。在合适的场景中用引号引用用户的原话，让读者能感受到用户的声音。
   正确：母亲把最后一碗米煮成粥，分给我们三个娃，自己饿了一整天。
   错误：母亲把食物分给了孩子们，自己没有吃。

4. **保留不确定性**：如果用户对某个时间或细节不确定（如"大概是六几年吧"），在自传中也要体现这种不确定，不要替用户确定。
   正确：大概是六十年代初，我进了铁路局。
   错误：1962年，我进入了铁路局。

### 文学性规则

5. **语言温暖朴实**：这是一位老人的人生故事，语言应该温暖、真诚、有温度。不要用华丽的辞藻，也不要太口语化。像一位老朋友在讲述。

6. **场景化叙述**：重要的故事要有场景感——描述当时的环境、天气、声音、气味等感官细节（仅限素材中提到的，不要自行添加）。

7. **情感层次**：不只是记录事件，要体现事件背后的情感。比如逃荒不只是"家里穷"，还有"母亲的坚韧"、"童年的恐惧"、"对家乡的不舍"等情感层次。

8. **节奏感**：重要的故事要慢写，用更多篇幅。不重要的过渡要快写，一两句话带过。整本书有张有弛。

9. **开头和结尾**：第一章的开头要有吸引力，可以用一个印象深刻的场景或一句话引入。最后一章要有收束感，可以是总结、感悟、或对后人的寄语。

### 结构性规则

10. **章节衔接**：相邻章节之间要有自然的过渡，不要生硬跳转。可以用时间推移、事件因果、情感变化来衔接。

11. **人物一致性**：同一个人物在不同章节中的称呼要一致。如果用户称母亲为"我妈"，全书就用"我妈"。

12. **时间一致性**：时间表述要前后一致。不要一会儿"1958年"一会儿"五八年"。

### 书名规则

13. **书名来源**：书名应该从用户的故事中提炼，体现这个人或这段人生的独特之处。不要用"XX自传"这样的通用格式。
    好的书名：《铁路上的三十年》《遵义母亲》《那碗粥》
    不好的书名：《张大爷自传》《我的人生故事》`;

// ==================== 用户管理模块 ====================

/**
 * 用户注册
 * 使用手机号作为唯一标识，同时创建用户资料
 */
async function registerUser(phone, name, age) {
    // 检查手机号是否已注册
    const existing = await db.collection('users').where({ phone }).get();
    if (existing.data.length > 0) {
        return { success: false, message: '该手机号已注册' };
    }

    // 创建用户
    const result = await db.collection('users').add({
        phone,
        name,
        age: age || null,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
        status: 'active',
    });

    console.log(`[用户] 注册成功: ${name} (${phone})`);
    return { success: true, userId: result.id, phone, name };
}

/**
 * 用户登录
 * 使用手机号登录，返回用户信息
 */
async function loginUser(phone) {
    const result = await db.collection('users').where({ phone, status: 'active' }).get();
    if (result.data.length === 0) {
        return { success: false, message: '用户不存在' };
    }

    const user = result.data[0];
    console.log(`[用户] 登录成功: ${user.name} (${phone})`);
    return {
        success: true,
        userId: user._id,
        phone: user.phone,
        name: user.name,
        age: user.age,
    };
}

/**
 * 获取用户资料
 */
async function getUserProfile(userId) {
    const result = await db.collection('users').doc(userId).get();
    if (result.data.length === 0) return null;
    return result.data[0];
}

/**
 * 更新用户资料
 */
async function updateUserProfile(userId, updates) {
    await db.collection('users').doc(userId).update({
        ...updates,
        updatedAt: db.serverDate(),
    });
}

/**
 * 删除用户及其所有关联数据（级联删除）
 * 清理集合：users → sessions → conversations → summaries
 */
async function deleteUser(userId) {
    // 1. 删除对话记录
    const convResult = await db.collection('conversations').where({ userId }).get();
    for (const doc of convResult.data) {
        await db.collection('conversations').doc(doc._id).remove();
    }
    console.log(`[删除] 已清理 ${convResult.data.length} 条对话记录`);

    // 2. 删除叙事摘要
    const summResult = await db.collection('summaries').where({ userId }).get();
    for (const doc of summResult.data) {
        await db.collection('summaries').doc(doc._id).remove();
    }
    console.log(`[删除] 已清理 ${summResult.data.length} 条叙事摘要`);

    // 3. 删除记忆档案
    const memResult = await db.collection('memory_profiles').where({ userId }).get();
    for (const doc of memResult.data) {
        await db.collection('memory_profiles').doc(doc._id).remove();
    }
    console.log(`[删除] 已清理 ${memResult.data.length} 条记忆档案`);

    // 4. 删除成品自传
    const bioResult = await db.collection('biographies').where({ userId }).get();
    for (const doc of bioResult.data) {
        await db.collection('biographies').doc(doc._id).remove();
    }
    console.log(`[删除] 已清理 ${bioResult.data.length} 条成品自传`);

    // 5. 删除会话
    const sessResult = await db.collection('sessions').where({ userId }).get();
    for (const doc of sessResult.data) {
        await db.collection('sessions').doc(doc._id).remove();
    }
    console.log(`[删除] 已清理 ${sessResult.data.length} 条会话记录`);

    // 6. 删除用户
    await db.collection('users').doc(userId).remove();
    console.log(`[删除] 用户 ${userId} 已删除`);

    return {
        deletedConversations: convResult.data.length,
        deletedSummaries: summResult.data.length,
        deletedMemoryProfiles: memResult.data.length,
        deletedBiographies: bioResult.data.length,
        deletedSessions: sessResult.data.length,
    };
}

// ==================== 会话管理模块（关联用户） ====================

/**
 * 创建新会话（关联到用户）
 */
async function createSession(sessionId, userId) {
    await db.collection('sessions').add({
        sessionId,
        userId,
        startTime: db.serverDate(),
        endTime: null,
        messageCount: 0,
        status: 'active',
    });
    console.log(`[CloudBase] 会话 ${sessionId} 已创建 (用户: ${userId})`);
}

/**
 * 保存对话记录（关联到用户和会话）
 */
async function saveConversation(sessionId, userId, record) {
    await db.collection('conversations').add({
        sessionId,
        userId,
        ...record,
        timestamp: db.serverDate(),
    });
    console.log(`[CloudBase] 对话记录已保存`);
}

/**
 * 更新会话结束时间，并触发叙事摘要提取
 */
async function endSession(sessionId) {
    const session = await db.collection('sessions').where({ sessionId }).get();
    if (session.data.length > 0) {
        await db.collection('sessions').doc(session.data[0]._id).update({
            endTime: db.serverDate(),
            status: 'ended',
        });
    }
    console.log(`[CloudBase] 会话 ${sessionId} 已结束`);

    // 异步提取叙事摘要（不阻塞会话关闭）
    const userId = sessions.get(sessionId)?.userId;
    if (userId) {
        extractNarrativeSummary(sessionId, userId).catch(err => {
            console.error(`[摘要] 提取失败:`, err.message);
        });
    }
}

/**
 * 获取用户的会话列表
 */
async function getUserSessions(userId) {
    const result = await db.collection('sessions')
        .where({ userId })
        .orderBy('startTime', 'desc')
        .limit(50)
        .get();
    return result.data;
}

/**
 * 获取用户的所有对话记录
 */
async function getUserConversations(userId) {
    const result = await db.collection('conversations')
        .where({ userId })
        .orderBy('timestamp', 'asc')
        .get();
    return result.data;
}

/**
 * 获取某个会话的对话记录
 */
async function getSessionConversations(sessionId) {
    const result = await db.collection('conversations')
        .where({ sessionId })
        .orderBy('timestamp', 'asc')
        .get();
    return result.data;
}

/**
 * 提取叙事摘要（会话结束后自动调用）
 * 使用 DeepSeek 从对话记录中提取保留原话、情感、细节的叙事级摘要
 */
async function extractNarrativeSummary(sessionId, userId) {
    // 获取本次会话的对话记录
    const conversations = await getSessionConversations(sessionId);
    if (conversations.length === 0) {
        console.log(`[摘要] 会话 ${sessionId} 无对话记录，跳过`);
        return;
    }

    const latestTopicId = [...conversations].reverse().find(c => c.topicId)?.topicId || DEFAULT_TOPIC_ID;
    const topicProfile = await getOrCreateTopicProfile(userId);
    const selectedTopic = getSelectedTopic(topicProfile, latestTopicId);

    // 格式化对话为文本
    const dialogueText = conversations.map((c, i) => {
        const topicLabel = c.topicTitle || selectedTopic?.title || '未标记主题';
        return `【第${i + 1}轮｜主题：${topicLabel}】\n用户：${c.userText}\nAI：${c.aiReply}`;
    }).join('\n\n');

    // 计算本次会话素材字数
    const sessionWordCount = conversations.reduce((sum, c) => sum + (c.userText || '').length, 0);

    console.log(`[摘要] 开始提取会话 ${sessionId} 的叙事摘要（${conversations.length} 轮对话，${sessionWordCount} 字）...`);

    try {
        const response = await deepseekClient.chat.completions.create({
            model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
            messages: [
                { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: `当前会话主要主题 ID：${latestTopicId}
当前会话主要主题名：${selectedTopic?.title || '未标记主题'}

以下是老年人的对话记录，请提取叙事摘要、记忆档案，并输出当前主题的 topicAnalysis：\n\n${dialogueText}`,
                },
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' },
        });

        const rawContent = response.choices[0].message.content;
        let summaryData;

        try {
            summaryData = JSON.parse(rawContent);
        } catch (parseErr) {
            const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                summaryData = JSON.parse(jsonMatch[1].trim());
            } else {
                throw new Error('无法解析 AI 返回的 JSON');
            }
        }

        const topicAnalysis = summaryData.topicAnalysis
            ? {
                ...summaryData.topicAnalysis,
                topicId: BIOGRAPHY_TOPICS.some(topic => topic.id === summaryData.topicAnalysis.topicId)
                    ? summaryData.topicAnalysis.topicId
                    : latestTopicId,
            }
            : null;

        // 存入 CloudBase summaries 集合
        await db.collection('summaries').add({
            sessionId,
            userId,
            profile: summaryData.profile || {},
            narratives: summaryData.narratives || [],
            coverage: summaryData.coverage || { discussed: [], unexplored: [] },
            emotionalNote: summaryData.emotionalNote || '',
            memoryArchive: summaryData.memoryArchive || {},
            readiness: summaryData.readiness || {},
            topicAnalysis,
            conversationCount: conversations.length,
            sessionWordCount,
            createdAt: db.serverDate(),
        });

        console.log(`[摘要] 会话 ${sessionId} 叙事摘要已保存（${(summaryData.narratives || []).length} 个主题段落）`);

        // 更新记忆档案（累积合并）
        if (summaryData.memoryArchive || summaryData.readiness) {
            await updateMemoryProfile(userId, summaryData.memoryArchive, summaryData.readiness, sessionWordCount);
        }
        if (topicAnalysis) {
            await updateTopicProfileFromAnalysis(userId, topicAnalysis);
        }
    } catch (err) {
        console.error(`[摘要] DeepSeek 调用失败:`, err.message);
    }
}

/**
 * 判断记忆档案是否达到生成自传的就绪状态
 * 条件：5个维度中至少4个为 true，且累计素材 ≥ 10000 字
 */
function isReady(profile) {
    if (!profile || !profile.readiness) return false;

    const r = profile.readiness;
    const readyCount = [r.timeline, r.keyPeople, r.depth, r.stories, r.emotions]
        .filter(d => d && d.status === true).length;

    const totalWordCount = profile.totalWordCount || 0;

    return readyCount >= 4 && totalWordCount >= 10000;
}

/**
 * 累积更新用户记忆档案
 * 每次会话结束后调用，将新的记忆数据合并到已有档案中
 */
async function updateMemoryProfile(userId, memoryArchive, readiness, sessionWordCount) {
    try {
        // 查询是否已有记忆档案
        const existing = await db.collection('memory_profiles').where({ userId }).get();

        const newPeople = memoryArchive?.people || [];
        const newPlaces = memoryArchive?.places || [];
        const newEvents = memoryArchive?.events || [];
        const newEmotions = memoryArchive?.emotions || [];

        if (existing.data.length > 0) {
            // 合并更新
            const profile = existing.data[0];

            // 合并人物（按 name 去重，已有的更新 mentions 和 details）
            const mergedPeople = mergeByKey(
                profile.people || [],
                newPeople,
                'name',
                (old, cur) => ({
                    ...old,
                    mentionedIn: old.mentionedIn + '；' + (cur.mentionedIn || ''),
                    details: old.details + '；' + (cur.details || ''),
                })
            );

            // 合并地点（按 name 去重）
            const mergedPlaces = mergeByKey(
                profile.places || [],
                newPlaces,
                'name',
                (old, cur) => ({
                    ...old,
                    context: old.context + '；' + (cur.context || ''),
                })
            );

            // 合并事件（按 description 去重）
            const mergedEvents = mergeByKey(
                profile.events || [],
                newEvents,
                'description',
                (old, cur) => ({
                    ...old,
                    people: [...new Set([...(old.people || []), ...(cur.people || [])])],
                    emotionalWeight: old.emotionalWeight === 'high' ? 'high' : cur.emotionalWeight,
                })
            );

            // 合并情感（按 feeling 去重）
            const mergedEmotions = mergeByKey(
                profile.emotions || [],
                newEmotions,
                'feeling',
                (old, cur) => ({
                    ...old,
                    intensity: old.intensity === 'strong' ? 'strong' : cur.intensity,
                })
            );

            // 更新就绪度（取最新值）
            const mergedReadiness = readiness || profile.readiness;

            // 计算就绪维度数
            const r = mergedReadiness;
            const readyCount = [r.timeline, r.keyPeople, r.depth, r.stories, r.emotions]
                .filter(d => d && d.status === true).length;

            await db.collection('memory_profiles').doc(profile._id).update({
                people: mergedPeople,
                places: mergedPlaces,
                events: mergedEvents,
                emotions: mergedEmotions,
                readiness: mergedReadiness,
                readyCount,
                totalWordCount: (profile.totalWordCount || 0) + sessionWordCount,
                updatedAt: db.serverDate(),
            });

            console.log(`[记忆档案] 已更新用户 ${userId}（人物:${mergedPeople.length} 地点:${mergedPlaces.length} 事件:${mergedEvents.length} 就绪:${readyCount}/5）`);
        } else {
            // 创建新档案
            const r = readiness || {};
            const readyCount = [r.timeline, r.keyPeople, r.depth, r.stories, r.emotions]
                .filter(d => d && d.status === true).length;

            await db.collection('memory_profiles').add({
                userId,
                people: newPeople,
                places: newPlaces,
                events: newEvents,
                emotions: newEmotions,
                readiness: readiness || {},
                readyCount,
                totalWordCount: sessionWordCount,
                createdAt: db.serverDate(),
                updatedAt: db.serverDate(),
            });

            console.log(`[记忆档案] 已创建用户 ${userId}（人物:${newPeople.length} 地点:${newPlaces.length} 事件:${newEvents.length} 就绪:${readyCount}/5）`);
        }
    } catch (err) {
        console.error(`[记忆档案] 更新失败:`, err.message);
    }
}

/**
 * 通用合并函数：按指定 key 去重，已有的调用 mergeFn 合并，新的追加
 */
function mergeByKey(existing, incoming, key, mergeFn) {
    const map = new Map();
    for (const item of existing) {
        map.set(item[key], { ...item });
    }
    for (const item of incoming) {
        if (map.has(item[key])) {
            map.set(item[key], mergeFn(map.get(item[key]), item));
        } else {
            map.set(item[key], { ...item });
        }
    }
    return Array.from(map.values());
}

/**
 * 获取用户统计数据
 */
async function getUserStats(userId) {
    const sessions = await db.collection('sessions').where({ userId }).get();
    const conversations = await db.collection('conversations').where({ userId }).get();

    const totalSessions = sessions.data.length;
    const totalConversations = conversations.data.length;

    // 计算总音频时长（根据音频大小估算，16kHz 16bit = 32KB/s）
    const totalAudioKB = conversations.data.reduce((sum, c) => sum + (c.audioSizeKB || 0), 0);
    const estimatedDurationMin = Math.round(totalAudioKB / 32 / 60);

    return {
        totalSessions,
        totalConversations,
        totalAudioKB,
        estimatedDurationMin,
    };
}

// ==================== 管理员认证 ====================

const adminTokens = new Map(); // token -> { createdAt }

function adminLogin(phone, password) {
    if (phone === process.env.ADMIN_PHONE && password === process.env.ADMIN_PASSWORD) {
        const token = require('crypto').randomBytes(32).toString('hex');
        adminTokens.set(token, { createdAt: Date.now() });
        console.log(`[管理员] 登录成功`);
        return { success: true, token };
    }
    console.log(`[管理员] 登录失败: ${phone}`);
    return { success: false, message: '手机号或密码错误' };
}

function verifyAdminToken(token) {
    if (!token) return false;
    const session = adminTokens.get(token);
    if (!session) return false;
    // 2小时过期
    if (Date.now() - session.createdAt > 2 * 60 * 60 * 1000) {
        adminTokens.delete(token);
        return false;
    }
    return true;
}

function getAuthHeader(req) {
    const auth = req.headers['authorization'] || '';
    return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

async function getAdminStats() {
    const users = await db.collection('users').get();
    const sessions = await db.collection('sessions').get();
    const conversations = await db.collection('conversations').get();
    const summaries = await db.collection('summaries').get();

    return {
        totalUsers: users.data.length,
        totalSessions: sessions.data.length,
        totalConversations: conversations.data.length,
        totalSummaries: summaries.data.length,
    };
}

async function getAdminUsers() {
    const users = await db.collection('users').get();
    const result = [];

    for (const user of users.data) {
        const sessCount = await db.collection('sessions').where({ userId: user._id }).count();
        const convCount = await db.collection('conversations').where({ userId: user._id }).count();
        const summCount = await db.collection('summaries').where({ userId: user._id }).count();

        result.push({
            ...user,
            sessionCount: sessCount.total || 0,
            conversationCount: convCount.total || 0,
            summaryCount: summCount.total || 0,
        });
    }

    return result;
}

// ==================== 自传生成模块 ====================

/**
 * 获取用户所有叙事摘要（按时间排序）
 */
async function getUserSummaries(userId) {
    const result = await db.collection('summaries')
        .where({ userId })
        .orderBy('createdAt', 'asc')
        .get();
    return result.data;
}

/**
 * 获取用户记忆档案
 */
async function getMemoryProfile(userId) {
    const result = await db.collection('memory_profiles')
        .where({ userId })
        .get();
    return result.data.length > 0 ? result.data[0] : null;
}

// ==================== 传记主题采访模块 ====================

/**
 * 将数据库中的主题档案补齐为当前版本，避免改动旧字段结构。
 */
function normalizeTopicProfile(profile, userId) {
    const defaults = createDefaultTopicProfile(userId);
    const existingTopics = new Map((profile?.topics || []).map((topic) => [topic.id, topic]));
    const topics = defaults.topics.map((defaultTopic) => {
        const existing = existingTopics.get(defaultTopic.id);
        if (!existing) return defaultTopic;

        const progress = Math.min(100, Math.max(0, Math.round(Number(existing.progress) || 0)));
        return {
            ...defaultTopic,
            ...existing,
            title: defaultTopic.title,
            progress,
            status: getTopicStatus(progress),
            knownFacts: Array.isArray(existing.knownFacts) ? existing.knownFacts : [],
            concreteStories: Array.isArray(existing.concreteStories) ? existing.concreteStories : [],
            missingInfo: Array.isArray(existing.missingInfo) ? existing.missingInfo : [],
        };
    });

    const currentTopicExists = topics.some((topic) => topic.id === profile?.currentTopicId);

    return {
        ...defaults,
        ...profile,
        userId,
        currentTopicId: currentTopicExists ? profile.currentTopicId : DEFAULT_TOPIC_ID,
        personProfile: profile?.personProfile || {},
        topics,
        allRichPromptShown: Boolean(profile?.allRichPromptShown),
    };
}

/**
 * 获取或创建用户主题采访档案。
 */
async function getOrCreateTopicProfile(userId) {
    const result = await db.collection('topic_profiles')
        .where({ userId })
        .limit(1)
        .get();

    if (result.data.length > 0) {
        const profile = normalizeTopicProfile(result.data[0], userId);
        const shouldPatchMissingFields =
            !result.data[0].topics ||
            result.data[0].topics.length !== BIOGRAPHY_TOPICS.length ||
            !result.data[0].currentTopicId;

        if (shouldPatchMissingFields) {
            await db.collection('topic_profiles').doc(result.data[0]._id).update({
                currentTopicId: profile.currentTopicId,
                personProfile: profile.personProfile,
                topics: profile.topics,
                allRichPromptShown: profile.allRichPromptShown,
                updatedAt: db.serverDate(),
            });
        }

        return profile;
    }

    const profile = createDefaultTopicProfile(userId);
    const addResult = await db.collection('topic_profiles').add({
        ...profile,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
    });

    return {
        ...profile,
        _id: addResult.id || addResult._id,
    };
}

/**
 * 更新当前采访主题；不触碰旧 memory_profiles 数据结构。
 */
async function updateCurrentTopic(userId, topicId) {
    if (!BIOGRAPHY_TOPICS.some((topic) => topic.id === topicId)) {
        throw new Error('无效的主题');
    }

    const profile = await getOrCreateTopicProfile(userId);
    await db.collection('topic_profiles').doc(profile._id).update({
        currentTopicId: topicId,
        updatedAt: db.serverDate(),
    });

    return {
        ...profile,
        currentTopicId: topicId,
    };
}

/**
 * 将 DeepSeek 的主题分析结果合并回 topic_profiles。
 */
async function updateTopicProfileFromAnalysis(userId, topicAnalysis) {
    if (!topicAnalysis?.topicId) return null;

    const profile = await getOrCreateTopicProfile(userId);
    const updatedProfile = applyTopicAnalysisToProfile(profile, topicAnalysis);

    await db.collection('topic_profiles').doc(profile._id).update({
        personProfile: updatedProfile.personProfile,
        topics: updatedProfile.topics,
        updatedAt: db.serverDate(),
    });

    console.log(`[主题档案] 已更新用户 ${userId} 的主题 ${topicAnalysis.topicId}，进度 ${topicAnalysis.progress || 0}%`);
    return updatedProfile;
}

/**
 * 根据素材字数确定自传产出档次
 */
function getBiographyTier(totalWordCount) {
    if (totalWordCount < 10000) {
        return { name: '人生故事集', chapterRange: [5, 8], wordsPerChapter: [800, 1500] };
    } else if (totalWordCount < 30000) {
        return { name: '个人传记', chapterRange: [8, 12], wordsPerChapter: [1500, 2500] };
    } else {
        return { name: '完整回忆录', chapterRange: [12, 20], wordsPerChapter: [2000, 3000] };
    }
}

/**
 * 生成自传
 * 拉取用户所有叙事摘要和记忆档案，调用 DeepSeek 撰写自传
 */
async function generateBiography(userId) {
    console.log(`[自传] 开始为用户 ${userId} 生成自传...`);

    // 1. 获取所有叙事摘要
    const summaries = await getUserSummaries(userId);
    if (summaries.length === 0) {
        throw new Error('该用户暂无叙事摘要，无法生成自传');
    }

    // 2. 获取记忆档案
    const memoryProfile = await getMemoryProfile(userId);

    // 3. 计算素材总量
    const totalWordCount = summaries.reduce((sum, s) => sum + (s.sessionWordCount || 0), 0);
    const tier = getBiographyTier(totalWordCount);

    console.log(`[自传] 素材量: ${totalWordCount} 字，档次: ${tier.name}`);

    // 4. 拼接叙事摘要素材
    const narrativeText = summaries.map((s, i) => {
        let section = `=== 第${i + 1}次对话 ===\n`;
        if (s.profile?.name) section += `用户姓名：${s.profile.name}\n`;
        if (s.profile?.approxAge) section += `年龄：${s.profile.approxAge}\n`;
        if (s.profile?.location) section += `籍贯：${s.profile.location}\n`;

        if (s.narratives && s.narratives.length > 0) {
            for (const n of s.narratives) {
                section += `\n【${n.theme}】${n.title}\n${n.content}\n`;
                if (n.keyFacts?.length > 0) {
                    section += `关键事实：${n.keyFacts.join('；')}\n`;
                }
            }
        }
        if (s.emotionalNote) {
            section += `\n情感状态：${s.emotionalNote}\n`;
        }
        return section;
    }).join('\n');

    // 5. 拼接记忆档案
    let memoryText = '';
    if (memoryProfile) {
        memoryText = '\n\n=== 记忆档案 ===\n';

        if (memoryProfile.people?.length > 0) {
            memoryText += '\n【人物】\n';
            for (const p of memoryProfile.people) {
                memoryText += `- ${p.name}（${p.relation}）：${p.details || p.mentionedIn || ''}\n`;
            }
        }

        if (memoryProfile.places?.length > 0) {
            memoryText += '\n【地点】\n';
            for (const p of memoryProfile.places) {
                memoryText += `- ${p.name}：${p.context || ''}\n`;
            }
        }

        if (memoryProfile.events?.length > 0) {
            memoryText += '\n【事件】\n';
            for (const e of memoryProfile.events) {
                memoryText += `- ${e.time}：${e.description}（情感强度：${e.emotionalWeight}）\n`;
            }
        }

        if (memoryProfile.emotions?.length > 0) {
            memoryText += '\n【情感】\n';
            for (const e of memoryProfile.emotions) {
                memoryText += `- ${e.feeling}（触发：${e.trigger || '未知'}）\n`;
            }
        }
    }

    // 6. 构建用户指令
    const userPrompt = `请根据以下素材撰写一本自传。要求章节数在 ${tier.chapterRange[0]}-${tier.chapterRange[1]} 章之间，每章 ${tier.wordsPerChapter[0]}-${tier.wordsPerChapter[1]} 字。

=== 叙事摘要素材 ===
${narrativeText}
${memoryText}

请严格按照 JSON 格式输出。`;

    // 7. 调用 DeepSeek
    console.log(`[自传] 调用 DeepSeek 撰写中...`);

    const response = await deepseekClient.chat.completions.create({
        model: process.env.DEEPSEEK_BIOGRAPHY_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [
            { role: 'system', content: BIOGRAPHY_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
        ],
        temperature: 0.5,
        response_format: { type: 'json_object' },
    });

    const rawContent = response.choices[0].message.content;
    let bioData;

    try {
        bioData = JSON.parse(rawContent);
    } catch (parseErr) {
        const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            bioData = JSON.parse(jsonMatch[1].trim());
        } else {
            throw new Error('无法解析 AI 返回的自传 JSON');
        }
    }

    // 8. 处理章节数据
    const chapters = (bioData.chapters || []).map((ch, i) => ({
        number: ch.number || i + 1,
        title: ch.title || `第${i + 1}章`,
        content: ch.content || '',
    }));

    // 9. 拼接完整文本
    const fullText = `# ${bioData.title || '人生故事'}\n\n` +
        chapters.map(ch => `## 第${ch.number}章 ${ch.title}\n\n${ch.content}`).join('\n\n');

    const wordCount = fullText.length;

    // 10. 存入 CloudBase
    const bioResult = await db.collection('biographies').add({
        userId,
        title: bioData.title || '人生故事',
        tier: tier.name,
        chapters,
        fullText,
        wordCount,
        chapterCount: chapters.length,
        status: 'draft',
        sourceSummaryCount: summaries.length,
        sourceWordCount: totalWordCount,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
    });

    console.log(`[自传] 用户 ${userId} 的自传已生成：《${bioData.title}》（${chapters.length} 章，${wordCount} 字，档次：${tier.name}）`);

    return {
        biographyId: bioResult.id,
        title: bioData.title,
        tier: tier.name,
        chapterCount: chapters.length,
        wordCount,
    };
}

// ==================== 本地音频文件存储 ====================

function ensureAudioDir(userId, sessionId) {
    const audioDir = path.join(AUDIO_ROOT, userId, sessionId, 'audio');
    fs.mkdirSync(audioDir, { recursive: true });
    return audioDir;
}

function saveAudioLocally(userId, sessionId, audioBuffer) {
    const audioDir = ensureAudioDir(userId, sessionId);
    const filename = `${Date.now()}_user.pcm`;
    const filepath = path.join(audioDir, filename);
    fs.writeFileSync(filepath, audioBuffer);
    return filename;
}

// ==================== HTTP 服务器 ====================
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // 健康检查
    if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: '故事坊后端' }));
        return;
    }

    // 用户注册
    if (url.pathname === '/api/register' && req.method === 'POST') {
        try {
            const body = await getRequestBody(req);
            const { phone, name, age } = JSON.parse(body);
            const result = await registerUser(phone, name, age);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // 用户登录
    if (url.pathname === '/api/login' && req.method === 'POST') {
        try {
            const body = await getRequestBody(req);
            const { phone } = JSON.parse(body);
            const result = await loginUser(phone);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // 用户资料
    if (url.pathname.startsWith('/api/user/') && req.method === 'GET') {
        const userId = url.pathname.split('/').pop();
        try {
            const profile = await getUserProfile(userId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(profile));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // 删除用户及所有关联数据
    if (url.pathname.startsWith('/api/user/') && req.method === 'DELETE') {
        const userId = url.pathname.split('/').pop();
        try {
            const result = await deleteUser(userId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, ...result }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // 用户会话列表
    if (url.pathname.startsWith('/api/sessions/') && req.method === 'GET') {
        const userId = url.pathname.split('/').pop();
        try {
            const sessions = await getUserSessions(userId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(sessions));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // 用户对话记录
    if (url.pathname.startsWith('/api/conversations/') && req.method === 'GET') {
        const userId = url.pathname.split('/').pop();
        try {
            const conversations = await getUserConversations(userId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(conversations));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // 用户统计
    if (url.pathname.startsWith('/api/stats/') && req.method === 'GET') {
        const userId = url.pathname.split('/').pop();
        try {
            const stats = await getUserStats(userId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(stats));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // 用户叙事摘要列表
    if (url.pathname.startsWith('/api/summaries/') && req.method === 'GET') {
        const userId = url.pathname.split('/').pop();
        try {
            const result = await db.collection('summaries')
                .where({ userId })
                .orderBy('createdAt', 'desc')
                .get();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.data));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // 用户自传素材（所有叙事摘要合并为可读文本）
    if (url.pathname.startsWith('/api/biography-material/') && req.method === 'GET') {
        const userId = url.pathname.split('/').pop();
        try {
            const result = await db.collection('summaries')
                .where({ userId })
                .orderBy('createdAt', 'asc')
                .get();

            const summaries = result.data;
            if (summaries.length === 0) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ material: '', narrativeCount: 0 }));
                return;
            }

            // 合并所有叙事段落为自传素材文本
            let material = '';
            const allDiscussed = new Set();
            const allUnexplored = new Set();

            for (const s of summaries) {
                for (const n of (s.narratives || [])) {
                    material += `\n\n## ${n.theme}：${n.title}\n\n${n.content}`;
                    if (n.keyFacts?.length > 0) {
                        material += '\n\n关键事实：' + n.keyFacts.join('；');
                    }
                }
                (s.coverage?.discussed || []).forEach(t => allDiscussed.add(t));
                (s.coverage?.unexplored || []).forEach(t => allUnexplored.add(t));
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                material: material.trim(),
                narrativeCount: summaries.reduce((sum, s) => sum + (s.narratives?.length || 0), 0),
                coverage: {
                    discussed: [...allDiscussed],
                    unexplored: [...allUnexplored],
                },
            }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // 获取用户记忆档案
    if (url.pathname.startsWith('/api/memory-profile/') && req.method === 'GET') {
        const userId = url.pathname.split('/').pop();
        try {
            const profile = await getMemoryProfile(userId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(profile || {}));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // 获取或创建用户主题采访档案
    if (url.pathname.startsWith('/api/topic-profile/') && req.method === 'GET') {
        const userId = url.pathname.split('/').pop();
        try {
            const profile = await getOrCreateTopicProfile(userId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(profile));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // 更新当前采访主题
    if (url.pathname.match(/^\/api\/topic-profile\/[^/]+\/current-topic$/) && req.method === 'POST') {
        const userId = url.pathname.split('/')[3];
        try {
            const body = await getRequestBody(req);
            const { topicId } = JSON.parse(body);
            const profile = await updateCurrentTopic(userId, topicId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, profile }));
        } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
    }

    // 获取用户自传列表
    if (url.pathname.match(/^\/api\/biographies\/[^/]+$/) && req.method === 'GET') {
        const userId = url.pathname.split('/').pop();
        try {
            const result = await db.collection('biographies')
                .where({ userId })
                .orderBy('createdAt', 'desc')
                .get();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.data));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // 用户触发生成自传
    if (url.pathname.match(/^\/api\/biographies\/[^/]+\/generate$/) && req.method === 'POST') {
        const userId = url.pathname.split('/')[3];
        try {
            const result = await generateBiography(userId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, ...result }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
    }

    // ==================== 管理员 API ====================

    // 管理员登录
    if (url.pathname === '/api/admin/login' && req.method === 'POST') {
        try {
            const body = await getRequestBody(req);
            const { phone, password } = JSON.parse(body);
            const result = adminLogin(phone, password);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // 以下管理员接口需要 token 验证
    if (url.pathname.startsWith('/api/admin/') && url.pathname !== '/api/admin/login') {
        const token = getAuthHeader(req);
        if (!verifyAdminToken(token)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '未授权，请先登录' }));
            return;
        }

        // 系统统计
        if (url.pathname === '/api/admin/stats' && req.method === 'GET') {
            try {
                const stats = await getAdminStats();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(stats));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // 用户列表（含统计）
        if (url.pathname === '/api/admin/users' && req.method === 'GET') {
            try {
                const users = await getAdminUsers();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(users));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // 删除用户及关联数据
        const deleteMatch = url.pathname.match(/^\/api\/admin\/user\/([^/]+)$/);
        if (deleteMatch && req.method === 'DELETE') {
            try {
                const result = await deleteUser(deleteMatch[1]);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, ...result }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // 用户对话记录
        const convMatch = url.pathname.match(/^\/api\/admin\/user\/([^/]+)\/conversations$/);
        if (convMatch && req.method === 'GET') {
            try {
                const data = await getUserConversations(convMatch[1]);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // 用户叙事摘要
        const summMatch = url.pathname.match(/^\/api\/admin\/user\/([^/]+)\/summaries$/);
        if (summMatch && req.method === 'GET') {
            try {
                const result = await db.collection('summaries')
                    .where({ userId: summMatch[1] })
                    .orderBy('createdAt', 'desc')
                    .get();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result.data));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // 用户自传素材
        const bioMatch = url.pathname.match(/^\/api\/admin\/user\/([^/]+)\/biography-material$/);
        if (bioMatch && req.method === 'GET') {
            try {
                const result = await db.collection('summaries')
                    .where({ userId: bioMatch[1] })
                    .orderBy('createdAt', 'asc')
                    .get();

                const summaries = result.data;
                let material = '';
                const allDiscussed = new Set();
                const allUnexplored = new Set();

                for (const s of summaries) {
                    for (const n of (s.narratives || [])) {
                        material += `\n\n## ${n.theme}：${n.title}\n\n${n.content}`;
                        if (n.keyFacts?.length > 0) {
                            material += '\n\n关键事实：' + n.keyFacts.join('；');
                        }
                    }
                    (s.coverage?.discussed || []).forEach(t => allDiscussed.add(t));
                    (s.coverage?.unexplored || []).forEach(t => allUnexplored.add(t));
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    material: material.trim(),
                    narrativeCount: summaries.reduce((sum, s) => sum + (s.narratives?.length || 0), 0),
                    coverage: {
                        discussed: [...allDiscussed],
                        unexplored: [...allUnexplored],
                    },
                }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // 管理员：获取用户自传列表
        const adminBioMatch = url.pathname.match(/^\/api\/admin\/user\/([^/]+)\/biographies$/);
        if (adminBioMatch && req.method === 'GET') {
            try {
                const result = await db.collection('biographies')
                    .where({ userId: adminBioMatch[1] })
                    .orderBy('createdAt', 'desc')
                    .get();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result.data));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // 管理员：触发生成自传
        const adminBioGenMatch = url.pathname.match(/^\/api\/admin\/user\/([^/]+)\/biographies\/generate$/);
        if (adminBioGenMatch && req.method === 'POST') {
            try {
                const result = await generateBiography(adminBioGenMatch[1]);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, ...result }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
            return;
        }

        // 管理员：删除自传
        const adminBioDelMatch = url.pathname.match(/^\/api\/admin\/biography\/([^/]+)$/);
        if (adminBioDelMatch && req.method === 'DELETE') {
            try {
                await db.collection('biographies').doc(adminBioDelMatch[1]).remove();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // 管理员：查看记忆档案
        const adminMemMatch = url.pathname.match(/^\/api\/admin\/user\/([^/]+)\/memory-profile$/);
        if (adminMemMatch && req.method === 'GET') {
            try {
                const profile = await getMemoryProfile(adminMemMatch[1]);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(profile || {}));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }
    }

    // 静态文件服务（前端页面）
    const staticFiles = {
        '/': { file: 'index.html', type: 'text/html' },
        '/index.html': { file: 'index.html', type: 'text/html' },
        '/style.css': { file: 'style.css', type: 'text/css' },
        '/app.js': { file: 'app.js', type: 'application/javascript' },
        '/admin.html': { file: 'admin.html', type: 'text/html' },
        '/admin.css': { file: 'admin.css', type: 'text/css' },
        '/admin.js': { file: 'admin.js', type: 'application/javascript' },
    };

    if (staticFiles[url.pathname]) {
        const { file, type } = staticFiles[url.pathname];
        const filePath = path.join(__dirname, file);
        try {
            const content = fs.readFileSync(filePath);
            res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
            res.end(content);
        } catch (err) {
            res.writeHead(500);
            res.end('File not found');
        }
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

/**
 * 读取请求体
 */
function getRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

// ==================== 欢迎语逻辑 ====================

/**
 * 检查用户是否有已生成的自传
 */
async function checkHasBiography(userId) {
    try {
        const result = await db.collection('biographies').where({ userId }).limit(1).get();
        return result.data.length > 0;
    } catch (err) {
        return false;
    }
}

/**
 * 根据用户状态生成欢迎语
 * 优先级：有自传 > 就绪可生成 > 新用户/继续聊天
 */
async function getWelcomeText(userId, userName) {
    try {
        // 1. 检查是否有已生成的自传
        const hasBio = await checkHasBiography(userId);
        if (hasBio) {
            return `${userName}，您的人生故事已经写好了！要我念给您听吗？`;
        }

        // 2. 检查就绪度
        const profile = await getMemoryProfile(userId);
        if (profile && isReady(profile)) {
            return `${userName}，您讲的故事已经很完整了，我随时可以帮您整理成书。您想现在就生成吗？或者继续补充也可以。`;
        }

        // 3. 默认欢迎语
        return `您好，${userName}！请继续讲您的故事，我会帮您记录下来。`;
    } catch (err) {
        return `您好，${userName}！请继续讲您的故事。`;
    }
}

// ==================== WebSocket 服务器 ====================
const wss = new WebSocketServer({ server, path: '/ws/chat' });
const sessions = new Map();

wss.on('connection', async (ws) => {
    const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    console.log(`[连接] 客户端 ${sessionId} 已连接`);

    // 初始化会话（暂时不关联用户，等登录后再关联）
    sessions.set(sessionId, {
        ws,
        userId: null,
        currentTopicId: DEFAULT_TOPIC_ID,
        audioChunks: [],
        conversationHistory: [],
        isProcessing: false,
    });

    sendJson(ws, {
        status: 'need_login',
        text: '请先登录或注册',
        sessionId,
    });

    ws.on('message', async (data, isBinary) => {
        const session = sessions.get(sessionId);
        if (!session) return;

        if (isBinary) {
            session.audioChunks.push(data);
        } else {
            try {
                const msg = JSON.parse(data.toString());
                await handleMessage(sessionId, session, msg);
            } catch (e) {
                console.error(`[${sessionId}] JSON 解析失败:`, e);
            }
        }
    });

    ws.on('close', async () => {
        console.log(`[断开] 客户端 ${sessionId}`);
        if (sessions.get(sessionId)?.userId) {
            await endSession(sessionId);
        }
        sessions.delete(sessionId);
    });

    ws.on('error', (err) => {
        console.error(`[${sessionId}] 错误:`, err.message);
    });
});

async function handleMessage(sessionId, session, msg) {
    console.log(`[${sessionId}] 收到指令:`, msg.event || msg.type);

    // 处理登录
    if (msg.type === 'login') {
        const { phone } = msg;
        const result = await loginUser(phone);

        if (result.success) {
            session.userId = result.userId;
            await createSession(sessionId, result.userId);

            const topicProfile = await getOrCreateTopicProfile(result.userId);
            session.currentTopicId = topicProfile.currentTopicId;
            const welcomeText = await getWelcomeText(result.userId, result.name);
            const hasBiography = await checkHasBiography(result.userId);

            sendJson(session.ws, {
                status: 'ready',
                text: welcomeText,
                user: result,
                hasBiography,
                topicProfile,
            });
        } else {
            sendJson(session.ws, {
                status: 'login_failed',
                text: result.message,
            });
        }
        return;
    }

    // 处理注册
    if (msg.type === 'register') {
        const { phone, name, age } = msg;
        const result = await registerUser(phone, name, age);

        if (result.success) {
            session.userId = result.userId;
            await createSession(sessionId, result.userId);

            const topicProfile = await getOrCreateTopicProfile(result.userId);
            session.currentTopicId = topicProfile.currentTopicId;
            sendJson(session.ws, {
                status: 'ready',
                text: `注册成功！您好，${name}！我是故事坊的AI助手，我来帮您把人生故事记录下来。您随便聊，想到什么说什么，我会帮您整理成一本故事书。`,
                user: result,
                hasBiography: false,
                topicProfile,
            });
        } else {
            sendJson(session.ws, {
                status: 'register_failed',
                text: result.message,
            });
        }
        return;
    }

    // 处理主题切换
    if (msg.type === 'select_topic') {
        if (!session.userId) {
            sendJson(session.ws, { status: 'need_login', text: '请先登录' });
            return;
        }

        try {
            const topicProfile = await updateCurrentTopic(session.userId, msg.topicId);
            session.currentTopicId = topicProfile.currentTopicId;
            sendJson(session.ws, {
                event: 'topic_profile_updated',
                status: 'ready',
                topicProfile,
            });
        } catch (err) {
            sendJson(session.ws, {
                event: 'topic_profile_error',
                status: 'ready',
                text: err.message,
            });
        }
        return;
    }

    // 处理语音结束
    if (msg.event === 'user_speech_ended') {
        if (!session.userId) {
            sendJson(session.ws, { status: 'need_login', text: '请先登录' });
            return;
        }

        if (session.isProcessing) {
            console.log(`[${sessionId}] 上一轮还在处理中，跳过`);
            return;
        }

        const audioBuffer = Buffer.concat(session.audioChunks);
        session.audioChunks = [];

        if (audioBuffer.length < 1000) {
            console.log(`[${sessionId}] 音频数据太短，忽略`);
            sendJson(session.ws, { status: 'ready', text: '没有听清，请再说一次。' });
            return;
        }

        console.log(`[${sessionId}] 收到音频 ${(audioBuffer.length / 1024).toFixed(1)} KB`);

        session.isProcessing = true;
        try {
            await processVoiceInteraction(sessionId, session, audioBuffer);
        } catch (err) {
            console.error(`[${sessionId}] 处理失败:`, err);
            sendJson(session.ws, {
                status: 'ready',
                text: '抱歉，处理出错了，请再试一次。',
            });
        } finally {
            session.isProcessing = false;
        }
    }
}

async function processVoiceInteraction(sessionId, session, audioBuffer) {
    const userId = session.userId;

    // ── Step 1: 语音识别 (ASR) ──
    sendJson(session.ws, { status: 'ai_thinking' });
    console.log(`[${sessionId}] Step 1: 语音识别中...`);

    const userText = await recognizeSpeech(audioBuffer);
    if (!userText) {
        sendJson(session.ws, { status: 'ready', text: '没有听清，请再说一次。' });
        return;
    }
    console.log(`[${sessionId}] 识别结果: "${userText}"`);

    const audioFile = saveAudioLocally(userId, sessionId, audioBuffer);

    // ── Step 2: 大模型对话 (混元) ──
    console.log(`[${sessionId}] Step 2: AI 对话中...`);
    const aiReply = await chatWithAI(sessionId, session, userText);
    console.log(`[${sessionId}] AI 回复: "${aiReply}"`);

    const topicProfile = await getOrCreateTopicProfile(userId);
    const selectedTopic = getSelectedTopic(topicProfile, session.currentTopicId);

    await saveConversation(sessionId, userId, {
        userText,
        aiReply,
        audioFile,
        audioSizeKB: Math.round(audioBuffer.length / 1024),
        topicId: selectedTopic?.id || session.currentTopicId || DEFAULT_TOPIC_ID,
        topicTitle: selectedTopic?.title || '',
        topicProgress: selectedTopic?.progress || 0,
    });

    analyzeTopicProgressFromTurn(sessionId, session, userText, aiReply).catch(err => {
        console.error(`[主题分析] 本轮分析失败:`, err.message);
    });

    // ── Step 3: 语音合成 (TTS) ──
    console.log(`[${sessionId}] Step 3: 语音合成中...`);
    sendJson(session.ws, { status: 'ai_speaking', text: aiReply });

    const audioData = await synthesizeSpeech(aiReply);
    if (audioData) {
        session.ws.send(audioData);
        console.log(`[${sessionId}] TTS 音频已发送 ${(audioData.length / 1024).toFixed(1)} KB`);
    }

    sendJson(session.ws, { event: 'ai_response_end', status: 'ready' });
    console.log(`[${sessionId}] 交互完成`);
}

async function recognizeSpeech(audioBuffer) {
    try {
        const audioBase64 = audioBuffer.toString('base64');
        const params = {
            EngSerViceType: '16k_zh',
            SourceType: 1,
            VoiceFormat: 'pcm',
            Data: audioBase64,
            DataLen: audioBuffer.length,
        };
        const result = await asrClient.SentenceRecognition(params);
        return result.Result || null;
    } catch (err) {
        console.error('[ASR] 识别失败:', err.message || err);
        return null;
    }
}

async function chatWithAI(sessionId, session, userText) {
    try {
        session.conversationHistory.push({ Role: 'user', Content: userText });

        if (session.conversationHistory.length > 40) {
            session.conversationHistory = session.conversationHistory.slice(-40);
        }

        const topicProfile = session.userId
            ? await getOrCreateTopicProfile(session.userId)
            : null;
        const topicPrompt = buildTopicInterviewPrompt(
            AI_SYSTEM_PROMPT,
            topicProfile,
            session.currentTopicId,
        );

        const messages = [
            { Role: 'system', Content: topicPrompt },
            ...session.conversationHistory,
        ];

        const params = {
            Model: HUNYUAN_MODEL,
            Messages: messages,
            Temperature: 0.7,
            TopP: 0.9,
        };

        const result = await hunyuanClient.ChatCompletions(params);
        const aiReply = result.Choices?.[0]?.Message?.Content || '抱歉，我没有理解，请再说一次。';

        session.conversationHistory.push({ Role: 'assistant', Content: aiReply });
        return aiReply;
    } catch (err) {
        console.error('[混元] 对话失败:', err.message || err);
        return '抱歉，AI 暂时无法回复，请稍后再试。';
    }
}

function parseJsonObjectFromAI(rawContent) {
    try {
        return JSON.parse(rawContent);
    } catch (parseErr) {
        const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[1].trim());
        }
        throw parseErr;
    }
}

async function analyzeTopicProgressFromTurn(sessionId, session, userText, aiReply) {
    const userId = session.userId;
    if (!userId) return;

    const profile = await getOrCreateTopicProfile(userId);
    const prompt = buildTopicTurnAnalysisPrompt(profile, session.currentTopicId, userText, aiReply);
    if (!prompt) return;

    const response = await deepseekClient.chat.completions.create({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [
            { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
    });

    const rawContent = response.choices[0].message.content;
    const data = parseJsonObjectFromAI(rawContent);
    const topicAnalysis = data.topicAnalysis;
    if (!topicAnalysis) return;

    topicAnalysis.topicId = BIOGRAPHY_TOPICS.some(topic => topic.id === topicAnalysis.topicId)
        ? topicAnalysis.topicId
        : session.currentTopicId || DEFAULT_TOPIC_ID;

    const updatedProfile = await updateTopicProfileFromAnalysis(userId, topicAnalysis);
    if (updatedProfile) {
        sendJson(session.ws, {
            event: 'topic_profile_updated',
            status: 'ready',
            topicProfile: updatedProfile,
        });
        console.log(`[${sessionId}] 主题进度已推送到前端`);
    }
}

async function synthesizeSpeech(text) {
    try {
        const params = {
            Text: text,
            SessionId: `tts_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            VoiceType: 1002,
            Codec: 'mp3',
            SampleRate: 16000,
            Speed: 0.85,
            Volume: 8,
        };
        const result = await ttsClient.TextToVoice(params);
        return result.Audio ? Buffer.from(result.Audio, 'base64') : null;
    } catch (err) {
        console.error('[TTS] 合成失败:', err.message || err);
        return null;
    }
}

function sendJson(ws, obj) {
    if (ws.readyState === 1) {
        ws.send(JSON.stringify(obj));
    }
}

// ==================== 启动服务器 ====================
server.listen(PORT, () => {
    console.log('\n  故事坊后端服务已启动');
    console.log(`  WebSocket: ws://localhost:${PORT}/ws/chat`);
    console.log(`  健康检查: http://localhost:${PORT}/health`);
    console.log(`  AI 模型: ${HUNYUAN_MODEL}`);
    console.log(`  CloudBase 环境: ${process.env.TCB_ENV_ID}`);
    console.log(`  数据存储: 腾讯云 CloudBase + 本地音频\n`);

    if (!SECRET_ID || SECRET_ID === '你的SecretId') {
        console.warn('  ⚠️  请在 .env 文件中配置腾讯云 API 密钥');
        console.warn('  获取地址: https://console.cloud.tencent.com/cam/capi\n');
    }
});
