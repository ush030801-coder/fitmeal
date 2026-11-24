// Plan SC: FR-06 / PLAN 작업 13·14번 — /api/menu 라우트 확인 (실제 AI는 부르지 않고 가짜로 대신한다)
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, requestMenuText: vi.fn() };
});

import { POST } from "@/app/api/menu/route";
import { AiMisconfiguredError, AiUnavailableError, requestMenuText } from "@/lib/ai/client";
import { FOODS } from "@/data/foods";
import { RATE_LIMITS, resetRateLimit } from "@/lib/ai/guard";

const mockedAi = vi.mocked(requestMenuText);

const body = {
  sex: "female", weightKg: 60, goal: "lose", targetKcal: 1650, allergies: ["egg"],
  adjustment: { kind: "over", appliedKcal: 250, capped: false, floorRaised: false, noRecord: false },
};
const call = (payload: unknown, headers: Record<string, string> = {}) =>
  POST(new Request("http://localhost/api/menu", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  }));

const meal = (type: string, ...items: [string, number][]) => ({
  type, items: items.map(([foodId, servings]) => ({ foodId, servings })),
});
// 합계 1,577kcal · 단백질 135.4g: 목표 1,650 허용 범위(1,568~1,732)와 단백질(96g 이상)을 지킨다
const goodAnswer = JSON.stringify({
  meals: [
    meal("breakfast", ["f003", 1], ["f017", 1], ["f059", 1]),
    meal("lunch", ["f014", 1], ["f058", 1]),
    meal("dinner", ["f044", 3], ["f060", 1]),
  ],
});
// 합계가 너무 낮은 답변 (규칙 위반)
const lowAnswer = JSON.stringify({
  meals: [meal("breakfast", ["f001", 1]), meal("lunch", ["f001", 1]), meal("dinner", ["f001", 1])],
});

afterEach(() => {
  mockedAi.mockReset();
  resetRateLimit();
});

describe("POST /api/menu 남용 방지", () => {
  it("JSON이 아닌 형식(text/plain 등)은 AI를 부르지 않고 415", async () => {
    const res = await call(body, { "Content-Type": "text/plain" });
    expect(res.status).toBe(415);
    expect((await res.json()).error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(mockedAi).not.toHaveBeenCalled();
  });

  it("다른 사이트에서 온 요청(Origin·Sec-Fetch-Site)은 403", async () => {
    expect((await call(body, { Origin: "https://evil.example", Host: "localhost" })).status).toBe(403);
    expect((await call(body, { "Sec-Fetch-Site": "cross-site" })).status).toBe(403);
    expect(mockedAi).not.toHaveBeenCalled();
  });

  it("본문이 너무 크면 AI를 부르지 않고 413", async () => {
    const res = await call({ ...body, padding: "x".repeat(20_000) });
    expect(res.status).toBe(413);
    expect(mockedAi).not.toHaveBeenCalled();
  });

  it("알레르기 배열이 비정상적으로 길면 400", async () => {
    const res = await call({ ...body, allergies: Array(500).fill("egg") });
    expect(res.status).toBe(400);
    expect(mockedAi).not.toHaveBeenCalled();
  });

  it("같은 사이트에서 온 요청은 통과한다", async () => {
    mockedAi.mockResolvedValue(goodAnswer);
    const res = await call(body, { Origin: "http://localhost", Host: "localhost", "Sec-Fetch-Site": "same-origin" });
    expect(res.status).toBe(200);
  });

  it("같은 IP가 1분에 한도를 넘으면 429와 Retry-After, AI는 한도까지만 부른다", async () => {
    mockedAi.mockResolvedValue(goodAnswer);
    for (let i = 0; i < RATE_LIMITS.perMinute; i++) {
      expect((await call(body, { "x-forwarded-for": "1.2.3.4" })).status).toBe(200);
    }
    const res = await call(body, { "x-forwarded-for": "1.2.3.4" });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await res.json()).error.code).toBe("TOO_MANY_REQUESTS");
    expect(mockedAi).toHaveBeenCalledTimes(RATE_LIMITS.perMinute);
    // 다른 IP는 영향 없다
    expect((await call(body, { "x-forwarded-for": "5.6.7.8" })).status).toBe(200);
  });
});

