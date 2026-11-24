// Plan SC: FR-02 / 성공 기준 3 — 운동 데이터와 소모 칼로리 계산 확인
import { describe, expect, it } from "vitest";
import {
  calcBurnedKcal,
  calcExerciseEntry,
  sumBurnedKcal,
} from "@/lib/calc/burned";
import { EXERCISES, getExerciseById, MET_TABLE_EDITION } from "@/data/exercises";

describe("소모 칼로리 계산 (MET × 체중 × 시간)", () => {
  it("MET 3.5, 60kg, 60분 → 210kcal", () => {
    expect(calcBurnedKcal(3.5, 60, 60)).toBe(210);
  });

  it("시간은 분 단위: 30분이면 절반", () => {
    expect(calcBurnedKcal(3.5, 60, 30)).toBe(105);
  });

  it("정수로 반올림해서 돌려준다 (8.3 × 70 × 45분 = 435.75 → 436)", () => {
    expect(calcBurnedKcal(8.3, 70, 45)).toBe(436);
    expect(calcBurnedKcal(3.5, 65, 1)).toBe(4); // 3.79 → 4
  });

  it("체중이 클수록, 시간이 길수록 더 많이 쓴다", () => {
    expect(calcBurnedKcal(5, 80, 30)).toBeGreaterThan(calcBurnedKcal(5, 60, 30));
    expect(calcBurnedKcal(5, 60, 60)).toBeGreaterThan(calcBurnedKcal(5, 60, 30));
  });
});

// 성공 기준 3: 운동·체중 조합 5개를 손계산한 값과 비교해 모두 ±10% 이내
describe("손계산 비교 5개 조합 (오차 ±10% 이내)", () => {
  // [운동 id, 체중(kg), 시간(분), 손계산한 소모 칼로리(kcal)]
  const cases: Array<[string, number, number, number]> = [
    ["e002", 50, 30, 95], // 걷기(보통) 3.8 × 50 × 0.5
    ["e004", 60, 30, 255], // 달리기 8.5 × 60 × 0.5
    ["e009", 70, 60, 476], // 자전거(보통) 6.8 × 70 × 1
    ["e010", 80, 45, 348], // 수영(가볍게) 5.8 × 80 × 0.75
    ["e012", 90, 40, 210], // 웨이트(여러 동작) 3.5 × 90 × 40/60
  ];

  it.each(cases)("%s / %ikg / %i분 → 손계산 %f", (id, weightKg, minutes, expected) => {
    const exercise = getExerciseById(id);
    expect(exercise).toBeDefined();
    const entry = calcExerciseEntry(exercise!, minutes, weightKg);
    expect(Math.abs(entry.kcal - expected) / expected).toBeLessThanOrEqual(0.1);
  });
});

describe("운동 1건 기록 만들기와 하루 합계", () => {
  it("운동 id·시간·소모 칼로리를 담는다", () => {
    const walking = getExerciseById("e002")!;
    expect(calcExerciseEntry(walking, 30, 60)).toEqual({
      exerciseId: "e002",
      minutes: 30,
      kcal: 114,
    });
  });

  it("하루 합계는 항목별 정수의 합이다", () => {
    const entries = [
      { exerciseId: "e002", minutes: 30, kcal: 114 },
      { exerciseId: "e004", minutes: 20, kcal: 170 },
    ];
    expect(sumBurnedKcal(entries)).toBe(284);
    expect(sumBurnedKcal([])).toBe(0);
  });
});

describe("내장 운동 데이터", () => {
  it("약 20가지이고 id·이름이 겹치지 않는다", () => {
    expect(EXERCISES).toHaveLength(20);
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(20);
    expect(new Set(EXERCISES.map((e) => e.name)).size).toBe(20);
  });

  it("모든 항목에 이름이 있고 MET가 현실적인 범위(1~20)에 있다", () => {
    for (const exercise of EXERCISES) {
      expect(exercise.name.trim().length).toBeGreaterThan(0);
      expect(exercise.met).toBeGreaterThanOrEqual(1);
      expect(exercise.met).toBeLessThanOrEqual(20);
    }
  });

  it("없는 id는 undefined", () => {
    expect(getExerciseById("e999")).toBeUndefined();
  });

  it("기준표는 2024 Adult Compendium이다", () => {
    expect(MET_TABLE_EDITION).toBe("2024");
  });

  // 공식 표(pacompendium.com)의 코드별 MET와 20개 모두 일치하는지 확인한다
  it("모든 MET 값이 2024 기준표 값과 일치한다", () => {
    const official = [2.8, 3.8, 5.5, 8.5, 9.3, 11.0, 6.0, 4.0, 6.8, 5.8, 9.8, 3.5, 6.0, 2.3, 2.8, 7.3, 11.8, 7.0, 6.0, 4.0];
    expect(EXERCISES.map((e) => e.met)).toEqual(official);
  });
});
