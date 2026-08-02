import nodemailer from "nodemailer";
import type { NextRequest } from "next/server";
import { readSession } from "./auth";
import { query } from "./db";
import { json } from "./http";

export type BookingNotification = {
  bookingId: string;
  bookingDate: string;
  timeSlot: string;
  boatType: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  paymentMethod?: string;
  totalPrice: number;
};

function env(name: string) {
  return process.env[name]?.trim() || "";
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

function formatTimeSlot(value: string) {
  const slots: Record<string, string> = {
    morning: "รอบเช้า",
    afternoon: "รอบบ่าย",
  };
  return slots[value] || value;
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  });
}

function formatPaymentMethod(value?: string) {
  const methods: Record<string, string> = {
    omise_card: "Credit / Debit Card",
    promptpay_qr: "PromptPay QR",
    omise: "Omise",
    bank_transfer: "Bank Transfer",
  };
  return methods[String(value || "")] || value || "-";
}

function isValidEmail(value?: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function smtpConfig() {
  const host = env("SMTP_HOST");
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS");
  const port = Number(env("SMTP_PORT") || 587);

  if (!host || !user || !pass) {
    return { ok: false as const, reason: "missing_smtp_env" };
  }

  const secure = env("SMTP_SECURE") === "true" || port === 465;
  const from = env("SMTP_FROM") || user;
  return { ok: true as const, host, user, pass, port, secure, from };
}

function createTransporter() {
  const config = smtpConfig();
  if (!config.ok) return config;
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });
  return { ...config, transporter };
}

export async function sendBookingNotificationEmail(booking: BookingNotification) {
  const config = createTransporter();
  if (!config.ok) {
    console.warn("[email] Booking notification skipped: missing SMTP_HOST, SMTP_USER or SMTP_PASS");
    return { skipped: true, reason: config.reason };
  }
  const to = env("BOOKING_NOTIFY_EMAIL") || "Aquathrill70@gmail.com";

  const rows = [
    ["Booking ID", booking.bookingId],
    ["วันที่", formatDate(booking.bookingDate)],
    ["รอบ", formatTimeSlot(booking.timeSlot)],
    ["ประเภทเรือ", booking.boatType],
    ["ชื่อลูกค้า", booking.customerName],
    ["เบอร์โทร", booking.customerPhone],
    ["อีเมลลูกค้า", booking.customerEmail || "-"],
    ["ช่องทางชำระเงิน", formatPaymentMethod(booking.paymentMethod)],
    ["ยอดชำระ", formatMoney(booking.totalPrice)],
  ];

  const htmlRows = rows
    .map(
      ([label, value]) => {
        const isAmount = label === "ยอดชำระ";
        return `
        <tr>
          <td style="padding:15px 20px;color:#64748b;border-bottom:1px solid #e5edf6;font-size:15px;">${escapeHtml(label)}</td>
          <td style="padding:15px 20px;color:${isAmount ? "#0284c7" : "#0f172a"};font-weight:800;border-bottom:1px solid #e5edf6;font-size:16px;text-align:right;">${escapeHtml(value)}</td>
        </tr>`;
      }
    )
    .join("");

  await config.transporter.sendMail({
    from: config.from,
    to,
    replyTo: isValidEmail(booking.customerEmail) ? booking.customerEmail : undefined,
    subject: `New booking ${booking.bookingId} | AQUATHRILL`,
    text: rows.map(([label, value]) => `${label}: ${value}`).join("\n"),
    html: `
      <div style="font-family:Arial,'Helvetica Neue',sans-serif;background:linear-gradient(135deg,#eaf8ff 0%,#f8fafc 45%,#ffffff 100%);padding:28px;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:26px;overflow:hidden;border:1px solid #dbeafe;box-shadow:0 20px 60px rgba(8,35,62,.14);">
          <div style="background:linear-gradient(135deg,#061b31,#08375e 58%,#06b6d4);color:white;padding:30px 30px 26px;">
            <div style="display:inline-block;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:7px 13px;color:#bae6fd;font-size:13px;font-weight:700;letter-spacing:.4px;">AQUATHRILL PHUKET</div>
            <h1 style="margin:18px 0 8px;font-size:30px;line-height:1.25;">มีรายการจองใหม่สำเร็จ</h1>
            <p style="margin:0;color:#d7f3ff;font-size:16px;">ลูกค้าชำระเงินเรียบร้อย กรุณาตรวจสอบรายละเอียดการจอง</p>
          </div>
          <div style="padding:24px 30px;background:#f8fbff;border-bottom:1px solid #e5edf6;">
            <div style="font-size:13px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Booking Reference</div>
            <div style="margin-top:6px;font-size:28px;color:#0f172a;font-weight:900;letter-spacing:.5px;">${escapeHtml(booking.bookingId)}</div>
          </div>
          <div style="padding:0 10px 8px;">
            <table style="width:100%;border-collapse:separate;border-spacing:0;font-size:16px;">
              ${htmlRows}
            </table>
          </div>
          <div style="padding:18px 30px 26px;background:#f8fafc;color:#64748b;font-size:13px;line-height:1.6;">
            อีเมลนี้ถูกส่งอัตโนมัติจากระบบจอง AQUATHRILL เมื่อสถานะรายการเป็น confirmed
          </div>
        </div>
      </div>
    `,
  });

  return { success: true };
}

