const DEFAULT_TOPIC_TITLE = '我的孩童时代';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isFirstTimeUser(input) {
  return Number(input.totalConversations || 0) <= 0 && Number(input.chatHistoryLength || 0) <= 0;
}

function buildOnboardingPrompt(input) {
  const topicTitle = normalizeText(input.currentTopicTitle) || DEFAULT_TOPIC_TITLE;

  return `我们可以先从“${topicTitle}”开始。您也可以在右边选择其他想聊的主题。选好后，可以长按说话、录音上传，或者打字输入。`;
}

function normalizeServerEntryGuidance(value) {
  if (!value || typeof value !== 'object') return null;

  const displayText = normalizeText(value.displayText);
  if (!displayText) return null;

  const mode = value.mode === 'returning_user' ? 'returning_user' : 'new_user';

  return {
    mode,
    topicId: normalizeText(value.topicId),
    storyPrompt: displayText,
    speechText: normalizeText(value.speechText),
    nextQuestion: normalizeText(value.nextQuestion),
    shouldAutoSpeak: value.shouldAutoSpeak !== false,
  };
}

// 模块：入口引导状态机。统一处理新用户开场、老用户续聊和离线兜底，避免各 UI 区域各自判断。
export function buildEntryGuidance(input) {
  const serverGuidance = normalizeServerEntryGuidance(input.serverEntryGuidance);
  const firstTimeUser = serverGuidance
    ? serverGuidance.mode === 'new_user'
    : isFirstTimeUser(input);
  const storyPrompt = serverGuidance?.storyPrompt ||
    (firstTimeUser ? buildOnboardingPrompt(input) : normalizeText(input.subtitle));

  if (input.networkStatus === 'offline' || !input.wsConnected) {
    return {
      firstTimeUser,
      storyPrompt,
      speechText: serverGuidance?.speechText || '',
      shouldAutoSpeak: Boolean(serverGuidance?.shouldAutoSpeak),
      topicId: serverGuidance?.topicId || '',
      nextQuestion: serverGuidance?.nextQuestion || '',
    };
  }

  return {
    firstTimeUser,
    storyPrompt,
    speechText: serverGuidance?.speechText || '',
    shouldAutoSpeak: Boolean(serverGuidance?.shouldAutoSpeak),
    topicId: serverGuidance?.topicId || '',
    nextQuestion: serverGuidance?.nextQuestion || '',
  };
}
