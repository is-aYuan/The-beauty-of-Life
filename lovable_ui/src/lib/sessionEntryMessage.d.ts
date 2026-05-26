export type SessionEntryGuidance = {
  mode?: "new_user" | "returning_user";
  topicId?: string;
  topicTitle?: string;
  displayText?: string;
  speechText?: string;
  nextQuestion?: string;
  shouldAutoSpeak?: boolean;
};

export type SessionEntryChatMessage = {
  id: number;
  role: "ai";
  text: string;
  source: "entry_guidance";
  entryGuidanceId: string;
};

export function buildSessionEntryMessage(input?: {
  entryGuidance?: SessionEntryGuidance | null;
  now?: () => number;
}): SessionEntryChatMessage | null;

export function upsertSessionEntryMessage<T extends { role: string; text: string }>(
  history?: T[],
  input?: {
    entryGuidance?: SessionEntryGuidance | null;
    now?: () => number;
  },
): Array<T | SessionEntryChatMessage>;
