const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('server.js', 'utf8');

test('server initializes the API usage recorder', () => {
    assert.match(source, /require\('\.\/lib\/usage\/usageRecorder'\)/);
    assert.match(source, /const usageRecorder = createUsageRecorder\(\{ db \}\)/);
});

test('admin exposes an authenticated usage monitoring endpoint', () => {
    assert.match(source, /url\.pathname === '\/api\/admin\/usage'/);
    assert.match(source, /usageRecorder\.getAdminUsage\(\{ range \}\)/);
});

test('server records usage for chat, DeepSeek, ASR, and TTS calls', () => {
    assert.match(source, /operation: 'chat'/);
    assert.match(source, /operation: 'summary'/);
    assert.match(source, /operation: 'topic_analysis'/);
    assert.match(source, /operation: 'biography'/);
    assert.match(source, /operation: 'asr'/);
    assert.match(source, /operation: 'tts'/);
    assert.match(source, /recordOpenAICompatibleUsage/);
});
