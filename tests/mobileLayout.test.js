const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");
const routePath = path.join(
  repoRoot,
  "lovable_ui",
  "src",
  "routes",
  "index.tsx",
);
const mobileShellPath = path.join(
  repoRoot,
  "lovable_ui",
  "src",
  "components",
  "mobile",
  "MobileAppShell.tsx",
);
const topicDrawerPath = path.join(
  repoRoot,
  "lovable_ui",
  "src",
  "components",
  "mobile",
  "MobileTopicDrawer.tsx",
);
const switcherPath = path.join(
  repoRoot,
  "lovable_ui",
  "src",
  "components",
  "mobile",
  "MobileModuleSwitcher.tsx",
);
const recorderPath = path.join(
  repoRoot,
  "lovable_ui",
  "src",
  "components",
  "story",
  "RecorderControls.tsx",
);
const chatBubblePath = path.join(
  repoRoot,
  "lovable_ui",
  "src",
  "components",
  "story",
  "ChatMessageBubble.tsx",
);
const composerPath = path.join(
  repoRoot,
  "lovable_ui",
  "src",
  "components",
  "story",
  "TextInputComposer.tsx",
);
const stylesPath = path.join(repoRoot, "lovable_ui", "src", "styles.css");
const loginPath = path.join(
  repoRoot,
  "lovable_ui",
  "src",
  "routes",
  "login.tsx",
);
const micSetupPath = path.join(
  repoRoot,
  "lovable_ui",
  "src",
  "routes",
  "mic-setup.tsx",
);
const familyPath = path.join(
  repoRoot,
  "lovable_ui",
  "src",
  "components",
  "FamilyConnectionPanel.tsx",
);

test("home route keeps desktop layout but branches to a mobile app shell", () => {
  const routeSource = fs.readFileSync(routePath, "utf8");

  assert.match(routeSource, /useIsMobile/);
  assert.match(routeSource, /MobileAppShell/);
  assert.match(routeSource, /if \(isMobile\)|isMobile \?/);
  assert.match(routeSource, /w-\[20%\]/);
  assert.match(routeSource, /w-\[55%\]/);
  assert.match(routeSource, /w-\[25%\]/);
});

test("mobile shell separates module navigation, topic selection, and recorder controls", () => {
  assert.equal(fs.existsSync(mobileShellPath), true);
  assert.equal(fs.existsSync(topicDrawerPath), true);
  assert.equal(fs.existsSync(recorderPath), true);

  const shellSource = fs.readFileSync(mobileShellPath, "utf8");
  const topicSource = fs.readFileSync(topicDrawerPath, "utf8");
  const recorderSource = fs.readFileSync(recorderPath, "utf8");

  assert.match(shellSource, /模块：手机端页面骨架/);
  assert.match(shellSource, /MobileModuleSwitcher/);
  assert.match(shellSource, /MobileTopicDrawer/);
  assert.match(shellSource, /RecorderControls/);
  assert.match(shellSource, /h-\[100svh\]/);
  assert.match(shellSource, /max-h-\[100svh\]/);
  assert.match(shellSource, /min-w-0/);
  assert.match(shellSource, /max-w-full/);
  assert.match(shellSource, /overflow-x-hidden/);
  assert.match(shellSource, /safe-area-inset-bottom/);
  assert.match(topicSource, /模块：移动端主题抽屉/);
  assert.match(topicSource, /aria-expanded/);
  assert.match(recorderSource, /模块：录音控制区/);
  assert.match(recorderSource, /长按说话/);
  assert.match(recorderSource, /录音上传/);
  assert.match(recorderSource, /打字输入/);
  assert.doesNotMatch(recorderSource, /桌上畅聊/);
  assert.match(recorderSource, /停止播放/);
});

