const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const serverPath = path.join(repoRoot, 'server.js');
const enginePath = path.join(repoRoot, 'lovable_ui', 'src', 'hooks', 'useStoryEngine.ts');
const routePath = path.join(repoRoot, 'lovable_ui', 'src', 'routes', 'index.tsx');

test('server exposes biography export endpoints without regenerating the biography', () => {
    const source = fs.readFileSync(serverPath, 'utf8');

    assert.match(source, /\/api\/biographies\/\[\^\/\]\+\/export/);
    assert.match(source, /sendBiographyExport/);
    assert.match(source, /createBiographyExportBuffer/);
    assert.match(source, /Content-Disposition/);
    assert.match(source, /attachment/);
});

test('story engine downloads exported biography files as browser blobs', () => {
    const source = fs.readFileSync(enginePath, 'utf8');

    assert.match(source, /downloadBiography/);
    assert.match(source, /\/api\/biographies\/\$\{user\.userId\}\/export\?format=\$\{format\}/);
    assert.match(source, /res\.blob\(\)/);
    assert.match(source, /URL\.createObjectURL/);
    assert.match(source, /a\.download = filename/);
});

test('organizer UI presents generate and download actions on desktop and mobile', () => {
    const source = fs.readFileSync(routePath, 'utf8');

    assert.match(source, /下载我的回忆录/);
    assert.match(source, /handleOpenDownloadBiography/);
    assert.match(source, /handleDownloadBiography/);
    assert.match(source, /downloadDialogOpen/);
    assert.match(source, /下载 PDF/);
    assert.match(source, /下载 Word/);
    assert.ok((source.match(/下载我的回忆录/g) || []).length >= 2);
});
