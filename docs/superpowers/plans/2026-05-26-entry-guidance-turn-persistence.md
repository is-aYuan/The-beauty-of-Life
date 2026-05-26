# Entry Guidance Turn Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a returning user answers the opening guidance question, preserve that opening AI question in the visible chat order and attach it to the saved CloudBase conversation turn as prompt context.

**Architecture:** Treat entry guidance as a pending AI prompt, not as a standalone conversation. The frontend inserts it once into the local chat log for visual continuity; the backend stores it on the session and, after the user successfully answers, saves it as prompt metadata on that turn. Summary, stats, and biography logic continue to use `userText` and `aiReply` as the primary story material.

**Tech Stack:** Node.js WebSocket backend, CloudBase `conversations` collection, React/TanStack frontend, Node test runner, Vite build.

---

## File Structure

- Create `lovable_ui/src/lib/sessionEntryMessage.js`
  - Frontend-only helper that converts `entryGuidance` into one `role: "ai"` chat message and prevents duplicate insertion on reconnect.
- Create `lovable_ui/src/lib/sessionEntryMessage.d.ts`
  - Type declarations for the helper.
- Modify `lovable_ui/src/hooks/useStoryEngine.ts`
  - Add optional chat message metadata fields.
  - Insert the session entry AI message when `ready + user + entryGuidance` arrives.
- Create `lib/entryGuidanceTurn.js`
  - Backend helper that converts a pending `entryGuidance` into CloudBase-safe turn metadata and AI context text.
- Modify `server.js`
  - Store `pendingEntryGuidance` on the live WebSocket session.
  - Add the pending guidance to AI context and saved conversation only after ASR succeeds.
  - Clear the pending guidance after the answered turn is saved.
- Create `tests/sessionEntryMessage.test.js`
  - Tests frontend chat insertion and duplicate prevention.
- Create `tests/entryGuidanceTurn.test.js`
  - Tests backend prompt metadata generation.
- Modify `tests/userTranscriptProtocol.test.js`
  - Add source-level guardrails for the frontend/backend wiring.

---

## Task 1: Frontend Entry Guidance Chat Message Helper

**Files:**
- Create: `lovable_ui/src/lib/sessionEntryMessage.js`
- Create: `lovable_ui/src/lib/sessionEntryMessage.d.ts`
- Test: `tests/sessionEntryMessage.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('inserts returning entry guidance as the first AI chat message', async () => {
    const { upsertSessionEntryMessage } = await import('../lovable_ui/src/lib/sessionEntryMessage.js');

    const history = upsertSessionEntryMessage([], {
        entryGuidance: {
            mode: 'returning_user',
            topicId: 'parents_home',
            topicTitle: '我的父母和家',
            displayText: '上次您讲到妈妈做菜。今天可以接着聊聊：她有什么拿手菜？',
            speechText: '欢迎回来，郑远。上次您讲到妈妈做菜。今天可以接着聊聊：她有什么拿手菜？',
            nextQuestion: '她有什么拿手菜？',
            shouldAutoSpeak: true,
        },
        now: () => 1000,
    });

    assert.deepEqual(history, [{
        id: 1000,
        role: 'ai',
        text: '欢迎回来，郑远。上次您讲到妈妈做菜。今天可以接着聊聊：她有什么拿手菜？',
        source: 'entry_guidance',
        entryGuidanceId: 'parents_home:她有什么拿手菜？',
    }]);
});

test('does not duplicate the entry guidance message after reconnect', async () => {
    const { upsertSessionEntryMessage } = await import('../lovable_ui/src/lib/sessionEntryMessage.js');
    const existing = [{
        id: 1000,
        role: 'ai',
        text: '欢迎回来，郑远。上次您讲到妈妈做菜。',
        source: 'entry_guidance',
        entryGuidanceId: 'parents_home:她有什么拿手菜？',
    }];

    const history = upsertSessionEntryMessage(existing, {
        entryGuidance: {
            mode: 'returning_user',
            topicId: 'parents_home',
            topicTitle: '我的父母和家',
            displayText: '上次您讲到妈妈做菜。今天可以接着聊聊：她有什么拿手菜？',
            speechText: '欢迎回来，郑远。上次您讲到妈妈做菜。今天可以接着聊聊：她有什么拿手菜？',
            nextQuestion: '她有什么拿手菜？',
            shouldAutoSpeak: true,
        },
        now: () => 2000,
    });

    assert.equal(history.length, 1);
    assert.equal(history[0].id, 1000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/sessionEntryMessage.test.js`

