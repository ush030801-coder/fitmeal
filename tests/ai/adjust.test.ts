// Plan SC: FR-06 / PLAN 작업 14번 — 서버가 인분 수만 조정해 규칙(허용 범위·단백질)에 맞추는 흐름 확인
import { describe, expect, it } from "vitest";
import { FOODS } from "@/data/foods";
import { adjustServings } from "@/lib/ai/adjust";
import { buildMenu, type AiMenu } from "@/lib/ai/menu";
import { recommendMenu } from "@/lib/ai/recommend";
import type { MenuRequest } from "@/lib/ai/request";
import { validateMenu } from "@/lib/ai/validate";

const foodsById = new Map(FOODS.map((f) => [f.id, f]));
const request: MenuRequest = {
  sex: "female", weightKg: 60, goal: "lose", targetKcal: 1650, allergies: [],
  adjustment: { kind: "none", appliedKcal: 0, capped: false, floorRaised: false, noRecord: false },
};

const meal = (type: "breakfast" | "lunch" | "dinner", ...items: [string, number][]) => ({
  type, items: items.map(([foodId, servings]) => ({ foodId, servings })),
});
// 실제 AI가 만든 "거의 맞는" 식단과 같은 모양: 1,462kcal(범위 미달), 단백질 111.4g
const nearMiss: AiMenu = {
  meals: [
    meal("breakfast", ["f003", 1], ["f017", 1], ["f059", 1]),
    meal("lunch", ["f014", 1], ["f058", 1]),
    meal("dinner", ["f044", 2], ["f060", 1]),
  ],
};
// 이미 규칙을 지키는 식단 (1,577kcal, 단백질 135.4g)
const valid: AiMenu = {
  meals: [
    meal("breakfast", ["f003", 1], ["f017", 1], ["f059", 1]),
    meal("lunch", ["f014", 1], ["f058", 1]),
    meal("dinner", ["f044", 3], ["f060", 1]),
  ],
};

const violationsOf = (menu: AiMenu, req = request) =>
  validateMenu(buildMenu(menu, foodsById), req, foodsById).map((v) => v.rule);

describe("서버 인분 수 조정", () => {
  it("범위에 모자란 식단을 허용 범위 안으로 맞춘다", () => {
    expect(violationsOf(nearMiss)).toEqual(["kcal_range"]);
    const result = adjustServings(nearMiss, request, foodsById);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(true);
    expect(violationsOf(result.menu)).toEqual([]);
    const total = buildMenu(result.menu, foodsById).totals.kcal;
    expect(total).toBeGreaterThanOrEqual(1568);
    expect(total).toBeLessThanOrEqual(1732);
  });

  it("가능하면 목표(1,650)의 ±2% 안, 범위의 가운데로 맞춘다", () => {
    const result = adjustServings(nearMiss, request, foodsById);
    if (!result.ok) throw new Error("조정 실패");
    const total = buildMenu(result.menu, foodsById).totals.kcal;
    expect(total).toBeGreaterThanOrEqual(1617);
    expect(total).toBeLessThanOrEqual(1683);
  });

  it("음식 구성(끼니·음식 순서)은 바꾸지 않고, 인분 수만 0.5~3 사이 0.1 단위로 바꾼다", () => {
    const result = adjustServings(nearMiss, request, foodsById);
    if (!result.ok) throw new Error("조정 실패");
    expect(result.menu.meals.map((m) => m.type)).toEqual(nearMiss.meals.map((m) => m.type));
    result.menu.meals.forEach((m, mi) => {
      expect(m.items.map((i) => i.foodId)).toEqual(nearMiss.meals[mi].items.map((i) => i.foodId));
      for (const item of m.items) {
        expect(item.servings).toBeGreaterThanOrEqual(0.5);
        expect(item.servings).toBeLessThanOrEqual(3);
        expect(Math.round(item.servings * 10) / 10).toBe(item.servings); // 1.3000000000000003 같은 값이 아니다
      }
    });
  });

  it("원본 식단 객체는 바꾸지 않는다", () => {
    const before = JSON.stringify(nearMiss);
    adjustServings(nearMiss, request, foodsById);
    expect(JSON.stringify(nearMiss)).toBe(before);
  });

  it("단백질만 모자란 식단은 단백질을 채운다 (70kg → 112g 이상)", () => {
    const heavy = { ...request, weightKg: 70 };
    const result = adjustServings(valid, heavy, foodsById);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(violationsOf(result.menu, heavy)).toEqual([]);
  });

  it("이미 규칙을 지키는 식단은 그대로 둔다", () => {
    const result = adjustServings(valid, request, foodsById);
    expect(result).toMatchObject({ ok: true, changed: false });
  });

  it("목표가 하한(1,200)일 때도 하한 아래로는 내리지 않는다", () => {
    const atFloor = { ...request, weightKg: 50, targetKcal: 1200 };
    const result = adjustServings(valid, atFloor, foodsById);
    if (!result.ok) throw new Error("조정 실패");
    const total = buildMenu(result.menu, foodsById).totals.kcal;
    expect(total).toBeGreaterThanOrEqual(1200);
    expect(total).toBeLessThanOrEqual(1260);
  });

  it("인분 수만으로는 맞출 수 없으면 실패를 알린다 (밥만 있는 식단은 단백질을 채울 수 없다)", () => {
    const riceOnly: AiMenu = {
      meals: [meal("breakfast", ["f001", 1]), meal("lunch", ["f001", 1]), meal("dinner", ["f001", 1])],
    };
    expect(adjustServings(riceOnly, request, foodsById)).toEqual({ ok: false });
  });

  it("후보에 없는 음식 id가 섞이면 실패", () => {
    const fake: AiMenu = { meals: [meal("breakfast", ["f999", 1]), valid.meals[1], valid.meals[2]] };
    expect(adjustServings(fake, request, foodsById)).toEqual({ ok: false });
  });
});

