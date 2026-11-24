// Design Ref: §5.3 화면 목록 — 과거 기록(/history): 날짜별 기록 열람·수정
import HistoryScreen from "@/components/HistoryScreen";

export const metadata = { title: "과거 기록 | 핏밀(FitMeal)" };

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">과거 기록</h1>
      <HistoryScreen />
    </div>
  );
}
