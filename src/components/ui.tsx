"use client";

import { useState } from "react";
import { LANGUAGES } from "@/lib/constants";

export function Button({ children, variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "icon" }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>;
}

export function Card({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`} {...props}>{children}</div>;
}

export function StatusBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "warning" }) {
  return <span className={`status-badge status-${tone}`}><span className="status-dot"/>{children}</span>;
}

export function LanguageSelector({ value, onChange }: { value?: string; onChange?: (lang: string) => void }) {
  const [selected, setSelected] = useState(value || "en");
  return <select aria-label="자막 언어 선택" className="language-select" value={selected} onChange={(event) => { setSelected(event.target.value); onChange?.(event.target.value); }}>{LANGUAGES.map((lang) => <option key={lang.code} value={lang.code}>{lang.name}</option>)}</select>;
}

export function CaptionLine({ original, translation, terms = [] }: { original: string; translation: string; terms?: Array<{ term: string; meaning: string }> }) {
  const [activeTerm, setActiveTerm] = useState<string | null>(null);
  const words = original.split(/(\s+)/);
  return <article className="caption-line"><p className="caption-translation">{translation}</p><p className="caption-original">{words.map((word, index) => {
    const term = terms.find((item) => item.term === word.replace(/[.,!?]/g, ""));
    return term ? <button className="term-trigger" key={`${word}-${index}`} onClick={() => setActiveTerm(activeTerm === term.term ? null : term.term)}>{word}{activeTerm === term.term && <span className="term-popover" role="status">{term.meaning}</span>}</button> : <span key={`${word}-${index}`}>{word}</span>;
  })}</p><div className="caption-meta"><span>지금</span><span className="caption-meta-divider"/><span>한국어 원문</span></div></article>;
}
