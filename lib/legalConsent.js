// 模块：法律协议与个人信息处理同意。集中管理协议版本、同意校验和审计记录。

const CURRENT_LEGAL_VERSIONS = Object.freeze({
    agreementVersion: '2026-05-19',
    privacyVersion: '2026-05-19',
    aiDisclaimerVersion: '2026-05-19',
});

const VALID_CONSENT_SOURCES = new Set(['login', 'register', 'set_password']);

function validateConsentInput(consent = {}) {
    if (consent.acceptedLegalTerms !== true) {
        return {
            valid: false,
            message: '请先阅读并同意相关协议后再继续。',
        };
    }

    if (consent.acceptedPersonalInfoProcessing !== true) {
        return {
            valid: false,
            message: '请先同意平台为生成回忆录处理必要的语音、文字和故事信息。',
        };
    }

    return { valid: true, message: '' };
}

function normalizeConsentSource(source) {
    return VALID_CONSENT_SOURCES.has(source) ? source : 'login';
}

function getClientIp(req = {}) {
    const forwardedFor = req.headers?.['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
        return forwardedFor.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || '';
}

function buildConsentRecord({
    userId,
    phone,
    source,
    userAgent = '',
    ip = '',
}) {
    return {
        userId,
        phone,
        ...CURRENT_LEGAL_VERSIONS,
        acceptedTerms: true,
        acceptedPrivacy: true,
        acceptedAiDisclaimer: true,
        acceptedPersonalInfoProcessing: true,
        source: normalizeConsentSource(source),
        userAgent,
        ip,
    };
}

async function recordUserConsent(db, {
    userId,
    phone,
    source,
    userAgent,
    ip,
}) {
    if (!userId || !phone) {
        throw new Error('缺少用户同意记录所需的用户信息');
    }

    const record = buildConsentRecord({
        userId,
        phone,
        source,
        userAgent,
        ip,
    });

    await db.collection('user_consents').add({
        ...record,
        createdAt: db.serverDate(),
    });

    return record;
}

module.exports = {
    CURRENT_LEGAL_VERSIONS,
    buildConsentRecord,
    getClientIp,
    recordUserConsent,
    validateConsentInput,
};