describe("POST /api/menu", () => {
  it("정상: 3끼와 합계, 서버가 만든 안내 문구를 돌려준다 (AI 1회)", async () => {
    mockedAi.mockResolvedValue(goodAnswer);
    const res = await call(body);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.meals.map((m: { type: string }) => m.type)).toEqual(["breakfast", "lunch", "dinner"]);
    expect(json.totals.kcal).toBe(1577);
    expect(json.notes).toEqual(["오늘 초과분 250kcal를 내일 목표에서 덜어냈습니다."]);
    expect(mockedAi).toHaveBeenCalledTimes(1);
  });

  it("AI에게 보낸 메시지에 알레르기 음식이 없다", async () => {
    mockedAi.mockResolvedValue(goodAnswer);
    await call(body);
    const sent = mockedAi.mock.calls[0][0].map((m) => m.content).join("\n");
    expect(sent).not.toContain("삶은 계란");
    expect(sent).not.toContain("OPENAI");
  });

  it("잘못된 요청은 AI를 부르지 않고 400", async () => {
    for (const payload of ["깨진 json{", { ...body, weightKg: 5 }, { ...body, allergies: ["sesame"] }]) {
      const res = await call(payload);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("INVALID_INPUT");
    }
    expect(mockedAi).not.toHaveBeenCalled();
  });

  it("처음 답변이 규칙 위반이어도 다시 요청해서 통과하면 200 (AI 2회)", async () => {
    mockedAi.mockResolvedValueOnce(lowAnswer).mockResolvedValueOnce(goodAnswer);
    const res = await call(body);
    expect(res.status).toBe(200);
    expect(mockedAi).toHaveBeenCalledTimes(2);
  });

  it("다시 요청해도 위반이면 규칙 위반 식단은 보여주지 않고 422 (AI는 2회까지만)", async () => {
    mockedAi.mockResolvedValue(lowAnswer);
    const res = await call(body);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe("MENU_RULE_VIOLATION");
    expect(json.meals).toBeUndefined();
    expect(mockedAi).toHaveBeenCalledTimes(2);
  });

  it("AI가 알레르기로 뺀 음식을 넣으면 거절하고 다시 요청한다", async () => {
    const eggId = FOODS.find((f) => f.name === "삶은 계란")!.id;
    const withEgg = JSON.stringify({
      meals: [meal("breakfast", [eggId, 1]), meal("lunch", ["f001", 1]), meal("dinner", ["f001", 1])],
    });
    mockedAi.mockResolvedValue(withEgg);
    const res = await call(body);
    expect(res.status).toBe(422);
    expect(mockedAi).toHaveBeenCalledTimes(2);
  });

  it("AI 실패는 두 번 시도한 뒤 502, 키 없음은 한 번만 시도하고 500(SERVER_MISCONFIGURED), 그 밖의 오류는 500", async () => {
    mockedAi.mockRejectedValue(new AiUnavailableError("실패"));
    expect((await call(body)).status).toBe(502);
    expect(mockedAi).toHaveBeenCalledTimes(2);

    mockedAi.mockReset();
    mockedAi.mockRejectedValue(new AiMisconfiguredError("키 없음"));
    const missing = await call(body);
    expect(missing.status).toBe(500);
    expect((await missing.json()).error.code).toBe("SERVER_MISCONFIGURED");
    expect(mockedAi).toHaveBeenCalledTimes(1);

    mockedAi.mockReset();
    mockedAi.mockRejectedValueOnce(new Error("알 수 없음"));
    const other = await call(body);
    expect(other.status).toBe(500);
    expect((await other.json()).error.code).toBe("INTERNAL_ERROR");
  });

  it("오류 응답은 모두 { error: { code, message } } 모양이고 내부 내용을 담지 않는다", async () => {
    mockedAi.mockRejectedValue(new AiUnavailableError("sk-비밀키가-섞인-메시지"));
    const json = await (await call(body)).json();
    expect(Object.keys(json)).toEqual(["error"]);
    expect(Object.keys(json.error).sort()).toEqual(["code", "message"]);
    expect(JSON.stringify(json)).not.toContain("sk-");
  });
});
