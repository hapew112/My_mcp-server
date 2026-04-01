import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "fs";
import path from "path";

// ── Reversal 프로젝트 경로 상수 ────────────────────────────────
const REVERSAL_DIR = "C:\\Users\\hapew112\\Downloads\\Reversal";
const SPEC_FILE = path.join(REVERSAL_DIR, "REVERSAL-BUILD-SPEC.md");
const DESIGN_FILE = path.join(REVERSAL_DIR, "COMBO-LAB-DESIGN.md");
const STATE_FILE = path.join(REVERSAL_DIR, ".reversal-state.json");

// ── 타입 정의 ──────────────────────────────────────────────────
interface ReversalState {
  currentPhase: number;
  completedItems: string[];
  lastNote: string;
  lastUpdated: string;
}

// ── 유틸: 섹션 추출 ────────────────────────────────────────────
function extractSection(content: string, section: string): string {
  const lines = content.split("\n");

  // 섹션 번호가 포함된 헤더 라인 찾기 (예: "## 4.3 파싱...")
  const sectionRe = new RegExp(
    `^(#{1,6})\\s+${section.replace(/\./g, "\\.")}[.\\s\\uAC00-\\uD7A3\\-–]`
  );

  let startIdx = -1;
  let headerLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(sectionRe);
    if (m) {
      startIdx = i;
      headerLevel = m[1].length;
      break;
    }
  }

  if (startIdx === -1) {
    return `섹션 "${section}"을 찾을 수 없습니다.\n사용 가능한 섹션 예시: "4", "4.3", "10.2"`;
  }

  // 같은 레벨 또는 상위 레벨의 다음 헤더까지 추출
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s/);
    if (m && m[1].length <= headerLevel) {
      endIdx = i;
      break;
    }
  }

  const extracted = lines.slice(startIdx, endIdx).join("\n");
  return `[${section}번 섹션 — ${endIdx - startIdx}줄]\n${"─".repeat(60)}\n${extracted}`;
}

// ── 유틸: state 로드/저장 ──────────────────────────────────────
function loadState(): ReversalState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) as ReversalState;
    }
  } catch {}
  return { currentPhase: 1, completedItems: [], lastNote: "", lastUpdated: "" };
}

function saveState(state: ReversalState): void {
  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

// ── 유틸: JS 함수 블록 추출 ────────────────────────────────────
function findJSFunction(
  content: string,
  funcName: string
): { code: string; startLine: number; endLine: number } | null {
  const lines = content.split("\n");

  // 다양한 함수 선언 패턴 지원
  const patterns = [
    new RegExp(`^\\s*(async\\s+)?function\\s+${funcName}\\s*\\(`),
    new RegExp(
      `^\\s*(?:const|let|var)\\s+${funcName}\\s*=\\s*(?:async\\s+)?function\\s*\\(`
    ),
    new RegExp(`^\\s*(?:const|let|var)\\s+${funcName}\\s*=\\s*(?:async\\s+)?\\(`),
    new RegExp(`^\\s*(?:const|let|var)\\s+${funcName}\\s*=\\s*(?:async\\s+)?\\(`),
  ];

  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (patterns.some((p) => p.test(lines[i]))) {
      startIdx = i;
      break;
    }
  }

  if (startIdx === -1) return null;

  // 중괄호 깊이 추적으로 함수 끝 찾기
  let depth = 0;
  let started = false;
  let endIdx = startIdx;

  for (let i = startIdx; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === "{") {
        depth++;
        started = true;
      }
      if (ch === "}") depth--;
    }
    if (started && depth === 0) {
      endIdx = i;
      break;
    }
  }

  return {
    code: lines.slice(startIdx, endIdx + 1).join("\n"),
    startLine: startIdx + 1,
    endLine: endIdx + 1,
  };
}

