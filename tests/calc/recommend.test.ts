// Plan SC: FR-01 / 성공 기준 4 — 기초대사량·기본 권장 칼로리·하한·탄단지 계산 확인
import { describe, expect, it } from "vitest";
import { calcBmr } from "@/lib/calc/bmr";
import { calcMacros } from "@/lib/calc/macros";
import { calcRecommendedKcal, minKcalFor } from "@/lib/calc/recommend";
import { calcDailyTargets } from "@/lib/calc/targets";
import { GOAL_VALUES, SEX_VALUES, type Profile } from "@/types";

// 계산 확인용 기본 사용자: 30세 여성, 165cm, 60kg
const woman: Profile = {
  sex: "female",
  age: 30,
  heightCm: 165,
  weightKg: 60,
  activity: 1.375,
  goal: "lose",
  allergies: [],
};

describe("기초대사량(미플린-세인트 조르)", () => {
  it("여성 30세 165cm 60kg → 1320.25", () => {
    expect(calcBmr(woman)).toBeCloseTo(1320.25, 5);
  });

  it("남성 30세 175cm 70kg → 1648.75", () => {
    const man = { ...woman, sex: "male" as const, heightCm: 175, weightKg: 70 };
    expect(calcBmr(man)).toBeCloseTo(1648.75, 5);
  });

  it("같은 몸이면 남성이 여성보다 166 높다 (+5 − (−161))", () => {
    expect(calcBmr({ ...woman, sex: "male" }) - calcBmr(woman)).toBeCloseTo(166, 5);
  });
});

describe("기본 권장 칼로리", () => {
  it("체중 감량: 기초대사량 × 활동량 − 500", () => {
    const result = calcRecommendedKcal(woman);
    expect(result.rawKcal).toBeCloseTo(1315.34375, 4);
    expect(result.kcal).toBe(1315);
    expect(result.floorRaised).toBe(false);
  });

  it("근육 증가는 +300, 체중 유지는 ±0", () => {
    expect(calcRecommendedKcal({ ...woman, goal: "gain" }).kcal).toBe(2115);
    expect(calcRecommendedKcal({ ...woman, goal: "maintain" }).kcal).toBe(1815);
  });

  it("하한: 여성 1,200 / 남성 1,500", () => {
    expect(minKcalFor("female")).toBe(1200);
    expect(minKcalFor("male")).toBe(1500);
  });

  it("여성 계산값이 하한보다 낮으면 1,200으로 올리고 알린다", () => {
    const small = { ...woman, age: 19, heightCm: 150, weightKg: 40, activity: 1.2 as const };
    const result = calcRecommendedKcal(small);
    expect(result.rawKcal).toBeCloseTo(797.8, 1);
    expect(result.kcal).toBe(1200);
    expect(result.floorKcal).toBe(1200);
    expect(result.floorRaised).toBe(true);
  });

  it("남성은 1,500 아래로 내려가지 않는다", () => {
    const man: Profile = {
      ...woman,
      sex: "male",
      age: 50,
      heightCm: 160,
      weightKg: 50,
      activity: 1.2,
    };
    const keep = calcRecommendedKcal({ ...man, goal: "maintain" });
    expect(keep.kcal).toBe(1506); // 하한 이상이라 그대로
    expect(keep.floorRaised).toBe(false);
    const lose = calcRecommendedKcal({ ...man, goal: "lose" });
    expect(lose.rawKcal).toBeCloseTo(1006, 3);
    expect(lose.kcal).toBe(1500);
    expect(lose.floorRaised).toBe(true);
  });
});

describe("탄수화물·단백질·지방 권장 그램", () => {
  it("2,000kcal·60kg: 단백질 96g 먼저, 남은 1,616kcal를 탄수화물 60% / 지방 40%", () => {
    expect(calcMacros(2000, 60)).toEqual({ proteinG: 96, carbsG: 242, fatG: 72 });
  });

  it("세 영양소의 칼로리 합이 권장 칼로리와 거의 같다 (반올림 오차 10kcal 이내)", () => {
    const { proteinG, carbsG, fatG } = calcMacros(2000, 60);
    expect(Math.abs(proteinG * 4 + carbsG * 4 + fatG * 9 - 2000)).toBeLessThanOrEqual(10);
  });

  it("단백질은 항상 체중 1kg당 1.6g 이상 (소수 몸무게는 올림)", () => {
    expect(calcMacros(2000, 60.3).proteinG).toBe(97); // 96.48 → 97
    expect(calcMacros(2000, 70).proteinG).toBe(112); // 소수 계산 오차로 113이 되면 안 됨
    for (const weight of [30, 45.5, 59.9, 61.1, 100, 250]) {
      expect(calcMacros(3000, weight).proteinG).toBeGreaterThanOrEqual(weight * 1.6);
    }
  });

  it("단백질이 칼로리를 다 차지해도 탄수화물·지방이 음수가 되지 않는다", () => {
    expect(calcMacros(1200, 250)).toEqual({ proteinG: 400, carbsG: 0, fatG: 0 });
  });
});

describe("권장량 한 번에 계산 (성공 기준 4: 6조합 모두 제시)", () => {
  for (const sex of SEX_VALUES) {
    for (const goal of GOAL_VALUES) {
      it(`${sex} / ${goal}`, () => {
        const targets = calcDailyTargets({ ...woman, sex, goal });
        expect(Number.isInteger(targets.kcal)).toBe(true);
        expect(targets.kcal).toBeGreaterThanOrEqual(minKcalFor(sex));
        expect(targets.proteinG).toBeGreaterThan(0);
        expect(targets.carbsG).toBeGreaterThan(0);
        expect(targets.fatG).toBeGreaterThan(0);
      });
    }
  }
});