export async function sendCustomerBookingConfirmationEmail(booking: BookingNotification) {
  if (!isValidEmail(booking.customerEmail)) {
    return { skipped: true, reason: "missing_customer_email" };
  }
  const config = createTransporter();
  if (!config.ok) {
    console.warn("[email] Customer confirmation skipped: missing SMTP_HOST, SMTP_USER or SMTP_PASS");
    return { skipped: true, reason: config.reason };
  }

  const rows = [
    ["Booking ID", booking.bookingId],
    ["วันที่", formatDate(booking.bookingDate)],
    ["รอบ", formatTimeSlot(booking.timeSlot)],
    ["ประเภทเรือ", booking.boatType],
    ["ชื่อลูกค้า", booking.customerName],
    ["เบอร์โทร", booking.customerPhone],
    ["ช่องทางชำระเงิน", formatPaymentMethod(booking.paymentMethod)],
    ["ยอดชำระ", formatMoney(booking.totalPrice)],
  ];

  const htmlRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding:13px 16px;color:#64748b;border-bottom:1px solid #e5edf6;font-size:14px;">${escapeHtml(label)}</td>
      <td style="padding:13px 16px;color:#0f172a;font-weight:800;border-bottom:1px solid #e5edf6;font-size:15px;text-align:right;">${escapeHtml(value)}</td>
    </tr>
  `).join("");

  const siteUrl = (env("NEXT_PUBLIC_SITE_URL") || env("PUBLIC_SITE_URL") || "https://www.aquathrill-thailand.com").replace(/\/+$/, "");
  const whatsappUrl = `https://wa.me/66958192778?text=${encodeURIComponent(`สวัสดีค่ะ/ครับ ต้องการสอบถามรายการจอง ${booking.bookingId}`)}`;

  await config.transporter.sendMail({
    from: config.from,
    to: booking.customerEmail,
    replyTo: env("BOOKING_NOTIFY_EMAIL") || "Aquathrill70@gmail.com",
    subject: `ยืนยันการจอง ${booking.bookingId} | AQUATHRILL Phuket`,
    text: [
      `ขอบคุณที่จองกับ AQUATHRILL Phuket`,
      `การจองของคุณได้รับการยืนยันแล้ว`,
      "",
      ...rows.map(([label, value]) => `${label}: ${value}`),
      "",
      `ติดต่อเรา: +66958192778`,
    ].join("\n"),
    html: `
      <div style="font-family:Arial,'Helvetica Neue',sans-serif;background:linear-gradient(135deg,#e0f7ff 0%,#f8fafc 50%,#ffffff 100%);padding:28px;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;border:1px solid #dbeafe;box-shadow:0 22px 70px rgba(8,35,62,.14);">
          <div style="background:linear-gradient(135deg,#05172a,#06365e 55%,#04c8e8);color:white;padding:34px 30px 30px;text-align:center;">
            <div style="display:inline-block;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:7px 14px;color:#cffafe;font-size:13px;font-weight:800;letter-spacing:.4px;">AQUATHRILL PHUKET</div>
            <h1 style="margin:18px 0 10px;font-size:30px;line-height:1.25;">ยืนยันการจองสำเร็จ</h1>
            <p style="margin:0;color:#d7f3ff;font-size:16px;line-height:1.65;">ขอบคุณที่จอง Mini Speedboat กับเรา<br>ทีมงานได้รับรายการของคุณเรียบร้อยแล้ว</p>
          </div>
          <div style="padding:24px 30px;background:#f8fbff;border-bottom:1px solid #e5edf6;text-align:center;">
            <div style="font-size:13px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.5px;">Booking Reference</div>
            <div style="margin-top:7px;font-size:30px;color:#0f172a;font-weight:900;letter-spacing:.5px;">${escapeHtml(booking.bookingId)}</div>
          </div>
          <div style="padding:0 10px 8px;">
            <table style="width:100%;border-collapse:separate;border-spacing:0;font-size:15px;">${htmlRows}</table>
          </div>
          <div style="padding:24px 30px;background:#f8fafc;">
            <div style="background:#ecfeff;border:1px solid #bae6fd;border-radius:18px;padding:16px 18px;color:#0f4c66;font-size:14px;line-height:1.7;">
              กรุณาเตรียมตัวตามเวลารับที่แจ้งไว้ หากต้องการแก้ไขข้อมูลหรือติดต่อทีมงาน สามารถกดปุ่มด้านล่างได้เลย
            </div>
            <div style="text-align:center;margin-top:20px;">
              <a href="${escapeHtml(whatsappUrl)}" style="display:inline-block;background:#22c55e;color:#ffffff;text-decoration:none;padding:13px 20px;border-radius:14px;font-weight:800;margin:5px;">ติดต่อ WhatsApp</a>
              <a href="${escapeHtml(siteUrl)}" style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;padding:13px 20px;border-radius:14px;font-weight:800;margin:5px;">กลับไปที่เว็บไซต์</a>
            </div>
          </div>
        </div>
      </div>
    `,
  });

  return { success: true };
}

