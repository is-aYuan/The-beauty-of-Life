import { Bot, User } from "lucide-react";
import type { ChatMessage } from "../../hooks/useStoryEngine";

type ChatMessageBubbleProps = {
  message: ChatMessage;
  density: "mobile" | "desktop";
  isLatestAi?: boolean;
};

// 模块：对话消息气泡。统一桌面和移动端的用户/AI消息展示，包含语音转写草稿和失败态。
export function ChatMessageBubble({
  message,
  density,
  isLatestAi = false,
}: ChatMessageBubbleProps) {
  const isMobile = density === "mobile";
  const avatarSize = isMobile ? "h-8 w-8 xs:h-9 xs:w-9" : "h-12 w-12";
  const iconSize = isMobile ? "h-4 w-4 xs:h-5 xs:w-5" : "h-7 w-7";
  const bubbleMaxWidth = isMobile ? "max-w-full" : "max-w-[78%]";
  const bubblePadding = isMobile ? "p-3 xs:p-4" : "p-5";
  const textSize = isMobile ? "text-base xs:text-lg" : "text-2xl";
  const shouldHighlightAi = message.role === "ai" && isLatestAi;

  if (message.role === "ai") {
    if (isMobile) {
      return (
        <div className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2 overflow-x-hidden xs:gap-3">
          <div
            className={`flex ${avatarSize} shrink-0 items-center justify-center rounded-full shadow-sm ${
              shouldHighlightAi ? "bg-blue-100 ring-2 ring-blue-200" : "bg-stone-200"
            }`}
          >
            <Bot
              className={`${iconSize} ${shouldHighlightAi ? "text-blue-700" : "text-stone-700"}`}
            />
          </div>
          <div
            className={`${bubbleMaxWidth} mobile-safe-text min-w-0 justify-self-start rounded-2xl rounded-tl-none ${bubblePadding} shadow-sm transition-colors ${
              shouldHighlightAi
                ? "border border-blue-200 bg-blue-50/80 shadow-blue-100/70"
                : "bg-white"
            }`}
          >
            <p
              className={`${textSize} leading-relaxed ${
                shouldHighlightAi ? "text-blue-950" : "text-stone-800"
              }`}
            >
              {message.text}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-start gap-4">
        <div
          className={`flex ${avatarSize} shrink-0 items-center justify-center rounded-full shadow-sm ${
            shouldHighlightAi ? "bg-blue-100 ring-2 ring-blue-200" : "bg-stone-200"
          }`}
        >
          <Bot
            className={`${iconSize} ${shouldHighlightAi ? "text-blue-700" : "text-stone-700"}`}
          />
        </div>
        <div
          className={`${bubbleMaxWidth} mobile-safe-text min-w-0 rounded-2xl rounded-tl-none ${bubblePadding} shadow-sm transition-colors md:rounded-3xl md:shadow-md ${
            shouldHighlightAi
              ? "border border-blue-200 bg-blue-50/80 shadow-blue-100/70"
              : "bg-white"
          }`}
        >
          <p
            className={`${textSize} leading-relaxed ${
              shouldHighlightAi ? "text-blue-950" : "text-stone-800"
            }`}
          >
            {message.text}
          </p>
        </div>
      </div>
    );
  }

  const isDraft = message.status === "draft";
  const isError = message.status === "error";

  if (isMobile) {
    return (
      <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2 overflow-x-hidden xs:gap-3">
        <div
          className={`${bubbleMaxWidth} mobile-safe-text min-w-0 justify-self-end rounded-2xl rounded-tr-none ${bubblePadding} shadow-sm ${
            isError
              ? "border border-red-100 bg-red-50"
              : isDraft
                ? "border border-amber-200 bg-amber-50"
                : "bg-amber-100"
          }`}
        >
          <p
            className={`${textSize} leading-relaxed ${
              isError ? "text-red-700" : isDraft ? "text-stone-500" : "text-stone-800"
            }`}
          >
            {message.text}
          </p>
          {isDraft && (
            <p className="mt-2 text-sm font-bold text-amber-700">听写中，结束后会显示完整文字</p>
          )}
          {isError && <p className="mt-2 text-sm font-bold text-red-600">可以重新说一次</p>}
        </div>
        <div
          className={`flex ${avatarSize} shrink-0 items-center justify-center rounded-full bg-stone-700 shadow-sm`}
        >
          <User className={`${iconSize} text-amber-50`} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-end gap-4">
      <div
        className={`${bubbleMaxWidth} mobile-safe-text min-w-0 rounded-2xl rounded-tr-none ${bubblePadding} shadow-sm md:rounded-3xl md:shadow-md ${
          isError
            ? "border border-red-100 bg-red-50"
            : isDraft
              ? "border border-amber-200 bg-amber-50"
              : "bg-amber-100"
        }`}
      >
        <p
          className={`${textSize} leading-relaxed ${
            isError ? "text-red-700" : isDraft ? "text-stone-500" : "text-stone-800"
          }`}
        >
          {message.text}
        </p>
        {isDraft && (
          <p className="mt-2 text-sm font-bold text-amber-700">听写中，结束后会显示完整文字</p>
        )}
        {isError && <p className="mt-2 text-sm font-bold text-red-600">可以重新说一次</p>}
      </div>
      <div
        className={`flex ${avatarSize} shrink-0 items-center justify-center rounded-full bg-stone-700 shadow-sm`}
      >
        <User className={`${iconSize} text-amber-50`} />
      </div>
    </div>
  );
}
