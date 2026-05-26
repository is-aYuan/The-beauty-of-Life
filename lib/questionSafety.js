const DEFAULT_TOPIC_ID = 'childhood';

const FALLBACK_QUESTIONS = {
    childhood: [
        '您小时候最常跟谁一起玩？是在家附近，还是学校附近？',
        '您小时候最常在哪里玩？',
        '您还记得小时候住的地方是什么样子吗？',
    ],
    parents_home: [
        '小时候家里最让您有印象的一件小事是什么？',
        '那时候家里一天通常是怎么过的？',
        '您记得家里人平时最常忙些什么吗？',
    ],
    default: [
        '您能讲讲那时候最有画面感的一件小事吗？',
        '那时候一天里，您最记得哪个场景？',
        '这件事里，谁让您印象最深？',
    ],
};

const QUESTION_PATTERNS = [
    {
        reason: 'judgment_or_diagnosis',
        patterns: [
            /为什么不愿意/u,
            /是不是.*回避/u,
            /不想谈/u,
            /抗拒/u,
            /逃避/u,
        ],
    },
    {
        reason: 'identity_probe',
        patterns: [
            /男孩还是女孩/u,
            /男是女/u,
            /是男.*女/u,
            /性别/u,
            /什么民族/u,
            /哪个民族/u,
            /多大年纪/u,
            /哪年出生/u,
            /籍贯/u,
        ],
    },
    {
        reason: 'leading_assumption',
        patterns: [
            /是不是.*辛苦/u,
            /一定.*难过/u,
            /一定.*不容易/u,
            /肯定.*难受/u,
            /应该.*很苦/u,
        ],
    },
    {
        reason: 'machine_analysis',
        patterns: [
            /用户/u,
            /素材不足/u,
            /主题进度/u,
            /没有谈到/u,
            /未谈到/u,
            /回避/u,
            /分析/u,
            /缺失/u,
        ],
    },
    {
        reason: 'abrupt_privacy',
        patterns: [
            /收入/u,
            /工资/u,
            /生病/u,
            /疾病/u,
            /去世/u,
            /丧偶/u,
            /离婚/u,
            /家庭矛盾/u,
        ],
    },
];

const STAGE_DIRECTION_PATTERNS = [
    /（[^（）]*(?:笑|微笑|眼神|鼓励|点头|摇头|轻声|温和|停顿|沉默|叹气|表情|语气|动作|看着|望着|眨眼|拍拍|握住)[^（）]*）/gu,
    /\([^()]*(?:笑|微笑|眼神|鼓励|点头|摇头|轻声|温和|停顿|沉默|叹气|表情|语气|动作|看着|望着|眨眼|拍拍|握住)[^()]*\)/gu,
    /【[^【】]*(?:笑|微笑|眼神|鼓励|点头|摇头|轻声|温和|停顿|沉默|叹气|表情|语气|动作|看着|望着|眨眼|拍拍|握住)[^【】]*】/gu,
    /\[[^\[\]]*(?:笑|微笑|眼神|鼓励|点头|摇头|轻声|温和|停顿|沉默|叹气|表情|语气|动作|看着|望着|眨眼|拍拍|握住)[^\[\]]*\]/gu,
];

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeTopicId(input = {}) {
    const topicId = normalizeText(input.currentTopicId || input.topicId);
    return topicId || DEFAULT_TOPIC_ID;
}

function pickFallbackQuestion(topicId, reason) {
    const list = FALLBACK_QUESTIONS[topicId] || FALLBACK_QUESTIONS.default;

    if (reason === 'leading_assumption' && topicId === 'parents_home') {
        return '您记得家里人平时最常忙些什么吗？';
    }

    return list[0] || FALLBACK_QUESTIONS.default[0];
}

function detectUnsafeQuestion(question) {
    for (const group of QUESTION_PATTERNS) {
        if (group.patterns.some((pattern) => pattern.test(question))) {
            return group.reason;
        }
    }

    return '';
}

function stripQuestionNoise(question) {
    return normalizeText(question)
        .replace(/\s+/gu, ' ')
        .replace(/^[：:，,。！？\s]+/u, '')
        .trim();
}

function stripStageDirections(question) {
    let cleaned = question;
    for (const pattern of STAGE_DIRECTION_PATTERNS) {
        cleaned = cleaned.replace(pattern, '');
    }

    return stripQuestionNoise(cleaned)
        .replace(/\s*([，。！？；：,.!?;:])\s*/gu, '$1')
        .replace(/([，,])([。！？!?])/gu, '$2')
        .trim();
}

// 模块：老人端追问安全层。所有模型/数据库来的追问先过这里，再进入朗读和展示。
function normalizeQuestionForElder(input = {}) {
    const originalQuestion = normalizeText(input.question);
    const question = stripQuestionNoise(originalQuestion);
    const topicId = normalizeTopicId(input);

    if (!question) {
        return {
            question: pickFallbackQuestion(topicId, 'empty'),
            changed: true,
            reason: 'empty',
            originalQuestion,
        };
    }

    const spokenQuestion = stripStageDirections(question);
    if (spokenQuestion !== question) {
        if (!spokenQuestion) {
            return {
                question: pickFallbackQuestion(topicId, 'stage_direction'),
                changed: true,
                reason: 'stage_direction',
                originalQuestion,
            };
        }

        return {
            question: spokenQuestion,
            changed: true,
            reason: 'stage_direction',
            originalQuestion,
        };
    }

    const reason = detectUnsafeQuestion(question);
    if (reason) {
        return {
            question: pickFallbackQuestion(topicId, reason),
            changed: true,
            reason,
            originalQuestion,
        };
    }

    return {
        question,
        changed: false,
        reason: '',
        originalQuestion,
    };
}

module.exports = {
    normalizeQuestionForElder,
};