Expected: FAIL with `Cannot find module ... sessionEntryMessage.js`.

- [ ] **Step 3: Implement the helper**

```js
function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildEntryGuidanceId(entryGuidance = {}) {
  const topicId = normalizeText(entryGuidance.topicId) || "entry";
  const question = normalizeText(entryGuidance.nextQuestion) || normalizeText(entryGuidance.displayText);
  return `${topicId}:${question}`;
}

export function buildSessionEntryMessage({ entryGuidance, now } = {}) {
  const text = normalizeText(entryGuidance?.speechText) || normalizeText(entryGuidance?.displayText);
  if (!text) return null;

  return {
    id: typeof now === "function" ? now() : Date.now(),
    role: "ai",
    text,
    source: "entry_guidance",
    entryGuidanceId: buildEntryGuidanceId(entryGuidance),
  };
}

// 模块：回访开场聊天气泡。只负责当前会话 UI 顺序，不直接写 CloudBase。
export function upsertSessionEntryMessage(history = [], input = {}) {
  const message = buildSessionEntryMessage(input);
  if (!message) return history;

  const exists = history.some(
    (item) => item.source === "entry_guidance" && item.entryGuidanceId === message.entryGuidanceId,
  );
  if (exists) return history;

  return [message, ...history];
}
```

- [ ] **Step 4: Add type declarations**

```ts
export type SessionEntryGuidance = {
  mode?: "new_user" | "returning_user";
  topicId?: string;
  topicTitle?: string;
  displayText?: string;
  speechText?: string;
  nextQuestion?: string;
  shouldAutoSpeak?: boolean;
};

export type SessionEntryChatMessage = {
  id: number;
  role: "ai";
  text: string;
  source: "entry_guidance";
  entryGuidanceId: string;
};

export function buildSessionEntryMessage(input?: {
  entryGuidance?: SessionEntryGuidance | null;
  now?: () => number;
}): SessionEntryChatMessage | null;

export function upsertSessionEntryMessage<T extends { role: string; text: string }>(
  history?: T[],
  input?: {
    entryGuidance?: SessionEntryGuidance | null;
    now?: () => number;
  },
): Array<T | SessionEntryChatMessage>;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/sessionEntryMessage.test.js`

Expected: PASS.

---

## Task 2: Insert Entry Guidance Into Visible Chat History

**Files:**
- Modify: `lovable_ui/src/hooks/useStoryEngine.ts`
- Test: `tests/userTranscriptProtocol.test.js`

- [ ] **Step 1: Write source-level failing guardrail**

Add this assertion to `story engine sends voice-turn events and applies transcript updates to chat history`:

```js
assert.match(source, /upsertSessionEntryMessage/);
assert.match(source, /source\\?: \"entry_guidance\"/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/userTranscriptProtocol.test.js`

Expected: FAIL because `upsertSessionEntryMessage` is not wired yet.

- [ ] **Step 3: Wire the helper in `useStoryEngine.ts`**

Add import:

```ts
import { upsertSessionEntryMessage } from "../lib/sessionEntryMessage.js";
```

Extend `ChatMessage`:

```ts
export type ChatMessage = {
  id: number;
  role: "ai" | "user";
  text: string;
  status?: VoiceMessageStatus;
  turnId?: string;
  mode?: VoiceMessageMode;
  source?: "entry_guidance";
  entryGuidanceId?: string;
};
```

Inside `if (msg.status === "ready" && msg.user)`, replace the one-line entry guidance setter:

```ts
if (msg.entryGuidance) setServerEntryGuidance(msg.entryGuidance);
```

with:

```ts
if (msg.entryGuidance) {
  setServerEntryGuidance(msg.entryGuidance);
  setChatHistory(
    (prev) =>
      upsertSessionEntryMessage(prev, {
        entryGuidance: msg.entryGuidance,
      }) as ChatMessage[],
  );
}
```

