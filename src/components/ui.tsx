"use client";

import { useEffect, useRef, useState } from "react";
import { LANGUAGES } from "@/lib/constants";
import { US, VN, CN, RU, JP, KR } from "country-flag-icons/react/3x2";
import type { ComponentType, SVGProps } from "react";
import type { ScreenLanguage } from "@/lib/i18n";
import { SCREEN_LANGUAGES } from "@/lib/i18n";

const FLAG_COMPONENTS = { US, VN, CN, RU, JP, KR } as const;

export function CountryFlag({ country, className = "" }: { country: keyof typeof FLAG_COMPONENTS; className?: string }) {
  const Flag = FLAG_COMPONENTS[country] as ComponentType<SVGProps<SVGSVGElement>>;
  return <Flag className={`country-flag${country === "JP" ? " country-flag-jp" : ""} ${className}`} aria-hidden="true" />;
}

export function ScreenLanguagePicker({ value, onChange, className = "" }: { value: ScreenLanguage; onChange: (language: ScreenLanguage) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = SCREEN_LANGUAGES.find(({ code }) => code === value) ?? SCREEN_LANGUAGES[0];
  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);
  return <div className={`screen-language-picker ${className}`} ref={rootRef}>
    <button type="button" className="screen-language-button" aria-label="화면 언어" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((isOpen) => !isOpen)}><CountryFlag country={current.country as keyof typeof FLAG_COMPONENTS}/><span>{current.name}</span><span className="language-chevron">⌄</span></button>
    {open && <div className="language-menu screen-language-menu" role="listbox" aria-label="화면 언어 선택">{SCREEN_LANGUAGES.map((item) => <button type="button" role="option" aria-selected={item.code === value} className={`language-menu-option${item.code === value ? " selected" : ""}`} key={item.code} onClick={() => { onChange(item.code); setOpen(false); }}><CountryFlag country={item.country as keyof typeof FLAG_COMPONENTS}/><span>{item.name}</span>{item.code === value && <span className="language-check">✓</span>}</button>)}</div>}
  </div>;
}

export function Button({ children, variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "icon" }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>;
}

export function Card({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`} {...props}>{children}</div>;
}

export function StatusBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "warning" }) {
  return <span className={`status-badge status-${tone}`}><span className="status-dot"/>{children}</span>;
}

export function BrandName({ className = "" }: { className?: string }) {
  return <span className={`service-name ${className}`}>이 회의 통역 되나요<span className="brand-question">?</span></span>;
}

export function LanguageSelector({ value, onChange, languages = LANGUAGES }: { value?: string; onChange?: (lang: string) => void; languages?: readonly (typeof LANGUAGES)[number][] }) {
  const [selected, setSelected] = useState(value || "en");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const currentValue = value ?? selected;
  const current = languages.find(({ code }) => code === currentValue) ?? languages[0];
  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);
  useEffect(() => {
    if (current && currentValue !== current.code) {
      setSelected(current.code);
      onChange?.(current.code);
    }
  }, [current, currentValue, onChange]);
  if (!current) return null;
  return <div className="language-picker" ref={rootRef}>
    <button type="button" className="language-select" aria-label="자막 언어 선택" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((isOpen) => !isOpen)}>
      <CountryFlag country={current.country}/><span>{current.name}</span><span className="language-chevron" aria-hidden="true">⌄</span>
    </button>
    {open && <div className="language-menu" role="listbox" aria-label="자막 언어">
      {languages.map((lang) => <button type="button" role="option" aria-selected={lang.code === currentValue} className={`language-menu-option${lang.code === currentValue ? " selected" : ""}`} key={lang.code} onClick={() => { setSelected(lang.code); onChange?.(lang.code); setOpen(false); }}><CountryFlag country={lang.country}/><span>{lang.name}</span>{lang.code === currentValue && <span className="language-check" aria-hidden="true">✓</span>}</button>)}
    </div>}
  </div>;
}

export function CaptionLine({ original, translation, terms = [] }: { original: string; translation: string; terms?: Array<{ term: string; meaning: string }> }) {
  const [activeTerm, setActiveTerm] = useState<string | null>(null);
  const words = original.split(/(\s+)/);
  return <article className="caption-line"><p className="caption-translation">{translation}</p><p className="caption-original">{words.map((word, index) => {
    const term = terms.find((item) => item.term === word.replace(/[.,!?]/g, ""));
    return term ? <button className="term-trigger" key={`${word}-${index}`} onClick={() => setActiveTerm(activeTerm === term.term ? null : term.term)}>{word}{activeTerm === term.term && <span className="term-popover" role="status">{term.meaning}</span>}</button> : <span key={`${word}-${index}`}>{word}</span>;
  })}</p><div className="caption-meta"><span>지금</span><span className="caption-meta-divider"/><span>한국어 원문</span></div></article>;
}
