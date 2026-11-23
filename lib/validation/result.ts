// Design Ref: §6 오류 처리 — 입력이 틀리면 "계산하지 않고 이유를 알려 다시 입력받는다"
// 모든 검증 함수는 같은 모양의 결과를 돌려줘서 화면이 한 방식으로 오류를 보여줄 수 있다.
import type { z } from "zod";

// required: 비어 있음 / invalid: 형식이 틀림 / out_of_range: 범위 밖 / under_age: 만 19세 미만
export type FieldErrorCode = "required" | "invalid" | "out_of_range" | "under_age";

export type FieldError = {
  field: string; // 오류가 난 항목 이름 (예: "age", "allergies.1")
  code: FieldErrorCode;
  message: string; // 사용자에게 그대로 보여줄 한국어 문구
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldError[] };

export function success<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

export function failure<T>(errors: FieldError[]): ValidationResult<T> {
  return { ok: false, errors };
}

// 원본 입력에서 경로(path)에 해당하는 값을 꺼낸다 (없으면 undefined)
function getAtPath(raw: unknown, path: ReadonlyArray<PropertyKey>): unknown {
  let current: unknown = raw;
  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<PropertyKey, unknown>)[key];
  }
  return current;
}

// zod가 찾은 문제들을 화면에서 쓰기 쉬운 FieldError 목록으로 바꾼다
export function zodIssuesToErrors(
  issues: ReadonlyArray<z.core.$ZodIssue>,
  raw: unknown,
): FieldError[] {
  return issues.map((issue) => {
    const rawValue = getAtPath(raw, issue.path);
    let code: FieldErrorCode;
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      code = "required";
    } else if (issue.code === "too_small" || issue.code === "too_big") {
      code = "out_of_range";
    } else {
      code = "invalid";
    }
    return {
      field: issue.path.length > 0 ? issue.path.map(String).join(".") : "(전체)",
      code,
      message: issue.message,
    };
  });
}
