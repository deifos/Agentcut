export * from "@/packages/agentcut/src/studio/phone-protocol";
export const PHONE_API = (
  process.env.NEXT_PUBLIC_PHONE_API_URL ||
  process.env.NEXT_PUBLIC_SHARE_API_URL ||
  ""
).replace(/\/+$/, "");

export class PhoneRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function phoneRequest(
  id: string,
  token: string,
  path: string,
  init: RequestInit = {},
) {
  if (!PHONE_API)
    throw new Error("Phone transfer is not configured on this site.");
  const response = await fetch(`${PHONE_API}/v1/phone/${id}/${path}`, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new PhoneRequestError(
      body?.error || `Transfer failed (${response.status}). Try again.`,
      response.status,
    );
  }
  return response;
}
