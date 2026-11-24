// Design Ref: §4.2 AI 호출 규칙 / §7 보안 — AI 키는 서버 코드에서만 읽는다 (NEXT_PUBLIC_ 금지)
// Plan SC: FR-06 — AI 1회 호출은 20초까지 기다린다. 재시도는 호출하는 쪽(서버 라우트)이 정한다.
import OpenAI from "openai";
import { MENU_JSON_SCHEMA, type ChatMessage } from "./prompt";

export const AI_TIMEOUT_MS = 20_000;
export const DEFAULT_MODEL = "gpt-4.1-mini";

// 서버 설정 문제 (AI 키가 없음 등). 사용자에게는 "지금은 만들 수 없다"만 보여준다.
export class AiMisconfiguredError extends Error {}
// AI 호출 실패 (네트워크 오류, 20초 초과, 서비스 오류, 빈 답변 등)
export class AiUnavailableError extends Error {}

// AI를 한 번 부르고 답변 글자를 돌려준다. 이 함수 안에서는 재시도하지 않는다.
export async function requestMenuText(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiMisconfiguredError("OPENAI_API_KEY가 설정되지 않았습니다");

  const client = new OpenAI({ apiKey, timeout: AI_TIMEOUT_MS, maxRetries: 0 });
  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      messages,
      response_format: { type: "json_schema", json_schema: MENU_JSON_SCHEMA },
      temperature: 0.7,
    });
    const text = completion.choices[0]?.message?.content;
    if (!text) throw new AiUnavailableError("AI가 빈 답변을 보냈습니다");
    return text;
  } catch (error) {
    if (error instanceof AiUnavailableError) throw error;
    // 오류 내용에 키나 요청 내용이 섞일 수 있어 사용자·로그에는 종류만 남긴다
    const name = error instanceof Error ? error.name : "UnknownError";
    throw new AiUnavailableError(`AI 호출 실패 (${name})`);
  }
}