describe("추천 흐름에서의 조정", () => {
  const ai = (...answers: string[]) => {
    let n = 0;
    return { ask: async () => answers[n++], calls: () => n };
  };

  it("거의 맞는 식단은 AI를 다시 부르지 않고 서버가 조정해서 통과시킨다 (AI 1회, adjusted)", async () => {
    const fake = ai(JSON.stringify(nearMiss));
    const result = await recommendMenu(request, fake.ask);
    expect(result).toMatchObject({ ok: true, adjusted: true, aiCalls: 1 });
    expect(fake.calls()).toBe(1);
    if (result.ok) {
      expect(result.totals.kcal).toBeGreaterThanOrEqual(1568);
      expect(result.totals.kcal).toBeLessThanOrEqual(1732);
    }
  });

  it("처음부터 규칙을 지킨 식단은 조정하지 않는다 (adjusted: false)", async () => {
    const result = await recommendMenu(request, ai(JSON.stringify(valid)).ask);
    expect(result).toMatchObject({ ok: true, adjusted: false, aiCalls: 1 });
  });

  it("알레르기 음식이 든 식단은 양을 조정하지 않고 AI에게 다시 요청한다", async () => {
    const eggId = FOODS.find((f) => f.name === "삶은 계란")!.id;
    const withEgg: AiMenu = { meals: [meal("breakfast", [eggId, 1], ["f003", 1]), valid.meals[1], valid.meals[2]] };
    const fake = ai(JSON.stringify(withEgg), JSON.stringify(valid));
    const result = await recommendMenu({ ...request, allergies: ["egg"] }, fake.ask);
    expect(result).toMatchObject({ ok: true, adjusted: false, aiCalls: 2 });
  });

  it("조정으로도 안 되는 식단은 AI에게 다시 요청하고, 두 번 다 안 되면 보여주지 않는다", async () => {
    const riceOnly = JSON.stringify({
      meals: [meal("breakfast", ["f001", 1]), meal("lunch", ["f001", 1]), meal("dinner", ["f001", 1])],
    });
    const fake = ai(riceOnly, riceOnly);
    expect(await recommendMenu(request, fake.ask)).toEqual({ ok: false, reason: "rule_violation", aiCalls: 2 });
    expect(fake.calls()).toBe(2);
  });
});
