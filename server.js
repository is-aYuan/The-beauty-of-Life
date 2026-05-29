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
const {
    deleteCollectionDocsByUserId,
    deleteUserAudioFiles,
} = require('./lib/userDeletion');
const {
    createAuthToken,
    hashPassword,
    validatePassword,
    verifyAuthToken,
    verifyPassword,
} = require('./lib/authPassword');
const {
    buildPublicUserProfile,
    normalizeUserProfileUpdate,
} = require('./lib/userProfile');
const {
    buildAdminUserListItem,
    validateAdminCreateUserInput,
    validateAdminDeleteUserInput,
    validateAdminUpdateUserInput,
} = require('./lib/adminUserManagement');
const {
    validateAccountDeletionInput,
} = require('./lib/accountDeletion');
const {
    buildArchiveView,
} = require('./lib/archiveView');
const {
    buildBiographyUserPrompt,
    validateBiographyIdentity,
} = require('./lib/biographyPrompt');
const {
    buildAnsweredRecommendationQuestionTurn,
    buildRecommendationConversationRecord,
    normalizeRecommendationQuestion,
} = require('./lib/recommendationQuestion');
const {
    buildWelcomeText,
} = require('./lib/welcomeText');
const {
    buildSessionEntryGuidance,
} = require('./lib/sessionEntryGuidance');
const {
    buildAnsweredEntryGuidanceTurn,
} = require('./lib/entryGuidanceTurn');
const {
    buildTopicTransitionPrompt,
    parseTopicTransitionChoice,
} = require('./lib/topicTransitionPrompt');
const {
    buildAnsweredTopicSwitchOpeningTurn,
    buildTopicSwitchOpening,
} = require('./lib/topicSwitchOpening');
const {
    normalizeQuestionForElder,
} = require('./lib/questionSafety');
const {
    buildBiographyGenerationDecision,
    getLatestBiography,
} = require('./lib/biographyGeneration');
const {
    buildBiographyExportFileName,
    buildBiographyExportModel,
    createBiographyExportBuffer,
    getBiographyExportContentType,
    normalizeBiographyExportFormat,
} = require('./lib/biographyExport');
const {
    buildAdminTopicProfileResponse,
} = require('./lib/adminTopicProfile');
const {
    getBiographyStyle,
} = require('./lib/biographyStyles');
const {
    DEFAULT_USER_PREFERENCES,
    getUserPreferences,
    normalizeUserPreferences,
    saveUserPreferences,
    speechRateToTtsSpeed,
} = require('./lib/userPreferences');
const {
    getProviderConfig,
    getProviderSummary,
} = require('./lib/providerConfig');
const {
    createAiProvider,
} = require('./lib/ai');
const {
    createVoiceProvider,
} = require('./lib/voice');
const {
    createUsageRecorder,
} = require('./lib/usage/usageRecorder');
const {
    recognizeLongFormSpeech,
} = require('./lib/voice/longFormRecognition');
const {
    getClientIp,
    recordUserConsent,
    validateConsentInput,
} = require('./lib/legalConsent');

const PROVIDER_CONFIG = getProviderConfig(process.env);

// ==================== CloudBase 初始化 ====================
const cloudbase = require('@cloudbase/node-sdk');

const tcbApp = cloudbase.init({
    env: process.env.TCB_ENV_ID,
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
});

const db = tcbApp.database();
const _ = db.command; // 数据库操作符
const usageRecorder = createUsageRecorder({ db });
console.log('[CloudBase] 云数据库已连接');

// ==================== 腾讯云 SDK 导入 ====================
const AsrClient = require('tencentcloud-sdk-nodejs-asr').asr.v20190614.Client;
const HunyuanClient = require('tencentcloud-sdk-nodejs-hunyuan').hunyuan.v20230901.Client;
const TtsClient = require('tencentcloud-sdk-nodejs-tts').tts.v20190823.Client;

// ==================== 配置 ====================
const PORT = 8000;
const SECRET_ID = PROVIDER_CONFIG.tencent.secretId;
const SECRET_KEY = PROVIDER_CONFIG.tencent.secretKey;
const REGION = PROVIDER_CONFIG.tencent.region;
const AI_SYSTEM_PROMPT = process.env.AI_SYSTEM_PROMPT || '你是故事坊的AI助手，专门帮助老年人记录家庭故事和记忆。请用温暖、耐心、简洁的语气回复，每次回复不超过100字。鼓励老人继续讲述，适当提问引导。只输出老人能直接听到的话，严禁输出括号旁白、动作描写、神态描写、心理描写或舞台说明，例如“（温和地笑着）”“【点头】”。';
const AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || SECRET_KEY || 'story-workshop-dev-secret';

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

// ==================== AI/语音供应商路由 ====================
const aiProvider = createAiProvider(PROVIDER_CONFIG, {
    hunyuanClient,
});

const voiceProvider = createVoiceProvider(PROVIDER_CONFIG, {
    asrClient,
    ttsClient,
    speechRateToTtsSpeed,
});

console.log('[Provider] 当前模型供应商配置:', getProviderSummary(PROVIDER_CONFIG));

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
    "name": "只有当用户明确说“我叫X”“我的名字是X”“我是X”时才填写；不要把朋友、同学、家人、故事中的人物姓名当作用户姓名；如果不确定，必须留空",
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

7. **用户姓名识别必须保守**：只有用户明确说“我叫X”“我的名字是X”“我是X”时，profile.name 才能填写。不要把朋友、同学、家人、故事中的人物姓名当作用户姓名。如果不确定，必须留空。

## 记忆档案提取规则

8. **people 字段**：记录用户提到的每一个人，不仅是亲属，包括家人、朋友、同事、邻居、老师、领导等。mentionedIn 必须是用户原话片段。

9. **places 字段**：记录用户提到的每一个具体地名，包括出生地、居住地、工作地点、学校、医院等。

10. **events 字段**：记录用户提到的每一个具体事件。emotionalWeight 判断标准：high=语速变化/停顿/重复提及/感叹词，medium=正常叙述有情感色彩，low=平淡提及。

11. **emotions 字段**：记录用户表达的每一种情感，不要猜测，只记录有明确表达依据的。

## 就绪度判断规则

12. **timeline**：true=能梳理出从出生到现在的大致人生轨迹，false=时间线有大段空白。

13. **keyPeople**：true=至少提到了父母、配偶、子女中的两类，false=只提到了一类或没有。

14. **depth**：true=至少有一个话题讲了3轮以上或有超过200字的连续叙述，false=所有话题浅尝辄止。

15. **stories**：true=至少有一个包含时间、地点、人物、经过的完整故事，false=只有概括性描述。

16. **emotions**：true=至少有一次表达过内心感受、反思、遗憾、珍惜等深层情感，false=只是客观叙述。

## 主题素材进度判断规则

17. topicAnalysis 只评估输入中提供的“当前会话主要主题”。不要为其他主题打分。

18. progress 按五个维度评分，每个维度最高 20 分：基础事实、具体事件、细节画面、情绪感受、人生影响。总分为 0-100 的整数。

19. 如果用户没有讲到实质故事，progress 可以保持较低，不要为了显得完整而抬高分数。

