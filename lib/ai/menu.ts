// Design Ref: §4.2 서버가 하는 일 3·4·6 — AI 답변 모양 검사, 내장 데이터로 직접 계산, 안내 문구
// Plan SC: FR-06 — AI가 적은 칼로리·영양소 숫자는 믿지 않고 서버가 다시 계산한다
import { z } from "zod";
import type { Food } from "@/data/foods";
import { calcFoodEntry } from "@/lib/calc/food";
import type { MenuRequest } from "./request";
import { SERVING_MAX, SERVING_MIN, SERVING_STEP } from "./prompt";

export const MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export type MenuItem = {
  foodId: string;
  name: string;
  amountText: string; // 예: "1공기 × 1.5"
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
};
export type Meal = { type: MealType; items: MenuItem[] };
export type Totals = { kcal: number; carbs: number; protein: number; fat: number };
export type MenuResponse = { meals: Meal[]; totals: Totals; notes: string[] };

// AI가 준 날것의 답변 (아직 아무것도 믿지 않은 상태)
const aiMenuSchema = z.object({
  meals: z.array(
    z.object({
      type: z.enum(MEAL_TYPES),
      items: z.array(
        z.object({
          foodId: z.string(),
          servings: z.number().min(SERVING_MIN).max(SERVING_MAX),
        }),
      ),
    }),
  ),
});

export type AiMenu = z.infer<typeof aiMenuSchema>;

export type ParseResult =
  | { ok: true; menu: AiMenu }
  | { ok: false; reason: string };

// 0.5 단위가 맞는지 (소수 계산 오차를 피해 2배해서 정수인지 본다)
const isOnStep = (servings: number) =>
  Math.abs(servings / SERVING_STEP - Math.round(servings / SERVING_STEP)) < 1e-9;

// AI 답변 글자를 읽어 모양을 검사한다: JSON인지, 3끼 구성인지, foodId가 후보 안에 있는지
export function parseAiMenu(text: string, candidateIds: ReadonlySet<string>): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: "답변이 JSON이 아닙니다" };
  }
  const parsed = aiMenuSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "답변 모양이 약속과 다릅니다" };

  const menu = parsed.data;
  const types = menu.meals.map((meal) => meal.type);
  if (menu.meals.length !== 3 || new Set(types).size !== 3) {
    return { ok: false, reason: "아침·점심·저녁 3끼가 한 번씩 있어야 합니다" };
  }
  for (const meal of menu.meals) {
    if (meal.items.length < 1 || meal.items.length > 4) {
      return { ok: false, reason: "끼니마다 음식은 1~4개여야 합니다" };
    }
    const ids = meal.items.map((item) => item.foodId);
    if (new Set(ids).size !== ids.length) {
      return { ok: false, reason: "같은 끼니에 같은 음식이 두 번 있습니다" };
    }
    for (const item of meal.items) {
      if (!candidateIds.has(item.foodId)) {
        return { ok: false, reason: "후보 목록에 없는 음식이 들어 있습니다" };
      }
      if (!isOnStep(item.servings)) {
        return { ok: false, reason: `인분 수는 ${SERVING_STEP} 단위여야 합니다` };
      }
    }
  }
  return { ok: true, menu };
}

const round1 = (value: number) => Math.round(value * 10) / 10;

// AI 답변의 foodId·인분 수만 받아서, 칼로리·영양소는 내장 음식 데이터로 직접 계산한다
export function buildMenu(menu: AiMenu, foodsById: ReadonlyMap<string, Food>): { meals: Meal[]; totals: Totals } {
  const meals: Meal[] = MEAL_TYPES.map((type) => {
    const meal = menu.meals.find((m) => m.type === type)!;
    return {
      type,
      items: meal.items.map((item) => {
        const food = foodsById.get(item.foodId)!;
        const entry = calcFoodEntry(food, "serving", item.servings);
        return {
          foodId: food.id,
          name: food.name,
          amountText: `${food.serving} × ${item.servings}`,
          kcal: entry.kcal,
          carbs: entry.carbs,
          protein: entry.protein,
          fat: entry.fat,
        };
      }),
    };
  });

  const all = meals.flatMap((meal) => meal.items);
  const sum = (pick: (item: MenuItem) => number) => all.reduce((s, item) => s + pick(item), 0);
  return {
    meals,
    totals: {
      kcal: sum((i) => i.kcal),
      carbs: round1(sum((i) => i.carbs)),
      protein: round1(sum((i) => i.protein)),
      fat: round1(sum((i) => i.fat)),
    },
  };
}

// 안내 문구는 AI가 아니라 서버가 adjustment 값으로 만든다
export function buildNotes(adjustment: MenuRequest["adjustment"], floorKcal: number): string[] {
  const notes: string[] = [];
  const kcal = (v: number) => `${v.toLocaleString("ko-KR")}kcal`;

  if (adjustment.noRecord) {
    notes.push("오늘 입력한 기록이 없어 초과·부족 반영 없이 기본 권장 칼로리를 기준으로 추천했습니다.");
  } else if (adjustment.kind === "over" && adjustment.appliedKcal > 0) {
    notes.push(`오늘 초과분 ${kcal(adjustment.appliedKcal)}를 내일 목표에서 덜어냈습니다.`);
  } else if (adjustment.kind === "under" && adjustment.appliedKcal > 0) {
    notes.push(`오늘 많이 부족해서 내일 목표에 ${kcal(adjustment.appliedKcal)}를 더했습니다.`);
  }
  if (adjustment.capped) {
    notes.push(
      adjustment.kind === "under"
        ? "하루에 더할 수 있는 최대 300kcal까지만 반영했습니다."
        : "오늘 초과분 중 일부만 반영했습니다. (하루에 덜어낼 수 있는 최대는 300kcal입니다.)",
    );
  }
  if (adjustment.floorRaised) {
    notes.push(`하루 최소 섭취 기준(${kcal(floorKcal)}) 아래로 내려가지 않도록 목표를 하한으로 맞췄습니다.`);
  }
  return notes;
}
