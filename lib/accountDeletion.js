// 模块：账号注销输入校验。把危险操作的确认规则集中管理，避免误删账号资料。
const ACCOUNT_DELETION_CONFIRM_TEXT = '确认注销';

function validateAccountDeletionInput(input = {}) {
    const password = typeof input.password === 'string' ? input.password.trim() : '';
    const confirmText = typeof input.confirmText === 'string' ? input.confirmText.trim() : '';

    if (!password) {
        return { valid: false, message: '请输入登录密码' };
    }

    if (confirmText !== ACCOUNT_DELETION_CONFIRM_TEXT) {
        return { valid: false, message: '请输入“确认注销”后再继续' };
    }

    return {
        valid: true,
        value: {
            password,
        },
    };
}

module.exports = {
    ACCOUNT_DELETION_CONFIRM_TEXT,
    validateAccountDeletionInput,
};
