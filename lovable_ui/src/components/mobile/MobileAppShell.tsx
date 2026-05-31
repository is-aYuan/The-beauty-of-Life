import { useCallback, useEffect, useState, type ReactNode } from "react";
import { MobileModuleSwitcher, type MobileModuleTab } from "./MobileModuleSwitcher";
import { MobileTopicDrawer, type MobileTopic } from "./MobileTopicDrawer";
import { RecorderControls } from "../story/RecorderControls";

type RecordMode = "hold" | "table" | "text";
type ConversationState = "idle" | "userRecording" | "aiThinking" | "aiTalking";

type MobileAppShellProps<T extends string> = {
  tabs: MobileModuleTab<T>[];
  activeTab: T;
  storyTabId: T;
  children: ReactNode;
  topicTransitionControls?: ReactNode;
  topics: MobileTopic[];
  currentTopicId?: string | null;
  recordMode: RecordMode;
  convoState: ConversationState;
  aiThinkingText?: string;
  networkStatus: string;
  frequencyData: Uint8Array | null;
  recorderError: string;
  onTabChange: (tab: T) => void;
  onLogout: () => void;
  onTopicSelect: (topicId: string) => void;
  getTopicStatusLabel: (status: string, progress: number) => string;
  onRecordModeChange: (mode: RecordMode) => void;
  onStartManualRecord: () => void;
  onStopManualRecord: () => void;
  onStartAutoRecord: () => void;
  onStopAutoRecord: () => void;
  onSendTextMessage: (text: string) => boolean | void | Promise<boolean | void>;
  onStopAll: () => void;
};

// 模块：手机端页面骨架。负责移动端分层布局，不改变桌面端三栏结构。
export function MobileAppShell<T extends string>({
  tabs,
  activeTab,
  storyTabId,
  children,
  topicTransitionControls,
  topics,
  currentTopicId,
  recordMode,
  convoState,
  aiThinkingText,
  networkStatus,
  frequencyData,
  recorderError,
  onTabChange,
  onLogout,
  onTopicSelect,
  getTopicStatusLabel,
  onRecordModeChange,
  onStartManualRecord,
  onStopManualRecord,
  onStartAutoRecord,
  onStopAutoRecord,
  onSendTextMessage,
  onStopAll,
}: MobileAppShellProps<T>) {
  const [topicExpanded, setTopicExpanded] = useState(false);
  const storyActive = activeTab === storyTabId;
  const interactionBusy = convoState !== "idle";

  useEffect(() => {
    if (interactionBusy) {
      setTopicExpanded(false);
    }
  }, [interactionBusy]);

  useEffect(() => {
    if (!storyActive && topicExpanded) {
      setTopicExpanded(false);
    }
  }, [storyActive, topicExpanded]);

  const handleSelectTab = useCallback(
    (tab: T) => {
      onTabChange(tab);
      setTopicExpanded(false);
    },
    [onTabChange],
  );

  const handleSelectTopic = useCallback(
    (topicId: string) => {
      onTopicSelect(topicId);
    },
    [onTopicSelect],
  );

  return (
    <main className="flex h-dvh w-full flex-col overflow-hidden bg-amber-50 text-stone-900">
      <MobileModuleSwitcher
        tabs={tabs}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onLogout={onLogout}
      />

      <section className="min-h-0 flex-1 overflow-hidden">{children}</section>

      {storyActive && (
        <>
          <MobileTopicDrawer
            topics={topics}
            currentTopicId={currentTopicId}
            expanded={topicExpanded}
            disabled={interactionBusy}
            onToggle={() => setTopicExpanded((current) => !current)}
            onCollapse={() => setTopicExpanded(false)}
            onSelectTopic={handleSelectTopic}
            getStatusLabel={getTopicStatusLabel}
          />
          {!topicExpanded && (
            <div style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
              <RecorderControls
                recordMode={recordMode}
                convoState={convoState}
                aiThinkingText={aiThinkingText}
                networkStatus={networkStatus}
                frequencyData={frequencyData}
                recorderError={recorderError}
                topicTransitionControls={topicTransitionControls}
                onRecordModeChange={onRecordModeChange}
                onStartManualRecord={onStartManualRecord}
                onStopManualRecord={onStopManualRecord}
                onStartAutoRecord={onStartAutoRecord}
                onStopAutoRecord={onStopAutoRecord}
                onSendTextMessage={onSendTextMessage}
                onStopAll={onStopAll}
              />
            </div>
          )}
        </>
      )}
    </main>
  );
}
