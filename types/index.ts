// Design Ref: §3.1 타입 정의 — 사용자 정보와 알레르기 고정 목록
// 화면에 보여줄 한국어 이름 표는 data/allergens.ts에 둔다. (PLAN 작업 5번에서 확정)

// 알레르기 고정 목록 (식약처 알레르기 유발 식품 표시 항목을 참고한 초안)
export const ALLERGEN_IDS = [
  "milk",
  "egg",
  "peanut",
  "soy",
  "wheat",
  "buckwheat",
  "sesame",
  "fish",
  "shellfish",
  "mollusk",
  "nuts",
  "pork",
  "beef",
  "chicken",
  "peach",
  "tomato",
] as const;
export type Allergen = (typeof ALLERGEN_IDS)[number];

export const SEX_VALUES = ["male", "female"] as const;
export type Sex = (typeof SEX_VALUES)[number];

// 운동 목표: 체중 감량 / 근육 증가 / 체중 유지
export const GOAL_VALUES = ["lose", "gain", "maintain"] as const;
export type Goal = (typeof GOAL_VALUES)[number];

// 평소 활동량 계수 (앱에 따로 입력하는 운동은 제외한 일상 활동 기준)
export const ACTIVITY_LEVELS = [1.2, 1.375, 1.55, 1.725] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

// 음식 양의 단위: 인분 또는 g
export const FOOD_UNITS = ["serving", "g"] as const;
export type FoodUnit = (typeof FOOD_UNITS)[number];

// 사용자 정보 (브라우저에만 저장, 이름·연락처 없음)
export type Profile = {
  sex: Sex;
  age: number; // 만 나이
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
  allergies: Allergen[];
};
