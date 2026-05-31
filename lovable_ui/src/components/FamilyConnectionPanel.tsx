import {
  BellRing,
  CheckCircle2,
  Clock3,
  HeartHandshake,
  Mic2,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  UserRound,
  Volume2,
} from "lucide-react";

const FAMILY_VOICE_CARDS = [
  {
    name: "默认 AI 温暖女声",
    relation: "系统声音",
    state: "当前使用",
    tone: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  },
  {
    name: "女儿小郑",
    relation: "女儿",
    state: "内部测试中",
    tone: "bg-amber-100 text-amber-800 ring-amber-200",
  },
  {
    name: "儿子阿远",
    relation: "儿子",
    state: "待家人授权",
    tone: "bg-stone-100 text-stone-700 ring-stone-200",
  },
];

const FAMILY_VOICE_STEPS = [
  { title: "家人录制声音", description: "由家人本人完成录制，不需要老人操作。" },
  { title: "确认本人授权", description: "确认声音仅用于这个家庭账号的陪伴朗读。" },
  { title: "聊天时听见熟悉声音", description: "未来 AI 回复可用授权声音朗读出来。" },
];

export function FamilyConnectionPanel() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
      <header className="border-b-2 border-amber-200 pb-5">
        <div className="flex flex-col items-start gap-3 xs:flex-row xs:items-center xs:gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-stone-800 text-amber-50 shadow-md xs:h-16 xs:w-16 xs:rounded-3xl">
            <HeartHandshake className="h-7 w-7 xs:h-9 xs:w-9" />
          </div>
          <div className="min-w-0">
            <h2 className="text-3xl font-bold text-stone-800 xs:text-4xl">亲情连接</h2>
            <p className="mobile-safe-text mt-2 text-base text-stone-600 xs:text-xl">
              家人的声音，未来会在这里陪您慢慢聊。
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-6 py-6">
        {/* 模块：内部测试提示 */}
        <section className="min-w-0 rounded-3xl bg-amber-100/80 p-4 shadow-sm ring-1 ring-amber-200 xs:p-6">
          <div className="flex flex-col items-start gap-3 xs:flex-row xs:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-200 text-amber-900 xs:h-14 xs:w-14">
              <BellRing className="h-7 w-7 xs:h-8 xs:w-8" />
            </div>
            <div className="min-w-0">
              <p className="mobile-safe-text text-2xl font-bold text-stone-800 xs:text-3xl">
                该功能内部测试中，敬请期待！
              </p>
              <p className="mobile-safe-text mt-3 text-base leading-relaxed text-stone-600 xs:text-xl">
                家人声音陪伴功能正在准备中，当前页面仅展示未来体验，不会录制或提交真实声音。
              </p>
            </div>
          </div>
        </section>

        {/* 模块：当前亲情声音 */}
        <section className="min-w-0 rounded-3xl bg-white/90 p-4 shadow-sm ring-1 ring-amber-100 xs:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col items-start gap-4 xs:flex-row xs:gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-stone-800 text-amber-50 shadow-md xs:h-20 xs:w-20 xs:rounded-[1.75rem]">
                <Volume2 className="h-8 w-8 xs:h-10 xs:w-10" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-amber-700">当前亲情声音</p>
                <h3 className="mobile-safe-text mt-1 text-2xl font-bold text-stone-800 xs:text-3xl">
                  默认 AI 温暖女声
                </h3>
                <p className="mobile-safe-text mt-2 text-base leading-relaxed text-stone-600 xs:text-xl">
                  家人声音暂未启用。未来家人授权后，AI 回复可使用熟悉的家人声音朗读。
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled
                className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-100 px-4 py-3 text-lg font-bold text-stone-400 opacity-70 xs:flex-none xs:px-5 xs:py-4 xs:text-xl"
              >
                <PlayCircle className="h-6 w-6" />
                听一听
              </button>
              <button
                type="button"
                disabled
                className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-stone-800 px-4 py-3 text-lg font-bold text-amber-50 opacity-40 xs:flex-none xs:px-5 xs:py-4 xs:text-xl"
              >
                <Mic2 className="h-6 w-6" />
                查看家人声音
              </button>
            </div>
          </div>
        </section>

        {/* 模块：家人声音展示 */}
        <section className="min-w-0 rounded-3xl bg-white/90 p-4 shadow-sm ring-1 ring-amber-100 xs:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-2xl font-bold text-stone-800 xs:text-3xl">家人声音</h3>
              <p className="mobile-safe-text mt-2 text-base text-stone-600 xs:text-xl">
                以下是展示用状态，真实功能暂未开放。
              </p>
            </div>
            <Sparkles className="hidden h-9 w-9 text-amber-600 md:block" />
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-3">
            {FAMILY_VOICE_CARDS.map((voice) => (
              <article
                key={voice.name}
                className="min-w-0 rounded-3xl bg-amber-50/70 p-4 ring-1 ring-amber-100 xs:p-5"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm xs:h-14 xs:w-14">
                  <UserRound className="h-7 w-7 xs:h-8 xs:w-8" />
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h4 className="mobile-safe-text min-w-0 text-xl font-bold text-stone-800 xs:text-2xl">
                    {voice.name}
                  </h4>
                  <span className={`rounded-full px-3 py-1 text-sm font-bold ring-1 ${voice.tone}`}>
                    {voice.state}
                  </span>
                </div>
                <p className="mt-2 text-base font-semibold text-amber-700 xs:text-xl">
                  {voice.relation}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* 模块：授权说明 */}
        <section className="min-w-0 rounded-3xl bg-blue-50/75 p-4 shadow-sm ring-1 ring-blue-100 xs:p-6">
          <div className="flex flex-col items-start gap-3 xs:flex-row xs:gap-4">
            <ShieldCheck className="mt-1 h-8 w-8 shrink-0 text-blue-700 xs:h-10 xs:w-10" />
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-blue-950 xs:text-2xl">使用说明</h3>
              <p className="mobile-safe-text mt-2 text-base leading-relaxed text-blue-900 xs:text-xl">
                这是 AI 使用家人授权声音进行朗读，不代表家人本人正在实时说话。
              </p>
            </div>
          </div>
        </section>

        {/* 模块：未来流程展示 */}
        <section className="min-w-0 rounded-3xl bg-white/90 p-4 shadow-sm ring-1 ring-amber-100 xs:p-6">
          <h3 className="text-2xl font-bold text-stone-800 xs:text-3xl">未来怎么使用</h3>
          <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-3">
            {FAMILY_VOICE_STEPS.map((step, index) => (
              <div key={step.title} className="min-w-0 rounded-3xl bg-stone-50 p-4 xs:p-5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-stone-800 text-lg font-bold text-amber-50 xs:h-12 xs:w-12 xs:text-xl">
                  {index + 1}
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  {index === 1 ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-700" />
                  ) : (
                    <Clock3 className="h-6 w-6 text-amber-700" />
                  )}
                  <p className="mobile-safe-text min-w-0 text-xl font-bold text-stone-800 xs:text-2xl">
                    {step.title}
                  </p>
                </div>
                <p className="mobile-safe-text mt-2 text-base leading-relaxed text-stone-600 xs:text-lg">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
