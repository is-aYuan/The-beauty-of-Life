import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Mic,
  Bot,
  Heart,
  Settings as SettingsIcon,
  Pause,
  Square,
  Sparkles,
  User,
  BookOpen,
  X,
  Volume2,
  Type,
} from "lucide-react";
import { useChatAutoScroll } from "../lib/chatAutoScroll";
import {
  buildBiographyGenerationDecision,
  getLatestBiography,
} from "../lib/biographyGeneration.js";
import { buildEntryGuidance } from "../lib/entryGuidance.js";
import {
  BIOGRAPHY_STYLE_OPTIONS,
  DEFAULT_BIOGRAPHY_STYLE_ID,
  type BiographyStyleId,
} from "../lib/biographyStyles.js";
import { buildMemoirTitle } from "../lib/memoirTitle.js";
import { useStoryEngine } from "../hooks/useStoryEngine";
import { useIsMobile } from "../hooks/use-mobile";
import { FamilyConnectionPanel } from "../components/FamilyConnectionPanel";
import { MobileAppShell } from "../components/mobile/MobileAppShell";
import {
  FONT_SCALE_PRESETS,
  FONT_SCALE_RANGE,
  SPEECH_RATE_PRESETS,
  SPEECH_RATE_RANGE,
  speechRateToPreviewRate,
  type FontSizePreset,
  type SpeechRatePreset,
  type UserPreferences,
} from "../lib/userPreferences.js";

export const Route = createFileRoute("/")({
  component: Index,
});

type Tab = "story" | "organizer" | "family" | "settings";
type RecordMode = "hold" | "table";

const NAV_ITEMS: { id: Tab; label: string; icon: typeof Mic }[] = [
  { id: "story", label: "讲我的故事", icon: Mic },
  { id: "organizer", label: "回忆库", icon: Bot },
  { id: "family", label: "亲情连接", icon: Heart },
  { id: "settings", label: "设置", icon: SettingsIcon },
];

const MOBILE_NAV_ITEMS: { id: Tab; label: string; icon: typeof Mic }[] = [
  { id: "story", label: "对话", icon: Mic },
  { id: "organizer", label: "回忆库", icon: BookOpen },
  { id: "family", label: "家庭", icon: Heart },
  { id: "settings", label: "设置", icon: SettingsIcon },
];

const TAB_TITLES: Record<Tab, string> = {
  story: "讲我的故事",
  organizer: "回忆库",
  family: "亲情连接",
  settings: "设置",
};

const SPEECH_RATE_OPTIONS: { id: Exclude<SpeechRatePreset, "custom">; label: string }[] = [
  { id: "slow", label: "慢一点" },
  { id: "normal", label: "标准" },
  { id: "fast", label: "快一点" },
];

