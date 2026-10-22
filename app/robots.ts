import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    // Allow the studio to be crawled so its noindex directive can be read.
    rules: { userAgent: "*", allow: "/", disallow: "/healthz" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
