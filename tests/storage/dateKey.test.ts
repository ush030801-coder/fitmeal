// Plan SC: PRD Nice 2 — 과거 기록 화면의 날짜 이름표
import { describe, expect, it } from "vitest";
import { formatDateLabel } from "@/lib/storage/dateKey";

describe("날짜 이름표", () => {
  it("월/일(요일)로 만든다", () => {
    expect(formatDateLabel("2026-03-03")).toBe("3/3(화)");
    expect(formatDateLabel("2026-02-28")).toBe("2/28(토)");
    expect(formatDateLabel("2024-02-29")).toBe("2/29(목)"); // 윤년
  });
});
