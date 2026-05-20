const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('frontend runtime config defaults to local backend for development', async () => {
    const {
        getRuntimeConfig,
    } = await import('../lovable_ui/src/lib/runtimeConfig.js');

    const config = getRuntimeConfig({});

    assert.equal(config.apiBase, 'http://localhost:8000');
    assert.equal(config.wsUrl, 'ws://localhost:8000/ws/chat');
});

test('frontend runtime config reads deployment API and WebSocket URLs from Vite env', async () => {
    const {
        getRuntimeConfig,
    } = await import('../lovable_ui/src/lib/runtimeConfig.js');

    const config = getRuntimeConfig({
        VITE_API_BASE: 'https://story.example.com/',
        VITE_WS_URL: 'wss://story.example.com/ws/chat',
    });

    assert.equal(config.apiBase, 'https://story.example.com');
    assert.equal(config.wsUrl, 'wss://story.example.com/ws/chat');
});

test('frontend routes use runtime config instead of hard-coded localhost API URLs', () => {
    const storyEngine = fs.readFileSync('lovable_ui/src/hooks/useStoryEngine.ts', 'utf8');
    const adminRoute = fs.readFileSync('lovable_ui/src/routes/admin.tsx', 'utf8');

    assert.match(storyEngine, /getRuntimeConfig\(import\.meta\.env\)/);
    assert.match(adminRoute, /getRuntimeConfig\(import\.meta\.env\)/);
    assert.doesNotMatch(storyEngine, /API_BASE:\s*"http:\/\/localhost:8000"/);
    assert.doesNotMatch(storyEngine, /WS_URL:\s*"ws:\/\/localhost:8000\/ws\/chat"/);
    assert.doesNotMatch(adminRoute, /const API_BASE = "http:\/\/localhost:8000"/);
});
