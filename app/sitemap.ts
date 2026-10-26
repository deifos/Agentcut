import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { COMPONENT_METAS } from "@/motion/components/catalog";
import { LOOPS } from "@/motion/components/loops/library";

export default function sitemap(): MetadataRoute.Sitemap {
  // No synthetic lastModified dates: a build does not mean the content changed.
  return [
    "/",
    "/components",
    "/templates",
    "/loops",
    "/sound-effects",
    ...Object.keys(COMPONENT_METAS).map((id) => `/components/${id}`),
    ...LOOPS.map((loop) => `/loops/${loop.id}`),
  ].map((path) => ({ url: new URL(path, SITE_URL).href }));
}
