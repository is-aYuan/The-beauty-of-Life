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

  const currentTopicSummary = (
    <span className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-sm font-bold text-stone-500">聊天主题：</span>
      <span className="truncate text-lg font-black text-stone-900">{currentTopic.title}</span>
      <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-black text-stone-800">
        {currentProgress}%
      </span>
    </span>
  );

  return (
    <section
      className={`border-t border-amber-200 bg-amber-50/95 shadow-[0_-8px_24px_rgba(120,72,30,0.08)] backdrop-blur ${
        expanded ? "flex max-h-[calc(100dvh-8rem)] min-h-0 shrink-0 flex-col" : "shrink-0"
      }`}
    >
      {expanded ? (
        <div className="grid min-h-[52px] w-full grid-cols-1 items-center px-4 py-2 text-left">
          {currentTopicSummary}
        </div>
      ) : (
        <button
          type="button"
          aria-expanded={expanded}
          disabled={disabled}
          onClick={onToggle}
          className="grid min-h-[52px] w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-2 text-left disabled:opacity-70"
        >
          {currentTopicSummary}
          <span className="flex items-center gap-1 rounded-full bg-white px-3 py-2 text-sm font-black text-stone-700 shadow-sm ring-1 ring-amber-100">
            换主题
            <ChevronDown className="h-4 w-4 transition-transform" />
          </span>
        </button>
      )}

      {expanded && (
        <>
          {/* 模块：主题选择模式。中间主题网格独立滚动，底部仅保留收起入口。 */}
          <div
            data-mobile-topic-scroll
            className="min-h-0 flex-1 overflow-y-auto border-t border-amber-100 px-3 pb-4 pt-2"
          >
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
                    className={`rounded-2xl border p-3 text-left transition-transform active:scale-[0.98] ${
                      active
                        ? "border-[#F5D76B] bg-[#FFEA92] text-[#241F1C] shadow-[0_10px_24px_rgba(160,120,30,0.18)]"
                        : "border-amber-100 bg-white text-stone-800 shadow-sm"
                    }`}
                  >
                    <span className="block min-h-10 text-base font-black leading-snug">
                      {topic.title}
                    </span>
                    <span className="mt-2 flex items-center gap-2">
                      <span
                        className={`h-2 flex-1 overflow-hidden rounded-full ${
                          active ? "bg-[rgba(36,31,28,0.12)]" : "bg-stone-200"
                        }`}
                      >
                        <span
                          className={`block h-full rounded-full ${
                            active
                              ? "bg-[#241F1C]"
                              : progress >= 85
                                ? "bg-emerald-500"
                                : "bg-amber-700"
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </span>
                      <span
                        className={`w-9 text-right text-xs font-black ${
                          active ? "text-[#241F1C]" : "text-stone-700"
                        }`}
                      >
                        {progress}%
                      </span>
                    </span>
                    <span
                      className={`mt-1 block text-xs font-bold ${
                        active ? "text-[#5F4A00]" : "text-stone-500"
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div
            data-mobile-topic-collapse
            className="sticky bottom-0 border-t border-amber-100 bg-amber-50/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_20px_rgba(120,72,30,0.08)]"
          >
            <button
              type="button"
              onClick={onCollapse}
              className="min-h-12 w-full rounded-2xl border border-[#F5D76B] bg-[#FFEA92] text-base font-black text-[#241F1C] shadow-[0_10px_24px_rgba(160,120,30,0.18)] active:scale-[0.98]"
            >
              收起
            </button>
          </div>
        </>
      )}
    </section>
  );
}
