// Plan SC: FR-06 / PLAN 작업 13번 — 요청 검사, 후보 걸러내기, AI 답변 검사·직접 계산, 안내 문구 확인
import { describe, expect, it } from "vitest";
import { FOODS, getFoodById } from "@/data/foods";
import { buildMenu, buildNotes, parseAiMenu } from "@/lib/ai/menu";
import { buildCandidates, buildMessages, menuTargets } from "@/lib/ai/prompt";
import { parseMenuRequest } from "@/lib/ai/request";

const validRequest = {
  sex: "female", weightKg: 60, goal: "lose", targetKcal: 1650, allergies: ["peanut"],
  adjustment: { kind: "over", appliedKcal: 250, capped: false, floorRaised: false, noRecord: false },
};

describe("요청 검사", () => {
  it("올바른 요청은 통과하고 알레르기 중복은 한 번만 남긴다", () => {
    const result = parseMenuRequest({ ...validRequest, allergies: ["egg", "egg", "milk"] });
    expect(result.ok && result.value.allergies).toEqual(["egg", "milk"]);
  });

  it("이름·나이·키 같은 모르는 항목은 버린다", () => {
    const result = parseMenuRequest({ ...validRequest, name: "홍길동", age: 30, heightCm: 170 });
    expect(result.ok).toBe(true);
    expect(result.ok && Object.keys(result.value)).not.toContain("name");
    expect(result.ok && Object.keys(result.value)).not.toContain("age");
  });

  it("범위 밖·모양이 틀린 요청은 거절한다", () => {
    const bad: unknown[] = [
      null, "문자열", {},
      { ...validRequest, sex: "other" },
      { ...validRequest, weightKg: 20 },
      { ...validRequest, weightKg: "60" },
      { ...validRequest, goal: "fly" },
      { ...validRequest, targetKcal: 1199 }, // 여성 하한 미만
      { ...validRequest, targetKcal: 6001 },
      { ...validRequest, sex: "male", targetKcal: 1499 }, // 남성 하한 미만
      { ...validRequest, allergies: ["sesame"] }, // 고정 목록에 없음
      { ...validRequest, adjustment: { ...validRequest.adjustment, appliedKcal: 301 } },
      { ...validRequest, adjustment: { ...validRequest.adjustment, kind: "x" } },
    ];
    for (const input of bad) expect(parseMenuRequest(input).ok, JSON.stringify(input)).toBe(false);
  });

  it("남성은 하한 1,500부터 허용", () => {
    expect(parseMenuRequest({ ...validRequest, sex: "male", targetKcal: 1500 }).ok).toBe(true);
  });
});

describe("후보 음식과 AI 메시지", () => {
  it("알레르기 음식은 후보에서 빠진다", () => {
    const candidates = buildCandidates(["egg", "peanut"]);
    expect(candidates.some((f) => f.allergens.includes("egg"))).toBe(false);
    expect(candidates.some((f) => f.name === "땅콩버터")).toBe(false);
    expect(candidates.length).toBeLessThan(FOODS.length);
    expect(buildCandidates([])).toHaveLength(100);
  });

  it("목표·허용 범위·단백질 최소량을 계산한다 (1,650kcal·60kg → 1,568~1,732, 단백질 96g)", () => {
    const parsed = parseMenuRequest(validRequest);
    if (!parsed.ok) throw new Error("요청 검사 실패");
    expect(menuTargets(parsed.value)).toMatchObject({
      floorKcal: 1200, minKcal: 1568, maxKcal: 1732, minProteinG: 96,
    });
  });

  it("AI 메시지에는 후보 음식만 담기고 알레르기 음식과 이름·나이·키는 없다", () => {
    const parsed = parseMenuRequest({ ...validRequest, allergies: ["egg"] });
    if (!parsed.ok) throw new Error("요청 검사 실패");
    const messages = buildMessages(parsed.value, buildCandidates(parsed.value.allergies));
    const all = messages.map((m) => m.content).join("\n");
    expect(all).not.toContain("삶은 계란");
    expect(all).toContain("쌀밥");
    expect(all).not.toMatch(/나이|키cm|heightCm|age|name/);
  });
});

const candidateIds = new Set(FOODS.map((f) => f.id));
const meal = (type: string, ...items: [string, number][]) => ({
  type, items: items.map(([foodId, servings]) => ({ foodId, servings })),
});
const goodMenu = {
  meals: [
    meal("breakfast", ["f001", 1], ["f060", 1]),
    meal("lunch", ["f001", 1.5], ["f015", 1]),
    meal("dinner", ["f001", 1], ["f050", 1]),
  ],
};

