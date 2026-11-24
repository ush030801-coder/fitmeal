// Design Ref: §5.3 화면 목록 — 내일 식단(/menu): 3끼 카드, 하루 합계, 반영 안내
import MenuScreen from "@/components/MenuScreen";

export const metadata = { title: "내일 식단 | 핏밀(FitMeal)" };

export default function MenuPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">내일 식단</h1>
      <MenuScreen />
    </div>
  );
}
