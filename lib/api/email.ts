import nodemailer from "nodemailer";

export type BookingNotification = {
  bookingId: string;
  bookingDate: string;
  timeSlot: string;
  boatType: string;
  customerName: string;
  customerPhone: string;
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

export async function sendBookingNotificationEmail(booking: BookingNotification) {
  const host = env("SMTP_HOST");
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS");
  const port = Number(env("SMTP_PORT") || 587);
  const to = env("BOOKING_NOTIFY_EMAIL") || "Aquathrill70@gmail.com";

  if (!host || !user || !pass) {
    console.warn("[email] Booking notification skipped: missing SMTP_HOST, SMTP_USER or SMTP_PASS");
    return { skipped: true, reason: "missing_smtp_env" };
  }

  const secure = env("SMTP_SECURE") === "true" || port === 465;
  const from = env("SMTP_FROM") || user;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const rows = [
    ["Booking ID", booking.bookingId],
    ["วันที่", formatDate(booking.bookingDate)],
    ["รอบ", formatTimeSlot(booking.timeSlot)],
    ["ประเภทเรือ", booking.boatType],
    ["ชื่อลูกค้า", booking.customerName],
    ["เบอร์โทร", booking.customerPhone],
    ["ยอดชำระ", formatMoney(booking.totalPrice)],
  ];

  const htmlRows = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 12px;color:#64748b;border-bottom:1px solid #e2e8f0;">${escapeHtml(label)}</td>
          <td style="padding:10px 12px;color:#0f172a;font-weight:700;border-bottom:1px solid #e2e8f0;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join("");

  await transporter.sendMail({
    from,
    to,
    subject: `New booking ${booking.bookingId} | AQUATHRILL`,
    text: rows.map(([label, value]) => `${label}: ${value}`).join("\n"),
    html: `
      <div style="font-family:Arial,'Helvetica Neue',sans-serif;background:#f8fafc;padding:24px;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0;">
          <div style="background:#08233e;color:white;padding:22px 24px;">
            <h1 style="margin:0;font-size:24px;">มีรายการจองใหม่สำเร็จ</h1>
            <p style="margin:8px 0 0;color:#bae6fd;">AQUATHRILL Phuket Booking Notification</p>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:16px;">
            ${htmlRows}
          </table>
        </div>
      </div>
    `,
  });

  return { success: true };
}

export async function sendBookingNotificationEmailSafe(booking: BookingNotification) {
  try {
    return await sendBookingNotificationEmail(booking);
  } catch (error) {
    console.error("[email] Booking notification failed", error);
    return { success: false, error };
  }
}
