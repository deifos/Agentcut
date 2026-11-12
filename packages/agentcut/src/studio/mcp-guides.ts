import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TEMPLATE_DIR } from "./workspace.js";

export const MCP_INSTRUCTIONS = `Agentcut creates editable videos with the same skills, components, music, SFX, voice and review tools as its built-in chat. Start with agentcut_capabilities, read agentcut_guide (SKILL.md), then agentcut_status. Read the relevant supporting guides before creating scenes or sound. Use project file tools if you cannot access the helper's local files. Keep the full creative and review process. Catalogs, imports, rendering and audio review need the connected studio page; configured generation providers may incur charges. The release announcement prototype is a separate limited workflow, not the default for all video requests.`;

function guides() {
  return [
    "SKILL.md",
    ...readdirSync(join(TEMPLATE_DIR, "skill", "references"))
      .filter((name) => name.endsWith(".md"))
      .sort()
      .map((name) => `references/${name}`),
  ];
}

export function readGuide(path: string) {
  if (!guides().includes(path))
    throw new Error(
      "Unknown guide. Call agentcut_guide without path to list guides.",
    );
  return readFileSync(join(TEMPLATE_DIR, "skill", path), "utf8");
}

export function registerAgentGuides(server: McpServer) {
  server.registerTool(
    "agentcut_capabilities",
    {
      description:
        "Start here. Discover Agentcut's full creative workflow, tools and skill guides, including music, SFX, animated components, voice, project editing, templates and review. This is a capability index, not a live provider or page health check; call status and provider options next.",
      inputSchema: {},
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              instructions: MCP_INSTRUCTIONS,
              guides: guides(),
              fileScopes: {
                project:
                  "Editable project files and assets. Write with the hash from read_file; null creates a new file.",
                library:
                  "Shared assets, video preset kits under presets/, and reusable editing-rule prompts under editing-styles/. Read editing-styles/<id>/PROMPT.md to apply rules to new footage; save with agentcut_save_editing_style. Kits use copy_file for scenes/assets.",
                toolkit:
                  "Packaged components, styles and runtime. Read components/STYLES.md, components/cinematic/ and runtime/helpers.tsx.",
                source:
                  "Read-only app/source folders already configured with the helper's --add-dir option. Discover IDs with agentcut_sources; use source for list/read and sourceRoot for copy.",
              },
              availability: {
                offline:
                  "Skill guides and this index work without a helper or editor.",
                helper:
                  "Project files, library, voice/music generation and transcription options need the local helper.",
                page: "Music/SFX/b-roll catalogs and imports, component examples, capture, audio review, preview and export need a connected studio page.",
                providers:
                  "Voice, generated music and cloud transcription need configured provider keys. Options tools report availability without exposing keys.",
              },
              next: [
                "Read SKILL.md with agentcut_guide",
                "Call agentcut_status",
                "Read relevant guides, then use the complete creative and review workflow",
              ],
            },
          ),
        },
      ],
    }),
  );
  server.registerTool(
    "agentcut_guide",
    {
      description:
        "Read Agentcut's packaged skill and supporting guides through MCP. No file-system access or editor needed. Omit path/paths for the guide index; use path for one guide or paths for up to six known independent guides (96,000 characters total). Read SKILL.md first, then only relevant supporting guides.",
      inputSchema: { path: z.string().optional(), paths: z.array(z.string()).min(1).max(6).optional() },
    },
    async ({ path, paths }) => {
      if (path && paths) throw new Error("Use path for one guide or paths for a batch, not both.");
      if (paths) {
        const batch = paths.map(path => ({ path, content: readGuide(path) }));
        if (batch.reduce((sum, file) => sum + file.content.length, 0) > 96_000) throw new Error("Guide batch exceeds 96,000 characters. Request fewer relevant guides.");
        return { content: [{ type: "text" as const, text: JSON.stringify({ guides: batch }) }] };
      }
      return ({
      content: [
        {
          type: "text",
          text: path
            ? readGuide(path)
            : JSON.stringify({ guides: guides(), first: "SKILL.md" }),
        },
      ],
      });
    },
  );
  for (const path of guides()) {
    const uri = `agentcut://guide/${path}`;
    server.registerResource(
      `guide:${path}`,
      uri,
      {
        title: path === "SKILL.md" ? "Agentcut video skill" : path,
        description:
          "The same creative instructions shipped to Agentcut's built-in chat.",
        mimeType: "text/markdown",
      },
      async () => ({
        contents: [{ uri, mimeType: "text/markdown", text: readGuide(path) }],
      }),
    );
  }
}
