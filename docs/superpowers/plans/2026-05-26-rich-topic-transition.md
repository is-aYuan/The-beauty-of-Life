# Rich Topic Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the current biography topic reaches 85% or higher, gently ask the elder whether to continue the current topic or switch to the next incomplete topic.

**Architecture:** Keep the decision on the backend because the backend owns topic progress, current topic state, and voice replies. Add a small topic-transition policy module that decides whether to prompt, tracks per-session suppression, and builds a spoken prompt. The frontend receives a structured event and shows two buttons as a convenience, while voice input remains the primary path.

**Tech Stack:** Node.js backend, CloudBase topic profile, WebSocket events, React/TanStack frontend, existing `topic_profiles` data model, Node test runner, Vite build.

---

## File Structure

- Create `lib/topicTransitionPrompt.js`
  - Pure decision logic for rich-topic prompts.
  - Builds the spoken/display text.
  - Parses user intent from short answers like “继续”, “换一个”, or a concrete topic name.
- Modify `server.js`
  - Add session state: `topicTransitionPrompt`, `topicTransitionSuppressTurns`, `richTopicPromptedTopicIds`.
  - Emit a topic-transition prompt after topic analysis updates a topic to `>=85`.
  - Accept frontend button actions through `topic_transition_choice`.
  - Interpret the next voice answer if a topic-transition prompt is pending.
- Modify `lovable_ui/src/hooks/useStoryEngine.ts`
  - Store `pendingTopicTransition`.
  - Handle `topic_transition_prompt` and `topic_transition_resolved` events.
  - Add `respondTopicTransition(choice)` action.
- Modify `lovable_ui/src/routes/index.tsx`
  - Render two small buttons near the recorder when a transition prompt is pending:
    - `继续这个主题`
    - `换个话题`
- Create `lovable_ui/src/lib/topicTransitionPrompt.js`
  - Frontend helper to normalize button labels/state if needed.
- Create `lovable_ui/src/lib/topicTransitionPrompt.d.ts`
  - Type declarations.
- Create `tests/topicTransitionPrompt.test.js`
  - Backend pure policy tests.
- Create `tests/topicTransitionProtocol.test.js`
  - Source-level guardrails for WebSocket event wiring.

---

## Product Rules

1. Trigger only when the current topic progress is `>= 85`.
2. Trigger only after the current AI reply and topic analysis complete; never interrupt user recording.
3. Prompt at most once per topic per WebSocket session.
4. If the user chooses `continue`, suppress further transition prompts for at least 3 answered turns.
5. If the user chooses `switch`, switch to `findNextIncompleteTopicId(topics, currentTopicId)`.
6. If all topics are already rich, ask whether to continue adding details or generate/review the memoir, not to switch.
7. The prompt should sound natural:
   - `“我的父母和家”这个主题已经讲得很丰富了。您想继续讲这个主题，还是换到“年轻时候的日子”？您说“继续”或者“换一个”都可以。`
8. The buttons are optional aids. Voice answers must work without clicking.

---

## Task 1: Backend Pure Topic Transition Policy

**Files:**
- Create: `lib/topicTransitionPrompt.js`
- Test: `tests/topicTransitionPrompt.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildTopicTransitionPrompt,
    parseTopicTransitionChoice,
    shouldPromptTopicTransition,
} = require('../lib/topicTransitionPrompt');

test('prompts when current topic is rich and another topic is incomplete', () => {
    const profile = {
        currentTopicId: 'parents_home',
        topics: [
            { id: 'childhood', title: '我的孩童时代', progress: 90 },
            { id: 'parents_home', title: '我的父母和家', progress: 88 },
            { id: 'youth_days', title: '年轻时候的日子', progress: 0 },
        ],
    };

    const prompt = buildTopicTransitionPrompt({
        topicProfile: profile,
        promptedTopicIds: new Set(),
        suppressTurns: 0,
    });

    assert.equal(prompt.shouldPrompt, true);
    assert.equal(prompt.currentTopicId, 'parents_home');
    assert.equal(prompt.nextTopicId, 'youth_days');
    assert.equal(prompt.currentTopicTitle, '我的父母和家');
    assert.equal(prompt.nextTopicTitle, '年轻时候的日子');
    assert.match(prompt.text, /已经讲得很丰富/);
    assert.match(prompt.text, /继续/);
    assert.match(prompt.text, /换/);
});

test('does not prompt for the same rich topic twice in one session', () => {
    const prompt = shouldPromptTopicTransition({
        currentTopic: { id: 'parents_home', progress: 88 },
        nextTopic: { id: 'youth_days', progress: 0 },
        promptedTopicIds: new Set(['parents_home']),
        suppressTurns: 0,
    });

    assert.equal(prompt, false);
});

test('suppresses prompts after user chooses to continue', () => {
    const prompt = shouldPromptTopicTransition({
        currentTopic: { id: 'parents_home', progress: 88 },
        nextTopic: { id: 'youth_days', progress: 0 },
        promptedTopicIds: new Set(),
        suppressTurns: 2,
    });

    assert.equal(prompt, false);
});

test('parses voice choice to switch topics', () => {
    assert.deepEqual(parseTopicTransitionChoice('换一个吧'), { intent: 'switch', topicId: '' });
});

test('parses voice choice to continue current topic', () => {
    assert.deepEqual(parseTopicTransitionChoice('继续讲这个'), { intent: 'continue', topicId: '' });
});

test('parses concrete topic names', () => {
    const topics = [
        { id: 'work_livelihood', title: '工作与生计' },
        { id: 'youth_days', title: '年轻时候的日子' },
    ];

    assert.deepEqual(parseTopicTransitionChoice('讲工作吧', topics), {
        intent: 'switch',
        topicId: 'work_livelihood',
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/topicTransitionPrompt.test.js`