// ── 도구 등록 ──────────────────────────────────────────────────
export function registerReversalTools(server: McpServer): void {

  // ── 스펙 섹션 읽기 ─────────────────────────────────────────
  server.registerTool(
    "reversal_read_spec",
    {
      title: "Read Reversal Spec Section",
      description: `Read a specific section from the Reversal build spec without loading the full 1100+ line document.
Token-efficient: only returns the requested section.

Args:
  - section (string): Section number e.g. "4", "4.3", "10.2"
  - doc ("spec" | "design"): Which doc to read (default: "spec")
    - "spec"   = REVERSAL-BUILD-SPEC.md  (detailed build spec)
    - "design" = COMBO-LAB-DESIGN.md     (original design doc)

Returns:
  Content of that section with line count.

Examples:
  - { "section": "4.3" }          → 파싱 알고리즘
  - { "section": "10" }           → 연습 모드 전체
  - { "section": "19" }           → 구현 체크리스트
  - { "section": "5", "doc": "design" } → COMBO-LAB-DESIGN.md 섹션 5`,
      inputSchema: z.object({
        section: z.string().describe("Section number e.g. '4', '4.3', '10.2'"),
        doc: z.enum(["spec", "design"]).default("spec"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ section, doc }) => {
      try {
        const filePath = doc === "design" ? DESIGN_FILE : SPEC_FILE;
        if (!fs.existsSync(filePath)) {
          return { content: [{ type: "text", text: `Error: ${filePath} not found.` }] };
        }
        const content = fs.readFileSync(filePath, "utf-8");
        const result = extractSection(content, section);
        return { content: [{ type: "text", text: result }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    }
  );

  // ── 진행 상태 조회 ─────────────────────────────────────────
  server.registerTool(
    "reversal_get_state",
    {
      title: "Get Reversal Build Progress",
      description: `Get current build progress for Reversal project.
Shows current phase, completed items, and last work note.

Returns:
  Current phase (1-7), completed checklist items, last note, last updated.`,
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const state = loadState();

        const phaseNames: Record<number, string> = {
          1: "Phase 1: 기반 (HTML/CSS/상수/localStorage)",
          2: "Phase 2: 커맨드 파싱",
          3: "Phase 3: 콤보 등록",
          4: "Phase 4: 연습 모드",
          5: "Phase 5: 위키 붙여넣기",
          6: "Phase 6: 설정",
          7: "Phase 7: 프리셋 & 마무리",
        };

        let out = `🎮 Reversal 빌드 진행상황\n${"─".repeat(50)}\n`;
        out += `\n📍 현재 Phase: ${state.currentPhase} — ${phaseNames[state.currentPhase] ?? "알 수 없음"}\n`;
        out += `\n✅ 완료된 항목 (${state.completedItems.length}개):\n`;
        if (state.completedItems.length === 0) {
          out += "  (없음)\n";
        } else {
          state.completedItems.forEach((item) => (out += `  • ${item}\n`));
        }
        out += `\n📝 마지막 노트:\n  ${state.lastNote || "(없음)"}\n`;
        out += `\n🕐 마지막 업데이트: ${state.lastUpdated || "(없음)"}`;

        return { content: [{ type: "text", text: out }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    }
  );

  // ── 진행 상태 업데이트 ─────────────────────────────────────
  server.registerTool(
    "reversal_set_state",
    {
      title: "Update Reversal Build Progress",
      description: `Update build progress for Reversal project.
Use this to track which phase you're on and what's been completed.

Args:
  - phase (number, optional): Update current phase (1-7)
  - add_completed (string[], optional): Items to mark as completed
  - note (string, optional): Update the last work note

Example:
  { "phase": 2, "add_completed": ["HTML 뼈대", "CSS 디자인 시스템"], "note": "parseSegment() 구현 중" }`,
      inputSchema: z.object({
        phase: z.number().int().min(1).max(7).optional(),
        add_completed: z.array(z.string()).optional().describe("Items to add to completed list"),
        note: z.string().optional().describe("Update last work note"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ phase, add_completed, note }) => {
      try {
        const state = loadState();

        if (phase !== undefined) state.currentPhase = phase;
        if (add_completed && add_completed.length > 0) {
          for (const item of add_completed) {
            if (!state.completedItems.includes(item)) {
              state.completedItems.push(item);
            }
          }
        }
        if (note !== undefined) state.lastNote = note;

        saveState(state);

        return {
          content: [{
            type: "text",
            text: `✅ 상태 업데이트 완료\n` +
              `  Phase: ${state.currentPhase}\n` +
              `  완료 항목: ${state.completedItems.length}개\n` +
              `  노트: ${state.lastNote}`,
          }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    }
  );

  // ── 함수 블록 읽기 ─────────────────────────────────────────
  server.registerTool(
    "reversal_read_function",
    {
      title: "Read Function Block from reversal.html",
      description: `Extract a specific JavaScript function from reversal.html without reading the entire file.
Token-efficient: returns only the requested function block.

Args:
  - path (string): Path to reversal.html
  - function_name (string): Function name to extract (e.g. "parseSegment", "checkInput", "renderPractice")

Returns:
  The complete function code block with line numbers.`,
      inputSchema: z.object({
        path: z.string().describe("Path to reversal.html"),
        function_name: z.string().describe("JavaScript function name to extract"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ path: filePath, function_name }) => {
      try {
        const resolved = path.resolve(filePath);
        if (!fs.existsSync(resolved)) {
          return { content: [{ type: "text", text: `Error: File not found: ${resolved}` }] };
        }
        const content = fs.readFileSync(resolved, "utf-8");
        const result = findJSFunction(content, function_name);

        if (!result) {
          return {
            content: [{
              type: "text",
              text: `Function "${function_name}" not found in ${resolved}\n` +
                `Tip: 함수 목록 확인은 fs_search_in_file로 "function "을 검색하세요.`,
            }],
          };
        }

        const lineCount = result.endLine - result.startLine + 1;
        return {
          content: [{
            type: "text",
            text: `[function ${function_name}] lines ${result.startLine}-${result.endLine} (${lineCount}줄)\n` +
              `${"─".repeat(60)}\n${result.code}`,
          }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    }
  );

  // ── 함수 블록 교체 ─────────────────────────────────────────
  server.registerTool(
    "reversal_replace_function",
    {
      title: "Replace Function Block in reversal.html",
      description: `Replace a specific JavaScript function in reversal.html with new code.
Finds the function by name and replaces the entire block in-place.

Args:
  - path (string): Path to reversal.html
  - function_name (string): Function name to replace
  - new_code (string): Complete replacement function code

Returns:
  Confirmation with line range of replaced block.

Warning: Creates a .bak backup before modifying.`,
      inputSchema: z.object({
        path: z.string().describe("Path to reversal.html"),
        function_name: z.string().describe("Function name to replace"),
        new_code: z.string().describe("Complete replacement function code"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ path: filePath, function_name, new_code }) => {
      try {
        const resolved = path.resolve(filePath);
        if (!fs.existsSync(resolved)) {
          return { content: [{ type: "text", text: `Error: File not found: ${resolved}` }] };
        }

        const content = fs.readFileSync(resolved, "utf-8");
        const result = findJSFunction(content, function_name);

        if (!result) {
          return {
            content: [{
              type: "text",
              text: `Function "${function_name}" not found. 먼저 reversal_read_function으로 함수명을 확인하세요.`,
            }],
          };
        }

        // .bak 백업 생성
        const bakPath = resolved + ".bak";
        fs.writeFileSync(bakPath, content, "utf-8");

        // 함수 교체
        const lines = content.split("\n");
        const newLines = [
          ...lines.slice(0, result.startLine - 1),
          new_code,
          ...lines.slice(result.endLine),
        ];
        fs.writeFileSync(resolved, newLines.join("\n"), "utf-8");

        return {
          content: [{
            type: "text",
            text: `✅ function ${function_name} 교체 완료\n` +
              `  교체 범위: lines ${result.startLine}-${result.endLine}\n` +
              `  백업: ${bakPath}`,
          }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    }
  );
}
