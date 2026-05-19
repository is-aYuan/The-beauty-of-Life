const test = require('node:test');
const assert = require('node:assert/strict');

const {
    BIOGRAPHY_STYLE_OPTIONS,
    DEFAULT_BIOGRAPHY_STYLE_ID,
    getBiographyStyle,
} = require('../lib/biographyStyles');

test('defines four biography styles with warm plain as the default', () => {
    assert.equal(DEFAULT_BIOGRAPHY_STYLE_ID, 'warm_plain');
    assert.deepEqual(
        BIOGRAPHY_STYLE_OPTIONS.map((style) => style.id),
        ['warm_plain', 'documentary', 'literary', 'family_letter'],
    );
    assert.ok(BIOGRAPHY_STYLE_OPTIONS.every((style) => style.label && style.description));
});

test('falls back to warm plain when biography style is missing or unknown', () => {
    assert.equal(getBiographyStyle().id, 'warm_plain');
    assert.equal(getBiographyStyle('unknown_style').id, 'warm_plain');
});

test('converts workflow instructions into safe writing guidance without exposing think tags', () => {
    const style = getBiographyStyle('literary');

    assert.match(style.prompt, /文学抒情风/);
    assert.match(style.prompt, /内部写作策略/);
    assert.doesNotMatch(style.prompt, /<think>/);
    assert.doesNotMatch(style.prompt, /<\/think>/);
});
