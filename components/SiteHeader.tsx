// Design Ref: §5.1 공통 틀 — 상단 메뉴 [오늘] [내일 식단] [내 정보]
// Nice 기능(과거 기록·주간 요약)을 만들 때 메뉴 항목을 여기에 추가한다.
import Link from "next/link";

// 메뉴 항목: 이름과 이동할 경로 (경로는 DESIGN §5.3 화면 목록과 같다)
const MENU_ITEMS = [
  { label: "오늘", href: "/" },
  { label: "내일 식단", href: "/menu" },
  { label: "내 정보", href: "/profile" },
] as const;

export default function SiteHeader() {
  return (
    <header className="border-b border-foreground/15">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-bold">
          핏밀
        </Link>
        <nav aria-label="주요 메뉴">
          <ul className="flex items-center gap-4 text-sm">
            {MENU_ITEMS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
