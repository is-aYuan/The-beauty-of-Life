import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Users,
  MessageSquare,
  MessagesSquare,
  BookText,
  LayoutDashboard,
  UsersRound,
  Settings,
  BarChart3,
  X,
  Sparkles,
  LogOut,
  Clock,
  Loader2,
} from "lucide-react";
import { TopicProgressPanel } from "../components/admin/TopicProgressPanel";
import { BIOGRAPHY_STYLE_OPTIONS, DEFAULT_BIOGRAPHY_STYLE_ID } from "../lib/biographyStyles.js";
import { FamilyVoicePanel } from "../components/admin/FamilyVoicePanel";
import { UsageCostPanel, type AdminUsage } from "../components/admin/UsageCostPanel";
import {
  AdminUserManagementPanel,
  type AdminUser,
} from "../components/admin/AdminUserManagementPanel";
import { getRuntimeConfig } from "../lib/runtimeConfig.js";
import type { TopicProfile } from "../lib/biographyTopics";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

const NAV = [
  { id: "dashboard", label: "数据概览", icon: LayoutDashboard },
  { id: "costs", label: "成本监控", icon: BarChart3 },
  { id: "users", label: "用户管理", icon: UsersRound },
  { id: "analytics", label: "数据分析", icon: BarChart3 },
  { id: "settings", label: "系统设置", icon: Settings },
] as const;

type AdminViewId = (typeof NAV)[number]["id"];

