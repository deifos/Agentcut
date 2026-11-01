import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { dirname, extname, resolve } from "node:path";
import {
  atomicWrite,
  hashText,
  projectDir,
  safeJoin,
  StudioError,
  writeLayers,
  writeProjectFile,
} from "./projects.js";
import { TEMPLATE_DIR, type WorkspacePaths } from "./workspace.js";

export type McpFileScope = "project" | "library" | "toolkit" | "source";
type Scope = McpFileScope;
const TEXT_EXTENSIONS = new Set([
  ".tsx",
  ".ts",
  ".jsx",
  ".js",
  ".json",
  ".md",
  ".svg",
  ".txt",
  ".css",
]);
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_COPY_BYTES = 512 * 1024 * 1024;

function rootFor(
  paths: WorkspacePaths,
  scope: Scope,
  slug?: string,
  sourceRoot?: string,
) {
  if (scope === "project") {
    const dir = projectDir(paths, slug ?? "");
    if (!existsSync(safeJoin(dir, "project.json")))
      throw new StudioError(
        "Project does not exist. Create it first.",
        "not_found",
      );
    return dir;
  }
  if (scope === "library") return paths.library;
  if (scope === "toolkit") return TEMPLATE_DIR;
  if (scope === "source" && sourceRoot) return sourceRoot;
  if (scope === "source")
    throw new StudioError(
      "Select a source ID from agentcut_sources. Source folders must be configured with the helper's --add-dir option.",
      "bad_path",
    );
  throw new StudioError("Unknown file scope.", "bad_path");
}

function visiblePath(path: string, scope: Scope) {
  const parts = path.replaceAll("\\", "/").split("/");
  if (
    parts.some((part) => part.startsWith(".") || part.includes(":")) ||
    path.startsWith("/") ||
    path.startsWith("\\")
  ) {
    throw new StudioError(
      "Use a relative visible project or library path. Hidden files are not exposed.",
      "bad_path",
    );
  }
  if (scope === "toolkit" && !["components", "runtime"].includes(parts[0])) {
    throw new StudioError(
      "Toolkit files are under components/ or runtime/.",
      "bad_path",
    );
  }
  return parts.join("/");
}

function writable(path: string) {
  if (
    !["project.json", "layers.json", "notes.md"].includes(path) &&
    !/^(scenes|assets)\//.test(path)
  ) {
    throw new StudioError(
      "Write project.json, layers.json, notes.md, scenes/ or assets/ only.",
      "bad_path",
    );
  }
}

function filePath(root: string, path: string) {
  const full = safeJoin(root, path);
  const boundary = resolve(root);
  // An in-root link can still expose hidden chat files or bypass manifest
  // validation. MCP file access accepts ordinary paths only.
  for (let part = full; part !== boundary; part = dirname(part)) {
    if (existsSync(part) && lstatSync(part).isSymbolicLink())
      throw new StudioError("Linked paths are not exposed through MCP file tools.", "bad_path");
  }
  return full;
}

export function listMcpFiles(
  paths: WorkspacePaths,
  scope: Scope,
  slug?: string,
  path = "",
  offset = 0,
  limit = 100,
  sourceRoot?: string,
) {
  const root = rootFor(paths, scope, slug, sourceRoot);
  const relative = visiblePath(
    path || (scope === "toolkit" ? "components" : ""),
    scope,
  );
  const dir = filePath(root, relative);
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    scope,
    project: slug,
    path: relative,
    total: entries.length,
    nextOffset: offset + limit < entries.length ? offset + limit : null,
    entries: entries
      .slice(offset, offset + limit)
      .map((entry) => {
        const path = relative ? `${relative}/${entry.name}` : entry.name;
        // Recheck links before reading metadata. Out-of-scope links are not listed.
        try {
          const full = filePath(root, path);
          const info = statSync(full);
          return {
            path,
            kind: info.isDirectory() ? "directory" : "file",
            bytes: info.isFile() ? info.size : undefined,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean),
  };
}

export function readMcpFile(
  paths: WorkspacePaths,
  scope: Scope,
  slug: string | undefined,
  path: string,
  sourceRoot?: string,
) {
  const relative = visiblePath(path, scope);
  const file = filePath(rootFor(paths, scope, slug, sourceRoot), relative);
  if (!TEXT_EXTENSIONS.has(extname(relative).toLowerCase()))
    throw new StudioError(
      "This tool reads text files only. Use media tools for audio/video and copy_file to reuse binary assets.",
    );
  if (statSync(file).size > MAX_TEXT_BYTES)
    throw new StudioError("Text file exceeds 2 MiB.");
  const content = readFileSync(file, "utf8");
  return {
    scope,
    project: slug,
    path: relative,
    content,
    hash: hashText(content),
  };
}

export function writeMcpFile(
  paths: WorkspacePaths,
  slug: string,
  path: string,
  content: string,
  baseHash: string | null,
) {
  const relative = visiblePath(path, "project");
  writable(relative);
  if (
    !TEXT_EXTENSIONS.has(extname(relative).toLowerCase()) ||
    Buffer.byteLength(content) > MAX_TEXT_BYTES
  )
    throw new StudioError("Write text source files up to 2 MiB.");
  const file = filePath(rootFor(paths, "project", slug), relative);
  const current = existsSync(file)
    ? hashText(readFileSync(file, "utf8"))
    : null;
  if (current !== baseHash)
    throw new StudioError(
      "File changed or already exists. Read it again and use its current hash; null only creates a new file.",
      "conflict",
    );
  mkdirSync(dirname(file), { recursive: true });
  if (relative === "layers.json")
    writeLayers(paths, slug, JSON.parse(content), baseHash);
  else if (relative === "project.json")
    writeProjectFile(paths, slug, JSON.parse(content));
  else atomicWrite(file, content);
  const saved = readMcpFile(paths, "project", slug, relative);
  return {
    project: slug,
    path: relative,
    hash: saved.hash,
    bytes: Buffer.byteLength(saved.content),
  };
}

export function copyMcpFile(
  paths: WorkspacePaths,
  scope: Scope,
  sourceProject: string | undefined,
  source: string,
  slug: string,
  destination: string,
  sourceRoot?: string,
) {
  const sourcePath = visiblePath(source, scope);
  const targetPath = visiblePath(destination, "project");
  if (!/^(scenes|assets)\//.test(targetPath))
    throw new StudioError("Copy into scenes/ or assets/ only.", "bad_path");
  if (targetPath.startsWith("scenes/") && !/\.(tsx?|jsx?)$/.test(targetPath))
    throw new StudioError("Scene files must be TypeScript or JavaScript.");
  const from = filePath(
    rootFor(paths, scope, sourceProject, sourceRoot),
    sourcePath,
  );
  const to = filePath(rootFor(paths, "project", slug), targetPath);
  const info = statSync(from);
  if (!info.isFile() || info.size > MAX_COPY_BYTES)
    throw new StudioError("Copy one file up to 512 MiB per call.");
  mkdirSync(dirname(to), { recursive: true });
  // COPYFILE_EXCL: never silently overwrite hand edits or an existing asset.
  copyFileSync(from, to, 1);
  return { project: slug, path: targetPath, bytes: info.size };
}
