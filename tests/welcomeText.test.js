const test = require('node:test');
const assert = require('node:assert/strict');

const { buildWelcomeText } = require('../lib/welcomeText');

test('uses story draft copy when a biography exists', () => {
    const text = buildWelcomeText({
        userName: '郑远',
        hasBiography: true,
        isReady: false,
    });

    assert.equal(
        text,
        '郑远，您的回忆已经积累了很多，我先帮您整理出了一版故事。您可以继续补充，也可以到回忆库里慢慢查看。'
    );
    assert.doesNotMatch(text, /人生故事已经写好了/);
    assert.doesNotMatch(text, /念给您听/);
});
