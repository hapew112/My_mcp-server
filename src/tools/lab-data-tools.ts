import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

const MAX_ROWS = 50; // 한 번에 가져올 최대 행 수 (토큰 절약)
const MAX_CHARS = 6000;

/** PSpice .out 파일 파서 */
function parsePSpiceOut(content: string): { nodes: Record<string, string>; currents: Record<string, string>; power: string | null } {
  const nodes: Record<string, string> = {};
  const currents: Record<string, string> = {};
  let power: string | null = null;

  const nodeMatch = content.match(/NODE VOLTAGES[\s\S]*?(?=\n\n|\nTOTAL|\z)/i);
  if (nodeMatch) {
    const nodeRegex = /\(([^)]+)\)\s+([\d.eE+\-]+)/g;
    let m: RegExpExecArray | null;
    while ((m = nodeRegex.exec(nodeMatch[0])) !== null) {
      nodes[m[1].trim()] = m[2].trim();
    }
  }

  const currentRegex = /V_[^\s]+\s+([\d.eE+\-]+)/gi;
  const currentMatch = content.match(/VOLTAGE SOURCE CURRENTS[\s\S]*?(?=\n\n|\z)/i);
  if (currentMatch) {
    let m: RegExpExecArray | null;
    while ((m = currentRegex.exec(currentMatch[0])) !== null) {
      currents[m[0].split(/\s+/)[0]] = m[1];
    }
  }

  const powerMatch = content.match(/TOTAL POWER DISSIPATION\s+([\d.eE+\-]+)/i);
  if (powerMatch) power = powerMatch[1];

  return { nodes, currents, power };
}

