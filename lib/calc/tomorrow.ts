// Design Ref: §2.2 ④ — 오늘 초과·부족분을 내일 목표 칼로리에 반영 / §4 adjustment 모양
// Plan SC: FR-05 — 내일 목표 = 기본 권장 − 초과 차감(최대 300) + 부족 보충(500 초과분, 최대 300), 하한 적용
import {
  MENU_TOLERANCE,
  OVER_DEDUCT_MAX_KCAL,
  UNDER_ADD_MAX_KCAL,
  UNDER_IGNORE_KCAL,
} from "./constants";

// 오늘 계산에서 가져오는 값 (lib/calc/today.ts의 TodayResult 일부와 같은 이름)
export type TomorrowInput = {
  baseKcal: number; // 기본 권장 칼로리 (운동 소모 미포함, 하한 적용 후)
  floorKcal: number; // 이 성별의 하한 (1,200 / 1,500)
  burnedKcal: number; // 오늘 운동 소모 칼로리
  intakeKcal: number; // 오늘 섭취 칼로리
  hasRecord: boolean; // 오늘 입력한 운동·음식이 하나라도 있는지
};

export type Adjustment = {
  kind: "over" | "under" | "none"; // 초과 차감 / 부족 보충 / 반영 없음
  appliedKcal: number; // 실제로 반영한 양 (0~300, 하한 때문에 줄었으면 그만큼 적다)
  capped: boolean; // 하루 최대 300kcal 한도에 걸려 일부만 반영했는지
  floorRaised: boolean; // 하한 때문에 목표를 올렸는지
  noRecord: boolean; // 오늘 기록이 없어 반영하지 않았는지
};

export type TomorrowTarget = {
  targetKcal: number; // 내일 목표 칼로리 (정수, 하한 적용 후)
  adjustment: Adjustment;
};

// 내일 목표 칼로리를 계산한다. 규칙이 부딪힐 때의 순서는 ① 하한 → ② 하루 최대 300kcal 조정 → ③ ±5%다.
export function calcTomorrowTarget(input: TomorrowInput): TomorrowTarget {
  const { baseKcal, floorKcal, burnedKcal, intakeKcal, hasRecord } = input;

  // 오늘 기록이 없으면 초과·부족을 따지지 않고 기본 권장 칼로리로 추천한다
  if (!hasRecord) {
    return {
      targetKcal: Math.max(baseKcal, floorKcal),
      adjustment: {
        kind: "none",
        appliedKcal: 0,
        capped: false,
        floorRaised: false,
        noRecord: true,
      },
    };
  }

  const compareKcal = baseKcal + burnedKcal; // 오늘의 비교 기준
  const delta = intakeKcal - compareKcal; // 양수면 초과, 음수면 부족

  let wanted = 0; // 부호 있는 조정량 (초과면 음수, 부족 보충이면 양수)
  let capped = false;
  if (delta > 0) {
    capped = delta > OVER_DEDUCT_MAX_KCAL;
    wanted = -Math.min(OVER_DEDUCT_MAX_KCAL, delta);
  } else if (-delta > UNDER_IGNORE_KCAL) {
    const need = -delta - UNDER_IGNORE_KCAL;
    capped = need > UNDER_ADD_MAX_KCAL;
    wanted = Math.min(UNDER_ADD_MAX_KCAL, need);
  }

  const rawTarget = baseKcal + wanted;
  const floorRaised = rawTarget < floorKcal; // 초과를 덜어내다 하한 아래로 내려가는 경우
  const targetKcal = floorRaised ? floorKcal : rawTarget;
  const applied = targetKcal - baseKcal;

  return {
    targetKcal,
    adjustment: {
      kind: applied < 0 ? "over" : applied > 0 ? "under" : "none",
      appliedKcal: Math.abs(applied),
      capped,
      floorRaised,
      noRecord: false,
    },
  };
}

// 식단 총합 허용 범위: [max(하한, 목표 × 0.95), 목표 × 1.05]. 하한이 ±5%보다 우선한다.
export function calcMenuRange(
  targetKcal: number,
  floorKcal: number,
): { minKcal: number; maxKcal: number } {
  return {
    minKcal: Math.max(floorKcal, targetKcal * (1 - MENU_TOLERANCE)),
    maxKcal: targetKcal * (1 + MENU_TOLERANCE),
  };
}
