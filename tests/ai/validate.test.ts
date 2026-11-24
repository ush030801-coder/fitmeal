// Plan SC: FR-06 / PLAN 작업 14번 — 식단 규칙 검증(허용 범위·하한·단백질·알레르기)과 재요청 흐름 확인
import { describe, expect, it } from "vitest";
import { FOODS } from "@/data/foods";
import { AiMisconfiguredError, AiUnavailableError } from "@/lib/ai/client";
import { buildMenu, parseAiMenu, type Meal, type Totals } from "@/lib/ai/menu";
import { buildCandidates } from "@/lib/ai/prompt";
import { recommendMenu } from "@/lib/ai/recommend";
import type { MenuRequest } from "@/lib/ai/request";
import { validateMenu } from "@/lib/ai/validate";

const foodsById = new Map(FOODS.map((f) => [f.id, f]));
const request: MenuRequest = {
  sex: "female", weightKg: 60, goal: "lose", targetKcal: 1650, allergies: [],
  adjustment: { kind: "none", appliedKcal: 0, capped: false, floorRaised: false, noRecord: false },
};

const item = (foodId: string, kcal: number, protein: number) => ({
  foodId, name: "x", amountText: "x", kcal, carbs: 0, protein, fat: 0,
});
// 합계를 직접 정한 식단 (검증 함수만 따로 확인하려고 만든다)
const menuOf = (kcal: number, protein: number, foodId = "f001"): { meals: Meal[]; totals: Totals } => ({
  meals: [
    { type: "breakfast", items: [item(foodId, kcal, protein)] },
    { type: "lunch", items: [] },
    { type: "dinner", items: [] },
  ],
  totals: { kcal, carbs: 0, protein, fat: 0 },
});
const rules = (menu: ReturnType<typeof menuOf>, req = request) =>
  validateMenu(menu, req, foodsById).map((v) => v.rule);

describe("허용 범위 [max(하한, 목표×0.95), 목표×1.05] (목표 1,650 → 1,567.5 ~ 1,732.5)", () => {
  it("범위 안(경계 포함)은 통과", () => {
    expect(rules(menuOf(1568, 100))).toEqual([]);
    expect(rules(menuOf(1650, 100))).toEqual([]);
    expect(rules(menuOf(1732, 100))).toEqual([]);
  });

  it("범위 밖은 위반", () => {
    expect(rules(menuOf(1567, 100))).toEqual(["kcal_range"]);
    expect(rules(menuOf(1733, 100))).toEqual(["kcal_range"]);
  });

  it("이유 문구에 허용 범위와 모자란 양이 들어 있다", () => {
    const [v] = validateMenu(menuOf(1462, 100), request, foodsById);
    expect(v.message).toContain("1,568~1,732kcal");
    expect(v.message).toContain("106kcal 이상 늘려");
  });
});

describe("하한이 ±5%보다 우선한다", () => {
  const atFloor: MenuRequest = { ...request, targetKcal: 1200 }; // 목표가 하한이면 아래쪽 범위는 1,200

  it("목표 1,200: 1,200은 통과, 1,199는 하한·범위 위반", () => {
    expect(rules(menuOf(1200, 100), atFloor)).toEqual([]);
    expect(rules(menuOf(1199, 100), atFloor)).toEqual(["floor", "kcal_range"]);
    expect(rules(menuOf(1260, 100), atFloor)).toEqual([]);
    expect(rules(menuOf(1261, 100), atFloor)).toEqual(["kcal_range"]);
  });

  it("남성은 하한 1,500", () => {
    const male: MenuRequest = { ...request, sex: "male", targetKcal: 1500 };
    expect(rules(menuOf(1500, 100), male)).toEqual([]);
    expect(rules(menuOf(1499, 100), male)).toEqual(["floor", "kcal_range"]);
  });
});

describe("단백질: 체중 1kg당 1.6g 이상 (60kg → 96g)", () => {
  it("96g은 통과, 95.9g은 위반", () => {
    expect(rules(menuOf(1650, 96))).toEqual([]);
    expect(rules(menuOf(1650, 95.9))).toEqual(["protein"]);
  });

  it("체중이 달라지면 기준도 달라진다 (80kg → 128g)", () => {
    const heavy = { ...request, weightKg: 80 };
    expect(rules(menuOf(1650, 127), heavy)).toEqual(["protein"]);
    expect(rules(menuOf(1650, 128), heavy)).toEqual([]);
  });
});

describe("알레르기는 답변이 와도 서버가 다시 검사한다", () => {
  it("알레르기 음식이 들어 있으면 위반", () => {
    const eggId = FOODS.find((f) => f.name === "삶은 계란")!.id;
    expect(rules(menuOf(1650, 100, eggId), { ...request, allergies: ["egg"] })).toEqual(["allergen"]);
    expect(rules(menuOf(1650, 100, eggId), { ...request, allergies: ["milk"] })).toEqual([]);
  });
});

