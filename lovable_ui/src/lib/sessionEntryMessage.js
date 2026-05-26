function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildEntryGuidanceId(entryGuidance = {}) {
  const topicId = normalizeText(entryGuidance.topicId) || "entry";
  const question =
    normalizeText(entryGuidance.nextQuestion) || normalizeText(entryGuidance.displayText);
  return `${topicId}:${question}`;
}

export function buildSessionEntryMessage({ entryGuidance, now } = {}) {
  const text =
    normalizeText(entryGuidance?.speechText) || normalizeText(entryGuidance?.displayText);
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
