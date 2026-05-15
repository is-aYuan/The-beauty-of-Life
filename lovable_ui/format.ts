export const formatTime = (isoString?: string) => {
  if (!isoString) return "";
  const d = new Date(isoString);
  return d.toLocaleString("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
};
