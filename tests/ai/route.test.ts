// Plan SC: FR-06 / PLAN 작업 13번 — /api/menu 라우트 확인 (실제 AI는 부르지 않고 가짜로 대신한다)
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, requestMenuText: vi.fn() };
});

import { POST } from "@/app/api/menu/route";
import { AiMisconfiguredError, AiUnavailableError, requestMenuText } from "@/lib/ai/client";

const mockedAi = vi.mocked(requestMenuText);

const body = {
  sex: "female", weightKg: 60, goal: "lose", targetKcal: 1650, allergies: ["egg"],
  adjustment: { kind: "over", appliedKcal: 250, capped: false, floorRaised: false, noRecord: false },
};
const call = (payload: unknown) =>
  POST(new Request("http://localhost/api/menu", { method: "POST", body: typeof payload === "string" ? payload : JSON.stringify(payload) }));

const aiAnswer = JSON.stringify({
  meals: [
    { type: "breakfast", items: [{ foodId: "f001", servings: 1 }] },
    { type: "lunch", items: [{ foodId: "f001", servings: 1 }, { foodId: "f015", servings: 1 }] },
    { type: "dinner", items: [{ foodId: "f001", servings: 1 }] },
  ],
});

afterEach(() => mockedAi.mockReset());

describe("POST /api/menu", () => {
  it("정상: 3끼와 합계, 서버가 만든 안내 문구를 돌려준다", async () => {
    mockedAi.mockResolvedValue(aiAnswer);
    const res = await call(body);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.meals.map((m: { type: string }) => m.type)).toEqual(["breakfast", "lunch", "dinner"]);
    expect(json.totals.kcal).toBeGreaterThan(0);
    expect(json.notes).toEqual(["오늘 초과분 250kcal를 내일 목표에서 덜어냈습니다."]);
    expect(mockedAi).toHaveBeenCalledTimes(1);
  });

  it("AI에게 보낸 메시지에 알레르기 음식이 없다", async () => {
    mockedAi.mockResolvedValue(aiAnswer);
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

  it("AI가 알레르기로 뺀 음식을 넣으면 거절(422)한다", async () => {
    const eggId = "f063"; // 후보에서 빠져야 하는 음식을 아래에서 이름으로 확인한다
    const { FOODS } = await import("@/data/foods");
    const id = FOODS.find((f) => f.name === "삶은 계란")?.id ?? eggId;
    mockedAi.mockResolvedValue(
      JSON.stringify({
        meals: [
          { type: "breakfast", items: [{ foodId: id, servings: 1 }] },
          { type: "lunch", items: [{ foodId: "f001", servings: 1 }] },
          { type: "dinner", items: [{ foodId: "f001", servings: 1 }] },
        ],
      }),
    );
    const res = await call(body);
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("MENU_RULE_VIOLATION");
  });

  it("AI 실패는 502, 키 없음은 500(SERVER_MISCONFIGURED), 그 밖의 오류는 500", async () => {
    mockedAi.mockRejectedValueOnce(new AiUnavailableError("실패"));
    expect((await call(body)).status).toBe(502);

    mockedAi.mockRejectedValueOnce(new AiMisconfiguredError("키 없음"));
    const missing = await call(body);
    expect(missing.status).toBe(500);
    expect((await missing.json()).error.code).toBe("SERVER_MISCONFIGURED");

    mockedAi.mockRejectedValueOnce(new Error("알 수 없음"));
    const other = await call(body);
    expect(other.status).toBe(500);
    expect((await other.json()).error.code).toBe("INTERNAL_ERROR");
  });

  it("오류 응답은 모두 { error: { code, message } } 모양이고 내부 내용을 담지 않는다", async () => {
    mockedAi.mockRejectedValueOnce(new AiUnavailableError("sk-비밀키가-섞인-메시지"));
    const json = await (await call(body)).json();
    expect(Object.keys(json)).toEqual(["error"]);
    expect(Object.keys(json.error).sort()).toEqual(["code", "message"]);
    expect(JSON.stringify(json)).not.toContain("sk-");
  });
});
