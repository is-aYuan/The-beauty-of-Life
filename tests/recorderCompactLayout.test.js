const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const routePath = path.join(repoRoot, 'lovable_ui', 'src', 'routes', 'index.tsx');
const recorderPath = path.join(
    repoRoot,
    'lovable_ui',
    'src',
    'components',
    'story',
    'RecorderControls.tsx',
);

test('desktop story recorder uses a compact sticky control bar', () => {
    const source = fs.readFileSync(routePath, 'utf8');

    assert.match(source, /sticky bottom-0 border-t-2 border-amber-200 bg-amber-50 px-4 py-3/);
    assert.match(source, /showDesktopStatusLine/);
    assert.match(source, /w-full max-w-md/);
    assert.match(source, /min-h-\[46px\]/);
    assert.match(source, /min-h-\[64px\]/);
    assert.match(source, /min-w-\[240px\]/);
    assert.doesNotMatch(source, /mb-4 min-h-\[68px\]/);
    assert.doesNotMatch(source, /px-10 py-6 text-2xl/);
});

test('desktop story recorder uses the same warm gold primary button palette as mobile', () => {
    const source = fs.readFileSync(routePath, 'utf8');

    assert.match(source, /bg-\[#FFEA92\]/);
    assert.match(source, /text-\[#241F1C\]/);
    assert.match(source, /border-\[#F5D76B\]/);
    assert.match(source, /shadow-\[0_8px_18px_rgba\(160,120,30,0\.16\)\]/);
    assert.match(source, /bg-\[#241F1C\]/);
    assert.doesNotMatch(source, /bg-red-600/);
});

test('mobile recorder keeps touch targets but frees vertical chat space', () => {
    const source = fs.readFileSync(recorderPath, 'utf8');

    assert.match(source, /px-4 pb-2 pt-2/);
    assert.match(source, /mb-2 grid grid-cols-3/);
    assert.match(source, /min-h-11/);
    assert.match(source, /showStatusLine/);
    assert.doesNotMatch(source, /按住话筒/);
    assert.match(source, /min-h-\[60px\]/);
    assert.doesNotMatch(source, /min-h-\[76px\]/);
    assert.doesNotMatch(source, /min-h-\[68px\]/);
});
