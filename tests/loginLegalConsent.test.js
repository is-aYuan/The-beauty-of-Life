const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('login page requires legal agreement and personal information processing consent', () => {
    const source = fs.readFileSync('lovable_ui/src/routes/login.tsx', 'utf8');

    assert.match(source, /我已阅读并同意/);
    assert.match(source, /用户服务协议/);
    assert.match(source, /隐私政策/);
    assert.match(source, /AI 生成内容说明与免责声明/);
    assert.match(source, /我同意平台为生成回忆录/);
    assert.match(source, /请先勾选协议后继续/);
});

test('login page resets loading state when the auth request fails', () => {
    const source = fs.readFileSync('lovable_ui/src/routes/login.tsx', 'utf8');

    assert.match(source, /try\s*{/);
    assert.match(source, /catch \(error\)/);
    assert.match(source, /setErrorMsg\("连接服务器失败，请确认后端服务已启动。"\)/);
    assert.match(source, /finally\s*{\s*setIsLoading\(false\);/s);
});
