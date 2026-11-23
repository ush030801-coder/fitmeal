// 핏밀(FitMeal) 내장 운동 데이터 — 자주 하는 운동 20가지와 MET 값
//
// ⚠️ 주의: 이 MET 값들은 신체활동 종합 목록(Compendium of Physical Activities)의 값을
//    바탕으로 정리한 "대략값"이며, 항목별로 기준표와 일일이 대조해 검증하지 않았습니다.
//    기준표의 판(발행 연도)도 아직 정하지 않았습니다. (MET_TABLE_EDITION이 null인 이유)
//    앱에 쓰기 전에 기준표와 대조해 값을 확정하고, 판을 아래에 적으세요.
//    (PRD 3번 성공 지표 3: 내장 MET 값이 기준표와 일치하는지 확인)
//
// MET: 가만히 앉아 있을 때를 1로 보았을 때 그 운동이 몇 배의 에너지를 쓰는지 나타내는 값

import type { Exercise } from "@/types";

// 기준표의 판(발행 연도). 대조를 끝내면 예: "2011" 처럼 적는다. 지금은 확정 전이라 null
export const MET_TABLE_EDITION: string | null = null;

// [이름, MET]
type Row = [string, number];

const rows: Row[] = [
  // 걷기·달리기
  ["걷기(느리게, 약 3.2km/h)", 2.8],
  ["걷기(보통, 약 4.8km/h)", 3.5],
  ["걷기(빠르게, 약 6.4km/h)", 5.0],
  ["달리기(약 8km/h)", 8.3],
  ["달리기(약 9.7km/h)", 9.8],
  ["달리기(약 11.3km/h)", 11.0],
  ["등산", 6.0],

  // 자전거·수영
  ["자전거(여유롭게, 16km/h 미만)", 4.0],
  ["자전거(보통, 16~19km/h)", 6.8],
  ["수영(자유형, 가볍게)", 5.8],
  ["수영(자유형, 빠르게)", 9.8],

  // 근력·몸 관리
  ["웨이트 운동(가볍게~보통)", 3.5],
  ["웨이트 운동(격렬하게)", 6.0],
  ["요가", 2.5],
  ["필라테스", 3.0],
  ["에어로빅", 7.3],
  ["줄넘기(보통)", 11.8],

  // 구기 운동
  ["축구", 7.0],
  ["농구", 6.5],
  ["탁구", 4.0],
];

export const EXERCISES: Exercise[] = rows.map(([name, met], i) => ({
  id: `e${String(i + 1).padStart(3, "0")}`,
  name,
  met,
}));

// id로 운동 한 개를 찾는다 (없으면 undefined)
export function getExerciseById(id: string): Exercise | undefined {
  return EXERCISES.find((exercise) => exercise.id === id);
}
