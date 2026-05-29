const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const hookSource = fs.readFileSync(
    path.join(__dirname, '../lovable_ui/src/hooks/useStoryEngine.ts'),
    'utf8',
);
const routeSource = fs.readFileSync(
    path.join(__dirname, '../lovable_ui/src/routes/index.tsx'),
    'utf8',
);

test('server exposes a password-confirmed self account deletion route', () => {
    assert.match(serverSource, /delete-account/);
    assert.match(serverSource, /verifyUserRequest\(req, userId\)/);
    assert.match(serverSource, /deleteOwnAccount\(userId, body\)/);
    assert.match(serverSource, /validateAccountDeletionInput\(input\)/);
    assert.match(serverSource, /verifyPassword\(validation\.value\.password/);
});

test('server no longer allows the old ordinary user DELETE route to naked-delete data', () => {
    assert.match(serverSource, /req\.method === 'DELETE'/);
    assert.match(serverSource, /请使用账号注销流程/);
    assert.doesNotMatch(
        serverSource,
        /if \(url\.pathname\.startsWith\('\/api\/user\/'\) && req\.method === 'DELETE'\)[\s\S]{0,240}deleteUser\(userId\)/,
    );
});

test('story engine exposes deleteAccount and clears local login state after success', () => {
    assert.match(hookSource, /const deleteAccount = async/);
    assert.match(hookSource, /\/api\/user\/\$\{user\.userId\}\/delete-account/);
    assert.match(hookSource, /Authorization: `Bearer \$\{user\.authToken \|\| ""\}`/);
    assert.match(hookSource, /logout\(\)/);
    assert.match(hookSource, /deleteAccount,/);
});

test('settings panel includes an explicit dangerous account deletion area', () => {
    assert.match(routeSource, /注销账号与删除资料/);
    assert.match(routeSource, /确认注销/);
    assert.match(routeSource, /onDeleteAccount/);
    assert.match(routeSource, /deleteAccount/);
});
