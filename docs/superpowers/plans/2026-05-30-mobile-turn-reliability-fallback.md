# Mobile Turn Reliability Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移动端用户提交语音或文字后，即使主模型、TTS、数据库保存或 WebSocket 链路出现慢响应，也不要求用户重新发送，系统必须自动兜底并最终给出回复。

**Architecture:** 在后端新增“单轮对话可靠性编排层”，为每次用户输入生成并持久化 `turnId`，先确认收到，再按“主模型 -> 备用模型 -> 本地兜底追问”的顺序完成回复。前端只负责展示状态和恢复结果，不再把 `aiThinking` 当作无限等待状态。

**Tech Stack:** Node.js、WebSocket、CloudBase、现有 Doubao Ark / Hunyuan provider、DeepSeek 可选、Vitest/Node test、React 前端状态机。

---

## 结论

这个问题不能只靠前端加倒计时解决。移动端常见卡住，是因为手机 WebView、网络切换、页面后台、WebSocket 断线更频繁，而当前服务端一轮对话里没有强制超时、没有任务状态持久化、没有模型级兜底、TTS/数据库保存也可能阻塞最终结束事件。

正确方案是：用户消息一旦到达服务端，就进入可恢复的 `turn` 管线。主模型慢了自动换备用模型；备用模型也失败时，本地生成一个安全承接追问；TTS 失败不影响文字回复；移动端重连后能拿回这轮结果。

## 外部协助清单

### 必需确认

1. **备用大模型选择**
   - 推荐：主模型继续使用当前 `LLM_PROVIDER=doubao`，备用模型使用腾讯混元 `hunyuan`。
   - 原因：项目当前统一对话 provider 已经支持 `doubao` 和 `hunyuan`，改动最小，最稳定。

2. **确认生产环境是否已有混元凭证**
   - 如果生产 `.env` 已经有 `TENCENT_SECRET_ID`、`TENCENT_SECRET_KEY`、`HUNYUAN_MODEL`，不需要你新增 API。
   - 如果没有，需要你提供腾讯云混元可用的 `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY`。

3. **确认是否允许新增 CloudBase 集合**
   - 建议新增集合：`turn_tasks`
   - 作用：保存每轮输入的状态、用户文本、AI 回复、使用的 provider、失败原因、是否已保存会话。
   - 如果服务端 CloudBase 管理端 SDK 有自动建集合权限，你不需要手动创建；如果生产库权限较严格，需要你在 CloudBase 控制台创建集合并放通服务端读写。

### 可选确认

1. **是否把 DeepSeek 作为第二或第三兜底**
   - 现在 DeepSeek 已用于摘要、传记、主题分析，但不在主聊天 provider 路由里。
   - 如果你希望“Doubao -> Hunyuan -> DeepSeek”，需要确认 `DEEPSEEK_API_KEY` 在生产环境可用于用户实时对话。
   - 我的建议：第一版先做 `Doubao -> Hunyuan -> 本地兜底`。DeepSeek 后续作为第三层增强。

2. **是否开启生产日志诊断字段**
   - 建议记录 `turnId`、`provider`、`timeoutMs`、`fallbackLevel`、`wsConnected`、`latencyMs`。
   - 不记录用户隐私全文到普通日志，只在 CloudBase turn 任务里保存必要字段。

## 文件结构

### 新增文件

- `lib/turns/turnTaskStore.js`
  - 模块：CloudBase turn 状态读写。负责创建、更新、查询 `turn_tasks`。

- `lib/turns/turnOrchestrator.js`
  - 模块：单轮对话可靠性编排。负责超时、主备模型切换、本地兜底、保存状态。

- `lib/ai/fallbackChat.js`
  - 模块：按 provider 顺序执行聊天请求。封装 `withTimeout`、fallback provider 初始化、usage 记录。

- `lib/ai/localFallbackReply.js`
  - 模块：所有模型失败时生成安全承接追问。不能假装理解，只承认已记下并引导用户继续讲人、事、地点、时间。

- `tests/turnOrchestrator.test.js`
  - 覆盖主模型成功、主模型超时切备用、双模型失败走本地兜底。

- `tests/turnTaskStore.test.js`
  - 覆盖 turn 状态创建、更新、按 `turnId` 幂等查询。

- `tests/mobileTurnRecovery.test.js`
  - 覆盖前端收到 accepted 后断线重连，可以恢复最终 AI 回复。

### 修改文件

