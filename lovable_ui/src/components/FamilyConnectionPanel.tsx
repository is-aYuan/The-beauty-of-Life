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
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="border-b-2 border-amber-200 pb-5">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-stone-800 text-amber-50 shadow-md">
            <HeartHandshake className="h-9 w-9" />
          </div>
          <div>
            <h2 className="text-4xl font-bold text-stone-800">亲情连接</h2>
            <p className="mt-2 text-xl text-stone-600">家人的声音，未来会在这里陪您慢慢聊。</p>
          </div>
        </div>
      </header>

      <div className="space-y-6 py-6">
        {/* 模块：内部测试提示 */}
        <section className="rounded-3xl bg-amber-100/80 p-6 shadow-sm ring-1 ring-amber-200">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-200 text-amber-900">
              <BellRing className="h-8 w-8" />
            </div>
            <div>
              <p className="text-3xl font-bold text-stone-800">该功能内部测试中，敬请期待！</p>
              <p className="mt-3 text-xl leading-relaxed text-stone-600">
                家人声音陪伴功能正在准备中，当前页面仅展示未来体验，不会录制或提交真实声音。
              </p>
            </div>
          </div>
        </section>

        {/* 模块：当前亲情声音 */}
        <section className="rounded-3xl bg-white/90 p-6 shadow-sm ring-1 ring-amber-100">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-5">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.75rem] bg-stone-800 text-amber-50 shadow-md">
                <Volume2 className="h-10 w-10" />
              </div>
              <div>
                <p className="text-lg font-bold text-amber-700">当前亲情声音</p>
                <h3 className="mt-1 text-3xl font-bold text-stone-800">默认 AI 温暖女声</h3>
                <p className="mt-2 text-xl leading-relaxed text-stone-600">
                  家人声音暂未启用。未来家人授权后，AI 回复可使用熟悉的家人声音朗读。
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled
                className="flex items-center gap-2 rounded-2xl bg-amber-100 px-5 py-4 text-xl font-bold text-stone-400 opacity-70"
              >
                <PlayCircle className="h-6 w-6" />
                听一听
              </button>
              <button
                type="button"
                disabled
                className="flex items-center gap-2 rounded-2xl bg-stone-800 px-5 py-4 text-xl font-bold text-amber-50 opacity-40"
              >
                <Mic2 className="h-6 w-6" />
                查看家人声音
              </button>
            </div>
          </div>
        </section>

        {/* 模块：家人声音展示 */}
        <section className="rounded-3xl bg-white/90 p-6 shadow-sm ring-1 ring-amber-100">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-3xl font-bold text-stone-800">家人声音</h3>
              <p className="mt-2 text-xl text-stone-600">以下是展示用状态，真实功能暂未开放。</p>
            </div>
            <Sparkles className="hidden h-9 w-9 text-amber-600 md:block" />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {FAMILY_VOICE_CARDS.map((voice) => (
              <article
                key={voice.name}
                className="rounded-3xl bg-amber-50/70 p-5 ring-1 ring-amber-100"
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm">
                  <UserRound className="h-8 w-8" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-2xl font-bold text-stone-800">{voice.name}</h4>
                  <span className={`rounded-full px-3 py-1 text-sm font-bold ring-1 ${voice.tone}`}>
                    {voice.state}
                  </span>
                </div>
                <p className="mt-2 text-xl font-semibold text-amber-700">{voice.relation}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 模块：授权说明 */}
        <section className="rounded-3xl bg-blue-50/75 p-6 shadow-sm ring-1 ring-blue-100">
          <div className="flex items-start gap-4">
            <ShieldCheck className="mt-1 h-10 w-10 shrink-0 text-blue-700" />
            <div>
              <h3 className="text-2xl font-bold text-blue-950">使用说明</h3>
              <p className="mt-2 text-xl leading-relaxed text-blue-900">
                这是 AI 使用家人授权声音进行朗读，不代表家人本人正在实时说话。
              </p>
            </div>
          </div>
        </section>

        {/* 模块：未来流程展示 */}
        <section className="rounded-3xl bg-white/90 p-6 shadow-sm ring-1 ring-amber-100">
          <h3 className="text-3xl font-bold text-stone-800">未来怎么使用</h3>
          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {FAMILY_VOICE_STEPS.map((step, index) => (
              <div key={step.title} className="rounded-3xl bg-stone-50 p-5">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-800 text-xl font-bold text-amber-50">
                  {index + 1}
                </div>
                <div className="flex items-center gap-2">
                  {index === 1 ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-700" />
                  ) : (
                    <Clock3 className="h-6 w-6 text-amber-700" />
                  )}
                  <p className="text-2xl font-bold text-stone-800">{step.title}</p>
                </div>
                <p className="mt-2 text-lg leading-relaxed text-stone-600">{step.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
