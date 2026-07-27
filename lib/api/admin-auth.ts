import type { NextRequest } from "next/server";
import { body, json } from "./http";
import { clearSessionCookie, createPasswordHash, createSession, readSession, setSessionCookie, verifyPassword } from "./auth";
import { prisma } from "./prisma";

export async function adminAuth(request: NextRequest) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const input = await body(request);
  const action = input.action || "";
  if (action === "login") {
    if (!input.username || !input.password) return json({ error: "Username and password required" }, 400);
    const user = await prisma.adminUser.findUnique({ where: { username: input.username }, select: { id: true, username: true, passwordHash: true } });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) return json({ error: "Invalid credentials" }, 401);
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
    const user = await prisma.adminUser.findUnique({ where: { id: Number(session.id) }, select: { passwordHash: true } });
    if (!user || !(await verifyPassword(input.current_password, user.passwordHash))) return json({ error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" }, 401);
    await prisma.adminUser.update({ where: { id: Number(session.id) }, data: { passwordHash: await createPasswordHash(input.new_password) } });
    return json({ success: true });
  }
  return json({ error: "Invalid action" }, 400);
}
