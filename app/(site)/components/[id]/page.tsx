import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComponentDetail } from "@/components/motion/ComponentDetail";
import { COMPONENT_METAS } from "@/motion/components/catalog";

export function generateStaticParams() {
  return Object.keys(COMPONENT_METAS).map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/components/[id]">): Promise<Metadata> {
  const { id } = await params;
  const meta = COMPONENT_METAS[id];
  if (!meta) return {};
  return {
    title: `${meta.name} · Motion components`,
    description: `${meta.description} ${meta.useWhen}`,
    alternates: { canonical: `/components/${id}` },
  };
}

export default async function ComponentPage({ params }: PageProps<"/components/[id]">) {
  const { id } = await params;
  if (!COMPONENT_METAS[id]) notFound();
  return (
    <main className="mx-auto max-w-7xl px-5 pb-24 pt-10 md:px-8">
      <ComponentDetail id={id} />
    </main>
  );
}
