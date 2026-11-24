// Design Ref: §4.2 POST /api/menu — 내일 식단 추천
// Plan SC: PLAN 작업 13번 / FR-06 — AI는 알레르기를 뺀 내장 목록에서만 고르고, 숫자는 서버가 계산한다
// (허용 범위·단백질 검증과 재요청은 작업 14번에서 이 흐름에 붙인다)
import { FOODS } from "@/data/foods";
import { AiMisconfiguredError, AiUnavailableError, requestMenuText } from "@/lib/ai/client";
import { buildMenu, buildNotes, parseAiMenu } from "@/lib/ai/menu";
import { buildCandidates, buildMessages, menuTargets } from "@/lib/ai/prompt";
import { parseMenuRequest } from "@/lib/ai/request";

type ErrorCode =
  | "INVALID_INPUT"
  | "MENU_RULE_VIOLATION"
  | "AI_UNAVAILABLE"
  | "SERVER_MISCONFIGURED"
  | "INTERNAL_ERROR";

const ERRORS: Record<ErrorCode, { status: number; message: string }> = {
  INVALID_INPUT: { status: 400, message: "입력한 정보를 확인해 주세요." },
  MENU_RULE_VIOLATION: { status: 422, message: "지금은 식단을 만들 수 없습니다." },
  AI_UNAVAILABLE: { status: 502, message: "지금은 식단을 만들 수 없습니다." },
  SERVER_MISCONFIGURED: { status: 500, message: "지금은 식단을 만들 수 없습니다." },
  INTERNAL_ERROR: { status: 500, message: "지금은 식단을 만들 수 없습니다." },
};

// 오류 응답은 모두 같은 모양이다: { error: { code, message } }
function errorResponse(code: ErrorCode, message?: string) {
  const { status, message: defaultMessage } = ERRORS[code];
  return Response.json({ error: { code, message: message ?? defaultMessage } }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_INPUT");
  }

  const parsed = parseMenuRequest(body);
  if (!parsed.ok) return errorResponse("INVALID_INPUT", parsed.message);
  const menuRequest = parsed.value;

  try {
    const candidates = buildCandidates(menuRequest.allergies);
    const text = await requestMenuText(buildMessages(menuRequest, candidates));

    const result = parseAiMenu(text, new Set(candidates.map((food) => food.id)));
    if (!result.ok) return errorResponse("MENU_RULE_VIOLATION");

    const foodsById = new Map(FOODS.map((food) => [food.id, food]));
    const { meals, totals } = buildMenu(result.menu, foodsById);
    const notes = buildNotes(menuRequest.adjustment, menuTargets(menuRequest).floorKcal);
    return Response.json({ meals, totals, notes });
  } catch (error) {
    if (error instanceof AiMisconfiguredError) return errorResponse("SERVER_MISCONFIGURED");
    if (error instanceof AiUnavailableError) return errorResponse("AI_UNAVAILABLE");
    return errorResponse("INTERNAL_ERROR");
  }
}
