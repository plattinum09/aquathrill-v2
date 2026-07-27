import type { NextRequest } from "next/server";
import { body, json } from "./http";
import { clearSessionCookie, createPasswordHash, createSession, readSession, setSessionCookie, verifyPassword } from "./auth";
import { prisma } from "./prisma";

export async function agentAuth(request: NextRequest) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const input = await body(request); const action = input.action || "";
  if (action === "register") {
    for (const field of ["first_name", "last_name", "email", "password"]) if (!input[field]) return json({ error: `กรุณากรอก ${field}` }, 400);
    if (input.password.length < 6) return json({ error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, 400);
    const exists = await prisma.agent.findUnique({ where: { email: input.email }, select: { id: true } });
    if (exists) return json({ error: "อีเมลนี้ถูกใช้สมัครแล้ว" }, 409);
    await prisma.agent.create({ data: { firstName: input.first_name, lastName: input.last_name, email: input.email, phone: input.phone || "", company: input.company || "", passwordHash: await createPasswordHash(input.password) } });
    return json({ success: true, status: "pending", message: "สมัครสำเร็จ! กรุณารอการอนุมัติจากแอดมิน" }, 201);
  }
  if (action === "login") {
    const agent = await prisma.agent.findUnique({ where: { email: input.email } });
    if (!agent || !(await verifyPassword(input.password || "", agent.passwordHash))) return json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, 401);
    if (agent.status !== "approved") return json({ error: agent.status === "pending" ? "บัญชีของคุณยังรอการอนุมัติ" : "บัญชีของคุณไม่ผ่านการอนุมัติ", status: agent.status }, 403);
    const info = { id: agent.id, name: `${agent.firstName} ${agent.lastName}`, email: agent.email, phone: agent.phone, company: agent.company };
    const response = json({ success: true, status: "approved", agent: info });
    setSessionCookie(response, "agent", await createSession({ role: "agent", id: agent.id, name: info.name, email: agent.email })); return response;
  }
  if (action === "check") { const session = await readSession(request,"agent"); return json(session ? { authenticated:true, agent:{id:session.id,name:session.name,email:session.email} } : {authenticated:false}); }
  if (action === "logout") { const response=json({success:true}); clearSessionCookie(response,"agent"); return response; }
  return json({ error: "Invalid action" }, 400);
}
