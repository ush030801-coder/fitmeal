// Design Ref: §5.1 공통 틀 — 모든 화면 하단에 의료 상담 대체 불가 문구를 항상 표시
// Plan SC: 비기능 "안전" — 모든 식단·칼로리 화면에 의료 상담 대체 불가 문구 표시
export const DISCLAIMER_TEXT = "참고용 안내이며 의료 상담을 대체하지 않습니다";

export default function DisclaimerFooter() {
  return (
    <footer className="border-t border-foreground/15">
      <p className="mx-auto w-full max-w-3xl px-4 py-3 text-center text-xs text-foreground/70">
        {DISCLAIMER_TEXT}
      </p>
    </footer>
  );
}
