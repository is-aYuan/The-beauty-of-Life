const crypto = require('crypto');

const KEY_LENGTH = 64;

function validatePassword(password) {
    if (!password || password.length < 6) {
        return { valid: false, message: '密码至少需要 6 位' };
    }
    return { valid: true };
}

function hashPassword(password) {
    const validation = validatePassword(password);
    if (!validation.valid) {
        throw new Error(validation.message);
    }

    const passwordSalt = crypto.randomBytes(16).toString('hex');
    const passwordHash = crypto.scryptSync(password, passwordSalt, KEY_LENGTH).toString('hex');
    return { passwordHash, passwordSalt };
}

function verifyPassword(password, passwordHash, passwordSalt) {
    if (!password || !passwordHash || !passwordSalt) return false;

    const expected = Buffer.from(passwordHash, 'hex');
    const actual = crypto.scryptSync(password, passwordSalt, expected.length);
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
}

function base64UrlEncode(value) {
    return Buffer.from(value).toString('base64url');
}

function signPayload(encodedPayload, secret) {
    return crypto
        .createHmac('sha256', secret)
        .update(encodedPayload)
        .digest('base64url');
}

function createAuthToken(payload, secret) {
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = signPayload(encodedPayload, secret);
    return `${encodedPayload}.${signature}`;
}

function verifyAuthToken(token, secret) {
    try {
        const [encodedPayload, signature] = String(token || '').split('.');
        if (!encodedPayload || !signature) return { valid: false };

        const expectedSignature = signPayload(encodedPayload, secret);
        const actual = Buffer.from(signature);
        const expected = Buffer.from(expectedSignature);
        if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
            return { valid: false };
        }

        return {
            valid: true,
            payload: JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')),
        };
    } catch {
        return { valid: false };
    }
}

module.exports = {
    createAuthToken,
    hashPassword,
    validatePassword,
    verifyAuthToken,
    verifyPassword,
};
