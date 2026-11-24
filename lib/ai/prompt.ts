// Design Ref: §4.2 서버가 하는 일 2 — 알레르기 음식을 뺀 후보 목록만 AI에게 준다
// Plan SC: FR-06 — AI는 후보의 foodId와 인분 수로만 아침·점심·저녁을 구성한다
import { FOODS, filterFoodsByAllergies, type Food } from "@/data/foods";
import { calcMacros } from "@/lib/calc/macros";
import { calcMenuRange } from "@/lib/calc/tomorrow";
import { minKcalFor } from "@/lib/calc/recommend";
import type { MenuRequest } from "./request";

export const SERVING_MIN = 0.5;
export const SERVING_MAX = 3;
export const SERVING_STEP = 0.5;

// 사용자의 알레르기가 들어 있는 음식을 뺀 후보 목록
export function buildCandidates(allergies: MenuRequest["allergies"]): Food[] {
  return filterFoodsByAllergies(FOODS, allergies);
}

// AI에게 요구하는 답변 모양 (OpenAI 구조화 출력용 JSON 스키마)
export const MENU_JSON_SCHEMA = {
  name: "tomorrow_menu",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["meals"],
    properties: {
      meals: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "items"],
          properties: {
            type: { type: "string", enum: ["breakfast", "lunch", "dinner"] },
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["foodId", "servings"],
                properties: {
                  foodId: { type: "string" },
                  servings: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export type ChatMessage = { role: "system" | "user"; content: string };

// 식단 요청에 쓰는 기준값 (칼로리 허용 범위, 단백질 최소량)
export function menuTargets(request: MenuRequest) {
  const floorKcal = minKcalFor(request.sex);
  const range = calcMenuRange(request.targetKcal, floorKcal);
  return {
    floorKcal,
    minKcal: Math.ceil(range.minKcal),
    maxKcal: Math.floor(range.maxKcal),
    minProteinG: calcMacros(request.targetKcal, request.weightKg).proteinG,
  };
}

const GOAL_TEXT = {
  lose: "체중 감량",
  gain: "근육 증가",
  maintain: "체중 유지",
} as const;

// AI에게 보낼 메시지를 만든다. 이름·나이·키는 보내지 않는다.
export function buildMessages(request: MenuRequest, candidates: readonly Food[]): ChatMessage[] {
  const t = menuTargets(request);
  const system = [
    "너는 한국 음식으로 하루 식단을 짜 주는 영양 식단 도우미다.",
    "아래 '후보 음식 목록'에 있는 음식의 foodId만 사용해서 내일 하루의 아침(breakfast)·점심(lunch)·저녁(dinner) 식단을 만든다.",
    "반드시 지킬 규칙:",
    `1. 하루 총 칼로리(후보 목록의 kcal × 인분 수의 합)는 ${t.minKcal}kcal 이상 ${t.maxKcal}kcal 이하여야 한다. 목표는 ${request.targetKcal}kcal이다.`,
    `2. 하루 총 단백질은 ${t.minProteinG}g 이상이어야 한다.`,
    "3. 후보 목록에 없는 foodId는 절대 쓰지 않는다. 이름을 지어내지 않는다.",
    `4. 음식마다 servings(인분 수)는 ${SERVING_MIN}~${SERVING_MAX} 사이이고 ${SERVING_STEP} 단위로 적는다. 후보 목록의 kcal·영양소는 1인분 기준이다.`,
    "5. 아침·점심·저녁 3끼를 모두 만들고, 끼니마다 음식 1~4개를 넣는다. 같은 끼니 안에서 같은 음식을 두 번 쓰지 않는다.",
    "6. 한국인이 한 끼에 실제로 먹을 만한 조합으로 구성한다. (예: 밥 + 국/찌개 + 반찬)",
    "답변은 지정된 JSON 형식으로만 한다. 설명 문장은 쓰지 않는다.",
  ].join("\n");

  const user = JSON.stringify({
    운동목표: GOAL_TEXT[request.goal],
    성별: request.sex === "male" ? "남성" : "여성",
    몸무게kg: request.weightKg,
    내일목표kcal: request.targetKcal,
    칼로리허용범위: { 최소: t.minKcal, 최대: t.maxKcal },
    단백질최소g: t.minProteinG,
    후보음식목록: candidates.map((food) => ({
      foodId: food.id,
      이름: food.name,
      "1인분": food.serving,
      kcal: food.kcal,
      탄수화물g: food.carbs,
      단백질g: food.protein,
      지방g: food.fat,
    })),
  });

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
