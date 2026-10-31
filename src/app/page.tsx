"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, CountryFlag } from "@/components/ui";
import { createSupabaseClient } from "@/lib/supabase-browser";
import { type SceneType } from "@/lib/constants";
import { getMessages, SCREEN_LANGUAGES, type ScreenLanguage } from "@/lib/i18n";

const scenes: { id: SceneType; label: string; detail: string }[] = [
  { id: "school", label: "학교", detail: "학부모 설명회 · 오리엔테이션" },
  { id: "safety", label: "산업 안전", detail: "현장 안전 교육 · 작업 안내" },
  { id: "university", label: "대학", detail: "유학생 OT · 캠퍼스 안내" },
  { id: "religion", label: "종교", detail: "예배 · 교회 안내" },
  { id: "tourism", label: "관광", detail: "관광 해설 · 문화 체험" },
  { id: "other", label: "기타", detail: "다양한 모임과 설명회" },
];

function makeCode() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export default function Home() {
  const [screenLanguage, setScreenLanguage] = useState<ScreenLanguage>("ko");
  const [scene, setScene] = useState<SceneType>("school");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);
  const router = useRouter();
  const t = getMessages(screenLanguage);

  useEffect(() => {
    const stored = window.localStorage.getItem("modue-screen-language") as ScreenLanguage | null;
    if (stored && SCREEN_LANGUAGES.some(({ code }) => code === stored)) setScreenLanguage(stored);
  }, []);

  useEffect(() => {
    document.title = t.service;
  }, [t.service]);

  function changeScreenLanguage(language: ScreenLanguage) {
    setScreenLanguage(language);
    window.localStorage.setItem("modue-screen-language", language);
  }

  function updateJoinCode(value: string) {
    setJoinCode(value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
    setJoinError("");
  }

  async function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (joinCode.length !== 6 || joining) return;
    const supabase = await createSupabaseClient();
    if (!supabase) {
      setJoinError(t.codeLookupError);
      return;
    }
    setJoining(true);
    setJoinError("");
    const { data, error: lookupError } = await supabase.from("rooms").select("status").eq("code", joinCode).maybeSingle();
    setJoining(false);
    if (lookupError) {
      setJoinError(t.codeLookupError);
      return;
    }
    if (!data) {
      setJoinError(t.invalidCode);
      return;
    }
    router.push(data.status === "ended" ? `/s/${joinCode}` : `/j/${joinCode}`);
  }

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError(t.titleRequired);
      return;
    }
    const supabase = await createSupabaseClient();
    if (!supabase) {
      setError(t.supabaseError);
      return;
    }
    setSaving(true);
    try {
      const code = makeCode();
      const { error: insertError } = await supabase
        .from("rooms")
        .insert({ code, title: cleanTitle, scene, status: "live" });
      if (insertError) throw insertError;
      router.push(`/host/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.createError);
      setSaving(false);
    }
  }

  return (
    <main className="page-shell">
      <header className="topbar"><Link href="/" className="brand-mark"><span className="brand-icon">이</span><span className="service-name brand-logo-name">{t.service}</span></Link><span className="topbar-tag">{t.tagline}</span></header>
      <section className="hero-grid">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot"/> {t.eyebrow}</div><h1 className="home-brand-title" aria-label={t.service} style={{ "--title-chars": Math.max(t.title1.length, t.title2.length, t.title3.length) } as React.CSSProperties}>{t.title1}<br/>{t.title2}<span className="brand-question">{screenLanguage === "ko" ? "?" : ""}</span><br/>{t.title3}</h1><p className="hero-description">{t.description1}<br/>{t.description2}</p><div className="language-pills" aria-label="화면 언어 선택">{SCREEN_LANGUAGES.map((item) => <button type="button" className={`language-pill${screenLanguage === item.code ? " selected" : ""}`} key={item.code} onClick={() => changeScreenLanguage(item.code)} aria-pressed={screenLanguage === item.code}><CountryFlag country={item.country as "US" | "VN" | "CN" | "RU" | "JP" | "KR"}/>{item.name}</button>)}</div></div>
        <div className="setup-column"><Card className="setup-card"><div className="card-kicker">{t.create} <span className="step-number">01</span></div><h2>{t.question}</h2><p className="card-description">{t.cardDescription}</p>
          <form onSubmit={createRoom} className="setup-form"><label className="field-label" htmlFor="title">{t.meetingTitle}</label><input id="title" name="title" required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} className="text-input" placeholder={t.titlePlaceholder}/><div className="label-row"><span className="field-label">{t.sceneQuestion}</span><span className="optional-label">{t.chooseOne}</span></div><div className="scene-options">{scenes.map((item) => <button className={`scene-choice${scene === item.id ? " selected" : ""}`} key={item.id} type="button" onClick={() => setScene(item.id)} aria-pressed={scene === item.id}><span className="choice-indicator"/><span className="choice-text"><strong>{t.scenes[item.id]}</strong><small>{t.details[item.id]}</small></span></button>)}</div>{error && <p role="alert" className="form-error">{error}</p>}<Button type="submit" disabled={saving} className="primary-action">{saving ? t.creating : t.start}<span>→</span></Button></form>
        </Card><Card className="join-card"><div className="join-card-copy"><strong>{t.joinHeading}</strong><small>{t.joinPlaceholder}</small></div><form className="join-form" onSubmit={joinRoom}><input className="text-input join-code-input" aria-label={t.joinPlaceholder} placeholder={t.joinPlaceholder} type="text" inputMode="text" autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={6} value={joinCode} onChange={(event) => updateJoinCode(event.target.value)}/><Button type="submit" variant="outline" disabled={joinCode.length !== 6 || joining}>{joining ? "…" : t.joinButton}</Button></form>{joinError && <p role="alert" className="form-error join-error">{joinError}</p>}</Card></div>
      </section>
      <section className="privacy-note"><span className="privacy-icon">↗</span><div><strong>{t.privacyTitle}</strong><p>{t.privacyText}</p></div><span className="privacy-lock">{t.privacyLabel}</span></section>
      <footer className="home-footer"><span>{t.footer}</span><span>© {t.service}</span></footer>
    </main>
  );
}
