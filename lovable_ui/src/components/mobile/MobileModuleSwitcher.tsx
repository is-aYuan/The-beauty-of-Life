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
      <div className="grid min-w-0 grid-cols-[1fr_auto] items-center gap-1 px-2 py-1 xs:gap-1.5 xs:px-3 xs:py-1.5">
        <nav className="grid min-w-0 grid-cols-4 gap-0.5 xs:gap-1" aria-label="主导航">
          {tabs.map((tab) => {
            const active = tab.id === activeTab;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`flex min-h-9 min-w-0 flex-col items-center justify-center rounded-xl px-0.5 text-[11px] font-bold transition-colors xs:min-h-10 xs:px-1 xs:text-[13px] ${
                  active
                    ? "bg-stone-800 text-amber-50 shadow-sm"
                    : "text-stone-600 hover:bg-amber-100"
                }`}
              >
                <Icon className="mb-0.5 h-4 w-4 xs:h-[18px] xs:w-[18px]" strokeWidth={2.4} />
                <span className="max-w-full truncate leading-none">{tab.label}</span>
              </button>
            );
          })}
        </nav>
        <button
          type="button"
          aria-label="退出登录"
          onClick={handleLogout}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-stone-700 shadow-sm ring-1 ring-amber-100 xs:h-10 xs:w-10"
        >
          <LogOut className="h-5 w-5" strokeWidth={2.4} />
          <span className="sr-only">退出登录</span>
        </button>
      </div>
    </header>
  );
}
