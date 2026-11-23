// Design Ref: §5.4 오늘 화면 — 운동 시간·음식 양·직접 입력 음식 범위 검증
// Plan SC: PLAN 작업 2번 / FR-08 — 범위를 벗어나거나 비어 있으면 계산하지 않고 이유를 알려 준다
import { z } from "zod";
import type { FoodUnit } from "@/types";
import { numberField } from "./fields";
import {
  DAILY_EXERCISE_MAX_MINUTES,
  DIRECT_FOOD_KCAL,
  DIRECT_FOOD_NAME_MAX_LENGTH,
  EXERCISE_MINUTES,
  FOOD_GRAMS,
  FOOD_SERVINGS,
} from "./limits";
import {
  failure,
  success,
  zodIssuesToErrors,
  type ValidationResult,
} from "./result";

// ── 운동 ─────────────────────────────────────────────

const exerciseMinutesSchema = z.object({
  minutes: numberField("운동 시간", EXERCISE_MINUTES, {
    unit: "분",
    integer: true,
  }),
});

// 운동 1건의 시간(분)을 검사한다. (1~480분, 정수)
export function validateExerciseMinutes(input: unknown): ValidationResult<number> {
  const raw = { minutes: input };
  const parsed = exerciseMinutesSchema.safeParse(raw);
  return parsed.success
    ? success(parsed.data.minutes)
    : failure(zodIssuesToErrors(parsed.error.issues, raw));
}

// 하루 운동 시간 합계(분)가 8시간(480분) 이하인지 검사한다.
// 각 운동은 validateExerciseMinutes를 먼저 통과한 값이라고 본다.
export function validateDailyExerciseTotal(
  minutesList: readonly number[],
): ValidationResult<number> {
  if (!minutesList.every((minutes) => Number.isFinite(minutes))) {
    return failure([
      {
        field: "totalMinutes",
        code: "invalid",
        message: "운동 시간은 숫자로 입력해 주세요",
      },
    ]);
  }
  const total = minutesList.reduce((sum, minutes) => sum + minutes, 0);
  if (total > DAILY_EXERCISE_MAX_MINUTES) {
    return failure([
      {
        field: "totalMinutes",
        code: "out_of_range",
        message: `하루 운동 시간 합계는 ${DAILY_EXERCISE_MAX_MINUTES / 60}시간 이하여야 합니다 (현재 ${total}분)`,
      },
    ]);
  }
  return success(total);
}

// ── 음식 ─────────────────────────────────────────────

const unitError = "양의 단위(인분 또는 g)를 선택해 주세요";

const foodAmountSchema = z.discriminatedUnion(
  "unit",
  [
    z.object({
      unit: z.literal("serving"),
      amount: numberField("음식 양", FOOD_SERVINGS, { unit: "인분" }),
    }),
    z.object({
      unit: z.literal("g"),
      amount: numberField("음식 양", FOOD_GRAMS, { unit: "g" }),
    }),
  ],
  { error: unitError },
);

export type FoodAmount = { unit: FoodUnit; amount: number };

// 음식 양을 검사한다. 단위는 "serving"(인분, 0.1~10) 또는 "g"(1~2,000)이다.
export function validateFoodAmount(input: unknown): ValidationResult<FoodAmount> {
  const parsed = foodAmountSchema.safeParse(input);
  if (parsed.success) return success(parsed.data);
  // 단위(unit)가 목록에 없으면 단위 선택 안내를 보여 준다
  const errors = zodIssuesToErrors(parsed.error.issues, input).map((error) =>
    error.field === "(전체)" || error.field === "unit"
      ? { field: "unit", code: "invalid" as const, message: unitError }
      : error,
  );
  return failure(errors);
}

const directFoodSchema = z.object({
  name: z
    .string({ error: "음식 이름을 입력해 주세요" })
    .min(1, "음식 이름을 입력해 주세요")
    .max(
      DIRECT_FOOD_NAME_MAX_LENGTH,
      `음식 이름은 ${DIRECT_FOOD_NAME_MAX_LENGTH}자 이하로 입력해 주세요`,
    ),
  kcal: numberField("칼로리", DIRECT_FOOD_KCAL, { unit: "kcal" }),
});

export type DirectFood = { name: string; kcal: number };

// 목록에 없어서 직접 입력한 음식(이름·칼로리)을 검사한다. 이름 앞뒤 공백은 지운다.
export function validateDirectFood(input: unknown): ValidationResult<DirectFood> {
  const raw =
    input !== null && typeof input === "object"
      ? {
          ...(input as Record<string, unknown>),
          name:
            typeof (input as Record<string, unknown>).name === "string"
              ? ((input as Record<string, unknown>).name as string).trim()
              : (input as Record<string, unknown>).name,
        }
      : input;
  const parsed = directFoodSchema.safeParse(raw);
  return parsed.success
    ? success(parsed.data)
    : failure(zodIssuesToErrors(parsed.error.issues, raw));
}
