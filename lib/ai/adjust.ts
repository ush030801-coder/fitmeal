// Design Ref: §4.2 서버가 하는 일 — AI가 고른 음식은 그대로 두고, 서버가 인분 수만 조금 조정해 규칙에 맞춘다
// Plan SC: FR-06 — 허용 범위[max(하한, 목표×0.95), 목표×1.05]와 단백질(체중×1.6g 이상)을 서버 계산으로 맞춘다
// AI는 음식 조합을 고르는 데 강하고 칼로리·단백질을 동시에 맞추는 계산에는 약하다. 그래서 계산은 서버가 한다.
import type { Food } from "@/data/foods";
import { calcFoodEntry } from "@/lib/calc/food";
import { PROTEIN_G_PER_KG } from "@/lib/calc/constants";
import { calcMenuRange } from "@/lib/calc/tomorrow";
import { minKcalFor } from "@/lib/calc/recommend";
import type { AiMenu } from "./menu";
import { SERVING_MAX, SERVING_MIN, SERVING_STEP } from "./prompt";
import type { MenuRequest } from "./request";

// 인분 수를 0.1 단위의 정수(unit)로 다룬다: 13 = 1.3인분 (소수 계산 오차를 피한다)
const UNITS_PER_SERVING = Math.round(1 / SERVING_STEP); // 1인분 = 10칸
const UNIT_MIN = Math.round(SERVING_MIN * UNITS_PER_SERVING);
const UNIT_MAX = Math.round(SERVING_MAX * UNITS_PER_SERVING);
const toServings = (unit: number) => unit / UNITS_PER_SERVING; // 13 / 10 = 1.3 (곱셈은 1.3000000000000003이 된다)
const MAX_ROUNDS = 300;
const PROTEIN_WEIGHT = 10; // 단백질 1g 부족을 칼로리 10kcal 벗어난 것만큼 크게 본다
const GOAL_BAND = 0.02; // 가능하면 목표의 ±2% 안(범위의 가운데)으로 맞춘다

type Slot = { meal: number; item: number; kcal: number[]; protein: number[] };

const round1 = (value: number) => Math.round(value * 10) / 10;

export type AdjustResult =
  | { ok: true; menu: AiMenu; changed: boolean }
  | { ok: false };

// 서버가 AI 식단의 인분 수를 조정한다. 음식 구성(끼니·음식)은 바꾸지 않는다.
// 조정으로 규칙을 맞출 수 없으면 ok:false를 돌려주고, 호출하는 쪽이 AI에게 다시 요청한다.
export function adjustServings(
  menu: AiMenu,
  request: MenuRequest,
  foodsById: ReadonlyMap<string, Food>,
): AdjustResult {
  // 음식마다 "인분 수 → 칼로리·단백질" 표를 미리 만든다 (화면에 나가는 계산과 같은 함수·같은 반올림)
  const slots: Slot[] = [];
  const units: number[] = [];
  for (let m = 0; m < menu.meals.length; m++) {
    for (let i = 0; i < menu.meals[m].items.length; i++) {
      const item = menu.meals[m].items[i];
      const food = foodsById.get(item.foodId);
      if (!food) return { ok: false };
      const kcal: number[] = [];
      const protein: number[] = [];
      for (let u = UNIT_MIN; u <= UNIT_MAX; u++) {
        const entry = calcFoodEntry(food, "serving", toServings(u));
        kcal[u] = entry.kcal;
        protein[u] = entry.protein;
      }
      slots.push({ meal: m, item: i, kcal, protein });
      units.push(Math.round(item.servings * UNITS_PER_SERVING));
    }
  }
  if (slots.length === 0) return { ok: false };

  const floorKcal = minKcalFor(request.sex);
  const range = calcMenuRange(request.targetKcal, floorKcal);
  const allowedLo = Math.ceil(range.minKcal);
  const allowedHi = Math.floor(range.maxKcal);
  const minProtein = request.weightKg * PROTEIN_G_PER_KG;

  // 가능하면 목표 ±2%, 그게 허용 범위와 겹치지 않으면 허용 범위 전체를 목표로 삼는다
  const bandLo = Math.max(allowedLo, Math.ceil(request.targetKcal * (1 - GOAL_BAND)));
  const bandHi = Math.min(allowedHi, Math.floor(request.targetKcal * (1 + GOAL_BAND)));
  const [goalLo, goalHi] = bandLo <= bandHi ? [bandLo, bandHi] : [allowedLo, allowedHi];

  const totals = (u: readonly number[]) => {
    let kcal = 0;
    let protein = 0;
    slots.forEach((slot, idx) => {
      kcal += slot.kcal[u[idx]];
      protein += slot.protein[u[idx]];
    });
    return { kcal, protein: round1(protein) };
  };
  // 규칙(허용 범위·단백질)에서 얼마나 벗어났는지. 0이면 목표 범위 안이다.
  const penalty = (u: readonly number[]) => {
    const t = totals(u);
    return (
      Math.max(0, goalLo - t.kcal) +
      Math.max(0, t.kcal - goalHi) +
      PROTEIN_WEIGHT * Math.max(0, minProtein - 1e-9 - t.protein)
    );
  };

  // 이미 허용 범위와 단백질 기준을 지키는 식단은 건드리지 않는다
  const startTotals = totals(units);
  if (
    startTotals.kcal >= allowedLo &&
    startTotals.kcal <= allowedHi &&
    startTotals.protein >= minProtein - 1e-9
  ) {
    return { ok: true, menu, changed: false };
  }

  // 한 번에 가장 많이 개선되는 변경을 골라 반복한다. (한 음식 ±1~5칸, 막히면 두 음식을 함께 ±1칸)
  const current = [...units];
  let currentPenalty = penalty(current);
  const original = [...units];

  for (let round = 0; round < MAX_ROUNDS && currentPenalty > 0; round++) {
    let best: { change: [number, number][]; gain: number; size: number } | null = null;
    const consider = (change: [number, number][]) => {
      const next = [...current];
      for (const [idx, delta] of change) {
        const value = next[idx] + delta;
        if (value < UNIT_MIN || value > UNIT_MAX) return;
        next[idx] = value;
      }
      const gain = currentPenalty - penalty(next);
      if (gain <= 0) return;
      const size = change.reduce((s, [, d]) => s + Math.abs(d), 0);
      // 같은 칸을 바꿔서 더 많이 좋아지는 쪽(칸당 개선량)을 우선한다
      if (!best || gain / size > best.gain / best.size) best = { change, gain, size };
    };

    for (let idx = 0; idx < current.length; idx++) {
      for (let d = -5; d <= 5; d++) if (d !== 0) consider([[idx, d]]);
    }
    if (!best) {
      for (let a = 0; a < current.length; a++) {
        for (let b = a + 1; b < current.length; b++) {
          for (const da of [-1, 1]) for (const db of [-1, 1]) consider([[a, da], [b, db]]);
        }
      }
    }
    if (!best) break; // 더 이상 좋아지지 않으면 멈춘다

    for (const [idx, delta] of (best as { change: [number, number][] }).change) current[idx] += delta;
    currentPenalty = penalty(current);
  }

  if (currentPenalty > 0) return { ok: false };

  const changed = current.some((u, idx) => u !== original[idx]);
  const adjusted: AiMenu = {
    meals: menu.meals.map((meal) => ({ ...meal, items: meal.items.map((item) => ({ ...item })) })),
  };
  slots.forEach((slot, idx) => {
    adjusted.meals[slot.meal].items[slot.item].servings = toServings(current[idx]);
  });
  return { ok: true, menu: adjusted, changed };
}
