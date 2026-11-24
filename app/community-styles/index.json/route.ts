import { readCommunityCatalog } from "@/lib/community-styles-read";

// Built once at deploy time from public/community-styles/: a static file, no work per request.
export const dynamic = "force-static";

export function GET() {
  return Response.json(readCommunityCatalog(), {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      // Self-hosted studios read the main site's catalog.
      "Access-Control-Allow-Origin": "*",
    },
  });
}
