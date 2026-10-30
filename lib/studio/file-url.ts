import { STUDIO_BRIDGE_ORIGIN } from "./origin";
export function studioAssetBase(slug: string) {
  return `${STUDIO_BRIDGE_ORIGIN}/studio/files/${slug}`;
}

export const STUDIO_LIBRARY_BASE = `${STUDIO_BRIDGE_ORIGIN}/studio/library`;

/** URL of a project file (assets/…, renders/…) or a library: path. */
export function studioFileUrl(slug: string, path: string) {
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  const encode = (value: string) => value.split("/").map(encodeURIComponent).join("/");
  if (path.startsWith("library:")) return `${STUDIO_LIBRARY_BASE}/${encode(path.slice(8))}`;
  return `${studioAssetBase(slug)}/${encode(path.replace(/^\/+/, ""))}`;
}