describe("AI 답변 모양 검사", () => {
  it("올바른 답변은 통과한다", () => {
    expect(parseAiMenu(JSON.stringify(goodMenu), candidateIds).ok).toBe(true);
  });

  it("JSON이 아니거나 모양이 틀리면 거절", () => {
    expect(parseAiMenu("그냥 글", candidateIds)).toMatchObject({ ok: false });
    expect(parseAiMenu(JSON.stringify({ meals: "x" }), candidateIds)).toMatchObject({ ok: false });
  });

  it("3끼가 아니거나 같은 끼니가 겹치면 거절", () => {
    const two = { meals: goodMenu.meals.slice(0, 2) };
    expect(parseAiMenu(JSON.stringify(two), candidateIds)).toMatchObject({ ok: false });
    const dup = { meals: [goodMenu.meals[0], goodMenu.meals[0], goodMenu.meals[2]] };
    expect(parseAiMenu(JSON.stringify(dup), candidateIds)).toMatchObject({ ok: false });
  });

  it("끼니 안의 음식 수·중복·인분 단위를 검사한다", () => {
    const empty = { meals: [meal("breakfast"), goodMenu.meals[1], goodMenu.meals[2]] };
    expect(parseAiMenu(JSON.stringify(empty), candidateIds)).toMatchObject({ ok: false });
    const five = { meals: [meal("breakfast", ["f001", 1], ["f002", 1], ["f003", 1], ["f004", 1], ["f005", 1]), goodMenu.meals[1], goodMenu.meals[2]] };
    expect(parseAiMenu(JSON.stringify(five), candidateIds)).toMatchObject({ ok: false });
    const same = { meals: [meal("breakfast", ["f001", 1], ["f001", 1]), goodMenu.meals[1], goodMenu.meals[2]] };
    expect(parseAiMenu(JSON.stringify(same), candidateIds)).toMatchObject({ ok: false });
    const ok = { meals: [meal("breakfast", ["f001", 1.3]), goodMenu.meals[1], goodMenu.meals[2]] };
    expect(parseAiMenu(JSON.stringify(ok), candidateIds).ok).toBe(true); // 0.1 단위는 허용
    const step = { meals: [meal("breakfast", ["f001", 1.25]), goodMenu.meals[1], goodMenu.meals[2]] };
    expect(parseAiMenu(JSON.stringify(step), candidateIds)).toMatchObject({ ok: false });
    const range = { meals: [meal("breakfast", ["f001", 5]), goodMenu.meals[1], goodMenu.meals[2]] };
    expect(parseAiMenu(JSON.stringify(range), candidateIds)).toMatchObject({ ok: false });
  });

  it("후보에 없는 foodId(알레르기로 뺀 음식, 지어낸 id)는 거절", () => {
    const withoutEgg = new Set(buildCandidates(["egg"]).map((f) => f.id));
    const eggId = FOODS.find((f) => f.name === "삶은 계란")!.id;
    const withEgg = { meals: [meal("breakfast", [eggId, 1]), goodMenu.meals[1], goodMenu.meals[2]] };
    expect(parseAiMenu(JSON.stringify(withEgg), withoutEgg)).toMatchObject({ ok: false });
    const fake = { meals: [meal("breakfast", ["f999", 1]), goodMenu.meals[1], goodMenu.meals[2]] };
    expect(parseAiMenu(JSON.stringify(fake), candidateIds)).toMatchObject({ ok: false });
  });
});

describe("서버 직접 계산", () => {
  it("AI가 적은 숫자는 없어도 내장 데이터로 칼로리·영양소·합계를 계산한다", () => {
    const parsed = parseAiMenu(JSON.stringify(goodMenu), candidateIds);
    if (!parsed.ok) throw new Error("답변 검사 실패");
    const foodsById = new Map(FOODS.map((f) => [f.id, f]));
    const { meals, totals } = buildMenu(parsed.menu, foodsById);
    expect(meals.map((m) => m.type)).toEqual(["breakfast", "lunch", "dinner"]);
    const rice = getFoodById("f001")!;
    const lunchRice = meals[1].items[0];
    expect(lunchRice).toMatchObject({
      foodId: "f001", name: "쌀밥", amountText: "1공기 × 1.5", kcal: Math.round(rice.kcal * 1.5),
    });
    const all = meals.flatMap((m) => m.items);
    expect(totals.kcal).toBe(all.reduce((s, i) => s + i.kcal, 0));
    expect(Number.isInteger(totals.kcal)).toBe(true);
  });
});

describe("안내 문구는 서버가 만든다", () => {
  const base = { kind: "none" as const, appliedKcal: 0, capped: false, floorRaised: false, noRecord: false };

  it("기록 없음", () => {
    expect(buildNotes({ ...base, noRecord: true }, 1200)[0]).toContain("기록이 없어");
  });

  it("초과 차감 / 부족 보충", () => {
    expect(buildNotes({ ...base, kind: "over", appliedKcal: 250 }, 1200)).toEqual([
      "오늘 초과분 250kcal를 내일 목표에서 덜어냈습니다.",
    ]);
    expect(buildNotes({ ...base, kind: "under", appliedKcal: 120 }, 1200)[0]).toContain("120kcal를 더했습니다");
  });

  it("한도에 걸리면 일부만 반영했다고 알린다", () => {
    expect(buildNotes({ ...base, kind: "over", appliedKcal: 300, capped: true }, 1200).join(" ")).toContain("일부만 반영");
    expect(buildNotes({ ...base, kind: "under", appliedKcal: 300, capped: true }, 1200).join(" ")).toContain("최대 300kcal");
  });

  it("하한으로 올렸다고 알린다", () => {
    expect(buildNotes({ ...base, kind: "over", appliedKcal: 100, floorRaised: true }, 1500).join(" ")).toContain("1,500kcal");
  });

  it("한도와 하한이 함께 걸려도 같은 이유를 두 번 말하지 않는다 (하한 안내만)", () => {
    const notes = buildNotes({ ...base, kind: "over", appliedKcal: 62, capped: true, floorRaised: true }, 1200);
    expect(notes.join(" ")).toContain("1,200kcal");
    expect(notes.join(" ")).not.toContain("일부만 반영");
    expect(notes).toHaveLength(2); // 덜어낸 양 + 하한
  });

  it("반영할 게 없으면 문구도 없다", () => {
    expect(buildNotes(base, 1200)).toEqual([]);
  });
});
