export type CurrentAiPromptMessage = {
  role?: string;
  text?: string;
};

export type CurrentAiPromptInput = {
  chatHistory?: CurrentAiPromptMessage[];
  entryPrompt?: string;
  convoState?: string;
};

export type CurrentAiPrompt = {
  text: string;
  shouldShow: boolean;
};

export function getLatestAiMessageText(chatHistory?: CurrentAiPromptMessage[]): string;

export function buildCurrentAiPrompt(input?: CurrentAiPromptInput): CurrentAiPrompt;