- [ ] **Step 4: Run frontend protocol test**

Run: `node --test tests/userTranscriptProtocol.test.js tests/sessionEntryMessage.test.js`

Expected: PASS.

---

## Task 3: Backend Entry Guidance Turn Metadata

**Files:**
- Create: `lib/entryGuidanceTurn.js`
- Test: `tests/entryGuidanceTurn.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildAnsweredEntryGuidanceTurn,
} = require('../lib/entryGuidanceTurn');

test('builds answered entry guidance metadata for a saved conversation turn', () => {
    const result = buildAnsweredEntryGuidanceTurn({
        mode: 'returning_user',
        topicId: 'parents_home',
        topicTitle: '我的父母和家',
        displayText: '上次您讲到妈妈做菜。今天可以接着聊聊：她有什么拿手菜？',
        speechText: '欢迎回来，郑远。上次您讲到妈妈做菜。今天可以接着聊聊：她有什么拿手菜？',
        nextQuestion: '她有什么拿手菜？',
        shouldAutoSpeak: true,
    });

    assert.deepEqual(result, {
        promptSource: 'entry_guidance',
        aiPromptText: '欢迎回来，郑远。上次您讲到妈妈做菜。今天可以接着聊聊：她有什么拿手菜？',
        aiPromptDisplayText: '上次您讲到妈妈做菜。今天可以接着聊聊：她有什么拿手菜？',
        aiPromptTopicId: 'parents_home',
        aiPromptTopicTitle: '我的父母和家',
        aiPromptNextQuestion: '她有什么拿手菜？',
        excludeAiPromptFromSummary: true,
        excludeAiPromptFromStats: true,
        excludeAiPromptFromBiography: true,
    });
});

test('returns null for empty entry guidance', () => {
    assert.equal(buildAnsweredEntryGuidanceTurn(null), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/entryGuidanceTurn.test.js`

Expected: FAIL with `Cannot find module '../lib/entryGuidanceTurn'`.

- [ ] **Step 3: Implement backend helper**

```js
function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

// 模块：已回答的回访开场元数据。只作为本轮问答上下文保存，不计入回忆录素材。
function buildAnsweredEntryGuidanceTurn(entryGuidance) {
    if (!entryGuidance || typeof entryGuidance !== 'object') return null;

    const aiPromptText = normalizeText(entryGuidance.speechText) ||
        normalizeText(entryGuidance.displayText);
    if (!aiPromptText) return null;

    return {
        promptSource: 'entry_guidance',
        aiPromptText,
        aiPromptDisplayText: normalizeText(entryGuidance.displayText),
        aiPromptTopicId: normalizeText(entryGuidance.topicId),
        aiPromptTopicTitle: normalizeText(entryGuidance.topicTitle),
        aiPromptNextQuestion: normalizeText(entryGuidance.nextQuestion),
        excludeAiPromptFromSummary: true,
        excludeAiPromptFromStats: true,
        excludeAiPromptFromBiography: true,
    };
}

module.exports = {
    buildAnsweredEntryGuidanceTurn,
};
```

- [ ] **Step 4: Run helper test**

Run: `node --test tests/entryGuidanceTurn.test.js`

Expected: PASS.

---

## Task 4: Save Answered Entry Guidance With The First User Answer

**Files:**
- Modify: `server.js`
- Modify: `tests/userTranscriptProtocol.test.js`

- [ ] **Step 1: Write source-level failing guardrails**

Add these assertions to `server exposes a voice-turn protocol and sends user transcript before AI reply`:

```js
assert.match(source, /pendingEntryGuidance/);
assert.match(source, /buildAnsweredEntryGuidanceTurn/);
assert.match(source, /aiPromptText/);
assert.match(source, /promptSource/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/userTranscriptProtocol.test.js`

Expected: FAIL because backend has not stored pending entry guidance yet.

- [ ] **Step 3: Import helper in `server.js`**

```js
const {
    buildAnsweredEntryGuidanceTurn,
} = require('./lib/entryGuidanceTurn');
```

- [ ] **Step 4: Add session state**

