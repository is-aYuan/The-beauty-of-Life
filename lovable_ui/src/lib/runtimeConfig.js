// 模块：前端运行时配置。集中管理 API 和 WebSocket 地址，支持本地开发与线上部署切换。

const DEFAULT_API_BASE = "http://localhost:8000";
const DEFAULT_WS_URL = "ws://localhost:8000/ws/chat";

function trimTrailingSlash(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizeApiBase(value) {
  return trimTrailingSlash(value) || DEFAULT_API_BASE;
}

function deriveWsUrl(apiBase) {
  const normalized = normalizeApiBase(apiBase);
  if (normalized.startsWith("https://")) {
    return `wss://${normalized.slice("https://".length)}/ws/chat`;
  }
  if (normalized.startsWith("http://")) {
    return `ws://${normalized.slice("http://".length)}/ws/chat`;
  }
  return DEFAULT_WS_URL;
}

export function getRuntimeConfig(env = {}) {
  const apiBase = normalizeApiBase(env.VITE_API_BASE);
  const wsUrl = trimTrailingSlash(env.VITE_WS_URL) || deriveWsUrl(apiBase);

  return {
    apiBase,
    wsUrl,
  };
}
