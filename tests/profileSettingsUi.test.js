const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = fs.readFileSync(
    path.join(__dirname, '../lovable_ui/src/routes/index.tsx'),
    'utf8',
);
const hookSource = fs.readFileSync(
    path.join(__dirname, '../lovable_ui/src/hooks/useStoryEngine.ts'),
    'utf8',
);

test('story engine exposes profile update and keeps story_user cache synchronized', () => {
    assert.match(hookSource, /const updateUserProfile = async/);
    assert.match(hookSource, /\/api\/user\/\$\{user\.userId\}\/profile/);
    assert.match(hookSource, /localStorage\.setItem\("story_user", JSON\.stringify\(nextUser\)\)/);
    assert.match(hookSource, /updateUserProfile,/);
});

test('settings panel renders personal info fields with phone read-only', () => {
    assert.match(routeSource, /function SettingsPanel\(/);
    assert.match(routeSource, /个人信息/);
    assert.match(routeSource, /姓名/);
    assert.match(routeSource, /年龄/);
    assert.match(routeSource, /手机号/);
    assert.match(routeSource, /readOnly/);
    assert.match(routeSource, /onUpdateProfile/);
    assert.match(routeSource, /updateUserProfile/);
});
