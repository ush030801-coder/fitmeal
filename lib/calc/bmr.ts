// Design Ref: PRD 5번 Must 1 — 기초대사량은 미플린-세인트 조르 공식으로 계산한다
// Plan SC: FR-01 기본 권장 칼로리 = 기초대사량 × 활동량 계수 + 목표 가감
import type { Profile } from "@/types";

// 기초대사량(kcal/일) = 10×몸무게(kg) + 6.25×키(cm) − 5×나이(만) + (남성 +5 / 여성 −161)
// 반올림하지 않은 값을 돌려준다. (반올림은 최종 권장 칼로리에서 한 번만 한다)
export function calcBmr(
  profile: Pick<Profile, "sex" | "age" | "heightCm" | "weightKg">,
): number {
  const base =
    10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;
  return profile.sex === "male" ? base + 5 : base - 161;
}
