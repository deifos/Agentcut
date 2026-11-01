import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { WorkspacePaths } from "./workspace.js";
import { safeJoin, StudioError } from "./projects.js";

export const editingStyleInput = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500),
  prompt: z.string().trim().min(1).max(64_000),
});

/** Remove from the shared library; retain the files in private workspace trash. */
export function deleteEditingStyle(paths: WorkspacePaths, input: unknown) {
  const id = z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,63}$/)
    .parse(input);
  const root = safeJoin(paths.library, "editing-styles");
  const dir = safeJoin(root, id);
  if (
    lstatSync(root).isSymbolicLink() ||
    lstatSync(dir).isSymbolicLink() ||
    !lstatSync(dir).isDirectory()
  )
    throw new StudioError(
      "Only saved editing style folders can be deleted.",
      "bad_path",
    );
  const trash = safeJoin(paths.internal, "deleted-editing-styles");
  mkdirSync(trash, { recursive: true });
  renameSync(dir, safeJoin(trash, `${id}-${randomUUID()}`));
  return { id };
}

/** Create only. Reserve the directory before writing so concurrent saves cannot overwrite. */
export function saveEditingStyle(paths: WorkspacePaths, input: unknown) {
  const { name, description, prompt } = editingStyleInput.parse(input);
  const slug =
    name
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 55)
      .replace(/-$/, "") || "editing-style";
  const base = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/.test(slug)
    ? `style-${slug}`
    : slug;
  const root = safeJoin(paths.library, "editing-styles");
  mkdirSync(root, { recursive: true });
  for (let index = 1; index < 10_000; index += 1) {
    const id = index === 1 ? base : `${base}-${index}`;
    const dir = join(root, id);
    try {
      mkdirSync(dir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") continue;
      throw error;
    }
    const promptFile = join(dir, "PROMPT.md");
    const metaFile = join(dir, "style.json");
    try {
      writeFileSync(promptFile, `${prompt}\n`, { flag: "wx" });
      // The gallery discovers only complete pairs. Publish metadata last.
      writeFileSync(
        metaFile,
        `${JSON.stringify({ version: 1, name, description }, null, 2)}\n`,
        { flag: "wx" },
      );
      if (
        !readFileSync(promptFile, "utf8").trim() ||
        JSON.parse(readFileSync(metaFile, "utf8")).name !== name
      )
        throw new StudioError("Could not verify the saved editing style.");
      return {
        id,
        name,
        path: `library/editing-styles/${id}/`,
        promptPath: `editing-styles/${id}/PROMPT.md`,
      };
    } catch (error) {
      for (const file of [metaFile, promptFile])
        if (existsSync(file)) unlinkSync(file);
      rmdirSync(dir);
      throw error;
    }
  }
  throw new StudioError("Could not find a free editing style name.");
}
