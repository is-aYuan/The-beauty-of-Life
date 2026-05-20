const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const adminRoutePath = path.join(__dirname, '..', 'lovable_ui', 'src', 'routes', 'admin.tsx');
const panelPath = path.join(
    __dirname,
    '..',
    'lovable_ui',
    'src',
    'components',
    'admin',
    'FamilyVoicePanel.tsx',
);

test('admin detail modal exposes the family voice mock tab', () => {
    const source = fs.readFileSync(adminRoutePath, 'utf8');

    assert.match(source, /FamilyVoicePanel/);
    assert.match(source, /id: "familyVoice", label: "亲情声音"/);
    assert.match(source, /activeTab === "familyVoice"/);
});

test('family voice mock panel marks the feature as internal testing', () => {
    const source = fs.readFileSync(panelPath, 'utf8');

    assert.match(source, /该功能内部测试中，敬请期待！/);
    assert.match(source, /添加我的声音/);
    assert.match(source, /录制 5 句话/);
    assert.match(source, /确认本人授权/);
    assert.match(source, /生成陪伴声音/);
    assert.match(source, /默认 AI 温暖女声/);
});
