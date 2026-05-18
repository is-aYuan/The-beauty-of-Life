export type ArchiveDigestItem = {
  type: "story" | "person" | "place";
  title: string;
  text: string;
  topicId: string;
  topicTitle: string;
  sourceType: string;
  sourceId: string;
};

export type ArchiveRecommendation = {
  type: "continue_recent";
  title: string;
  question: string;
  topicId: string;
  topicTitle: string;
  sourceType: string;
  sourceId: string;
};

export type ArchiveStorySnippet = {
  title: string;
  text: string;
  theme: string;
  sourceType: string;
  sourceId: string;
  topicId: string;
};

export type ArchiveNamedItem = {
  name: string;
  relation?: string;
  context?: string;
};

export type ArchiveRecordPreview = {
  id: string;
  userText: string;
  aiReply: string;
  topicId: string;
  topicTitle: string;
  timestamp: string | null;
};

export type BiographyChapter = {
  number: number;
  title: string;
  content: string;
};

export type BiographyBook = {
  _id?: string;
  title: string;
  tier?: string;
  chapters?: BiographyChapter[];
  fullText?: string;
  wordCount?: number;
  chapterCount?: number;
  status?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type MyArchiveView = {
  todayDigest: {
    items: ArchiveDigestItem[];
  };
  continueRecommendation: ArchiveRecommendation | null;
  storySnippets: ArchiveStorySnippet[];
  peopleAndPlaces: {
    people: ArchiveNamedItem[];
    places: ArchiveNamedItem[];
  };
  rawRecordPreview: {
    total: number;
    latest: ArchiveRecordPreview[];
  };
};
