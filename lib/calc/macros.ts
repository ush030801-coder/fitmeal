// Design Ref: §2.2 ① — 탄수화물·단백질·지방 권장 그램 계산
// Plan SC: FR-01 — 단백질(체중 1kg당 1.6g)을 먼저 정하고, 남은 칼로리를 탄수화물 60% / 지방 40%로 나눈다
import {
  CARB_SHARE,
  FAT_SHARE,
  KCAL_PER_G,
  PROTEIN_G_PER_KG,
} from "./constants";

export type Macros = {
  proteinG: number; // 정수(g), 체중 1kg당 1.6g 이상이 되도록 올림
  carbsG: number; // 정수(g)
  fatG: number; // 정수(g)
};

// 소수 계산 오차(예: 70 × 1.6 = 112.00000000000001)로 올림이 한 칸 튀지 않게 먼저 다듬는다
function ceilWithoutFloatNoise(value: number): number {
  return Math.ceil(Math.round(value * 1e6) / 1e6);
}

// kcal: 기본 권장 칼로리(하한 적용 후), weightKg: 몸무게
export function calcMacros(kcal: number, weightKg: number): Macros {
  // 올림해야 "1kg당 1.6g 이상"이 반올림 때문에 깨지지 않는다
  const proteinG = ceilWithoutFloatNoise(weightKg * PROTEIN_G_PER_KG);
  // 단백질이 칼로리를 다 차지하는 극단적인 경우에도 음수가 되지 않게 0으로 막는다
  const remainingKcal = Math.max(0, kcal - proteinG * KCAL_PER_G.protein);
  return {
    proteinG,
    carbsG: Math.round((remainingKcal * CARB_SHARE) / KCAL_PER_G.carbs),
    fatG: Math.round((remainingKcal * FAT_SHARE) / KCAL_PER_G.fat),
  };
}