test("mobile topic selection mode uses the freed recorder space for a scrollable topic grid", () => {
  const shellSource = fs.readFileSync(mobileShellPath, "utf8");
  const topicSource = fs.readFileSync(topicDrawerPath, "utf8");

  assert.match(
    shellSource,
    /const handleSelectTopic[\s\S]*onTopicSelect\(topicId\);[\s\S]*\[onTopicSelect\]/,
  );
  assert.doesNotMatch(
    shellSource,
    /const handleSelectTopic[\s\S]*setTopicExpanded\(false\);[\s\S]*\[onTopicSelect\]/,
  );
  assert.match(shellSource, /\{!topicExpanded && \(/);
  assert.match(topicSource, /模块：主题选择模式/);
  assert.match(topicSource, /data-mobile-topic-scroll/);
  assert.match(topicSource, /data-mobile-topic-collapse/);
  assert.match(topicSource, /grid-cols-1/);
  assert.match(topicSource, /xs:grid-cols-2/);
  assert.match(topicSource, /sticky bottom-0/);
  assert.doesNotMatch(topicSource, /expanded \? "收起" : "换主题"/);
});

test("mobile navigation uses the right side action for logout instead of module expansion", () => {
  const shellSource = fs.readFileSync(mobileShellPath, "utf8");
  const switcherSource = fs.readFileSync(switcherPath, "utf8");

  assert.match(shellSource, /onLogout/);
  assert.match(switcherSource, /aria-label="退出登录"/);
  assert.match(switcherSource, /h-9 w-9/);
  assert.match(switcherSource, /xs:h-10 xs:w-10/);
  assert.match(switcherSource, /text-\[11px\]/);
  assert.match(switcherSource, /sr-only/);
  assert.doesNotMatch(switcherSource, /功能模块/);
  assert.doesNotMatch(switcherSource, /aria-expanded/);
  assert.doesNotMatch(switcherSource, /min-w-14/);
  assert.doesNotMatch(switcherSource, />退出<\/span>/);
});

test("mobile settings page owns its vertical scrolling when font size is large", () => {
  const routeSource = fs.readFileSync(routePath, "utf8");

  assert.match(routeSource, /data-mobile-settings/);
  assert.match(routeSource, /overflow-y-auto/);
  assert.match(
    routeSource,
    /pb-\[calc\(1rem\+env\(safe-area-inset-bottom\)\)\]/,
  );
});

test("mobile recorder uses pointer events and does not end speech when recording failed to start", () => {
  const routeSource = fs.readFileSync(routePath, "utf8");
  const recorderSource = fs.readFileSync(recorderPath, "utf8");
  const enginePath = path.join(
    repoRoot,
    "lovable_ui",
    "src",
    "hooks",
    "useStoryEngine.ts",
  );
  const engineSource = fs.readFileSync(enginePath, "utf8");

  assert.match(routeSource, /recorderError/);
  assert.match(recorderSource, /onPointerDown/);
  assert.match(recorderSource, /onPointerUp/);
  assert.match(recorderSource, /onPointerCancel/);
  assert.match(recorderSource, /recorderError/);
  assert.match(engineSource, /window\.isSecureContext/);
  assert.match(engineSource, /recordingStateRef\.current !== "recording"/);
  assert.match(engineSource, /return false/);
});

test("mobile recorder uses the warm gold recording button palette", () => {
  const recorderSource = fs.readFileSync(recorderPath, "utf8");
  const guidancePath = path.join(
    repoRoot,
    "lovable_ui",
    "src",
    "lib",
    "entryGuidance.js",
  );
  const guidanceSource = fs.readFileSync(guidancePath, "utf8");

  assert.match(recorderSource, /bg-\[#FFEA92\]/);
  assert.match(recorderSource, /text-\[#241F1C\]/);
  assert.match(recorderSource, /border-\[#F5D76B\]/);
  assert.match(
    recorderSource,
    /shadow-\[0_8px_18px_rgba\(160,120,30,0\.16\)\]/,
  );
  assert.match(recorderSource, /bg-\[#241F1C\]/);
  assert.doesNotMatch(recorderSource, /bg-red-600/);
  assert.doesNotMatch(guidanceSource, /红色按钮/);
});

test("mobile responsive foundation prevents page-level horizontal overflow", () => {
  const stylesSource = fs.readFileSync(stylesPath, "utf8");
  const bubbleSource = fs.readFileSync(chatBubblePath, "utf8");
  const composerSource = fs.readFileSync(composerPath, "utf8");
  const recorderSource = fs.readFileSync(recorderPath, "utf8");
  const routeSource = fs.readFileSync(routePath, "utf8");

  assert.match(stylesSource, /--breakpoint-xs: 375px/);
  assert.match(stylesSource, /overflow-x: hidden/);
  assert.match(stylesSource, /\.mobile-safe-text/);
  assert.match(stylesSource, /overflow-wrap: anywhere/);
  assert.match(bubbleSource, /mobile-safe-text/);
  assert.match(bubbleSource, /grid-cols-\[auto_minmax\(0,1fr\)\]/);
  assert.match(bubbleSource, /grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(bubbleSource, /overflow-x-hidden/);
  assert.doesNotMatch(bubbleSource, /max-w-\[92%\]/);
  assert.doesNotMatch(bubbleSource, /xs:max-w-\[88%\]/);
  assert.match(composerSource, /min-w-0/);
  assert.match(composerSource, /xs:min-h-\[60px\]/);
  assert.match(recorderSource, /xs:min-h-\[60px\]/);
  assert.match(routeSource, /overflow-y-auto overflow-x-hidden/);
  assert.match(recorderSource, /text-sm[\s\S]*xs:min-h-11 xs:text-base/);
});

test("user-facing entry pages use small-screen size steps", () => {
  const loginSource = fs.readFileSync(loginPath, "utf8");
  const micSource = fs.readFileSync(micSetupPath, "utf8");
  const familySource = fs.readFileSync(familyPath, "utf8");
  const routeSource = fs.readFileSync(routePath, "utf8");

  assert.match(loginSource, /p-3 xs:p-6/);
  assert.match(loginSource, /text-4xl[\s\S]*xs:text-5xl/);
  assert.match(loginSource, /p-5[\s\S]*xs:p-8/);
  assert.match(micSource, /h-36 w-36/);
  assert.match(micSource, /xs:h-44 xs:w-44 xs:text-2xl/);
  assert.match(familySource, /flex-col[\s\S]*xs:flex-row/);
  assert.match(familySource, /text-3xl[\s\S]*xs:text-4xl/);
  assert.match(routeSource, /grid-cols-2[\s\S]*sm:grid-cols-4/);
  assert.match(routeSource, /mobile-safe-text/);
});

test("mobile topic selection uses the same warm gold palette as recording controls", () => {
  const topicSource = fs.readFileSync(topicDrawerPath, "utf8");

  assert.match(topicSource, /bg-\[#FFEA92\]/);
  assert.match(topicSource, /text-\[#241F1C\]/);
  assert.match(topicSource, /border-\[#F5D76B\]/);
  assert.match(topicSource, /shadow-\[0_10px_24px_rgba\(160,120,30,0\.18\)\]/);
  assert.match(topicSource, /data-mobile-topic-collapse[\s\S]*bg-\[#FFEA92\]/);
  assert.doesNotMatch(topicSource, /bg-amber-300/);
});

test("mobile collapsed topic row uses chat topic wording and compact sizing", () => {
  const topicSource = fs.readFileSync(topicDrawerPath, "utf8");

  assert.match(topicSource, /聊天主题：/);
  assert.match(topicSource, /px-3 py-2/);
  assert.match(topicSource, /xs:px-4/);
  assert.match(topicSource, /min-h-\[44px\]/);
  assert.match(topicSource, /min-h-\[52px\]/);
  assert.doesNotMatch(topicSource, />当前主题</);
});
