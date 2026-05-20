const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('admin conversation query returns the newest records first', () => {
    const source = fs.readFileSync('server.js', 'utf8');
    const functionStart = source.indexOf('async function getUserConversations');
    const functionEnd = source.indexOf('/**\n * 获取某个会话的对话记录', functionStart);
    const functionSource = source.slice(functionStart, functionEnd);

    assert.match(functionSource, /orderBy\('timestamp', 'desc'\)/);
    assert.match(functionSource, /\.limit\(200\)/);
});
