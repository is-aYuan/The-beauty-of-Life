# API Usage Cost Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build phase-one admin cost monitoring that records every local model/voice API call, estimates usage cost, and displays cost/token/audio curves in the existing admin dashboard.

**Architecture:** Add a local usage ledger in CloudBase through a small service module, instrument existing LLM and voice call sites, expose admin-only aggregate endpoints, and render a new admin cost dashboard using the existing React/Recharts stack. This phase uses local runtime data only, so no external billing API keys or provider-side billing integration are required.

**Tech Stack:** Node.js CommonJS backend, CloudBase database, OpenAI-compatible SDK responses, Tencent/ByteDance voice providers, React 19, TanStack Router, Recharts, existing admin auth.

---

## File Structure

- Create `lib/usage/costCatalog.js`
  - Module: provider/model pricing catalog and cost-estimation helpers.
  - Keeps pricing configurable and isolated from business logic.

- Create `lib/usage/usageRecorder.js`
  - Module: CloudBase write/read helpers for `api_usage_events`.
  - Handles event normalization, safe defaults, daily/hourly aggregation, and provider breakdown.

- Create `tests/usageCostCatalog.test.js`
  - Unit tests for token, ASR, and TTS cost calculations.

- Create `tests/usageRecorder.test.js`
  - Unit tests for event normalization and aggregation helpers using in-memory fixtures.

- Modify `lib/ai/providers/doubaoArkProvider.js`
  - Return `{ text, usage, provider, model }` instead of only text.
  - Module annotation already exists; keep provider boundary focused.

- Modify `lib/ai/providers/hunyuanProvider.js`
  - Return `{ text, usage, provider, model }`.
  - Preserve compatibility if Tencent SDK omits usage fields.

- Modify `server.js`
  - Add usage recorder initialization.
  - Record DeepSeek summary/topic/biography calls.
  - Record main chat calls from `aiProvider.completeChat`.
  - Record ASR duration and TTS character/audio output events.
  - Add admin endpoint `GET /api/admin/usage`.

- Modify `lovable_ui/src/routes/admin.tsx`
  - Add a `成本监控` admin view.
  - Fetch `/api/admin/usage`.
  - Render summary cards, cost curve, token curve, voice curve, and provider breakdown.

- Optional later, not phase one: create `lib/usage/providerBillSync.js`
  - For provider-side账单校准. This is explicitly out of scope for phase one.

---

## Data Model

CloudBase collection: `api_usage_events`

```js
{
  userId: "user_xxx" | null,
  sessionId: "session_xxx" | null,
  provider: "deepseek" | "hunyuan" | "doubao_ark" | "tencent_voice" | "doubao_voice",
  model: "deepseek-chat",
  operation: "chat" | "summary" | "topic_analysis" | "biography" | "asr" | "tts",
  inputTokens: 1200,
  outputTokens: 180,
  totalTokens: 1380,
  audioSeconds: 12.4,
  ttsChars: 96,
  outputAudioKB: 63,
  estimatedCostCny: 0.0042,
  status: "success" | "failed",
  latencyMs: 820,
  errorMessage: "",
  createdAt: db.serverDate()
}
```

Admin aggregate response: `GET /api/admin/usage?range=7d`

```js
{
  summary: {
    todayCostCny: 1.23,
    monthCostCny: 18.9,
    todayTokens: 83420,
    todayAudioMinutes: 42
  },
  timeline: [
    {
      label: "05-29 10:00",
      costCny: 0.18,
      tokens: 12000,
      audioMinutes: 4.5,
      ttsChars: 2600
    }
  ],
  providers: [
    {
      provider: "deepseek",
      costCny: 8.2,
      calls: 240,
      tokens: 620000,
      audioMinutes: 0
    }
  ],
  operations: [
    {
      operation: "chat",
      costCny: 5.4,
      calls: 312
    }
  ]
}
```

---

## Pricing Policy

Phase one uses an editable local price catalog. Initial prices should be conservative placeholders until the real current prices are copied from each provider console:

```js
const DEFAULT_PRICE_CATALOG = {
  deepseek: {
    defaultModel: {
      inputPerMillionTokensCny: 0,
      outputPerMillionTokensCny: 0,
    },
  },
  hunyuan: {
    defaultModel: {
      inputPerMillionTokensCny: 0,
      outputPerMillionTokensCny: 0,
    },
  },
  doubao_ark: {
    defaultModel: {
      inputPerMillionTokensCny: 0,
      outputPerMillionTokensCny: 0,
    },
  },
  tencent_voice: {
    asrPerMinuteCny: 0,
    ttsPerTenThousandCharsCny: 0,
  },
  doubao_voice: {
    asrPerMinuteCny: 0,
    ttsPerTenThousandCharsCny: 0,
  },
};
```

Important: implementation must make zero-priced catalog visible in the admin UI as `待配置价格`, so the dashboard can still show usage volume before cost prices are filled.

