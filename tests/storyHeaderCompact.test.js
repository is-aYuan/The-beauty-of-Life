const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const routePath = path.join(repoRoot, 'lovable_ui', 'src', 'routes', 'index.tsx');

test('story headers share the compact companion stats copy on desktop and mobile', () => {
    const source = fs.readFileSync(routePath, 'utf8');

    assert.match(source, /const memoirTitle = buildMemoirTitle\(user\.name\)/);
    assert.match(source, /const companionStatsText = `陪伴记录 · \$\{userStats\.totalConversations\} 段 · \$\{userStats\.estimatedDurationMin\} 分钟`/);
    assert.equal((source.match(/\{companionStatsText\}/g) || []).length, 2);
    assert.doesNotMatch(source, /已记录 \{userStats\.totalConversations\} 个对话/);
});

test('story headers use reduced vertical scale for the compact stats treatment', () => {
    const source = fs.readFileSync(routePath, 'utf8');

    assert.match(source, /shrink-0 border-b border-amber-200 px-4 py-2/);
    assert.match(source, /flex flex-wrap items-baseline gap-x-2/);
    assert.match(source, /text-\[22px\] font-black leading-tight text-stone-900/);
    assert.match(source, /text-sm font-bold leading-tight text-stone-500/);
    assert.match(source, /border-b-2 border-amber-200 pb-3/);
    assert.match(source, /text-3xl font-bold text-stone-800/);
});
