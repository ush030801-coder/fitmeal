// Design Ref: §1.2 설계 원칙 — 사용자 입력은 약속한 모양인지 먼저 검사하고 쓴다
// 숫자 항목(키·몸무게·시간 등)에 같은 방식으로 한국어 오류 문구를 붙이는 공통 도구
import { z } from "zod";
import type { Range } from "./limits";

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

type NumberFieldOptions = {
  unit?: string; // 범위 문구에 붙일 단위 (예: "cm", "kg", "분")
  integer?: boolean; // true면 정수만 받는다
};

// 예: numberField("키", { min: 120, max: 230 }, { unit: "cm" })
// 화면 입력칸에서 문자열로 넘어온 값은 호출하는 쪽에서 숫자로 바꿔 넘긴다.
export function numberField(
  label: string,
  range: Range,
  options: NumberFieldOptions = {},
) {
  const unit = options.unit ?? "";
  const rangeMessage = `${label}은(는) ${range.min}~${range.max}${unit} 사이로 입력해 주세요`;
  const base = z.number({
    error: (issue) =>
      isEmpty(issue.input)
        ? `${label}을(를) 입력해 주세요`
        : `${label}은(는) 숫자로 입력해 주세요`,
  });
  const withInteger = options.integer
    ? base.int(`${label}은(는) 정수로 입력해 주세요`)
    : base;
  return withInteger.min(range.min, rangeMessage).max(range.max, rangeMessage);
}
