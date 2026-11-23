// Design Ref: §5.4 오늘 화면 — 결과 카드: 기본 권장, 운동 소모, 오늘의 비교 기준, 섭취, 초과·부족
// Plan SC: PLAN 작업 11번 / FR-04 — 오늘의 비교 기준과 견준 초과·부족, ±10% 안내, 기록 소실 안내
import Link from "next/link";
import type { TodayResult } from "@/lib/calc/today";

const kcal = (value: number) => `${value.toLocaleString("ko-KR")}kcal`;

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 py-1 ${strong ? "font-semibold" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function TodayResultCard({ result }: { result: TodayResult }) {
  const statusText =
    result.status === "over"
      ? `오늘 기준보다 ${kcal(result.diffKcal)} 더 먹었습니다 (초과)`
      : result.status === "under"
        ? `오늘 기준보다 ${kcal(result.diffKcal)} 덜 먹었습니다 (부족)`
        : "오늘 기준과 정확히 같습니다";
  const statusColor =
    result.status === "over"
      ? "text-red-700 dark:text-red-400"
      : result.status === "under"
        ? "text-blue-700 dark:text-blue-400"
        : "text-emerald-700 dark:text-emerald-400";

  return (
    <section
      aria-label="오늘 결과"
      className="space-y-4 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700"
    >
      <h2 className="text-lg font-semibold">오늘 결과</h2>

      <dl className="divide-y divide-zinc-200 dark:divide-zinc-800">
        <Row label="기본 권장 칼로리" value={kcal(result.baseKcal)} />
        <Row label="오늘 운동 소모" value={`+ ${kcal(result.burnedKcal)}`} />
        <Row label="오늘의 비교 기준" value={kcal(result.compareKcal)} strong />
        <Row label="오늘 섭취" value={kcal(result.intakeKcal)} strong />
      </dl>

      <p className={`text-lg font-bold ${statusColor}`}>{statusText}</p>

      {!result.hasRecord && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          아직 입력한 운동·음식이 없어서 기본 권장 칼로리만큼 부족하게 보입니다. 위에서 입력하면 바로 다시 계산됩니다.
        </p>
      )}

      <p className="text-sm">
        단백질: {result.proteinG}g 섭취 / 하루 권장 {result.proteinTargetG}g
      </p>

      {result.floorRaised && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          기본 권장 칼로리가 하루 최소 섭취 기준보다 낮게 계산되어 {kcal(result.floorKcal)}으로 올렸습니다.
        </p>
      )}

      <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
        <li>
          소모 칼로리의 오차(±10%)는 공인 MET 기준값을 공식에 넣어 계산한 값 기준입니다. 실제 소모량은 사람마다 다를 수 있습니다.
        </li>
        <li>
          직접 입력한 음식은 추정치(±20%)이고 탄수화물·단백질·지방이 0으로 계산되어 단백질 합계에 포함되지 않습니다.
        </li>
        <li>
          기록은 이 브라우저에만 저장됩니다. 브라우저 데이터를 지우거나 다른 기기·브라우저로 바꾸면 기록이 사라집니다.
        </li>
      </ul>

      <div className="space-y-2">
        <Link
          href="/menu"
          className="block w-full rounded-lg bg-emerald-600 px-4 py-3 text-center font-semibold text-white"
        >
          내일 식단 추천 받기
        </Link>
        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          지금까지 입력한 기록을 기준으로 추천합니다.
        </p>
      </div>
    </section>
  );
}
