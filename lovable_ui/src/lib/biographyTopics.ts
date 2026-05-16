export type TopicStatus = "not_started" | "started" | "has_story" | "needs_detail" | "rich";

export type BiographyTopic = {
  id: string;
  title: string;
  progress: number;
  status: TopicStatus;
  summary: string;
  knownFacts: string[];
  concreteStories: string[];
  missingInfo: string[];
  suggestedNextQuestion: string;
  lastDiscussedAt: string | null;
};

export type TopicProfile = {
  userId: string;
  currentTopicId: string;
  personProfile: Record<string, unknown>;
  topics: BiographyTopic[];
  allRichPromptShown: boolean;
};

export const DEFAULT_TOPIC_ID = "childhood";

// 传记主题模块：前端默认展示用，后端持久化数据返回后会覆盖这些初始状态。
export const BIOGRAPHY_TOPICS: Pick<BiographyTopic, "id" | "title">[] = [
  { id: "childhood", title: "我的孩童时代" },
  { id: "parents_home", title: "我的父母和家" },
  { id: "school_days", title: "求学时候的日子" },
  { id: "youth_days", title: "年轻时候的日子" },
  { id: "work_livelihood", title: "工作与生计" },
  { id: "love_marriage", title: "爱情与婚姻" },
  { id: "family_children", title: "家庭与子女" },
  { id: "life_turning_points", title: "人生的转折点" },
  { id: "unforgettable_era", title: "难忘的年代" },
  { id: "words_to_family", title: "留给家人的话" },
];

export function createFallbackTopicProfile(userId: string): TopicProfile {
  return {
    userId,
    currentTopicId: DEFAULT_TOPIC_ID,
    personProfile: {},
    topics: BIOGRAPHY_TOPICS.map((topic) => ({
      ...topic,
      progress: 0,
      status: "not_started",
      summary: "",
      knownFacts: [],
      concreteStories: [],
      missingInfo: [],
      suggestedNextQuestion: "",
      lastDiscussedAt: null,
    })),
    allRichPromptShown: false,
  };
}
