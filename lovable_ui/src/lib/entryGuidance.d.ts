export type EntryGuidanceInput = {
  userName?: string;
  totalConversations?: number;
  chatHistoryLength?: number;
  currentTopicTitle?: string;
  wsConnected: boolean;
  networkStatus: "online" | "offline";
  subtitle?: string;
  serverEntryGuidance?: ServerEntryGuidance | null;
};

export type ServerEntryGuidance = {
  mode: "new_user" | "returning_user";
  topicId: string;
  topicTitle: string;
  displayText: string;
  speechText: string;
  nextQuestion: string;
  shouldAutoSpeak: boolean;
};

export type EntryGuidance = {
  firstTimeUser: boolean;
  storyPrompt: string;
  speechText: string;
  shouldAutoSpeak: boolean;
  topicId: string;
  nextQuestion: string;
};

export function buildEntryGuidance(input: EntryGuidanceInput): EntryGuidance;
