const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const adminPath = path.join(__dirname, '..', 'lovable_ui', 'src', 'routes', 'admin.tsx');
const panelPath = path.join(
    __dirname,
    '..',
    'lovable_ui',
    'src',
    'components',
    'admin',
    'UsageCostPanel.tsx',
);

test('admin route exposes a cost monitoring view backed by the usage endpoint', () => {
    const source = fs.readFileSync(adminPath, 'utf8');

    assert.match(source, /成本监控/);
    assert.match(source, /activeView/);
    assert.match(source, /\/api\/admin\/usage\?range=7d/);
    assert.match(source, /UsageCostPanel/);
});

test('usage cost panel renders cost, token, voice curves and breakdown tables', () => {
    const source = fs.readFileSync(panelPath, 'utf8');

    assert.match(source, /今日预估成本/);
    assert.match(source, /本月预估成本/);
    assert.match(source, /今日 Token/);
    assert.match(source, /今日语音分钟/);
    assert.match(source, /LineChart/);
    assert.match(source, /BarChart/);
    assert.match(source, /供应商拆分/);
    assert.match(source, /功能拆分/);
    assert.match(source, /价格表未配置/);
});

test('usage cost panel normalizes malformed usage payloads before rendering charts', () => {
    const source = fs.readFileSync(panelPath, 'utf8');

    assert.match(source, /normalizeAdminUsage/);
    assert.match(source, /Array\.isArray\(usage\?\.timeline\)/);
    assert.match(source, /EMPTY_USAGE/);
});
