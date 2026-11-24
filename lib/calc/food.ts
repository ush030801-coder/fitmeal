// Design Ref: §2.2 ② — 음식 한 건의 칼로리·영양소 계산
// Plan SC: FR-03 — 목록 음식은 양(인분 또는 g)에 비례해 계산하고, 직접 입력 음식은 탄·단·지를 0으로 둔다
import type { Food } from "@/data/foods";
import type { FoodEntry, FoodUnit } from "@/types";

// 단위에 따른 배수. 1인분 = 목록의 1회 제공량, g는 제공량 그램수로 나눈다.
function ratioOf(food: Food, unit: FoodUnit, amount: number): number {
  return unit === "serving" ? amount : amount / food.grams;
}

// 칼로리는 정수, 영양소는 소수 첫째 자리로 정리한다
const roundKcal = (value: number) => Math.round(value);
const roundGram = (value: number) => Math.round(value * 10) / 10;

// 목록에서 고른 음식과 양으로 "오늘 기록에 저장할 음식 1건"을 만든다.
// 양의 범위(0.1~10인분, 1~2,000g)는 lib/validation에서 먼저 확인한 값이라고 본다.
export function calcFoodEntry(food: Food, unit: FoodUnit, amount: number): FoodEntry {
  const ratio = ratioOf(food, unit, amount);
  return {
    foodId: food.id,
    name: food.name,
    unit,
    amount,
    kcal: roundKcal(food.kcal * ratio),
    carbs: roundGram(food.carbs * ratio),
    protein: roundGram(food.protein * ratio),
    fat: roundGram(food.fat * ratio),
    estimated: food.estimated, // 식약처 자료와 대조하지 못한 음식은 추정치로 표시
  };
}

// 목록에 없어서 직접 입력한 음식(이름·칼로리). 탄·단·지는 알 수 없어 0으로 계산하고 추정치로 표시한다.
export function calcDirectFoodEntry(name: string, kcal: number): FoodEntry {
  return {
    foodId: null,
    name,
    unit: "serving",
    amount: 1,
    kcal: roundKcal(kcal),
    carbs: 0,
    protein: 0,
    fat: 0,
    estimated: true,
  };
}
