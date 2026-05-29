const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = fs.readFileSync(
    path.join(__dirname, '../lovable_ui/src/routes/index.tsx'),
    'utf8',
);
const preferenceTypes = fs.readFileSync(
    path.join(__dirname, '../lovable_ui/src/lib/userPreferences.d.ts'),
    'utf8',
);

test('settings font scale controls expose four presets and wider slider labels', () => {
    assert.match(routeSource, /\{ id: "small", label: "小" \}/);
    assert.match(routeSource, /\{ id: "normal", label: "标准" \}/);
    assert.match(routeSource, /\{ id: "large", label: "大" \}/);
    assert.match(routeSource, /\{ id: "extraLarge", label: "特大" \}/);
    assert.match(routeSource, /options\.length === 4 \? "grid-cols-4" : "grid-cols-3"/);
    assert.match(routeSource, />更小</);
    assert.match(routeSource, />更大</);
});

test('standard font size preset is the 85 percent baseline', () => {
    const frontendPreferenceSource = fs.readFileSync(
        path.join(__dirname, '../lovable_ui/src/lib/userPreferences.js'),
        'utf8',
    );
    const backendPreferenceSource = fs.readFileSync(
        path.join(__dirname, '../lib/userPreferences.js'),
        'utf8',
    );

    assert.match(frontendPreferenceSource, /normal: 0\.85/);
    assert.match(frontendPreferenceSource, /fontSizePreset: "normal"/);
    assert.match(frontendPreferenceSource, /fontScale: FONT_SCALE_PRESETS\.normal/);
    assert.match(backendPreferenceSource, /normal: 0\.85/);
    assert.match(backendPreferenceSource, /fontSizePreset: 'normal'/);
    assert.match(backendPreferenceSource, /fontScale: FONT_SCALE_PRESETS\.normal/);
});

test('font scale slider keeps a local draft until the user finishes dragging', () => {
    assert.match(routeSource, /draftFontScale/);
    assert.match(routeSource, /commitDraftFontScale/);
    assert.match(routeSource, /commitDraftFontScaleFromInput/);
    assert.match(routeSource, /Number\(event\.currentTarget\.value\)/);
    assert.match(routeSource, /value=\{draftFontScale\}/);
    assert.match(routeSource, /onPointerUp=\{commitDraftFontScaleFromInput\}/);
    assert.match(routeSource, /onMouseUp=\{commitDraftFontScaleFromInput\}/);
    assert.match(routeSource, /onTouchEnd=\{commitDraftFontScaleFromInput\}/);
    assert.match(routeSource, /onBlur=\{commitDraftFontScaleFromInput\}/);
    assert.doesNotMatch(
        routeSource,
        /aria-label="字体大小微调"[\s\S]{0,700}onChange=\{\(event\) =>\s*onChange\(/,
    );
});

test('font scale shortcut buttons highlight from the current draft scale', () => {
    assert.match(routeSource, /getFontSizePresetByScale/);
    assert.match(routeSource, /activeFontSizePreset/);
    assert.match(routeSource, /value=\{activeFontSizePreset \?\? preferences\.fontSizePreset\}/);
    assert.match(routeSource, /fontSizePreset: getFontSizePresetByScale\(nextFontScale\) \?\? "custom"/);
});

test('font size preset type includes the small shortcut', () => {
    assert.match(
        preferenceTypes,
        /export type FontSizePreset = "small" \| "normal" \| "large" \| "extraLarge" \| "custom";/,
    );
    assert.match(
        preferenceTypes,
        /export function getFontSizePresetByScale\(fontScale: number\): Exclude<FontSizePreset, "custom"> \| null;/,
    );
});
