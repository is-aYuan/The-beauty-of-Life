import { ChevronDown, CircleDot, ListChecks, MessageCircleQuestion } from "lucide-react";
import { useState } from "react";
import type { BiographyTopic, TopicProfile } from "../../lib/biographyTopics";
import {
  buildTopicProgressSummary,
  getTopicStatusMeta,
  type TopicStatusMeta,
} from "../../lib/adminTopicProgress.js";

type TopicProgressPanelProps = {
  profile: TopicProfile | null;
};

const toneClassMap: Record<TopicStatusMeta["tone"], string> = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
  stone: "bg-stone-100 text-stone-600 border-stone-200",
  neutral: "bg-white text-stone-400 border-stone-200",
};

function TopicDetailList({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-xs font-bold text-stone-500">{title}</p>
      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li
            key={`${title}-${index}`}
            className="rounded-lg bg-stone-50 px-3 py-2 text-sm leading-relaxed text-stone-600"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TopicCard({ topic, isCurrent }: { topic: BiographyTopic; isCurrent: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const safeProgress = Math.max(0, Math.min(100, Math.round(Number(topic.progress) || 0)));
  const statusMeta = getTopicStatusMeta(topic.status, safeProgress);

  return (
    <article className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-start gap-4 text-left"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
          <CircleDot className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-bold text-stone-900">{topic.title}</h4>
            {isCurrent && (
              <span className="rounded-full bg-stone-800 px-2.5 py-1 text-xs font-bold text-amber-50">
                当前主题
              </span>
            )}
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-bold ${toneClassMap[statusMeta.tone]}`}
            >
              {statusMeta.label}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-amber-500"
                style={{ width: `${safeProgress}%` }}
              />
            </div>
            <span className="w-12 text-right text-sm font-bold text-stone-700">
              {safeProgress}%
            </span>
          </div>
          {topic.lastDiscussedAt && (
            <p className="mt-2 text-xs font-medium text-stone-400">
              最近讨论：{new Date(topic.lastDiscussedAt).toLocaleString("zh-CN")}
            </p>
          )}
        </div>
        <ChevronDown
          className={`mt-1 h-5 w-5 shrink-0 text-stone-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-stone-100 pt-4">
          {topic.summary ? (
            <p className="rounded-lg bg-amber-50 px-3 py-3 text-sm leading-relaxed text-stone-700">
              {topic.summary}
            </p>
          ) : (
            <p className="rounded-lg bg-stone-50 px-3 py-3 text-sm text-stone-400">
              这个主题还没有形成摘要。
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <TopicDetailList title="已知事实" items={topic.knownFacts} />
            <TopicDetailList title="具体故事" items={topic.concreteStories} />
            <TopicDetailList title="缺失信息" items={topic.missingInfo} />
            {topic.suggestedNextQuestion && (
              <div>
                <p className="mb-2 text-xs font-bold text-stone-500">建议追问</p>
                <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm leading-relaxed text-sky-700">
                  {topic.suggestedNextQuestion}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

// 模块：管理员主题进度面板。负责把 topic_profile 展示为运营可读的采访进度，不负责请求数据。
export function TopicProgressPanel({ profile }: TopicProgressPanelProps) {
  if (!profile || !Array.isArray(profile.topics)) {
    return <p className="text-center text-stone-400 mt-10">主题进度还未初始化</p>;
  }

  const summary = buildTopicProgressSummary(profile);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-4">
        {[
          { label: "平均进度", value: `${summary.averageProgress}%`, icon: ListChecks },
          { label: "素材丰富", value: `${summary.richCount} 个`, icon: CircleDot },
          { label: "未开始", value: `${summary.notStartedCount} 个`, icon: CircleDot },
          { label: "当前主题", value: summary.currentTopicTitle, icon: MessageCircleQuestion },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-stone-400">{item.label}</p>
              <p className="mt-1 text-lg font-black text-stone-900">{item.value}</p>
            </div>
          );
        })}
      </section>

      <section className="space-y-3">
        {profile.topics.map((topic) => (
          <TopicCard key={topic.id} topic={topic} isCurrent={topic.id === profile.currentTopicId} />
        ))}
      </section>
    </div>
  );
}
