// The Agentcut component library as the helper sees it: a copy shipped in template/components
// (synced from this repo's motion/components with `npm run sync:skill`). The studio page
// renders the components; the helper uses the catalog to check layers.json and to tell Claude.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ComponentCatalogEntry } from "./schema.js";
import { TEMPLATE_DIR } from "./workspace.js";

let cached: ComponentCatalogEntry[] | null | undefined;
let cachedStyles: string[] | null | undefined;

/** Ids of the project styles (components/styles.json, written by sync:skill), or null in older copies. */
export function styleIds(): string[] | null {
  if (cachedStyles !== undefined) return cachedStyles;
  const file = join(TEMPLATE_DIR, "components", "styles.json");
  try {
    cachedStyles = existsSync(file)
      ? (JSON.parse(readFileSync(file, "utf8")) as { id: string }[]).map((style) => style.id)
      : null;
  } catch {
    cachedStyles = null;
  }
  return cachedStyles;
}

export function componentCatalog(): ComponentCatalogEntry[] | null {
  if (cached !== undefined) return cached;
  const file = join(TEMPLATE_DIR, "components", "catalog.json");
  try {
    cached = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as ComponentCatalogEntry[]) : null;
  } catch {
    cached = null;
  }
  return cached;
}
