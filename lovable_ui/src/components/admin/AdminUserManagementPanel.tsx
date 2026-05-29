import { Edit3, Eye, Loader2, RefreshCw, Search, Trash2, UserPlus, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminDeleteUserDialog } from "./AdminDeleteUserDialog";
import { AdminUserFormDialog } from "./AdminUserFormDialog";

export type AdminUser = {
  id: string;
  name: string;
  phone: string;
  age: number | null;
  status: string;
  sessions: number;
  conversations: number;
  summaries: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastActiveAt?: string | null;
};

type AdminUserManagementPanelProps = {
  users: AdminUser[];
  apiBase: string;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onRefresh: () => Promise<void> | void;
  onViewUser: (user: AdminUser) => void;
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAge(age: number | null) {
  return age ? `${age} 岁` : "-";
}

async function readJsonSafely(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

// 模块：管理员用户管理工作台。负责用户查询、筛选、新增、编辑、删除和详情入口编排。
export function AdminUserManagementPanel({
  users,
  apiBase,
  authFetch,
  onRefresh,
  onViewUser,
}: AdminUserManagementPanelProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      const matchesQuery =
        !normalizedQuery ||
        user.name.toLowerCase().includes(normalizedQuery) ||
        user.phone.toLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [query, statusFilter, users]);

  const closeForm = () => {
    if (busy) return;
    setFormMode(null);
    setEditingUser(null);
    setFormError("");
  };

  const handleSubmitUser = async (payload: {
    name: string;
    phone?: string;
    age: string;
    password?: string;
  }) => {
    setBusy(true);
    setFormError("");
    const isCreate = formMode === "create";
    const targetUrl = isCreate
      ? `${apiBase}/api/admin/users`
      : `${apiBase}/api/admin/user/${editingUser?.id}`;

    try {
      const response = await authFetch(targetUrl, {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await readJsonSafely(response);
      if (!response.ok || json.success === false) {
        setFormError(json.message || json.error || "保存失败，请检查输入");
        return;
      }
      await onRefresh();
      closeForm();
    } catch {
      setFormError("网络错误，请稍后重试");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteUser = async (confirmText: string) => {
    if (!deletingUser) return;
    setBusy(true);
    setDeleteError("");
    try {
      const response = await authFetch(`${apiBase}/api/admin/user/${deletingUser.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmText }),
      });
      const json = await readJsonSafely(response);
      if (!response.ok || json.success === false) {
        setDeleteError(json.message || json.error || "删除失败");
        return;
      }
      await onRefresh();
      setDeletingUser(null);
    } catch {
      setDeleteError("网络错误，请稍后重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-stone-100 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-stone-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-stone-900">用户管理</h2>
            <p className="mt-1 text-sm text-stone-500">对长辈账号进行新增、查询、编辑和删除。</p>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => onRefresh()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-bold text-stone-600 shadow-sm transition-colors hover:bg-stone-50"
            >
              <RefreshCw className="h-4 w-4" />
              刷新数据
            </button>
            <button
              onClick={() => {
                setFormMode("create");
                setEditingUser(null);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-600/20 transition-colors hover:bg-amber-700"
            >
              <UserPlus className="h-4 w-4" />
              新增用户
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-stone-100 bg-stone-50/60 px-6 py-4 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-stone-700 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
              placeholder="搜索姓名或手机号"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-bold text-stone-700 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
          >
            <option value="all">全部状态</option>
            <option value="active">活跃用户</option>
            <option value="disabled">停用用户</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-stone-50/80 text-xs uppercase tracking-wider text-stone-500">
              <tr>
                <th className="px-6 py-3 font-semibold">长辈姓名</th>
                <th className="px-6 py-3 font-semibold">联系手机</th>
                <th className="px-6 py-3 font-semibold">年龄</th>
                <th className="w-[72px] px-6 py-3 font-semibold whitespace-nowrap">状态</th>
                <th className="px-6 py-3 font-semibold">登录会话</th>
                <th className="px-6 py-3 font-semibold">对话轮数</th>
                <th className="px-6 py-3 font-semibold">摘要数</th>
                <th className="px-6 py-3 font-semibold">最近活跃</th>
                <th className="px-6 py-3 font-semibold">创建时间</th>
                <th className="w-[220px] px-6 py-3 text-right font-semibold whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 bg-white">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center text-stone-400">
                      <UsersRound className="mb-3 h-10 w-10" />
                      <p className="font-bold">暂无匹配用户</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="transition-colors hover:bg-stone-50/80">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">
                          {user.name.charAt(0)}
                        </div>
                        <span className="font-bold text-stone-900">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-stone-600">{user.phone}</td>
                    <td className="px-6 py-4 text-stone-600">{formatAge(user.age)}</td>
                    <td className="w-[72px] px-6 py-4">
                      <span className="inline-flex whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        {user.status === "active" ? "活跃" : "停用"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-stone-600">{user.sessions} 次</td>
                    <td className="px-6 py-4 text-stone-600">{user.conversations}</td>
                    <td className="px-6 py-4 text-stone-600">{user.summaries}</td>
                    <td className="px-6 py-4 text-stone-600">{formatDateTime(user.lastActiveAt)}</td>
                    <td className="px-6 py-4 text-stone-600">{formatDateTime(user.createdAt)}</td>
                    <td className="w-[220px] px-6 py-4">
                      <div className="flex justify-end gap-2 whitespace-nowrap">
                        <button
                          onClick={() => onViewUser(user)}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          查看
                        </button>
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setFormMode("edit");
                          }}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          编辑
                        </button>
                        <button
                          onClick={() => {
                            setDeletingUser(user);
                            setDeleteError("");
                          }}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formMode && (
        <AdminUserFormDialog
          mode={formMode}
          user={editingUser}
          loading={busy}
          error={formError}
          onClose={closeForm}
          onSubmit={handleSubmitUser}
        />
      )}

      {deletingUser && (
        <AdminDeleteUserDialog
          user={deletingUser}
          loading={busy}
          error={deleteError}
          onClose={() => {
            if (busy) return;
            setDeletingUser(null);
            setDeleteError("");
          }}
          onConfirm={handleDeleteUser}
        />
      )}
    </div>
  );
}
