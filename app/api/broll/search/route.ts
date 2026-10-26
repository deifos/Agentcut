import { searchBroll } from "@/lib/broll-search.server";
import type { BrollQuery } from "@/lib/broll";

// GET /api/broll/search?q=lonely+city+at+night&color=black-and-white&backgroundOk=1&limit=24
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const flag = (name: string) => p.get(name) === "1" || p.get(name) === "true";
  const num = (name: string) => (p.has(name) ? Number(p.get(name)) || undefined : undefined);
  const color = p.get("color");
  const query: BrollQuery = {
    query: p.get("q") ?? undefined,
    color: color === "black-and-white" || color === "color" || color === "tinted" ? color : undefined,
    backgroundOk: flag("backgroundOk"),
    noPeople: flag("noPeople"),
    calm: flag("calm"),
    minSeconds: num("minSeconds"),
    limit: num("limit"),
    offset: num("offset"),
  };
  try {
    return Response.json(await searchBroll(query));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}
