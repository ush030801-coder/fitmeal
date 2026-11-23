// Plan SC: PLAN 작업 2번 / FR-08 — 입력 범위 검증 경계값 확인 (임시 확인 스크립트를 정식 테스트로 옮긴 것)
import { describe, expect, it } from "vitest";
import {
  validateDailyExerciseTotal,
  validateDirectFood,
  validateExerciseMinutes,
  validateFoodAmount,
} from "@/lib/validation/entries";
import { validateProfile } from "@/lib/validation/profile";

const okProfile = {
  sex: "female",
  age: 30,
  heightCm: 165,
  weightKg: 60,
  activity: 1.375,
  goal: "lose",
  allergies: ["peanut", "peanut", "milk"],
};

describe("사용자 정보 검증", () => {
  it("정상 입력은 통과하고 알레르기 중복은 하나로 합친다", () => {
    const result = validateProfile(okProfile);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.allergies).toEqual(["peanut", "milk"]);
  });

  it("알레르기를 생략하면 빈 목록", () => {
    const result = validateProfile({ ...okProfile, allergies: undefined });
    expect(result.ok && result.value.allergies).toEqual([]);
  });

  it.each([
    [19, true],
    [100, true],
    [18, false],
    [101, false],
  ])("나이 %i → 통과 %s", (age, ok) => {
    expect(validateProfile({ ...okProfile, age }).ok).toBe(ok);
  });

  it("만 19세 미만은 일반 범위 오류가 아니라 이용 불가 안내", () => {
    const result = validateProfile({ ...okProfile, age: 18 });
    expect(!result.ok && result.errors[0].code).toBe("under_age");
    expect(!result.ok && result.errors[0].message).toContain("19세 미만");
  });

  it("101세는 범위 밖, 소수 나이는 형식 오류", () => {
    const over = validateProfile({ ...okProfile, age: 101 });
    expect(!over.ok && over.errors[0].code).toBe("out_of_range");
    const decimal = validateProfile({ ...okProfile, age: 30.5 });
    expect(!decimal.ok && decimal.errors[0].code).toBe("invalid");
  });

  it.each([
    ["heightCm", 120, 230],
    ["weightKg", 30, 250],
  ])("%s 경계: %i 이상 %i 이하", (key, min, max) => {
    expect(validateProfile({ ...okProfile, [key]: min }).ok).toBe(true);
    expect(validateProfile({ ...okProfile, [key]: max }).ok).toBe(true);
    expect(validateProfile({ ...okProfile, [key]: min - 0.1 }).ok).toBe(false);
    expect(validateProfile({ ...okProfile, [key]: max + 1 }).ok).toBe(false);
  });

  it("빈 객체는 모두 '필수 입력' 오류", () => {
    const result = validateProfile({});
    expect(!result.ok && result.errors.length).toBeGreaterThanOrEqual(6);
    expect(!result.ok && result.errors.every((e) => e.code === "required")).toBe(true);
  });

  it("문자열 숫자·NaN·Infinity·null은 거부", () => {
    const text = validateProfile({ ...okProfile, weightKg: "60" });
    expect(!text.ok && text.errors[0]).toMatchObject({ field: "weightKg", code: "invalid" });
    expect(validateProfile({ ...okProfile, weightKg: NaN }).ok).toBe(false);
    expect(validateProfile({ ...okProfile, heightCm: Infinity }).ok).toBe(false);
    expect(validateProfile(null).ok).toBe(false);
  });

  it("목록에 없는 성별·목표·활동량·알레르기는 항목마다 오류", () => {
    const result = validateProfile({
      ...okProfile,
      sex: "other",
      goal: "bulk",
      activity: 2,
      allergies: ["gluten"],
    });
    expect(!result.ok && result.errors.length).toBe(4);
  });
});

describe("운동 검증", () => {
  it.each([
    [1, true],
    [480, true],
    [0, false],
    [481, false],
    [-5, false],
    [30.5, false],
  ])("운동 %f분 → 통과 %s", (minutes, ok) => {
    expect(validateExerciseMinutes(minutes).ok).toBe(ok);
  });

  it("비어 있으면 '필수 입력'", () => {
    const result = validateExerciseMinutes(undefined);
    expect(!result.ok && result.errors[0].code).toBe("required");
  });

  it("하루 합계 480분(8시간)까지 통과, 481분은 실패", () => {
    expect(validateDailyExerciseTotal([240, 240]).ok).toBe(true);
    const over = validateDailyExerciseTotal([240, 241]);
    expect(!over.ok && over.errors[0].message).toContain("8시간");
    expect(!over.ok && over.errors[0].message).toContain("481");
    expect(validateDailyExerciseTotal([])).toEqual({ ok: true, value: 0 });
  });
});

describe("음식 검증", () => {
  it.each([
    ["serving", 0.1, true],
    ["serving", 10, true],
    ["serving", 0.09, false],
    ["serving", 10.1, false],
    ["g", 1, true],
    ["g", 2000, true],
    ["g", 0.5, false],
    ["g", 2001, false],
  ])("음식 양 단위 %s %f → 통과 %s", (unit, amount, ok) => {
    expect(validateFoodAmount({ unit, amount }).ok).toBe(ok);
  });

  it("단위가 목록에 없으면 단위 선택 안내, 양이 없으면 '필수 입력'", () => {
    const badUnit = validateFoodAmount({ unit: "cup", amount: 1 });
    expect(!badUnit.ok && badUnit.errors[0].field).toBe("unit");
    const noAmount = validateFoodAmount({ unit: "g" });
    expect(!noAmount.ok && noAmount.errors[0].code).toBe("required");
  });

  it("직접 입력 음식: 이름 앞뒤 공백을 지우고 통과", () => {
    const result = validateDirectFood({ name: "  엄마표 김치찌개  ", kcal: 320 });
    expect(result.ok && result.value.name).toBe("엄마표 김치찌개");
  });

  it.each([
    [1, true],
    [5000, true],
    [0, false],
    [5001, false],
  ])("직접 입력 칼로리 %i → 통과 %s", (kcal, ok) => {
    expect(validateDirectFood({ name: "a", kcal }).ok).toBe(ok);
  });

  it("이름이 공백뿐이거나 51자면 실패, 50자는 통과", () => {
    const blank = validateDirectFood({ name: "   ", kcal: 100 });
    expect(!blank.ok && blank.errors[0].field).toBe("name");
    expect(validateDirectFood({ name: "가".repeat(51), kcal: 100 }).ok).toBe(false);
    expect(validateDirectFood({ name: "가".repeat(50), kcal: 100 }).ok).toBe(true);
  });
});
