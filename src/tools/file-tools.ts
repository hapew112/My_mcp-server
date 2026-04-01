import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "fs";
import path from "path";

const MAX_CHARS = 8000; // 토큰 최적화: 응답 크기 제한

/** 파일 내용을 읽되, 라인 범위 지정으로 필요한 부분만 추출 */
export function registerFileTools(server: McpServer): void {

  // ── 파일 읽기 (범위 지정 지원) ──────────────────────────────
  server.registerTool(
    "fs_read_file",
    {
      title: "Read File (with optional line range)",
      description: `Read a local file. Supports line range to fetch only the needed section — critical for token efficiency.

Args:
  - path (string): Absolute or relative file path
  - start_line (number, optional): First line to read (1-indexed, default: 1)
  - end_line (number, optional): Last line to read (inclusive, default: entire file)
  - encoding (string, optional): File encoding (default: 'utf-8')

Returns:
  File content as text with line numbers. Truncated at ${MAX_CHARS} chars with a notice.

Examples:
  - Read entire file: { "path": "src/bot.py" }
  - Read lines 50-100: { "path": "src/bot.py", "start_line": 50, "end_line": 100 }
  - Read first 30 lines to get overview: { "path": "src/bot.py", "end_line": 30 }`,
      inputSchema: z.object({
        path: z.string().describe("File path to read"),
        start_line: z.number().int().min(1).optional().describe("Start line (1-indexed)"),
        end_line: z.number().int().min(1).optional().describe("End line (inclusive)"),
        encoding: z.enum(["utf-8", "ascii", "latin1"]).default("utf-8").describe("File encoding"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ path: filePath, start_line, end_line, encoding }) => {
      try {
        const resolved = path.resolve(filePath);
        if (!fs.existsSync(resolved)) {
          return { content: [{ type: "text", text: `Error: File not found: ${resolved}` }] };
        }
        const raw = fs.readFileSync(resolved, encoding as BufferEncoding);
        const lines = raw.split("\n");
        const totalLines = lines.length;

        const from = (start_line ?? 1) - 1;
        const to = end_line !== undefined ? Math.min(end_line, totalLines) : totalLines;
        const selected = lines.slice(from, to);

        let output = selected
          .map((line, i) => `${String(from + i + 1).padStart(4)}: ${line}`)
          .join("\n");

        let truncated = false;
        if (output.length > MAX_CHARS) {
          output = output.slice(0, MAX_CHARS);
          truncated = true;
        }

        const header = `[${resolved}] lines ${from + 1}-${to} of ${totalLines}${truncated ? " (TRUNCATED)" : ""}\n${"─".repeat(60)}\n`;
        return { content: [{ type: "text", text: header + output }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error reading file: ${String(err)}` }] };
      }
    }
  );

  // ── 파일 검색 ──────────────────────────────────────────────
  server.registerTool(
    "fs_search_in_file",
    {
      title: "Search Text in File",
      description: `Search for a keyword/pattern in a file. Returns matching lines with context — avoids loading the whole file.

Args:
  - path (string): File path to search
  - query (string): Text to search for (case-insensitive by default)
  - context_lines (number, optional): Lines of context before/after each match (default: 2)
  - case_sensitive (boolean, optional): Default false

Returns:
  Matching lines with surrounding context and line numbers.`,
      inputSchema: z.object({
        path: z.string().describe("File path"),
        query: z.string().min(1).describe("Search keyword or text"),
        context_lines: z.number().int().min(0).max(10).default(2),
        case_sensitive: z.boolean().default(false),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ path: filePath, query, context_lines, case_sensitive }) => {
      try {
        const resolved = path.resolve(filePath);
        if (!fs.existsSync(resolved)) {
          return { content: [{ type: "text", text: `Error: File not found: ${resolved}` }] };
        }
        const lines = fs.readFileSync(resolved, "utf-8").split("\n");
        const matchFlag = case_sensitive ? "" : "i";
        const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), matchFlag);

        const matchIndexes: number[] = [];
        lines.forEach((line, i) => { if (regex.test(line)) matchIndexes.push(i); });

        if (matchIndexes.length === 0) {
          return { content: [{ type: "text", text: `No matches for "${query}" in ${filePath}` }] };
        }

        // 컨텍스트 영역 병합
        const ranges: Array<[number, number]> = [];
        for (const idx of matchIndexes) {
          const s = Math.max(0, idx - context_lines);
          const e = Math.min(lines.length - 1, idx + context_lines);
          if (ranges.length && s <= ranges[ranges.length - 1][1] + 1) {
            ranges[ranges.length - 1][1] = e;
          } else {
            ranges.push([s, e]);
          }
        }

        let result = `[${resolved}] ${matchIndexes.length} match(es) for "${query}"\n${"─".repeat(60)}\n`;
        for (const [s, e] of ranges) {
          for (let i = s; i <= e; i++) {
            const marker = regex.test(lines[i]) ? "►" : " ";
            result += `${marker}${String(i + 1).padStart(4)}: ${lines[i]}\n`;
          }
          result += "\n";
        }

        if (result.length > MAX_CHARS) result = result.slice(0, MAX_CHARS) + "\n...(truncated)";
        return { content: [{ type: "text", text: result }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    }
  );

  // ── 디렉토리 목록 ──────────────────────────────────────────
  server.registerTool(
    "fs_list_dir",
    {
      title: "List Directory Contents",
      description: `List files and folders in a directory with metadata (size, modified date).

Args:
  - path (string): Directory path
  - recursive (boolean, optional): Recurse into subdirectories (default: false)
  - pattern (string, optional): Glob-style filter e.g. "*.py", "*.ts"

Returns:
  Tree-style listing with file sizes and modification times.`,
      inputSchema: z.object({
        path: z.string().default(".").describe("Directory path"),
        recursive: z.boolean().default(false),
        pattern: z.string().optional().describe("File extension filter e.g. '.py' or '.ts'"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ path: dirPath, recursive, pattern }) => {
      try {
        const resolved = path.resolve(dirPath);
        if (!fs.existsSync(resolved)) {
          return { content: [{ type: "text", text: `Error: Directory not found: ${resolved}` }] };
        }

        const lines: string[] = [`[${resolved}]\n`];

        function walk(dir: string, indent: string): void {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.name.startsWith(".")) continue; // hidden 파일 제외
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              lines.push(`${indent}📁 ${entry.name}/`);
              if (recursive) walk(fullPath, indent + "  ");
            } else {
              if (pattern && !entry.name.endsWith(pattern)) continue;
              const stat = fs.statSync(fullPath);
              const size = stat.size < 1024 ? `${stat.size}B` : `${(stat.size / 1024).toFixed(1)}KB`;
              const mtime = stat.mtime.toISOString().slice(0, 10);
              lines.push(`${indent}📄 ${entry.name}  (${size}, ${mtime})`);
            }
          }
        }

        walk(resolved, "  ");
        let output = lines.join("\n");
        if (output.length > MAX_CHARS) output = output.slice(0, MAX_CHARS) + "\n...(truncated)";
        return { content: [{ type: "text", text: output }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    }
  );

  // ── 파일 쓰기 ──────────────────────────────────────────────
  server.registerTool(
    "fs_write_file",
    {
      title: "Write or Append to File",
      description: `Write content to a file. Supports create/overwrite/append modes.

Args:
  - path (string): File path to write
  - content (string): Content to write
  - mode ('overwrite' | 'append'): Write mode (default: 'overwrite')
  - create_dirs (boolean): Create parent directories if missing (default: true)

Returns:
  Confirmation with bytes written.`,
      inputSchema: z.object({
        path: z.string().describe("File path"),
        content: z.string().describe("Content to write"),
        mode: z.enum(["overwrite", "append"]).default("overwrite"),
        create_dirs: z.boolean().default(true),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ path: filePath, content, mode, create_dirs }) => {
      try {
        const resolved = path.resolve(filePath);
        if (create_dirs) {
          fs.mkdirSync(path.dirname(resolved), { recursive: true });
        }
        const flag = mode === "append" ? "a" : "w";
        fs.writeFileSync(resolved, content, { flag, encoding: "utf-8" });
        const bytes = Buffer.byteLength(content, "utf-8");
        return { content: [{ type: "text", text: `✅ ${mode === "append" ? "Appended" : "Written"} ${bytes} bytes to ${resolved}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    }
  );
}
