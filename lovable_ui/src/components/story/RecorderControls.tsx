import { Mic, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, type PointerEvent } from "react";

type RecordMode = "hold" | "table";
type ConversationState = "idle" | "userRecording" | "aiThinking" | "aiTalking";
type RecorderAction = () => void | boolean | Promise<void | boolean>;

type RecorderControlsProps = {
  recordMode: RecordMode;
  convoState: ConversationState;
  networkStatus: string;
  idleStatus: string;
  frequencyData: Uint8Array | null;
  recorderError: string;
  onRecordModeChange: (mode: RecordMode) => void;
  onStartManualRecord: RecorderAction;
  onStopManualRecord: () => void;
  onStartAutoRecord: RecorderAction;
  onStopAutoRecord: () => void;
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
    <div className="mt-2 flex h-7 items-end justify-center gap-1">
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
  networkStatus,
  idleStatus,
  frequencyData,
  recorderError,
  onRecordModeChange,
  onStartManualRecord,
  onStopManualRecord,
  onStartAutoRecord,
  onStopAutoRecord,
  onStopAll,
}: RecorderControlsProps) {
  const offline = networkStatus === "offline";
  const holdPointerActiveRef = useRef(false);

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
    <section className="shrink-0 border-t border-amber-200 bg-amber-50 px-4 pb-4 pt-3 shadow-[0_-10px_26px_rgba(120,72,30,0.1)]">
      <div className="mb-3 grid grid-cols-2 rounded-2xl bg-amber-100 p-1">
        {(
          [
            { id: "hold", label: "长按说话" },
            { id: "table", label: "放桌上畅聊" },
          ] as { id: RecordMode; label: string }[]
        ).map((option) => {
          const active = recordMode === option.id;
          return (
            <button
              key={option.id}
              type="button"
              disabled={convoState !== "idle"}
              onClick={() => onRecordModeChange(option.id)}
              className={`min-h-11 rounded-xl text-base font-black transition-colors disabled:opacity-60 ${
                active ? "bg-white text-stone-900 shadow-sm" : "text-stone-600"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="mb-3 min-h-10 text-center">
        {recorderError ? (
          <p className="text-base font-black leading-snug text-red-600">{recorderError}</p>
        ) : offline ? (
          <p className="animate-pulse text-base font-black text-amber-700">网络异常，正在重连...</p>
        ) : convoState === "userRecording" ? (
          <>
            <p className="text-base font-black text-emerald-600">正在听您说...</p>
            <MiniVisualizer freqData={frequencyData} />
          </>
        ) : convoState === "aiThinking" ? (
          <p className="animate-pulse text-base font-black text-orange-600">正在整理故事...</p>
        ) : convoState === "aiTalking" ? (
          <p className="text-base font-black text-blue-600">AI 正在朗读回应...</p>
        ) : (
          <p className="line-clamp-2 text-base font-bold leading-snug text-stone-700">
            {idleStatus}
          </p>
        )}
      </div>

      {convoState === "idle" && (
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
          className="flex min-h-[68px] w-full touch-none items-center justify-center gap-3 rounded-2xl bg-red-600 px-5 text-2xl font-black text-white shadow-md transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
        >
          <Mic className="h-8 w-8" />
          {recordMode === "hold" ? "长按说话" : "开始畅聊"}
        </button>
      )}

      {convoState === "userRecording" && recordMode === "table" && (
        <button
          type="button"
          onClick={onStopAutoRecord}
          className="flex min-h-[68px] w-full items-center justify-center gap-3 rounded-2xl bg-stone-800 px-5 text-2xl font-black text-amber-50 shadow-md active:scale-[0.98]"
        >
          <Square className="h-8 w-8" />
          讲完了
        </button>
      )}

      {convoState === "userRecording" && recordMode === "hold" && (
        <div
          onMouseUp={onStopManualRecord}
          onMouseLeave={onStopManualRecord}
          onPointerUp={stopHoldRecording}
          onPointerCancel={stopHoldRecording}
          className="flex min-h-[68px] w-full touch-none animate-pulse items-center justify-center gap-3 rounded-2xl bg-stone-800 px-5 text-2xl font-black text-amber-50 shadow-md"
        >
          <Mic className="h-8 w-8 text-red-400" />
          松开发送
        </div>
      )}

      {convoState === "aiTalking" && (
        <button
          type="button"
          onClick={onStopAll}
          className="flex min-h-[68px] w-full items-center justify-center gap-3 rounded-2xl bg-stone-800 px-5 text-2xl font-black text-amber-50 shadow-md active:scale-[0.98]"
        >
          <Square className="h-8 w-8" />
          停止播放
        </button>
      )}

      {convoState === "aiThinking" && (
        <div className="flex min-h-[68px] w-full items-center justify-center gap-3 rounded-2xl bg-orange-600 px-5 text-2xl font-black text-white opacity-70 shadow-md">
          <Sparkles className="h-8 w-8 animate-spin" />
          思考中...
        </div>
      )}
    </section>
  );
}
