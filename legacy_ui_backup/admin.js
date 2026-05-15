/**
 * 故事坊管理后台 - 前端逻辑
 */

const API_BASE = '';
let adminToken = localStorage.getItem('admin_token') || '';
let currentUserId = null;

// ===== 初始化 =====

document.addEventListener('DOMContentLoaded', () => {
    if (adminToken) {
        showAdminPanel();
    }
    bindEvents();
});

function bindEvents() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('refreshBtn').addEventListener('click', loadUsers);
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('deleteUserBtn').addEventListener('click', handleDeleteUser);
    document.querySelector('.modal__overlay').addEventListener('click', closeModal);

    document.querySelectorAll('.modal__tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
}

// ===== 登录/登出 =====

async function handleLogin(e) {
    e.preventDefault();
    const phone = document.getElementById('adminPhone').value.trim();
    const password = document.getElementById('adminPassword').value;
    const errorEl = document.getElementById('loginError');

    if (!phone || !password) {
        errorEl.textContent = '请输入手机号和密码';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, password }),
        });
        const data = await res.json();

        if (data.success) {
            adminToken = data.token;
            localStorage.setItem('admin_token', adminToken);
            errorEl.textContent = '';
            showAdminPanel();
        } else {
            errorEl.textContent = data.message || '登录失败';
        }
    } catch (err) {
        errorEl.textContent = '网络错误，请重试';
    }
}

function handleLogout() {
    adminToken = '';
    localStorage.removeItem('admin_token');
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('adminSection').classList.add('hidden');
    document.getElementById('adminPhone').value = '';
    document.getElementById('adminPassword').value = '';
}

function showAdminPanel() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('adminSection').classList.remove('hidden');
    loadStats();
    loadUsers();
}

// ===== 数据加载 =====

async function authFetch(url) {
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    if (res.status === 401) {
        handleLogout();
        throw new Error('登录已过期');
    }
    return res;
}

async function loadStats() {
    try {
        const res = await authFetch(`${API_BASE}/api/admin/stats`);
        const data = await res.json();
        document.getElementById('statUsers').textContent = data.totalUsers;
        document.getElementById('statSessions').textContent = data.totalSessions;
        document.getElementById('statConversations').textContent = data.totalConversations;
        document.getElementById('statSummaries').textContent = data.totalSummaries;
    } catch (err) {
        console.error('加载统计失败:', err);
    }
}

async function loadUsers() {
    try {
        const res = await authFetch(`${API_BASE}/api/admin/users`);
        const users = await res.json();
        renderUsers(users);
    } catch (err) {
        console.error('加载用户失败:', err);
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('usersBody');

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#5A5E6E;padding:40px;">暂无用户</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${escapeHtml(user.name || '-')}</td>
            <td>${escapeHtml(user.phone || '-')}</td>
            <td>${user.age || '-'}</td>
            <td>${user.sessionCount}</td>
            <td>${user.conversationCount}</td>
            <td>${user.summaryCount}</td>
            <td>
                <button class="detail-btn" onclick="openUserDetail('${user._id}', '${escapeHtml(user.name)}')">
                    查看详情
                </button>
            </td>
        </tr>
    `).join('');
}

// ===== 用户详情弹窗 =====

async function openUserDetail(userId, userName) {
    currentUserId = userId;
    document.getElementById('modalUserName').textContent = `${userName} 的数据`;
    document.getElementById('userModal').classList.remove('hidden');
    switchTab('conversations');
}

function closeModal() {
    document.getElementById('userModal').classList.add('hidden');
    currentUserId = null;
}

function switchTab(tabName) {
    document.querySelectorAll('.modal__tab').forEach(t => {
        t.classList.toggle('modal__tab--active', t.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

    if (tabName === 'conversations') {
        document.getElementById('tabConversations').classList.remove('hidden');
        loadConversations();
    } else if (tabName === 'summaries') {
        document.getElementById('tabSummaries').classList.remove('hidden');
        loadSummaries();
    } else if (tabName === 'memory') {
        document.getElementById('tabMemory').classList.remove('hidden');
        loadMemoryProfile();
    } else if (tabName === 'biographies') {
        document.getElementById('tabBiographies').classList.remove('hidden');
        loadBiographies();
    }
}

async function loadConversations() {
    const container = document.getElementById('tabConversations');
    container.innerHTML = '<div class="empty-state">加载中...</div>';

    try {
        const res = await authFetch(`${API_BASE}/api/admin/user/${currentUserId}/conversations`);
        const data = await res.json();

        if (data.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无对话记录</div>';
            return;
        }

        container.innerHTML = data.map(c => `
            <div class="conversation-item">
                <div class="conversation-item__user">用户：${escapeHtml(c.userText)}</div>
                <div class="conversation-item__ai">AI：${escapeHtml(c.aiReply)}</div>
                <div class="conversation-item__time">${formatTime(c.timestamp)}</div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = '<div class="empty-state">加载失败</div>';
    }
}