In the new WebSocket session object, add:

```js
pendingEntryGuidance: null,
```

- [ ] **Step 5: Set pending entry guidance on login/register**

After `entry.entryGuidance` is built in both login and register success branches, add:

```js
session.pendingEntryGuidance = entry.entryGuidance;
```

- [ ] **Step 6: Attach pending entry guidance to the first answered turn**

In `processVoiceInteraction`, after `userText` is recognized and before `chatWithAI`, add:

```js
const answeredEntryGuidance = buildAnsweredEntryGuidanceTurn(session.pendingEntryGuidance);
```

Change:

```js
const aiReply = await chatWithAI(sessionId, session, userText);
```

to:

```js
const aiReply = await chatWithAI(sessionId, session, userText, { answeredEntryGuidance });
```

Change `saveConversation` payload to include prompt metadata:

```js
await saveConversation(sessionId, userId, {
    ...(answeredEntryGuidance || {}),
    userText,
    aiReply,
    audioFile,
    audioSizeKB: Math.round(audioBuffer.length / 1024),
    topicId: selectedTopic?.id || session.currentTopicId || DEFAULT_TOPIC_ID,
    topicTitle: selectedTopic?.title || '',
    topicProgress: selectedTopic?.progress || 0,
});
```

After `saveConversation` succeeds, clear the pending prompt:

```js
if (answeredEntryGuidance) {
    session.pendingEntryGuidance = null;
}
```

- [ ] **Step 7: Add the opening prompt to AI context for the answered turn**

Change signature:

```js
async function chatWithAI(sessionId, session, userText)
```

to:

```js
async function chatWithAI(sessionId, session, userText, options = {})
```

At the top of `chatWithAI`, before pushing the user message:

```js
if (options.answeredEntryGuidance?.aiPromptText) {
    session.conversationHistory.push({
        Role: 'assistant',
        Content: options.answeredEntryGuidance.aiPromptText,
    });
}
session.conversationHistory.push({ Role: 'user', Content: userText });
```

- [ ] **Step 8: Prevent wrong prompt attachment when another AI prompt starts**

In `startRecommendationQuestion`, after saving/starting the recommendation prompt, add:

```js
session.pendingEntryGuidance = null;
```

This prevents the login opening guidance from being attached if the user ignores it and starts a different recommended question.

- [ ] **Step 9: Run backend protocol tests**

Run: `node --test tests/entryGuidanceTurn.test.js tests/userTranscriptProtocol.test.js`

Expected: PASS.

---

## Task 5: Full Verification

**Files:**
- No additional source edits.

- [ ] **Step 1: Run all Node tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run frontend build**

Run: `npm run build` from `lovable_ui`

Expected: Vite client and SSR builds complete successfully.

- [ ] **Step 3: Run touched-file lint**

Run from `lovable_ui`:

```bash
npx eslint src/hooks/useStoryEngine.ts src/lib/sessionEntryMessage.js src/routes/index.tsx
```

Expected: no errors in touched files.

- [ ] **Step 4: Manual browser QA**

With backend and frontend running:

1. Log in as an existing user with prior conversations.
2. Confirm chat area starts with an AI bubble containing `欢迎回来，用户名...今天可以接着聊聊...`.
3. Answer the opening question by voice.
4. Confirm visible order:
   - AI opening guidance
   - User first answer transcript
   - AI follow-up reply
   - Blue prompt area shows the latest AI follow-up reply
5. Refresh the page.
6. Confirm no duplicate opening guidance appears in the current session after reconnect.

---

## Self-Review

- Spec coverage: The plan covers visible chat order, delayed CloudBase attachment after user answer, AI context continuity, duplicate prevention, and avoiding summary/stat/biography pollution.
- Placeholder scan: No TBD/TODO placeholders remain.
- Type consistency: Frontend uses `source: "entry_guidance"` and `entryGuidanceId`; backend uses `promptSource: "entry_guidance"` and `aiPromptText` metadata.

---

## Execution Options

1. **Subagent-Driven (recommended)** - execute one task at a time with review between tasks.
2. **Inline Execution** - execute tasks in this session with checkpoints after test groups.