---

## Tasks

### Task 1: Cost Catalog

**Files:**
- Create: `lib/usage/costCatalog.js`
- Test: `tests/usageCostCatalog.test.js`

- [ ] **Step 1: Write failing tests**

Test cases:
- LLM cost = input tokens * input price + output tokens * output price.
- ASR cost = audio seconds rounded up to minutes * per-minute price.
- TTS cost = character count / 10000 * per-10k-char price.
- Unknown provider/model returns `0` and `pricingConfigured: false`.

- [ ] **Step 2: Implement `estimateUsageCost(event, catalog)`**

Required API:

```js
const { estimateUsageCost, DEFAULT_PRICE_CATALOG } = require('../lib/usage/costCatalog');

estimateUsageCost({
  provider: 'deepseek',
  model: 'deepseek-chat',
  operation: 'chat',
  inputTokens: 1000,
  outputTokens: 500,
});
```

Expected return:

```js
{
  estimatedCostCny: 0,
  pricingConfigured: false
}
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
npm test -- tests/usageCostCatalog.test.js
```

Expected: all cost catalog tests pass.

### Task 2: Usage Recorder

**Files:**
- Create: `lib/usage/usageRecorder.js`
- Test: `tests/usageRecorder.test.js`

- [ ] **Step 1: Write failing tests for normalization**

Assertions:
- missing numeric fields normalize to `0`.
- failed event keeps `status: "failed"` and `errorMessage`.
- LLM token fields and voice fields can coexist but aggregation sums only relevant numeric values.

- [ ] **Step 2: Implement recorder factory**

Required API:

```js
function createUsageRecorder({ db, priceCatalog }) {
  return {
    async recordUsage(event) {},
    async getAdminUsage({ range = '7d', now = new Date() } = {}) {},
  };
}
```

`recordUsage` must never throw into business flow. If CloudBase write fails, it logs `[usage] record failed` and returns `{ recorded: false }`.

- [ ] **Step 3: Implement aggregation helpers**

Aggregation must produce:
- `summary`
- `timeline`
- `providers`
- `operations`

