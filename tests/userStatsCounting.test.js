const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('user-facing stats use CloudBase count instead of first-page get length', () => {
    const source = fs.readFileSync('server.js', 'utf8');
    const functionStart = source.indexOf('async function getUserStats');
    const functionEnd = source.indexOf('// ==================== 管理员认证', functionStart);
    const functionSource = source.slice(functionStart, functionEnd);

    assert.match(functionSource, /collection\('sessions'\)[\s\S]*where\(\{ userId \}\)[\s\S]*count\(\)/);
    assert.match(functionSource, /collection\('conversations'\)[\s\S]*where\(\{ userId \}\)[\s\S]*count\(\)/);
    assert.match(functionSource, /fetchUserConversationAudioStats/);
    assert.doesNotMatch(functionSource, /totalConversations\s*=\s*conversations\.data\.length/);
    assert.doesNotMatch(functionSource, /totalSessions\s*=\s*sessions\.data\.length/);
});

test('user-facing audio duration stats page through all conversation records', () => {
    const source = fs.readFileSync('server.js', 'utf8');
    const functionStart = source.indexOf('async function fetchUserConversationAudioStats');
    const functionEnd = source.indexOf('async function getUserStats', functionStart);
    const functionSource = source.slice(functionStart, functionEnd);

    assert.match(functionSource, /const batchSize = 100/);
    assert.match(functionSource, /\.skip\(offset\)/);
    assert.match(functionSource, /\.limit\(batchSize\)/);
    assert.match(functionSource, /offset \+= batchSize/);
});
