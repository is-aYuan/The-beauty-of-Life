// 模块：本地兜底追问。当所有在线模型都不可用时，用不欺骗用户的承接句保证对话不中断。

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function buildLocalFallbackReply({ topicTitle = '', userText = '' } = {}) {
    const safeTopicTitle = normalizeText(topicTitle);
    const safeUserText = normalizeText(userText);

    if (safeTopicTitle) {
        return `刚才这段我记下了。我们继续聊“${safeTopicTitle}”，您可以再讲讲当时还有哪些人、地方或者事情让您印象深？`;
    }

    if (safeUserText) {
        return '刚才这段我记下了。您可以接着讲讲，当时还有哪些人、地方或者事情让您印象深？';
    }

    return '我先陪您接着聊。您可以讲讲最近想到的一件往事，或者一个让您印象深的人。';
}

module.exports = {
    buildLocalFallbackReply,
};
