// Design Ref: §7 보안 — /api/menu 남용 방지: 우리 화면에서 온 JSON 요청만 받고, IP별 호출 횟수를 제한한다
// Plan SC: 보안 점검 SEC-001 — 익명 반복 호출로 OpenAI 비용이 폭주하는 것을 줄인다
//
// 한계: 횟수 기록은 서버 메모리에 있어서, 배포 환경(서버리스)에서는 서버 인스턴스마다 따로 센다.
// 그래서 완전한 차단이 아니라 "기본 방어"다. 확실하게 막으려면 Vercel 방화벽의 요청 제한 규칙과
// OpenAI 월 예산 한도를 함께 설정한다 (PLAN 20번 배포 준비에서 정한다).

export type GuardFailure = {
  code: "UNSUPPORTED_MEDIA_TYPE" | "FORBIDDEN_ORIGIN" | "TOO_MANY_REQUESTS";
  status: number;
  message: string;
  retryAfterSec?: number;
};

// 1) JSON으로 보낸 요청인지, 2) 우리 사이트에서 보낸 요청인지 확인한다.
// 다른 사이트의 폼이 text/plain으로 몰래 보내는 요청과, 다른 사이트에서 온 요청을 거절한다.
export function checkRequestSource(request: Request): GuardFailure | null {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return { code: "UNSUPPORTED_MEDIA_TYPE", status: 415, message: "요청 형식이 올바르지 않습니다." };
  }

  const host = request.headers.get("host") ?? new URL(request.url).host;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return { code: "FORBIDDEN_ORIGIN", status: 403, message: "허용되지 않은 요청입니다." };
  }
  const origin = request.headers.get("origin");
  if (origin) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (originHost !== host) {
      return { code: "FORBIDDEN_ORIGIN", status: 403, message: "허용되지 않은 요청입니다." };
    }
  }
  return null;
}

// ── IP별 호출 횟수 제한 ─────────────────────────────────
export const RATE_LIMITS = {
  perMinute: 5,
  perDay: 40,
} as const;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const MAX_TRACKED_IPS = 5_000; // 메모리가 무한히 늘지 않게 한다

const hits = new Map<string, number[]>(); // IP → 최근 24시간 호출 시각

export function resetRateLimit() {
  hits.clear();
}

// 프록시 뒤에서는 x-forwarded-for의 첫 번째 값이 실제 접속자 IP다
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || "unknown";
}

// 허용되면 호출을 기록하고 null, 한도를 넘으면 실패 정보를 돌려준다
export function checkRateLimit(ip: string, now: number = Date.now()): GuardFailure | null {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < DAY_MS);

  const lastMinute = recent.filter((t) => now - t < MINUTE_MS);
  if (lastMinute.length >= RATE_LIMITS.perMinute) {
    const retry = Math.ceil((lastMinute[0] + MINUTE_MS - now) / 1000);
    return { code: "TOO_MANY_REQUESTS", status: 429, message: "요청이 너무 많습니다. 잠시 뒤에 다시 시도해 주세요.", retryAfterSec: Math.max(1, retry) };
  }
  if (recent.length >= RATE_LIMITS.perDay) {
    const retry = Math.ceil((recent[0] + DAY_MS - now) / 1000);
    return { code: "TOO_MANY_REQUESTS", status: 429, message: "오늘 쓸 수 있는 횟수를 모두 사용했습니다. 내일 다시 시도해 주세요.", retryAfterSec: Math.max(1, retry) };
  }

  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > MAX_TRACKED_IPS) {
    // 가장 오래 전에 들어온 IP부터 지운다 (Map은 넣은 순서를 기억한다)
    const oldest = hits.keys().next().value;
    if (oldest !== undefined && oldest !== ip) hits.delete(oldest);
  }
  return null;
}
