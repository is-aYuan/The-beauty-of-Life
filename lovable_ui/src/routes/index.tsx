import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Mic,
  Bot,
  Heart,
  Settings as SettingsIcon,
  Pause,
  Square,
  Sparkles,
  User,
} from "lucide-react";
import { useStoryEngine } from "../hooks/useStoryEngine";

export const Route = createFileRoute("/")({
  component: Index,
});

type Tab = "story" | "organizer" | "family" | "settings";
type RecordMode = "hold" | "table";

const NAV_ITEMS: { id: Tab; label: string; icon: typeof Mic }[] = [
  { id: "story", label: "讲我的故事", icon: Mic },
  { id: "organizer", label: "AI 整理", icon: Bot },
  { id: "family", label: "亲情连接", icon: Heart },
  { id: "settings", label: "设置", icon: SettingsIcon },
];

const TAB_TITLES: Record<Tab, string> = {
  story: "讲我的故事",
  organizer: "AI 整理",
  family: "亲情连接",
  settings: "设置",
};

function MiniVisualizer({ freqData }: { freqData: Uint8Array | null }) {
  const bars = Array.from({ length: 48 }, (_, i) => {
    if (!freqData) return 10 + Math.random() * 5;
    const step = Math.floor(Math.min(freqData.length, 1024) / 48); 
    let sum = 0;
    for (let j = 0; j < step; j++) {
      sum += freqData[i * step + j] || 0;
    }
    const val = step > 0 ? sum / step : 0;
    return Math.max(10, (val / 255) * 100);
  });

  return (
    <div className="mt-2 flex h-8 items-end justify-center gap-1">
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-1 rounded-full bg-blue-400 transition-all duration-75 ease-out"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

function Index() {
  const navigate = useNavigate();
  const {
    user,
    wsConnected,
    networkStatus,
    convoState,
    subtitle,
    topicProfile,
    userStats,
    chatHistory,
    frequencyData,
    logout,
    startManualRecord,
    stopManualRecord,
    startAutoRecord,
    stopAutoRecord,
    stopAll,
    selectTopic
  } = useStoryEngine();

  const [activeTab, setActiveTab] = useState<Tab>("story");
  const [recordMode, setRecordMode] = useState<RecordMode>("hold");

  const hasLocalUser = !!localStorage.getItem("story_user");

  useEffect(() => {
    if (!hasLocalUser) {
      navigate({ to: "/login" });
    }
  }, [hasLocalUser, navigate]);

  if (!hasLocalUser || !user) return null;

  const getTopicStatusLabel = (status: string, progress: number) => {
    if (status === "rich" || progress >= 85) return "素材已丰富";
    if (status === "needs_detail") return "继续补充";
    if (status === "has_story") return "已有故事";
    if (status === "started") return "刚刚开始";
    return "还没开始";
  };

  return (
    <main className="flex h-screen w-full gap-4 bg-amber-50 p-4 text-stone-900">
      {/* LEFT NAV */}
      <aside className="flex w-[20%] flex-col rounded-3xl bg-stone-800 p-5 text-amber-50 shadow-lg">
        <div className="mb-8 px-2 pt-2">
          <h1 className="text-3xl font-bold tracking-wide">回忆录</h1>
          <p className="mt-1 text-lg text-amber-200/80">Memory Book</p>
        </div>
        <nav className="flex flex-1 flex-col gap-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-4 rounded-2xl px-4 py-5 text-left text-xl font-semibold shadow-md transition-transform hover:scale-105 active:scale-95 ${
                  active
                    ? "bg-stone-700 text-amber-50 ring-2 ring-amber-300/40"
                    : "bg-stone-800 text-amber-100 hover:bg-stone-700/70"
                }`}
              >
                <Icon className="h-10 w-10 shrink-0" strokeWidth={2.2} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <button 
          onClick={logout}
          className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-stone-700 p-3 hover:bg-stone-600 transition-colors text-amber-200/80"
        >
          退出登录
        </button>
      </aside>

      {/* MAIN WORKBENCH */}
      <section
        className="flex w-[55%] flex-col rounded-3xl bg-amber-50 p-8 relative"
        style={{ boxShadow: "inset 0 4px 24px rgba(120, 72, 30, 0.18)" }}
      >
        {activeTab !== "story" ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <h2 className="text-4xl font-bold text-stone-800">
              {TAB_TITLES[activeTab]}
            </h2>
            <p className="mt-4 text-2xl leading-relaxed text-stone-600">
              此功能正在建设中……
            </p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            <header className="border-b-2 border-amber-200 pb-5">
              <h2 className="text-4xl font-bold text-stone-800">
                我的回忆录 —— {user.name}爷爷/奶奶
              </h2>
              <p className="mt-2 text-xl text-stone-600">
                今日陪伴
              </p>
              <p className="mt-1 text-sm text-stone-500">
                已记录 {userStats.totalConversations} 个对话，约 {userStats.estimatedDurationMin} 分钟
              </p>
            </header>

            {/* Scrollable chat log */}
            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              {chatHistory.map((m) =>
                m.role === "ai" ? (
                  <div key={m.id} className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-stone-200 shadow-sm">
                      <Bot className="h-7 w-7 text-stone-700" />
                    </div>
                    <div className="max-w-[78%] rounded-3xl rounded-tl-none bg-white p-5 shadow-md">
                      <p className="text-2xl leading-relaxed text-stone-800">
                        {m.text}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    key={m.id}
                    className="flex items-start justify-end gap-4"
                  >
                    <div className="max-w-[78%] rounded-3xl rounded-tr-none bg-amber-100 p-5 shadow-md">
                      <p className="text-2xl leading-relaxed text-stone-800">
                        {m.text}
                      </p>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-stone-700 shadow-sm">
                      <User className="h-7 w-7 text-amber-50" />
                    </div>
                  </div>
                ),
              )}

              {/* Subtitle from stream */}
              {subtitle && convoState !== "userRecording" && convoState !== "aiTalking" && (
                <div className="flex items-start gap-4 pt-4 border-t border-amber-200/50">
                   <div className="max-w-[100%] bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
                     <p className="text-2xl leading-relaxed text-blue-800">{subtitle}</p>
                   </div>
                </div>
              )}

              {convoState === "aiThinking" && (
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-stone-200 shadow-sm animate-pulse">
                    <Bot className="h-7 w-7 text-stone-700" />
                  </div>
                  <div className="rounded-3xl rounded-tl-none bg-white p-5 shadow-md border border-orange-100">
                    <p className="text-2xl leading-relaxed text-orange-600 animate-pulse">
                      我在帮您整理故事，马上就好...
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky bottom control panel */}
            <div className="sticky bottom-0 border-t-2 border-amber-200 bg-amber-50 p-4">
              {/* Mode toggle */}
              <div className="mx-auto mb-4 flex w-fit rounded-full bg-amber-100 p-1 text-stone-600">
                {([
                  { id: "hold", label: "按住说话" },
                  { id: "table", label: "放桌上畅聊" },
                ] as { id: RecordMode; label: string }[]).map((opt) => {
                  const active = recordMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setRecordMode(opt.id)}
                      className={`rounded-full px-5 py-2 text-lg transition-all ${
                        active
                          ? "bg-white font-bold text-stone-800 shadow-sm"
                          : "text-stone-600 hover:text-stone-800"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Dynamic status area */}
              <div className="mb-4 min-h-[68px] text-center">
                {networkStatus === "offline" ? (
                  <p className="animate-pulse text-xl font-medium text-amber-600">
                    爷爷，网络打了个盹，正在努力重连...
                  </p>
                ) : convoState === "userRecording" ? (
                  <>
                    <p className="text-xl font-bold text-emerald-600">
                      正在听您说...
                    </p>
                    <MiniVisualizer freqData={frequencyData} />
                  </>
                ) : convoState === "aiThinking" ? (
                  <p className="animate-pulse text-xl font-medium text-orange-500">
                    AI 正在思考处理中...
                  </p>
                ) : convoState === "aiTalking" ? (
                  <p className="text-xl font-medium text-blue-600">
                    AI 正在为您朗读回应...
                  </p>
                ) : (
                  <p className="text-xl font-medium text-stone-700">
                    {wsConnected ? "请点击开始讲述" : "正在连接..."}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              {convoState === "idle" && (
                <div className="flex justify-center">
                  <button
                    disabled={networkStatus === "offline"}
                    onMouseDown={() => recordMode === "hold" && startManualRecord()}
                    onMouseUp={() => recordMode === "hold" && stopManualRecord()}
                    onTouchStart={(e) => { e.preventDefault(); recordMode === "hold" && startManualRecord(); }}
                    onTouchEnd={(e) => { e.preventDefault(); recordMode === "hold" && stopManualRecord(); }}
                    onClick={() => recordMode === "table" && startAutoRecord()}
                    className="flex items-center gap-3 rounded-2xl bg-red-600 px-10 py-6 text-2xl font-bold text-white shadow-md transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
                  >
                    <Mic className="h-8 w-8" />
                    {recordMode === "hold" ? "长按 开始讲述" : "点击 开始畅聊"}
                  </button>
                </div>
              )}

              {convoState === "userRecording" && recordMode === "table" && (
                <div className="flex justify-center">
                  <button
                    onClick={stopAutoRecord}
                    className="flex items-center justify-center gap-3 rounded-2xl bg-stone-700 px-8 py-5 text-2xl font-bold text-amber-50 shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <Square className="h-8 w-8" />
                    讲完了
                  </button>
                </div>
              )}
              
              {convoState === "userRecording" && recordMode === "hold" && (
                <div className="flex justify-center">
                  <div 
                    onMouseUp={stopManualRecord} 
                    onMouseLeave={stopManualRecord}
                    onTouchEnd={(e) => { e.preventDefault(); stopManualRecord(); }}
                    className="flex items-center justify-center gap-3 rounded-2xl bg-stone-800 px-8 py-5 text-2xl font-bold text-amber-50 shadow-md cursor-pointer animate-pulse"
                  >
                    <Mic className="h-8 w-8 text-red-500" />
                    录音中，松开发送...
                  </div>
                </div>
              )}

              {convoState === "aiTalking" && (
                <div className="flex justify-center">
                  <button
                    onClick={stopAll}
                    className="flex items-center justify-center gap-3 rounded-2xl bg-stone-700 px-8 py-5 text-2xl font-bold text-amber-50 shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <Square className="h-8 w-8" />
                    停止播放
                  </button>
                </div>
              )}

              {convoState === "aiThinking" && (
                <div className="flex justify-center opacity-50 pointer-events-none">
                  <div className="flex items-center gap-3 rounded-2xl bg-orange-600 px-10 py-6 text-2xl font-bold text-white shadow-md">
                    <Sparkles className="h-8 w-8 animate-spin" />
                    思考中...
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* RIGHT SIDEBAR */}
      <aside className="flex w-[25%] flex-col rounded-3xl bg-amber-100/70 p-5 shadow-md">
        <div className="mb-4">
          <p className="text-lg font-semibold text-stone-600">今天想聊哪个主题？</p>
          <h2 className="mt-1 text-2xl font-bold text-stone-800">传记主题</h2>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {topicProfile?.topics.map((topic) => {
            const active = topic.id === topicProfile.currentTopicId;
            const progress = Math.max(0, Math.min(100, topic.progress || 0));
            const statusLabel = getTopicStatusLabel(topic.status, progress);

            return (
              <button
                key={topic.id}
                onClick={() => selectTopic(topic.id)}
                className={`w-full rounded-2xl px-4 py-3 text-left shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98] ${
                  active
                    ? "bg-amber-300 text-stone-900 ring-2 ring-amber-700/35"
                    : "bg-amber-50 text-stone-800 hover:bg-amber-100"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 text-lg font-bold leading-snug">
                    {topic.title}
                  </span>
                  {active && (
                    <span className="shrink-0 rounded-full bg-stone-800 px-2 py-1 text-xs font-semibold text-amber-50">
                      正在聊
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-300/60">
                    <div
                      className={`h-full rounded-full ${
                        progress >= 85 ? "bg-emerald-500" : "bg-amber-700"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-sm font-semibold text-stone-700">
                    {progress}%
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-stone-600">
                  {statusLabel}
                </p>
              </button>
            );
          })}
        </div>
      </aside>
    </main>
  );
}
