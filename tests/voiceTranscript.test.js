const test = require('node:test');
const assert = require('node:assert/strict');

test('voice transcript helper replaces a draft user bubble with final text', async () => {
    const {
        createVoiceDraftMessage,
        finalizeVoiceTranscript,
    } = await import('../lovable_ui/src/lib/voiceTranscript.js');

    const draft = createVoiceDraftMessage({
        turnId: 'turn-1',
        mode: 'hold',
        now: () => 100,
    });

    const history = finalizeVoiceTranscript([draft], {
        turnId: 'turn-1',
        text: '我小时候住在老院子里。',
    });

    assert.deepEqual(history, [
        {
            id: 100,
            role: 'user',
            text: '我小时候住在老院子里。',
            status: 'final',
            turnId: 'turn-1',
            mode: 'hold',
        },
    ]);
});

test('voice transcript helper appends final user text when no draft exists', async () => {
    const {
        finalizeVoiceTranscript,
    } = await import('../lovable_ui/src/lib/voiceTranscript.js');

    const history = finalizeVoiceTranscript([], {
        turnId: 'turn-2',
        text: '这是一段补发的识别内容。',
        mode: 'table',
        now: () => 200,
    });

    assert.deepEqual(history, [
        {
            id: 200,
            role: 'user',
            text: '这是一段补发的识别内容。',
            status: 'final',
            turnId: 'turn-2',
            mode: 'table',
        },
    ]);
});

test('voice transcript helper marks the draft bubble when recognition fails', async () => {
    const {
        createVoiceDraftMessage,
        failVoiceTranscript,
    } = await import('../lovable_ui/src/lib/voiceTranscript.js');

    const draft = createVoiceDraftMessage({
        turnId: 'turn-3',
        mode: 'table',
        now: () => 300,
    });

    const history = failVoiceTranscript([draft], {
        turnId: 'turn-3',
        message: '没有听清，请再说一次。',
    });

    assert.equal(history[0].role, 'user');
    assert.equal(history[0].status, 'error');
    assert.equal(history[0].text, '没有听清，请再说一次。');
    assert.equal(history[0].turnId, 'turn-3');
});
