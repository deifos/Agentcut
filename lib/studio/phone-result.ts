import {
  decodeSecret,
  phoneResultKey,
  phoneResultToken,
  type PhoneConnection,
} from "@/packages/agentcut/src/studio/phone-protocol";
import { PHONE_API, PhoneRequestError, phoneRequest } from "./phone";

export interface PhoneResultLink {
  device: string;
  job: string;
  token: string;
  key: string;
}
export function parsePhoneResultLink(hash: string): PhoneResultLink {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const link = {
    device: p.get("device") || "",
    job: p.get("job") || "",
    token: p.get("token") || "",
    key: p.get("key") || "",
  };
  if (![link.device, link.job].every((id) => /^[a-f0-9-]{36}$/.test(id)))
    throw new Error("Open the complete private video link.");
  decodeSecret(link.token);
  decodeSecret(link.key);
  return link;
}
export async function createPhoneResultLink(
  connection: PhoneConnection,
  job: string,
  origin: string,
) {
  const [token, key] = await Promise.all([
    phoneResultToken(connection.secret, job),
    phoneResultKey(connection.secret, job),
  ]);
  await phoneRequest(connection.id, connection.token, `jobs/${job}/link`, {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  const url = new URL("/phone/watch", origin);
  url.hash = new URLSearchParams({
    device: connection.id,
    job,
    token,
    key,
  }).toString();
  return url.toString();
}
export async function phoneResultRequest(
  link: PhoneResultLink,
  object = "",
  init: RequestInit = {},
) {
  if (!PHONE_API)
    throw new Error("Phone transfer is not configured on this site.");
  const response = await fetch(
    `${PHONE_API}/v1/phone/${link.device}/results/${link.job}${object ? `/${object}` : ""}`,
    {
      ...init,
      headers: { authorization: `Bearer ${link.token}` },
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(90_000)])
        : AbortSignal.timeout(90_000),
    },
  );
  if (!response.ok) {
    const value = await response.json().catch(() => null);
    throw new PhoneRequestError(
      value?.error || "Could not open the video. Try again.",
      response.status,
    );
  }
  return response;
}
