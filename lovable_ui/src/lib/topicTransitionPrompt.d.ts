import type { TopicTransitionPrompt } from "../hooks/useStoryEngine";

export type TopicTransitionSecondaryAction = "switch" | "review";

export function getTopicTransitionSecondaryAction(
  transition: TopicTransitionPrompt | null | undefined,
): TopicTransitionSecondaryAction;

export function getTopicTransitionSecondaryLabel(
  transition: TopicTransitionPrompt | null | undefined,
): string;
