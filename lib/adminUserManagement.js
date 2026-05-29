// 模块：管理员用户管理。集中处理后台增删改查的输入校验与列表响应整理。
const { normalizeUserProfileUpdate } = require('./userProfile');

const ADMIN_DELETE_CONFIRM_TEXT = '确认删除';
const PHONE_PATTERN = /^1\d{10}$/;

function normalizeAdminPhone(input) {
    const phone = String(input ?? '').trim();
    if (!phone) {
        return { valid: false, message: '请输入手机号' };
    }
    if (!PHONE_PATTERN.test(phone)) {
        return { valid: false, message: '手机号格式不正确' };
    }
    return { valid: true, value: phone };
}

function normalizeAdminPassword(input) {
    const password = String(input ?? '').trim();
    if (!password) {
        return { valid: false, message: '请输入初始密码' };
    }
    return { valid: true, value: password };
}

function validateAdminCreateUserInput(input = {}) {
    const profile = normalizeUserProfileUpdate(input);
    if (!profile.valid) return profile;

    const phone = normalizeAdminPhone(input.phone);
    if (!phone.valid) return phone;

    const password = normalizeAdminPassword(input.password);
    if (!password.valid) return password;

    return {
        valid: true,
        value: {
            ...profile.value,
            phone: phone.value,
            password: password.value,
        },
    };
}

function validateAdminUpdateUserInput(input = {}) {
    return normalizeUserProfileUpdate({
        name: input.name,
        age: input.age,
    });
}

function validateAdminDeleteUserInput(input = {}) {
    const confirmText = String(input.confirmText ?? '').trim();
    if (confirmText !== ADMIN_DELETE_CONFIRM_TEXT) {
        return { valid: false, message: '请输入“确认删除”后再继续' };
    }
    return { valid: true };
}

function normalizeAdminDate(value) {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object' && value.$date) return value.$date;
    return value;
}

function buildAdminUserListItem(user = {}, stats = {}) {
    return {
        _id: user._id || user.userId || '',
        name: user.name || '未知',
        phone: user.phone || '-',
        age: user.age ?? null,
        status: user.status || 'active',
        createdAt: normalizeAdminDate(user.createdAt),
        updatedAt: normalizeAdminDate(user.updatedAt),
        sessionCount: stats.sessionCount || 0,
        conversationCount: stats.conversationCount || 0,
        summaryCount: stats.summaryCount || 0,
        lastActiveAt: normalizeAdminDate(stats.lastActiveAt),
    };
}

module.exports = {
    ADMIN_DELETE_CONFIRM_TEXT,
    buildAdminUserListItem,
    validateAdminCreateUserInput,
    validateAdminDeleteUserInput,
    validateAdminUpdateUserInput,
};
