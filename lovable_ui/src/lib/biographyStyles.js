export const DEFAULT_BIOGRAPHY_STYLE_ID = "warm_plain";

// 回忆录文风模块：前端展示和生成请求共用的文风枚举，后端有同名模块负责 prompt 细节。
export const BIOGRAPHY_STYLE_OPTIONS = [
  {
    id: "warm_plain",
    label: "温暖朴实",
    description: "适合大多数长辈，像家人慢慢讲述",
  },
  {
    id: "documentary",
    label: "纪实传记",
    description: "更正式，时间线更清楚",
  },
  {
    id: "literary",
    label: "文学抒情",
    description: "更有画面感和情绪",
  },
  {
    id: "family_letter",
    label: "家书口吻",
    description: "像写给家人的一封长信",
  },
];

export function getBiographyStyle(styleId = DEFAULT_BIOGRAPHY_STYLE_ID) {
  return (
    BIOGRAPHY_STYLE_OPTIONS.find((style) => style.id === styleId) ||
    BIOGRAPHY_STYLE_OPTIONS.find((style) => style.id === DEFAULT_BIOGRAPHY_STYLE_ID)
  );
}