20. personProfileUpdates 只记录用户自然说出的基础档案。不要为了补齐字段而猜测。`;

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
async function registerUser(phone, name, age, password) {
    // 检查手机号是否已注册
    const existing = await db.collection('users').where({ phone }).get();
    if (existing.data.length > 0) {
        return { success: false, message: '该手机号已注册' };
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        return { success: false, message: passwordValidation.message };
    }
    const { passwordHash, passwordSalt } = hashPassword(password);

    // 创建用户
    const result = await db.collection('users').add({
        phone,
        name,
        age: age || null,
        passwordHash,
        passwordSalt,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
        status: 'active',
    });

    console.log(`[用户] 注册成功: ${name} (${phone})`);
    return {
        success: true,
        userId: result.id,
        phone,
        name,
        authToken: createAuthToken({ userId: result.id, phone }, AUTH_TOKEN_SECRET),
    };
}

/**
 * 用户登录
 * 使用手机号登录，返回用户信息
 */
async function loginUser(phone, password) {
    const result = await db.collection('users').where({ phone, status: 'active' }).get();
    if (result.data.length === 0) {
        return { success: false, message: '手机号或密码错误' };
    }

    const user = result.data[0];
    if (!user.passwordHash || !user.passwordSalt) {
        return {
            success: false,
            needSetPassword: true,
            phone: user.phone,
            name: user.name,
            message: '为了保护您的回忆资料，请先设置登录密码',
        };
    }

    if (!verifyPassword(password, user.passwordHash, user.passwordSalt)) {
        return { success: false, message: '手机号或密码错误' };
    }

    console.log(`[用户] 登录成功: ${user.name} (${phone})`);
    return {
        success: true,
        userId: user._id,
        phone: user.phone,
        name: user.name,
        age: user.age,
        authToken: createAuthToken({ userId: user._id, phone: user.phone }, AUTH_TOKEN_SECRET),
    };
}

/**
 * 老用户首次设置密码
 */
async function setUserPassword(phone, password) {
    const result = await db.collection('users').where({ phone, status: 'active' }).get();
    if (result.data.length === 0) {
        return { success: false, message: '用户不存在' };
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
        return { success: false, message: validation.message };
    }

    const user = result.data[0];
    if (user.passwordHash && user.passwordSalt) {
        return { success: false, message: '该账号已设置密码，请直接登录' };
    }

    const { passwordHash, passwordSalt } = hashPassword(password);
    await db.collection('users').doc(user._id).update({
        passwordHash,
        passwordSalt,
        updatedAt: db.serverDate(),
    });

    console.log(`[用户] 已设置登录密码: ${user.name} (${phone})`);
    return {
        success: true,
        userId: user._id,
        phone: user.phone,
        name: user.name,
        age: user.age,
        authToken: createAuthToken({ userId: user._id, phone: user.phone }, AUTH_TOKEN_SECRET),
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
 * 更新用户可编辑资料
 * 只允许修改姓名和年龄，手机号仍作为登录唯一值保留只读。
 */
async function updateUserProfile(userId, input) {
    const validation = normalizeUserProfileUpdate(input);
    if (!validation.valid) {
        return { success: false, message: validation.message };
    }

    const existing = await getUserProfile(userId);
    if (!existing || existing.status !== 'active') {
        return { success: false, message: '用户不存在或已停用' };
    }

    await db.collection('users').doc(userId).update({
        ...validation.value,
        updatedAt: db.serverDate(),
    });

    const updated = {
        ...existing,
        ...validation.value,
    };
    console.log(`[用户] 资料已更新: ${updated.name} (${updated.phone})`);

    return buildPublicUserProfile(updated);
}

/**
 * 管理员新增用户
 * 复用普通注册的密码散列和手机号唯一校验，但由管理员输入校验先收紧字段。
 */
async function createAdminUser(input) {
    const validation = validateAdminCreateUserInput(input);
    if (!validation.valid) {
        return { success: false, message: validation.message };
    }

    return registerUser(
        validation.value.phone,
        validation.value.name,
        validation.value.age,
        validation.value.password,
    );
}

/**
 * 管理员编辑用户资料
 * 第一版只开放姓名和年龄，手机号继续作为登录唯一标识保持只读。
 */
async function updateAdminUser(userId, input) {
    const validation = validateAdminUpdateUserInput(input);
    if (!validation.valid) {
        return { success: false, message: validation.message };
    }

    const existing = await getUserProfile(userId);
    if (!existing || existing.status !== 'active') {
        return { success: false, message: '用户不存在或已停用' };
    }

    await db.collection('users').doc(userId).update({
        ...validation.value,
        updatedAt: db.serverDate(),
    });

    return {
        success: true,
        user: buildAdminUserListItem({
            ...existing,
            ...validation.value,
            updatedAt: new Date().toISOString(),
        }),
    };
}

/**
 * 删除用户及其所有关联数据（级联删除）
 * 清理集合：conversations → summaries → memory_profiles → topic_profiles → biographies → sessions → user_preferences → user_consents → users
 * 同时清理本地音频文件：data/records/{userId}
 */
async function deleteUser(userId) {
    const deletedConversations = await deleteCollectionDocsByUserId(db, 'conversations', userId);
    console.log(`[删除] 已清理 ${deletedConversations} 条对话记录`);

    const deletedSummaries = await deleteCollectionDocsByUserId(db, 'summaries', userId);
    console.log(`[删除] 已清理 ${deletedSummaries} 条叙事摘要`);

    const deletedMemoryProfiles = await deleteCollectionDocsByUserId(db, 'memory_profiles', userId);
    console.log(`[删除] 已清理 ${deletedMemoryProfiles} 条记忆档案`);

    const deletedTopicProfiles = await deleteCollectionDocsByUserId(db, 'topic_profiles', userId);
    console.log(`[删除] 已清理 ${deletedTopicProfiles} 条主题档案`);

    const deletedBiographies = await deleteCollectionDocsByUserId(db, 'biographies', userId);
    console.log(`[删除] 已清理 ${deletedBiographies} 条成品自传`);

    const deletedSessions = await deleteCollectionDocsByUserId(db, 'sessions', userId);
    console.log(`[删除] 已清理 ${deletedSessions} 条会话记录`);

    const deletedPreferences = await deleteCollectionDocsByUserId(db, 'user_preferences', userId);
    console.log(`[删除] 已清理 ${deletedPreferences} 条用户偏好`);

    const deletedConsents = await deleteCollectionDocsByUserId(db, 'user_consents', userId);
    console.log(`[删除] 已清理 ${deletedConsents} 条用户同意记录`);

    const audioResult = deleteUserAudioFiles(AUDIO_ROOT, userId);
    console.log(`[删除] 本地音频目录${audioResult.deletedAudioDir ? '已清理' : '不存在'}: ${audioResult.audioDir}`);

    await db.collection('users').doc(userId).remove();
    console.log(`[删除] 用户 ${userId} 已删除`);

    return {
        deletedConversations,
        deletedSummaries,
        deletedMemoryProfiles,
        deletedTopicProfiles,
        deletedBiographies,
        deletedSessions,
        deletedPreferences,
        deletedConsents,
        deletedAudioDir: audioResult.deletedAudioDir,
        deletedUser: true,
    };
}

/**
 * 注销本人账号
 * 复用级联删除能力，但在执行前强制校验登录密码和确认文本。
 */
async function deleteOwnAccount(userId, input) {
    const validation = validateAccountDeletionInput(input);
    if (!validation.valid) {
        return { success: false, message: validation.message };
    }

    const existing = await getUserProfile(userId);
    if (!existing || existing.status !== 'active') {
        return { success: false, message: '用户不存在或已停用' };
    }

    if (!existing.passwordHash || !existing.passwordSalt) {
        return { success: false, message: '请先设置登录密码后再注销账号' };
    }

    if (!verifyPassword(validation.value.password, existing.passwordHash, existing.passwordSalt)) {
        return { success: false, message: '密码错误' };
    }

    const deletion = await deleteUser(userId);
    return { success: true, ...deletion };
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
        .orderBy('timestamp', 'desc')
        .limit(200)
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

async function getUserSummaries(userId) {
    const result = await db.collection('summaries')
        .where({ userId })
        .orderBy('createdAt', 'desc')
        .get();
    return result.data;
}

async function getMyArchiveView(userId) {
    const [conversations, summaries, memoryProfile, topicProfile] = await Promise.all([
        getUserConversations(userId),
        getUserSummaries(userId),
        getMemoryProfile(userId),
        getOrCreateTopicProfile(userId),
    ]);

    return buildArchiveView({
        conversations,
        summaries,
        memoryProfile,
        topicProfile,
    });
}

async function getUserBiographies(userId) {
    const result = await db.collection('biographies')
        .where({ userId })
        .orderBy('createdAt', 'desc')
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
        const summaryModel = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
        const usageStartTime = Date.now();
        const response = await deepseekClient.chat.completions.create({
            model: summaryModel,
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
        await recordOpenAICompatibleUsage({
            userId,
            sessionId,
            provider: 'deepseek',
            model: summaryModel,
            operation: 'summary',
            response,
            startTime: usageStartTime,
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
        await usageRecorder.recordUsage({
            userId,
            sessionId,
            provider: 'deepseek',
            model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
            operation: 'summary',
            status: 'failed',
            errorMessage: err.message || String(err),
        });
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
 * 模块：用户统计读取。用 count 获取真实总数，分页读取仅用于累计音频大小，避免 CloudBase get 默认页大小造成 100 条上限。
 */
async function fetchUserConversationAudioStats(userId) {
    const batchSize = 100;
    let offset = 0;
    let totalAudioKB = 0;

    while (true) {
        const result = await db.collection('conversations')
            .where({ userId })
            .skip(offset)
            .limit(batchSize)
            .get();
        const records = result.data || [];
        if (records.length === 0) break;

        totalAudioKB += records.reduce((sum, c) => sum + (c.audioSizeKB || 0), 0);
        if (records.length < batchSize) break;
        offset += batchSize;
    }

    return { totalAudioKB };
}

async function getUserStats(userId) {
    const [sessions, conversations, audioStats] = await Promise.all([
        db.collection('sessions').where({ userId }).count(),
        db.collection('conversations').where({ userId }).count(),
        fetchUserConversationAudioStats(userId),
    ]);

    const totalSessions = sessions.total || 0;
    const totalConversations = conversations.total || 0;

    // 计算总音频时长（根据音频大小估算，16kHz 16bit = 32KB/s）
    const totalAudioKB = audioStats.totalAudioKB;
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

function mapOpenAICompatibleUsage(usage = {}) {
    return {
        inputTokens: usage.prompt_tokens || 0,
        cachedInputTokens: usage.prompt_cache_hit_tokens || usage.cached_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
    };
}

async function recordOpenAICompatibleUsage({
    userId = null,
    sessionId = null,
    provider,
    model,
    operation,
    response,
    startTime,
    status = 'success',
    errorMessage = '',
}) {
    await usageRecorder.recordUsage({
        userId,
        sessionId,
        provider,
        model,
        operation,
        ...mapOpenAICompatibleUsage(response?.usage),
        status,
        errorMessage,
        latencyMs: startTime ? Date.now() - startTime : 0,
    });
}

function getVoiceUsageProvider() {
    return `${voiceProvider.name}_voice`;
}

function getAsrUsageModel() {
    if (voiceProvider.name === 'doubao') return PROVIDER_CONFIG.doubaoSpeech.asrResourceId;
    return 'tencent-sentence-recognition';
}

function getTtsUsageModel() {
    if (voiceProvider.name === 'doubao') return PROVIDER_CONFIG.doubaoSpeech.ttsResourceId;
    return 'tencent-text-to-voice';
}

async function getAdminStats() {
    const [users, sessions, conversations, summaries] = await Promise.all([
        db.collection('users').count(),
        db.collection('sessions').count(),
        db.collection('conversations').count(),
        db.collection('summaries').count(),
    ]);

    return {
        totalUsers: users.total || 0,
        totalSessions: sessions.total || 0,
        totalConversations: conversations.total || 0,
        totalSummaries: summaries.total || 0,
    };
}

async function getAdminUsers() {
    const users = await db.collection('users').get();
    const result = [];

    for (const user of users.data) {
        const sessCount = await db.collection('sessions').where({ userId: user._id }).count();
        const convCount = await db.collection('conversations').where({ userId: user._id }).count();
        const summCount = await db.collection('summaries').where({ userId: user._id }).count();

        result.push(buildAdminUserListItem(user, {
            sessionCount: sessCount.total || 0,
            conversationCount: convCount.total || 0,
            summaryCount: summCount.total || 0,
            lastActiveAt: user.updatedAt || user.createdAt || null,
        }));
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
async function generateBiography(userId, options = {}) {
    const enforceProgressGate = options.enforceProgressGate !== false;
    const biographyStyle = getBiographyStyle(options.style);
    console.log(`[自传] 开始为用户 ${userId} 生成自传...`);

    const topicProfile = await getOrCreateTopicProfile(userId);
    const existingBiographies = await getUserBiographies(userId);
    if (enforceProgressGate) {
        const generationDecision = buildBiographyGenerationDecision({
            topics: topicProfile.topics,
            biographies: existingBiographies,
        });

        if (!generationDecision.canGenerate) {
            const err = new Error(generationDecision.message);
            err.statusCode = 400;
            throw err;
        }
    }

    // 1. 获取所有叙事摘要
    const summaries = await getUserSummaries(userId);
    if (summaries.length === 0) {
        throw new Error('该用户暂无叙事摘要，无法生成自传');
    }

    // 2. 获取记忆档案
    const memoryProfile = await getMemoryProfile(userId);
    const userProfile = await getUserProfile(userId);
    const accountName = userProfile?.name || '';
    if (!accountName) {
        throw new Error('该用户缺少账号姓名，无法生成自传');
    }

    // 3. 计算素材总量
    const totalWordCount = summaries.reduce((sum, s) => sum + (s.sessionWordCount || 0), 0);
    const tier = getBiographyTier(totalWordCount);

    console.log(`[自传] 素材量: ${totalWordCount} 字，档次: ${tier.name}`);

    // 4. 构建用户指令。账号姓名是传主身份最高优先级，摘要里的姓名只能作为低可信参考。
    const userPrompt = buildBiographyUserPrompt({
        accountName,
        styleId: biographyStyle.id,
        tier,
        summaries,
        memoryProfile,
    });

    // 7. 调用 DeepSeek
    console.log(`[自传] 调用 DeepSeek 撰写中...`);

    const biographyModel = process.env.DEEPSEEK_BIOGRAPHY_MODEL || 'deepseek-v4-pro';
    const usageStartTime = Date.now();
    const response = await deepseekClient.chat.completions.create({
        model: biographyModel,
        messages: [
            { role: 'system', content: BIOGRAPHY_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
        ],
        temperature: biographyStyle.temperature,
        top_p: biographyStyle.topP,
        response_format: { type: 'json_object' },
    });
    await recordOpenAICompatibleUsage({
        userId,
        provider: 'deepseek',
        model: biographyModel,
        operation: 'biography',
        response,
        startTime: usageStartTime,
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

    const identityValidation = validateBiographyIdentity({ accountName, bioData });
    if (!identityValidation.valid) {
        const err = new Error(identityValidation.error);
        err.statusCode = 502;
        throw err;
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

    const biographyPayload = {
        userId,
        title: bioData.title || '人生故事',
        tier: tier.name,
        style: biographyStyle.id,
        styleLabel: biographyStyle.label,
        styleDescription: biographyStyle.description,
        chapters,
        fullText,
        wordCount,
        chapterCount: chapters.length,
        status: 'draft',
        sourceSummaryCount: summaries.length,
        sourceWordCount: totalWordCount,
        updatedAt: db.serverDate(),
    };

    // 10. 存入 CloudBase。用户端和管理员端共用 biographies，同一用户默认更新最新一版。
    const latestBiography = getLatestBiography(existingBiographies);
    let biographyId;
    if (latestBiography?._id) {
        biographyId = latestBiography._id;
        await db.collection('biographies').doc(biographyId).update(biographyPayload);
    } else {
        const bioResult = await db.collection('biographies').add({
            ...biographyPayload,
            createdAt: db.serverDate(),
        });
        biographyId = bioResult.id || bioResult._id;
    }

    console.log(`[自传] 用户 ${userId} 的自传已生成：《${bioData.title}》（${chapters.length} 章，${wordCount} 字，档次：${tier.name}）`);

    return {
        biographyId,
        title: bioData.title,
        tier: tier.name,
        style: biographyStyle.id,
        styleLabel: biographyStyle.label,
        chapterCount: chapters.length,
        wordCount,
    };
}

// 模块：回忆录下载导出。只读取已生成 biographies，不触发 AI 生成，也不写入数据库。
function buildContentDisposition(filename) {
    const fallback = 'memoir-download';
    return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

async function sendBiographyExport(res, userId, formatValue) {
    const format = normalizeBiographyExportFormat(formatValue);
    if (!format) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '不支持的回忆录下载格式' }));
        return;
    }

    const [biographies, userProfile] = await Promise.all([
        getUserBiographies(userId),
        getUserProfile(userId),
    ]);
    const latestBiography = getLatestBiography(biographies);
    if (!latestBiography) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '还没有可下载的回忆录，请先生成最新回忆录。' }));
        return;
    }

    const exportModel = buildBiographyExportModel({
        biography: latestBiography,
        userProfile,
    });
    const fileName = buildBiographyExportFileName(exportModel, format);
    const fileBuffer = await createBiographyExportBuffer(exportModel, format);

    res.writeHead(200, {
        'Content-Type': getBiographyExportContentType(format),
        'Content-Length': fileBuffer.length,
        'Content-Disposition': buildContentDisposition(fileName),
        'Cache-Control': 'no-store',
    });
    res.end(fileBuffer);
}

function parseJsonBody(rawBody) {
    if (!rawBody) return {};
    try {
        return JSON.parse(rawBody);
    } catch {
        return {};
    }
}

function getBearerToken(req) {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : '';
}

function verifyUserRequest(req, userId) {
    const token = getBearerToken(req);
    if (!token) {
        return { valid: false, message: '请先登录' };
    }

    const tokenResult = verifyAuthToken(token, AUTH_TOKEN_SECRET);
    if (!tokenResult.valid || tokenResult.payload.userId !== userId) {
        return { valid: false, message: '登录已过期，请重新登录' };
    }

    return { valid: true, authToken: token, payload: tokenResult.payload };
}

function buildConsentMetadataFromRequest(req, source) {
    return {
        source,
        userAgent: req.headers['user-agent'] || '',
        ip: getClientIp(req),
    };
}

function sendConsentError(res, validation) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: validation.message, consentRequired: true }));
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
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
            const { phone, name, age, password, consent } = parseJsonBody(await getRequestBody(req));
            const consentValidation = validateConsentInput(consent);
            if (!consentValidation.valid) {
                sendConsentError(res, consentValidation);
                return;
            }

            const result = await registerUser(phone, name, age, password);
            if (result.success) {
                await recordUserConsent(db, {
                    userId: result.userId,
                    phone: result.phone,
                    ...buildConsentMetadataFromRequest(req, 'register'),
                });
            }
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
            const { phone, password, consent } = parseJsonBody(await getRequestBody(req));
            const consentValidation = validateConsentInput(consent);
            if (!consentValidation.valid) {
                sendConsentError(res, consentValidation);
                return;
            }

            const result = await loginUser(phone, password);
            if (result.success) {
                await recordUserConsent(db, {
                    userId: result.userId,
                    phone: result.phone,
                    ...buildConsentMetadataFromRequest(req, 'login'),
                });
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // 老用户首次设置密码
    if (url.pathname === '/api/users/set-password' && req.method === 'POST') {
        try {
            const { phone, password, consent } = parseJsonBody(await getRequestBody(req));
            const consentValidation = validateConsentInput(consent);
            if (!consentValidation.valid) {
                sendConsentError(res, consentValidation);
                return;
            }

            const result = await setUserPassword(phone, password);
            if (result.success) {
                await recordUserConsent(db, {
                    userId: result.userId,
                    phone: result.phone,
                    ...buildConsentMetadataFromRequest(req, 'set_password'),
                });
            }
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

    // 用户资料更新：只允许本人修改姓名和年龄，手机号保持只读。
    if (url.pathname.match(/^\/api\/user\/[^/]+\/profile$/) && req.method === 'POST') {
        const userId = url.pathname.split('/')[3];
        const auth = verifyUserRequest(req, userId);
        if (!auth.valid) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: auth.message }));
            return;
        }

        try {
            const body = parseJsonBody(await getRequestBody(req));
            const result = await updateUserProfile(userId, body);
            if (result.success) {
                result.authToken = auth.authToken;
            }
            res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: err.message }));
        }
        return;
    }

    // 账号注销：只允许本人通过登录态、密码和确认文本删除自己的全部资料。
    if (url.pathname.match(/^\/api\/user\/[^/]+\/delete-account$/) && req.method === 'POST') {
        const userId = url.pathname.split('/')[3];
        const auth = verifyUserRequest(req, userId);
        if (!auth.valid) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: auth.message }));
            return;
        }

        try {
            const body = parseJsonBody(await getRequestBody(req));
            const result = await deleteOwnAccount(userId, body);
            res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: err.message }));
        }
        return;
    }

    // 用户个性化设置：朗读语速、字体大小
    if (url.pathname.match(/^\/api\/user-preferences\/[^/]+$/) && req.method === 'GET') {
        const userId = url.pathname.split('/').pop();
        try {
            const preferences = await getUserPreferences(db, userId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, preferences }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
    }

    if (url.pathname.match(/^\/api\/user-preferences\/[^/]+$/) && req.method === 'POST') {
        const userId = url.pathname.split('/').pop();
        try {
            const body = parseJsonBody(await getRequestBody(req));
            const preferences = await saveUserPreferences(db, userId, body.preferences || body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, preferences }));
        } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
    }

    // 普通用户删除入口必须走账号注销流程，避免裸 DELETE 误删资料。
    if (url.pathname.match(/^\/api\/user\/[^/]+$/) && req.method === 'DELETE') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: '请使用账号注销流程' }));
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

    // AI整理：用户端回忆资料小报
    if (url.pathname.startsWith('/api/my-archive/') && req.method === 'GET') {
        const userId = url.pathname.split('/').pop();
        try {
            const archive = await getMyArchiveView(userId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(archive));
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
            const summaries = await getUserSummaries(userId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(summaries));
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
            const biographies = await getUserBiographies(userId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(biographies));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // GET /api/biographies/[^/]+/export：下载已生成回忆录，不重新调用 AI。
    const biographyExportMatch = url.pathname.match(/^\/api\/biographies\/([^/]+)\/export$/);
    if (biographyExportMatch && req.method === 'GET') {
        const userId = biographyExportMatch[1];
        try {
            await sendBiographyExport(res, userId, url.searchParams.get('format'));
        } catch (err) {
            res.writeHead(err.statusCode || 500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message || '回忆录下载失败，请稍后再试。' }));
        }
        return;
    }

    // 用户触发生成自传
    if (url.pathname.match(/^\/api\/biographies\/[^/]+\/generate$/) && req.method === 'POST') {
        const userId = url.pathname.split('/')[3];
        try {
            const body = parseJsonBody(await getRequestBody(req));
            const result = await generateBiography(userId, { style: body.style });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, ...result }));
        } catch (err) {
            res.writeHead(err.statusCode || 500, { 'Content-Type': 'application/json' });
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

        // API 用量与成本监控
        if (url.pathname === '/api/admin/usage' && req.method === 'GET') {
            try {
                const range = url.searchParams.get('range') || '7d';
                const usage = await usageRecorder.getAdminUsage({ range });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(usage));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
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

        // 管理员新增用户
        if (url.pathname === '/api/admin/users' && req.method === 'POST') {
            try {
                const body = parseJsonBody(await getRequestBody(req));
                const result = await createAdminUser(body);
                res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: err.message }));
            }
            return;
        }

        // 管理员编辑用户资料
        const updateAdminUserMatch = url.pathname.match(/^\/api\/admin\/user\/([^/]+)$/);
        if (updateAdminUserMatch && req.method === 'PATCH') {
            try {
                const body = parseJsonBody(await getRequestBody(req));
                const result = await updateAdminUser(updateAdminUserMatch[1], body);
                res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: err.message }));
            }
            return;
        }

        // 删除用户及关联数据
        const deleteMatch = url.pathname.match(/^\/api\/admin\/user\/([^/]+)$/);
        if (deleteMatch && req.method === 'DELETE') {
            try {
                const body = parseJsonBody(await getRequestBody(req));
                const validation = validateAdminDeleteUserInput(body);
                if (!validation.valid) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: validation.message }));
                    return;
                }
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

        // 管理员：获取用户主题采访进度
        const topicProfileMatch = url.pathname.match(/^\/api\/admin\/user\/([^/]+)\/topic-profile$/);
        if (topicProfileMatch && req.method === 'GET') {
            try {
                const userId = topicProfileMatch[1];
                const profile = await getOrCreateTopicProfile(userId);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(buildAdminTopicProfileResponse(profile, userId)));
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
                const biographies = await getUserBiographies(adminBioMatch[1]);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(biographies));
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
                const body = parseJsonBody(await getRequestBody(req));
                const result = await generateBiography(adminBioGenMatch[1], {
                    enforceProgressGate: false,
                    style: body.style,
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, ...result }));
            } catch (err) {
                res.writeHead(err.statusCode || 500, { 'Content-Type': 'application/json' });
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

        // 2. 检查就绪度
        const profile = await getMemoryProfile(userId);

        return buildWelcomeText({
            userName,
            hasBiography: hasBio,
            isReady: !!(profile && isReady(profile)),
        });
    } catch (err) {
        return `您好，${userName}！请继续讲您的故事。`;
    }
}

async function buildEntryGuidanceForUser(userId, userName, topicProfile) {
    const [conversations, summaries] = await Promise.all([
        getUserConversations(userId),
        getUserSummaries(userId),
    ]);

    const entryGuidance = buildSessionEntryGuidance({
        userName,
        topicProfile,
        conversations,
        summaries,
        totalConversations: conversations.length,
    });

    let currentTopicProfile = topicProfile;
    const shouldSyncTopic = entryGuidance.topicId &&
        entryGuidance.topicId !== topicProfile.currentTopicId &&
        BIOGRAPHY_TOPICS.some((topic) => topic.id === entryGuidance.topicId);

    if (shouldSyncTopic) {
        currentTopicProfile = await updateCurrentTopic(userId, entryGuidance.topicId);
    }

    return {
        entryGuidance,
        topicProfile: currentTopicProfile,
    };
}

// 模块：入口引导语音播放。欢迎/续聊朗读只发送音频，不写 conversation，避免污染回忆录素材。
async function speakEntryGuidance(sessionId, session, entryGuidance) {
    if (!entryGuidance?.shouldAutoSpeak || !entryGuidance.speechText) return;
    if (!shouldSpeakForSession(session)) return;

    const audioData = await synthesizeSpeech(entryGuidance.speechText, session.userPreferences, {
        userId: session.userId,
        sessionId,
    });
    if (audioData && session.ws.readyState === 1) {
        session.ws.send(audioData);
        console.log(`[${sessionId}] 入口引导 TTS 音频已发送 ${(audioData.length / 1024).toFixed(1)} KB`);
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
        currentVoiceTurn: null,
        conversationHistory: [],
        pendingEntryGuidance: null,
        pendingRecommendationQuestion: null,
        pendingTopicOpening: null,
        topicTransitionPrompt: null,
        topicTransitionSuppressTurns: 0,
        richTopicPromptedTopicIds: new Set(),
        inputMode: 'voice',
        userPreferences: { ...DEFAULT_USER_PREFERENCES },
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
            if (session.currentVoiceTurn) {
                session.currentVoiceTurn.audioBytes += data.length;
            }
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

    // 语音轮次开始：清空上一轮残留音频，给本轮识别建立稳定边界。
    if (msg.event === 'user_speech_started') {
        if (!session.userId) {
            sendJson(session.ws, { status: 'need_login', text: '请先登录' });
            return;
        }

        const mode = msg.mode === 'table' ? 'table' : 'hold';
        const turnId = typeof msg.turnId === 'string' && msg.turnId
            ? msg.turnId
            : `${sessionId}_${Date.now().toString(36)}`;

        session.inputMode = 'voice';
        session.audioChunks = [];
        session.currentVoiceTurn = {
            turnId,
            mode,
            startedAt: Date.now(),
            audioBytes: 0,
        };
        return;
    }

    // 输入模式切换：文本模式不需要麦克风，也不接收后续 TTS 音频。
    if (msg.type === 'set_input_mode') {
        session.inputMode = normalizeInputMode(msg.inputMode);
        if (session.inputMode === 'text') {
            session.audioChunks = [];
            session.currentVoiceTurn = null;
        }
        sendJson(session.ws, {
            event: 'input_mode_updated',
            status: 'ready',
            inputMode: session.inputMode,
        });
        return;
    }

    // 处理登录
    if (msg.type === 'login') {
        const { phone, password, authToken } = msg;
        let result;

        if (authToken) {
            const tokenResult = verifyAuthToken(authToken, AUTH_TOKEN_SECRET);
            if (!tokenResult.valid || tokenResult.payload.phone !== phone) {
                sendJson(session.ws, {
                    status: 'login_failed',
                    text: '登录已过期，请重新登录',
                });
                return;
            }
            result = {
                success: true,
                userId: tokenResult.payload.userId,
                phone: tokenResult.payload.phone,
                name: '',
            };
        } else {
            result = await loginUser(phone, password);
        }

        if (result.success) {
            const userProfile = await getUserProfile(result.userId);
            if (!userProfile || userProfile.status !== 'active') {
                sendJson(session.ws, {
                    status: 'login_failed',
                    text: '登录已过期，请重新登录',
                });
                return;
            }
            result.name = userProfile.name;
            result.age = userProfile.age;
            session.userId = result.userId;
            session.userPreferences = await getUserPreferences(db, result.userId);
            await createSession(sessionId, result.userId);

            let topicProfile = await getOrCreateTopicProfile(result.userId);
            const entry = await buildEntryGuidanceForUser(result.userId, result.name, topicProfile);
            topicProfile = entry.topicProfile;
            session.currentTopicId = topicProfile.currentTopicId;
            session.pendingEntryGuidance = entry.entryGuidance;
            session.pendingTopicOpening = null;
            const hasBiography = await checkHasBiography(result.userId);

            sendJson(session.ws, {
                status: 'ready',
                text: entry.entryGuidance.displayText,
                user: result,
                hasBiography,
                topicProfile,
                entryGuidance: entry.entryGuidance,
                preferences: session.userPreferences,
            });
            speakEntryGuidance(sessionId, session, entry.entryGuidance).catch((err) => {
                console.error(`[${sessionId}] 入口引导朗读失败:`, err.message || err);
            });
        } else {
            sendJson(session.ws, {
                status: 'login_failed',
                text: result.message,
                needSetPassword: result.needSetPassword || false,
            });
        }
        return;
    }

    // 处理注册
    if (msg.type === 'register') {
        const { phone, name, age, password } = msg;
        const result = await registerUser(phone, name, age, password);

        if (result.success) {
            session.userId = result.userId;
            session.userPreferences = normalizeUserPreferences(msg.userPreferences);
            await createSession(sessionId, result.userId);
            session.userPreferences = await saveUserPreferences(db, result.userId, session.userPreferences);

            let topicProfile = await getOrCreateTopicProfile(result.userId);
            const entry = await buildEntryGuidanceForUser(result.userId, name, topicProfile);
            topicProfile = entry.topicProfile;
            session.currentTopicId = topicProfile.currentTopicId;
            session.pendingEntryGuidance = entry.entryGuidance;
            session.pendingTopicOpening = null;
            sendJson(session.ws, {
                status: 'ready',
                text: entry.entryGuidance.displayText,
                user: result,
                hasBiography: false,
                topicProfile,
                entryGuidance: entry.entryGuidance,
                preferences: session.userPreferences,
            });
            speakEntryGuidance(sessionId, session, entry.entryGuidance).catch((err) => {
                console.error(`[${sessionId}] 入口引导朗读失败:`, err.message || err);
            });
        } else {
            sendJson(session.ws, {
                status: 'register_failed',
                text: result.message,
            });
        }
        return;
    }

    // 处理富主题换题提示的按钮选择。
    if (msg.type === 'topic_transition_choice') {
        await handleTopicTransitionChoice(sessionId, session, msg.choice || '', msg.topicId || '');
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
            session.topicTransitionPrompt = null;
            session.pendingTopicOpening = null;
            session.pendingEntryGuidance = null;
            session.pendingRecommendationQuestion = null;
            session.topicTransitionSuppressTurns = 0;
            session.conversationHistory = [];

            const opening = buildTopicSwitchOpening({
                topicProfile,
                topicId: topicProfile.currentTopicId,
            });

            sendJson(session.ws, {
                event: 'topic_profile_updated',
                status: 'ready',
                topicProfile,
            });
            await speakTopicSwitchOpening(sessionId, session, opening);
        } catch (err) {
            sendJson(session.ws, {
                event: 'topic_profile_error',
                status: 'ready',
                text: err.message,
            });
        }
        return;
    }

    // 处理个性化设置更新。前端已本地即时生效，这里负责同步云端与当前 TTS 会话。
    if (msg.type === 'update_preferences') {
        if (!session.userId) {
            sendJson(session.ws, { status: 'need_login', text: '请先登录' });
            return;
        }

        try {
            session.userPreferences = await saveUserPreferences(db, session.userId, msg.preferences);
            sendJson(session.ws, {
                event: 'preferences_updated',
                status: 'ready',
                preferences: session.userPreferences,
                syncVersion: msg.syncVersion,
            });
        } catch (err) {
            sendJson(session.ws, {
                event: 'preferences_error',
                status: 'ready',
                text: err.message || '设置保存失败，请稍后再试。',
            });
        }
        return;
    }

    // AI整理推荐问题：作为正式 AI 提问记录保存，并朗读给老人听。
    if (msg.type === 'start_recommendation_question') {
        if (!session.userId) {
            sendJson(session.ws, { status: 'need_login', text: '请先登录' });
            return;
        }

        if (session.isProcessing) {
            console.log(`[${sessionId}] 上一轮还在处理中，跳过推荐问题`);
            return;
        }

        session.isProcessing = true;
        try {
            await startRecommendationQuestion(sessionId, session, msg);
        } catch (err) {
            console.error(`[${sessionId}] 推荐问题处理失败:`, err);
            sendJson(session.ws, {
                status: 'ready',
                text: err.message || '推荐问题播放失败，请稍后再试。',
            });
        } finally {
            session.isProcessing = false;
        }
        return;
    }

    // 文本输入：复用语音识别之后的同一条对话管线，但跳过 ASR/TTS。
    if (msg.type === 'user_text_message') {
        if (!session.userId) {
            sendJson(session.ws, { status: 'need_login', text: '请先登录' });
            return;
        }

        if (session.isProcessing) {
            console.log(`[${sessionId}] 上一轮还在处理中，跳过文本输入`);
            return;
        }

        const userText = normalizeTypedUserText(msg.text);
        if (!userText) {
            sendJson(session.ws, {
                event: 'text_input_error',
                status: 'ready',
                text: '请先输入想说的话。',
            });
            return;
        }

        session.inputMode = 'text';
        session.audioChunks = [];
        session.currentVoiceTurn = null;
        session.isProcessing = true;
        try {
            await processTypedInteraction(sessionId, session, userText);
        } catch (err) {
            console.error(`[${sessionId}] 文本处理失败:`, err);
            sendJson(session.ws, {
                event: 'text_input_error',
                status: 'ready',
                text: '抱歉，处理出错了，请再试一次。',
            });
        } finally {
            session.isProcessing = false;
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

        const voiceTurn = session.currentVoiceTurn;
        if (msg.turnId && voiceTurn?.turnId && msg.turnId !== voiceTurn.turnId) {
            console.log(`[${sessionId}] 收到旧语音轮次 ${msg.turnId}，当前轮次 ${voiceTurn.turnId}，已忽略`);
            return;
        }

        const turnMeta = {
            turnId: msg.turnId || voiceTurn?.turnId || null,
            mode: msg.mode || voiceTurn?.mode || 'hold',
        };

        const audioBuffer = Buffer.concat(session.audioChunks);
        session.audioChunks = [];
        session.currentVoiceTurn = null;

        if (audioBuffer.length < 1000) {
            console.log(`[${sessionId}] 音频数据太短，忽略`);
            sendJson(session.ws, {
                event: 'user_transcript_failed',
                turnId: turnMeta.turnId,
                mode: turnMeta.mode,
                text: '没有听清，请再说一次。',
            });
            sendJson(session.ws, { status: 'ready', text: '没有听清，请再说一次。' });
            return;
        }

        console.log(`[${sessionId}] 收到音频 ${(audioBuffer.length / 1024).toFixed(1)} KB，约 ${(audioBuffer.length / 32000).toFixed(1)} 秒`);

        session.isProcessing = true;
        try {
            await processVoiceInteraction(sessionId, session, audioBuffer, turnMeta);
        } catch (err) {
            console.error(`[${sessionId}] 处理失败:`, err);
            sendJson(session.ws, {
                event: 'user_transcript_failed',
                turnId: turnMeta.turnId,
                mode: turnMeta.mode,
                text: '抱歉，处理出错了，请再试一次。',
            });
            sendJson(session.ws, {
                status: 'ready',
                text: '抱歉，处理出错了，请再试一次。',
            });
        } finally {
            session.isProcessing = false;
        }
    }
}

function appendSessionHistory(session, message) {
    session.conversationHistory.push(message);
    if (session.conversationHistory.length > 40) {
        session.conversationHistory = session.conversationHistory.slice(-40);
    }
}

function decrementTopicTransitionSuppressTurns(session) {
    if (session.topicTransitionSuppressTurns > 0) {
        session.topicTransitionSuppressTurns -= 1;
    }
}

// 模块：输入模式。后端只关心“是否需要朗读”，具体 UI 由前端自行切换。
function normalizeInputMode(value) {
    return value === 'text' ? 'text' : 'voice';
}

function shouldSpeakForSession(session, inputMode = session.inputMode) {
    return normalizeInputMode(inputMode) !== 'text';
}

function normalizeTypedUserText(value) {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, 2000);
}

// 模块：富主题换题提示。后端拥有主题进度和当前主题状态，因此在这里统一决定是否提示。
async function maybePromptTopicTransition(sessionId, session, topicProfile) {
    if (!session.userId || !topicProfile) return false;

    const prompt = buildTopicTransitionPrompt({
        topicProfile,
        promptedTopicIds: session.richTopicPromptedTopicIds,
        suppressTurns: session.topicTransitionSuppressTurns,
    });
    if (!prompt.shouldPrompt) return false;

    session.topicTransitionPrompt = prompt;
    session.richTopicPromptedTopicIds.add(prompt.currentTopicId);
    appendSessionHistory(session, { Role: 'assistant', Content: prompt.text });
    const shouldSpeak = shouldSpeakForSession(session);

    sendJson(session.ws, {
        event: 'topic_transition_prompt',
        status: shouldSpeak ? 'ai_speaking' : 'ready',
        text: prompt.text,
        transition: prompt,
    });

    if (!shouldSpeak) return true;

    const audioData = await synthesizeSpeech(prompt.text, session.userPreferences, {
        userId: session.userId,
        sessionId,
    });
    if (audioData) {
        session.ws.send(audioData);
        console.log(`[${sessionId}] 富主题换题提示 TTS 音频已发送 ${(audioData.length / 1024).toFixed(1)} KB`);
    }
    sendJson(session.ws, { event: 'ai_response_end', status: 'ready' });
    return true;
}

// 模块：换题后的新主题开场。只在成功切换主题后触发，确保下一问来自新主题而不是旧上下文。
async function speakTopicSwitchOpening(sessionId, session, opening) {
    if (!opening?.text) return false;

    session.pendingTopicOpening = opening;
    const shouldSpeak = shouldSpeakForSession(session);
    sendJson(session.ws, {
        event: 'topic_switch_opening',
        status: shouldSpeak ? 'ai_speaking' : 'ready',
        text: opening.text,
        opening,
    });

    if (!shouldSpeak) return true;

    const audioData = await synthesizeSpeech(opening.text, session.userPreferences, {
        userId: session.userId,
        sessionId,
    });
    if (audioData) {
        session.ws.send(audioData);
        console.log(`[${sessionId}] 换题开场 TTS 音频已发送 ${(audioData.length / 1024).toFixed(1)} KB`);
    }
    sendJson(session.ws, { event: 'ai_response_end', status: 'ready' });
    return true;
}

async function handleTopicTransitionChoice(sessionId, session, choiceText, explicitTopicId = '') {
    if (!session.userId || !session.topicTransitionPrompt) return false;

    const profile = await getOrCreateTopicProfile(session.userId);
    const parsed = explicitTopicId
        ? { intent: 'switch', topicId: explicitTopicId }
        : parseTopicTransitionChoice(choiceText, profile.topics);

    if (parsed.intent === 'continue' || parsed.intent === 'unknown') {
        session.topicTransitionPrompt = null;
        session.pendingTopicOpening = null;
        session.topicTransitionSuppressTurns = 3;
        sendJson(session.ws, {
            event: 'topic_transition_resolved',
            status: 'ready',
            choice: 'continue',
            text: '好的，我们继续讲这个主题。',
        });
        return true;
    }

    if (parsed.intent === 'review') {
        session.topicTransitionPrompt = null;
        session.pendingTopicOpening = null;
        session.topicTransitionSuppressTurns = 3;
        sendJson(session.ws, {
            event: 'topic_transition_resolved',
            status: 'ready',
            choice: 'review',
            text: '好的，您可以去回忆库看看整理好的内容。',
        });
        return true;
    }

    if (parsed.intent === 'switch') {
        const targetTopicId = parsed.topicId || session.topicTransitionPrompt.nextTopicId;
        if (!targetTopicId) {
            session.topicTransitionPrompt = null;
            session.pendingTopicOpening = null;
            sendJson(session.ws, {
                event: 'topic_transition_resolved',
                status: 'ready',
                choice: 'review',
                text: '所有主题都已经很丰富了，您可以继续补充，也可以去回忆库看看。',
            });
            return true;
        }

        try {
            const topicProfile = await updateCurrentTopic(session.userId, targetTopicId);
            session.currentTopicId = topicProfile.currentTopicId;
            session.topicTransitionPrompt = null;
            session.topicTransitionSuppressTurns = 0;
            session.conversationHistory = [];
            const opening = buildTopicSwitchOpening({
                topicProfile,
                topicId: topicProfile.currentTopicId,
            });
            sendJson(session.ws, {
                event: 'topic_transition_resolved',
                status: 'ready',
                choice: 'switch',
                topicProfile,
                text: opening?.text || '好的，我们换个话题继续聊。',
            });
            sendJson(session.ws, {
                event: 'topic_profile_updated',
                status: 'ready',
                topicProfile,
            });
            await speakTopicSwitchOpening(sessionId, session, opening);
            console.log(`[${sessionId}] 富主题换题到 ${topicProfile.currentTopicId}`);
            return true;
        } catch (err) {
            sendJson(session.ws, {
                event: 'topic_transition_resolved',
                status: 'ready',
                choice: 'error',
                text: err.message || '换题失败，请稍后再试。',
            });
            return false;
        }
    }

    return false;
}

async function processVoiceInteraction(sessionId, session, audioBuffer, turnMeta = {}) {
    const userId = session.userId;

    // ── Step 1: 语音识别 (ASR) ──
    sendJson(session.ws, { status: 'ai_thinking' });
    console.log(`[${sessionId}] Step 1: 语音识别中...`);

    const asrStartTime = Date.now();
    const userText = await recognizeLongFormSpeech(audioBuffer, async (chunk, chunkMeta) => {
        if (chunkMeta.total > 1) {
            console.log(`[${sessionId}] 长语音分段识别 ${chunkMeta.index + 1}/${chunkMeta.total}，${(chunk.length / 1024).toFixed(1)} KB`);
        }
        return recognizeSpeech(chunk);
    });
    await usageRecorder.recordUsage({
        userId,
        sessionId,
        provider: getVoiceUsageProvider(),
        model: getAsrUsageModel(),
        operation: 'asr',
        audioSeconds: audioBuffer.length / 32000,
        status: userText ? 'success' : 'failed',
        latencyMs: Date.now() - asrStartTime,
    });
    if (!userText) {
        sendJson(session.ws, {
            event: 'user_transcript_failed',
            turnId: turnMeta.turnId,
            mode: turnMeta.mode,
            text: '没有听清，请再说一次。',
        });
        sendJson(session.ws, { status: 'ready', text: '没有听清，请再说一次。' });
        return;
    }
    console.log(`[${sessionId}] 识别结果: "${userText}"`);
    sendJson(session.ws, {
        event: 'user_transcript',
        turnId: turnMeta.turnId,
        mode: turnMeta.mode,
        text: userText,
    });

    const audioFile = saveAudioLocally(userId, sessionId, audioBuffer);
    await processUserTextInteraction(sessionId, session, {
        userText,
        inputMode: 'voice',
        shouldSpeak: true,
        audioFile,
        audioSizeKB: Math.round(audioBuffer.length / 1024),
    });
}

async function processTypedInteraction(sessionId, session, userText) {
    sendJson(session.ws, { status: 'ai_thinking' });
    await processUserTextInteraction(sessionId, session, {
        userText,
        inputMode: 'text',
        shouldSpeak: false,
        audioFile: null,
        audioSizeKB: 0,
    });
}

// 模块：统一文本对话管线。语音 ASR 后和手动打字都会进入这里，保证主题进度、换题和入库规则一致。
async function processUserTextInteraction(sessionId, session, {
    userText,
    inputMode,
    shouldSpeak,
    audioFile,
    audioSizeKB,
}) {
    const userId = session.userId;

    if (session.topicTransitionPrompt) {
        const topicProfile = await getOrCreateTopicProfile(userId);
        const parsedChoice = parseTopicTransitionChoice(userText, topicProfile.topics);
        if (parsedChoice.intent !== 'unknown') {
            await handleTopicTransitionChoice(sessionId, session, userText, parsedChoice.topicId);
            return;
        }

        // 用户直接继续讲故事时，不强行追问选择；按“继续当前主题”处理并进入正常 AI 对话。
        session.topicTransitionPrompt = null;
        session.topicTransitionSuppressTurns = 4;
        sendJson(session.ws, {
            event: 'topic_transition_resolved',
            status: 'ai_thinking',
            choice: 'continue',
            text: '好的，我们继续讲这个主题。',
        });
    }

    const answeredEntryGuidance = buildAnsweredEntryGuidanceTurn(session.pendingEntryGuidance);
    const answeredTopicOpening = buildAnsweredTopicSwitchOpeningTurn(session.pendingTopicOpening);
    const answeredRecommendationQuestion = buildAnsweredRecommendationQuestionTurn(session.pendingRecommendationQuestion);
    const answeredPrompt = answeredRecommendationQuestion || answeredTopicOpening || answeredEntryGuidance;
    const promptSource = answeredPrompt?.promptSource || null;

    // ── Step 2: 大模型对话 (混元) ──
    console.log(`[${sessionId}] Step 2: AI 对话中...`);
    const aiReply = await chatWithAI(sessionId, session, userText, { answeredPrompt });
    console.log(`[${sessionId}] AI 回复: "${aiReply}"`);

    const topicProfile = await getOrCreateTopicProfile(userId);
    const selectedTopic = getSelectedTopic(topicProfile, session.currentTopicId);

    await saveConversation(sessionId, userId, {
        ...(answeredPrompt || {}),
        userText,
        aiReply,
        inputMode,
        audioFile,
        audioSizeKB,
        topicId: selectedTopic?.id || session.currentTopicId || DEFAULT_TOPIC_ID,
        topicTitle: selectedTopic?.title || '',
        topicProgress: selectedTopic?.progress || 0,
    });
    if (promptSource === 'entry_guidance') {
        session.pendingEntryGuidance = null;
    }
    if (promptSource === 'topic_switch_opening') {
        session.pendingTopicOpening = null;
    }
    if (promptSource === 'archive_recommendation') {
        session.pendingRecommendationQuestion = null;
    }
    decrementTopicTransitionSuppressTurns(session);

    if (shouldSpeak) {
        // ── Step 3: 语音合成 (TTS) ──
        console.log(`[${sessionId}] Step 3: 语音合成中...`);
        sendJson(session.ws, { status: 'ai_speaking', text: aiReply });

        const audioData = await synthesizeSpeech(aiReply, session.userPreferences);
        if (audioData) {
            session.ws.send(audioData);
            console.log(`[${sessionId}] TTS 音频已发送 ${(audioData.length / 1024).toFixed(1)} KB`);
        }

        sendJson(session.ws, { event: 'ai_response_end', status: 'ready' });
    } else {
        sendJson(session.ws, {
            event: 'ai_text_response',
            status: 'ready',
            text: aiReply,
        });
    }

    analyzeTopicProgressFromTurn(sessionId, session, userText, aiReply).catch(err => {
        console.error(`[主题分析] 本轮分析失败:`, err.message);
    });
    console.log(`[${sessionId}] 交互完成`);
}

async function startRecommendationQuestion(sessionId, session, msg) {
    const userId = session.userId;
    const recommendation = normalizeRecommendationQuestion(msg);

    const topicProfile = await updateCurrentTopic(userId, recommendation.topicId);
    session.currentTopicId = topicProfile.currentTopicId;
    const selectedTopic = getSelectedTopic(topicProfile, session.currentTopicId);

    const record = buildRecommendationConversationRecord({
        recommendation,
        selectedTopic,
    });
    const safeQuestion = normalizeQuestionForElder({
        question: record.aiReply,
        currentTopicId: record.topicId,
        topicTitle: record.topicTitle,
        source: 'archive_recommendation',
    });
    record.aiReply = safeQuestion.question;

    session.pendingEntryGuidance = null;
    session.topicTransitionPrompt = null;
    session.pendingTopicOpening = null;

    session.pendingRecommendationQuestion = {
        topicId: record.topicId,
        question: record.aiReply,
        title: record.recommendation.title,
        sourceType: record.recommendation.sourceType,
        sourceId: record.recommendation.sourceId,
    };
    session.conversationHistory.push({ Role: 'assistant', Content: record.aiReply });
    if (session.conversationHistory.length > 40) {
        session.conversationHistory = session.conversationHistory.slice(-40);
    }

    sendJson(session.ws, {
        event: 'topic_profile_updated',
        status: 'ready',
        topicProfile,
    });

    const shouldSpeak = shouldSpeakForSession(session);
    sendJson(session.ws, {
        event: 'recommendation_question_started',
        status: shouldSpeak ? 'ai_speaking' : 'ready',
        text: record.aiReply,
        recommendation: session.pendingRecommendationQuestion,
    });

    if (!shouldSpeak) return;

    const audioData = await synthesizeSpeech(record.aiReply, session.userPreferences, {
        userId,
        sessionId,
    });
    if (audioData) {
        session.ws.send(audioData);
        console.log(`[${sessionId}] 推荐问题 TTS 音频已发送 ${(audioData.length / 1024).toFixed(1)} KB`);
    }

    sendJson(session.ws, { event: 'ai_response_end', status: 'ready' });
}

async function recognizeSpeech(audioBuffer) {
    try {
        return await voiceProvider.recognizeSpeech(audioBuffer);
    } catch (err) {
        console.error(`[ASR:${voiceProvider.name}] 识别失败:`, err.message || err);
        return null;
    }
}

async function chatWithAI(sessionId, session, userText, options = {}) {
    try {
        const answeredPrompt = options.answeredPrompt || options.answeredEntryGuidance;
        if (answeredPrompt?.aiPromptText) {
            session.conversationHistory.push({
                Role: 'assistant',
                Content: answeredPrompt.aiPromptText,
            });
        }
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
        const pendingQuestionPrompt = session.pendingRecommendationQuestion
            ? `\n\n## 上一句 AI 推荐追问\n\n${session.pendingRecommendationQuestion.question}\n\n用户正在回答这个推荐问题，请自然承接，不要重复问同一句。`
            : '';

        const messages = [
            { Role: 'system', Content: `${topicPrompt}${pendingQuestionPrompt}` },
            ...session.conversationHistory,
        ];

        const usageStartTime = Date.now();
        const aiResult = await aiProvider.completeChat({
            messages,
            temperature: 0.7,
            topP: 0.9,
        });
        await usageRecorder.recordUsage({
            userId: session.userId,
            sessionId,
            provider: aiResult?.provider || aiProvider.name,
            model: aiResult?.model || '',
            operation: 'chat',
            ...(aiResult?.usage || {}),
            inputContextTokens: aiResult?.usage?.inputTokens || 0,
            status: 'success',
            latencyMs: Date.now() - usageStartTime,
        });
        let aiReply = aiResult?.text || aiResult || '抱歉，我没有理解，请再说一次。';
        const selectedTopic = topicProfile ? getSelectedTopic(topicProfile, session.currentTopicId) : null;
        const safeReply = normalizeQuestionForElder({
            question: aiReply,
            currentTopicId: selectedTopic?.id || session.currentTopicId,
            topicTitle: selectedTopic?.title || '',
            source: 'hunyuan_reply',
        });
        aiReply = safeReply.question;

        session.conversationHistory.push({ Role: 'assistant', Content: aiReply });
        if (session.pendingRecommendationQuestion) {
            session.pendingRecommendationQuestion = null;
        }
        return aiReply;
    } catch (err) {
        await usageRecorder.recordUsage({
            userId: session.userId,
            sessionId,
            provider: aiProvider.name,
            operation: 'chat',
            status: 'failed',
            errorMessage: err.message || String(err),
        });
        console.error(`[${aiProvider.name}] 对话失败:`, err.message || err);
        if (session.pendingRecommendationQuestion) {
            session.pendingRecommendationQuestion = null;
        }
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

    const topicAnalysisModel = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    const usageStartTime = Date.now();
    const response = await deepseekClient.chat.completions.create({
        model: topicAnalysisModel,
        messages: [
            { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
    });
    await recordOpenAICompatibleUsage({
        userId,
        sessionId,
        provider: 'deepseek',
        model: topicAnalysisModel,
        operation: 'topic_analysis',
        response,
        startTime: usageStartTime,
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
        await maybePromptTopicTransition(sessionId, session, updatedProfile);
    }
}

async function synthesizeSpeech(text, userPreferences = DEFAULT_USER_PREFERENCES, usageContext = {}) {
    const usageStartTime = Date.now();
    try {
        const audioData = await voiceProvider.synthesizeSpeech(text, userPreferences);
        await usageRecorder.recordUsage({
            userId: usageContext.userId || null,
            sessionId: usageContext.sessionId || null,
            provider: getVoiceUsageProvider(),
            model: getTtsUsageModel(),
            operation: 'tts',
            ttsChars: String(text || '').length,
            outputAudioKB: audioData ? Math.round(audioData.length / 1024) : 0,
            status: audioData ? 'success' : 'failed',
            latencyMs: Date.now() - usageStartTime,
        });
        return audioData;
    } catch (err) {
        await usageRecorder.recordUsage({
            userId: usageContext.userId || null,
            sessionId: usageContext.sessionId || null,
            provider: getVoiceUsageProvider(),
            model: getTtsUsageModel(),
            operation: 'tts',
            ttsChars: String(text || '').length,
            status: 'failed',
            errorMessage: err.message || String(err),
            latencyMs: Date.now() - usageStartTime,
        });
        console.error(`[TTS:${voiceProvider.name}] 合成失败:`, err.message || err);
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
    console.log(`  AI Provider: ${PROVIDER_CONFIG.llmProvider}`);
    console.log(`  语音 Provider: ${PROVIDER_CONFIG.voiceProvider}`);
    console.log(`  混元模型: ${PROVIDER_CONFIG.tencent.hunyuanModel}`);
    console.log(`  方舟接入点: ${PROVIDER_CONFIG.ark.chatModel || '未配置'}`);
    console.log(`  CloudBase 环境: ${process.env.TCB_ENV_ID}`);
    console.log(`  数据存储: 腾讯云 CloudBase + 本地音频\n`);

    if (PROVIDER_CONFIG.voiceProvider === 'tencent' && (!SECRET_ID || SECRET_ID === '你的SecretId')) {
        console.warn('  ⚠️  请在 .env 文件中配置腾讯云 API 密钥');
        console.warn('  获取地址: https://console.cloud.tencent.com/cam/capi\n');
    }
});
