// Design Ref: §2.2 ① — 기본 권장 칼로리 계산 (운동 소모 미포함, 하한 적용)
// Plan SC: FR-01 / 성공 기준 4 — 목표 3 × 성별 2 = 6조합 모두 권장 칼로리를 제시한다
import type { Profile, Sex } from "@/types";
import { calcBmr } from "./bmr";
import { GOAL_KCAL_ADJUST, MIN_KCAL_BY_SEX } from "./constants";

export type RecommendedKcal = {
  kcal: number; // 최종 기본 권장 칼로리 (정수, 하한 적용 후)
  rawKcal: number; // 하한을 적용하기 전의 계산값 (반올림 안 함)
  floorKcal: number; // 이 성별의 하한
  floorRaised: boolean; // true면 계산값이 하한보다 낮아 하한으로 올렸다 → 화면에 알려야 한다
};

// 성별 하한 (여성 1,200kcal / 남성 1,500kcal)
export function minKcalFor(sex: Sex): number {
  return MIN_KCAL_BY_SEX[sex];
}

// 기본 권장 칼로리 = 기초대사량 × 활동량 계수 + 목표 가감, 그다음 하한 적용
export function calcRecommendedKcal(
  profile: Pick<
    Profile,
    "sex" | "age" | "heightCm" | "weightKg" | "activity" | "goal"
  >,
): RecommendedKcal {
  const rawKcal =
    calcBmr(profile) * profile.activity + GOAL_KCAL_ADJUST[profile.goal];
  const floorKcal = minKcalFor(profile.sex);
  const rounded = Math.round(rawKcal);
  const floorRaised = rounded < floorKcal;
  return {
    kcal: floorRaised ? floorKcal : rounded,
    rawKcal,
    floorKcal,
    floorRaised,
  };
}
