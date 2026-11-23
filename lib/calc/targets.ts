// Design Ref: §5.4 내 정보 화면 — 결과: 기본 권장 칼로리와 탄·단·지 권장 그램
// Plan SC: 성공 기준 4 — 입력 후 권장 칼로리와 탄·단·지를 100% 자동 제시
import type { Profile } from "@/types";
import { calcMacros, type Macros } from "./macros";
import { calcRecommendedKcal, type RecommendedKcal } from "./recommend";

export type DailyTargets = RecommendedKcal & Macros;

// 사용자 정보 하나로 기본 권장 칼로리와 탄·단·지 권장 그램을 한 번에 계산한다
export function calcDailyTargets(profile: Profile): DailyTargets {
  const recommended = calcRecommendedKcal(profile);
  return {
    ...recommended,
    ...calcMacros(recommended.kcal, profile.weightKg),
  };
}
