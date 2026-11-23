"use client";

// Design Ref: §5.4 동의 화면 — 안내문 + 동의 체크박스 + 시작하기 버튼(체크 전 비활성)
import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveConsent } from "@/lib/storage/consent";

export default function ConsentForm() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleStart() {
    const result = saveConsent();
    if (result.ok) {
      router.push("/profile");
    } else {
      setError(
        "동의 내용을 이 브라우저에 저장하지 못했습니다. 브라우저의 사이트 데이터 저장 설정을 확인한 뒤 다시 시도해 주세요.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="text-lg font-semibold">내일 식단 추천을 위해 외부 AI 서비스를 사용합니다</h2>
        <p>
          내일 식단을 추천받으려면 아래 정보가 <strong>외부 AI 서비스로 전송</strong>됩니다.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>성별, 몸무게</li>
          <li>운동 목표</li>
          <li>알레르기</li>
          <li>내일 목표 칼로리</li>
          <li>오늘 초과·부족 칼로리</li>
        </ul>
        <p>
          <strong>이름, 나이, 키는 보내지 않습니다.</strong> 입력한 기록은 서버에 저장되지 않고
          이 브라우저에만 보관됩니다.
        </p>
      </section>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => {
            setChecked(event.target.checked);
            setError(null);
          }}
          className="mt-1 h-5 w-5"
        />
        <span>위 내용에 동의합니다.</span>
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!checked}
        onClick={handleStart}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-700"
      >
        시작하기
      </button>
    </div>
  );
}
