export const PENDING_TURN_STORAGE_KEY = "story_pending_turn";
export const PENDING_TURN_MAX_AGE_MS = 15 * 60 * 1000;

function normalizeText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeInputMode(value) {
  return value === "voice" ? "voice" : "text";
}

function safeRemove(storage) {
  if (!storage) return;
  try {
    storage.removeItem(PENDING_TURN_STORAGE_KEY);
  } catch (error) {
    console.warn("[pending-turn] clear failed", error);
  }
}

// 模块：当前浏览器标签页未完成 turn 恢复。只保存最小字段，避免正常登录恢复历史 completed 对话。
export function getPendingTurnStorage() {
  if (typeof window === "undefined" || !window.sessionStorage) return null;

  try {
    const storage = window.sessionStorage;
    const testKey = `${PENDING_TURN_STORAGE_KEY}_probe`;
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return storage;
  } catch (error) {
    console.warn("[pending-turn] sessionStorage unavailable", error);
    return null;
  }
}

export function normalizePendingTurn(input = {}, now = Date.now()) {
  const userId = normalizeText(input.userId);
  const turnId = normalizeText(input.turnId);
  if (!userId || !turnId) return null;

  const createdAt = Number.isFinite(Number(input.createdAt))
    ? Number(input.createdAt)
    : now;

  return {
    userId,
    turnId,
    inputMode: normalizeInputMode(input.inputMode),
    createdAt,
  };
}

export function savePendingTurn(storage = getPendingTurnStorage(), input = {}, now = Date.now()) {
  const pendingTurn = normalizePendingTurn(input, now);
  if (!storage || !pendingTurn) return null;

  try {
    storage.setItem(PENDING_TURN_STORAGE_KEY, JSON.stringify(pendingTurn));
    return pendingTurn;
  } catch (error) {
    console.warn("[pending-turn] save failed", error);
    return null;
  }
}

export function loadPendingTurn(
  storage = getPendingTurnStorage(),
  userId,
  now = Date.now(),
  maxAgeMs = PENDING_TURN_MAX_AGE_MS,
) {
  if (!storage) return null;

  let raw = "";
  try {
    raw = storage.getItem(PENDING_TURN_STORAGE_KEY) || "";
  } catch (error) {
    console.warn("[pending-turn] load failed", error);
    return null;
  }

  if (!raw) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    safeRemove(storage);
    return null;
  }

  const pendingTurn = normalizePendingTurn(parsed, now);
  const safeUserId = normalizeText(userId);
  if (!pendingTurn || pendingTurn.userId !== safeUserId) {
    safeRemove(storage);
    return null;
  }

  if (now - pendingTurn.createdAt > maxAgeMs) {
    safeRemove(storage);
    return null;
  }

  return pendingTurn;
}

export function clearPendingTurn(storage = getPendingTurnStorage()) {
  safeRemove(storage);
}
