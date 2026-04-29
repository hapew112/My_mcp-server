import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import https from "https";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL = "gemini-2.5-flash";

function callGemini(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    });
    const options = {
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) reject(new Error(`Gemini 응답 없음: ${data}`));
          else resolve(text);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

export function registerAiFeedbackTools(server: McpServer): void {

  // ── 코드 리뷰 ───────────────────────────────────────────────
  server.registerTool(
    "ai_review_code",
    {
      title: "AI Code Review (Gemini)",
      description: "코드 스니펫을 Gemini에게 넘겨 리뷰를 받는다. 버그, 개선점, 보안 이슈를 한국어로 반환.",
      inputSchema: z.object({
        code: z.string().describe("리뷰할 코드"),
        context: z.string().optional().describe("파일명, 언어, 목적 등 추가 컨텍스트"),
      }),
    },
    async ({ code, context }) => {
      if (!GEMINI_API_KEY) return { content: [{ type: "text" as const, text: "❌ GEMINI_API_KEY 환경변수가 없습니다." }] };
      const prompt = `너는 시니어 개발자야. 아래 코드를 리뷰하고 한국어로 답해줘.
${context ? `컨텍스트: ${context}\n` : ""}
리뷰 항목:
1. 버그 또는 잠재적 오류
2. 개선 가능한 부분 (성능, 가독성)
3. 보안 이슈
4. 전체 평가 (간단히)

\`\`\`
${code}
\`\`\``;
      try {
        const result = await callGemini(prompt);
        return { content: [{ type: "text" as const, text: result }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `❌ Gemini 오류: ${e.message}` }] };
      }
    }
  );

  // ── 에러 분석 ───────────────────────────────────────────────
  server.registerTool(
    "ai_analyze_error",
    {
      title: "AI Error Analyzer (Gemini)",
      description: "에러 로그/메시지를 Gemini에게 분석시켜 원인과 해결책을 받는다.",
      inputSchema: z.object({
        error: z.string().describe("에러 메시지 또는 스택 트레이스"),
        code: z.string().optional().describe("관련 코드 (선택)"),
      }),
    },
    async ({ error, code }) => {
      if (!GEMINI_API_KEY) return { content: [{ type: "text" as const, text: "❌ GEMINI_API_KEY 환경변수가 없습니다." }] };
      const prompt = `아래 에러를 분석해서 한국어로 답해줘.

에러:
\`\`\`
${error}
\`\`\`
${code ? `\n관련 코드:\n\`\`\`\n${code}\n\`\`\`` : ""}

답변 형식:
- 원인: (무엇 때문인지)
- 해결책: (어떻게 고치는지, 코드 포함)
- 예방: (다음에 이런 에러를 피하려면)`;
      try {
        const result = await callGemini(prompt);
        return { content: [{ type: "text" as const, text: result }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `❌ Gemini 오류: ${e.message}` }] };
      }
    }
  );

  // ── 자유 질의 ───────────────────────────────────────────────
  server.registerTool(
    "ai_ask",
    {
      title: "Ask Gemini",
      description: "Gemini에게 자유롭게 질문한다. 개발 관련 무엇이든.",
      inputSchema: z.object({
        question: z.string().describe("질문 내용"),
      }),
    },
    async ({ question }) => {
      if (!GEMINI_API_KEY) return { content: [{ type: "text" as const, text: "❌ GEMINI_API_KEY 환경변수가 없습니다." }] };
      try {
        const result = await callGemini(question);
        return { content: [{ type: "text" as const, text: result }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `❌ Gemini 오류: ${e.message}` }] };
      }
    }
  );
}
