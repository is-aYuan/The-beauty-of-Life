const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildPublicUserProfile,
    normalizeUserProfileUpdate,
} = require('../lib/userProfile');

test('normalizes editable profile fields and ignores phone updates', () => {
    const result = normalizeUserProfileUpdate({
        name: '  郑远  ',
        age: '24',
        phone: '19999999999',
    });

    assert.equal(result.valid, true);
    assert.deepEqual(result.value, {
        name: '郑远',
        age: 24,
    });
    assert.equal(Object.hasOwn(result.value, 'phone'), false);
});

test('allows empty age but requires a real display name', () => {
    const result = normalizeUserProfileUpdate({
        name: '  关元  ',
        age: '',
    });

    assert.equal(result.valid, true);
    assert.deepEqual(result.value, {
        name: '关元',
        age: null,
    });

    const invalid = normalizeUserProfileUpdate({ name: '   ', age: 23 });
    assert.equal(invalid.valid, false);
    assert.equal(invalid.message, '姓名不能为空');
});

test('rejects impossible ages with a user-facing message', () => {
    assert.deepEqual(normalizeUserProfileUpdate({ name: '郑远', age: '0' }), {
        valid: false,
        message: '年龄需要在1到120岁之间',
    });

    assert.deepEqual(normalizeUserProfileUpdate({ name: '郑远', age: '121' }), {
        valid: false,
        message: '年龄需要在1到120岁之间',
    });

    assert.deepEqual(normalizeUserProfileUpdate({ name: '郑远', age: '二十三' }), {
        valid: false,
        message: '年龄需要填写数字',
    });
});

test('builds a public profile payload without sensitive password fields', () => {
    const publicUser = buildPublicUserProfile(
        {
            _id: 'user_1',
            phone: '18800001111',
            name: '郑远',
            age: 24,
            passwordHash: 'secret-hash',
            passwordSalt: 'secret-salt',
        },
        'token_1',
    );

    assert.deepEqual(publicUser, {
        success: true,
        userId: 'user_1',
        phone: '18800001111',
        name: '郑远',
        age: 24,
        authToken: 'token_1',
    });
});