const TABS = [
  { id: "chat", label: "对话记录" },
  { id: "summary", label: "叙事摘要" },
  { id: "topics", label: "主题进度" },
  { id: "memory", label: "记忆档案" },
  { id: "familyVoice", label: "亲情声音" },
  { id: "book", label: "成品自传" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const API_BASE = getRuntimeConfig(import.meta.env).apiBase;

// 模块：管理员登录态存储。SSR 阶段没有浏览器 localStorage，只在客户端读取已有 token。
function getStoredAdminToken() {
  return typeof localStorage !== "undefined" ? localStorage.getItem("admin_token") || "" : "";
}

function formatTime(isoStr?: string) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatAdminAge(age: AdminUser["age"]) {
  return age ? `${age} 岁` : "- 岁";
}

function AdminPage() {
  const [token, setToken] = useState(getStoredAdminToken);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSessions: 0,
    totalConversations: 0,
    totalSummaries: 0,
  });
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [activeView, setActiveView] = useState<AdminViewId>("dashboard");
  const [usage, setUsage] = useState<AdminUsage | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (data.success) {
        setToken(data.token);
        localStorage.setItem("admin_token", data.token);
        setLoginError("");
      } else {
        setLoginError(data.message || "登录失败");
      }
    } catch (err) {
      setLoginError("网络错误，请重试");
    }
  };

  const handleLogout = () => {
    setToken("");
    localStorage.removeItem("admin_token");
  };

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      handleLogout();
      throw new Error("登录已过期");
    }
    return res;
  };

  const loadData = async () => {
    try {
      const [statsRes, usersRes, usageRes] = await Promise.all([
        authFetch(`${API_BASE}/api/admin/stats`),
        authFetch(`${API_BASE}/api/admin/users`),
        authFetch(`${API_BASE}/api/admin/usage?range=7d`),
      ]);
      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      const usageData = await usageRes.json();

      setStats(statsData);
      setUsage(usageData);
      setUsers(
        usersData.map((u: any) => ({
          id: u._id,
          name: u.name || "未知",
          phone: u.phone || "-",
          age: u.age ?? null,
          status: u.status || "active",
          sessions: u.sessionCount || 0,
          conversations: u.conversationCount || 0,
          summaries: u.summaryCount || 0,
          createdAt: u.createdAt || null,
          updatedAt: u.updatedAt || null,
          lastActiveAt: u.lastActiveAt || null,
        })),
      );
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <form
          onSubmit={handleLogin}
          className="w-96 rounded-3xl bg-white p-8 shadow-xl border border-stone-100"
        >
          <div className="mb-8 flex flex-col items-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-600 text-white shadow-lg shadow-amber-600/30">
              <BookText className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-stone-800">故事坊管理后台</h1>
            <p className="mt-2 text-sm text-stone-500">请输入管理员账号密码</p>
          </div>

          {loginError && (
            <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600 border border-red-100">
              {loginError}
            </div>
          )}

          <div className="mb-5">
            <label className="mb-2 block text-sm font-bold text-stone-700">
              手机号 (默认 admin)
            </label>
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-800 transition-colors focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/10"
            />
          </div>
          <div className="mb-8">
            <label className="mb-2 block text-sm font-bold text-stone-700">
              密码 (默认 admin123)
            </label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-800 transition-colors focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/10"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-amber-600 py-3.5 font-bold text-white shadow-lg shadow-amber-600/30 transition-transform active:scale-95 hover:bg-amber-700"
          >
            登 录
          </button>
        </form>
      </div>
    );
  }

  const dynamicStats = [
    {
      label: "注册用户总数",
      value: stats.totalUsers,
      icon: Users,
      color: "bg-amber-100 text-amber-700",
    },
    {
      label: "录制会话数",
      value: stats.totalSessions,
      icon: MessageSquare,
      color: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "AI 对话轮数",
      value: stats.totalConversations,
      icon: MessagesSquare,
      color: "bg-sky-100 text-sky-700",
    },
    {
      label: "提取叙事摘要",
      value: stats.totalSummaries,
      icon: BookText,
      color: "bg-rose-100 text-rose-700",
    },
  ];

  const activeViewMeta = {
    dashboard: {
      title: "数据概览",
      description: "实时掌握所有老人的故事记忆进展。",
    },
    costs: {
      title: "成本监控",
      description: "按模型、语音能力和业务功能追踪 API 用量与预估成本。",
    },
    users: {
      title: "用户管理",
      description: "对长辈账号进行新增、查询、编辑和删除。",
    },
    analytics: {
      title: "数据分析",
      description: "分析用户访谈质量、内容沉淀和生成转化。",
    },
    settings: {
      title: "系统设置",
      description: "管理后台系统级配置。",
    },
  }[activeView];

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-stone-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-600 text-white">
            <BookText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-bold leading-tight">故事坊 · 管理后台</p>
            <p className="text-xs text-stone-500">AI 家庭记忆传承</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            退出
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="sticky top-16 h-[calc(100vh-4rem)] w-60 shrink-0 border-r border-stone-200 bg-white p-4">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
                    activeView === item.id
                      ? "bg-amber-50 text-amber-700"
                      : "text-stone-500 hover:bg-stone-100 hover:text-stone-900"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main */}
        <main className={activeView === "users" ? "flex-1 px-8 pb-8 pt-0" : "flex-1 p-8"}>
          {activeView !== "users" && (
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-stone-900">
                  {activeViewMeta.title}
                </h1>
                <p className="mt-1 text-sm text-stone-500">
                  {activeViewMeta.description}
                </p>
              </div>
              <button
                onClick={loadData}
                className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 shadow-sm hover:bg-stone-50"
              >
                刷新数据
              </button>
            </div>
          )}

          {activeView === "costs" ? (
            <UsageCostPanel usage={usage} loading={!usage} />
          ) : activeView === "users" ? (
            <div className="-mx-8">
              <AdminUserManagementPanel
                users={users}
                apiBase={API_BASE}
                authFetch={authFetch}
                onRefresh={loadData}
                onViewUser={setSelected}
              />
            </div>
          ) : activeView === "dashboard" ? (
            <>
              {/* Stats */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {dynamicStats.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div
                      key={s.label}
                      className="rounded-xl border border-stone-100 bg-white p-6 shadow-sm transition-transform hover:-translate-y-1"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-stone-500">{s.label}</p>
                          <p className="mt-2 text-3xl font-bold text-stone-900">{s.value}</p>
                        </div>
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-xl ${s.color}`}
                        >
                          <Icon className="h-6 w-6" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Users Table */}
              <div className="mt-8 rounded-xl border border-stone-100 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-6 py-5">
                  <div>
                    <h2 className="text-lg font-bold text-stone-800">注册用户列表</h2>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-stone-50/80 text-xs uppercase tracking-wider text-stone-500">
                      <tr>
                        <th className="px-6 py-3 font-semibold">长辈姓名</th>
                        <th className="px-6 py-3 font-semibold">联系手机</th>
                        <th className="px-6 py-3 font-semibold">年龄</th>
                        <th className="px-6 py-3 font-semibold">登录会话</th>
                        <th className="px-6 py-3 font-semibold">对话轮数</th>
                        <th className="px-6 py-3 font-semibold">摘要条数</th>
                        <th className="px-6 py-3 text-right font-semibold">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 bg-white">
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-stone-500">
                            没有数据...
                          </td>
                        </tr>
                      ) : (
                        users.map((u) => (
                          <tr key={u.id} className="transition-colors hover:bg-stone-50/80">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">
                                  {u.name.charAt(0)}
                                </div>
                                <span className="font-bold text-stone-900">{u.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-medium text-stone-600">{u.phone}</td>
                            <td className="px-6 py-4 text-stone-600">{formatAdminAge(u.age)}</td>
                            <td className="px-6 py-4 text-stone-600">{u.sessions} 次</td>
                            <td className="px-6 py-4 text-stone-600">{u.conversations}</td>
                            <td className="px-6 py-4 text-stone-600">{u.summaries}</td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => setSelected(u)}
                                className="rounded-lg bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 transition-colors hover:bg-amber-100"
                              >
                                查看详情
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-stone-200 bg-white p-12 text-center text-stone-500">
              <p className="text-base font-bold text-stone-700">模块建设中</p>
              <p className="mt-2 text-sm">当前先完成用户管理、成本监控和数据概览。</p>
            </div>
          )}
        </main>
      </div>

      {selected && (
        <UserDetailModal
          user={selected}
          onClose={() => {
            setSelected(null);
            loadData();
          }}
          authFetch={authFetch}
        />
      )}
    </div>
  );
}

// User Detail Modal Component
function UserDetailModal({
  user,
  onClose,
  authFetch,
}: {
  user: AdminUser;
  onClose: () => void;
  authFetch: any;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [bioGenerating, setBioGenerating] = useState(false);
  const [selectedBiographyStyle, setSelectedBiographyStyle] = useState(DEFAULT_BIOGRAPHY_STYLE_ID);

  useEffect(() => {
    let url = "";
    if (activeTab === "chat") url = `${API_BASE}/api/admin/user/${user.id}/conversations`;
    if (activeTab === "summary") url = `${API_BASE}/api/admin/user/${user.id}/summaries`;
    if (activeTab === "topics") url = `${API_BASE}/api/admin/user/${user.id}/topic-profile`;
    if (activeTab === "memory") url = `${API_BASE}/api/admin/user/${user.id}/memory-profile`;
    if (activeTab === "book") url = `${API_BASE}/api/admin/user/${user.id}/biographies`;
    if (activeTab === "familyVoice") {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    authFetch(url)
      .then((res: any) => res.json())
      .then((json: any) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => {
        setData(null);
        setLoading(false);
      });
  }, [activeTab, user.id]);

  const handleGenerateBook = async () => {
    if (!confirm(`确定要为 "${user.name}" 立即生成排版自传吗？`)) return;
    setBioGenerating(true);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/user/${user.id}/biographies/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style: selectedBiographyStyle }),
      });
      const json = await res.json();
      if (json.success) {
        alert("自传生成成功！《" + json.title + "》");
        if (activeTab === "book") {
          authFetch(`${API_BASE}/api/admin/user/${user.id}/biographies`)
            .then((r: any) => r.json())
            .then((d: any) => setData(d));
        } else setActiveTab("book");
      } else alert("错误: " + json.error);
    } catch {
      alert("网络错误");
    } finally {
      setBioGenerating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-[900px] max-w-full flex-col rounded-3xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Head */}
        <div className="flex items-center justify-between bg-stone-50 px-8 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-xl font-bold text-amber-700 shadow-inner">
              {user.name.charAt(0)}
            </div>
            <div>
              <p className="text-xl font-bold text-stone-900">{user.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-medium text-stone-500">{user.phone}</span>
                <span className="text-stone-300">•</span>
                <span className="text-sm font-medium text-stone-500">{formatAdminAge(user.age)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-white p-2 text-stone-400 shadow-sm border border-stone-200 hover:bg-stone-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-100 px-8">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`-mb-px border-b-2 px-6 py-4 text-sm font-bold transition-colors ${activeTab === t.id ? "border-amber-500 text-amber-700" : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-stone-50/30 p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-stone-400">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-amber-500" />
              正在加载实时数据...
            </div>
          ) : (
            <div className="space-y-4">
              {activeTab === "chat" &&
                (!Array.isArray(data) || data.length === 0 ? (
                  <p className="text-center text-stone-400 mt-10">暂无对话记录</p>
                ) : (
                  data.map((c: any) => (
                    <div
                      key={c._id}
                      className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between border-b border-stone-100 pb-3">
                        <div className="text-sm font-medium text-stone-500 flex items-center gap-2">
                          <Clock className="h-4 w-4" /> {formatTime(c.timestamp)}
                        </div>
                      </div>
                      <div className="rounded-lg bg-amber-50/60 p-3 leading-relaxed text-stone-800">
                        <strong className="text-amber-800">老人诉说：</strong>
                        {c.userText}
                      </div>
                      <div className="rounded-lg bg-stone-50 p-3 leading-relaxed text-stone-600">
                        <strong className="text-stone-900">AI 回复：</strong>
                        {c.aiReply}
                      </div>
                    </div>
                  ))
                ))}

              {activeTab === "summary" &&
                (!Array.isArray(data) || data.length === 0 ? (
                  <p className="text-center text-stone-400 mt-10">暂无摘要记录</p>
                ) : (
                  data.map((s: any) => (
                    <div
                      key={s._id}
                      className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="font-bold text-amber-700">单次记忆归档</h4>
                        <span className="text-xs text-stone-400">{formatTime(s.createdAt)}</span>
                      </div>
                      <p className="text-sm leading-relaxed text-stone-700">
                        {(s.emotionalNote || "").replace(/\\n/g, "\n")}
                      </p>
                      {s.coverage?.unexplored?.length > 0 && (
                        <div className="mt-4 border-t border-stone-100 pt-3 flex flex-wrap gap-2">
                          <span className="text-xs font-semibold text-stone-500 mt-1 mr-2">
                            待探索话题:
                          </span>
                          {s.coverage.unexplored.map((topic: string, i: number) => (
                            <span
                              key={i}
                              className="rounded bg-sky-50 px-2 py-1 text-xs text-sky-700 border border-sky-100"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ))}

              {activeTab === "topics" && (
                <TopicProgressPanel profile={data as TopicProfile | null} />
              )}

              {activeTab === "memory" &&
                (!data || !data.people ? (
                  <p className="text-center text-stone-400 mt-10">记忆模块还未初始化</p>
                ) : (
                  <div className="space-y-6">
                    <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 p-6 border border-amber-100 shadow-sm">
                      <h3 className="font-bold text-amber-900 mb-2">
                        生成自传就绪度 ({data.readyCount}/5 维度)
                      </h3>
                      <p className="text-sm text-stone-600 mb-4">
                        累计素材字数: <strong>{data.totalWordCount || 0}</strong> 字
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {[
                          { k: "timeline", l: "记忆全貌" },
                          { k: "keyPeople", l: "核心人物" },
                          { k: "depth", l: "内容深度" },
                          { k: "stories", l: "精彩细节" },
                          { k: "emotions", l: "情感饱满" },
                        ].map((dim) => {
                          const ok = data.readiness?.[dim.k]?.status;
                          return (
                            <div
                              key={dim.k}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${ok ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-white text-stone-400 border-stone-200"}`}
                            >
                              {ok ? "✓" : "×"} {dim.l}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <h3 className="font-bold text-stone-800 border-b border-stone-200 pb-2">
                      已识别的核心人物
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {data.people?.map((p: any, i: number) => (
                        <div
                          key={i}
                          className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm flex items-start gap-3"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100">
                            <UsersRound className="h-5 w-5 text-stone-500" />
                          </div>
                          <div>
                            <p className="font-bold text-stone-900">{p.name || "未知"}</p>
                            <p className="text-xs font-medium text-amber-600 my-1">{p.relation}</p>
                            <p className="text-xs text-stone-500 leading-relaxed max-h-16 overflow-hidden text-ellipsis line-clamp-3">
                              {p.details || p.mentionedIn || ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

              {activeTab === "familyVoice" && <FamilyVoicePanel />}

              {activeTab === "book" &&
                (!Array.isArray(data) || data.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50">
                    <BookText className="h-12 w-12 text-stone-300 mb-3" />
                    <p className="text-stone-500 font-medium">老人还没有生成过自传书籍</p>
                  </div>
                ) : (
                  data.map((b: any) => (
                    <div
                      key={b._id}
                      className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        <BookText className="h-32 w-32" />
                      </div>
                      <div className="relative z-10">
                        <h3 className="text-xl font-black text-amber-900 mb-1">《{b.title}》</h3>
                        <p className="text-sm font-medium text-stone-500 mb-6">
                          成书时间: {formatTime(b.createdAt)}
                          {b.styleLabel ? ` · 文风：${b.styleLabel}` : ""}
                        </p>

                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                          {(b.chapters || []).map((ch: any) => (
                            <div
                              key={ch.number}
                              className="bg-white rounded-lg p-5 border border-amber-100 shadow-sm"
                            >
                              <h4 className="font-bold text-stone-800 text-lg mb-3 border-b border-stone-100 pb-2">
                                第 {ch.number} 章：{ch.title}
                              </h4>
                              <p className="whitespace-pre-wrap text-sm leading-loose text-stone-600 font-serif">
                                {ch.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end border-t border-stone-100 bg-stone-50 px-8 py-5">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-bold text-stone-600">
              文风
              <select
                value={selectedBiographyStyle}
                onChange={(event) => setSelectedBiographyStyle(event.target.value)}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-bold text-stone-700 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-500/10"
              >
                {BIOGRAPHY_STYLE_OPTIONS.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={bioGenerating}
              onClick={handleGenerateBook}
              className="flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-transform active:scale-95 hover:bg-amber-700 disabled:opacity-50 disabled:scale-100"
            >
              {bioGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {bioGenerating ? "正在撰写排版..." : "强制生成最新自传"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
