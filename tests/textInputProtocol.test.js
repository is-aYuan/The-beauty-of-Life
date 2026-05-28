const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const serverPath = path.join(repoRoot, 'server.js');
const enginePath = path.join(repoRoot, 'lovable_ui', 'src', 'hooks', 'useStoryEngine.ts');
const routePath = path.join(repoRoot, 'lovable_ui', 'src', 'routes', 'index.tsx');
const recorderPath = path.join(
    repoRoot,
    'lovable_ui',
    'src',
    'components',
    'story',
    'RecorderControls.tsx',
);
const textInputComposerPath = path.join(
    repoRoot,
    'lovable_ui',
    'src',
    'components',
    'story',
    'TextInputComposer.tsx',
);

test('server accepts typed user messages through the shared text interaction pipeline', () => {
    const source = fs.readFileSync(serverPath, 'utf8');

    assert.match(source, /user_text_message/);
    assert.match(source, /processTypedInteraction/);
    assert.match(source, /processUserTextInteraction/);
    assert.match(source, /inputMode: 'text'/);
    assert.match(source, /audioFile: null/);
    assert.match(source, /audioSizeKB: 0/);
    assert.match(source, /shouldSpeak: false/);
    assert.match(source, /event: 'ai_text_response'/);
});

test('text mode bypasses speech synthesis while voice mode keeps it enabled', () => {
    const source = fs.readFileSync(serverPath, 'utf8');

    assert.match(source, /shouldSpeak: true/);
    assert.match(source, /if \(shouldSpeak\) \{/);
    assert.match(source, /synthesizeSpeech\(aiReply, session\.userPreferences\)/);
});

test('frontend exposes text input mode and sends typed messages through websocket', () => {
    const engineSource = fs.readFileSync(enginePath, 'utf8');
    const routeSource = fs.readFileSync(routePath, 'utf8');
    const recorderSource = fs.readFileSync(recorderPath, 'utf8');

    assert.match(engineSource, /sendTextMessage/);
    assert.match(engineSource, /user_text_message/);
    assert.match(engineSource, /enterTextInputMode/);
    assert.match(engineSource, /ignoreIncomingAudioRef/);
    assert.match(routeSource, /type RecordMode = "hold" \| "table" \| "text"/);
    assert.match(routeSource, /长按说话/);
    assert.match(routeSource, /录音上传/);
    assert.match(routeSource, /打字输入/);
    assert.doesNotMatch(routeSource, /桌上畅聊/);
    assert.match(routeSource, /TextInputComposer/);
    assert.match(recorderSource, /录音上传/);
    assert.match(recorderSource, /打字输入/);
    assert.match(recorderSource, /TextInputComposer/);
});

test('text input mode uses a large single input frame without an outer shadow box', () => {
    const source = fs.readFileSync(textInputComposerPath, 'utf8');

    assert.match(source, /min-h-\[60px\]/);
    assert.match(source, /h-\[60px\] w-\[60px\]/);
    assert.doesNotMatch(source, /shadow-\[0_8px_18px_rgba\(160,120,30,0\.12\)\]/);
    assert.doesNotMatch(source, /bg-white\/90 p-2/);
});

test('mobile recorder replaces voice idle copy when text input is selected', () => {
    const source = fs.readFileSync(recorderPath, 'utf8');

    assert.match(source, /showStatusLine/);
    assert.match(source, /recordMode === "text"/);
    assert.match(source, /placeholder="打字讲述您的故事"/);
    assert.doesNotMatch(source, /打字输入，接着上次的话题继续讲/);
    assert.doesNotMatch(source, /打字输入，像聊天一样讲/);
});

test('recorder controls hide idle guidance copy for every idle input mode', () => {
    const routeSource = fs.readFileSync(routePath, 'utf8');
    const recorderSource = fs.readFileSync(recorderPath, 'utf8');

    assert.match(routeSource, /const showDesktopStatusLine = convoState !== "idle" \|\| networkStatus === "offline"/);
    assert.match(recorderSource, /const showStatusLine = convoState !== "idle" \|\| offline \|\| \(recordMode !== "text" && !!recorderError\)/);
    assert.doesNotMatch(routeSource, /entryGuidance\.idleStatus/);
    assert.doesNotMatch(recorderSource, /\{idleStatus\}/);
});
