import type { TopicProfile } from "./biographyTopics";

export type TopicStatusMeta = {
  label: string;
  tone: "emerald" | "amber" | "sky" | "stone" | "neutral";
};

export type TopicProgressSummary = {
  averageProgress: number;
  richCount: number;
  notStartedCount: number;
  currentTopicTitle: string;
};

export function buildTopicProgressSummary(profile?: Partial<TopicProfile>): TopicProgressSummary;
export function getTopicStatusMeta(status?: string, progress?: number): TopicStatusMeta;
