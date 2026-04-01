import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "fs";
import path from "path";

// ── My_mcp-server README 경로 ─────────────────────────────────
const README_PATH = path.join(
  path.dirname(path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")))),
  "README.md"
);

// import.meta.url 대신 __dirname 패턴 대응 - 상대 경로로 보완
const README_FALLBACK = "C:\\Users\\hapew112\\Downloads\\My_mcp-server\\README.md";

function getReadmePath(): string {
  // 실제 파일 존재 여부 확인 후 결정
  try {
    if (fs.existsSync(README_FALLBACK)) return README_FALLBACK;
  } catch {}
  return README_FALLBACK;
}

// ── 타입 이모지 매핑 ──────────────────────────────────────────
const TYPE_MAP: Record<string, string> = {
  NEW:     "🆕 NEW",
  FIX:     "🔧 FIX",
  UPDATE:  "📝 UPDATE",
  BREAK:   "⚠️ BREAKING",
  REMOVE:  "🗑️ REMOVE",
  DOCS:    "📚 DOCS",
  PERF:    "⚡ PERF",
};

/** 오늘 날짜 KST 기준 YYYY-MM-DD */
function todayKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function registerMetaTools(server: McpServer): void {

  // ── 변경이력 추가 ──────────────────────────────────────────
  server.registerTool(
    "changelog_add",
    {
      title: "Add Entry to README Changelog",
      description: `Add a new entry to the README.md changelog table in My_mcp-server.
Use this after making any change to document what was done.

Args:
  - type: Change type
      "NEW"    → 🆕 NEW    (새 기능/도구 추가)
      "FIX"    → 🔧 FIX    (버그 수정)
      "UPDATE" → 📝 UPDATE (기존 기능 수정)
      "BREAK"  → ⚠️ BREAKING (호환성 깨는 변경)
      "REMOVE" → 🗑️ REMOVE (기능 제거)
      "DOCS"   → 📚 DOCS   (문서 업데이트)
      "PERF"   → ⚡ PERF   (성능 개선)
  - description: One-line description of what changed
  - date (optional): Date string YYYY-MM-DD (default: today KST)

Returns:
  Confirmation with the added row.`,
      inputSchema: z.object({
        type: z.enum(["NEW", "FIX", "UPDATE", "BREAK", "REMOVE", "DOCS", "PERF"])
          .describe("Change type"),
        description: z.string().min(1).describe("What was changed (one line)"),
        date: z.string().optional().describe("Date YYYY-MM-DD (default: today)"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ type, description, date }) => {
      try {
        const readmePath = getReadmePath();
        if (!fs.existsSync(readmePath)) {
          return { content: [{ type: "text", text: `Error: README.md not found at ${readmePath}` }] };
        }

        const content = fs.readFileSync(readmePath, "utf-8");
        const typeLabel = TYPE_MAP[type] ?? type;
        const entryDate = date ?? todayKST();
        const newRow = `| ${entryDate} | ${typeLabel} | ${description} |`;

        // 변경 이력 테이블 헤더 다음 줄에 삽입
        // 패턴: "| 날짜 | 구분 | 내용 |" 헤더 행 + "|---" 구분선 바로 아래
        const tableHeaderPattern = /(\| 날짜 \| 구분 \| 내용 \|\r?\n\|[-| ]+\|\r?\n)/;
        if (!tableHeaderPattern.test(content)) {
          return {
            content: [{
              type: "text",
              text: `Error: README.md에서 변경이력 테이블을 찾을 수 없습니다.\n` +
                `다음 형식의 테이블이 있어야 합니다:\n| 날짜 | 구분 | 내용 |\n|------|------|------|`,
            }],
          };
        }

        const updated = content.replace(
          tableHeaderPattern,
          (match) => match + newRow + "\n"
        );

        fs.writeFileSync(readmePath, updated, "utf-8");

        return {
          content: [{
            type: "text",
            text: `✅ 변경이력 추가 완료\n${"─".repeat(60)}\n${newRow}`,
          }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    }
  );

  // ── 변경이력 조회 ──────────────────────────────────────────
  server.registerTool(
    "changelog_view",
    {
      title: "View README Changelog",
      description: `View the current changelog from README.md.

Args:
  - limit (number, optional): How many recent entries to show (default: 10, 0 = all)

Returns:
  Recent changelog entries from README.md.`,
      inputSchema: z.object({
        limit: z.number().int().min(0).default(10),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ limit }) => {
      try {
        const readmePath = getReadmePath();
        if (!fs.existsSync(readmePath)) {
          return { content: [{ type: "text", text: `Error: README.md not found at ${readmePath}` }] };
        }

        const content = fs.readFileSync(readmePath, "utf-8");
        const lines = content.split("\n");

        // 변경이력 테이블 범위 찾기
        let tableStart = -1;
        let tableEnd = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes("| 날짜 | 구분 | 내용 |")) {
            tableStart = i;
          }
          if (tableStart !== -1 && i > tableStart + 1 && !lines[i].startsWith("|")) {
            tableEnd = i;
            break;
          }
        }
        if (tableEnd === -1 && tableStart !== -1) tableEnd = lines.length;

        if (tableStart === -1) {
          return { content: [{ type: "text", text: "변경이력 테이블을 찾을 수 없습니다." }] };
        }

        // 헤더 2줄 + 데이터 행들
        const headerLines = lines.slice(tableStart, tableStart + 2);
        const dataLines = lines.slice(tableStart + 2, tableEnd).filter(l => l.startsWith("|") && l.trim() !== "");

        const shown = limit === 0 ? dataLines : dataLines.slice(0, limit);
        const total = dataLines.length;

        let out = `📋 변경이력 (최근 ${shown.length}개 / 전체 ${total}개)\n${"─".repeat(60)}\n`;
        out += headerLines.join("\n") + "\n";
        out += shown.join("\n");
        if (limit > 0 && total > limit) {
          out += `\n\n... 외 ${total - limit}개 더 있음 (limit: 0 으로 전체 조회)`;
        }

        return { content: [{ type: "text", text: out }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    }
  );
}
