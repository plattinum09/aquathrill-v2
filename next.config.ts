import type { NextConfig } from "next";
import { loadEnvFile } from "node:process";

try {
  loadEnvFile("api/.env");
} catch {
  // Vercel injects environment variables; the legacy file is only a local fallback.
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
