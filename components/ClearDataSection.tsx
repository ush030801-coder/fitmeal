"use client";

// Design Ref: §5.3 내 정보 화면 — 내 데이터 모두 지우기 (동의 철회·공용 PC 대비)
// Plan SC: 보안 점검 SEC-009 — 저장한 동의·내 정보·일별 기록을 사용자가 직접 지울 수 있다
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearAllData } from "@/lib/storage/clear";

export default function ClearDataSection() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(false);

  function handleClear() {
    if (clearAllData()) {
      router.push("/consent"); // 동의도 지웠으므로 처음 화면으로 돌아간다
    } else {
      setError(true);
    }
  }

  return (
    <section aria-label="내 데이터 지우기" className="space-y-3 rounded-lg border border-red-300 p-4 dark:border-red-800">
      <h2 className="text-lg font-semibold">내 데이터 모두 지우기</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        이 브라우저에 저장된 동의, 내 정보, 최근 7일 기록을 모두 지웁니다. 지우면 되돌릴 수 없고, 동의도 철회되어 처음 화면으로
        돌아갑니다. 공용 컴퓨터를 썼다면 지우고 나가세요.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          일부 데이터를 지우지 못했습니다. 브라우저의 사이트 데이터 삭제 기능을 이용해 주세요.
        </p>
      )}
      {confirming ? (
        <div className="flex gap-3">
          <button type="button" onClick={handleClear} className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white">
            네, 모두 지웁니다
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700">
            취소
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="rounded-lg border border-red-400 px-4 py-2 text-red-700 dark:text-red-400">
          내 데이터 모두 지우기
        </button>
      )}
    </section>
  );
}
