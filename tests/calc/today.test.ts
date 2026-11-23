// Plan SC: FR-04 / PLAN 작업 11번 — 오늘 결과(비교 기준·초과·부족) 계산 확인
import { describe, expect, it } from "vitest";
import { calcDailyTargets } from "@/lib/calc/targets";
import { calcTodayResult } from "@/lib/calc/today";
import { buildDayRecord, emptyDay } from "@/lib/storage/records";
import type { ExerciseEntry, FoodEntry, Profile } from "@/types";

const profile: Profile = {
  sex: "female", age: 30, heightCm: 165, weightKg: 58.5,
  activity: 1.375, goal: "lose", allergies: [],
};
const base = calcDailyTargets(profile).kcal; // 1295

const run: ExerciseEntry = { exerciseId: "e004", minutes: 60, kcal: 486 };
const food = (kcal: number, protein = 0): FoodEntry => ({
  foodId: "f001", name: "테스트", unit: "serving", amount: 1,
  kcal, carbs: 0, protein, fat: 0, estimated: false,
});

describe("오늘 결과", () => {
  it("비교 기준 = 기본 권장 + 운동 소모", () => {
    const result = calcTodayResult(profile, buildDayRecord("2026-11-24", [run], []));
    expect(result.baseKcal).toBe(base);
    expect(result.burnedKcal).toBe(486);
    expect(result.compareKcal).toBe(base + 486);
  });

  it("섭취가 비교 기준보다 많으면 초과", () => {
    const result = calcTodayResult(profile, buildDayRecord("2026-11-24", [], [food(base + 250)]));
    expect(result).toMatchObject({ status: "over", diffKcal: 250, intakeKcal: base + 250 });
  });

  it("운동 소모만큼 비교 기준이 올라가서 초과가 줄어든다", () => {
    const result = calcTodayResult(profile, buildDayRecord("2026-11-24", [run], [food(base + 250)]));
    expect(result).toMatchObject({ status: "under", diffKcal: 486 - 250 });
  });

  it("섭취가 적으면 부족, 같으면 정확히 맞음", () => {
    expect(calcTodayResult(profile, buildDayRecord("d", [], [food(base - 100)]))).toMatchObject({
      status: "under", diffKcal: 100,
    });
    expect(calcTodayResult(profile, buildDayRecord("d", [], [food(base)]))).toMatchObject({
      status: "even", diffKcal: 0,
    });
  });

  it("기록이 하나도 없으면 hasRecord가 거짓이고 전부 부족으로 계산된다", () => {
    const result = calcTodayResult(profile, emptyDay("2026-11-24"));
    expect(result).toMatchObject({ hasRecord: false, status: "under", diffKcal: base });
  });

  it("단백질 권장량과 섭취량을 함께 돌려준다 (58.5kg → 94g)", () => {
    const result = calcTodayResult(profile, buildDayRecord("d", [], [food(300, 20.5)]));
    expect(result).toMatchObject({ proteinTargetG: 94, proteinG: 20.5, hasRecord: true });
  });

  it("하한으로 올린 경우를 알려 준다", () => {
    const small: Profile = { ...profile, weightKg: 40, heightCm: 150, age: 60, activity: 1.2 };
    const result = calcTodayResult(small, emptyDay("d"));
    expect(result.floorRaised).toBe(true);
    expect(result.baseKcal).toBe(result.floorKcal);
  });
});
