function clampProgress(value) {
  const progress = Math.round(Number(value) || 0);
  return Math.max(0, Math.min(100, progress));
}

// 管理员主题进度模块：负责后台展示需要的统计和状态文案，不依赖 React。
export function buildTopicProgressSummary(profile = {}) {
  const topics = Array.isArray(profile.topics) ? profile.topics : [];
  const totalProgress = topics.reduce((sum, topic) => sum + clampProgress(topic?.progress), 0);
  const averageProgress = topics.length ? Math.round(totalProgress / topics.length) : 0;
  const richCount = topics.filter(
    (topic) => clampProgress(topic?.progress) >= 85 || topic?.status === "rich",
  ).length;
  const notStartedCount = topics.filter(
    (topic) => clampProgress(topic?.progress) === 0 || topic?.status === "not_started",
  ).length;
  const currentTopic = topics.find((topic) => topic.id === profile.currentTopicId);

  return {
    averageProgress,
    richCount,
    notStartedCount,
    currentTopicTitle: currentTopic?.title || "未选择主题",
  };
}

export function getTopicStatusMeta(status, progress) {
  const safeProgress = clampProgress(progress);
  if (status === "rich" || safeProgress >= 85) return { label: "素材丰富", tone: "emerald" };
  if (status === "needs_detail") return { label: "需补细节", tone: "amber" };
  if (status === "has_story") return { label: "已有故事", tone: "sky" };
  if (status === "started") return { label: "刚刚开始", tone: "stone" };
  return { label: "未开始", tone: "neutral" };
}
