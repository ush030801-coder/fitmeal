// Design Ref: §3.1 Profile, §5.4 내 정보 화면 — 사용자 정보 입력 범위 검증
// Plan SC: PLAN 작업 2번 / FR-08 — 범위를 벗어나거나 비어 있으면 계산하지 않고 이유를 알려 준다
import { z } from "zod";
import {
  ACTIVITY_LEVELS,
  ALLERGEN_IDS,
  GOAL_VALUES,
  SEX_VALUES,
  type Profile,
} from "@/types";
import { numberField } from "./fields";
import { AGE_YEARS, HEIGHT_CM, WEIGHT_KG } from "./limits";
import {
  failure,
  success,
  zodIssuesToErrors,
  type FieldError,
  type ValidationResult,
} from "./result";

export const UNDER_AGE_MESSAGE = "만 19세 미만은 이용할 수 없습니다.";

const profileSchema = z.object(
  {
    sex: z.enum(SEX_VALUES, { error: "성별을 선택해 주세요" }),
    age: numberField("나이", AGE_YEARS, { unit: "세", integer: true }),
    heightCm: numberField("키", HEIGHT_CM, { unit: "cm" }),
    weightKg: numberField("몸무게", WEIGHT_KG, { unit: "kg" }),
    activity: z.literal([...ACTIVITY_LEVELS], {
      error: "평소 활동량을 선택해 주세요",
    }),
    goal: z.enum(GOAL_VALUES, { error: "운동 목표를 선택해 주세요" }),
    // 알레르기는 고정 목록에서만 고른다. 비워 두면 "없음"이고, 같은 항목은 한 번만 남긴다.
    allergies: z
      .array(
        z.enum(ALLERGEN_IDS, { error: "알레르기 목록에 없는 항목입니다" }),
        { error: "알레르기는 목록에서 골라 주세요" },
      )
      .default([])
      .transform((items) => [...new Set(items)]),
  },
  { error: "입력 값이 올바르지 않습니다" },
);

// 만 19세 미만이면 일반 범위 오류가 아니라 "이용 불가" 안내로 바꿔 준다
function markUnderAge(errors: FieldError[], raw: unknown): FieldError[] {
  const rawAge =
    raw !== null && typeof raw === "object"
      ? (raw as Record<string, unknown>).age
      : undefined;
  const isUnderAge = typeof rawAge === "number" && rawAge < AGE_YEARS.min;
  return errors.map((error) =>
    error.field === "age" && error.code === "out_of_range" && isUnderAge
      ? { field: "age", code: "under_age", message: UNDER_AGE_MESSAGE }
      : error,
  );
}

// 사용자 정보를 검사한다. 통과하면 정리된 Profile을, 틀리면 항목별 오류 목록을 돌려준다.
export function validateProfile(input: unknown): ValidationResult<Profile> {
  const parsed = profileSchema.safeParse(input);
  if (parsed.success) return success(parsed.data);
  return failure(markUnderAge(zodIssuesToErrors(parsed.error.issues, input), input));
}
