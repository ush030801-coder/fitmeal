// Design Ref: §5.3 화면 목록 — 주간 요약(/weekly): 최근 7일 합계
import WeeklyScreen from "@/components/WeeklyScreen";

export const metadata = { title: "주간 요약 | 핏밀(FitMeal)" };

export default function WeeklyPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">주간 요약</h1>
      <WeeklyScreen />
    </div>
  );
}
