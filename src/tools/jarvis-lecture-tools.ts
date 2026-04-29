import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "fs";
import path from "path";

const GEMINI_MD_PATH = "/home/hapew112/jarvis-lecture/GEMINI.md";

export function registerJarvisLectureTools(server: McpServer): void {
  // ── 1. Jarvis-Lecture 상태 확인 ──────────────────────────────
  server.registerTool(
    "jarvis_lecture_get_state",
    {
      title: "Get Jarvis-Lecture Project State",
      description: `Get current roadmap and progress for the Jarvis-Lecture project.
Shows current phase, completed items, and engineering standards.

Returns:
  The Engineering Standards and the Roadmap & Status from GEMINI.md.`,
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      try {
        if (!fs.existsSync(GEMINI_MD_PATH)) {
          return { content: [{ type: "text", text: `Error: ${GEMINI_MD_PATH} not found.` }] };
        }
        const content = fs.readFileSync(GEMINI_MD_PATH, "utf-8");
        return { content: [{ type: "text", text: content }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    }
  );

  // ── 2. Jarvis-Lecture 체크리스트 업데이트 ──────────────────────
  server.registerTool(
    "jarvis_lecture_set_state",
    {
      title: "Update Jarvis-Lecture State",
      description: `Update the checklist progress for Jarvis-Lecture project in GEMINI.md.
Use this to track which phase you're on and what's been completed.

Args:
  - add_completed (string[]): Exact task strings to mark as completed (e.g. ["에빙하우스 망각곡선 기반 복습 스케줄러"])

Example:
  { "add_completed": ["에빙하우스 망각곡선 기반 복습 스케줄러"] }`,
      inputSchema: z.object({
        add_completed: z.array(z.string()).describe("Items to mark as completed in GEMINI.md"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ add_completed }) => {
      try {
        if (!fs.existsSync(GEMINI_MD_PATH)) {
          return { content: [{ type: "text", text: `Error: ${GEMINI_MD_PATH} not found.` }] };
        }
        let content = fs.readFileSync(GEMINI_MD_PATH, "utf-8");
        let updatedCount = 0;

        for (const item of add_completed) {
          // Find the unchecked item and check it: "- [ ] item" -> "- [x] item"
          const regex = new RegExp(`-\\s*\\[\\s*\\]\\s*${item.replace(/[.*+?^$\\{}()|[\\]\\\\]/g, '\\\\$&')}`, 'g');
          if (regex.test(content)) {
            content = content.replace(regex, `- [x] ${item}`);
            updatedCount++;
          }
        }

        if (updatedCount > 0) {
          fs.writeFileSync(GEMINI_MD_PATH, content, "utf-8");
          return { content: [{ type: "text", text: `✅ Successfully marked ${updatedCount} items as completed in GEMINI.md.` }] };
        } else {
          return { content: [{ type: "text", text: `⚠️ No matching unchecked items found for: ${add_completed.join(", ")}` }] };
        }
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${String(err)}` }] };
      }
    }
  );
}
