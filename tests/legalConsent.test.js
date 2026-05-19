const test = require('node:test');
const assert = require('node:assert/strict');

const {
    CURRENT_LEGAL_VERSIONS,
    buildConsentRecord,
    getClientIp,
    recordUserConsent,
    validateConsentInput,
} = require('../lib/legalConsent');

function createMockConsentDb() {
    const adds = [];
    return {
        adds,
        serverDate() {
            return 'SERVER_DATE';
        },
        collection(collectionName) {
            assert.equal(collectionName, 'user_consents');
            return {
                async add(payload) {
                    adds.push(payload);
                    return { id: `consent_${adds.length}` };
                },
            };
        },
    };
}

test('rejects missing legal agreement consent', () => {
    const result = validateConsentInput({
        acceptedPersonalInfoProcessing: true,
    });

    assert.equal(result.valid, false);
    assert.equal(result.message, '请先阅读并同意相关协议后再继续。');
});

test('rejects missing personal information processing consent', () => {
    const result = validateConsentInput({
        acceptedLegalTerms: true,
    });

    assert.equal(result.valid, false);
    assert.equal(result.message, '请先同意平台为生成回忆录处理必要的语音、文字和故事信息。');
});

test('accepts complete legal consent input', () => {
    const result = validateConsentInput({
        acceptedLegalTerms: true,
        acceptedPersonalInfoProcessing: true,
    });

    assert.deepEqual(result, { valid: true, message: '' });
});

test('builds a versioned consent record with request metadata', () => {
    const record = buildConsentRecord({
        userId: 'user_1',
        phone: '13800138000',
        source: 'register',
        userAgent: 'Mozilla/5.0',
        ip: '1.2.3.4',
    });

    assert.equal(record.userId, 'user_1');
    assert.equal(record.phone, '13800138000');
    assert.equal(record.source, 'register');
    assert.equal(record.userAgent, 'Mozilla/5.0');
    assert.equal(record.ip, '1.2.3.4');
    assert.equal(record.agreementVersion, CURRENT_LEGAL_VERSIONS.agreementVersion);
    assert.equal(record.privacyVersion, CURRENT_LEGAL_VERSIONS.privacyVersion);
    assert.equal(record.aiDisclaimerVersion, CURRENT_LEGAL_VERSIONS.aiDisclaimerVersion);
    assert.equal(record.acceptedTerms, true);
    assert.equal(record.acceptedPrivacy, true);
    assert.equal(record.acceptedAiDisclaimer, true);
    assert.equal(record.acceptedPersonalInfoProcessing, true);
});

test('records user consent in user_consents collection', async () => {
    const db = createMockConsentDb();

    const record = await recordUserConsent(db, {
        userId: 'user_1',
        phone: '13800138000',
        source: 'login',
        userAgent: 'Safari',
        ip: '5.6.7.8',
    });

    assert.equal(db.adds.length, 1);
    assert.equal(db.adds[0].userId, 'user_1');
    assert.equal(db.adds[0].phone, '13800138000');
    assert.equal(db.adds[0].createdAt, 'SERVER_DATE');
    assert.equal(record.userId, 'user_1');
});

test('extracts the first forwarded ip before falling back to socket address', () => {
    assert.equal(
        getClientIp({
            headers: { 'x-forwarded-for': '9.9.9.9, 8.8.8.8' },
            socket: { remoteAddress: '127.0.0.1' },
        }),
        '9.9.9.9',
    );

    assert.equal(
        getClientIp({
            headers: {},
            socket: { remoteAddress: '127.0.0.1' },
        }),
        '127.0.0.1',
    );
});
