import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Mic2,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  UserRound,
  Wand2,
} from "lucide-react";

const VOICE_STEPS = [
  { title: "录制 5 句话", description: "覆盖问候、安慰、鼓励回忆等常见语气。" },
  { title: "确认本人授权", description: "仅用于该老人账号的 AI 陪伴朗读展示。" },
  { title: "生成陪伴声音", description: "生成完成后可试听，并设置为默认声音。" },
];

const MOCK_VOICES = [
  {
    name: "默认 AI 温暖女声",
    relation: "系统声音",
    status: "当前使用",
    statusTone: "emerald",
    description: "当前老人聊天回复使用的默认朗读声音。",
  },
  {
    name: "女儿小郑",
    relation: "女儿",
    status: "生成中",
    statusTone: "amber",
    description: "已提交录音样本，等待内部测试生成结果。",
  },
  {
    name: "儿子阿远",
    relation: "儿子",
    status: "待授权",
    statusTone: "stone",
    description: "样本已预留，需本人确认后才可进入生成流程。",
  },
];

const statusClassName = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  stone: "border-stone-200 bg-stone-50 text-stone-600",
};

export function FamilyVoicePanel() {
  return (
    <div className="space-y-5">
      {/* 模块：内部测试提示 */}
      <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-black text-amber-900">该功能内部测试中，敬请期待！</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-800">
              当前页面仅作为家人端功能展示，不会录制真实声音，也不会提交到语音生成服务。
            </p>
          </div>
        </div>
      </section>

      {/* 模块：当前陪伴声音 */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-stone-900 text-white shadow-lg shadow-stone-900/10">
              <Mic2 className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">
                当前陪伴声音
              </p>
              <h3 className="mt-1 text-xl font-black text-stone-900">默认 AI 温暖女声</h3>
              <p className="mt-1 text-sm text-stone-500">暂未启用家人授权声音。</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-bold text-stone-400"
            >
              <PlayCircle className="h-4 w-4" />
              试听
            </button>
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-bold text-white opacity-40"
            >
              <Wand2 className="h-4 w-4" />
              更换声音
            </button>
          </div>
        </div>
      </section>

      {/* 模块：添加声音流程 */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              家人本人授权后使用
            </div>
            <h3 className="mt-3 text-xl font-black text-stone-900">添加我的声音</h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500">
              家人可录制几句话，未来用于生成授权陪伴声音，让老人聊天时听到更熟悉的声音。
            </p>
          </div>
          <button
            type="button"
            disabled
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-black text-white opacity-45"
          >
            <Mic2 className="h-4 w-4" />
            开始录制
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {VOICE_STEPS.map((step, index) => (
            <div
              key={step.title}
              className="rounded-2xl border border-stone-100 bg-stone-50/80 p-4"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-black text-amber-700 shadow-sm">
                {index + 1}
              </div>
              <p className="font-black text-stone-900">{step.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-stone-500">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 模块：声音库 Mock 数据 */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-stone-900">声音库</h3>
            <p className="mt-1 text-sm text-stone-500">以下为展示用 Mock 数据。</p>
          </div>
          <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-bold text-stone-500">
            最多展示 3 个声音
          </span>
        </div>

        <div className="grid gap-3">
          {MOCK_VOICES.map((voice) => (
            <div
              key={voice.name}
              className="flex flex-col gap-4 rounded-2xl border border-stone-100 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-stone-900">{voice.name}</p>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-bold ${
                        statusClassName[voice.statusTone as keyof typeof statusClassName]
                      }`}
                    >
                      {voice.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-amber-700">{voice.relation}</p>
                  <p className="mt-1 text-sm text-stone-500">{voice.description}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 md:justify-end">
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-400"
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  试听
                </button>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-400"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  设为默认
                </button>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-400"
                >
                  <PauseCircle className="h-3.5 w-3.5" />
                  停用
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-stone-50 p-3 text-xs leading-relaxed text-stone-500">
          <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
          Mock 版本仅展示未来交互状态：录音、授权、生成、试听和默认声音切换均未接入真实服务。
        </div>
      </section>
    </div>
  );
}