Expected: FAIL with `Cannot find module '../lib/topicTransitionPrompt'`.

- [ ] **Step 3: Implement the pure module**

```js
const {
    BIOGRAPHY_TOPICS,
    RICH_PROGRESS_THRESHOLD,
    clampProgress,
    findNextIncompleteTopicId,
} = require('./topicProfiles');

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function getTopicTitle(topics, topicId) {
    const topic = (topics || []).find((item) => item.id === topicId) ||
        BIOGRAPHY_TOPICS.find((item) => item.id === topicId);
    return topic?.title || '';
}

function shouldPromptTopicTransition({
    currentTopic,
    nextTopic,
    promptedTopicIds = new Set(),
    suppressTurns = 0,
} = {}) {
    if (!currentTopic) return false;
    if (suppressTurns > 0) return false;
    if (promptedTopicIds.has(currentTopic.id)) return false;
    if (clampProgress(currentTopic.progress) < RICH_PROGRESS_THRESHOLD) return false;
    return Boolean(nextTopic);
}

function buildTopicTransitionPrompt({
    topicProfile,
    promptedTopicIds = new Set(),
    suppressTurns = 0,
} = {}) {
    const topics = topicProfile?.topics || [];
    const currentTopicId = topicProfile?.currentTopicId;
    const currentTopic = topics.find((topic) => topic.id === currentTopicId);
    const nextTopicId = findNextIncompleteTopicId(topics, currentTopicId);
    const nextTopic = nextTopicId ? topics.find((topic) => topic.id === nextTopicId) : null;

    if (!shouldPromptTopicTransition({ currentTopic, nextTopic, promptedTopicIds, suppressTurns })) {
        return { shouldPrompt: false };
    }

    const currentTopicTitle = getTopicTitle(topics, currentTopicId);
    const nextTopicTitle = getTopicTitle(topics, nextTopicId);

    return {
        shouldPrompt: true,
        currentTopicId,
        currentTopicTitle,
        nextTopicId,
        nextTopicTitle,
        text: `“${currentTopicTitle}”这个主题已经讲得很丰富了。您想继续讲这个主题，还是换到“${nextTopicTitle}”？您说“继续”或者“换一个”都可以。`,
    };
}

function parseTopicTransitionChoice(text, topics = []) {
    const value = normalizeText(text);
    if (!value) return { intent: 'unknown', topicId: '' };

    const matchedTopic = topics.find((topic) => value.includes(topic.title.replace(/^我的/, '')) || value.includes(topic.title));
    if (matchedTopic) return { intent: 'switch', topicId: matchedTopic.id };

    if (/换|下一个|别的|其他|另一个/.test(value)) return { intent: 'switch', topicId: '' };
    if (/继续|接着|还想|当前|这个/.test(value)) return { intent: 'continue', topicId: '' };

    return { intent: 'unknown', topicId: '' };
}

module.exports = {
    buildTopicTransitionPrompt,
    parseTopicTransitionChoice,
    shouldPromptTopicTransition,
};
```

- [ ] **Step 4: Run pure tests**

Run: `node --test tests/topicTransitionPrompt.test.js`

Expected: PASS.

---

## Task 2: Backend WebSocket Topic Transition Flow

**Files:**
- Modify: `server.js`
- Test: `tests/topicTransitionProtocol.test.js`

