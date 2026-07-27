import { NextResponse } from "next/server";

type JsonOptions = {
  cache?: string;
  headers?: Record<string, string>;
};

const noStore = "no-store, no-cache, must-revalidate";
const publicCache = "public, max-age=60, s-maxage=300, stale-while-revalidate=86400";

export function json(data: unknown, status = 200, options: JsonOptions = {}) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": options.cache ?? noStore,
      "Access-Control-Allow-Origin": "*",
      ...options.headers,
    },
  });
}

export function publicJson(data: unknown, status = 200, cache = publicCache) {
  return json(data, status, { cache });
}

export async function body(request: Request) {
  try { return await request.json() as Record<string, any>; } catch { return {}; }
}

export function errorResponse(error: unknown) {
  console.error(error);
  return json({ error: "Internal server error" }, 500);
}
