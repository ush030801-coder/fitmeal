// Plan SC: FR-03 / PLAN 작업 10번 — 음식 칼로리·영양소 계산 확인
import { describe, expect, it } from "vitest";
import { calcDirectFoodEntry, calcFoodEntry } from "@/lib/calc/food";
import { getFoodById } from "@/data/foods";

const rice = getFoodById("f001")!; // 쌀밥 1공기 210g

describe("목록 음식 계산", () => {
  it("1인분은 목록 값 그대로", () => {
    const entry = calcFoodEntry(rice, "serving", 1);
    expect(entry).toMatchObject({
      foodId: "f001", name: "쌀밥", unit: "serving", amount: 1,
      kcal: rice.kcal, estimated: false,
    });
  });

  it("인분은 양에 비례한다 (0.5인분은 절반)", () => {
    expect(calcFoodEntry(rice, "serving", 0.5).kcal).toBe(Math.round(rice.kcal / 2));
    expect(calcFoodEntry(rice, "serving", 2).kcal).toBe(rice.kcal * 2);
  });

  it("g 단위는 제공량 그램수로 나눠 계산한다 (제공량 g은 1인분과 같다)", () => {
    expect(calcFoodEntry(rice, "g", rice.grams).kcal).toBe(rice.kcal);
    expect(calcFoodEntry(rice, "g", rice.grams / 2).kcal).toBe(Math.round(rice.kcal / 2));
  });

  it("칼로리는 정수, 영양소는 소수 첫째 자리", () => {
    const entry = calcFoodEntry(rice, "serving", 0.3);
    expect(Number.isInteger(entry.kcal)).toBe(true);
    for (const v of [entry.carbs, entry.protein, entry.fat]) {
      expect(Math.round(v * 10) / 10).toBe(v);
    }
  });
});

describe("직접 입력 음식 계산", () => {
  it("칼로리만 쓰고 탄·단·지는 0, 추정치로 표시한다", () => {
    expect(calcDirectFoodEntry("엄마표 김치찌개", 320)).toEqual({
      foodId: null, name: "엄마표 김치찌개", unit: "serving", amount: 1,
      kcal: 320, carbs: 0, protein: 0, fat: 0, estimated: true,
    });
  });
});
