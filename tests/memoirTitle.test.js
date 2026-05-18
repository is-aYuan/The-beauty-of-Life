const test = require('node:test');
const assert = require('node:assert/strict');

test('builds a neutral memoir title with the user name', async () => {
    const { buildMemoirTitle } = await import('../lovable_ui/src/lib/memoirTitle.js');

    const title = buildMemoirTitle('关元');

    assert.equal(title, '关元的回忆录');
    assert.doesNotMatch(title, /爷爷|奶奶/);
});

test('falls back to a neutral memoir title without a user name', async () => {
    const { buildMemoirTitle } = await import('../lovable_ui/src/lib/memoirTitle.js');

    assert.equal(buildMemoirTitle(''), '我的回忆录');
    assert.equal(buildMemoirTitle('   '), '我的回忆录');
});
