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
          [내일 식단 추천 받기]를 누르면 아래 정보가 <strong>이 앱의 서버(Vercel)</strong>로 전송되고, 서버가 그중 일부를
          <strong> 외부 AI 서비스(미국 OpenAI)</strong>로 보내 식단을 만듭니다. 따라서 정보가 국외로 전송됩니다.
        </p>
        <div>
          <p className="font-semibold">이 앱의 서버로 보내는 정보</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>성별, 몸무게</li>
            <li>운동 목표</li>
            <li>알레르기</li>
            <li>내일 목표 칼로리와, 오늘 초과·부족분을 반영한 내용</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">그중 외부 AI(OpenAI)로 보내는 정보</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>성별, 몸무게, 운동 목표, 내일 목표 칼로리와 허용 범위</li>
            <li>알레르기 음식을 뺀 음식 목록 (알레르기 항목 자체는 보내지 않지만, 빠진 음식으로 짐작할 수는 있습니다)</li>
          </ul>
        </div>
        <p>
          <strong>이름, 나이, 키는 보내지 않습니다.</strong> 이 앱은 입력한 정보와 기록을 서버에 저장하지 않고 이
          브라우저에만 보관합니다. 다만 OpenAI와 서버 운영 서비스가 자체 정책에 따라 요청 내용을 일정 기간 보관할 수
          있습니다.
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          동의를 철회하려면 식단 추천 받기를 쓰지 않으면 됩니다. 이 브라우저에 저장된 정보는 브라우저의 사이트 데이터를
          지우면 삭제됩니다.
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
