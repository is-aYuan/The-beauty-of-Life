const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

test('server exposes one guarded profile update path for editable account fields', () => {
    const updateFunctionMatches = serverSource.match(/async function updateUserProfile/g) || [];

    assert.equal(updateFunctionMatches.length, 1);
    assert.equal(serverSource.includes('^\\/api\\/user\\/[^/]+\\/profile$'), true);
    assert.match(serverSource, /verifyUserRequest\(req, userId\)/);
    assert.match(serverSource, /normalizeUserProfileUpdate\(input\)/);
    assert.match(serverSource, /result\.authToken = auth\.authToken/);
});
