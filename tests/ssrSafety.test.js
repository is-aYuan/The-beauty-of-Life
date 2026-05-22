const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const homeRoutePath = path.join(repoRoot, 'lovable_ui', 'src', 'routes', 'index.tsx');
const adminRoutePath = path.join(repoRoot, 'lovable_ui', 'src', 'routes', 'admin.tsx');

test('home route guards browser-only localStorage access during SSR', () => {
    const source = fs.readFileSync(homeRoutePath, 'utf8');

    assert.doesNotMatch(source, /const hasLocalUser = !!localStorage\.getItem\("story_user"\)/);
    assert.match(source, /typeof localStorage !== "undefined"/);
    assert.match(source, /localStorage\.getItem\("story_user"\)/);
});

test('admin route guards browser-only localStorage access during SSR', () => {
    const source = fs.readFileSync(adminRoutePath, 'utf8');

    assert.doesNotMatch(source, /useState\(\(\) => localStorage\.getItem\("admin_token"\)/);
    assert.match(source, /typeof localStorage !== "undefined"/);
    assert.match(source, /localStorage\.getItem\("admin_token"\)/);
});
