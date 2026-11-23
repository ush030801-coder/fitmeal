// Design Ref: §5.3 화면 목록 — 오늘(/): 운동·음식 입력, 오늘 결과
import TodayScreen from "@/components/TodayScreen";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">오늘</h1>
      <TodayScreen />
    </div>
  );
}
