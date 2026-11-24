// Design Ref: §4.2 POST /api/menu 요청 — 허용 범위를 서버에서 다시 검사한다 (서버는 화면 값을 믿지 않는다)
// Plan SC: FR-06 — 이름·나이·키는 받지 않고, 식단 추천에 꼭 필요한 값만 받는다
import { z } from "zod";
import { MIN_KCAL_BY_SEX } from "@/lib/calc/constants";
import { WEIGHT_KG } from "@/lib/validation/limits";
import { ALLERGEN_IDS, GOAL_VALUES, SEX_VALUES, type Allergen, type Goal, type Sex } from "@/types";

export const MAX_TARGET_KCAL = 6000;

export const menuRequestSchema = z
  .object({
    sex: z.enum(SEX_VALUES),
    weightKg: z.number().min(WEIGHT_KG.min).max(WEIGHT_KG.max),
    goal: z.enum(GOAL_VALUES),
    targetKcal: z.number().min(1).max(MAX_TARGET_KCAL),
    allergies: z
      .array(z.enum(ALLERGEN_IDS))
      .max(ALLERGEN_IDS.length) // 알레르기 목록은 고정이라 이보다 많을 수 없다 (거대한 배열 방지)
      .transform((items) => [...new Set(items)]),
    adjustment: z.object({
      kind: z.enum(["over", "under", "none"]),
      appliedKcal: z.number().min(0).max(300),
      capped: z.boolean(),
      floorRaised: z.boolean(),
      noRecord: z.boolean(),
    }),
  })
  .superRefine((value, ctx) => {
    // 내일 목표는 성별 하한 이상이어야 한다 (이미 초과 차감·부족 보충이 끝난 값)
    if (value.targetKcal < MIN_KCAL_BY_SEX[value.sex]) {
      ctx.addIssue({
        code: "custom",
        path: ["targetKcal"],
        message: `내일 목표 칼로리는 ${MIN_KCAL_BY_SEX[value.sex]}kcal 이상이어야 합니다`,
      });
    }
  });

export type MenuRequest = {
  sex: Sex;
  weightKg: number;
  goal: Goal;
  targetKcal: number;
  allergies: Allergen[];
  adjustment: {
    kind: "over" | "under" | "none";
    appliedKcal: number;
    capped: boolean;
    floorRaised: boolean;
    noRecord: boolean;
  };
};

export type ParsedMenuRequest =
  | { ok: true; value: MenuRequest }
  | { ok: false; message: string };

// 요청 본문을 검사한다. 모르는 항목(이름·나이·키 등)은 조용히 버린다.
export function parseMenuRequest(input: unknown): ParsedMenuRequest {
  const parsed = menuRequestSchema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  const issue = parsed.error.issues[0];
  const field = issue.path.length > 0 ? issue.path.join(".") : "요청";
  return { ok: false, message: `${field} 값이 올바르지 않습니다` };
}
