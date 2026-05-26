const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const storyEnginePath = path.join(__dirname, '..', 'lovable_ui', 'src', 'hooks', 'useStoryEngine.ts');

test('table chat only ends when the user explicitly taps finished', () => {
    const source = fs.readFileSync(storyEnginePath, 'utf8');

    assert.match(source, /TABLE_MODE_ENDS_ON_EXPLICIT_FINISH:\s*true/);
    assert.doesNotMatch(source, /SILENCE_DURATION_MS:\s*4000/);
    assert.doesNotMatch(
        source,
        /now - silenceStartTimeRef\.current >= CONFIG\.VAD\.SILENCE_DURATION_MS[\s\S]*stopRecording\(true\)/,
    );
});
