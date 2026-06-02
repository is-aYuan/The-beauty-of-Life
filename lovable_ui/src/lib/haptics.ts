// 模块：触觉反馈。封装 Vibration API，为适老化交互提供物理阻尼感。

/**
 * 触发一次中等强度的物理震动。
 * 仅在设备支持 Vibration API 时生效（iOS Safari 不支持，Android Chrome 支持）。
 */
export function hapticMedium(): void {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(100);
    }
  } catch {
    // 静默失败 — 触觉反馈是增强体验，非阻断性功能
  }
}
