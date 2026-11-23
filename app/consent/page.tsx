// Design Ref: §5.3 화면 목록 — 동의(/consent): AI 전송 고지, 동의해야 다음으로 이동
import ConsentForm from "@/components/ConsentForm";

export const metadata = { title: "시작하기 | 핏밀(FitMeal)" };

export default function ConsentPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">핏밀에 오신 것을 환영합니다</h1>
      <ConsentForm />
    </div>
  );
}
