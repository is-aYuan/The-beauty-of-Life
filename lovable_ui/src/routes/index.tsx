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
  AlertTriangle,
  Share2,
  User,
  BookOpen,
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

const FAMILY = [
  { name: "儿子 伟", role: "儿子" },
  { name: "女儿 美", role: "女儿" },
  { name: "孙子 博", role: "孙子" },
  { name: "侄女 琳", role: "侄女" },
];

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
    hasBiography,
    userStats,
    chatHistory,
    frequencyData,
    logout,
    startManualRecord,
    stopManualRecord,
    startAutoRecord,
    stopAutoRecord,
    stopAll
  } = useStoryEngine();

  const [activeTab, setActiveTab] = useState<Tab>("story");
  const [recordMode, setRecordMode] = useState<RecordMode>("hold");
  const [isGeneratingBook, setIsGeneratingBook] = useState(false);

  const hasLocalUser = !!localStorage.getItem("story_user");

  useEffect(() => {
    if (!hasLocalUser) {
      navigate({ to: "/login" });
    }
  }, [hasLocalUser, navigate]);

  if (!hasLocalUser || !user) return null;

  const handleGenerateBiography = async () => {
    setIsGeneratingBook(true);
    try {
      const res = await fetch(`http://localhost:8000/api/biographies/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.userId })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || "生成失败");
      } else {
        alert(`生成成功！《${data.title}》`);
      }
    } catch {
      alert("网络错误，自传生成失败");
    } finally {
      setIsGeneratingBook(false);
    }
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

      {/* RIGHT FAMILY CARE */}
      <aside className="flex w-[25%] flex-col rounded-3xl bg-amber-100/70 p-5 shadow-md">
        {/* Milestone Card */}
        <div className="mb-6 rounded-2xl bg-white p-6 shadow-md">
          <div className="mb-4 flex items-center gap-3">
            <BookOpen className="h-7 w-7 text-amber-700" />
            <h3 className="text-xl font-bold text-stone-800">传记准备进度</h3>
          </div>

          {!hasBiography ? (
            <div className="mb-5">
              <p className="mt-3 text-lg font-semibold text-stone-800">
                多和我聊聊您的故事
              </p>
              <p className="mt-1 text-base text-stone-600">
                当您的生活细节积累足够，即可自动生成回忆录！
              </p>
            </div>
          ) : (
            <div className="mb-5">
                <p className="mt-3 text-lg font-semibold text-emerald-600">
                  可生成新版本传记！
                </p>
            </div>
          )}

          {!hasBiography && (
              <button
                onClick={handleGenerateBiography}
                className="flex w-full flex-col items-center gap-2 rounded-2xl bg-amber-600 px-4 py-6 text-white shadow-lg ring-4 ring-amber-300/40 transition-transform hover:scale-105 active:scale-95 animate-bounce cursor-pointer"
                style={{ animationDuration: "2.5s" }}
              >
                <span className="text-2xl font-bold">📖 强行生成自传</span>
                <span className="text-sm font-medium text-amber-50/90">
                  (测试通道)
                </span>
              </button>
          )}
        </div>

        <h2 className="px-1 pb-4 text-3xl font-bold text-stone-800">
          亲情关怀
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {FAMILY.map((p) => (
            <button
              key={p.name}
              className="flex flex-col items-center gap-2 rounded-2xl bg-amber-50 p-4 shadow-md transition-transform hover:scale-105 active:scale-95"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-stone-700 text-amber-50">
                <User className="h-8 w-8" />
              </div>
              <p className="text-lg font-semibold text-stone-800">{p.name}</p>
              <p className="text-sm text-stone-500">{p.role}</p>
            </button>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-5">
          <button className="flex items-center justify-center gap-3 rounded-2xl bg-red-600 px-4 py-6 text-2xl font-bold text-white shadow-md transition-transform hover:scale-105 active:scale-95">
            <AlertTriangle className="h-8 w-8" />
            紧急求助
          </button>
          <button className="flex items-center justify-center gap-3 rounded-2xl bg-stone-800 px-4 py-5 text-xl font-semibold text-amber-50 shadow-md transition-transform hover:scale-105 active:scale-95">
            <Share2 className="h-6 w-6" />
            分享给家人
          </button>
        </div>
      </aside>

      {isGeneratingBook && (
        <div className="fixed inset-0 z-50 flex h-full flex-col items-center justify-center bg-amber-50/95 backdrop-blur-sm">
          <div
            className="flex h-48 w-48 items-center justify-center rounded-2xl bg-stone-800 shadow-2xl ring-4 ring-amber-600/60 animate-bounce"
            style={{ animationDuration: "2.4s" }}
          >
            <BookOpen className="h-32 w-32 animate-pulse text-amber-100" strokeWidth={1.6} />
          </div>
          <h2 className="mt-8 text-4xl font-bold text-stone-800">
            正在为您撰写您的故事～
          </h2>
          <p className="mt-4 text-2xl text-stone-600">
            AI 编辑正在为您精美排版，请稍作休息... (大概需要1-2分钟)
          </p>
          <div className="mt-8 h-6 w-1/2 overflow-hidden rounded-full bg-stone-200">
            <div className="h-full w-[60%] animate-pulse rounded-full bg-amber-500" />
          </div>
          <button
            onClick={() => setIsGeneratingBook(false)}
            className="mt-12 rounded-full border-2 border-stone-300 px-8 py-3 text-xl text-stone-500 transition-transform hover:scale-105 active:scale-95"
          >
            隐藏弹窗 (后台生成中)
          </button>
        </div>
      )}
    </main>
  );
}
