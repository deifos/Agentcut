/**
 * Share links on the page side. The helper does the heavy lifting (encrypt + upload, download +
 * decrypt + write files: packages/agentcut/src/studio/share.ts); the page builds and reads links,
 * and decrypts a share's manifest to show what's in it before anything is downloaded.
 *
 * A link is `<origin>/s/<id>#<key>`: the key is in the fragment, so it never reaches a server.
 * /s/<id> forwards to `/studio#share=<id>.<key>`, which the studio picks up.
 *
 * The manifest's wire format must match the helper's (IV, AAD, ciphertext + tag).
 */

export const SHARE_API_URL = (process.env.NEXT_PUBLIC_SHARE_API_URL ?? "").replace(/\/+$/, "");
export const SHARE_AVAILABLE = Boolean(SHARE_API_URL);
/** First helper with share links (it reports the "share" feature); named in the update hint. */
export const SHARE_HELPER_VERSION = "0.2.12";

export interface ShareRef {
  id: string;
  key: string;
}

export interface ShareManifest {
  format: number;
  name: string;
  slug?: string;
  agentcutVersion: string;
  createdAt: number;
  bytes: number;
  files: { path: string; size: number }[];
  project: { fps?: number; durationInFrames?: number; style?: string; scenes: number };
}

export interface ShareProgress {
  job: string;
  stage: "preparing" | "uploading" | "downloading" | "done" | "error";
  done: number;
  total: number;
}

const ID = /^[A-Za-z0-9]{12}$/;
const KEY = /^[A-Za-z0-9_-]{43}$/;

export function shareLink(ref: ShareRef, origin = window.location.origin) {
  return `${origin}/s/${ref.id}#${ref.key}`;
}

/** The share the studio was opened with (`#share=<id>.<key>`), if any. */
export function shareFromHash(hash: string): ShareRef | null {
  const match = /^#share=([A-Za-z0-9]+)\.([A-Za-z0-9_-]+)$/.exec(hash);
  if (!match || !ID.test(match[1]) || !KEY.test(match[2])) return null;
  return { id: match[1], key: match[2] };
}

export function studioShareHash(id: string, key: string) {
  return `#share=${id}.${key}`;
}

export class ShareError extends Error {
  constructor(
    message: string,
    readonly code: "expired" | "not_found" | "bad_key" | "unavailable" | "network",
  ) {
    super(message);
  }
}

function fromBase64url(text: string) {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Fetch and decrypt a share's manifest: what's in it, and when the link expires. */
export async function readShare(ref: ShareRef): Promise<{ manifest: ShareManifest; expiresAt: number | null }> {
  if (!SHARE_AVAILABLE) throw new ShareError("Sharing isn't set up on this Agentcut.", "unavailable");
  let response: Response;
  try {
    response = await fetch(`${SHARE_API_URL}/v1/shares/${ref.id}/manifest`);
  } catch {
    throw new ShareError("Couldn't reach the share service. Check your connection and reload.", "network");
  }
  if (response.status === 410) throw new ShareError("This share link has expired. Ask for a new one.", "expired");
  if (response.status === 404) {
    throw new ShareError("This share doesn't exist, or it's still uploading. Check the link, or try again in a minute.", "not_found");
  }
  if (!response.ok) throw new ShareError(`The share service answered ${response.status}.`, "network");
  const sealed = new Uint8Array(await response.arrayBuffer());
  const expires = Number(response.headers.get("x-share-expires"));
  const iv = new Uint8Array(12);
  iv[0] = 1;
  let plain: ArrayBuffer;
  try {
    const key = await crypto.subtle.importKey("raw", fromBase64url(ref.key), "AES-GCM", false, ["decrypt"]);
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(`agentcut-share/1/${ref.id}/manifest`) },
      key,
      sealed,
    );
  } catch {
    throw new ShareError("This link's key doesn't match the share. Copy the whole link, including the part after #.", "bad_key");
  }
  const manifest = JSON.parse(new TextDecoder().decode(plain)) as ShareManifest;
  return { manifest, expiresAt: Number.isFinite(expires) && expires > 0 ? expires : null };
}

export function formatTimeLeft(expiresAt: number, now = Date.now()) {
  const hours = Math.max(0, (expiresAt - now) / 3_600_000);
  if (hours >= 36) return `${Math.round(hours / 24)} days`;
  if (hours >= 1.5) return `${Math.round(hours)} hours`;
  return "less than an hour";
}
