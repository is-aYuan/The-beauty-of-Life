export const MIC_PERMISSION_STORAGE_KEY = "story_mic_permission_ready";

function getDefaultStorage() {
  return typeof localStorage !== "undefined" ? localStorage : null;
}

export function markMicrophoneReady(storage = getDefaultStorage()) {
  storage?.setItem(MIC_PERMISSION_STORAGE_KEY, "true");
}

export function clearMicrophoneReady(storage = getDefaultStorage()) {
  storage?.removeItem(MIC_PERMISSION_STORAGE_KEY);
}

export function isMicrophoneReady(storage = getDefaultStorage()) {
  return storage?.getItem(MIC_PERMISSION_STORAGE_KEY) === "true";
}

// 模块：麦克风授权探测。只申请权限并立即释放测试流，不开始正式录音。
export async function requestMicrophonePermission(env = globalThis.navigator || {}) {
  const mediaDevices = env.mediaDevices;
  if (!mediaDevices?.getUserMedia) {
    throw new Error("当前浏览器不支持麦克风权限");
  }

  const stream = await mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
  markMicrophoneReady();
  return true;
}
