const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const adminRouteSource = fs.readFileSync(
    path.join(__dirname, '../lovable_ui/src/routes/admin.tsx'),
    'utf8',
);
const adminUserManagementSource = fs.readFileSync(
    path.join(__dirname, '../lovable_ui/src/components/admin/AdminUserManagementPanel.tsx'),
    'utf8',
);
const adminDeleteUserSource = fs.readFileSync(
    path.join(__dirname, '../lovable_ui/src/components/admin/AdminDeleteUserDialog.tsx'),
    'utf8',
);

test('server exposes admin create and update user routes', () => {
    assert.match(serverSource, /url\.pathname === '\/api\/admin\/users' && req\.method === 'POST'/);
    assert.match(serverSource, /const updateAdminUserMatch = url\.pathname\.match/);
    assert.match(serverSource, /req\.method === 'PATCH'/);
    assert.match(serverSource, /updateAdminUser\(updateAdminUserMatch\[1\], body\)/);
});

test('server requires confirmation text for admin user deletion', () => {
    assert.match(serverSource, /validateAdminDeleteUserInput\(body\)/);
    assert.match(serverSource, /deleteUser\(deleteMatch\[1\]\)/);
});

test('admin detail modal no longer contains the old test-account delete action', () => {
    assert.doesNotMatch(adminRouteSource, /删除测试账号/);
});

test('admin user management module owns the user delete action', () => {
    assert.match(adminRouteSource, /AdminUserManagementPanel/);
    assert.match(adminDeleteUserSource, /删除用户/);
    assert.match(adminUserManagementSource, /method: "DELETE"/);
});

test('admin user status badge stays on one line in the dense table', () => {
    assert.match(adminUserManagementSource, /w-\[72px\]/);
    assert.match(adminUserManagementSource, /whitespace-nowrap/);
});

test('admin user management panel fills the main content gutter', () => {
    assert.match(adminRouteSource, /className="-mx-8"/);
    assert.match(adminRouteSource, /<AdminUserManagementPanel/);
});

test('admin user management removes the top blank gutter under the navbar', () => {
    assert.match(adminRouteSource, /activeView === "users" \? "flex-1 px-8 pb-8 pt-0" : "flex-1 p-8"/);
});

test('admin user management uses one compact module header instead of a duplicate blank toolbar', () => {
    assert.match(adminRouteSource, /activeView !== "users" && \(/);
    assert.match(adminUserManagementSource, /<h2[^>]*>用户管理<\/h2>/);
    assert.match(adminUserManagementSource, /对长辈账号进行新增、查询、编辑和删除。/);
    assert.match(adminUserManagementSource, /lg:items-center lg:justify-between/);
});

test('admin user management places refresh and create actions in the same toolbar', () => {
    assert.match(adminRouteSource, /activeView !== "users"/);
    assert.match(adminUserManagementSource, /刷新数据/);
    assert.match(adminUserManagementSource, /新增用户/);
    assert.match(adminUserManagementSource, /flex justify-end gap-3/);
});
