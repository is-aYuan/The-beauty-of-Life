const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routePath = path.join(__dirname, '..', 'lovable_ui', 'src', 'routes', 'index.tsx');
const panelPath = path.join(
    __dirname,
    '..',
    'lovable_ui',
    'src',
    'components',
    'FamilyConnectionPanel.tsx',
);

test('story app renders a dedicated family connection panel for the family tab', () => {
    const source = fs.readFileSync(routePath, 'utf8');

    assert.match(source, /FamilyConnectionPanel/);
    assert.match(source, /activeTab === "family"/);
});

test('family connection mock panel explains the internal testing voice feature', () => {
    const source = fs.readFileSync(panelPath, 'utf8');

    assert.match(source, /该功能内部测试中，敬请期待！/);
    assert.match(source, /默认 AI 温暖女声/);
    assert.match(source, /女儿小郑/);
    assert.match(source, /确认本人授权/);
    assert.match(source, /不代表家人本人正在实时说话/);
});
