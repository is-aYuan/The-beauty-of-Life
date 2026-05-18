export type BiographyGenerationDecision = {
  canGenerate: boolean;
  requiresConfirmation: boolean;
  reason: "needs_story" | "regenerate" | "ready";
  maxTopicProgress: number;
  message: string;
};

export function getMaxTopicProgress(
  topics?: Array<{ progress?: number | string | null }> | null,
): number;

export function getLatestBiography<T extends { createdAt?: unknown }>(
  biographies?: T[] | null,
): T | null;

export function buildBiographyGenerationDecision(input?: {
  topics?: Array<{ progress?: number | string | null }> | null;
  biographies?: unknown[] | null;
}): BiographyGenerationDecision;
