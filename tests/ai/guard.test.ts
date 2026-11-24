// Plan SC: 보안 점검 SEC-001 — 호출 횟수 제한(분·일)과 시간 경과 확인
import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, RATE_LIMITS, resetRateLimit } from "@/lib/ai/guard";

beforeEach(resetRateLimit);

describe("IP별 호출 횟수 제한", () => {
  it("1분 한도까지 허용하고 넘으면 막는다", () => {
    const t = 1_000_000;
    for (let i = 0; i < RATE_LIMITS.perMinute; i++) expect(checkRateLimit("ip", t + i)).toBeNull();
    expect(checkRateLimit("ip", t + 10)).toMatchObject({ status: 429, code: "TOO_MANY_REQUESTS" });
  });

  it("1분이 지나면 다시 허용한다", () => {
    const t = 1_000_000;
    for (let i = 0; i < RATE_LIMITS.perMinute; i++) checkRateLimit("ip", t);
    expect(checkRateLimit("ip", t + 61_000)).toBeNull();
  });

  it("하루 한도를 넘으면 막고, 하루가 지나면 다시 허용한다", () => {
    const t = 10_000_000;
    // 1분 한도에 걸리지 않게 2분 간격으로 하루 한도만큼 호출
    for (let i = 0; i < RATE_LIMITS.perDay; i++) expect(checkRateLimit("ip", t + i * 120_000)).toBeNull();
    const now = t + RATE_LIMITS.perDay * 120_000;
    expect(checkRateLimit("ip", now)).toMatchObject({ status: 429 });
    expect(checkRateLimit("ip", t + 24 * 60 * 60_000 + 1)).toBeNull();
  });

  it("IP마다 따로 센다", () => {
    for (let i = 0; i < RATE_LIMITS.perMinute; i++) checkRateLimit("a", 5);
    expect(checkRateLimit("b", 5)).toBeNull();
  });
});
