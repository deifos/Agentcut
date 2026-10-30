import {
  chmodSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";

export interface ProviderMetadata {
  id: string;
  name: string;
  envVar?: string;
  keyUrl?: string;
  keyHint?: string;
  cloud?: boolean;
}
interface KeyFile {
  version: 1;
  defaultProvider: string | null;
  keys: Record<string, { key: string; savedAt: number }>;
}

/** Shared helper-only storage. Callers expose status, never this file or its keys. */
export function providerStore(
  path: () => string,
  providers: () => ProviderMetadata[],
  fallback: string | null = null,
) {
  const read = (): KeyFile => {
    try {
      const file = JSON.parse(readFileSync(path(), "utf8"));
      return {
        version: 1,
        defaultProvider: file.defaultProvider ?? fallback,
        keys: file.keys ?? {},
      };
    } catch {
      return { version: 1, defaultProvider: fallback, keys: {} };
    }
  };
  const write = (file: KeyFile) => {
    mkdirSync(dirname(path()), { recursive: true, mode: 0o700 });
    const temp = `${path()}.${randomUUID()}.tmp`;
    writeFileSync(temp, JSON.stringify(file, null, 2) + "\n", {
      mode: 0o600,
      flag: "wx",
    });
    renameSync(temp, path());
    try {
      chmodSync(path(), 0o600);
    } catch {
      /* Windows uses the user's directory ACL. */
    }
  };
  const spec = (id: unknown) => {
    const p = providers().find((p) => p.id === id);
    if (!p)
      throw new Error("Unknown provider. Choose a provider from settings.");
    return p;
  };
  const key = (id: string) => {
    const p = spec(id);
    return (
      read().keys[id]?.key ||
      (p.envVar ? process.env[p.envVar]?.trim() : null) ||
      null
    );
  };
  return {
    key,
    preferred: () => read().defaultProvider,
    status: (id: string) => ({
      configured: Boolean(key(id)),
      source: read().keys[id]
        ? ("saved" as const)
        : key(id)
          ? ("environment" as const)
          : null,
    }),
    save(id: string, raw: unknown, makeDefault = false) {
      spec(id);
      const value = typeof raw === "string" ? raw.trim() : "";
      if (value.length < 8 || value.length > 4096 || /[\r\n]/.test(value))
        throw new Error("Paste one complete API key.");
      const file = read();
      file.keys[id] = { key: value, savedAt: Date.now() };
      if (makeDefault) file.defaultProvider = id;
      write(file);
    },
    remove(id: string) {
      spec(id);
      const file = read();
      delete file.keys[id];
      if (file.defaultProvider === id) file.defaultProvider = fallback;
      write(file);
    },
    select(id: string) {
      spec(id);
      const file = read();
      file.defaultProvider = id;
      write(file);
    },
  };
}
