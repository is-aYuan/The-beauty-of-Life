const test = require('node:test');
const assert = require('node:assert/strict');

const {
    ACCOUNT_DELETION_CONFIRM_TEXT,
    validateAccountDeletionInput,
} = require('../lib/accountDeletion');

test('accepts account deletion only with password and exact confirmation text', () => {
    const result = validateAccountDeletionInput({
        password: 'secret123',
        confirmText: '确认注销',
    });

    assert.deepEqual(result, {
        valid: true,
        value: {
            password: 'secret123',
        },
    });
});

test('rejects account deletion without password', () => {
    assert.deepEqual(validateAccountDeletionInput({ confirmText: ACCOUNT_DELETION_CONFIRM_TEXT }), {
        valid: false,
        message: '请输入登录密码',
    });
});

test('rejects account deletion without exact confirmation text', () => {
    assert.deepEqual(
        validateAccountDeletionInput({
            password: 'secret123',
            confirmText: '删除账号',
        }),
        {
            valid: false,
            message: '请输入“确认注销”后再继续',
        },
    );
});