- `lib/ai/index.js`
  - 从“只创建当前 provider”升级为“可创建指定 provider”，支持 `doubao` 和 `hunyuan` 同时存在。

- `lib/providerConfig.js`
  - 增加：
    - `CHAT_PRIMARY_PROVIDER`
    - `CHAT_FALLBACK_PROVIDER`
    - `CHAT_PRIMARY_TIMEOUT_MS`
    - `CHAT_FALLBACK_TIMEOUT_MS`
    - `TURN_TOTAL_TIMEOUT_MS`

- `server.js`
  - 修改 `processTypedInteraction`、`processVoiceInteraction`、`processUserTextInteraction` 的调用方式。
  - 让 AI 文本先返回，TTS 和主题分析都不能阻塞最终 ready 状态。
  - 登录或 WebSocket 重连时推送未完成/刚完成的 turn 状态。

- `lovable_ui/src/hooks/useStoryEngine.ts`
  - 增加 `turnId` 生成、`turn_accepted`、`turn_completed`、`turn_failed_with_fallback`、`turn_recovered` 事件处理。
  - 移动端断线重连后主动查询最新 turn 状态。

- `lovable_ui/src/routes/index.tsx`
  - 优化“正在整理”文案，超过一定时间显示“网络有点慢，我正在换个方式接上”，但不要求用户重发。

## 后端状态设计

`turn_tasks` 建议字段：

```js
{
  turnId: "client-generated-id",
  userId: "cloudbase-user-id",
  sessionId: "websocket-session-id",
  inputMode: "text" | "voice",
  userText: "用户已提交文本或 ASR 文本",
  status: "accepted" | "processing" | "completed" | "completed_with_fallback" | "failed_local_fallback",
  aiText: "最终给用户展示的回复",
  provider: "doubao_ark" | "hunyuan" | "local",
  fallbackLevel: 0 | 1 | 2,
  saveStatus: "pending" | "saved" | "save_failed",
  errorMessage: "",
  createdAt: 1717040000000,
  updatedAt: 1717040000000
}
```

状态含义：

- `accepted`：服务端已经收到用户内容，用户不需要重发。
- `processing`：正在调用模型。
- `completed`：主模型成功。
- `completed_with_fallback`：备用模型成功。
- `failed_local_fallback`：所有模型失败，但系统已用本地追问兜底，不让用户卡住。

## 模型兜底策略

第一版推荐：

```txt
主模型：当前配置的 LLM_PROVIDER，生产现在是 doubao
备用模型：hunyuan
最终兜底：本地模板追问
```

超时建议：

```txt
CHAT_PRIMARY_TIMEOUT_MS=15000
CHAT_FALLBACK_TIMEOUT_MS=15000
TURN_TOTAL_TIMEOUT_MS=40000
TTS_TIMEOUT_MS=12000
```

规则：

1. 主模型 15 秒内返回：直接使用主模型回复。
2. 主模型报错或超过 15 秒：记录失败，自动调用备用模型。
3. 备用模型 15 秒内返回：使用备用模型回复，并标记 `completed_with_fallback`。
4. 备用模型也失败：返回本地兜底追问，例如：

```txt
刚才这段我记下了。您可以接着讲讲，当时还有哪些人、地方或者事情让您印象深？
```

5. 不向用户展示“模型失败”“请重新发送”等技术语言。

## TTS 处理策略

语音模式下，当前有一个关键风险：AI 文本生成后，TTS 如果慢或失败，用户仍可能卡住。

改成：

1. AI 文本生成后，立即发送 `ai_speaking` 或 `ai_text_response` 给前端。
2. TTS 独立设置超时。
3. TTS 成功：发送音频。
4. TTS 失败或超时：发送 `ai_response_end`，前端恢复可输入状态。
5. 不能因为 TTS 失败让用户一直看到“正在整理”。

## 前端恢复策略

新增事件：

```js
{ event: "turn_accepted", turnId, status: "accepted" }
{ event: "turn_completed", turnId, text, provider, fallbackLevel }
{ event: "turn_recovered", turnId, text, provider, fallbackLevel }
```

前端规则：

1. 用户点击发送或停止录音后，先显示用户自己的内容。
2. 收到 `turn_accepted` 后，文案显示：

```txt
我在接着整理您的故事...
```

3. 如果超过 12 秒没收到完成事件，文案改成：

```txt
网络有点慢，我正在换个方式接上...
```

4. 如果 WebSocket 重连，前端发：

