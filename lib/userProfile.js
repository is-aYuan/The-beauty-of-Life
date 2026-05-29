// 模块：用户资料清洗。集中处理账号资料可编辑字段，避免手机号等登录凭证被误更新。

const NAME_MAX_LENGTH = 20;
const AGE_MIN = 1;
const AGE_MAX = 120;

function normalizeDisplayName(input) {
    const name = String(input ?? '').trim().replace(/\s+/g, ' ');
    if (!name) {
        return { valid: false, message: '姓名不能为空' };
    }
    if ([...name].length > NAME_MAX_LENGTH) {
        return { valid: false, message: `姓名不能超过${NAME_MAX_LENGTH}个字` };
    }
    return { valid: true, value: name };
}

function normalizeAge(input) {
    if (input === undefined || input === null || input === '') {
        return { valid: true, value: null };
    }

    const age = Number(input);
    if (!Number.isFinite(age) || !Number.isInteger(age)) {
        return { valid: false, message: '年龄需要填写数字' };
    }
    if (age < AGE_MIN || age > AGE_MAX) {
        return { valid: false, message: `年龄需要在${AGE_MIN}到${AGE_MAX}岁之间` };
    }
    return { valid: true, value: age };
}

function normalizeUserProfileUpdate(input = {}) {
    const name = normalizeDisplayName(input.name);
    if (!name.valid) return { valid: false, message: name.message };

    const age = normalizeAge(input.age);
    if (!age.valid) return { valid: false, message: age.message };

    return {
        valid: true,
        value: {
            name: name.value,
            age: age.value,
        },
    };
}

function buildPublicUserProfile(user, authToken) {
    const payload = {
        success: true,
        userId: user?._id || user?.userId,
        phone: user?.phone || '',
        name: user?.name || '',
        age: user?.age ?? null,
    };

    if (authToken) {
        payload.authToken = authToken;
    }

    return payload;
}

module.exports = {
    buildPublicUserProfile,
    normalizeUserProfileUpdate,
};