Use local JS aggregation after paginated CloudBase reads. This avoids depending on CloudBase aggregate syntax in phase one.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm test -- tests/usageRecorder.test.js
```

Expected: all usage recorder tests pass.

### Task 3: Instrument LLM Providers

**Files:**
- Modify: `lib/ai/providers/doubaoArkProvider.js`
- Modify: `lib/ai/providers/hunyuanProvider.js`
- Test: `tests/aiProvider.test.js`

- [ ] **Step 1: Update tests**

Existing tests that expect a string response must be updated to expect:

```js
{
  text: 'AI reply',
  usage: {
    inputTokens: 10,
    outputTokens: 5,
    totalTokens: 15
  },
  provider: 'doubao_ark',
  model: 'ep-123'
}
```

- [ ] **Step 2: Update Doubao Ark provider**

Map OpenAI-compatible `result.usage`:

```js
usage: {
  inputTokens: result.usage?.prompt_tokens || 0,
  outputTokens: result.usage?.completion_tokens || 0,
  totalTokens: result.usage?.total_tokens || 0,
}
```

- [ ] **Step 3: Update Hunyuan provider**

Map Tencent usage defensively:

```js
const usage = result.Usage || {};
usage: {
  inputTokens: usage.PromptTokens || usage.InputTokens || 0,
  outputTokens: usage.CompletionTokens || usage.OutputTokens || 0,
  totalTokens: usage.TotalTokens || 0,
}
```

- [ ] **Step 4: Run provider tests**

Run:

```bash
npm test -- tests/aiProvider.test.js
```

Expected: provider tests pass and existing behavior remains compatible after `chatWithAI` unwraps `.text`.

### Task 4: Instrument Backend Call Sites

**Files:**
- Modify: `server.js`
- Test: add assertions to existing source-level tests or create `tests/usageInstrumentation.test.js`

- [ ] **Step 1: Initialize recorder**

Near CloudBase initialization:

```js
const { createUsageRecorder } = require('./lib/usage/usageRecorder');
const usageRecorder = createUsageRecorder({ db });
```

- [ ] **Step 2: Record main chat calls**

In `chatWithAI`, measure latency, call provider, record:

```js
await usageRecorder.recordUsage({
  userId: session.userId,
  sessionId,
  provider: result.provider || aiProvider.name,
  model: result.model,
  operation: 'chat',
  ...result.usage,
  status: 'success',
  latencyMs,
});
```

Then use:

```js
let aiReply = result.text || result || '抱歉，我没有理解，请再说一次。';
```

- [ ] **Step 3: Record DeepSeek calls**

Record these operations:
- `extractNarrativeSummary` as `summary`
- `analyzeTopicProgressFromTurn` as `topic_analysis`
- `generateBiography` as `biography`

Each should extract `response.usage` if present.

- [ ] **Step 4: Record ASR calls**

In `processVoiceInteraction`, after ASR succeeds or fails:

```js
audioSeconds: audioBuffer.length / 32000
operation: 'asr'
provider: `${voiceProvider.name}_voice`
```

Use `status: "failed"` if recognition returns no text.

- [ ] **Step 5: Record TTS calls**

In `synthesizeSpeech`, record:

```js
operation: 'tts',
ttsChars: text.length,
outputAudioKB: audioData ? Math.round(audioData.length / 1024) : 0,
status: audioData ? 'success' : 'failed'
```

Keep `synthesizeSpeech` return behavior unchanged.

- [ ] **Step 6: Add admin endpoint**

Inside authenticated admin routing:

```js
if (url.pathname === '/api/admin/usage' && req.method === 'GET') {
  const range = url.searchParams.get('range') || '7d';
  const usage = await usageRecorder.getAdminUsage({ range });
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(usage));
  return;
}
```

- [ ] **Step 7: Run backend tests**

Run:

```bash
npm test
```

Expected: existing tests pass; new usage tests pass.

### Task 5: Admin Cost Dashboard UI

**Files:**
- Modify: `lovable_ui/src/routes/admin.tsx`
- Optional create: `lovable_ui/src/components/admin/UsageCostPanel.tsx`

- [ ] **Step 1: Add navigation item**

Add:

```ts
{ id: "costs", label: "成本监控", icon: BarChart3 }
```

The current `NAV` is visually static, so implementation should add `activeView` state and switch the main panel by selected nav item.

- [ ] **Step 2: Create typed usage state**

Type:

```ts
type AdminUsage = {
  summary: {
    todayCostCny: number;
    monthCostCny: number;
    todayTokens: number;
    todayAudioMinutes: number;
  };
  timeline: Array<{
    label: string;
    costCny: number;
    tokens: number;
    audioMinutes: number;
    ttsChars: number;
  }>;
  providers: Array<{
    provider: string;
    costCny: number;
    calls: number;
    tokens: number;
    audioMinutes: number;
  }>;
  operations: Array<{
    operation: string;
    costCny: number;
    calls: number;
  }>;
};
```

- [ ] **Step 3: Fetch `/api/admin/usage?range=7d`**

Load when admin opens `成本监控`, and refresh with the existing refresh button.

- [ ] **Step 4: Render dashboard**

Cards:
- 今日预估成本
- 本月预估成本
- 今日 Token
- 今日语音分钟

Charts:
- 成本曲线: `costCny`
- Token 曲线: `tokens`
- 语音曲线: `audioMinutes`

Tables:
- Provider breakdown
- Operation breakdown

If all estimated costs are `0`, display:

```text
价格表未配置，当前展示用量曲线；填入供应商单价后会自动显示预估成本。
```

- [ ] **Step 5: Run frontend build**

Run:

```bash
cd lovable_ui
npm run build
```

Expected: build succeeds.

### Task 6: Verification

**Files:**
- No new implementation files unless tests reveal a defect.

- [ ] **Step 1: Run all backend tests**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run frontend build**

Run:

```bash
cd lovable_ui
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Manual smoke test**

Start backend and frontend, then:
- log in to admin.
- open 成本监控.
- confirm empty state works before any new event.
- perform one text chat.
- perform one voice chat.
- refresh 成本监控.
- confirm chat token event, ASR event, and TTS event appear in summary/curves.

---

## Acceptance Criteria

- Every successful main chat call records one LLM usage event.
- Every DeepSeek summary/topic/biography call records one LLM usage event when response returns.
- Every voice input records ASR seconds.
- Every voice response records TTS character count and output audio size.
- Admin can view today's usage, month usage, 7-day trend, provider breakdown, and operation breakdown.
- Business chat, audio playback, summaries, and biography generation keep their current behavior.
- If usage recording fails, user-facing product flow is not interrupted.
- No external billing API, new database service, or new API key is required in phase one.

---

## External Dependencies

None for phase one.

Before accurate RMB cost display, the only manual input needed is provider pricing values. Without them, the dashboard still shows tokens, minutes, characters, calls, and zero/unknown estimated cost.

---

## Risks

- Some providers may not return token usage in every response. Mitigation: record zero tokens but still record call count, latency, and status.
- CloudBase `get()` pagination limits can hide older events. Mitigation: implement paginated reads in `getAdminUsage`.
- `server.js` is large. Mitigation: keep the first implementation small and isolate reusable logic in `lib/usage/*`.
- Estimated cost can differ from real bill due to cache discounts, rounding, promotions, or provider-specific billing. Mitigation: label it as `预估成本`; phase two can add provider账单校准.

---

## Implementation Order

1. Cost catalog and tests.
2. Usage recorder and tests.
3. Provider response normalization.
4. Backend call-site instrumentation.
5. Admin usage API.
6. Admin UI dashboard.
7. Full verification.

