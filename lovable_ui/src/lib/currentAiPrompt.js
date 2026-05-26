function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

// 模块：当前 AI 追问选择器。蓝色提示区应跟随最近的 AI 消息，入口引导只作为会话开始前的兜底。
export function getLatestAiMessageText(chatHistory = []) {
  for (let index = chatHistory.length - 1; index >= 0; index -= 1) {
    const message = chatHistory[index];
    if (message?.role === "ai") {
      const text = normalizeText(message.text);
      if (text) return text;
    }
  }

  return "";
}

export function buildCurrentAiPrompt(input = {}) {
  const text = getLatestAiMessageText(input.chatHistory || []) || normalizeText(input.entryPrompt);

  return {
    text,
    shouldShow: Boolean(text) && input.convoState !== "userRecording",
  };
}
