// Plan SC: PRD Nice 1 — 주간 합계 = 저장된 일별 정수값의 합 (일별 기록의 합과 정확히 일치)
import { describe, expect, it } from "vitest";
import { calcWeeklySummary } from "@/lib/calc/weekly";
import type { DayRecord } from "@/types";

const day = (date: string, burnedKcal: number, intakeKcal: number, withEntries = true): DayRecord => ({
  date,
  exercises: withEntries && burnedKcal > 0 ? [{ exerciseId: "e001", minutes: 10, kcal: burnedKcal }] : [],
  foods: withEntries && intakeKcal > 0
    ? [{ foodId: null, name: "x", unit: "serving", amount: 1, kcal: intakeKcal, carbs: 0, protein: 0, fat: 0, estimated: true }]
    : [],
  burnedKcal,
  intakeKcal,
  proteinG: 0,
});

describe("주간 요약", () => {
  it("오늘 포함 7일을 오래된 날부터 돌려준다 (월 경계 포함)", () => {
    const s = calcWeeklySummary({}, "2026-03-03");
    expect(s.days.map((d) => d.date)).toEqual([
      "2026-02-25", "2026-02-26", "2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02", "2026-03-03",
    ]);
  });

  it("기록이 없으면 모두 0이고 기록한 날은 0일", () => {
    expect(calcWeeklySummary({}, "2026-03-03")).toMatchObject({ recordedDays: 0, totalBurnedKcal: 0, totalIntakeKcal: 0 });
  });

  it("합계는 일별 정수값의 합과 정확히 같다", () => {
    const records = {
      "2026-03-01": day("2026-03-01", 211, 1893),
      "2026-03-02": day("2026-03-02", 0, 2104),
      "2026-03-03": day("2026-03-03", 349, 1777),
    };
    const s = calcWeeklySummary(records, "2026-03-03");
    expect(s.totalBurnedKcal).toBe(211 + 0 + 349);
    expect(s.totalIntakeKcal).toBe(1893 + 2104 + 1777);
    expect(s.totalBurnedKcal).toBe(s.days.reduce((a, d) => a + d.burnedKcal, 0));
    expect(s.recordedDays).toBe(3);
  });

  it("7일보다 오래된 기록은 합계에 넣지 않는다", () => {
    const s = calcWeeklySummary({ "2026-02-24": day("2026-02-24", 500, 500) }, "2026-03-03");
    expect(s.totalIntakeKcal).toBe(0);
  });

  it("항목이 없는 날은 기록 없음으로 본다", () => {
    const s = calcWeeklySummary({ "2026-03-03": day("2026-03-03", 0, 0, false) }, "2026-03-03");
    expect(s.days[6].hasRecord).toBe(false);
    expect(s.recordedDays).toBe(0);
  });
});
