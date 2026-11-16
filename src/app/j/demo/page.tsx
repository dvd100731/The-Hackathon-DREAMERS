import { BrandLogo, Card, LanguageSelector, CaptionLine, StatusBadge } from "@/components/ui";
import { SAMPLE_CAPTIONS } from "@/lib/sample";

export default async function DemoAudiencePage() {
  return <main className="audience-shell"><header className="audience-topbar"><BrandLogo description="실시간 통역 자막"/><StatusBadge>예시 설명회</StatusBadge></header><section className="audience-heading"><span className="eyebrow">학교 설명회 · 예시 화면</span><h1>신입 학부모<br/>오리엔테이션</h1><p>환영합니다. 편한 언어로 함께 들어요.</p></section><Card className="language-card"><div><strong>자막 언어</strong><small>언제든 바꿀 수 있어요</small></div><LanguageSelector/></Card><section className="live-panel"><div className="live-heading"><span className="live-dot"/> 예시 자막 <span className="live-heading-rule"/></div><div className="caption-stack">{SAMPLE_CAPTIONS.map((caption) => <CaptionLine key={caption.original} original={caption.original} translation={caption.translation} terms={caption.terms}/>)}</div></section><footer className="audience-controls"><button className="button button-icon" aria-label="글자 크기 줄이기">가−</button><span>글자 크기</span><button className="button button-icon" aria-label="글자 크기 늘리기">가＋</button></footer></main>;
}
