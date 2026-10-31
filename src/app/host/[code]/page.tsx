"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Button, Card, StatusBadge } from "@/components/ui";
import { createSupabaseClient } from "@/lib/supabase-browser";

type Caption = { id: string; original: string; created_at: string };
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

const sceneNames: Record<string, string> = {
  school: "학교", safety: "산업 안전", university: "대학", religion: "종교", tourism: "관광", other: "기타",
};

export default function HostPage() {
  const { code } = useParams<{ code: string }>();
  const [title, setTitle] = useState("");
  const [scene, setScene] = useState("");
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

  const appendCaption = useCallback((caption: Caption) => {
    setCaptions((current) => current.some((item) => item.id === caption.id)
      ? current
      : [...current, caption].sort((a, b) => a.created_at.localeCompare(b.created_at)));
  }, []);

  const saveCaption = useCallback(async (text: string) => {
    const original = text.trim();
    if (!original) return false;
    const supabase = createSupabaseClient();
    if (!supabase) {
      setError("Supabase 환경변수를 확인해 주세요.");
      return false;
    }

    setSaving(true);
    setError("");
    const { data, error: insertError } = await supabase
      .from("captions")
      .insert({ room_code: code, original, translations: {}, terms: [] })
      .select("id,original,created_at")
      .single();
    setSaving(false);
    if (insertError) {
      setError(`자막을 저장하지 못했어요: ${insertError.message}`);
      return false;
    }
    appendCaption(data);
    return true;
  }, [appendCaption, code]);

  useEffect(() => {
    const supabase = createSupabaseClient();
    if (!supabase) {
      setError("Supabase 환경변수를 확인해 주세요.");
      setLoading(false);
      return;
    }

    let active = true;
    const loadRoom = async () => {
      const { data: room, error: roomError } = await supabase
        .from("rooms").select("title,scene").eq("code", code).maybeSingle();
      if (!active) return;
      if (roomError || !room) {
        setError(roomError?.message ?? "설명회 방을 찾을 수 없어요.");
        setLoading(false);
        return;
      }
      setTitle(room.title);
      setScene(room.scene);
      const { data, error: captionError } = await supabase
        .from("captions").select("id,original,created_at").eq("room_code", code).order("created_at");
      if (!active) return;
      if (captionError) setError(`자막을 불러오지 못했어요: ${captionError.message}`);
      else setCaptions(data ?? []);
      setLoading(false);
    };
    void loadRoom();

    const channel = supabase
      .channel(`host-captions-${code}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "captions", filter: `room_code=eq.${code}`,
      }, (payload) => appendCaption(payload.new as Caption))
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" && active) setError("실시간 자막 연결이 끊겼어요. 새로고침해 주세요.");
      });

    return () => {
      active = false;
      shouldListenRef.current = false;
      recognitionRef.current?.abort();
      void supabase.removeChannel(channel);
    };
  }, [appendCaption, code]);

  useEffect(() => {
    setSpeechSupported(Boolean(window.webkitSpeechRecognition));
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setError("이 브라우저는 음성 인식을 지원하지 않아요. Chrome에서 열어 주세요.");
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
        setError("마이크 권한을 허용해 주세요.");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setError("음성 인식이 일시 중단됐어요. 다시 연결하고 있습니다.");
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
      setError("음성 인식을 시작하지 못했어요. Chrome에서 마이크 권한을 확인해 주세요.");
    }
  }, [saveCaption]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    setInterim("");
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

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
      <header className="app-header"><a href="/" className="brand-mark"><span className="brand-icon">모</span> 모두의 설명회</a><span className="host-label"><span className={`live-dot${listening ? "" : " paused-dot"}`}/>{listening ? "음성 인식 중" : "진행자 화면"}</span></header>
      <div className="host-heading"><div><span className="eyebrow">{sceneNames[scene] ?? "설명회"} · 참여 코드 {code}</span><h1>{title || "설명회"}</h1><p className="hero-description">QR을 공유하고 말씀을 시작해 보세요.</p></div><StatusBadge tone={listening ? "success" : "neutral"}>{listening ? "말하기 중" : "대기 중"}</StatusBadge></div>
      <div className="host-layout">
        <section className="host-primary">
          <Card className="host-control-card">
            <div className="qr-placeholder"><QRCodeSVG value={audienceUrl || `/j/${code}`} size={260} level="H" includeMargin aria-label="청중 접속 QR 코드"/><strong>청중이 QR을 찍고 바로 입장해요</strong><small>{audienceUrl || `/j/${code}`}</small></div>
            <div className="host-stats"><div><strong>{captions.length}<span>문장</span></strong><small>저장된 자막</small></div><div><strong>{loading ? "…" : "준비"}</strong><small>방 상태</small></div><div className="stat-languages">실시간으로 자막을 저장하고 있어요</div></div>
            <div className="host-actions">{listening ? <Button onClick={stopListening}>말하기 정지</Button> : <Button onClick={startListening} disabled={!speechSupported}>말하기 시작</Button>}</div>
            {!speechSupported && <p role="alert" className="form-error">Chrome에서 이 페이지를 열고 마이크 권한을 허용해 주세요.</p>}
            {interim && <div className="interim-caption" aria-live="polite">{interim}</div>}
          </Card>
          <Card className="typing-card"><label className="field-label" htmlFor="manual-text">음성 인식이 안 되면 직접 입력하세요</label><form className="typing-row" onSubmit={submitManual}><input className="text-input" id="manual-text" value={manual} onChange={(event) => setManual(event.target.value)} onKeyDown={onManualKeyDown} placeholder="내용을 입력하고 Enter를 누르세요"/><Button type="submit" variant="outline" disabled={!manual.trim() || saving}>{saving ? "저장 중…" : "추가"}</Button></form></Card>
          {error && <p role="alert" className="form-error">{error}</p>}
        </section>
        <section><Card className="caption-list-card"><div className="section-heading"><div><h2>지금까지의 자막</h2><p>이 방에서 저장된 확정 문장</p></div><StatusBadge tone={listening ? "success" : "neutral"}>{captions.length}개</StatusBadge></div>
          {loading ? <div className="empty-caption"><strong>자막을 불러오는 중이에요</strong></div> : captions.length ? captions.map((caption) => <article key={caption.id} className="host-caption"><div><p>{caption.original}</p><small className="caption-time">{new Date(caption.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</small></div></article>) : <div className="empty-caption"><span>◖◗</span><strong>아직 저장된 자막이 없어요</strong><small>말하기를 시작하거나 내용을 입력해 보세요.</small></div>}
        </Card></section>
      </div>
    </main>
  );
}
