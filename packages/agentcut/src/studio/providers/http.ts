/** Provider bodies can echo credentials or input text; do not relay them to the page/agent. */
export async function readError(response: Response) {
  await response.body?.cancel().catch(() => undefined);
  return `HTTP ${response.status}. ${response.status === 401 || response.status === 403 ? "Check the API key and its permissions in settings." : response.status === 429 ? "Rate or account limit reached; check the provider account and retry later." : "The provider request failed. Check the provider account or try again later."}`;
}

export async function verifyRequest(
  url: string,
  headers: Record<string, string>,
) {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(await readError(response));
  await response.body?.cancel().catch(() => undefined);
}

export async function readJson<T>(response: Response): Promise<T> {
  try { return await response.json() as T; }
  catch { throw new Error("The provider returned an invalid response. No fallback was used."); }
}
