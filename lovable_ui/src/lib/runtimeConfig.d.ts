export type RuntimeConfig = {
  apiBase: string;
  wsUrl: string;
};

export function getRuntimeConfig(env?: Record<string, string | undefined>): RuntimeConfig;
