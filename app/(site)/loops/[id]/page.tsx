import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LoopDetail } from "@/components/loops/LoopDetail";
import { pageMetadata } from "@/lib/seo";
import { LOOPS } from "@/motion/components/loops/library";

// Only the library's loops exist: any other id 404s instead of rendering on demand.
export const dynamicParams = false;

export function generateStaticParams() {
  return LOOPS.map((loop) => ({ id: loop.id }));
}

export async function generateMetadata({ params }: PageProps<"/loops/[id]">): Promise<Metadata> {
  const { id } = await params;
  const loop = LOOPS.find((l) => l.id === id);
  if (!loop) notFound();
  return pageMetadata(
    `${loop.name} · seamless motion loop`,
    `${loop.description} A free ${loop.category.toLowerCase()} loop for video, in any brand colour.`,
    `/loops/${id}`,
  );
}

export default async function LoopPage({ params }: PageProps<"/loops/[id]">) {
  const { id } = await params;
  if (!LOOPS.some((l) => l.id === id)) notFound();
  return (
    <main className="mx-auto max-w-7xl px-5 pb-24 pt-10 md:px-8">
      <LoopDetail id={id} />
    </main>
  );
}
