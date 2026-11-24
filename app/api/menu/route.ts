// Design Ref: §4.2 POST /api/menu — 내일 식단 추천
// Plan SC: PLAN 작업 13번 / FR-06 — AI는 알레르기를 뺀 내장 목록에서만 고르고, 숫자는 서버가 계산한다
// 작업 14번: AI 식단을 서버에서 검증(허용 범위·하한·단백질·알레르기)하고 어긋나면 한 번 더 요청한다
import { checkRateLimit, checkRequestSource, clientIp, type GuardFailure } from "@/lib/ai/guard";
import { ADJUSTED_NOTE, buildNotes } from "@/lib/ai/menu";
import { recommendMenu } from "@/lib/ai/recommend";
import { parseMenuRequest } from "@/lib/ai/request";
import { minKcalFor } from "@/lib/calc/recommend";

// 요청 본문 최대 크기 (정상 요청은 약 300바이트라 넉넉하게 제한한다)
const MAX_BODY_BYTES = 10_000;

// 서버 로그: 운영자가 남용·장애·설정 오류를 알아챌 수 있게 코드와 횟수만 남긴다.
// 요청 본문(몸무게·알레르기 등)과 접속자 IP는 개인정보라 남기지 않는다.
function log(level: "info" | "warn" | "error", message: string) {
  console[level](`[api/menu] ${message}`);
}

type ErrorCode =
  | "INVALID_INPUT"
  | "MENU_RULE_VIOLATION"
  | "AI_UNAVAILABLE"
  | "SERVER_MISCONFIGURED"
  | "INTERNAL_ERROR"
  | "PAYLOAD_TOO_LARGE"
  | GuardFailure["code"];

const ERRORS: Record<ErrorCode, { status: number; message: string }> = {
  INVALID_INPUT: { status: 400, message: "입력한 정보를 확인해 주세요." },
  MENU_RULE_VIOLATION: { status: 422, message: "지금은 식단을 만들 수 없습니다." },
  AI_UNAVAILABLE: { status: 502, message: "지금은 식단을 만들 수 없습니다." },
  SERVER_MISCONFIGURED: { status: 500, message: "지금은 식단을 만들 수 없습니다." },
  INTERNAL_ERROR: { status: 500, message: "지금은 식단을 만들 수 없습니다." },
  PAYLOAD_TOO_LARGE: { status: 413, message: "요청이 너무 큽니다." },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, message: "요청 형식이 올바르지 않습니다." },
  FORBIDDEN_ORIGIN: { status: 403, message: "허용되지 않은 요청입니다." },
  TOO_MANY_REQUESTS: { status: 429, message: "요청이 너무 많습니다. 잠시 뒤에 다시 시도해 주세요." },
};

// 오류 응답은 모두 같은 모양이다: { error: { code, message } }
function errorResponse(code: ErrorCode, message?: string) {
  const { status, message: defaultMessage } = ERRORS[code];
  return Response.json({ error: { code, message: message ?? defaultMessage } }, { status });
}

// 막힌 요청의 응답 (횟수 제한이면 언제 다시 되는지도 알려 준다)
function guardResponse(failure: GuardFailure) {
  const response = errorResponse(failure.code, failure.message);
  if (failure.retryAfterSec) response.headers.set("Retry-After", String(failure.retryAfterSec));
  return response;
}

export async function POST(request: Request) {
  // AI를 부르기 전에 막는다: 우리 화면에서 온 JSON 요청인지, 이 IP가 너무 자주 부르지 않았는지
  const blocked = checkRequestSource(request) ?? checkRateLimit(clientIp(request));
  if (blocked) {
    log("warn", `blocked code=${blocked.code}`);
    return guardResponse(blocked);
  }

  // 본문 크기를 먼저 확인한다 (Content-Length가 없거나 거짓이어도 실제 글자 수로 다시 확인)
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    log("warn", "rejected code=PAYLOAD_TOO_LARGE");
    return errorResponse("PAYLOAD_TOO_LARGE");
  }
  let body: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
      log("warn", "rejected code=PAYLOAD_TOO_LARGE");
      return errorResponse("PAYLOAD_TOO_LARGE");
    }
    body = JSON.parse(text);
  } catch {
    log("info", "rejected code=INVALID_INPUT reason=json");
    return errorResponse("INVALID_INPUT");
  }

  const parsed = parseMenuRequest(body);
  if (!parsed.ok) {
    log("info", "rejected code=INVALID_INPUT reason=schema");
    return errorResponse("INVALID_INPUT", parsed.message);
  }
  const menuRequest = parsed.value;

  try {
    // AI 호출은 합쳐서 최대 2회. 규칙을 지킨 식단만 통과한다 (lib/ai/recommend.ts)
    const result = await recommendMenu(menuRequest);
    if (!result.ok) {
      log("error", `failed reason=${result.reason} aiCalls=${result.aiCalls}`);
      if (result.reason === "misconfigured") return errorResponse("SERVER_MISCONFIGURED");
      if (result.reason === "unavailable") return errorResponse("AI_UNAVAILABLE");
      return errorResponse("MENU_RULE_VIOLATION");
    }
    log("info", `ok aiCalls=${result.aiCalls} adjusted=${result.adjusted}`);
    const notes = buildNotes(menuRequest.adjustment, minKcalFor(menuRequest.sex));
    if (result.adjusted) notes.push(ADJUSTED_NOTE);
    return Response.json({ meals: result.meals, totals: result.totals, notes });
  } catch (error) {
    log("error", `unexpected error=${error instanceof Error ? error.name : "unknown"}`);
    return errorResponse("INTERNAL_ERROR");
  }
}
