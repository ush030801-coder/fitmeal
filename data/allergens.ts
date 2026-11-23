// Design Ref: §3.3 내장 데이터 — 알레르기 고정 목록의 화면용 한국어 이름
// 목록은 식품의약품안전처의 알레르기 유발 식품 표시 대상 19개 항목(조개류에 굴·전복·홍합이
// 포함되어 흔히 "22종"이라 부른다)과 같다. 이 목록에 없는 식품(참깨, 연어, 아몬드 등)은
// 선택 항목에 없으며, 그 알레르기가 있는 사용자는 앱이 걸러 주지 못한다.
import { ALLERGEN_IDS, type Allergen } from "@/types";

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  egg: "알류(달걀 등)",
  milk: "우유",
  buckwheat: "메밀",
  peanut: "땅콩",
  soy: "대두",
  wheat: "밀",
  mackerel: "고등어",
  crab: "게",
  shrimp: "새우",
  pork: "돼지고기",
  peach: "복숭아",
  tomato: "토마토",
  sulfites: "아황산류",
  walnut: "호두",
  chicken: "닭고기",
  beef: "쇠고기",
  squid: "오징어",
  shellfish: "조개류(굴·전복·홍합 포함)",
  pinenut: "잣",
};

// 화면에 보여줄 순서 (types의 고정 목록 순서와 같다)
export const ALLERGEN_OPTIONS = ALLERGEN_IDS.map((id) => ({
  id,
  label: ALLERGEN_LABELS[id],
}));