describe("재요청 흐름: AI 호출은 호출 실패와 검증 실패를 합쳐 최대 2회", () => {
  const meal = (type: string, ...items: [string, number][]) => ({
    type, items: items.map(([foodId, servings]) => ({ foodId, servings })),
  });
  const good = JSON.stringify({
    meals: [
      meal("breakfast", ["f003", 1], ["f017", 1], ["f059", 1]),
      meal("lunch", ["f014", 1], ["f058", 1]),
      meal("dinner", ["f044", 3], ["f060", 1]),
    ],
  });
  const low = JSON.stringify({
    meals: [meal("breakfast", ["f001", 1]), meal("lunch", ["f001", 1]), meal("dinner", ["f001", 1])],
  });

  // 순서대로 답하는 가짜 AI. 예외 객체를 넣으면 그 오류를 던진다.
  function fakeAi(...answers: (string | Error)[]) {
    const calls: { role: string; content: string }[][] = [];
    const ask = async (messages: { role: "system" | "user" | "assistant"; content: string }[]) => {
      calls.push(messages);
      const next = answers[calls.length - 1];
      if (next === undefined) throw new Error("예상보다 많이 불렀다");
      if (next instanceof Error) throw next;
      return next;
    };
    return { ask, calls };
  }

  it("처음에 통과하면 1회만 부른다", async () => {
    const ai = fakeAi(good);
    expect(await recommendMenu(request, ai.ask)).toMatchObject({ ok: true, aiCalls: 1 });
  });

  it("위반 → 이유를 알려 다시 요청 → 통과 (2회)", async () => {
    const ai = fakeAi(low, good);
    expect(await recommendMenu(request, ai.ask)).toMatchObject({ ok: true, aiCalls: 2 });
    const retry = ai.calls[1];
    const last = retry[retry.length - 1].content;
    expect(retry[retry.length - 2]).toEqual({ role: "assistant", content: low });
    expect(last).toContain("허용 범위");
    expect(last).toContain("단백질");
  });

  it("두 번 다 위반이면 식단을 돌려주지 않는다 (2회에서 멈춤)", async () => {
    const ai = fakeAi(low, low);
    expect(await recommendMenu(request, ai.ask)).toEqual({ ok: false, reason: "rule_violation", aiCalls: 2 });
  });

  it("모양이 틀린 답변도 위반으로 보고 다시 요청한다", async () => {
    const ai = fakeAi("그냥 글", good);
    expect(await recommendMenu(request, ai.ask)).toMatchObject({ ok: true, aiCalls: 2 });
    expect(ai.calls[1][ai.calls[1].length - 1].content).toContain("JSON");
  });

  it("호출 실패 → 다시 호출 → 통과", async () => {
    const ai = fakeAi(new AiUnavailableError("실패"), good);
    expect(await recommendMenu(request, ai.ask)).toMatchObject({ ok: true, aiCalls: 2 });
    expect(ai.calls[1]).toEqual(ai.calls[0]); // 실패했을 때는 같은 요청을 그대로 다시 보낸다
  });

  it("호출이 두 번 다 실패하면 unavailable", async () => {
    const ai = fakeAi(new AiUnavailableError("a"), new AiUnavailableError("b"));
    expect(await recommendMenu(request, ai.ask)).toEqual({ ok: false, reason: "unavailable", aiCalls: 2 });
  });

  it("위반 뒤 호출 실패는 unavailable, 호출 실패 뒤 위반은 rule_violation", async () => {
    expect(await recommendMenu(request, fakeAi(low, new AiUnavailableError("x")).ask)).toMatchObject({ reason: "unavailable" });
    expect(await recommendMenu(request, fakeAi(new AiUnavailableError("x"), low).ask)).toMatchObject({ reason: "rule_violation" });
  });

  it("서버 설정 문제(키 없음)는 다시 부르지 않는다", async () => {
    const ai = fakeAi(new AiMisconfiguredError("키 없음"));
    expect(await recommendMenu(request, ai.ask)).toEqual({ ok: false, reason: "misconfigured", aiCalls: 1 });
  });

  it("검증 대상 식단은 서버가 내장 데이터로 계산한 값이다 (AI 숫자 무관)", () => {
    const parsed = parseAiMenu(good, new Set(buildCandidates([]).map((f) => f.id)));
    if (!parsed.ok) throw new Error("답변 검사 실패");
    const built = buildMenu(parsed.menu, foodsById);
    expect(built.totals.kcal).toBe(1577);
    expect(validateMenu(built, request, foodsById)).toEqual([]);
  });
});
