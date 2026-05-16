const test = require('node:test');
const assert = require('node:assert/strict');

const {
    createAuthToken,
    hashPassword,
    verifyAuthToken,
    verifyPassword,
    validatePassword,
} = require('../lib/authPassword');

test('hashes a password with salt and never returns the plain password', () => {
    const result = hashPassword('secret123');

    assert.ok(result.passwordHash);
    assert.ok(result.passwordSalt);
    assert.notEqual(result.passwordHash, 'secret123');
    assert.notEqual(result.passwordSalt, 'secret123');
});

test('verifies only the original password against stored hash and salt', () => {
    const result = hashPassword('secret123');

    assert.equal(verifyPassword('secret123', result.passwordHash, result.passwordSalt), true);
    assert.equal(verifyPassword('wrong123', result.passwordHash, result.passwordSalt), false);
});

test('rejects short or empty passwords', () => {
    assert.deepEqual(validatePassword(''), { valid: false, message: '密码至少需要 6 位' });
    assert.deepEqual(validatePassword('12345'), { valid: false, message: '密码至少需要 6 位' });
    assert.deepEqual(validatePassword('123456'), { valid: true });
});

test('creates and verifies a signed auth token', () => {
    const token = createAuthToken({ userId: 'u1', phone: '13800138000' }, 'test-secret');

    assert.deepEqual(
        verifyAuthToken(token, 'test-secret'),
        { valid: true, payload: { userId: 'u1', phone: '13800138000' } },
    );
    assert.equal(verifyAuthToken(token, 'wrong-secret').valid, false);
});
