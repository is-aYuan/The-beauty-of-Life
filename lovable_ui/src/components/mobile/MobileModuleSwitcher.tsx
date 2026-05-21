import { LogOut } from "lucide-react";
import type { ComponentType } from "react";

export type MobileModuleTab<T extends string> = {
  id: T;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
};

type MobileModuleSwitcherProps<T extends string> = {
  tabs: MobileModuleTab<T>[];
  activeTab: T;
  onSelectTab: (tab: T) => void;
  onLogout: () => void;
};

// 模块：移动端顶部导航。只负责主入口切换，不处理主题选择和录音状态。
export function MobileModuleSwitcher<T extends string>({
  tabs,
  activeTab,
  onSelectTab,
  onLogout,
}: MobileModuleSwitcherProps<T>) {
  const handleLogout = () => {
    if (window.confirm("确定退出登录吗？")) {
      onLogout();
    }
  };

  return (
    <header className="shrink-0 border-b border-amber-200 bg-amber-50/95 shadow-sm backdrop-blur">
      <div className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2">
        <nav className="grid grid-cols-4 gap-1" aria-label="主导航">
          {tabs.map((tab) => {
            const active = tab.id === activeTab;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`flex min-h-11 flex-col items-center justify-center rounded-xl px-1 text-sm font-bold transition-colors ${
                  active
                    ? "bg-stone-800 text-amber-50 shadow-sm"
                    : "text-stone-600 hover:bg-amber-100"
                }`}
              >
                <Icon className="mb-0.5 h-4 w-4" strokeWidth={2.4} />
                <span className="leading-none">{tab.label}</span>
              </button>
            );
          })}
        </nav>
        <button
          type="button"
          aria-label="退出登录"
          onClick={handleLogout}
          className="flex h-11 min-w-14 flex-col items-center justify-center rounded-xl bg-white px-2 text-stone-700 shadow-sm ring-1 ring-amber-100"
        >
          <LogOut className="h-4 w-4" strokeWidth={2.4} />
          <span className="mt-0.5 text-xs font-black leading-none">退出</span>
        </button>
      </div>
    </header>
  );
}
