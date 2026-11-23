// Design Ref: §3.2 브라우저 저장 위치 — 기록은 서버에 저장하지 않고 사용자의 브라우저에만 둔다
// 저장소를 이 모양으로 감싸 두면 테스트에서 가짜 저장소를 끼워 넣을 수 있다.

export type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

// 브라우저의 localStorage를 돌려준다. 서버 쪽 실행이거나, 브라우저 설정 때문에
// 접근이 막혀 있으면(접근만 해도 오류가 나는 경우가 있다) null을 돌려준다.
export function getBrowserStore(): KeyValueStore | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}
