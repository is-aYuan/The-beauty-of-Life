const test = require('node:test');
const assert = require('node:assert/strict');

test('allows audio only for the active browser session', async () => {
    const { isAudioPlaybackAllowed } = await import('../lovable_ui/src/lib/audioSessionGuard.js');

    assert.equal(isAudioPlaybackAllowed(2, 2), true);
    assert.equal(isAudioPlaybackAllowed(1, 2), false);
    assert.equal(isAudioPlaybackAllowed(2, null), false);
});
