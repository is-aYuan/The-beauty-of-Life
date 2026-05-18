const DEFAULT_TOPIC_TITLE = '我的孩童时代';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isFirstTimeUser(input) {
  return Number(input.totalConversations || 0) <= 0 && Number(input.chatHistoryLength || 0) <= 0;
}

function buildOnboardingPrompt(input) {
  const userName = normalizeText(input.userName) || '您好';
  const topicTitle = normalizeText(input.currentTopicTitle) || DEFAULT_TOPIC_TITLE;

  return `您好，${userName}！我们可以先从右边选一个主题开始，比如“${topicTitle}”。您只要按住下方话筒，像聊天一样讲，我会帮您整理成回忆录。`;
}

// 模块：入口引导状态机。集中处理新用户和老用户的开场文案，避免各 UI 区域各自判断。
export function buildEntryGuidance(input) {
  const firstTimeUser = isFirstTimeUser(input);
  const storyPrompt = firstTimeUser ? buildOnboardingPrompt(input) : normalizeText(input.subtitle);

  if (input.networkStatus === 'offline' || !input.wsConnected) {
    return {
      firstTimeUser,
      storyPrompt,
      idleStatus: '正在连接...',
    };
  }

  return {
    firstTimeUser,
    storyPrompt,
    idleStatus: firstTimeUser ? '选一个主题，按住话筒开始讲第一段回忆' : '请点击开始讲述',
  };
}
