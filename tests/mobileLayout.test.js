const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const routePath = path.join(repoRoot, 'lovable_ui', 'src', 'routes', 'index.tsx');
const mobileShellPath = path.join(repoRoot, 'lovable_ui', 'src', 'components', 'mobile', 'MobileAppShell.tsx');
const topicDrawerPath = path.join(repoRoot, 'lovable_ui', 'src', 'components', 'mobile', 'MobileTopicDrawer.tsx');
const recorderPath = path.join(repoRoot, 'lovable_ui', 'src', 'components', 'story', 'RecorderControls.tsx');

test('home route keeps desktop layout but branches to a mobile app shell', () => {
    const routeSource = fs.readFileSync(routePath, 'utf8');

    assert.match(routeSource, /useIsMobile/);
    assert.match(routeSource, /MobileAppShell/);
    assert.match(routeSource, /if \(isMobile\)|isMobile \?/);
    assert.match(routeSource, /w-\[20%\]/);
    assert.match(routeSource, /w-\[55%\]/);
    assert.match(routeSource, /w-\[25%\]/);
});

test('mobile shell separates module navigation, topic selection, and recorder controls', () => {
    assert.equal(fs.existsSync(mobileShellPath), true);
    assert.equal(fs.existsSync(topicDrawerPath), true);
    assert.equal(fs.existsSync(recorderPath), true);

    const shellSource = fs.readFileSync(mobileShellPath, 'utf8');
    const topicSource = fs.readFileSync(topicDrawerPath, 'utf8');
    const recorderSource = fs.readFileSync(recorderPath, 'utf8');

    assert.match(shellSource, /模块：手机端页面骨架/);
    assert.match(shellSource, /MobileModuleSwitcher/);
    assert.match(shellSource, /MobileTopicDrawer/);
    assert.match(shellSource, /RecorderControls/);
    assert.match(shellSource, /h-dvh/);
    assert.match(shellSource, /safe-area-inset-bottom/);
    assert.match(topicSource, /模块：移动端主题抽屉/);
    assert.match(topicSource, /aria-expanded/);
    assert.match(recorderSource, /模块：录音控制区/);
    assert.match(recorderSource, /长按说话/);
    assert.match(recorderSource, /停止播放/);
});

test('mobile navigation uses the right side action for logout instead of module expansion', () => {
    const shellSource = fs.readFileSync(mobileShellPath, 'utf8');
    const switcherPath = path.join(repoRoot, 'lovable_ui', 'src', 'components', 'mobile', 'MobileModuleSwitcher.tsx');
    const switcherSource = fs.readFileSync(switcherPath, 'utf8');

    assert.match(shellSource, /onLogout/);
    assert.match(switcherSource, /退出/);
    assert.doesNotMatch(switcherSource, /功能模块/);
    assert.doesNotMatch(switcherSource, /aria-expanded/);
});

test('mobile settings page owns its vertical scrolling when font size is large', () => {
    const routeSource = fs.readFileSync(routePath, 'utf8');

    assert.match(routeSource, /data-mobile-settings/);
    assert.match(routeSource, /overflow-y-auto/);
    assert.match(routeSource, /pb-\[calc\(1rem\+env\(safe-area-inset-bottom\)\)\]/);
});

test('mobile recorder uses pointer events and does not end speech when recording failed to start', () => {
    const routeSource = fs.readFileSync(routePath, 'utf8');
    const recorderSource = fs.readFileSync(recorderPath, 'utf8');
    const enginePath = path.join(repoRoot, 'lovable_ui', 'src', 'hooks', 'useStoryEngine.ts');
    const engineSource = fs.readFileSync(enginePath, 'utf8');

    assert.match(routeSource, /recorderError/);
    assert.match(recorderSource, /onPointerDown/);
    assert.match(recorderSource, /onPointerUp/);
    assert.match(recorderSource, /onPointerCancel/);
    assert.match(recorderSource, /recorderError/);
    assert.match(engineSource, /window\.isSecureContext/);
    assert.match(engineSource, /recordingStateRef\.current !== "recording"/);
    assert.match(engineSource, /return false/);
});
