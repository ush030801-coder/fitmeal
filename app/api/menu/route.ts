// Design Ref: §4.2 POST /api/menu — 내일 식단 추천
// Plan SC: PLAN 작업 13번 / FR-06 — AI는 알레르기를 뺀 내장 목록에서만 고르고, 숫자는 서버가 계산한다
// 작업 14번: AI 식단을 서버에서 검증(허용 범위·하한·단백질·알레르기)하고 어긋나면 한 번 더 요청한다
import { buildNotes } from "@/lib/ai/menu";
import { recommendMenu } from "@/lib/ai/recommend";
import { parseMenuRequest } from "@/lib/ai/request";
import { minKcalFor } from "@/lib/calc/recommend";

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
    // AI 호출은 합쳐서 최대 2회. 규칙을 지킨 식단만 통과한다 (lib/ai/recommend.ts)
    const result = await recommendMenu(menuRequest);
    if (!result.ok) {
      if (result.reason === "misconfigured") return errorResponse("SERVER_MISCONFIGURED");
      if (result.reason === "unavailable") return errorResponse("AI_UNAVAILABLE");
      return errorResponse("MENU_RULE_VIOLATION");
    }
    const notes = buildNotes(menuRequest.adjustment, minKcalFor(menuRequest.sex));
    return Response.json({ meals: result.meals, totals: result.totals, notes });
  } catch {
    return errorResponse("INTERNAL_ERROR");
  }
}
