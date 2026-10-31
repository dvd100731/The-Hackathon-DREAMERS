export const LANGUAGES = [
  { code: "en", name: "English", country: "US" },
  { code: "vi", name: "Tiếng Việt", country: "VN" },
  { code: "zh", name: "中文", country: "CN" },
  { code: "ru", name: "Русский", country: "RU" },
  { code: "ja", name: "日本語", country: "JP" },
] as const;

export const DEFAULT_LANGUAGES = LANGUAGES.map(({ code }) => code);
export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const SCENES = ["school", "safety", "university", "religion", "tourism", "other"] as const;
export type SceneType = typeof SCENES[number];
