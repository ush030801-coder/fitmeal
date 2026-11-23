// Design Ref: §5.4 화면별 체크리스트 / PRD 예외 처리 1번 — 입력 범위 한 곳에 모아 두기
// Plan SC: FR-08 입력 범위 검증 (범위를 바꾸려면 이 파일만 고친다)

export type Range = { min: number; max: number };

// 사용자 정보
export const AGE_YEARS: Range = { min: 19, max: 100 }; // 만 19세 미만은 이용 불가
export const HEIGHT_CM: Range = { min: 120, max: 230 };
export const WEIGHT_KG: Range = { min: 30, max: 250 };

// 운동
export const EXERCISE_MINUTES: Range = { min: 1, max: 480 }; // 운동 1건
export const DAILY_EXERCISE_MAX_MINUTES = 480; // 하루 합계 8시간 이하

// 음식 양
export const FOOD_SERVINGS: Range = { min: 0.1, max: 10 }; // 인분
export const FOOD_GRAMS: Range = { min: 1, max: 2000 }; // g

// 직접 입력한 음식
export const DIRECT_FOOD_KCAL: Range = { min: 1, max: 5000 };
export const DIRECT_FOOD_NAME_MAX_LENGTH = 50; // 글자 수 (PRD에 없는 안전장치)
