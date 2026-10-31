"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Card, LanguageSelector, StatusBadge } from "@/components/ui";
import { DEFAULT_LANGUAGES, LANGUAGES } from "@/lib/constants";
import { getMessages, type ScreenLanguage } from "@/lib/i18n";
import { createSupabaseClient } from "@/lib/supabase-browser";
import { useRoomPresence } from "@/lib/use-room-presence";
import { AudienceCaption, type CaptionTerm } from "@/components/audience-caption";
import { isMissingColumn, logDatabaseError } from "@/lib/error-logging";

type Caption = { id: string; original: string; created_at: string; translations: Record<string, string>; terms: CaptionTerm[]; translation_status: "pending" | "translating" | "completed" | "failed" };

export default function AudiencePage() {
  const { code } = useParams<{ code: string }>();
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("en");
  const [screenLanguage, setScreenLanguage] = useState<ScreenLanguage>("en");
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([...DEFAULT_LANGUAGES]);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [fontSize, setFontSize] = useState(22);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasNewCaptions, setHasNewCaptions] = useState(false);
  const shouldFollowRef = useRef(true);
  const captionEndRef = useRef<HTMLDivElement>(null);
  const presence = useRoomPresence(code, language);
  const t = getMessages(screenLanguage);

  useEffect(() => { document.title = t.service; }, [t.service]);

  const appendCaption = useCallback((caption: Caption) => {
    setCaptions((current) => current.some((item) => item.id === caption.id)
      ? current
      : [...current, caption].sort((a, b) => a.created_at.localeCompare(b.created_at)));
  }, []);

  const updateCaption = useCallback((caption: Caption) => {
    setCaptions((current) => current.map((item) => item.id === caption.id ? { ...item, ...caption } : item));
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("modue-caption-language");
    if (stored && LANGUAGES.some(({ code }) => code === stored)) setLanguage(stored);
    const screenStored = window.localStorage.getItem("modue-screen-language");
    if (screenStored && LANGUAGES.some(({ code }) => code === screenStored)) setScreenLanguage(screenStored as ScreenLanguage);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const distanceToBottom = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      shouldFollowRef.current = distanceToBottom < 140;
      if (shouldFollowRef.current) setHasNewCaptions(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!captions.length) return;
    if (shouldFollowRef.current) {
      captionEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      setHasNewCaptions(false);
    } else {
      setHasNewCaptions(true);
    }
  }, [captions.length]);

  useEffect(() => {
    let active = true;
    let client: Awaited<ReturnType<typeof createSupabaseClient>> = null;
    let channel: RealtimeChannel | null = null;
    const loadRoom = async () => {
      client = await createSupabaseClient();
      if (!active) return;
      if (!client) {
        setError("잠시 후 다시 시도해 주세요");
        setLoading(false);
        return;
      }
      const supabase = client;
      const { data: room, error: roomError } = await supabase
        .from("rooms").select("title,translation_languages").eq("code", code).maybeSingle();
      if (!active) return;
      let roomTitle: string | null = room?.title ?? null;
      let roomLanguages: string[] = room?.translation_languages ?? [...DEFAULT_LANGUAGES];
      if (roomError && isMissingColumn(roomError, "rooms.translation_languages")) {
        logDatabaseError("audience room language column missing; using defaults", roomError);
        const fallback = await supabase.from("rooms").select("title").eq("code", code).maybeSingle();
        if (fallback.error) logDatabaseError("audience room fallback lookup failed", fallback.error);
        roomTitle = fallback.data?.title ?? null;
        roomLanguages = [...DEFAULT_LANGUAGES];
      } else if (roomError) {
        logDatabaseError("audience room lookup failed", roomError);
      }
      if (!roomTitle) {
        setError(roomError ? "잠시 후 다시 시도해 주세요" : t.roomError);
        setLoading(false);
        return;
      }
      setTitle(roomTitle);
      roomLanguages = roomLanguages.length ? roomLanguages : [...DEFAULT_LANGUAGES];
      setAvailableLanguages(roomLanguages);
      const storedLanguage = window.localStorage.getItem("modue-caption-language");
      const initialLanguage = roomLanguages.includes(storedLanguage ?? "") ? storedLanguage! : roomLanguages[0];
      setLanguage(initialLanguage);
      setScreenLanguage(initialLanguage as ScreenLanguage);
      const { data, error: captionError } = await supabase
        .from("captions").select("id,original,created_at,translations,terms,translation_status").eq("room_code", code).order("created_at");
      if (!active) return;
      if (captionError) {
        logDatabaseError("audience captions lookup failed", captionError);
        setError("잠시 후 다시 시도해 주세요");
      }
      else setCaptions((data ?? []) as unknown as Caption[]);
      setLoading(false);
      channel = supabase
        .channel(`audience-captions-${code}`)
        .on("postgres_changes", {
          event: "INSERT", schema: "public", table: "captions", filter: `room_code=eq.${code}`,
        }, (payload) => appendCaption(payload.new as Caption))
        .on("postgres_changes", {
          event: "UPDATE", schema: "public", table: "captions", filter: `room_code=eq.${code}`,
        }, (payload) => updateCaption(payload.new as Caption))
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" && active) {
            console.error("[audience realtime] caption subscription failed", { roomCode: code });
            setError("잠시 후 다시 시도해 주세요");
          }
        });
    };
    void loadRoom();

    return () => { active = false; if (client && channel) void client.removeChannel(channel); };
  }, [appendCaption, code, updateCaption]);

  function changeLanguage(nextLanguage: string) {
    setLanguage(nextLanguage);
    setScreenLanguage(nextLanguage as ScreenLanguage);
    window.localStorage.setItem("modue-caption-language", nextLanguage);
    window.localStorage.setItem("modue-screen-language", nextLanguage);
  }

  function scrollToLatest() {
    shouldFollowRef.current = true;
    setHasNewCaptions(false);
    captionEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  return (
    <main className="audience-shell">
      <header className="audience-topbar"><Link href="/" className="brand-mark"><span className="brand-icon">이</span><span className="service-name brand-logo-name">{t.service}</span></Link><StatusBadge tone="success">{t.realTimeCaptions}</StatusBadge></header>
      <section className="audience-heading"><span className="eyebrow">{t.audience} · {t.code} {code}</span><h1>{title || t.service}</h1><p>{t.chooseLanguage}</p></section>
      <Card className="language-card"><div><strong>{t.captionLanguage}</strong><small>{t.changeAnytime}</small></div><LanguageSelector value={language} languages={LANGUAGES.filter(({ code }) => availableLanguages.includes(code))} onChange={changeLanguage}/></Card>
      <section className="live-panel"><div className="live-heading"><span className="live-dot"/> {t.realTimeCaptions} <span className="live-heading-rule"/></div>
        <div className="audience-caption-stack">
          {loading ? <div className="empty-caption"><strong>{t.loadingCaptions}</strong></div> : captions.length ? captions.map((caption) => <div key={caption.id}><AudienceCaption original={caption.original} translation={caption.translations?.[language]} terms={caption.terms ?? []} language={language} fontSize={fontSize}/><small className="audience-caption-time">{new Date(caption.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</small></div>) : <div className="empty-caption"><span>◖◗</span><strong>{t.waitingCaptions}</strong><small>{t.waitingCaptionsHint}</small></div>}
          <div ref={captionEndRef}/>
        </div>
        {error && <p role="alert" className="form-error">{error}</p>}
        {hasNewCaptions && <button className="new-captions-button" onClick={scrollToLatest}>{t.newCaptions}</button>}
      </section>
      <footer className="audience-controls"><button className="button button-icon" aria-label={t.reduceFont} disabled={fontSize <= 18} onClick={() => setFontSize((size) => Math.max(18, size - 2))}>가−</button><span>{t.fontSize} · {fontSize}px</span><button className="button button-icon" aria-label={t.increaseFont} disabled={fontSize >= 38} onClick={() => setFontSize((size) => Math.min(38, size + 2))}>가＋</button></footer>
      <span className="sr-only" aria-live="polite">현재 청중 {presence.total}명</span>
    </main>
  );
}
