import { NextResponse } from "next/server";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "Access-Control-Allow-Origin": "*" },
  });
}

export async function body(request: Request) {
  try { return await request.json() as Record<string, any>; } catch { return {}; }
}

export function errorResponse(error: unknown) {
  console.error(error);
  return json({ error: "Internal server error" }, 500);
}
