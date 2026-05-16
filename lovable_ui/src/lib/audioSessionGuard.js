// Module: browser audio session guard.
// Keeps late WebSocket audio chunks from playing after logout or user switches.
export function isAudioPlaybackAllowed(playbackSessionId, activeSessionId) {
  return activeSessionId !== null && playbackSessionId === activeSessionId;
}