export async function sendBookingNotificationEmailSafe(booking: BookingNotification) {
  const [shopResult, customerResult] = await Promise.allSettled([
    sendBookingNotificationEmail(booking),
    sendCustomerBookingConfirmationEmail(booking),
  ]);
  if (shopResult.status === "rejected") console.error("[email] Shop booking notification failed", shopResult.reason);
  if (customerResult.status === "rejected") console.error("[email] Customer booking confirmation failed", customerResult.reason);
  return {
    success: shopResult.status === "fulfilled" || customerResult.status === "fulfilled",
    shop: shopResult.status === "fulfilled" ? shopResult.value : { success: false, error: shopResult.reason },
    customer: customerResult.status === "fulfilled" ? customerResult.value : { success: false, error: customerResult.reason },
  };
}

export async function bookingEmailTest(request: NextRequest) {
  if (!(await readSession(request, "admin"))) return json({ error: "Unauthorized" }, 401);
  const config = {
    SMTP_HOST: Boolean(env("SMTP_HOST")),
    SMTP_PORT: env("SMTP_PORT") || "587",
    SMTP_USER: Boolean(env("SMTP_USER")),
    SMTP_PASS: Boolean(env("SMTP_PASS")),
    SMTP_FROM: env("SMTP_FROM") || env("SMTP_USER") || "",
    SMTP_SECURE: env("SMTP_SECURE") || (Number(env("SMTP_PORT") || 587) === 465 ? "true" : "false"),
    BOOKING_NOTIFY_EMAIL: env("BOOKING_NOTIFY_EMAIL") || "Aquathrill70@gmail.com",
  };

  if (request.method === "GET") return json({ success: true, configured: config });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload: any = {};
  try { payload = await request.json(); } catch {}
  const bookingId = String(payload.booking_id || "").trim();
  const booking = bookingId
    ? (await query<any>(
        "SELECT booking_id,booking_date::text,time_slot,boat_type,customer_name,customer_phone,customer_email,payment_method,total_price FROM bookings WHERE booking_id=$1 LIMIT 1",
        [bookingId]
      )).rows[0]
    : null;
  if (bookingId && !booking) return json({ success: false, message: "ไม่พบ booking_id นี้", configured: config }, 404);

  const result = await sendBookingNotificationEmailSafe(booking ? {
    bookingId: String(booking.booking_id),
    bookingDate: String(booking.booking_date).slice(0, 10),
    timeSlot: String(booking.time_slot),
    boatType: String(booking.boat_type),
    customerName: String(booking.customer_name || ""),
    customerPhone: String(booking.customer_phone || ""),
    customerEmail: String(booking.customer_email || ""),
    paymentMethod: String(booking.payment_method || ""),
    totalPrice: Number(booking.total_price || 0),
  } : {
    bookingId: `SMTP-TEST-${Date.now()}`,
    bookingDate: new Date().toISOString().slice(0, 10),
    timeSlot: "afternoon",
    boatType: "SMTP Test",
    customerName: "AQUATHRILL System",
    customerPhone: "-",
    customerEmail: "customer@example.com",
    paymentMethod: "omise_card",
    totalPrice: 0,
  });

  if (result?.success) return json({ success: true, message: "ส่งเมลทดสอบสำเร็จ", configured: config });
  return json({
    success: false,
    message: "ส่งเมลทดสอบไม่สำเร็จ",
    configured: config,
    reason: (result as any)?.reason || ((result as any)?.error instanceof Error ? (result as any).error.message : String((result as any)?.error || "unknown")),
  }, 500);
}
