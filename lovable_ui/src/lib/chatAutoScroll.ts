import { useLayoutEffect, type RefObject } from "react";

type ChatAutoScrollState = {
  activeTab: string;
  chatHistoryLength: number;
  subtitle: string;
  convoState: string;
};

type UseChatAutoScrollParams = ChatAutoScrollState & {
  scrollContainerRef: RefObject<HTMLElement | null>;
  latestMessageRef: RefObject<HTMLElement | null>;
};

export function shouldAutoScrollToLatest({
  activeTab,
  chatHistoryLength,
  subtitle,
  convoState,
}: ChatAutoScrollState) {
  if (activeTab !== "story") return false;
  return chatHistoryLength > 0 || subtitle.trim() !== "" || convoState === "aiThinking";
}

export function scrollToLatestMessage(latestMessageElement: HTMLElement | null) {
  if (!latestMessageElement) return undefined;

  const frameId = window.requestAnimationFrame(() => {
    latestMessageElement.scrollIntoView({
      block: "end",
      behavior: "smooth",
    });
  });

  return () => window.cancelAnimationFrame(frameId);
}

// 聊天滚动模块：只负责让故事页在新对话状态出现后滚到最新消息，不改变消息、录音或播放逻辑。
export function useChatAutoScroll({
  activeTab,
  chatHistoryLength,
  subtitle,
  convoState,
  scrollContainerRef,
  latestMessageRef,
}: UseChatAutoScrollParams) {
  useLayoutEffect(() => {
    if (
      !scrollContainerRef.current ||
      !shouldAutoScrollToLatest({
        activeTab,
        chatHistoryLength,
        subtitle,
        convoState,
      })
    ) {
      return undefined;
    }

    return scrollToLatestMessage(latestMessageRef.current);
  }, [activeTab, chatHistoryLength, subtitle, convoState, scrollContainerRef, latestMessageRef]);
}
