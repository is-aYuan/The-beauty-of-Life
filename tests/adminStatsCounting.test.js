const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('admin dashboard totals use CloudBase count instead of first-page get length', () => {
    const source = fs.readFileSync('server.js', 'utf8');
    const functionStart = source.indexOf('async function getAdminStats');
    const functionEnd = source.indexOf('async function getAdminUsers', functionStart);
    const functionSource = source.slice(functionStart, functionEnd);

    assert.match(functionSource, /collection\('users'\)\.count\(\)/);
    assert.match(functionSource, /collection\('sessions'\)\.count\(\)/);
    assert.match(functionSource, /collection\('conversations'\)\.count\(\)/);
    assert.match(functionSource, /collection\('summaries'\)\.count\(\)/);
    assert.doesNotMatch(functionSource, /\.get\(\)/);
    assert.doesNotMatch(functionSource, /\.data\.length/);
});