- [ ] **Step 1: Write source-level failing guardrails**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('server wires rich topic transition prompts into websocket flow', () => {
    assert.match(source, /buildTopicTransitionPrompt/);
    assert.match(source, /parseTopicTransitionChoice/);
    assert.match(source, /topic_transition_prompt/);
    assert.match(source, /topic_transition_choice/);
    assert.match(source, /topic_transition_resolved/);
    assert.match(source, /richTopicPromptedTopicIds/);
    assert.match(source, /topicTransitionSuppressTurns/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/topicTransitionProtocol.test.js`

Expected: FAIL because server is not wired yet.

- [ ] **Step 3: Import transition helpers**

In `server.js`:

```js
const {
    buildTopicTransitionPrompt,
    parseTopicTransitionChoice,
} = require('./lib/topicTransitionPrompt');
```

- [ ] **Step 4: Add session state**

Inside the WebSocket session object:

```js
topicTransitionPrompt: null,
topicTransitionSuppressTurns: 0,
richTopicPromptedTopicIds: new Set(),
```

- [ ] **Step 5: Add a helper to emit transition prompts**

```js
async function maybePromptTopicTransition(sessionId, session, topicProfile) {
    const prompt = buildTopicTransitionPrompt({
        topicProfile,
        promptedTopicIds: session.richTopicPromptedTopicIds,
        suppressTurns: session.topicTransitionSuppressTurns,
    });
    if (!prompt.shouldPrompt) return false;

    session.topicTransitionPrompt = prompt;
    session.richTopicPromptedTopicIds.add(prompt.currentTopicId);
    session.conversationHistory.push({ Role: 'assistant', Content: prompt.text });

    sendJson(session.ws, {
        event: 'topic_transition_prompt',
        status: 'ai_speaking',
        text: prompt.text,
        transition: prompt,
    });

    const audioData = await synthesizeSpeech(prompt.text, session.userPreferences);
    if (audioData) session.ws.send(audioData);
    sendJson(session.ws, { event: 'ai_response_end', status: 'ready' });
    return true;
}
```

- [ ] **Step 6: Call transition prompt after topic analysis update**

In `analyzeTopicProgressFromTurn`, after sending `topic_profile_updated`, add:

```js
await maybePromptTopicTransition(sessionId, session, updatedProfile);
```

- [ ] **Step 7: Handle button choice message**

In `handleMessage`, add before `select_topic`:

```js
if (msg.type === 'topic_transition_choice') {
    await handleTopicTransitionChoice(sessionId, session, msg.choice || '', msg.topicId || '');
    return;
}
```

- [ ] **Step 8: Implement topic transition resolution**

```js
async function handleTopicTransitionChoice(sessionId, session, choiceText, explicitTopicId = '') {
    if (!session.userId || !session.topicTransitionPrompt) return;

    const profile = await getOrCreateTopicProfile(session.userId);
    const parsed = explicitTopicId
        ? { intent: 'switch', topicId: explicitTopicId }
        : parseTopicTransitionChoice(choiceText, profile.topics);

    if (parsed.intent === 'continue') {
        session.topicTransitionPrompt = null;
        session.topicTransitionSuppressTurns = 3;
        sendJson(session.ws, {
            event: 'topic_transition_resolved',
            status: 'ready',
            choice: 'continue',
            text: '好的，我们继续讲这个主题。',
        });
        return;
    }

    if (parsed.intent === 'switch') {
        const targetTopicId = parsed.topicId || session.topicTransitionPrompt.nextTopicId;
        const topicProfile = await updateCurrentTopic(session.userId, targetTopicId);
        session.currentTopicId = topicProfile.currentTopicId;
        session.topicTransitionPrompt = null;
        sendJson(session.ws, {
            event: 'topic_transition_resolved',
            status: 'ready',
            choice: 'switch',
            topicProfile,
            text: '好的，我们换个话题继续聊。',
        });
        sendJson(session.ws, {
            event: 'topic_profile_updated',
            status: 'ready',
            topicProfile,
        });
    }
}
```

- [ ] **Step 9: Interpret the next voice answer if transition prompt is pending**

In `processVoiceInteraction`, after `user_transcript` is sent and before saving audio/chatting with AI:

```js
if (session.topicTransitionPrompt) {
    const parsedChoice = parseTopicTransitionChoice(userText, (await getOrCreateTopicProfile(userId)).topics);
    if (parsedChoice.intent !== 'unknown') {
        await handleTopicTransitionChoice(sessionId, session, userText, parsedChoice.topicId);
        return;
    }
}
```

- [ ] **Step 10: Decrement suppress counter on normal answered turns**

After `saveConversation` succeeds:

```js
if (session.topicTransitionSuppressTurns > 0) {
    session.topicTransitionSuppressTurns -= 1;
}
```

- [ ] **Step 11: Run protocol tests**

Run: `node --test tests/topicTransitionPrompt.test.js tests/topicTransitionProtocol.test.js`

Expected: PASS.

---

## Task 3: Frontend Pending Transition State And Buttons

**Files:**
- Modify: `lovable_ui/src/hooks/useStoryEngine.ts`
- Modify: `lovable_ui/src/routes/index.tsx`
- Test: `tests/topicTransitionProtocol.test.js`

- [ ] **Step 1: Extend protocol guardrails**

Add this test to `tests/topicTransitionProtocol.test.js`:

```js
const engineSource = fs.readFileSync(path.join(__dirname, '..', 'lovable_ui', 'src', 'hooks', 'useStoryEngine.ts'), 'utf8');
const routeSource = fs.readFileSync(path.join(__dirname, '..', 'lovable_ui', 'src', 'routes', 'index.tsx'), 'utf8');

test('frontend exposes rich topic transition controls', () => {
    assert.match(engineSource, /pendingTopicTransition/);
    assert.match(engineSource, /topic_transition_prompt/);
    assert.match(engineSource, /respondTopicTransition/);
    assert.match(routeSource, /继续这个主题/);
    assert.match(routeSource, /换个话题/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/topicTransitionProtocol.test.js`

Expected: FAIL because frontend is not wired yet.

- [ ] **Step 3: Add hook state and action**

In `useStoryEngine.ts`:

```ts
export type TopicTransitionPrompt = {
  currentTopicId: string;
  currentTopicTitle: string;
  nextTopicId: string;
  nextTopicTitle: string;
  text: string;
};

const [pendingTopicTransition, setPendingTopicTransition] = useState<TopicTransitionPrompt | null>(null);
```

In `handleJsonMessage`:

```ts
if (msg.event === "topic_transition_prompt" && msg.transition) {
  setPendingTopicTransition(msg.transition);
  setSubtitle(msg.text || msg.transition.text || "");
}
if (msg.event === "topic_transition_resolved") {
  setPendingTopicTransition(null);
  if (msg.topicProfile) setTopicProfile(msg.topicProfile);
}
```

Add action:

```ts
const respondTopicTransition = (choice: "continue" | "switch") => {
  if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;
  wsRef.current.send(
    JSON.stringify({
      type: "topic_transition_choice",
      choice,
      topicId: choice === "switch" ? pendingTopicTransition?.nextTopicId : "",
    }),
  );
  return true;
};
```

Return `pendingTopicTransition` and `respondTopicTransition` from the hook.

- [ ] **Step 4: Render buttons near recorder**

In `index.tsx`, destructure from `useStoryEngine()`:

```ts
pendingTopicTransition,
respondTopicTransition,
```

Render in desktop and mobile story controls, above the recording button:

```tsx
{pendingTopicTransition && (
  <div className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-white/80 p-3">
    <p className="text-base font-semibold text-stone-700">{pendingTopicTransition.text}</p>
    <div className="mt-3 flex justify-center gap-3">
      <button type="button" onClick={() => respondTopicTransition("continue")} className="rounded-lg border border-stone-200 bg-white px-4 py-2 font-bold text-stone-700">
        继续这个主题
      </button>
      <button type="button" onClick={() => respondTopicTransition("switch")} className="rounded-lg bg-amber-400 px-4 py-2 font-bold text-stone-900">
        换个话题
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 5: Run frontend source tests**

Run: `node --test tests/topicTransitionProtocol.test.js`

Expected: PASS.

---

## Task 4: Full Verification

**Files:**
- No additional source edits.

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run backend syntax checks**

Run:

```bash
node --check server.js
node --check lib/topicTransitionPrompt.js
```

Expected: both pass.

- [ ] **Step 3: Run frontend build**

Run from `lovable_ui`:

```bash
npm run build
```

Expected: Vite client and SSR builds pass.

- [ ] **Step 4: Run touched-file lint**

Run from `lovable_ui`:

```bash
npx eslint src/hooks/useStoryEngine.ts src/routes/index.tsx
```

Expected: no new errors. Existing hook warnings in `useStoryEngine.ts` may remain.

- [ ] **Step 5: Manual QA**

1. Log in as a user whose current topic is under 85%.
2. Talk until the backend topic analysis pushes the current topic to 85% or above.
3. Confirm AI asks whether to continue or switch.
4. Click `继续这个主题`.
5. Confirm the app stays on the same topic and does not ask again for at least 3 answered turns.
6. Trigger again with a rich topic and click `换个话题`.
7. Confirm right-side current topic changes to the next incomplete topic.
8. Repeat using voice only:
   - Say `继续讲这个`.
   - Say `换一个`.
   - Say `讲工作`.

---

## Self-Review

- Spec coverage: Covers backend decision, session throttling, voice choice parsing, frontend buttons, topic switching, and full verification.
- Placeholder scan: No placeholders remain.
- Type consistency: Backend event names are `topic_transition_prompt`, `topic_transition_choice`, and `topic_transition_resolved`; frontend uses `pendingTopicTransition` and `respondTopicTransition`.
- Scope check: Focused on rich-topic switching only. It does not change memoir generation, topic scoring, or topic card design.

---

## Execution Options

1. **Inline Execution** - Execute tasks in this session with checkpoints after test groups.
2. **Pause For Review** - You review the plan first, then tell me to execute.
