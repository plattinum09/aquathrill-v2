import type { NextRequest } from "next/server";
import { query } from "./db";
import { body, json } from "./http";
import { clearSessionCookie, createPasswordHash, createSession, readSession, setSessionCookie, verifyPassword } from "./auth";

export async function adminAuth(request: NextRequest) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const input = await body(request);
  const action = input.action || "";
  if (action === "login") {
    if (!input.username || !input.password) return json({ error: "Username and password required" }, 400);
    const result = await query<{ id: number; username: string; password_hash: string }>("SELECT id, username, password_hash FROM admin_users WHERE username=$1", [input.username]);
    const user = result.rows[0];
    if (!user || !(await verifyPassword(input.password, user.password_hash))) return json({ error: "Invalid credentials" }, 401);
    const response = json({ success: true, username: user.username });
    setSessionCookie(response, "admin", await createSession({ role: "admin", id: user.id, name: user.username }));
    return response;
  }
  if (action === "check") {
    const session = await readSession(request, "admin");
    return json(session ? { authenticated: true, username: session.name } : { authenticated: false });
  }
  if (action === "logout") {
    const response = json({ success: true }); clearSessionCookie(response, "admin"); return response;
  }
  if (action === "change_password") {
    const session = await readSession(request, "admin");
    if (!session) return json({ error: "Unauthorized" }, 401);
    if (!input.current_password || !input.new_password) return json({ error: "กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่" }, 400);
    if (input.new_password.length < 8) return json({ error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร" }, 400);
    const result = await query<{ password_hash: string }>("SELECT password_hash FROM admin_users WHERE id=$1", [session.id]);
    if (!result.rows[0] || !(await verifyPassword(input.current_password, result.rows[0].password_hash))) return json({ error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" }, 401);
    await query("UPDATE admin_users SET password_hash=$1 WHERE id=$2", [await createPasswordHash(input.new_password), session.id]);
    return json({ success: true });
  }
  return json({ error: "Invalid action" }, 400);
}
