const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const storyEnginePath = path.join(__dirname, '..', 'lovable_ui', 'src', 'hooks', 'useStoryEngine.ts');

test('table chat waits four seconds of silence before ending a turn', () => {
    const source = fs.readFileSync(storyEnginePath, 'utf8');

    assert.match(source, /SILENCE_DURATION_MS:\s*4000/);
});