async function loadSummaries() {
    const container = document.getElementById('tabSummaries');
    container.innerHTML = '<div class="empty-state">加载中...</div>';

    try {
        const res = await authFetch(`${API_BASE}/api/admin/user/${currentUserId}/summaries`);
        const data = await res.json();

        if (data.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无叙事摘要</div>';
            return;
        }

        let html = '';
        for (const s of data) {
            if (!s.narratives || s.narratives.length === 0) {
                html += `
                    <div class="summary-item">
                        <div class="summary-item__header">
                            <span class="summary-item__title">会话摘要（无实质内容）</span>
                            <span style="font-size:0.8rem;color:#5A5E6E">${formatTime(s.createdAt)}</span>
                        </div>
                        <div class="summary-item__content">${escapeHtml(s.emotionalNote || '')}</div>
                        ${s.coverage?.unexplored?.length ? `
                            <div class="summary-item__facts">
                                <strong>可引导话题：</strong>${s.coverage.unexplored.join('、')}
                            </div>
                        ` : ''}
                    </div>
                `;
            } else {
                for (const n of s.narratives) {
                    html += `
                        <div class="summary-item">
                            <div class="summary-item__header">
                                <span class="summary-item__theme">${escapeHtml(n.theme)}</span>
                                <span class="summary-item__title">${escapeHtml(n.title)}</span>
                            </div>
                            <div class="summary-item__content">${escapeHtml(n.content)}</div>
                            ${n.keyFacts?.length ? `
                                <div class="summary-item__facts">
                                    <strong>关键事实：</strong>${n.keyFacts.join('；')}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }
            }
        }
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = '<div class="empty-state">加载失败</div>';
    }
}

