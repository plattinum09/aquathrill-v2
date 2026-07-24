import fs from "node:fs/promises";
import LegacyPageClient, { type PageScript } from "./legacy-page-client";

const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

function attribute(source: string, name: string) {
  const match = source.match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
  return match?.[1];
}

export async function readLegacyDocument(filePath: string) {
  const document = await fs.readFile(filePath, "utf8");
  const head = document.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? "";
  const bodyMatch = document.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
  const bodyAttributes = bodyMatch?.[1] ?? "";
  const body = bodyMatch?.[2] ?? "";
  const scripts: PageScript[] = [];
  const collectScripts = (markup: string) => markup.replace(scriptPattern, (_tag, attrs, code) => {
    const type = attribute(attrs, "type");
    if (type === "application/ld+json") return _tag;
    scripts.push({ src: attribute(attrs, "src"), type, code: code.trim() || undefined });
    return "";
  });
  const safeHead = collectScripts(head)
    .replace(/<title>[\s\S]*?<\/title>/gi, "")
    .replace(/<meta\b[^>]*(?:charset|name=["']viewport["'])[^>]*>/gi, "");
  const safeBody = collectScripts(body);
  const description = head.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1]
    ?? head.match(/<meta\b[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i)?.[1]
    ?? "AQUATHRILL Mini Speedboat Phuket";

  return {
    bodyClass: attribute(bodyAttributes, "class"),
    description,
    html: `${safeHead}${safeBody}`,
    scripts,
    title: head.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "AQUATHRILL",
  };
}

export default async function LegacyPage({ filePath }: { filePath: string }) {
  const page = await readLegacyDocument(filePath);
  return <LegacyPageClient html={page.html} scripts={page.scripts} bodyClass={page.bodyClass} />;
}