```js
{ type: "recover_latest_turn", userId }
```

5. 后端返回最新未完成或已完成 turn，前端自动补上 AI 回复。

## 执行任务

### Task 1: 写后端兜底编排测试

**Files:**
- Create: `tests/turnOrchestrator.test.js`

- [ ] 测试主模型成功时不调用备用模型。
- [ ] 测试主模型超时时调用备用模型。
- [ ] 测试主备都失败时返回本地兜底追问。
- [ ] 测试所有路径都返回 `provider` 和 `fallbackLevel`。

### Task 2: 实现模型超时与 fallback provider

**Files:**
- Create: `lib/ai/fallbackChat.js`
- Modify: `lib/ai/index.js`
- Modify: `lib/providerConfig.js`

- [ ] 新增 `withTimeout`。
- [ ] 支持同时创建主 provider 和备用 provider。
- [ ] 主 provider 失败或超时后自动走备用 provider。
- [ ] 记录 usage 成功/失败。

### Task 3: 实现本地最终兜底

**Files:**
- Create: `lib/ai/localFallbackReply.js`
- Test: `tests/turnOrchestrator.test.js`

- [ ] 当所有模型失败时，返回不欺骗用户的承接追问。
- [ ] 文案不要求用户重新发送。
- [ ] 文案不出现“模型失败”“接口失败”等技术词。

### Task 4: 增加 turn 状态持久化

**Files:**
- Create: `lib/turns/turnTaskStore.js`
- Create: `tests/turnTaskStore.test.js`
- Modify: `server.js`

- [ ] 用户消息到达后创建 `turn_tasks`。
- [ ] 模型处理前更新为 `processing`。
- [ ] 成功后写入 `aiText`、`provider`、`fallbackLevel`。
- [ ] 保存对话失败时不阻塞回复，但记录 `save_failed`。
- [ ] 同一个 `turnId` 重复提交时不重复入库。

### Task 5: 改造 server.js 对话主链路

**Files:**
- Modify: `server.js`

- [ ] `processTypedInteraction` 接收并传递 `turnId`。
- [ ] `processVoiceInteraction` 将 ASR 成功后的文本绑定到同一 `turnId`。
- [ ] `processUserTextInteraction` 改为调用 turn orchestrator。
- [ ] AI 文本先返回。
- [ ] TTS 增加超时，TTS 失败也发送 `ai_response_end`。
- [ ] 主题分析继续异步执行，不能阻塞用户回复。

### Task 6: 前端支持 turn 恢复

**Files:**
- Modify: `lovable_ui/src/hooks/useStoryEngine.ts`
- Modify: `lovable_ui/src/routes/index.tsx`

- [ ] 文本输入和语音输入都生成 `turnId`。
- [ ] 处理 `turn_accepted`、`turn_completed`、`turn_recovered`。
- [ ] aiThinking 超过 12 秒时只换文案，不提示重发。
- [ ] WebSocket 重连后自动请求最近 turn 状态。
- [ ] 防止同一 `turnId` 的 AI 回复重复插入聊天记录。

### Task 7: 增加回归测试

**Files:**
- Create: `tests/mobileTurnRecovery.test.js`
- Modify: existing frontend state tests if present

- [ ] 模拟移动端断线后恢复 AI 回复。
- [ ] 模拟主模型超时后备用模型成功。
- [ ] 模拟 TTS 超时但文本回复已展示。
- [ ] 模拟重复 `turnId` 不重复保存。

## 验证方式

后端：

```bash
npm test -- tests/turnOrchestrator.test.js
npm test -- tests/turnTaskStore.test.js
npm test -- tests/mobileTurnRecovery.test.js
```

整体：

```bash
npm test
```

手动验证：

1. 在开发环境把主模型超时设置为 1 秒，确认自动走备用模型。
2. 在移动端微信浏览器发送文字，刷新页面，确认 AI 回复可恢复。
3. 在语音模式下模拟 TTS 失败，确认前端不再卡在“正在整理”。
4. 连续发送相同 `turnId`，确认 CloudBase 不重复写入同一轮会话。

## 交付标准

- 用户不需要重新发送。
- 主模型慢或失败时自动换备用模型。
- 备用模型失败时也有本地兜底追问。
- TTS 失败不阻塞文字回复。
- 移动端断线或刷新后可恢复最近一轮结果。
- 不改变现有长按说话、录音上传、打字输入、主题进度、回忆库、设置页、导出功能。

