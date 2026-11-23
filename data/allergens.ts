// Design Ref: §3.3 내장 데이터 — 알레르기 고정 목록의 화면용 한국어 이름
// 주의: 항목(16개)은 식약처 알레르기 유발 식품 표시 항목을 참고한 초안이다.
//       PLAN 작업 5번에서 공식 목록과 대조해 확정하고, 음식별 알레르기 표시와 함께 정리한다.
import { ALLERGEN_IDS, type Allergen } from "@/types";

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  milk: "우유",
  egg: "달걀",
  peanut: "땅콩",
  soy: "대두",
  wheat: "밀",
  buckwheat: "메밀",
  sesame: "참깨",
  fish: "생선",
  shellfish: "갑각류(새우·게 등)",
  mollusk: "조개류·오징어",
  nuts: "견과류(호두·잣 등)",
  pork: "돼지고기",
  beef: "쇠고기",
  chicken: "닭고기",
  peach: "복숭아",
  tomato: "토마토",
};

// 화면에 보여줄 순서 (types의 고정 목록 순서와 같다)
export const ALLERGEN_OPTIONS = ALLERGEN_IDS.map((id) => ({
  id,
  label: ALLERGEN_LABELS[id],
}));