const FONT_SIZE_OPTIONS: { id: Exclude<FontSizePreset, "custom">; label: string }[] = [
  { id: "normal", label: "标准" },
  { id: "large", label: "大" },
  { id: "extraLarge", label: "特大" },
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

function formatArchiveDate(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return new Date(value).toLocaleDateString("zh-CN");
  if (typeof value === "number") return new Date(value).toLocaleDateString("zh-CN");
  if (value instanceof Date) return value.toLocaleDateString("zh-CN");
  if (typeof value === "object") {
    const maybeTimestamp = value as { _seconds?: number; seconds?: number };
    const seconds = maybeTimestamp._seconds ?? maybeTimestamp.seconds;
    if (typeof seconds === "number") {
      return new Date(seconds * 1000).toLocaleDateString("zh-CN");
    }
  }
  return "";
}

function SettingsSegment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: string;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`rounded-2xl px-4 py-4 text-xl font-bold transition-transform hover:scale-[1.02] active:scale-[0.98] ${
              active
                ? "bg-stone-800 text-amber-50 shadow-md"
                : "bg-amber-100 text-stone-700 hover:bg-amber-200"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function SettingsPanel({
  preferences,
  onChange,
}: {
  preferences: UserPreferences;
  onChange: (updates: Partial<UserPreferences>) => void;
}) {
  const [previewSpeaking, setPreviewSpeaking] = useState(false);
  const previewText = "这是预览文字：我会陪您慢慢讲，把故事整理成回忆录。";
  const speechRateLabel =
    preferences.speechRate <= -1.75
      ? "最慢"
      : preferences.speechRate < -0.25
        ? "偏慢"
        : preferences.speechRate < 1.25
          ? "标准"
          : "偏快";

  const speakPreview = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(previewText);
    utterance.lang = "zh-CN";
    utterance.rate = speechRateToPreviewRate(preferences);
    utterance.onend = () => setPreviewSpeaking(false);
    utterance.onerror = () => setPreviewSpeaking(false);
    setPreviewSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="border-b-2 border-amber-200 pb-5">
        <h2 className="text-4xl font-bold text-stone-800">设置</h2>
        <p className="mt-2 text-xl text-stone-600">调整朗读和文字显示</p>
      </header>

      <div className="space-y-6 py-6">
        <section className="rounded-2xl bg-white/85 p-6 shadow-sm ring-1 ring-amber-100">
          <div className="mb-4 flex items-center gap-3">
            <Volume2 className="h-8 w-8 text-amber-700" />
            <h3 className="text-2xl font-bold text-stone-800">朗读语速</h3>
          </div>
          <SettingsSegment
            options={SPEECH_RATE_OPTIONS}
            value={preferences.speechRatePreset}
            onChange={(preset) =>
              onChange({
                speechRatePreset: preset,
                speechRate: SPEECH_RATE_PRESETS[preset],
              })
            }
          />
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-lg font-semibold text-stone-600">
              <span>更慢</span>
              <span>{speechRateLabel}</span>
              <span>更快</span>
            </div>
            <input
              type="range"
              min={SPEECH_RATE_RANGE.min}
              max={SPEECH_RATE_RANGE.max}
              step={SPEECH_RATE_RANGE.step}
              value={preferences.speechRate}
              onChange={(event) =>
                onChange({
                  speechRatePreset: "custom",
                  speechRate: Number(event.target.value),
                })
              }
              className="h-3 w-full accent-amber-700"
              aria-label="朗读语速微调"
            />
          </div>
          <button
            type="button"
            onClick={speakPreview}
            className="mt-5 flex items-center gap-2 rounded-xl bg-stone-800 px-5 py-3 text-lg font-bold text-amber-50 shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Volume2 className="h-5 w-5" />
            {previewSpeaking ? "正在试听" : "试听朗读"}
          </button>
        </section>

        <section className="rounded-2xl bg-white/85 p-6 shadow-sm ring-1 ring-amber-100">
          <div className="mb-4 flex items-center gap-3">
            <Type className="h-8 w-8 text-amber-700" />
            <h3 className="text-2xl font-bold text-stone-800">字体大小</h3>
          </div>
          <SettingsSegment
            options={FONT_SIZE_OPTIONS}
            value={preferences.fontSizePreset}
            onChange={(preset) =>
              onChange({
                fontSizePreset: preset,
                fontScale: FONT_SCALE_PRESETS[preset],
              })
            }
          />
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-lg font-semibold text-stone-600">
              <span>标准</span>
              <span>{Math.round(preferences.fontScale * 100)}%</span>
              <span>更大</span>
            </div>
            <input
              type="range"
              min={FONT_SCALE_RANGE.min}
              max={FONT_SCALE_RANGE.max}
              step={FONT_SCALE_RANGE.step}
              value={preferences.fontScale}
              onChange={(event) =>
                onChange({
                  fontSizePreset: "custom",
                  fontScale: Number(event.target.value),
                })
              }
              className="h-3 w-full accent-amber-700"
              aria-label="字体大小微调"
            />
          </div>
        </section>

        <section className="rounded-2xl bg-blue-50/70 p-6 ring-1 ring-blue-100">
          <p
            className="leading-relaxed text-blue-900"
            style={{ fontSize: `${Math.round(24 * preferences.fontScale)}px` }}
          >
            {previewText}
          </p>
        </section>
      </div>
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
    serverEntryGuidance,
    archive,
    biographies,
    userPreferences,
    userStats,
    chatHistory,
    frequencyData,
    recorderError,
    logout,
    startManualRecord,
    stopManualRecord,
    startAutoRecord,
    stopAutoRecord,
    stopAll,
    selectTopic,
    fetchArchive,
    fetchBiographies,
    generateBiography,
    activateArchiveRecommendation,
    updateUserPreferences,
  } = useStoryEngine();

  const [activeTab, setActiveTab] = useState<Tab>("story");
  const [recordMode, setRecordMode] = useState<RecordMode>("hold");
  const [biographyGenerating, setBiographyGenerating] = useState(false);
  const [styleDialogOpen, setStyleDialogOpen] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();

  // 模块：登录态入口守卫。SSR 阶段不能读取浏览器 localStorage，只在客户端判断本地登录态。
  const hasLocalUser = typeof localStorage !== "undefined" && !!localStorage.getItem("story_user");

  useEffect(() => {
    if (!hasLocalUser) {
      navigate({ to: "/login" });
    }
  }, [hasLocalUser, navigate]);

  useEffect(() => {
    if (activeTab === "organizer" && user) {
      fetchArchive();
      fetchBiographies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.userId]);

  useChatAutoScroll({
    activeTab,
    chatHistoryLength: chatHistory.length,
    subtitle,
    convoState,
    scrollContainerRef: chatScrollRef,
    latestMessageRef: chatEndRef,
  });

  if (!hasLocalUser || !user) return null;

  const currentTopic = topicProfile?.topics.find(
    (topic) => topic.id === topicProfile.currentTopicId,
  );
  const latestBiography = getLatestBiography(biographies);
  const biographyDecision = buildBiographyGenerationDecision({
    topics: topicProfile?.topics || [],
    biographies,
  });
  // 模块：入口引导状态。首页所有“开始/继续”提示统一从这里取，避免新用户误看到继续语气。
  const entryGuidance = buildEntryGuidance({
    userName: user.name,
    totalConversations: userStats.totalConversations,
    chatHistoryLength: chatHistory.length,
    currentTopicTitle: currentTopic?.title,
    wsConnected,
    networkStatus,
    subtitle,
    serverEntryGuidance,
  });
  const shouldShowEntryPrompt =
    Boolean(entryGuidance.storyPrompt) &&
    convoState !== "userRecording" &&
    (convoState !== "aiTalking" || chatHistory.length === 0);

  const getTopicStatusLabel = (status: string, progress: number) => {
    if (status === "rich" || progress >= 85) return "素材已丰富";
    if (status === "needs_detail") return "继续补充";
    if (status === "has_story") return "已有故事";
    if (status === "started") return "刚刚开始";
    return "还没开始";
  };

  const handleGenerateBiography = async () => {
    if (!biographyDecision.canGenerate) {
      window.alert(biographyDecision.message);
      return;
    }

    if (biographyDecision.requiresConfirmation && !window.confirm(biographyDecision.message)) {
      return;
    }

    setStyleDialogOpen(true);
  };

  const handleSelectBiographyStyle = async (style: BiographyStyleId) => {
    setStyleDialogOpen(false);
    setBiographyGenerating(true);
    try {
      const result = await generateBiography(style);
      if (!result.success) {
        window.alert(result.error || "生成回忆录失败，请稍后再试。");
        return;
      }
      await fetchArchive();
      window.alert("回忆录已经整理好了，您可以在回忆库里慢慢查看。");
    } finally {
      setBiographyGenerating(false);
    }
  };

  // 模块：移动端主内容。手机端只渲染当前模块，避免桌面三栏压缩到窄屏。
  const mobileMainContent =
    activeTab === "organizer" ? (
      <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 py-4">
        <header className="shrink-0 border-b border-amber-200 pb-4">
          <h2 className="text-2xl font-black text-stone-900">回忆库</h2>
          <p className="mt-1 text-base font-semibold text-stone-600">AI 帮您把刚刚讲过的回忆收好</p>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4">
          {!archive ? (
            <div className="rounded-2xl bg-white/85 p-5 text-center shadow-sm">
              <p className="text-lg font-bold text-stone-600">正在整理您的回忆...</p>
            </div>
          ) : (
            <>
              <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-amber-100">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-6 w-6 text-amber-700" />
                    <h3 className="text-xl font-black text-stone-800">我的回忆录</h3>
                  </div>
                  <button
                    onClick={handleGenerateBiography}
                    disabled={biographyGenerating}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-stone-800 px-4 text-base font-black text-amber-50 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Sparkles className={`h-5 w-5 ${biographyGenerating ? "animate-spin" : ""}`} />
                    {biographyGenerating ? "正在整理..." : "生成最新回忆录"}
                  </button>
                </div>

                {latestBiography ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl bg-amber-50 p-3">
                      <p className="text-xl font-black text-stone-900">
                        《{latestBiography.title || "我的回忆录"}》
                      </p>
                      <p className="mt-1 text-base font-semibold text-stone-600">
                        {formatArchiveDate(
                          latestBiography.updatedAt || latestBiography.createdAt,
                        ) || "最近整理"}
                        {latestBiography.chapterCount
                          ? ` · ${latestBiography.chapterCount} 章`
                          : ""}
                        {latestBiography.wordCount ? ` · 约 ${latestBiography.wordCount} 字` : ""}
                      </p>
                    </div>
                    {(latestBiography.chapters || []).length > 0 ? (
                      <div className="space-y-3">
                        {(latestBiography.chapters || []).map((chapter) => (
                          <article
                            key={`${chapter.number}-${chapter.title}`}
                            className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-amber-100"
                          >
                            <p className="text-lg font-black text-stone-800">
                              第 {chapter.number} 章：{chapter.title}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-stone-600">
                              {chapter.content}
                            </p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl bg-amber-50 p-3 text-base text-stone-600">
                        回忆录已经生成，章节内容正在整理展示中。
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-base leading-relaxed text-stone-600">
                    还没有生成回忆录。等至少一个主题进度达到 80% 后，我就可以帮您整理成一版故事。
                  </p>
                )}
              </section>

              <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-amber-100">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-6 w-6 text-amber-700" />
                  <h3 className="text-xl font-black text-stone-800">故事片段</h3>
                </div>
                <div className="mt-3 space-y-3">
                  {archive.storySnippets.length > 0 ? (
                    archive.storySnippets.map((story) => (
                      <article
                        key={`${story.sourceId}-${story.title}`}
                        className="rounded-xl bg-amber-50/80 p-3"
                      >
                        <p className="text-lg font-black text-stone-800">{story.title}</p>
                        <p className="mt-1 text-base leading-relaxed text-stone-600">
                          {story.text}
                        </p>
                      </article>
                    ))
                  ) : (
                    <p className="text-base text-stone-600">故事片段还在积累中。</p>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    ) : activeTab === "settings" ? (
      <div
        data-mobile-settings
        className="h-full overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <SettingsPanel preferences={userPreferences} onChange={updateUserPreferences} />
      </div>
    ) : activeTab === "family" ? (
      <div className="h-full overflow-y-auto px-4 py-4">
        <FamilyConnectionPanel />
      </div>
    ) : activeTab !== "story" ? (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <h2 className="text-3xl font-black text-stone-800">{TAB_TITLES[activeTab]}</h2>
        <p className="mt-3 text-xl leading-relaxed text-stone-600">此功能正在建设中……</p>
      </div>
    ) : (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-amber-200 px-4 py-4">
          <h2 className="text-2xl font-black leading-tight text-stone-900">
            {buildMemoirTitle(user.name)}
          </h2>
          <p className="mt-1 text-base font-semibold text-stone-600">今日陪伴</p>
          <p className="mt-0.5 text-sm font-medium text-stone-500">
            已记录 {userStats.totalConversations} 个对话，约 {userStats.estimatedDurationMin} 分钟
          </p>
        </header>

        <div ref={chatScrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {chatHistory.map((m) =>
            m.role === "ai" ? (
              <div key={m.id} className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-200 shadow-sm">
                  <Bot className="h-5 w-5 text-stone-700" />
                </div>
                <div className="max-w-[88%] rounded-2xl rounded-tl-none bg-white p-4 shadow-sm">
                  <p className="text-lg leading-relaxed text-stone-800">{m.text}</p>
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex items-start justify-end gap-3">
                <div className="max-w-[88%] rounded-2xl rounded-tr-none bg-amber-100 p-4 shadow-sm">
                  <p className="text-lg leading-relaxed text-stone-800">{m.text}</p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-700 shadow-sm">
                  <User className="h-5 w-5 text-amber-50" />
                </div>
              </div>
            ),
          )}

          {shouldShowEntryPrompt && (
            <div className="border-t border-amber-200/60 pt-3">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <p className="text-lg leading-relaxed text-blue-800">{entryGuidance.storyPrompt}</p>
              </div>
            </div>
          )}

          {convoState === "aiThinking" && (
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 animate-pulse items-center justify-center rounded-full bg-stone-200 shadow-sm">
                <Bot className="h-5 w-5 text-stone-700" />
              </div>
              <div className="rounded-2xl rounded-tl-none border border-orange-100 bg-white p-4 shadow-sm">
                <p className="animate-pulse text-lg leading-relaxed text-orange-600">
                  我在帮您整理故事，马上就好...
                </p>
              </div>
            </div>
          )}
          <div ref={chatEndRef} aria-hidden="true" />
        </div>
      </div>
    );

  const biographyStyleDialog = styleDialogOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/55 p-6">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-7 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-stone-900">选择回忆录文风</h2>
            <p className="mt-2 text-base leading-relaxed text-stone-500">
              请选择这次生成回忆录的表达方式。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStyleDialogOpen(false)}
            className="rounded-full border border-stone-200 p-2 text-stone-400 hover:bg-stone-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {BIOGRAPHY_STYLE_OPTIONS.map((style) => {
            const recommended = style.id === DEFAULT_BIOGRAPHY_STYLE_ID;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => handleSelectBiographyStyle(style.id)}
                className={`rounded-2xl border p-5 text-left transition-transform hover:scale-[1.02] active:scale-[0.98] ${
                  recommended
                    ? "border-amber-300 bg-amber-50 ring-2 ring-amber-200"
                    : "border-stone-200 bg-white hover:bg-stone-50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xl font-black text-stone-900">{style.label}</p>
                  {recommended && (
                    <span className="rounded-full bg-amber-600 px-2.5 py-1 text-xs font-bold text-white">
                      默认
                    </span>
                  )}
                </div>
                <p className="mt-2 text-base leading-relaxed text-stone-600">{style.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  ) : null;

  if (isMobile) {
    return (
      <>
        <MobileAppShell
          tabs={MOBILE_NAV_ITEMS}
          activeTab={activeTab}
          storyTabId="story"
          topics={topicProfile?.topics || []}
          currentTopicId={topicProfile?.currentTopicId}
          recordMode={recordMode}
          convoState={convoState}
          networkStatus={networkStatus}
          idleStatus={entryGuidance.idleStatus}
          frequencyData={frequencyData}
          recorderError={recorderError}
          onTabChange={setActiveTab}
          onLogout={logout}
          onTopicSelect={selectTopic}
          getTopicStatusLabel={getTopicStatusLabel}
          onRecordModeChange={setRecordMode}
          onStartManualRecord={startManualRecord}
          onStopManualRecord={stopManualRecord}
          onStartAutoRecord={startAutoRecord}
          onStopAutoRecord={stopAutoRecord}
          onStopAll={stopAll}
        >
          {mobileMainContent}
        </MobileAppShell>
        {biographyStyleDialog}
      </>
    );
  }

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
        {activeTab === "organizer" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <header className="border-b-2 border-amber-200 pb-5">
              <h2 className="text-4xl font-bold text-stone-800">回忆库</h2>
              <p className="mt-2 text-xl text-stone-600">AI 帮您把刚刚讲过的回忆收好</p>
            </header>

            <div className="flex-1 space-y-5 overflow-y-auto py-5 pr-2">
              {!archive ? (
                <div className="rounded-2xl bg-white/80 p-6 text-center shadow-sm">
                  <p className="text-xl text-stone-600">正在整理您的回忆...</p>
                </div>
              ) : (
                <>
                  <section className="rounded-2xl bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <BookOpen className="h-7 w-7 text-amber-700" />
                        <h3 className="text-2xl font-bold text-stone-800">我的回忆录</h3>
                      </div>
                      <button
                        onClick={handleGenerateBiography}
                        disabled={biographyGenerating}
                        className="flex items-center gap-2 rounded-xl bg-stone-800 px-5 py-3 text-lg font-bold text-amber-50 shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                      >
                        <Sparkles
                          className={`h-5 w-5 ${biographyGenerating ? "animate-spin" : ""}`}
                        />
                        {biographyGenerating ? "正在整理..." : "生成最新回忆录"}
                      </button>
                    </div>

                    {latestBiography ? (
                      <div className="mt-5 space-y-4">
                        <div className="rounded-xl bg-amber-50 p-4">
                          <p className="text-2xl font-bold text-stone-900">
                            《{latestBiography.title || "我的回忆录"}》
                          </p>
                          <p className="mt-2 text-lg text-stone-600">
                            {formatArchiveDate(
                              latestBiography.updatedAt || latestBiography.createdAt,
                            ) || "最近整理"}
                            {latestBiography.chapterCount
                              ? ` · ${latestBiography.chapterCount} 章`
                              : ""}
                            {latestBiography.wordCount
                              ? ` · 约 ${latestBiography.wordCount} 字`
                              : ""}
                          </p>
                        </div>
                        {(latestBiography.chapters || []).length > 0 ? (
                          <div className="space-y-3">
                            {(latestBiography.chapters || []).map((chapter) => (
                              <article
                                key={`${chapter.number}-${chapter.title}`}
                                className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-amber-100"
                              >
                                <p className="text-xl font-bold text-stone-800">
                                  第 {chapter.number} 章：{chapter.title}
                                </p>
                                <p className="mt-2 whitespace-pre-wrap text-lg leading-relaxed text-stone-600">
                                  {chapter.content}
                                </p>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-xl bg-amber-50 p-4 text-lg text-stone-600">
                            回忆录已经生成，章节内容正在整理展示中。
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-4 text-lg leading-relaxed text-stone-600">
                        还没有生成回忆录。等至少一个主题进度达到 80%
                        后，我就可以帮您整理成一版故事。
                      </p>
                    )}
                  </section>

                  <section className="rounded-2xl bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <BookOpen className="h-7 w-7 text-amber-700" />
                      <h3 className="text-2xl font-bold text-stone-800">故事片段</h3>
                    </div>
                    <div className="mt-4 space-y-3">
                      {archive.storySnippets.length > 0 ? (
                        archive.storySnippets.map((story) => (
                          <article
                            key={`${story.sourceId}-${story.title}`}
                            className="rounded-xl bg-amber-50/80 p-4"
                          >
                            <p className="text-xl font-bold text-stone-800">{story.title}</p>
                            <p className="mt-1 text-lg leading-relaxed text-stone-600">
                              {story.text}
                            </p>
                          </article>
                        ))
                      ) : (
                        <p className="text-lg text-stone-600">故事片段还在积累中。</p>
                      )}
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        ) : activeTab === "settings" ? (
          <SettingsPanel preferences={userPreferences} onChange={updateUserPreferences} />
        ) : activeTab === "family" ? (
          <FamilyConnectionPanel />
        ) : activeTab !== "story" ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <h2 className="text-4xl font-bold text-stone-800">{TAB_TITLES[activeTab]}</h2>
            <p className="mt-4 text-2xl leading-relaxed text-stone-600">此功能正在建设中……</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            <header className="border-b-2 border-amber-200 pb-5">
              <h2 className="text-4xl font-bold text-stone-800">{buildMemoirTitle(user.name)}</h2>
              <p className="mt-2 text-xl text-stone-600">今日陪伴</p>
              <p className="mt-1 text-sm text-stone-500">
                已记录 {userStats.totalConversations} 个对话，约 {userStats.estimatedDurationMin}{" "}
                分钟
              </p>
            </header>

            {/* Scrollable chat log */}
            <div ref={chatScrollRef} className="flex-1 space-y-6 overflow-y-auto p-6">
              {chatHistory.map((m) =>
                m.role === "ai" ? (
                  <div key={m.id} className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-stone-200 shadow-sm">
                      <Bot className="h-7 w-7 text-stone-700" />
                    </div>
                    <div className="max-w-[78%] rounded-3xl rounded-tl-none bg-white p-5 shadow-md">
                      <p className="text-2xl leading-relaxed text-stone-800">{m.text}</p>
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex items-start justify-end gap-4">
                    <div className="max-w-[78%] rounded-3xl rounded-tr-none bg-amber-100 p-5 shadow-md">
                      <p className="text-2xl leading-relaxed text-stone-800">{m.text}</p>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-stone-700 shadow-sm">
                      <User className="h-7 w-7 text-amber-50" />
                    </div>
                  </div>
                ),
              )}

              {/* Subtitle from stream */}
              {shouldShowEntryPrompt && (
                <div className="flex items-start gap-4 pt-4 border-t border-amber-200/50">
                  <div className="max-w-[100%] bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
                    <p className="text-2xl leading-relaxed text-blue-800">
                      {entryGuidance.storyPrompt}
                    </p>
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
              <div ref={chatEndRef} aria-hidden="true" />
            </div>

            {/* Sticky bottom control panel */}
            <div className="sticky bottom-0 border-t-2 border-amber-200 bg-amber-50 p-4">
              {/* Mode toggle */}
              <div className="mx-auto mb-4 flex w-fit rounded-full bg-amber-100 p-1 text-stone-600">
                {(
                  [
                    { id: "hold", label: "按住说话" },
                    { id: "table", label: "放桌上畅聊" },
                  ] as { id: RecordMode; label: string }[]
                ).map((opt) => {
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
                    <p className="text-xl font-bold text-emerald-600">正在听您说...</p>
                    <MiniVisualizer freqData={frequencyData} />
                  </>
                ) : convoState === "aiThinking" ? (
                  <p className="animate-pulse text-xl font-medium text-orange-500">
                    AI 正在思考处理中...
                  </p>
                ) : convoState === "aiTalking" ? (
                  <p className="text-xl font-medium text-blue-600">AI 正在为您朗读回应...</p>
                ) : (
                  <p className="text-xl font-medium text-stone-700">{entryGuidance.idleStatus}</p>
                )}
              </div>

              {/* Action buttons */}
              {convoState === "idle" && (
                <div className="flex justify-center">
                  <button
                    disabled={networkStatus === "offline"}
                    onMouseDown={() => recordMode === "hold" && startManualRecord()}
                    onMouseUp={() => recordMode === "hold" && stopManualRecord()}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      if (recordMode === "hold") {
                        startManualRecord();
                      }
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      if (recordMode === "hold") {
                        stopManualRecord();
                      }
                    }}
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
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      stopManualRecord();
                    }}
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
                  <span className="min-w-0 text-lg font-bold leading-snug">{topic.title}</span>
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
                <p className="mt-2 text-sm font-medium text-stone-600">{statusLabel}</p>
              </button>
            );
          })}
        </div>
      </aside>

      {biographyStyleDialog}
    </main>
  );
}
