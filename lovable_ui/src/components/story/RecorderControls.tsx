import { Mic, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { TextInputComposer } from "./TextInputComposer";

type RecordMode = "hold" | "table" | "text";
type ConversationState = "idle" | "userRecording" | "aiThinking" | "aiTalking";
type RecorderAction = () => void | boolean | Promise<void | boolean>;

type RecorderControlsProps = {
  recordMode: RecordMode;
  convoState: ConversationState;
  aiThinkingText?: string;
  networkStatus: string;
  frequencyData: Uint8Array | null;
  recorderError: string;
  topicTransitionControls?: ReactNode;
  onRecordModeChange: (mode: RecordMode) => void;
  onStartManualRecord: RecorderAction;
  onStopManualRecord: () => void;
  onStartAutoRecord: RecorderAction;
  onStopAutoRecord: () => void;
  onSendTextMessage: (text: string) => boolean | void | Promise<boolean | void>;
  onStopAll: () => void;
};

function MiniVisualizer({ freqData }: { freqData: Uint8Array | null }) {
  const bars = Array.from({ length: 24 }, (_, i) => {
    if (!freqData) return 12 + (i % 4) * 4;
    const step = Math.floor(Math.min(freqData.length, 1024) / 24);
    let sum = 0;
    for (let j = 0; j < step; j++) {
      sum += freqData[i * step + j] || 0;
    }
    const value = step > 0 ? sum / step : 0;
    return Math.max(12, (value / 255) * 100);
  });

  return (
    <div className="mt-1 flex h-5 items-end justify-center gap-0.5 xs:gap-1">
      {bars.map((height, index) => (
        <span
          key={index}
          className="w-1 rounded-full bg-emerald-400 transition-all duration-75"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

// 模块：录音控制区。只负责“怎么说”的状态控制，始终独立于主题抽屉和模块导航。
export function RecorderControls({
  recordMode,
  convoState,
  aiThinkingText = "正在整理故事...",
  networkStatus,
  frequencyData,
  recorderError,
  topicTransitionControls,
  onRecordModeChange,
  onStartManualRecord,
  onStopManualRecord,
  onStartAutoRecord,
  onStopAutoRecord,
  onSendTextMessage,
  onStopAll,
}: RecorderControlsProps) {
  const offline = networkStatus === "offline";
  const holdPointerActiveRef = useRef(false);
  // 模块：状态提示行。空闲时不展示重复说明，只在录音、思考、播放和异常时占位。
  const showStatusLine =
    convoState !== "idle" || offline || (recordMode !== "text" && !!recorderError);

  useEffect(() => {
    if (!holdPointerActiveRef.current) return;

    const stopHoldRecording = () => {
      if (!holdPointerActiveRef.current) return;
      holdPointerActiveRef.current = false;
      onStopManualRecord();
    };

    window.addEventListener("pointerup", stopHoldRecording);
    window.addEventListener("pointercancel", stopHoldRecording);
    return () => {
      window.removeEventListener("pointerup", stopHoldRecording);
      window.removeEventListener("pointercancel", stopHoldRecording);
    };
  }, [convoState, onStopManualRecord]);

  const startHoldRecording = (event: PointerEvent<HTMLButtonElement>) => {
    if (recordMode !== "hold") return;
    event.preventDefault();
    holdPointerActiveRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    void Promise.resolve(onStartManualRecord()).then((started) => {
      if (!holdPointerActiveRef.current && started !== false) {
        onStopManualRecord();
      }
    });
  };

  const stopHoldRecording = (event: PointerEvent<HTMLElement>) => {
    if (recordMode !== "hold") return;
    event.preventDefault();
    holdPointerActiveRef.current = false;
    onStopManualRecord();
  };

  return (
    <section className="min-w-0 shrink-0 overflow-x-hidden border-t border-amber-200 bg-amber-50 px-3 pb-1.5 pt-1.5 shadow-[0_-8px_18px_rgba(120,72,30,0.08)] xs:px-4 xs:pb-2 xs:pt-2">
      {/* 模块：富主题换题入口。由首页注入，录音控制只负责摆放在主按钮附近。 */}
      {topicTransitionControls}

      <div className="mb-2 grid min-w-0 grid-cols-3 rounded-lg bg-amber-100 p-0.5 xs:rounded-xl xs:p-1">
        {(
          [
            { id: "hold", label: "长按说话" },
            { id: "table", label: "录音上传" },
            { id: "text", label: "打字输入" },
          ] as { id: RecordMode; label: string }[]
        ).map((option) => {
          const active = recordMode === option.id;
          return (
            <button
              key={option.id}
              type="button"
              disabled={convoState !== "idle"}
              onClick={() => onRecordModeChange(option.id)}
              className={`min-h-10 min-w-0 rounded-lg px-1 text-sm font-black transition-colors disabled:opacity-60 xs:min-h-11 xs:text-base ${
                active ? "bg-white text-stone-900 shadow-sm" : "text-stone-600"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {showStatusLine && (
        <div className="mb-2 min-h-8 text-center">
          {recordMode !== "text" && recorderError ? (
            <p className="mobile-safe-text text-xs font-black leading-snug text-red-600 xs:text-sm">
              {recorderError}
            </p>
          ) : offline ? (
            <p className="animate-pulse text-xs font-black text-amber-700 xs:text-sm">
              网络异常，正在重连...
            </p>
          ) : convoState === "userRecording" ? (
            <>
              <p className="text-xs font-black text-emerald-600 xs:text-sm">正在听您说...</p>
              <MiniVisualizer freqData={frequencyData} />
            </>
          ) : convoState === "aiThinking" ? (
            <p className="mobile-safe-text animate-pulse text-xs font-black text-orange-600 xs:text-sm">
              {aiThinkingText}
            </p>
          ) : convoState === "aiTalking" ? (
            <p className="text-xs font-black text-blue-600 xs:text-sm">AI 正在朗读回应...</p>
          ) : null}
        </div>
      )}

      {convoState === "idle" && recordMode === "text" && (
        <TextInputComposer
          disabled={offline}
          onSend={onSendTextMessage}
          placeholder="打字讲述您的故事"
        />
      )}

      {convoState === "idle" && recordMode !== "text" && (
        <button
          type="button"
          disabled={offline}
          onPointerDown={startHoldRecording}
          onPointerUp={stopHoldRecording}
          onPointerCancel={stopHoldRecording}
          onClick={() => {
            if (recordMode === "table") {
              void onStartAutoRecord();
            }
          }}
          className="flex min-h-[52px] w-full touch-none items-center justify-center gap-2 rounded-2xl border border-[#F5D76B] bg-[#FFEA92] px-4 text-lg font-black text-[#241F1C] shadow-[0_8px_18px_rgba(160,120,30,0.16)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:border-[#D8D0C0] disabled:bg-[#E8E1D3] disabled:text-[#8A8174] xs:min-h-[60px] xs:px-5 xs:text-xl"
        >
          <Mic className="h-6 w-6 xs:h-7 xs:w-7" />
          {recordMode === "hold" ? "按住说话" : "开始录音"}
        </button>
      )}

      {convoState === "userRecording" && recordMode === "table" && (
        <button
          type="button"
          onClick={onStopAutoRecord}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-stone-800 px-4 text-lg font-black text-amber-50 shadow-md active:scale-[0.98] xs:min-h-[60px] xs:px-5 xs:text-xl"
        >
          <Square className="h-6 w-6 xs:h-7 xs:w-7" />
          讲完了
        </button>
      )}

      {convoState === "userRecording" && recordMode === "hold" && (
        <div
          onMouseUp={onStopManualRecord}
          onMouseLeave={onStopManualRecord}
          onPointerUp={stopHoldRecording}
          onPointerCancel={stopHoldRecording}
          className="flex min-h-[52px] w-full touch-none animate-pulse items-center justify-center gap-2 rounded-2xl border border-[#241F1C] bg-[#241F1C] px-4 text-lg font-black text-[#FFF7D6] shadow-[0_0_0_6px_rgba(255,234,146,0.22),0_8px_18px_rgba(36,31,28,0.24)] xs:min-h-[60px] xs:px-5 xs:text-xl"
        >
          <Mic className="h-6 w-6 text-[#FFF7D6] xs:h-7 xs:w-7" />
          松开发送
        </div>
      )}

      {convoState === "aiTalking" && (
        <button
          type="button"
          onClick={onStopAll}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-stone-800 px-4 text-lg font-black text-amber-50 shadow-md active:scale-[0.98] xs:min-h-[60px] xs:px-5 xs:text-xl"
        >
          <Square className="h-6 w-6 xs:h-7 xs:w-7" />
          停止播放
        </button>
      )}

      {convoState === "aiThinking" && (
        <div className="mobile-safe-text flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-[#E9D78F] bg-[#F8E8B2] px-4 text-lg font-black text-[#6B5A2A] shadow-[0_8px_18px_rgba(160,120,30,0.1)] xs:min-h-[60px] xs:px-5 xs:text-xl">
          <Sparkles className="h-6 w-6 animate-spin xs:h-7 xs:w-7" />
          {aiThinkingText}
        </div>
      )}
    </section>
  );
}
