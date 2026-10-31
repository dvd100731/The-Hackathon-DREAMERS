"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Button, Card, StatusBadge, ScreenLanguagePicker, CountryFlag } from "@/components/ui";
import { createSupabaseClient } from "@/lib/supabase-browser";
import { useRoomPresence } from "@/lib/use-room-presence";
import { DEFAULT_LANGUAGES, LANGUAGES, type LanguageCode } from "@/lib/constants";
import { getMessages, SCREEN_LANGUAGES, type ScreenLanguage } from "@/lib/i18n";
import { isMissingColumn, logDatabaseError, logServerError } from "@/lib/error-logging";

type Caption = { id: string; original: string; created_at: string; translation_status: "pending" | "translating" | "completed" | "failed"; translations?: Record<string, string>; terms?: unknown[] };
type SpeechResult = { isFinal: boolean; [index: number]: { transcript: string } };
type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type SpeechErrorEvent = { error: string };
type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;
declare global {
  interface Window { webkitSpeechRecognition?: SpeechRecognitionConstructor }
}

export default function HostPage() {
  const { code } = useParams<{ code: string }>();
  const [screenLanguage, setScreenLanguage] = useState<ScreenLanguage>("ko");
  const audiencePresence = useRoomPresence(code);
  const [title, setTitle] = useState("");
  const [scene, setScene] = useState("");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([...DEFAULT_LANGUAGES]);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [interim, setInterim] = useState("");
  const [manual, setManual] = useState("");
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const shouldListenRef = useRef(false);
  const t = getMessages(screenLanguage);

  useEffect(() => {
    const stored = window.localStorage.getItem("modue-screen-language") as ScreenLanguage | null;
    if (stored && SCREEN_LANGUAGES.some(({ code: languageCode }) => languageCode === stored)) setScreenLanguage(stored);
  }, []);

  useEffect(() => { document.title = t.service; }, [t.service]);

  function changeScreenLanguage(language: ScreenLanguage) {
    setScreenLanguage(language);
    window.localStorage.setItem("modue-screen-language", language);
  }

  const appendCaption = useCallback((caption: Caption) => {
    setCaptions((current) => current.some((item) => item.id === caption.id)
      ? current
      : [...current, caption].sort((a, b) => a.created_at.localeCompare(b.created_at)));
  }, []);

  const updateCaption = useCallback((caption: Caption) => {
    setCaptions((current) => current.map((item) => item.id === caption.id ? { ...item, ...caption } : item));
  }, []);

  const saveCaption = useCallback(async (text: string) => {
    const original = text.trim();
    if (!original) return false;
    const supabase = await createSupabaseClient();
    if (!supabase) {
      setError(t.supabaseError);
      return false;
    }

    setSaving(true);
    setError("");
    const { data, error: insertError } = await supabase
      .from("captions")
      .insert({ room_code: code, original, translations: {}, terms: [], translation_status: "pending" })
      .select("id,original,created_at,translation_status,translations,terms")
      .single();
    setSaving(false);
    if (insertError) {
      setError(`${t.savingError}: ${insertError.message}`);
      return false;
    }
    appendCaption(data);
    void fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ captionId: data.id, original: data.original, scene, languages: selectedLanguages }),
    }).then(async (response) => {
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        logServerError("host caption translation request failed", new Error(String(result.error ?? response.status)));
        throw new Error("translation failed");
      }
    }).catch(async () => {
      const { error: updateError } = await supabase.from("captions").update({ translation_status: "failed" }).eq("id", data.id);
      if (updateError) logDatabaseError("host caption status update failed", updateError);
      setError(t.translationError);
    });
    return true;
  }, [appendCaption, code, scene, selectedLanguages, t]);

  useEffect(() => {
    let active = true;
    let client: Awaited<ReturnType<typeof createSupabaseClient>> = null;
    let channel: RealtimeChannel | null = null;
    const loadRoom = async () => {
      client = await createSupabaseClient();
      if (!active) return;
      if (!client) {
        setError("Supabase 환경변수를 확인해 주세요.");
        setLoading(false);
        return;
      }
      const supabase = client;
      const { data: room, error: roomError } = await supabase
        .from("rooms").select("title,scene,translation_languages").eq("code", code).maybeSingle();
      if (!active) return;
      let roomTitle: string | null = room?.title ?? null;
      let roomScene: string | null = room?.scene ?? null;
      let roomLanguages: string[] = room?.translation_languages ?? [...DEFAULT_LANGUAGES];
      if (roomError && isMissingColumn(roomError, "rooms.translation_languages")) {
        logDatabaseError("host room language column missing; using defaults", roomError);
        const fallback = await supabase.from("rooms").select("title,scene").eq("code", code).maybeSingle();
        if (fallback.error) logDatabaseError("host room fallback lookup failed", fallback.error);
        roomTitle = fallback.data?.title ?? null;
        roomScene = fallback.data?.scene ?? null;
        roomLanguages = [...DEFAULT_LANGUAGES];
      } else if (roomError) {
        logDatabaseError("host room lookup failed", roomError);
      }
      if (!roomTitle || !roomScene) {
        setError(roomError ? "잠시 후 다시 시도해 주세요" : t.roomError);
        setLoading(false);
        return;
      }
      setTitle(roomTitle);
      setScene(roomScene);
      setSelectedLanguages(roomLanguages.length ? roomLanguages : [...DEFAULT_LANGUAGES]);
      const { data, error: captionError } = await supabase
        .from("captions").select("id,original,created_at,translation_status,translations,terms").eq("room_code", code).order("created_at");
      if (!active) return;
      if (captionError) {
        logDatabaseError("host captions lookup failed", captionError);
        setError("잠시 후 다시 시도해 주세요");
      }
      else setCaptions(data ?? []);
      setLoading(false);
      channel = supabase
        .channel(`host-captions-${code}`)
        .on("postgres_changes", {
          event: "INSERT", schema: "public", table: "captions", filter: `room_code=eq.${code}`,
        }, (payload) => appendCaption(payload.new as Caption))
        .on("postgres_changes", {
          event: "UPDATE", schema: "public", table: "captions", filter: `room_code=eq.${code}`,
        }, (payload) => updateCaption(payload.new as Caption))
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" && active) setError(t.realtimeError);
        });
    };
    void loadRoom();

    return () => {
      active = false;
      shouldListenRef.current = false;
      recognitionRef.current?.abort();
      if (client && channel) void client.removeChannel(channel);
    };
  }, [appendCaption, code, updateCaption, t]);

  useEffect(() => {
    setSpeechSupported(Boolean(window.webkitSpeechRecognition));
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
        setError(t.micHelp);
      return;
    }
    if (shouldListenRef.current) return;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    shouldListenRef.current = true;
    setListening(true);
    setError("");
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const pending: string[] = [];
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        const transcript = result[0].transcript.trim();
        if (result.isFinal && transcript) void saveCaption(transcript);
        else if (transcript) pending.push(transcript);
      }
      setInterim(pending.join(" "));
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        shouldListenRef.current = false;
        setListening(false);
        setError(t.micHelp);
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setError(t.realtimeError);
      }
    };
    recognition.onend = () => {
      setInterim("");
      if (!shouldListenRef.current) {
        setListening(false);
        return;
      }
      window.setTimeout(() => {
        if (!shouldListenRef.current) return;
        try { recognition.start(); } catch { /* restart may already be pending */ }
      }, 300);
    };
    try {
      recognition.start();
    } catch {
      shouldListenRef.current = false;
      setListening(false);
      setError(t.micHelp);
    }
  }, [saveCaption, t]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    setInterim("");
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  async function toggleLanguage(language: LanguageCode) {
    const next = selectedLanguages.includes(language)
      ? selectedLanguages.filter((item) => item !== language)
      : [...selectedLanguages, language];
    if (!next.length) {
      setError(screenLanguage === "en" ? "Select at least one translation language." : screenLanguage === "ja" ? "翻訳言語を1つ以上選択してください。" : screenLanguage === "vi" ? "Vui lòng chọn ít nhất một ngôn ngữ dịch." : screenLanguage === "zh" ? "请至少选择一种翻译语言。" : screenLanguage === "ru" ? "Выберите хотя бы один язык перевода." : "최소 하나의 번역 언어를 선택해 주세요.");
      return;
    }
    setSelectedLanguages(next);
    setError("");
    const supabase = await createSupabaseClient();
    if (!supabase) return;
    const { error: updateError } = await supabase.from("rooms").update({ translation_languages: next }).eq("code", code);
    if (updateError) {
      logDatabaseError("host translation language save failed", updateError);
      setError("언어 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  }

  async function retryTranslation(caption: Caption) {
    const supabase = await createSupabaseClient();
    if (!supabase) {
        setError("잠시 후 다시 시도해 주세요");
      return;
    }
    setError("");
    setCaptions((current) => current.map((item) => item.id === caption.id ? { ...item, translation_status: "translating" } : item));
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captionId: caption.id, original: caption.original, scene, languages: selectedLanguages }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        logServerError("host translation retry failed", new Error(String(result.error ?? response.status)));
        throw new Error("translation failed");
      }
    } catch {
      const { error: updateError } = await supabase.from("captions").update({ translation_status: "failed" }).eq("id", caption.id);
      if (updateError) logDatabaseError("host retry status update failed", updateError);
      setCaptions((current) => current.map((item) => item.id === caption.id ? { ...item, translation_status: "failed" } : item));
      setError(t.translationError);
    }
  }

  function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const original = manual.trim();
    if (!original || saving) return;
    void saveCaption(original).then((saved) => { if (saved) setManual(""); });
  }

  function onManualKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const audienceUrl = typeof window === "undefined" ? "" : `${window.location.origin}/j/${code}`;

  return (
    <main className="app-shell">
      <header className="app-header"><Link href="/" className="brand-mark"><span className="brand-icon">이</span><span className="service-name brand-logo-name">{t.service}</span></Link><div className="host-header-tools"><span className="host-label"><span className={`live-dot${listening ? "" : " paused-dot"}`}/>{listening ? t.listening : t.host}</span><ScreenLanguagePicker value={screenLanguage} onChange={changeScreenLanguage}/></div></header>
      <div className="host-heading"><div><span className="eyebrow">{t.scenes[scene as keyof typeof t.scenes] ?? t.create} · {t.code} {code}</span><h1>{title || t.create}</h1><p className="hero-description">{t.hostIntro}</p></div><StatusBadge tone={listening ? "success" : "neutral"}>{listening ? t.live : t.waiting}</StatusBadge></div>
      <div className="host-layout">
        <section className="host-primary">
          <Card className="host-control-card">
            <div className="qr-placeholder"><QRCodeSVG value={audienceUrl || `/j/${code}`} size={260} level="H" includeMargin aria-label={t.scanQr}/><strong>{t.scanQr}</strong><small>{audienceUrl || `/j/${code}`}</small></div>
            <div className="host-stats"><div><strong>{audiencePresence.total}<span>{screenLanguage === "en" || screenLanguage === "ru" ? "" : screenLanguage === "ja" ? "人" : screenLanguage === "zh" ? "人" : screenLanguage === "vi" ? " người" : "명"}</span></strong><small>{t.audienceCount}</small></div><div><strong>{captions.length}<span>{screenLanguage === "en" ? "" : screenLanguage === "ja" ? "件" : screenLanguage === "zh" ? "句" : screenLanguage === "vi" ? " câu" : screenLanguage === "ru" ? "" : "문장"}</span></strong><small>{t.sentenceCount}</small></div><div className="stat-languages">{LANGUAGES.filter((item) => selectedLanguages.includes(item.code)).map((item) => <span className="stat-language" key={item.code}><CountryFlag country={item.country}/>{item.name} {audiencePresence.byLanguage[item.code] ?? 0}</span>)}</div></div>
            <div className="translation-language-settings"><strong>{t.translationLanguages}</strong><small>{t.translationHint}</small><div className="translation-language-options">{LANGUAGES.map((item) => <label key={item.code} className="translation-language-option"><input type="checkbox" checked={selectedLanguages.includes(item.code)} onChange={() => void toggleLanguage(item.code)}/><CountryFlag country={item.country}/><span>{item.name}</span></label>)}</div></div>
            <div className="host-actions">{listening ? <Button onClick={stopListening}>{t.stopSpeaking}</Button> : <Button onClick={startListening} disabled={!speechSupported}>{t.startSpeaking}</Button>}</div>
            {!speechSupported && <p role="alert" className="form-error">{t.micHelp}</p>}
            {interim && <div className="interim-caption" aria-live="polite">{interim}</div>}
          </Card>
          <Card className="typing-card"><label className="field-label" htmlFor="manual-text">{t.manualLabel}</label><form className="typing-row" onSubmit={submitManual}><input className="text-input" id="manual-text" value={manual} onChange={(event) => setManual(event.target.value)} onKeyDown={onManualKeyDown} placeholder={t.manualPlaceholder}/><Button type="submit" variant="outline" disabled={!manual.trim() || saving}>{saving ? t.saving : t.add}</Button></form></Card>
          {error && <p role="alert" className="form-error">{error}</p>}
        </section>
        <section><Card className="caption-list-card"><div className="section-heading"><div><h2>{t.captions}</h2><p>{t.captionsDescription}</p></div><StatusBadge tone={listening ? "success" : "neutral"}>{captions.length}</StatusBadge></div>
          {loading ? <div className="empty-caption"><strong>{t.loadingCaptions}</strong></div> : captions.length ? captions.map((caption) => <article key={caption.id} className="host-caption"><div><p>{caption.original}</p><div className="caption-status-row"><small className="caption-time">{new Date(caption.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</small><StatusBadge tone={caption.translation_status === "completed" ? "success" : caption.translation_status === "failed" ? "warning" : "neutral"}>{caption.translation_status === "completed" ? t.translationDone : caption.translation_status === "failed" ? t.translationFailed : caption.translation_status === "translating" ? t.translationRunning : t.translationPending}</StatusBadge>{caption.translation_status === "failed" && <Button type="button" variant="outline" className="retry-translation-button" onClick={() => void retryTranslation(caption)}>{screenLanguage === "ja" ? "再翻訳" : screenLanguage === "en" ? "Retry translation" : screenLanguage === "vi" ? "Dịch lại" : screenLanguage === "zh" ? "重新翻译" : screenLanguage === "ru" ? "Перевести снова" : "다시 번역"}</Button>}</div></div></article>) : <div className="empty-caption"><span>◖◗</span><strong>{t.noCaptions}</strong><small>{t.noCaptionsHint}</small></div>}
        </Card></section>
      </div>
    </main>
  );
}
