"use client";

import { useState } from "react";

export type CaptionTerm = {
  term: string;
  meaning: { ko: string; en: string; vi: string; zh: string; ru: string; ja?: string };
};

function AnnotatedOriginal({ text, terms, language }: { text: string; terms: CaptionTerm[]; language: string }) {
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  const sortedTerms = [...terms].sort((a, b) => b.term.length - a.term.length);
  if (!sortedTerms.length) return <>{text}</>;
  const pattern = new RegExp(`(${sortedTerms.map(({ term }) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return <>{text.split(pattern).map((part, index) => {
    const match = sortedTerms.find(({ term }) => term === part);
    if (!match) return <span key={`${part}-${index}`}>{part}</span>;
    const meaning = match.meaning[language as keyof CaptionTerm["meaning"]] || match.meaning.ko;
    const isOpen = openTerm === `${match.term}-${index}`;
    return <button type="button" className="term-trigger" key={`${part}-${index}`} aria-expanded={isOpen} onClick={() => setOpenTerm(isOpen ? null : `${match.term}-${index}`)}>{part}{isOpen && <span className="term-popover" role="status">{meaning}</span>}</button>;
  })}</>;
}

export function AudienceCaption({ original, translation, terms, language, fontSize }: {
  original: string;
  translation?: string;
  terms: CaptionTerm[];
  language: string;
  fontSize: number;
}) {
  const translated = Boolean(translation?.trim());
  return <article className="audience-caption">
    <p className="audience-caption-primary" style={{ fontSize: `${fontSize}px` }}>{translated ? translation : <AnnotatedOriginal text={original} terms={terms} language={language}/>}</p>
    {translated && <p className="audience-caption-original"><AnnotatedOriginal text={original} terms={terms} language={language}/></p>}
  </article>;
}