async function loadMemoryProfile() {
    const container = document.getElementById('tabMemory');
    container.innerHTML = '<div class="empty-state">加载中...</div>';

    try {
        const res = await authFetch(`${API_BASE}/api/admin/user/${currentUserId}/memory-profile`);
        const data = await res.json();

        if (!data || !data.people) {
            container.innerHTML = '<div class="empty-state">暂无记忆档案</div>';
            return;
        }

        const readyCount = data.readyCount || 0;
        const readiness = data.readiness || {};
        const readinessItems = [
            { key: 'timeline', label: '时间线完整' },
            { key: 'keyPeople', label: '关键人物' },
            { key: 'depth', label: '深入程度' },
            { key: 'stories', label: '具体故事' },
            { key: 'emotions', label: '情感表达' },
        ];

        let html = `
            <div style="margin-bottom:20px;padding:16px;background:rgba(74,144,217,0.08);border-radius:8px;">
                <div style="font-weight:600;margin-bottom:8px;">就绪度：${readyCount}/5 维度达标</div>
                <div style="font-size:0.85rem;color:#8B8FA3;">
                    素材字数：${data.totalWordCount || 0} 字
                    ${readyCount >= 4 && (data.totalWordCount || 0) >= 10000 ? '<br><span style="color:#2ECC71;font-weight:600;">✓ 已达到生成自传标准</span>' : ''}
                </div>
                <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;">
                    ${readinessItems.map(item => {
                        const status = readiness[item.key]?.status;
                        return `<span style="padding:3px 10px;border-radius:20px;font-size:0.8rem;background:${status ? '#2ECC71' : '#555'};color:white;">${status ? '✓' : '✗'} ${item.label}</span>`;
                    }).join('')}
                </div>
            </div>
        `;

        if (data.people?.length > 0) {
            html += '<h3 style="font-size:1rem;margin:16px 0 10px;color:#4A90D9;">人物</h3>';
            for (const p of data.people) {
                html += `
                    <div class="summary-item">
                        <div class="summary-item__header">
                            <span class="summary-item__title">${escapeHtml(p.name)}</span>
                            <span class="summary-item__theme">${escapeHtml(p.relation)}</span>
                        </div>
                        <div class="summary-item__content">${escapeHtml(p.details || p.mentionedIn || '')}</div>
                    </div>
                `;
            }
        }

        if (data.places?.length > 0) {
            html += '<h3 style="font-size:1rem;margin:16px 0 10px;color:#4A90D9;">地点</h3>';
            for (const p of data.places) {
                html += `
                    <div class="summary-item">
                        <div class="summary-item__header">
                            <span class="summary-item__title">${escapeHtml(p.name)}</span>
                        </div>
                        <div class="summary-item__content">${escapeHtml(p.context || '')}</div>
                    </div>
                `;
            }
        }

        if (data.events?.length > 0) {
            html += '<h3 style="font-size:1rem;margin:16px 0 10px;color:#4A90D9;">事件</h3>';
            for (const e of data.events) {
                html += `
                    <div class="summary-item">
                        <div class="summary-item__header">
                            <span class="summary-item__title">${escapeHtml(e.time || '未知时间')}</span>
                            <span class="summary-item__theme" style="background:${e.emotionalWeight === 'high' ? '#E74C3C' : e.emotionalWeight === 'medium' ? '#F39C12' : '#555'}">${e.emotionalWeight}</span>
                        </div>
                        <div class="summary-item__content">${escapeHtml(e.description)}</div>
                    </div>
                `;
            }
        }

        if (data.emotions?.length > 0) {
            html += '<h3 style="font-size:1rem;margin:16px 0 10px;color:#4A90D9;">情感</h3>';
            for (const e of data.emotions) {
                html += `
                    <div class="summary-item">
                        <div class="summary-item__content">${escapeHtml(e.feeling)}（触发：${escapeHtml(e.trigger || '未知')}）</div>
                    </div>
                `;
            }
        }

        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = '<div class="empty-state">加载失败</div>';
    }
}

async function loadBiographies() {
    const container = document.getElementById('tabBiographies');
    container.innerHTML = '<div class="empty-state">加载中...</div>';

    try {
        const res = await authFetch(`${API_BASE}/api/admin/user/${currentUserId}/biographies`);
        const data = await res.json();

        let html = `
            <div style="margin-bottom:16px;">
                <button id="adminGenerateBtn" class="detail-btn" style="padding:10px 20px;font-size:0.9rem;">生成自传</button>
                <span id="adminBioStatus" style="margin-left:12px;font-size:0.85rem;color:#8B8FA3;"></span>
            </div>
        `;

        if (data.length === 0) {
            html += '<div class="empty-state">暂无成品自传</div>';
        } else {
            for (const bio of data) {
                const chaptersHtml = (bio.chapters || []).map(ch =>
                    `<div style="margin:12px 0;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;">
                        <div style="font-weight:600;margin-bottom:8px;color:#4A90D9;">第${ch.number}章 ${escapeHtml(ch.title)}</div>
                        <div style="white-space:pre-wrap;line-height:1.8;color:#B0B0B0;">${escapeHtml(ch.content)}</div>
                    </div>`
                ).join('');

                html += `
                    <div class="summary-item" style="margin-bottom:16px;">
                        <div class="summary-item__header">
                            <span class="summary-item__title" style="font-size:1.1rem;">《${escapeHtml(bio.title)}》</span>
                            <span style="font-size:0.8rem;color:#5A5E6E">${formatTime(bio.createdAt)}</span>
                        </div>
                        <div style="margin:8px 0;font-size:0.85rem;color:#8B8FA3;">
                            ${escapeHtml(bio.tier)} · ${bio.chapterCount} 章 · ${bio.wordCount} 字 · ${bio.status === 'draft' ? '草稿' : '定稿'}
                        </div>
                        <details>
                            <summary style="cursor:pointer;color:#4A90D9;font-size:0.9rem;">展开查看完整内容</summary>
                            ${chaptersHtml}
                        </details>
                        <div style="margin-top:12px;">
                            <button class="delete-btn" style="font-size:0.8rem;padding:6px 12px;" onclick="deleteBiography('${bio._id}')">删除</button>
                        </div>
                    </div>
                `;
            }
        }

        container.innerHTML = html;

        // 绑定生成按钮
        document.getElementById('adminGenerateBtn')?.addEventListener('click', handleAdminGenerateBiography);
    } catch (err) {
        container.innerHTML = '<div class="empty-state">加载失败</div>';
    }
}

