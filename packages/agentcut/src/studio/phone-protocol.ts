/** Shared browser/helper wire format. Never send the encryption secret to the relay. */
export const PHONE_CHUNK = 8 * 1024 * 1024;
export const PHONE_MAX_BYTES = 1024 * 1024 * 1024;
export const PHONE_TTL = 3 * 24 * 60 * 60 * 1000;
export const PHONE_DEFAULT_PROMPT =
  "Make a clean edit. Remove long pauses and mistakes. Preserve the meaning and the original video format.";
export type PhoneStage =
  | "uploading"
  | "waiting"
  | "receiving"
  | "editing"
  | "rendering"
  | "returning"
  | "done"
  | "error";
export interface PhoneJob {
  id: string;
  bytes: number;
  chunks: number;
  created: number;
  stage: PhoneStage;
  resultBytes?: number;
  resultChunks?: number;
  resultDeleted?: boolean;
}
export interface PhoneConnection {
  id: string;
  token: string;
  secret: string;
}
export interface PhoneManifest {
  name: string;
  prompt: string;
  bytes: number;
  width: number;
  height: number;
  duration: number;
  extension: string;
}

export function phoneSecret() {
  return encodeSecret(crypto.getRandomValues(new Uint8Array(32)));
}
export function encodeSecret(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export function decodeSecret(value: string) {
  if (!/^[\w-]{43}$/.test(value))
    throw new Error("The connection key is invalid.");
  return Uint8Array.from(
    atob(value.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
}
async function key(secret: string, job: string, direction: string) {
  const root = await crypto.subtle.importKey(
    "raw",
    decodeSecret(secret),
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode(job),
      info: new TextEncoder().encode(`agentcut-phone/1/${direction}`),
    },
    root,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function sealPhone(
  secret: string,
  job: string,
  object: string,
  data: Uint8Array<ArrayBuffer>,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(`${job}/${object}`),
    },
    await key(secret, job, object.split("/")[0]),
    data,
  );
  const out = new Uint8Array(12 + sealed.byteLength);
  out.set(iv);
  out.set(new Uint8Array(sealed), 12);
  return out;
}
export async function openPhone(
  secret: string,
  job: string,
  object: string,
  data: ArrayBuffer,
) {
  if (data.byteLength < 28) throw new Error("The video data is damaged.");
  return new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: data.slice(0, 12),
        additionalData: new TextEncoder().encode(`${job}/${object}`),
      },
      await key(secret, job, object.split("/")[0]),
      data.slice(12),
    ),
  );
}

/** Export only this result's AES key. A result link must never contain the pairing secret. */
export async function phoneResultKey(secret: string, job: string) {
  const root = await crypto.subtle.importKey(
    "raw",
    decodeSecret(secret),
    "HKDF",
    false,
    ["deriveBits"],
  );
  return encodeSecret(
    new Uint8Array(
      await crypto.subtle.deriveBits(
        {
          name: "HKDF",
          hash: "SHA-256",
          salt: new TextEncoder().encode(job),
          info: new TextEncoder().encode("agentcut-phone/1/result"),
        },
        root,
        256,
      ),
    ),
  );
}

/** Stable per-result capability, separate from both device credentials and the AES key. */
export async function phoneResultToken(secret: string, job: string) {
  const root = await crypto.subtle.importKey(
    "raw",
    decodeSecret(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return encodeSecret(
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        root,
        new TextEncoder().encode(`agentcut-phone/result-access/1/${job}`),
      ),
    ),
  );
}

export async function openPhoneResult(
  resultKey: string,
  job: string,
  object: string,
  data: ArrayBuffer,
) {
  if (!/^result\/(manifest|0|[1-9]\d*)$/.test(object) || data.byteLength < 28)
    throw new Error("The video data is invalid.");
  const aes = await crypto.subtle.importKey(
    "raw",
    decodeSecret(resultKey),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  return new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: data.slice(0, 12),
        additionalData: new TextEncoder().encode(`${job}/${object}`),
      },
      aes,
      data.slice(12),
    ),
  );
}
export function validatePhoneManifest(
  value: unknown,
  bytes: number,
): PhoneManifest {
  const m = value as PhoneManifest;
  if (
    !m ||
    m.bytes !== bytes ||
    typeof m.name !== "string" ||
    m.name.length > 200 ||
    typeof m.prompt !== "string" ||
    m.prompt.length > 6000 ||
    !/^(mp4|mov|webm|m4v)$/.test(m.extension) ||
    ![m.width, m.height].every(
      (n) => Number.isInteger(n) && n > 0 && n <= 8192,
    ) ||
    !Number.isFinite(m.duration) ||
    m.duration <= 0 ||
    m.duration > 7200
  )
    throw new Error(
      "The video details are invalid. Use a video of up to two hours.",
    );
  return m;
}
