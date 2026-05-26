const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const serverPath = path.join(repoRoot, 'server.js');
const enginePath = path.join(repoRoot, 'lovable_ui', 'src', 'hooks', 'useStoryEngine.ts');
const routePath = path.join(repoRoot, 'lovable_ui', 'src', 'routes', 'index.tsx');

test('server exposes a voice-turn protocol and sends user transcript before AI reply', () => {
    const source = fs.readFileSync(serverPath, 'utf8');

    assert.match(source, /user_speech_started/);
    assert.match(source, /user_transcript/);
    assert.match(source, /user_transcript_failed/);
    assert.match(source, /recognizeLongFormSpeech/);
    assert.match(source, /pendingEntryGuidance/);
    assert.match(source, /buildAnsweredEntryGuidanceTurn/);
    assert.match(source, /aiPromptText/);
    assert.match(source, /promptSource/);
});

test('story engine sends voice-turn events and applies transcript updates to chat history', () => {
    const source = fs.readFileSync(enginePath, 'utf8');

    assert.match(source, /user_speech_started/);
    assert.match(source, /user_speech_ended/);
    assert.match(source, /user_transcript/);
    assert.match(source, /user_transcript_failed/);
    assert.match(source, /createVoiceDraftMessage/);
    assert.match(source, /finalizeVoiceTranscript/);
    assert.match(source, /failVoiceTranscript/);
    assert.match(source, /upsertSessionEntryMessage/);
    assert.match(source, /source\?: "entry_guidance"/);
});

test('story route renders chat messages through the shared bubble component', () => {
    const source = fs.readFileSync(routePath, 'utf8');

    assert.match(source, /ChatMessageBubble/);
});
