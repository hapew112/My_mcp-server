import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const MAX_CHARS = 6000;

/** Jarvis Discord 봇 (Raspberry Pi) 관련 도구 */
export function registerJarvisTools(server: McpServer): void {

  // ── 봇 상태 확인 ───────────────────────────────────────────
  server.registerTool(
    "jarvis_status",
    {
      title: "Check Jarvis Bot Status",
      description: `Check if the Jarvis Discord bot process is running on this machine.
Looks for Python processes running bot.py or jarvis.py.

Returns:
  Process status, PID, and uptime if running.`,
      inputSchema: z.object({
        bot_script: z.string().default("bot.py").describe("Bot script filename to look for"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ bot_script }) => {
      try {
        const isWindows = process.platform === "win32";
        if (isWindows) {
          // wmic으로 python 프로세스 커맨드라인 확인
          const wmicOut = execSync(
            `wmic process where "name='python.exe' or name='python3.exe'" get commandline /format:list`,
            { encoding: "utf-8" }
          );
          const lines = wmicOut.split("\n").filter(l => l.toLowerCase().includes(bot_script.toLowerCase()));
          if (lines.length === 0) {
            return { content: [{ type: "text", text: `⚫ Jarvis bot (${bot_script}) is NOT running.` }] };
          }
          return { content: [{ type: "text", text: `🟢 Jarvis bot is running:\n${lines.join("\n")}` }] };
        } else {
          const result = execSync(`ps aux | grep "${bot_script}" | grep -v grep`, { encoding: "utf-8" }).trim();
          if (!result) {
            return { content: [{ type: "text", text: `⚫ Jarvis bot (${bot_script}) is NOT running.` }] };
          }
          return { content: [{ type: "text", text: `🟢 Jarvis bot is running:\n${result}` }] };
        }
      } catch {
        return { content: [{ type: "text", text: `⚫ Jarvis bot (${bot_script}) is NOT running.` }] };
      }
    }
  );

  // ── 봇 코드 요약 (전체 파일 대신 함수 목록만) ──────────────
  server.registerTool(
    "jarvis_code_outline",
    {
      title: "Get Jarvis Bot Code Outline",
      description: `Extract function/class/command definitions from the bot source file without loading the full code.
Token-efficient alternative to reading the entire bot.py.

Args:
  - path (string): Path to the bot Python file

Returns:
  List of def/class/command definitions with line numbers. Much smaller than full file.`,
      inputSchema: z.object({
        path: z.string().describe("Path to bot .py file"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ path: filePath }) => {
      try {
        const resolved = path.resolve(filePath);
        if (!fs.existsSync(resolved)) {
          return { content: [{ type: "text", text: `Error: File not found: ${resolved}` }] };
        }
        const lines = fs.readFileSync(resolved, "utf-8").split("\n");
        const outline: string[] = [`📋 Code outline: ${resolved}\n${"─".repeat(60)}`];

        lines.forEach((line, i) => {
          const trimmed = line.trimStart();
          const indent = line.length - trimmed.length;
          const indentStr = " ".repeat(indent);

          // Python def, class, @bot.command, @bot.event 감지
          if (/^(async\s+)?def\s+/.test(trimmed)) {
            const name = trimmed.match(/def\s+(\w+)/)?.[1] ?? "?";
            outline.push(`${String(i + 1).padStart(4)}: ${indentStr}🔧 def ${name}()`);
          } else if (/^class\s+/.test(trimmed)) {
            const name = trimmed.match(/class\s+(\w+)/)?.[1] ?? "?";
            outline.push(`${String(i + 1).padStart(4)}: ${indentStr}🏛  class ${name}`);
          } else if (/@bot\.(command|event|listen)/.test(trimmed)) {
            outline.push(`${String(i + 1).padStart(4)}: ${indentStr}🤖 ${trimmed.slice(0, 60)}`);
          } else if (/^import\s+|^from\s+/.test(trimmed) && i < 30) {
            outline.push(`${String(i + 1).padStart(4)}: ${indentStr}📦 ${trimmed.slice(0, 60)}`);
          }
        });

        outline.push(`\n총 ${lines.length}줄 | ${outline.length - 2}개 심볼 발견`);
        return { content: [{ type: "text", text: outline.join("\n") }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    }
  );

  // ── 명령어 코드만 추출 ─────────────────────────────────────
  server.registerTool(
    "jarvis_get_command",
    {
      title: "Get Specific Bot Command Code",
      description: `Extract the code block for a specific Discord bot command from the bot file.
More token-efficient than reading the full file when you only need one command.

Args:
  - path (string): Path to bot .py file
  - command_name (string): Command name (e.g. "날씨", "주간날씨", "help")

Returns:
  The code for that specific command function only.`,
      inputSchema: z.object({
        path: z.string().describe("Path to bot .py file"),
        command_name: z.string().describe("Bot command name to extract"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ path: filePath, command_name }) => {
      try {
        const resolved = path.resolve(filePath);
        if (!fs.existsSync(resolved)) {
          return { content: [{ type: "text", text: `Error: File not found: ${resolved}` }] };
        }
        const lines = fs.readFileSync(resolved, "utf-8").split("\n");

        // 명령어 시작 라인 찾기
        let startLine = -1;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (
            line.includes(`@bot.command`) && lines[i + 1]?.includes(`def ${command_name}`) ||
            line.includes(`name="${command_name}"`) ||
            line.includes(`def ${command_name}(`)
          ) {
            startLine = i;
            break;
          }
        }

        if (startLine === -1) {
          return { content: [{ type: "text", text: `Command "${command_name}" not found in ${filePath}` }] };
        }

        // 함수 블록 끝 찾기 (들여쓰기 기반)
        const baseIndent = lines[startLine].length - lines[startLine].trimStart().length;
        let endLine = startLine + 1;
        while (endLine < lines.length) {
          const line = lines[endLine];
          if (line.trim() === "") { endLine++; continue; }
          const indent = line.length - line.trimStart().length;
          if (indent <= baseIndent && endLine > startLine + 1) break;
          endLine++;
        }

        const extracted = lines.slice(startLine, endLine)
          .map((line, i) => `${String(startLine + i + 1).padStart(4)}: ${line}`)
          .join("\n");

        return { content: [{ type: "text", text: `[Command: ${command_name}] lines ${startLine + 1}-${endLine}\n${"─".repeat(60)}\n${extracted}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    }
  );

  // ── pip 패키지 목록 ────────────────────────────────────────
  server.registerTool(
    "jarvis_list_packages",
    {
      title: "List Python Packages",
      description: `List installed Python packages in the bot's environment.
Useful to check if discord.py, python-dotenv, requests etc. are installed.

Args:
  - python_path (string, optional): Path to python executable (default: 'python3')
  - filter (string, optional): Filter by package name substring

Returns:
  List of installed packages with versions.`,
      inputSchema: z.object({
        python_path: z.string().default("python").describe("Python executable path (Windows: 'python', Linux/Mac: 'python3')"),
        filter: z.string().optional().describe("Filter packages by name substring"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ python_path, filter }) => {
      try {
        let output = execSync(`${python_path} -m pip list --format=columns`, { encoding: "utf-8" });
        if (filter) {
          const lines = output.split("\n");
          output = [lines[0], lines[1], ...lines.slice(2).filter(l => l.toLowerCase().includes(filter.toLowerCase()))].join("\n");
        }
        if (output.length > MAX_CHARS) output = output.slice(0, MAX_CHARS) + "\n...(truncated)";
        return { content: [{ type: "text", text: output }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error running pip list: ${String(err)}` }] };
      }
    }
  );
}