async function handleAdminGenerateBiography() {
    const statusEl = document.getElementById('adminBioStatus');
    const btn = document.getElementById('adminGenerateBtn');

    if (!confirm('确定要为该用户生成自传吗？')) return;

    btn.disabled = true;
    statusEl.textContent = '正在生成，请稍候...';
    statusEl.style.color = '#F39C12';

    try {
        const res = await fetch(`${API_BASE}/api/admin/user/${currentUserId}/biographies/generate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}` },
        });
        const data = await res.json();

        if (data.success) {
            statusEl.textContent = `生成成功！《${data.title}》${data.chapterCount}章 ${data.wordCount}字`;
            statusEl.style.color = '#2ECC71';
            loadBiographies();
        } else {
            statusEl.textContent = data.error || '生成失败';
            statusEl.style.color = '#E74C3C';
        }
    } catch (err) {
        statusEl.textContent = '网络错误';
        statusEl.style.color = '#E74C3C';
    } finally {
        btn.disabled = false;
    }
}

async function deleteBiography(bioId) {
    if (!confirm('确定要删除这本自传吗？')) return;

    try {
        const res = await fetch(`${API_BASE}/api/admin/biography/${bioId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` },
        });
        const data = await res.json();

        if (data.success) {
            loadBiographies();
        } else {
            alert('删除失败');
        }
    } catch (err) {
        alert('网络错误');
    }
}

// ===== 删除用户 =====

async function handleDeleteUser() {
    if (!currentUserId) return;

    const confirmed = confirm('确定要删除此用户及其所有数据吗？\n\n此操作不可撤销，将删除：\n- 用户资料\n- 所有会话记录\n- 所有对话记录\n- 所有叙事摘要\n- 记忆档案\n- 成品自传');
    if (!confirmed) return;

    try {
        const res = await fetch(`${API_BASE}/api/admin/user/${currentUserId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` },
        });
        const data = await res.json();

        if (data.success) {
            alert(`删除成功\n- 对话记录：${data.deletedConversations} 条\n- 叙事摘要：${data.deletedSummaries} 条\n- 记忆档案：${data.deletedMemoryProfiles || 0} 条\n- 成品自传：${data.deletedBiographies || 0} 条\n- 会话记录：${data.deletedSessions} 条`);
            closeModal();
            loadStats();
            loadUsers();
        } else {
            alert('删除失败：' + (data.error || '未知错误'));
        }
    } catch (err) {
        alert('网络错误，请重试');
    }
}

// ===== 工具函数 =====

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatMarkdown(text) {
    if (!text) return '';
    return escapeHtml(text)
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/\n/g, '<br>');
}

// 自动刷新（30秒）
setInterval(() => {
    if (adminToken && !document.getElementById('adminSection').classList.contains('hidden')) {
        loadStats();
    }
}, 30000);
