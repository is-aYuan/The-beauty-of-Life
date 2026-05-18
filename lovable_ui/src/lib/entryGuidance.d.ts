export type EntryGuidanceInput = {
  userName?: string;
  totalConversations?: number;
  chatHistoryLength?: number;
  currentTopicTitle?: string;
  wsConnected: boolean;
  networkStatus: "online" | "offline";
  subtitle?: string;
};

export type EntryGuidance = {
  firstTimeUser: boolean;
  storyPrompt: string;
  idleStatus: string;
};

export function buildEntryGuidance(input: EntryGuidanceInput): EntryGuidance;
