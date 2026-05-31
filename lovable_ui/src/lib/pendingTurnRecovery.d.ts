export type PendingTurnInputMode = "text" | "voice";

export type PendingTurnRecord = {
  userId: string;
  turnId: string;
  inputMode: PendingTurnInputMode;
  createdAt: number;
};

export const PENDING_TURN_STORAGE_KEY: string;
export const PENDING_TURN_MAX_AGE_MS: number;

export function getPendingTurnStorage(): Storage | null;

export function normalizePendingTurn(
  input?: Partial<PendingTurnRecord> | null,
  now?: number,
): PendingTurnRecord | null;

export function savePendingTurn(
  storage?: Storage | null,
  input?: Partial<PendingTurnRecord> | null,
  now?: number,
): PendingTurnRecord | null;

export function loadPendingTurn(
  storage?: Storage | null,
  userId?: string | null,
  now?: number,
  maxAgeMs?: number,
): PendingTurnRecord | null;

export function clearPendingTurn(storage?: Storage | null): void;
