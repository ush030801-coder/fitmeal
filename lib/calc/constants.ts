// Design Ref: §2.2 데이터 흐름 ① / PRD 5번 Must 1 규칙 — 계산에 쓰는 고정값을 한 곳에 모아 두기
// Plan SC: FR-01 기본 권장 칼로리·탄단지 (규칙을 바꾸려면 이 파일만 고친다)
import type { Goal, Sex } from "@/types";

// 목표별 칼로리 가감 (kcal): 체중 감량 −500, 근육 증가 +300, 체중 유지 ±0
export const GOAL_KCAL_ADJUST: Record<Goal, number> = {
  lose: -500,
  gain: 300,
  maintain: 0,
};

// 하루 총 섭취량 하한 (kcal): 어떤 경우에도 이 아래로 추천하지 않는다
export const MIN_KCAL_BY_SEX: Record<Sex, number> = {
  female: 1200,
  male: 1500,
};

// 단백질은 체중 1kg당 1.6g 이상 (모든 목표 공통)
export const PROTEIN_G_PER_KG = 1.6;

// 단백질을 먼저 정하고 남은 칼로리를 탄수화물 60% / 지방 40%로 나눈다
export const CARB_SHARE = 0.6;
export const FAT_SHARE = 0.4;

// 영양소 1g당 칼로리 (kcal)
export const KCAL_PER_G = { carbs: 4, protein: 4, fat: 9 } as const;
