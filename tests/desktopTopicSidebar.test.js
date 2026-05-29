const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routePath = path.join(__dirname, '../lovable_ui/src/routes/index.tsx');

test('desktop topic sidebar only renders in the story tab and frees space elsewhere', () => {
    const source = fs.readFileSync(routePath, 'utf8');

    assert.match(source, /const showDesktopTopicSidebar = activeTab === "story"/);
    assert.match(source, /showDesktopTopicSidebar \? "w-\[55%\]" : "flex-1"/);
    assert.match(source, /\{showDesktopTopicSidebar && \(/);
    assert.match(source, /data-desktop-topic-sidebar/);
});
