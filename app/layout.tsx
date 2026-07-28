import type { ReactNode } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="th">
      <body suppressHydrationWarning>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