/** Excel/CSV 실험 데이터 도구 */
export function registerLabDataTools(server: McpServer): void {

  // ── Excel 시트 목록 ────────────────────────────────────────
  server.registerTool(
    "lab_excel_sheets",
    {
      title: "List Excel Sheet Names",
      description: `List all sheet names in an Excel (.xlsx/.xls) file without loading data.
Use this first to find which sheet contains what you need.

Args:
  - path (string): Path to Excel file

Returns:
  Sheet names list with row counts.`,
      inputSchema: z.object({
        path: z.string().describe("Path to .xlsx or .xls file"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ path: filePath }) => {
      try {
        const resolved = path.resolve(filePath);
        if (!fs.existsSync(resolved)) {
          return { content: [{ type: "text", text: `Error: File not found: ${resolved}` }] };
        }
        const wb = XLSX.readFile(resolved);
        const info = wb.SheetNames.map((name) => {
          const ws = wb.Sheets[name];
          const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
          const rows = range.e.r - range.s.r + 1;
          const cols = range.e.c - range.s.c + 1;
          return `  📊 "${name}"  (${rows} rows × ${cols} cols)`;
        });
        return { content: [{ type: "text", text: `[${resolved}]\n${info.join("\n")}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    }
  );

  // ── Excel 데이터 읽기 (행 범위 지정) ──────────────────────
  server.registerTool(
    "lab_excel_read",
    {
      title: "Read Excel Sheet Data",
      description: `Read data from a specific Excel sheet with optional row range.
Default limit is ${MAX_ROWS} rows to keep token usage low.

Args:
  - path (string): Excel file path
  - sheet (string, optional): Sheet name (default: first sheet)
  - start_row (number, optional): Start row (1-indexed, default: 1)
  - end_row (number, optional): End row (default: first ${MAX_ROWS} rows)
  - columns (string[], optional): Column names/letters to include (e.g. ["A","B"] or ["Voltage","Current"])

Returns:
  Tab-separated data with column headers.`,
      inputSchema: z.object({
        path: z.string().describe("Excel file path"),
        sheet: z.string().optional().describe("Sheet name (default: first sheet)"),
        start_row: z.number().int().min(1).default(1),
        end_row: z.number().int().min(1).optional(),
        columns: z.array(z.string()).optional().describe("Column letters or header names to include"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ path: filePath, sheet, start_row, end_row, columns }) => {
      try {
        const resolved = path.resolve(filePath);
        if (!fs.existsSync(resolved)) {
          return { content: [{ type: "text", text: `Error: File not found: ${resolved}` }] };
        }
        const wb = XLSX.readFile(resolved);
        const sheetName = sheet ?? wb.SheetNames[0];
        if (!wb.SheetNames.includes(sheetName)) {
          return { content: [{ type: "text", text: `Error: Sheet "${sheetName}" not found. Available: ${wb.SheetNames.join(", ")}` }] };
        }

        const ws = wb.Sheets[sheetName];
        const allData: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
        const headers = allData[0] as string[];

        const from = start_row - 1; // 0-indexed
        const to = Math.min(end_row ?? from + MAX_ROWS, allData.length);
        const slice = allData.slice(from, to);

        // 컬럼 필터링
        let colIndexes: number[] = headers.map((_, i) => i);
        if (columns && columns.length > 0) {
          colIndexes = columns.map(c => {
            const byName = headers.findIndex(h => String(h).toLowerCase() === c.toLowerCase());
            if (byName >= 0) return byName;
            // Excel 열 문자로 시도 (A=0, B=1, ...)
            const colNum = XLSX.utils.decode_col(c.toUpperCase());
            return colNum >= 0 ? colNum : -1;
          }).filter(i => i >= 0);
        }

        const filteredHeaders = colIndexes.map(i => headers[i] ?? `Col${i + 1}`);
        const rows = slice.map(row => colIndexes.map(i => String((row as unknown[])[i] ?? "")).join("\t"));

        let output = `[${sheetName}] rows ${from + 1}-${to - 1} of ${allData.length - 1} data rows\n`;
        output += filteredHeaders.join("\t") + "\n";
        output += "─".repeat(Math.min(60, filteredHeaders.join("\t").length)) + "\n";
        output += rows.slice(1).join("\n"); // 헤더 행 제외

        if (output.length > MAX_CHARS) output = output.slice(0, MAX_CHARS) + "\n...(truncated, use end_row to paginate)";
        return { content: [{ type: "text", text: output }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    }
  );

  // ── PSpice .out 파일 파싱 ──────────────────────────────────
  server.registerTool(
    "lab_pspice_parse",
    {
      title: "Parse PSpice Output File",
      description: `Parse a PSpice simulation .out file and extract node voltages, branch currents, and total power.
Much more token-efficient than reading the raw .out file.

Args:
  - path (string): Path to PSpice .out file

Returns:
  Structured summary of node voltages, currents, and power dissipation.`,
      inputSchema: z.object({
        path: z.string().describe("Path to .out PSpice output file"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ path: filePath }) => {
      try {
        const resolved = path.resolve(filePath);
        if (!fs.existsSync(resolved)) {
          return { content: [{ type: "text", text: `Error: File not found: ${resolved}` }] };
        }
        const content = fs.readFileSync(resolved, "utf-8");
        const { nodes, currents, power } = parsePSpiceOut(content);

        let out = `📊 PSpice Results: ${path.basename(resolved)}\n${"─".repeat(50)}\n`;

        out += "\n🔌 NODE VOLTAGES:\n";
        if (Object.keys(nodes).length === 0) {
          out += "  (none found — check if .op simulation was run)\n";
        } else {
          for (const [node, voltage] of Object.entries(nodes)) {
            out += `  ${node.padEnd(12)} = ${voltage} V\n`;
          }
        }

        out += "\n⚡ BRANCH CURRENTS:\n";
        if (Object.keys(currents).length === 0) {
          out += "  (none found)\n";
        } else {
          for (const [src, current] of Object.entries(currents)) {
            out += `  ${src.padEnd(12)} = ${current} A\n`;
          }
        }

        out += `\n🔥 TOTAL POWER: ${power ?? "(not found)"} W\n`;
        return { content: [{ type: "text", text: out }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    }
  );

  // ── 실험 데이터 요약 통계 ──────────────────────────────────
  server.registerTool(
    "lab_excel_summary",
    {
      title: "Get Excel Column Statistics",
      description: `Compute summary statistics (min, max, mean, count) for numeric columns in an Excel sheet.
Use this to understand data range before deciding what rows to load.

Args:
  - path (string): Excel file path
  - sheet (string, optional): Sheet name
  - columns (string[], optional): Column headers to analyze (default: all numeric columns)

Returns:
  Statistics table for each numeric column.`,
      inputSchema: z.object({
        path: z.string(),
        sheet: z.string().optional(),
        columns: z.array(z.string()).optional(),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ path: filePath, sheet, columns }) => {
      try {
        const resolved = path.resolve(filePath);
        if (!fs.existsSync(resolved)) {
          return { content: [{ type: "text", text: `Error: File not found: ${resolved}` }] };
        }
        const wb = XLSX.readFile(resolved);
        const sheetName = sheet ?? wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const allData: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
        const headers = allData[0] as string[];
        const rows = allData.slice(1) as unknown[][];

        const targetCols = columns
          ? headers.map((h, i) => ({ name: h, idx: i })).filter(c => columns.includes(String(c.name)))
          : headers.map((h, i) => ({ name: h, idx: i }));

        let out = `📊 Statistics: ${sheetName} (${rows.length} rows)\n${"─".repeat(50)}\n`;
        out += `${"Column".padEnd(20)} ${"Count".padStart(6)} ${"Min".padStart(12)} ${"Max".padStart(12)} ${"Mean".padStart(12)}\n`;
        out += "─".repeat(65) + "\n";

        for (const col of targetCols) {
          const values = rows
            .map(r => parseFloat(String((r as unknown[])[col.idx])))
            .filter(v => !isNaN(v));
          if (values.length === 0) continue;
          const min = Math.min(...values);
          const max = Math.max(...values);
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          out += `${String(col.name).padEnd(20)} ${String(values.length).padStart(6)} ${min.toExponential(3).padStart(12)} ${max.toExponential(3).padStart(12)} ${mean.toExponential(3).padStart(12)}\n`;
        }

        return { content: [{ type: "text", text: out }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    }
  );
}
