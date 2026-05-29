import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { AdminUser } from "./AdminUserManagementPanel";

type AdminDeleteUserDialogProps = {
  user: AdminUser;
  loading: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (confirmText: string) => void;
};

const DELETE_CONFIRM_TEXT = "确认删除";

// 模块：管理员高危删除确认。删除用户前明确展示级联清理范围并要求输入确认文本。
export function AdminDeleteUserDialog({
  user,
  loading,
  error,
  onClose,
  onConfirm,
}: AdminDeleteUserDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const canDelete = confirmText.trim() === DELETE_CONFIRM_TEXT;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-red-100 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-red-100 bg-red-50 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-700">删除用户</h3>
              <p className="mt-1 text-sm text-red-600">此操作会永久清理用户资料和关联记忆数据。</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-red-100 bg-white p-2 text-red-300 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
              {error}
            </div>
          )}

          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-base font-black text-stone-900">{user.name}</p>
                <p className="mt-1 text-sm font-medium text-stone-500">{user.phone}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-stone-500">
                ID: {user.id}
              </span>
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-bold text-stone-800">将被级联删除的数据</p>
            <div className="grid grid-cols-2 gap-2 text-sm font-medium text-stone-600">
              {["对话记录", "叙事摘要", "记忆档案", "主题档案", "成品自传", "会话记录", "用户偏好", "同意记录", "本地音频"].map(
                (item) => (
                  <div key={item} className="rounded-lg border border-stone-200 bg-white px-3 py-2">
                    {item}
                  </div>
                ),
              )}
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-stone-700">
              输入“{DELETE_CONFIRM_TEXT}”继续
            </span>
            <input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              className="w-full rounded-xl border border-red-200 bg-red-50/40 px-4 py-3 text-sm font-bold text-red-700 outline-none transition focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10"
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-red-100 bg-stone-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-bold text-stone-600 hover:bg-stone-100"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!canDelete || loading}
            onClick={() => onConfirm(confirmText)}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-600/20 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            永久删除
          </button>
        </div>
      </div>
    </div>
  );
}
