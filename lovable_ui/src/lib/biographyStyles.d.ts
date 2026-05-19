export type BiographyStyleId = "warm_plain" | "documentary" | "literary" | "family_letter";

export type BiographyStyleOption = {
  id: BiographyStyleId;
  label: string;
  description: string;
};

export const DEFAULT_BIOGRAPHY_STYLE_ID: BiographyStyleId;
export const BIOGRAPHY_STYLE_OPTIONS: BiographyStyleOption[];
export function getBiographyStyle(styleId?: string): BiographyStyleOption;
