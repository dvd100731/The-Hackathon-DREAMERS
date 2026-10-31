export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "vi", name: "Tiếng Việt" },
  { code: "zh", name: "中文" },
  { code: "ru", name: "Русский" },
];

export const SCENES = ["school", "safety", "university", "religion", "tourism"] as const;
export type SceneType = typeof SCENES[number];
