export const MIC_PERMISSION_STORAGE_KEY: string;

export function markMicrophoneReady(storage?: Storage | null): void;

export function clearMicrophoneReady(storage?: Storage | null): void;

export function isMicrophoneReady(storage?: Storage | null): boolean;

export function requestMicrophonePermission(env?: {
  mediaDevices?: {
    getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  };
}): Promise<boolean>;
