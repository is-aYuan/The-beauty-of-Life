const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("login page requires legal agreement and personal information processing consent", () => {
  const source = fs.readFileSync("lovable_ui/src/routes/login.tsx", "utf8");

  assert.match(source, /我已阅读并同意/);
  assert.match(source, /用户服务协议/);
  assert.match(source, /隐私政策/);
  assert.match(source, /AI 生成内容说明与免责声明/);
  assert.match(source, /我同意平台为生成回忆录/);
  assert.match(source, /请先勾选协议后继续/);
});

test("login page resets loading state when the auth request fails", () => {
  const source = fs.readFileSync("lovable_ui/src/routes/login.tsx", "utf8");

  assert.match(source, /try\s*{/);
  assert.match(source, /catch \(error\)/);
  assert.match(
    source,
    /setErrorMsg\("连接服务器失败，请确认后端服务已启动。"\)/,
  );
  assert.match(source, /finally\s*{\s*setIsLoading\(false\);/s);
});

test("login page presents unified entry flow with no login/register distinction", () => {
  const source = fs.readFileSync("lovable_ui/src/routes/login.tsx", "utf8");

  // 统一入口流线：只有"下一步"，无"登录"/"注册"区分
  assert.match(source, /下一步/);
  assert.match(source, /我同意并继续/);
  assert.match(source, /返回修改/);
  assert.match(source, /bg-\[#F9ECCD\]/);
  assert.match(source, /text-\[#5B3A22\]/);
  assert.match(source, /border-\[#C9AB78\]/);
  assert.doesNotMatch(source, /第一次使用？ 点击注册新账号/);
  assert.doesNotMatch(source, /已有专属日记本？ 返回登录/);
  assert.doesNotMatch(source, /text-stone-400/);
});

test("login page uses warm album desk visual language and concise CTAs", () => {
  const source = fs.readFileSync("lovable_ui/src/routes/login.tsx", "utf8");

  assert.match(source, /相册桌面质感/);
  assert.match(source, /暖纸张书页主卡片/);
  assert.match(source, /我们将保护您的信息/);
  assert.match(source, /手机号用于识别您的故事档案。/);
  assert.match(source, /您的信息用于整理回忆录。/);
  assert.match(source, /您可以查看、修改或删除您的信息。/);
  assert.match(source, /进入故事坊/);
  assert.match(source, /开始记录我的故事/);
  assert.doesNotMatch(source, /我们会保护这些内容/);
  assert.doesNotMatch(source, /手机号只用于识别您的故事档案。/);
  assert.doesNotMatch(source, /您的语音、文字和故事内容只用于整理回忆录。/);
  assert.doesNotMatch(source, /您可以申请查看、更正或删除自己的内容。/);
  assert.doesNotMatch(source, /翻开岁月（进入故事坊）/);
  assert.doesNotMatch(source, /开启我的传记（创建新档案）/);
  assert.doesNotMatch(source, /点击下方按钮即代表您同意/);
});

test("login phone entry keeps the primary button active and uses elder-friendly copy", () => {
  const source = fs.readFileSync("lovable_ui/src/routes/login.tsx", "utf8");

  assert.match(source, /把您的声音，整理成一本温暖的回忆录/);
  assert.match(source, /请输入您的手机号/);
  assert.match(
    source,
    /onClick={handlePhoneNext}[\s\S]*disabled={isLoading}[\s\S]*下一步/,
  );
  assert.doesNotMatch(source, /把家人的声音，整理成一本温暖的回忆录/);
  assert.doesNotMatch(source, /请输入手机号，翻开属于您的岁月相册/);
  assert.doesNotMatch(source, /翻开您的过往岁月/);
  assert.doesNotMatch(source, /disabled={isLoading \|\| phone\.length !== 11}/);
});

test("returning user branch asks for password instead of verification code", () => {
  const source = fs.readFileSync("lovable_ui/src/routes/login.tsx", "utf8");

  assert.match(source, /欢迎回来，请输入密码/);
  assert.match(source, /placeholder="输入您的密码"/);
  assert.match(source, /type="password"/);
  assert.match(
    source,
    /branch === "returning"[\s\S]*login\(phone, password, consent\)/,
  );
  assert.doesNotMatch(source, /欢迎回来，请输入验证码/);
  assert.doesNotMatch(source, /placeholder="6位验证码"/);
  assert.doesNotMatch(source, /开发模式：输入任意6位数字即可/);
});

test("login consent step has compact mobile layout for one-screen confirmation", () => {
  const source = fs.readFileSync("lovable_ui/src/routes/login.tsx", "utf8");

  assert.match(source, /min-h-\[100svh\]/);
  assert.match(source, /login-shell/);
  assert.match(source, /--login-button-height: 64px/);
  assert.match(source, /--login-button-gap: 12px/);
  assert.match(source, /--login-consent-font: 20px/);
  assert.match(source, /text-3xl[\s\S]*xs:text-5xl/);
  assert.match(source, /p-4[\s\S]*xs:p-8/);
  assert.match(source, /py-2\.5[\s\S]*xs:py-3/);
  assert.match(source, /gap: "var\(--login-button-gap\)"/);
});

test("login card stays visually centered on mobile screens", () => {
  const source = fs.readFileSync("lovable_ui/src/routes/login.tsx", "utf8");
  const styles = fs.readFileSync("lovable_ui/src/styles.css", "utf8");

  assert.match(
    source,
    /min-h-\[100svh\][\s\S]*w-screen max-w-full[\s\S]*items-center[\s\S]*justify-center/,
  );
  assert.match(source, /移动端居中舞台/);
  assert.match(
    source,
    /flex w-screen max-w-full justify-center overflow-hidden/,
  );
  assert.match(source, /my-auto/);
  assert.match(source, /w-\[min\(calc\(100vw-28px\),380px\)\]/);
  assert.match(source, /sm:w-full sm:max-w-md/);
  assert.match(source, /border-l-\[8px\]/);
  assert.match(source, /from { transform: translateX\(18px\); opacity: 0; }/);
  assert.match(source, /from { transform: translateX\(-18px\); opacity: 0; }/);
  assert.match(
    styles,
    /html,\s*body,\s*#root\s*{[\s\S]*width: 100%;[\s\S]*overflow-x: hidden;/,
  );
  assert.doesNotMatch(source, /items-start justify-center/);
  assert.doesNotMatch(source, /translateX\(100%\)/);
  assert.doesNotMatch(source, /translateX\(-100%\)/);
});

test("desktop login states use an enlarged album card layout", () => {
  const source = fs.readFileSync("lovable_ui/src/routes/login.tsx", "utf8");

  assert.match(source, /DESKTOP_INPUT_HEIGHT: "88px"/);
  assert.match(source, /DESKTOP_BUTTON_HEIGHT: "88px"/);
  assert.match(source, /DESKTOP_BUTTON_FONT: "30px"/);
  assert.match(source, /DESKTOP_CONSENT_FONT: "28px"/);
  assert.match(source, /DESKTOP_PROMPT_FONT: "24px"/);
  assert.match(source, /md:w-\[560px\]/);
  assert.match(source, /lg:w-\[620px\]/);
  assert.match(source, /md:p-10/);
  assert.match(source, /lg:p-12/);
  assert.match(source, /md:border-l-\[16px\]/);
  assert.match(source, /md:text-6xl/);
  assert.match(source, /md:h-\[72px\] md:w-\[72px\]/);
  assert.match(
    source,
    /--login-input-height: \$\{STYLE\.DESKTOP_INPUT_HEIGHT\}/,
  );
  assert.match(source, /--login-input-font: \$\{STYLE\.DESKTOP_INPUT_FONT\}/);
  assert.match(source, /--login-prompt-font: \$\{STYLE\.DESKTOP_PROMPT_FONT\}/);
});

test("album desk corner decoration stays inside the mobile background frame", () => {
  const source = fs.readFileSync("lovable_ui/src/routes/login.tsx", "utf8");

  assert.match(source, /absolute bottom-4 right-4 h-28 w-40/);
  assert.match(source, /xs:bottom-6 xs:right-6 xs:h-36 xs:w-52/);
  assert.match(source, /sm:bottom-8 sm:right-8 sm:h-40 sm:w-56/);
  assert.doesNotMatch(source, /right-3 -bottom-8/);
});
