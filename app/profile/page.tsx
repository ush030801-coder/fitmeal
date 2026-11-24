// Design Ref: §5.3 화면 목록 — 내 정보(/profile): 정보 입력·수정, 권장 칼로리·탄단지 표시
import ClearDataSection from "@/components/ClearDataSection";
import ProfileForm from "@/components/ProfileForm";

export const metadata = { title: "내 정보 | 핏밀(FitMeal)" };

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">내 정보</h1>
      <ProfileForm />
      <ClearDataSection />
    </div>
  );
}
