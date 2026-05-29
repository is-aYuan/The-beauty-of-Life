import { Activity, Coins, Cpu, Mic2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// 模块：管理后台成本监控面板。所有 API 用量、成本曲线和拆分表集中在这里维护，方便后续扩展供应商价格。
export type AdminUsage = {
  range: string;
  generatedAt: string;
  summary: {
    todayCostCny: number;
    monthCostCny: number;
    todayTokens: number;
    todayAudioMinutes: number;
    todayTtsChars: number;
    pricingConfigured: boolean;
  };
  timeline: Array<{
    date: string;
    costCny: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    audioMinutes: number;
    ttsChars: number;
    calls: number;
    failures: number;
  }>;
  providers: UsageBreakdown[];
  operations: UsageBreakdown[];
};

type UsageBreakdown = {
  provider?: string;
  operation?: string;
  costCny: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  audioMinutes: number;
  ttsChars: number;
  calls: number;
  failures: number;
};

type UsageCostPanelProps = {
  usage: AdminUsage | null;
  loading?: boolean;
};

const EMPTY_USAGE: AdminUsage = {
  range: "7d",
  generatedAt: "",
  summary: {
    todayCostCny: 0,
    monthCostCny: 0,
    todayTokens: 0,
    todayAudioMinutes: 0,
    todayTtsChars: 0,
    pricingConfigured: false,
  },
  timeline: [],
  providers: [],
  operations: [],
};

const OPERATION_LABELS: Record<string, string> = {
  chat: "AI 对话",
  summary: "叙事摘要",
  topic_analysis: "主题分析",
  biography: "自传生成",
  asr: "语音识别",
  tts: "语音合成",
};

const PROVIDER_LABELS: Record<string, string> = {
  deepseek: "DeepSeek",
  doubao_ark: "火山方舟",
  doubao_voice: "豆包语音",
  tencent_voice: "腾讯云语音",
  hunyuan: "混元",
};

function formatCny(value = 0) {
  if (value > 0 && value < 1) return `¥${value.toFixed(4)}`;
  return `¥${value.toFixed(2)}`;
}

function formatNumber(value = 0) {
  return new Intl.NumberFormat("zh-CN").format(Math.round(value));
}

function formatMinutes(value = 0) {
  if (value > 0 && value < 1) return `${value.toFixed(2)} 分钟`;
  return `${value.toFixed(1)} 分钟`;
}

function labelProvider(provider = "unknown") {
  return PROVIDER_LABELS[provider] || provider;
}

function labelOperation(operation = "unknown") {
  return OPERATION_LABELS[operation] || operation;
}

function compactDate(date: string) {
  const parts = date.split("-");
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : date;
}

function buildProviderChartData(providers: UsageBreakdown[]) {
  return providers.slice(0, 6).map((item) => ({
    name: labelProvider(item.provider),
    costCny: Number(item.costCny.toFixed(4)),
    calls: item.calls,
  }));
}

function numberOrZero(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeBreakdown(row: Partial<UsageBreakdown> = {}): UsageBreakdown {
  return {
    provider: row.provider,
    operation: row.operation,
    costCny: numberOrZero(row.costCny),
    totalTokens: numberOrZero(row.totalTokens),
    inputTokens: numberOrZero(row.inputTokens),
    outputTokens: numberOrZero(row.outputTokens),
    audioMinutes: numberOrZero(row.audioMinutes),
    ttsChars: numberOrZero(row.ttsChars),
    calls: numberOrZero(row.calls),
    failures: numberOrZero(row.failures),
  };
}

function normalizeAdminUsage(usage: AdminUsage | null): AdminUsage {
  const summary = usage?.summary || EMPTY_USAGE.summary;
  const timeline = Array.isArray(usage?.timeline) ? usage.timeline : EMPTY_USAGE.timeline;
  const providers = Array.isArray(usage?.providers) ? usage.providers : EMPTY_USAGE.providers;
  const operations = Array.isArray(usage?.operations) ? usage.operations : EMPTY_USAGE.operations;

  return {
    range: usage?.range || EMPTY_USAGE.range,
    generatedAt: usage?.generatedAt || EMPTY_USAGE.generatedAt,
    summary: {
      todayCostCny: numberOrZero(summary.todayCostCny),
      monthCostCny: numberOrZero(summary.monthCostCny),
      todayTokens: numberOrZero(summary.todayTokens),
      todayAudioMinutes: numberOrZero(summary.todayAudioMinutes),
      todayTtsChars: numberOrZero(summary.todayTtsChars),
      pricingConfigured: summary.pricingConfigured === true,
    },
    timeline: timeline.map((item) => ({
      date: item.date || "",
      costCny: numberOrZero(item.costCny),
      totalTokens: numberOrZero(item.totalTokens),
      inputTokens: numberOrZero(item.inputTokens),
      outputTokens: numberOrZero(item.outputTokens),
      audioMinutes: numberOrZero(item.audioMinutes),
      ttsChars: numberOrZero(item.ttsChars),
      calls: numberOrZero(item.calls),
      failures: numberOrZero(item.failures),
    })),
    providers: providers.map(normalizeBreakdown),
    operations: operations.map(normalizeBreakdown),
  };
}

function renderBreakdownRows(
  rows: UsageBreakdown[],
  getLabel: (row: UsageBreakdown) => string,
  emptyText: string,
) {
  if (!rows.length) {
    return (
      <tr>
        <td colSpan={5} className="px-5 py-8 text-center text-sm text-stone-400">
          {emptyText}
        </td>
      </tr>
    );
  }

  return rows.map((row) => (
    <tr key={`${row.provider || row.operation || "unknown"}`} className="border-t border-stone-100">
      <td className="px-5 py-3 font-semibold text-stone-800">{getLabel(row)}</td>
      <td className="px-5 py-3 text-stone-600">{formatCny(row.costCny)}</td>
      <td className="px-5 py-3 text-stone-600">{formatNumber(row.totalTokens)}</td>
      <td className="px-5 py-3 text-stone-600">{formatMinutes(row.audioMinutes)}</td>
      <td className="px-5 py-3 text-stone-600">{formatNumber(row.calls)}</td>
    </tr>
  ));
}

export function UsageCostPanel({ usage, loading = false }: UsageCostPanelProps) {
  if (loading) {
    return (
      <section className="rounded-xl border border-stone-100 bg-white p-8 text-sm text-stone-500 shadow-sm">
        正在加载成本数据...
      </section>
    );
  }

  const normalizedUsage = normalizeAdminUsage(usage);
  const timeline = normalizedUsage.timeline.map((item) => ({
    ...item,
    dateLabel: compactDate(item.date),
    costCny: Number(item.costCny.toFixed(4)),
  }));
  const providerChartData = buildProviderChartData(normalizedUsage.providers);
  const cards = [
    {
      label: "今日预估成本",
      value: formatCny(normalizedUsage.summary.todayCostCny),
      hint: "按已配置价格表实时估算",
      icon: Coins,
      color: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "本月预估成本",
      value: formatCny(normalizedUsage.summary.monthCostCny),
      hint: "自然月累计",
      icon: Activity,
      color: "bg-amber-100 text-amber-700",
    },
    {
      label: "今日 Token",
      value: formatNumber(normalizedUsage.summary.todayTokens),
      hint: "输入、缓存、输出合计",
      icon: Cpu,
      color: "bg-sky-100 text-sky-700",
    },
    {
      label: "今日语音分钟",
      value: formatMinutes(normalizedUsage.summary.todayAudioMinutes),
      hint: `TTS 字符 ${formatNumber(normalizedUsage.summary.todayTtsChars)}`,
      icon: Mic2,
      color: "bg-rose-100 text-rose-700",
    },
  ];

  return (
    <section className="space-y-6">
      {!normalizedUsage.summary.pricingConfigured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800">
          价格表未配置，当前展示用量曲线；填入供应商单价后会自动显示预估成本。
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border border-stone-100 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-stone-500">{card.label}</p>
                  <p className="mt-2 text-3xl font-bold text-stone-900">{card.value}</p>
                  <p className="mt-2 text-xs font-medium text-stone-400">{card.hint}</p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${card.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-stone-100 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-stone-900">用量与成本曲线</h2>
            <p className="mt-1 text-sm text-stone-500">按天展示成本、Token 和语音分钟变化。</p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline} margin={{ left: 6, right: 20, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} stroke="#78716c" />
                <YAxis yAxisId="cost" tickLine={false} axisLine={false} stroke="#78716c" />
                <YAxis yAxisId="usage" orientation="right" tickLine={false} axisLine={false} stroke="#78716c" />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === "costCny") return [formatCny(value), "预估成本"];
                    if (name === "totalTokens") return [formatNumber(value), "Token"];
                    return [formatMinutes(value), "语音分钟"];
                  }}
                  labelFormatter={(label) => `日期 ${label}`}
                />
                <Line yAxisId="cost" type="monotone" dataKey="costCny" stroke="#d97706" strokeWidth={3} dot={false} />
                <Line yAxisId="usage" type="monotone" dataKey="totalTokens" stroke="#0284c7" strokeWidth={2} dot={false} />
                <Line yAxisId="usage" type="monotone" dataKey="audioMinutes" stroke="#e11d48" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-stone-100 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-stone-900">供应商成本排行</h2>
            <p className="mt-1 text-sm text-stone-500">按预估成本排序。</p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={providerChartData} margin={{ left: 4, right: 14, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} stroke="#78716c" />
                <YAxis tickLine={false} axisLine={false} stroke="#78716c" />
                <Tooltip formatter={(value: number) => [formatCny(value), "预估成本"]} />
                <Bar dataKey="costCny" fill="#d97706" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-stone-100 bg-white shadow-sm">
          <div className="border-b border-stone-100 bg-stone-50/60 px-5 py-4">
            <h2 className="text-lg font-bold text-stone-900">供应商拆分</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">供应商</th>
                  <th className="px-5 py-3 font-semibold">成本</th>
                  <th className="px-5 py-3 font-semibold">Token</th>
                  <th className="px-5 py-3 font-semibold">语音</th>
                  <th className="px-5 py-3 font-semibold">调用</th>
                </tr>
              </thead>
              <tbody>
                {renderBreakdownRows(normalizedUsage.providers, (row) => labelProvider(row.provider), "暂无供应商用量")}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-stone-100 bg-white shadow-sm">
          <div className="border-b border-stone-100 bg-stone-50/60 px-5 py-4">
            <h2 className="text-lg font-bold text-stone-900">功能拆分</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">功能</th>
                  <th className="px-5 py-3 font-semibold">成本</th>
                  <th className="px-5 py-3 font-semibold">Token</th>
                  <th className="px-5 py-3 font-semibold">语音</th>
                  <th className="px-5 py-3 font-semibold">调用</th>
                </tr>
              </thead>
              <tbody>
                {renderBreakdownRows(normalizedUsage.operations, (row) => labelOperation(row.operation), "暂无功能用量")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
