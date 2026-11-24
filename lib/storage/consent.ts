// Design Ref: §3.2 브라우저 저장 위치(`fitmeal:consent`) / §5.4 동의 화면
// Plan SC: FR-02 — AI 전송 고지에 동의한 사용자만 다음 화면으로 이동한다
import { getBrowserStore, type KeyValueStore } from "./store";

export const CONSENT_STORAGE_KEY = "fitmeal:consent";
// 동의 문구가 바뀌면 올려서 다시 동의를 받는다 (2: 서버·OpenAI 전송 구분, 국외 이전·보관 고지 추가)
const CONSENT_VERSION = 2;

// 동의했는지 읽는다. 저장소를 쓸 수 없거나 값이 깨졌으면 "동의 안 함"으로 본다.
export function hasConsent(
  store: KeyValueStore | null = getBrowserStore(),
): boolean {
  if (!store) return false;
  try {
    const text = store.getItem(CONSENT_STORAGE_KEY);
    if (text === null) return false;
    const json: unknown = JSON.parse(text);
    return (
      typeof json === "object" &&
      json !== null &&
      (json as Record<string, unknown>).version === CONSENT_VERSION &&
      (json as Record<string, unknown>).agreed === true
    );
  } catch {
    return false;
  }
}

export type SaveConsentResult =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "write_failed" };

// 동의를 저장한다. 실패해도 오류를 던지지 않고 이유를 알려 준다.
export function saveConsent(
  store: KeyValueStore | null = getBrowserStore(),
  now: Date = new Date(),
): SaveConsentResult {
  if (!store) return { ok: false, reason: "unavailable" };
  try {
    store.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        version: CONSENT_VERSION,
        agreed: true,
        agreedAt: now.toISOString(),
      }),
    );
    return { ok: true };
  } catch {
    return { ok: false, reason: "write_failed" };
  }
}
