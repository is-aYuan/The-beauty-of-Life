// 欢迎语模块：只负责把用户状态转成老人端开场文案，避免后端流程里散落硬编码。
function buildWelcomeText({ userName, hasBiography, isReady }) {
    if (hasBiography) {
        return `${userName}，您的回忆已经积累了很多，我先帮您整理出了一版故事。您可以继续补充，也可以到回忆库里慢慢查看。`;
    }

    if (isReady) {
        return `${userName}，您讲的故事已经很完整了，我随时可以帮您整理成书。您想现在就生成吗？或者继续补充也可以。`;
    }

    return `您好，${userName}！请继续讲您的故事，我会帮您记录下来。`;
}

module.exports = {
    buildWelcomeText,
};
