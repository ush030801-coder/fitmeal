// Plan SC: PLAN 작업 5번 / FR-03 — 음식·알레르기 데이터가 약속한 모양인지 확인
import { describe, expect, it } from "vitest";
import { ALLERGEN_LABELS, ALLERGEN_OPTIONS } from "@/data/allergens";
import {
  ALLERGEN_TAGGED_NAMES,
  filterFoodsByAllergies,
  FOODS,
  getFoodById,
  OFFICIAL_VALUE_NAMES,
} from "@/data/foods";
import { ALLERGEN_IDS } from "@/types";

describe("알레르기 고정 목록", () => {
  it("식약처 표시 대상 19개 항목이고 모두 한국어 이름이 있다", () => {
    expect(ALLERGEN_IDS).toHaveLength(19);
    expect(new Set(ALLERGEN_IDS).size).toBe(19);
    for (const id of ALLERGEN_IDS) expect(ALLERGEN_LABELS[id].length).toBeGreaterThan(0);
    expect(ALLERGEN_OPTIONS).toHaveLength(19);
  });
});

describe("내장 음식 100가지", () => {
  it("100개이고 id·이름이 겹치지 않는다", () => {
    expect(FOODS).toHaveLength(100);
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(100);
    expect(new Set(FOODS.map((f) => f.name)).size).toBe(100);
  });

  it("모든 수치가 0 이상이고 칼로리·양이 양수", () => {
    for (const food of FOODS) {
      expect(food.kcal, food.name).toBeGreaterThan(0);
      expect(food.grams, food.name).toBeGreaterThan(0);
      for (const value of [food.carbs, food.protein, food.fat]) {
        expect(value, food.name).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("칼로리가 탄·단·지로 계산한 값(4·4·9)과 크게 어긋나지 않는다 (±25%)", () => {
    for (const food of FOODS) {
      const fromMacros = food.carbs * 4 + food.protein * 4 + food.fat * 9;
      if (food.kcal < 30) continue; // 아주 낮은 칼로리는 반올림 비중이 커서 제외
      expect(Math.abs(food.kcal - fromMacros) / food.kcal, food.name).toBeLessThanOrEqual(0.25);
    }
  });
});

describe("추정치 표시", () => {
  it("식약처 자료와 대조한 36개는 추정치가 아니고, 나머지 64개는 추정치다", () => {
    expect(OFFICIAL_VALUE_NAMES.size).toBe(36);
    const names = new Set(FOODS.map((f) => f.name));
    for (const name of OFFICIAL_VALUE_NAMES) expect(names.has(name), name).toBe(true);
    expect(FOODS.filter((f) => !f.estimated)).toHaveLength(36);
    expect(FOODS.filter((f) => f.estimated)).toHaveLength(64);
  });
});

describe("음식별 알레르기 표시", () => {
  it("이름표에 적은 이름은 모두 실제 음식이고 항목은 고정 목록 안에 있다", () => {
    const names = new Set(FOODS.map((f) => f.name));
    for (const name of ALLERGEN_TAGGED_NAMES) expect(names.has(name), name).toBe(true);
    for (const food of FOODS) {
      for (const a of food.allergens) expect(ALLERGEN_IDS).toContain(a);
      expect(new Set(food.allergens).size).toBe(food.allergens.length);
    }
  });

  it("알려진 음식에 알려진 표시가 있다", () => {
    const tags = (name: string) => FOODS.find((f) => f.name === name)?.allergens;
    expect(tags("삶은 계란")).toEqual(["egg"]);
    expect(tags("우유")).toEqual(["milk"]);
    expect(tags("땅콩버터")).toEqual(["peanut"]);
    expect(tags("고등어구이")).toEqual(["mackerel"]);
    expect(tags("쌀밥")).toEqual([]);
  });

  it("알레르기를 고르면 그 음식을 목록에서 뺀다", () => {
    const withoutEgg = filterFoodsByAllergies(FOODS, ["egg"]);
    expect(withoutEgg.some((f) => f.allergens.includes("egg"))).toBe(false);
    expect(withoutEgg.length).toBeLessThan(FOODS.length);
    expect(filterFoodsByAllergies(FOODS, [])).toHaveLength(100);
  });

  it("id로 음식을 찾는다", () => {
    expect(getFoodById("f001")?.name).toBe("쌀밥");
    expect(getFoodById("없는id")).toBeUndefined();
  });
});
