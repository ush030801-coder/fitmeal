import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import DisclaimerFooter from "@/components/DisclaimerFooter";
import SiteHeader from "@/components/SiteHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "핏밀(FitMeal)",
  description: "하루 칼로리를 계산하고 내일 식단을 추천해 주는 헬스케어 앱",
};

// Design Ref: §5.1 공통 틀 — 상단 메뉴 + 본문 + 하단 면책 문구를 모든 화면에 적용
// Plan SC: 작업 1번 — 모든 화면에 의료 상담 대체 불가 문구를 항상 표시
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          {children}
        </main>
        <DisclaimerFooter />
      </body>
    </html>
  );
}
