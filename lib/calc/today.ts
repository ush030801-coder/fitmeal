// Design Ref: §2.2 ③ — 오늘의 비교 기준과 섭취를 견줘 초과·부족을 구한다
// Plan SC: FR-04 — 오늘의 비교 기준 = 기본 권장 칼로리 + 그날 운동 소모 칼로리
import type { DayRecord, Profile } from "@/types";
import { calcDailyTargets } from "./targets";

export type TodayStatus = "over" | "under" | "even";

export type TodayResult = {
  baseKcal: number; // 기본 권장 칼로리 (운동 소모 미포함, 하한 적용 후)
  floorRaised: boolean; // 계산값이 하한보다 낮아 하한으로 올렸는지
  floorKcal: number;
  burnedKcal: number; // 오늘 운동 소모 칼로리
  compareKcal: number; // 오늘의 비교 기준 = baseKcal + burnedKcal
  intakeKcal: number; // 오늘 섭취 칼로리
  diffKcal: number; // 초과 또는 부족한 양 (항상 0 이상)
  status: TodayStatus; // 섭취가 비교 기준보다 많으면 over, 적으면 under, 같으면 even
  hasRecord: boolean; // 오늘 입력한 운동·음식이 하나라도 있는지
  proteinTargetG: number; // 하루 단백질 권장 그램
  proteinG: number; // 오늘 섭취한 단백질 그램
};

// 오늘 기록과 사용자 정보로 오늘 결과를 계산한다. 칼로리는 모두 정수다.
export function calcTodayResult(profile: Profile, day: DayRecord): TodayResult {
  const targets = calcDailyTargets(profile);
  const compareKcal = targets.kcal + day.burnedKcal;
  const delta = day.intakeKcal - compareKcal;
  return {
    baseKcal: targets.kcal,
    floorRaised: targets.floorRaised,
    floorKcal: targets.floorKcal,
    burnedKcal: day.burnedKcal,
    compareKcal,
    intakeKcal: day.intakeKcal,
    diffKcal: Math.abs(delta),
    status: delta > 0 ? "over" : delta < 0 ? "under" : "even",
    hasRecord: day.exercises.length > 0 || day.foods.length > 0,
    proteinTargetG: targets.proteinG,
    proteinG: day.proteinG,
  };
}
