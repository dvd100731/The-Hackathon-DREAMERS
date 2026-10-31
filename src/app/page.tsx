"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { createSupabaseClient } from "@/lib/supabase-browser";
import { type SceneType } from "@/lib/constants";

const scenes: { id: SceneType; label: string; detail: string }[] = [
  { id: "school", label: "학교", detail: "학부모 설명회 · 오리엔테이션" },
  { id: "safety", label: "산업 안전", detail: "현장 안전 교육 · 작업 안내" },
  { id: "university", label: "대학", detail: "유학생 OT · 캠퍼스 안내" },
  { id: "religion", label: "종교", detail: "예배 · 교회 안내" },
  { id: "tourism", label: "관광", detail: "관광 해설 · 문화 체험" },
  { id: "other", label: "기타", detail: "다양한 모임과 설명회" },
];

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function Home() {
  const [scene, setScene] = useState<SceneType>("school");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("설명회 제목을 입력해 주세요.");
      return;
    }
    const supabase = createSupabaseClient();
    if (!supabase) {
      setError("Supabase 환경변수를 확인해 주세요.");
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
      setError(err instanceof Error ? err.message : "방을 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
      setSaving(false);
    }
  }

  return (
    <main className="page-shell">
      <header className="topbar"><Link href="/" className="brand-mark"><span className="brand-icon">모</span> 모두의 설명회</Link><span className="topbar-tag">함께 듣고, 함께 이해해요</span></header>
      <section className="hero-grid">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot"/> 누구에게나 열려 있는 설명회</div><h1>한 사람의 설명을<br/><span>모두의 이해로.</span></h1><p className="hero-description">말씀은 한 번이면 충분해요.<br/>각자의 언어로, 모두가 함께 들어요.</p><div className="language-pills"><span>English</span><span>Tiếng Việt</span><span>中文</span><span>Русский</span></div></div>
        <Card className="setup-card"><div className="card-kicker">새 설명회 만들기 <span className="step-number">01</span></div><h2>어떤 이야기를 나누시나요?</h2><p className="card-description">정보를 입력하고, 다 같이 이해하는 시간을 시작해 보세요.</p>
          <form onSubmit={createRoom} className="setup-form"><label className="field-label" htmlFor="title">설명회 제목</label><input id="title" name="title" required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} className="text-input" placeholder="예: 신입 학부모 오리엔테이션"/><div className="label-row"><span className="field-label">어떤 자리인가요?</span><span className="optional-label">하나를 선택해 주세요</span></div><div className="scene-options">{scenes.map((item) => <button className={`scene-choice${scene === item.id ? " selected" : ""}`} key={item.id} type="button" onClick={() => setScene(item.id)} aria-pressed={scene === item.id}><span className="choice-indicator"/><span className="choice-text"><strong>{item.label}</strong><small>{item.detail}</small></span></button>)}</div>{error && <p role="alert" className="form-error">{error}</p>}<Button type="submit" disabled={saving} className="primary-action">{saving ? "방을 만들고 있어요…" : "설명회 준비하기"}<span>→</span></Button></form>
        </Card>
      </section>
      <section className="privacy-note"><span className="privacy-icon">↗</span><div><strong>음성 인식에 크롬 기능을, 번역에 AI를 사용해요.</strong><p>설명회 내용은 저장 후 요약에만 사용됩니다.</p></div><span className="privacy-lock">안전한 안내</span></section>
      <footer className="home-footer"><span>함께 말하면, 더 가까워집니다.</span><span>© 모두의 설명회</span></footer>
    </main>
  );
}
