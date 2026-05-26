export type VoiceMessageMode = "hold" | "table";
export type VoiceMessageStatus = "draft" | "final" | "error";

export type VoiceTranscriptMessage = {
  id: number;
  role: "user";
  text: string;
  status: VoiceMessageStatus;
  turnId?: string;
  mode: VoiceMessageMode;
};

export function createVoiceDraftMessage(input?: {
  turnId?: string;
  mode?: VoiceMessageMode;
  now?: () => number;
}): VoiceTranscriptMessage;

export function finalizeVoiceTranscript<T extends { role: string; text: string }>(
  history: T[],
  input?: {
    turnId?: string;
    text?: string;
    mode?: VoiceMessageMode;
    now?: () => number;
  },
): Array<T | VoiceTranscriptMessage>;

export function failVoiceTranscript<T extends { role: string; text: string }>(
  history: T[],
  input?: {
    turnId?: string;
    message?: string;
  },
): T[];
