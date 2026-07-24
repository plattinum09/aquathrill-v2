import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LegacyPage, { readLegacyDocument } from "@/components/legacy-page";
import { getKnownPageSlugs, getLegacyPagePath } from "@/lib/legacy-pages";

type PageProps = { params: Promise<{ slug?: string[] }> };

export function generateStaticParams() {
  return getKnownPageSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const filePath = getLegacyPagePath((await params).slug);
  if (!filePath) return {};
  const page = await readLegacyDocument(filePath);
  return { title: page.title, description: page.description };
}

export default async function Page({ params }: PageProps) {
  const filePath = getLegacyPagePath((await params).slug);
  if (!filePath) notFound();
  return <LegacyPage filePath={filePath} />;
}
