const test = require('node:test');
const assert = require('node:assert/strict');

const {
    ADMIN_DELETE_CONFIRM_TEXT,
    buildAdminUserListItem,
    validateAdminCreateUserInput,
    validateAdminDeleteUserInput,
    validateAdminUpdateUserInput,
} = require('../lib/adminUserManagement');

test('validates admin-created users with required profile and password fields', () => {
    const valid = validateAdminCreateUserInput({
        name: '郑远',
        phone: '18486162501',
        age: '23',
        password: 'admin1234',
    });

    assert.equal(valid.valid, true);
    assert.deepEqual(valid.value, {
        name: '郑远',
        phone: '18486162501',
        age: 23,
        password: 'admin1234',
    });

    assert.equal(validateAdminCreateUserInput({ name: '', phone: '18486162501', password: 'admin1234' }).valid, false);
    assert.equal(validateAdminCreateUserInput({ name: '郑远', phone: '', password: 'admin1234' }).valid, false);
    assert.equal(validateAdminCreateUserInput({ name: '郑远', phone: '18486162501', password: '' }).valid, false);
});

test('validates admin profile edits without allowing phone changes', () => {
    const valid = validateAdminUpdateUserInput({
        name: '郑远',
        phone: '13300000000',
        age: '',
    });

    assert.equal(valid.valid, true);
    assert.deepEqual(valid.value, {
        name: '郑远',
        age: null,
    });
});

test('requires explicit confirmation text before admin user deletion', () => {
    assert.equal(ADMIN_DELETE_CONFIRM_TEXT, '确认删除');

    const valid = validateAdminDeleteUserInput({ confirmText: '确认删除' });
    assert.equal(valid.valid, true);

    const invalid = validateAdminDeleteUserInput({ confirmText: '删除用户' });
    assert.deepEqual(invalid, {
        valid: false,
        message: '请输入“确认删除”后再继续',
    });
});

test('builds admin user list rows with activity stats and safe display values', () => {
    const row = buildAdminUserListItem(
        {
            _id: 'user_1',
            name: '郑远',
            phone: '18486162501',
            age: null,
            status: 'active',
            createdAt: '2026-05-01T00:00:00.000Z',
            updatedAt: '2026-05-02T00:00:00.000Z',
        },
        {
            sessionCount: 3,
            conversationCount: 12,
            summaryCount: 2,
            lastActiveAt: '2026-05-03T00:00:00.000Z',
        },
    );

    assert.deepEqual(row, {
        _id: 'user_1',
        name: '郑远',
        phone: '18486162501',
        age: null,
        status: 'active',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-02T00:00:00.000Z',
        sessionCount: 3,
        conversationCount: 12,
        summaryCount: 2,
        lastActiveAt: '2026-05-03T00:00:00.000Z',
    });
});
