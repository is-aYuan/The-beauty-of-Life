import { Send } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";

type TextInputComposerProps = {
  disabled?: boolean;
  placeholder?: string;
  onSend: (text: string) => boolean | void | Promise<boolean | void>;
};

// 模块：文字输入控制。与录音按钮同层，只负责采集文本并交给统一对话管线。
export function TextInputComposer({
  disabled = false,
  placeholder = "打字讲述您的故事",
  onSend,
}: TextInputComposerProps) {
  const [draft, setDraft] = useState("");

  const submit = async () => {
    const text = draft.trim();
    if (!text || disabled) return;
    const sent = await onSend(text);
    if (sent !== false) setDraft("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void submit();
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-2xl items-center gap-3">
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
        placeholder={placeholder}
        className="min-h-[60px] flex-1 resize-none rounded-2xl border border-[#F5D76B] bg-amber-50 px-5 py-4 text-lg font-bold leading-snug text-stone-900 outline-none transition focus:bg-white focus:ring-2 focus:ring-amber-300 disabled:cursor-not-allowed disabled:border-[#D8D0C0] disabled:bg-stone-100 disabled:text-stone-400"
      />
      <button
        type="submit"
        disabled={disabled || !draft.trim()}
        className="flex h-[60px] w-[60px] shrink-0 flex-col items-center justify-center rounded-full bg-[#FFEA92] text-xs font-black text-[#241F1C] shadow-[0_6px_14px_rgba(160,120,30,0.18)] ring-1 ring-[#F5D76B] transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-[#E8E1D3] disabled:text-[#8A8174]"
        aria-label="发送文字"
      >
        <Send className="h-5 w-5" />
        发送
      </button>
    </form>
  );
}
