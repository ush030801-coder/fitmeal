// Design Ref: §2.2 ② — 소모 칼로리 = MET × 체중(kg) × 시간(h)
// Plan SC: FR-02 / 성공 기준 3 — 오차 ±10% 이내 (같은 공식을 쓰므로 반올림 오차만 남는다)
import type { Exercise, ExerciseEntry } from "@/types";

// 운동 1건의 소모 칼로리(정수 kcal). 시간은 분 단위로 받아서 시간(h)으로 바꿔 계산한다.
// 입력 범위(1~480분, 몸무게 30~250kg)는 lib/validation에서 먼저 확인한 값이라고 본다.
export function calcBurnedKcal(
  met: number,
  weightKg: number,
  minutes: number,
): number {
  // 곱한 뒤 마지막에 60으로 나눠서 소수 계산 오차를 줄인다
  return Math.round((met * weightKg * minutes) / 60);
}

// 고른 운동과 시간으로 "오늘 기록에 저장할 운동 1건"을 만든다
export function calcExerciseEntry(
  exercise: Exercise,
  minutes: number,
  weightKg: number,
): ExerciseEntry {
  return {
    exerciseId: exercise.id,
    minutes,
    kcal: calcBurnedKcal(exercise.met, weightKg, minutes),
  };
}

// 하루 운동 소모 칼로리 합계. 각 항목이 이미 정수라서 합계도 정수의 합이다.
export function sumBurnedKcal(entries: readonly ExerciseEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.kcal, 0);
}
