"use client";

import { useEffect } from "react";

export type PageScript = {
  src?: string;
  code?: string;
  type?: string;
  attributes?: Record<string, string>;
};

export default function LegacyPageClient({
  html,
  scripts,
  bodyClass,
}: {
  html: string;
  scripts: PageScript[];
  bodyClass?: string;
}) {
  useEffect(() => {
    const previousClass = document.body.className;
    document.body.className = bodyClass ?? "";
    const mountedScripts: HTMLScriptElement[] = [];
    let cancelled = false;

    async function mountScripts() {
      for (const descriptor of scripts) {
        if (cancelled) break;
        const script = document.createElement("script");
        if (descriptor.type) script.type = descriptor.type;
        Object.entries(descriptor.attributes ?? {}).forEach(([name, value]) => {
          script.setAttribute(name, value);
        });
        if (descriptor.src) {
          script.src = descriptor.src;
          script.async = false;
          await new Promise<void>((resolve) => {
            script.addEventListener("load", () => resolve(), { once: true });
            script.addEventListener("error", () => resolve(), { once: true });
            document.body.appendChild(script);
            mountedScripts.push(script);
          });
        } else if (descriptor.code) {
          script.text = descriptor.code;
          document.body.appendChild(script);
          mountedScripts.push(script);
        }
      }
    }

    void mountScripts();
    return () => {
      cancelled = true;
      mountedScripts.forEach((script) => script.remove());
      document.body.className = previousClass;
    };
  }, [bodyClass, scripts]);

  const wrapperClass = html.includes("editor-toolbar")
    ? "legacy-page-root legacy-page-root--editor"
    : "legacy-page-root";

  return <div className={wrapperClass} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />;
}
