import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AdminUser } from "./AdminUserManagementPanel";

type AdminUserFormDialogProps = {
  mode: "create" | "edit";
  user?: AdminUser | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    phone?: string;
    age: string;
    password?: string;
  }) => void;
};

// 模块：管理员新增与编辑用户资料表单。创建时收集登录信息，编辑时只开放资料字段。
export function AdminUserFormDialog({
  mode,
  user,
  loading,
  error,
  onClose,
  onSubmit,
}: AdminUserFormDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    setName(user?.name || "");
    setPhone(user?.phone === "-" ? "" : user?.phone || "");
    setAge(user?.age ? String(user.age) : "");
    setPassword("");
  }, [user, mode]);

  const isCreate = mode === "create";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-950/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            name,
            phone: isCreate ? phone : undefined,
            age,
            password: isCreate ? password : undefined,
          });
        }}
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-stone-900">
              {isCreate ? "新增用户" : "编辑用户"}
            </h3>
            <p className="mt-1 text-sm text-stone-500">
              {isCreate ? "创建可登录的家庭记忆账号" : "手机号作为登录标识，当前版本保持只读"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-stone-200 p-2 text-stone-400 hover:bg-stone-50 hover:text-stone-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
              {error}
            </div>
          )}

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-stone-700">长辈姓名</span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold text-stone-800 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10"
              placeholder="例如：郑远"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-stone-700">联系手机</span>
            <input
              required={isCreate}
              disabled={!isCreate}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold text-stone-800 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10 disabled:cursor-not-allowed disabled:text-stone-400"
              placeholder="11 位手机号"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-stone-700">年龄</span>
            <input
              inputMode="numeric"
              value={age}
              onChange={(event) => setAge(event.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold text-stone-800 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10"
              placeholder="可留空"
            />
          </label>

          {isCreate && (
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-stone-700">初始密码</span>
              <input
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold text-stone-800 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10"
                placeholder="用于用户首次登录"
              />
            </label>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-stone-100 bg-stone-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-bold text-stone-600 hover:bg-stone-100"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-600/20 hover:bg-amber-700 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isCreate ? "创建用户" : "保存修改"}
          </button>
        </div>
      </form>
    </div>
  );
}
