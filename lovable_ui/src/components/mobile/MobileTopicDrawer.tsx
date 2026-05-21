import { ChevronDown } from "lucide-react";
import { useEffect } from "react";

export type MobileTopic = {
  id: string;
  title: string;
  progress?: number;
  status?: string;
};

type MobileTopicDrawerProps = {
  topics: MobileTopic[];
  currentTopicId?: string | null;
  expanded: boolean;
  disabled: boolean;
  onToggle: () => void;
  onCollapse: () => void;
  onSelectTopic: (topicId: string) => void;
  getStatusLabel: (status: string, progress: number) => string;
};

// 模块：移动端主题抽屉。只负责“聊什么”的选择，不承载录音、播放或模块导航。
export function MobileTopicDrawer({
  topics,
  currentTopicId,
  expanded,
  disabled,
  onToggle,
  onCollapse,
  onSelectTopic,
  getStatusLabel,
}: MobileTopicDrawerProps) {
  const currentTopic = topics.find((topic) => topic.id === currentTopicId) || topics[0];
  const currentProgress = Math.max(0, Math.min(100, currentTopic?.progress || 0));

  useEffect(() => {
    if (disabled && expanded) {
      onCollapse();
    }
  }, [disabled, expanded, onCollapse]);

  if (!currentTopic) {
    return null;
  }

  return (
    <section className="shrink-0 border-t border-amber-200 bg-amber-50/95 shadow-[0_-8px_24px_rgba(120,72,30,0.08)] backdrop-blur">
      <button
        type="button"
        aria-expanded={expanded}
        disabled={disabled}
        onClick={onToggle}
        className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-left disabled:opacity-70"
      >
        <span className="min-w-0">
          <span className="block text-xs font-bold text-stone-500">当前主题</span>
          <span className="mt-0.5 flex min-w-0 items-center gap-2">
            <span className="truncate text-lg font-black text-stone-900">{currentTopic.title}</span>
            <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-black text-stone-800">
              {currentProgress}%
            </span>
          </span>
        </span>
        <span className="flex items-center gap-1 rounded-full bg-white px-3 py-2 text-sm font-black text-stone-700 shadow-sm ring-1 ring-amber-100">
          {expanded ? "收起" : "换主题"}
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </span>
      </button>

      {expanded && (
        <div className="max-h-[40dvh] overflow-y-auto border-t border-amber-100 px-3 pb-3 pt-2">
          <div className="grid grid-cols-2 gap-2">
            {topics.map((topic) => {
              const active = topic.id === currentTopicId;
              const progress = Math.max(0, Math.min(100, topic.progress || 0));
              const statusLabel = getStatusLabel(topic.status || "", progress);
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => onSelectTopic(topic.id)}
                  className={`rounded-2xl p-3 text-left shadow-sm transition-transform active:scale-[0.98] ${
                    active
                      ? "bg-amber-300 text-stone-950 ring-2 ring-amber-700/30"
                      : "bg-white text-stone-800 ring-1 ring-amber-100"
                  }`}
                >
                  <span className="block min-h-10 text-base font-black leading-snug">
                    {topic.title}
                  </span>
                  <span className="mt-2 flex items-center gap-2">
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200">
                      <span
                        className={`block h-full rounded-full ${
                          progress >= 85 ? "bg-emerald-500" : "bg-amber-700"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </span>
                    <span className="w-9 text-right text-xs font-black text-stone-700">
                      {progress}%
                    </span>
                  </span>
                  <span className="mt-1 block text-xs font-bold text-stone-500">{statusLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
