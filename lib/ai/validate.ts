// Design Ref: §4.2 서버가 하는 일 5 — 허용 범위·하한, 단백질, 알레르기를 서버가 다시 검증한다
// Plan SC: FR-06 / PRD 예외 처리 — 규칙에 어긋난 식단은 사용자에게 보여주지 않는다
// (3끼 구성·내장 목록 여부는 lib/ai/menu.ts의 parseAiMenu가 먼저 검사한다)
import type { Food } from "@/data/foods";
import { PROTEIN_G_PER_KG } from "@/lib/calc/constants";
import { calcMenuRange } from "@/lib/calc/tomorrow";
import { minKcalFor } from "@/lib/calc/recommend";
import type { Meal, Totals } from "./menu";
import type { MenuRequest } from "./request";

// 어긋난 규칙 하나. message는 AI에게 다시 요청할 때 이유로 알려 준다.
export type Violation = {
  rule: "kcal_range" | "floor" | "protein" | "allergen";
  message: string;
};

const fmt = (value: number) => value.toLocaleString("ko-KR");

// 서버가 직접 계산한 식단(meals·totals)이 규칙을 지키는지 검사한다. 비어 있으면 통과.
export function validateMenu(
  menu: { meals: Meal[]; totals: Totals },
  request: MenuRequest,
  foodsById: ReadonlyMap<string, Food>,
): Violation[] {
  const violations: Violation[] = [];
  const { totals } = menu;

  // ① 하한: 어떤 경우에도 성별 하한 아래로 추천하지 않는다 (가장 우선)
  const floorKcal = minKcalFor(request.sex);
  if (totals.kcal < floorKcal) {
    violations.push({
      rule: "floor",
      message: `하루 합계 ${fmt(totals.kcal)}kcal가 최소 섭취 기준 ${fmt(floorKcal)}kcal보다 낮습니다.`,
    });
  }

  // ② 허용 범위 [max(하한, 목표×0.95), 목표×1.05]
  const range = calcMenuRange(request.targetKcal, floorKcal);
  if (totals.kcal < range.minKcal) {
    violations.push({
      rule: "kcal_range",
      message: `하루 합계 ${fmt(totals.kcal)}kcal가 허용 범위(${fmt(Math.ceil(range.minKcal))}~${fmt(Math.floor(range.maxKcal))}kcal)보다 낮습니다. ${fmt(Math.ceil(range.minKcal) - totals.kcal)}kcal 이상 늘려 주세요.`,
    });
  } else if (totals.kcal > range.maxKcal) {
    violations.push({
      rule: "kcal_range",
      message: `하루 합계 ${fmt(totals.kcal)}kcal가 허용 범위(${fmt(Math.ceil(range.minKcal))}~${fmt(Math.floor(range.maxKcal))}kcal)보다 높습니다. ${fmt(totals.kcal - Math.floor(range.maxKcal))}kcal 이상 줄여 주세요.`,
    });
  }

  // ③ 단백질: 체중 1kg당 1.6g 이상 (소수 계산 오차 허용)
  const minProtein = request.weightKg * PROTEIN_G_PER_KG;
  if (totals.protein < minProtein - 1e-9) {
    violations.push({
      rule: "protein",
      message: `하루 단백질 ${totals.protein}g이 최소 ${Math.ceil(minProtein)}g보다 적습니다.`,
    });
  }

  // ④ 알레르기: 후보에서 이미 뺐지만 서버가 답변을 다시 검사한다
  const allergic: string[] = [];
  for (const meal of menu.meals) {
    for (const item of meal.items) {
      const food = foodsById.get(item.foodId);
      if (food && food.allergens.some((a) => request.allergies.includes(a))) {
        allergic.push(food.name);
      }
    }
  }
  if (allergic.length > 0) {
    violations.push({
      rule: "allergen",
      message: `알레르기 음식이 들어 있습니다: ${[...new Set(allergic)].join(", ")}`,
    });
  }

  return violations;
}
