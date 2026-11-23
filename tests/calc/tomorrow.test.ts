// Plan SC: FR-05 / PLAN 작업 12번 — 내일 목표 칼로리 반영 규칙의 경계값 확인
import { describe, expect, it } from "vitest";
import { calcMenuRange, calcTomorrowTarget } from "@/lib/calc/tomorrow";

// 기본 권장 1,800 / 하한 1,200 / 운동 소모 없음에서 섭취만 바꿔 본다
const base = { baseKcal: 1800, floorKcal: 1200, burnedKcal: 0, hasRecord: true };
const withIntake = (intakeKcal: number, extra = {}) =>
  calcTomorrowTarget({ ...base, intakeKcal, ...extra });

describe("초과분: 최대 300kcal까지 덜어낸다", () => {
  it("딱 맞으면(초과 0) 반영 없음", () => {
    expect(withIntake(1800)).toEqual({
      targetKcal: 1800,
      adjustment: { kind: "none", appliedKcal: 0, capped: false, floorRaised: false, noRecord: false },
    });
  });

  it("1kcal 초과 → 1kcal 차감", () => {
    expect(withIntake(1801)).toMatchObject({ targetKcal: 1799, adjustment: { kind: "over", appliedKcal: 1, capped: false } });
  });

  it("250 초과 → 250 차감 (한도 안)", () => {
    expect(withIntake(2050)).toMatchObject({ targetKcal: 1550, adjustment: { kind: "over", appliedKcal: 250, capped: false } });
  });

  it("정확히 300 초과 → 300 차감, 한도에 걸린 것은 아님", () => {
    expect(withIntake(2100)).toMatchObject({ targetKcal: 1500, adjustment: { appliedKcal: 300, capped: false } });
  });

  it("301 초과 → 300만 차감, 한도에 걸림", () => {
    expect(withIntake(2101)).toMatchObject({ targetKcal: 1500, adjustment: { appliedKcal: 300, capped: true } });
  });

  it("많이 초과해도 300까지만", () => {
    expect(withIntake(4000)).toMatchObject({ targetKcal: 1500, adjustment: { kind: "over", appliedKcal: 300, capped: true } });
  });
});

describe("부족분: 500 이하는 따지지 않고, 넘을 때만 (부족분 − 500)을 최대 300까지 더한다", () => {
  it("부족 100, 499, 500 → 반영 없음", () => {
    for (const intake of [1700, 1301, 1300]) {
      expect(withIntake(intake)).toMatchObject({ targetKcal: 1800, adjustment: { kind: "none", appliedKcal: 0 } });
    }
  });

  it("부족 501 → 1kcal 보충", () => {
    expect(withIntake(1299)).toMatchObject({ targetKcal: 1801, adjustment: { kind: "under", appliedKcal: 1, capped: false } });
  });

  it("부족 800 → 300 보충, 한도에 걸린 것은 아님", () => {
    expect(withIntake(1000)).toMatchObject({ targetKcal: 2100, adjustment: { appliedKcal: 300, capped: false } });
  });

  it("부족 801 → 300만 보충, 한도에 걸림", () => {
    expect(withIntake(999)).toMatchObject({ targetKcal: 2100, adjustment: { appliedKcal: 300, capped: true } });
  });

  it("아무것도 안 먹은 날도 300까지만", () => {
    expect(withIntake(0)).toMatchObject({ targetKcal: 2100, adjustment: { kind: "under", appliedKcal: 300, capped: true } });
  });
});

describe("운동 소모는 오늘의 비교 기준에만 들어가고 내일 목표에는 들어가지 않는다", () => {
  it("비교 기준 = 1,800 + 400 = 2,200. 섭취 2,300이면 초과 100", () => {
    expect(withIntake(2300, { burnedKcal: 400 })).toMatchObject({ targetKcal: 1700, adjustment: { kind: "over", appliedKcal: 100 } });
  });

  it("같은 섭취라도 운동을 하면 초과가 아니라 부족이 될 수 있다", () => {
    expect(withIntake(2050, { burnedKcal: 400 })).toMatchObject({ targetKcal: 1800, adjustment: { kind: "none" } });
  });
});

describe("오늘 기록이 없으면 기본 권장 칼로리 그대로", () => {
  it("기록 없음 → 반영 없음, noRecord 표시", () => {
    expect(withIntake(0, { hasRecord: false })).toEqual({
      targetKcal: 1800,
      adjustment: { kind: "none", appliedKcal: 0, capped: false, floorRaised: false, noRecord: true },
    });
  });
});

describe("하한이 300 조정보다 우선한다", () => {
  it("기본 1,350에서 300 초과 → 1,050이 아니라 하한 1,200, 실제로는 150만 차감", () => {
    expect(withIntake(1650, { baseKcal: 1350 })).toMatchObject({
      targetKcal: 1200,
      adjustment: { kind: "over", appliedKcal: 150, capped: false, floorRaised: true },
    });
  });

  it("기본이 이미 하한이면 초과해도 내리지 않는다", () => {
    expect(withIntake(1700, { baseKcal: 1200 })).toMatchObject({
      targetKcal: 1200,
      adjustment: { kind: "none", appliedKcal: 0, capped: true, floorRaised: true },
    });
  });

  it("남성 하한 1,500도 적용된다", () => {
    expect(withIntake(2000, { baseKcal: 1600, floorKcal: 1500 })).toMatchObject({
      targetKcal: 1500,
      adjustment: { appliedKcal: 100, floorRaised: true },
    });
  });

  it("하한에 걸리지 않으면 floorRaised는 거짓", () => {
    expect(withIntake(2000).adjustment.floorRaised).toBe(false);
  });
});

describe("식단 총합 허용 범위: [max(하한, 목표×0.95), 목표×1.05]", () => {
  it("하한보다 높은 목표는 ±5%", () => {
    const range = calcMenuRange(1300, 1200);
    expect(range.minKcal).toBeCloseTo(1235, 6);
    expect(range.maxKcal).toBeCloseTo(1365, 6);
  });

  it("목표가 하한이면 아래쪽은 하한이 우선이다", () => {
    const range = calcMenuRange(1200, 1200);
    expect(range.minKcal).toBe(1200);
    expect(range.maxKcal).toBeCloseTo(1260, 6);
  });

  it("남성 하한 1,500", () => {
    expect(calcMenuRange(1500, 1500).minKcal).toBe(1500);
    expect(calcMenuRange(2000, 1500).minKcal).toBeCloseTo(1900, 6);
  });
});
