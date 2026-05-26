// Module: voice transcript chat messages.
// Owns draft/final/error user bubbles so recording code does not manipulate chat arrays inline.

const HOLD_DRAFT_TEXT = "正在听您说，松开后我会整理成文字。";
const TABLE_DRAFT_TEXT = "正在听您说，点“讲完了”后我会整理成文字。";
const DEFAULT_FAILURE_TEXT = "没有听清，请再说一次。";

function resolveNow(now) {
  return typeof now === "function" ? now() : Date.now();
}

function normalizeMode(mode) {
  return mode === "table" ? "table" : "hold";
}

function buildFinalMessage({ turnId, text, mode, now }) {
  return {
    id: resolveNow(now),
    role: "user",
    text,
    status: "final",
    turnId,
    mode: normalizeMode(mode),
  };
}

export function createVoiceDraftMessage({ turnId, mode, now } = {}) {
  const normalizedMode = normalizeMode(mode);
  return {
    id: resolveNow(now),
    role: "user",
    text: normalizedMode === "table" ? TABLE_DRAFT_TEXT : HOLD_DRAFT_TEXT,
    status: "draft",
    turnId,
    mode: normalizedMode,
  };
}

export function finalizeVoiceTranscript(history, { turnId, text, mode = "hold", now } = {}) {
  const normalizedText = typeof text === "string" ? text.trim() : "";
  if (!normalizedText) return history;

  let replaced = false;
  const next = history.map((message) => {
    if (message.role === "user" && message.turnId === turnId) {
      replaced = true;
      return {
        ...message,
        text: normalizedText,
        status: "final",
        mode: normalizeMode(message.mode || mode),
      };
    }
    return message;
  });

  if (replaced) return next;
  return [
    ...history,
    buildFinalMessage({
      turnId,
      text: normalizedText,
      mode,
      now,
    }),
  ];
}

export function failVoiceTranscript(history, { turnId, message = DEFAULT_FAILURE_TEXT } = {}) {
  let replaced = false;
  const next = history.map((chatMessage) => {
    if (chatMessage.role === "user" && chatMessage.turnId === turnId) {
      replaced = true;
      return {
        ...chatMessage,
        text: message,
        status: "error",
      };
    }
    return chatMessage;
  });

  if (replaced) return next;
  return history;
}
