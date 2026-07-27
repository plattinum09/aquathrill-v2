import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { query } from "./db";
import { body, json } from "./http";

const escape = (value: any) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function omiseSecretKey() {
  return process.env.OMISE_SECRET_KEY || process.env.OMISE_SKEY || "";
}

function omiseDefaultSourceType() {
  return process.env.OMISE_DEFAULT_SOURCE_TYPE || "promptpay";
}

function paymentBaseUrl(request: NextRequest) {
  const configured =
    process.env.OMISE_RETURN_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.PUBLIC_SITE_URL ||
    "";
  if (configured) return configured.replace(/\/+$/, "");
  return new URL(request.url).origin;
}

function satang(amount: unknown) {
  return Math.round(Number(amount || 0) * 100);
}

function paymentErrorPage(message: string, status = 500) {
  return new Response(
    `<!doctype html><html lang="th"><meta charset="utf-8"><title>Omise Error</title><style>body{margin:0;font-family:sans-serif;background:#0a1628;color:#fff;display:grid;place-items:center;min-height:100vh;padding:24px}.card{max-width:720px;background:#102746;border:1px solid rgba(255,90,120,.35);border-radius:18px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,.35)}h1{color:#ff6b8a;margin-top:0}.msg{white-space:pre-wrap;background:#071426;border-radius:12px;padding:14px;color:#ffd7df}.hint{color:#a9c8df;line-height:1.7}.btn{display:inline-block;margin-top:18px;background:#00b4ff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px}</style><div class="card"><h1>Omise payment error</h1><div class="msg">${escape(message)}</div><p class="hint">ตรวจสอบ OMISE_SECRET_KEY, source type, booking amount และ OMISE_RETURN_BASE_URL ใน .env / Vercel Environment Variables</p><a class="btn" href="/booking">กลับไปหน้าจอง</a></div></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );
}

async function omisePost(path: string, params: Record<string, any>) {
  const secret = omiseSecretKey();
  if (!secret) throw new Error("Omise is not configured: missing OMISE_SECRET_KEY");

  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => form.append(key, String(item)));
    else if (value != null) form.append(key, String(value));
  }

  const response = await fetch(`https://api.omise.co${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
    cache: "no-store",
  });
  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const message = data?.message || data?.error_description || data?.code || data?.raw || `Omise request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

async function createOmiseCharge(params: {
  amount: number;
  bookingId: string;
  customerName?: string;
  customerPhone?: string;
  description: string;
  returnUri: string;
  sourceType: string;
}) {
  const source = await omisePost("/sources", {
    amount: params.amount,
    currency: "thb",
    type: params.sourceType,
  });
  return omisePost("/charges", {
    amount: params.amount,
    currency: "thb",
    description: params.description,
    return_uri: params.returnUri,
    source: source.id,
    "metadata[booking_id]": params.bookingId,
    "metadata[customer_name]": params.customerName || "",
    "metadata[customer_phone]": params.customerPhone || "",
  });
}

async function startOmisePayment(request: NextRequest) {
  const url = new URL(request.url);
  const bookingId = url.searchParams.get("booking_id");
  if (!bookingId) return new Response("Missing booking_id", { status: 400 });

  const booking = (await query<any>("SELECT id,booking_id,total_price,customer_email,customer_name,customer_phone,status FROM bookings WHERE booking_id=$1", [bookingId])).rows[0];
  if (!booking) return new Response("Booking not found", { status: 404 });
  if (booking.status === "confirmed") return Response.redirect(`${url.origin}/booking/payment/result.html?booking_id=${encodeURIComponent(booking.booking_id)}`, 303);

  const amount = satang(booking.total_price);
  if (amount <= 0) return new Response("Invalid payment amount", { status: 400 });

  const baseUrl = paymentBaseUrl(request);
  const returnUri = `${baseUrl}/booking/payment/result.html?booking_id=${encodeURIComponent(booking.booking_id)}`;
  const sourceType = url.searchParams.get("source_type") || omiseDefaultSourceType();
  let charge: any;
  try {
    charge = await createOmiseCharge({
      amount,
      bookingId: booking.booking_id,
      customerName: booking.customer_name || "",
      customerPhone: booking.customer_phone || "",
      description: `AQUATHRILL Booking ${booking.booking_id}`,
      returnUri,
      sourceType,
    });
  } catch (error) {
    return paymentErrorPage(error instanceof Error ? error.message : "Omise payment failed", 500);
  }

  await query(
    "INSERT INTO payment_logs(booking_id,transaction_id,payment_method,amount,status,gateway_response) VALUES($1,$2,'omise',$3,$4,$5::jsonb)",
    [booking.booking_id, charge.id || null, booking.total_price, charge.status || "pending", JSON.stringify(charge)]
  );
  await query("UPDATE bookings SET payment_method='omise' WHERE booking_id=$1 AND status!='confirmed'", [booking.booking_id]);

  const authorizeUri = charge.authorize_uri || charge.authorizeUri;
  if (authorizeUri) return Response.redirect(authorizeUri, 303);

  return new Response(
    `<!doctype html><html lang="th"><meta charset="utf-8"><title>Omise Payment</title><style>body{margin:0;font-family:sans-serif;background:#0a1628;color:#fff;display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px}.card{max-width:520px}.btn{display:inline-block;margin-top:18px;background:#00b4ff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px}</style><div class="card"><h2>สร้างรายการชำระเงิน Omise แล้ว</h2><p>สถานะ: ${escape(charge.status || "pending")}</p><p>หากเป็นวิธีชำระเงินที่ไม่ต้อง redirect กรุณารอ webhook จาก Omise หรือกลับไปตรวจสอบสถานะการจอง</p><a class="btn" href="${escape(returnUri)}">กลับไปหน้าผลการชำระเงิน</a></div></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );
}

function verifyOmiseSignature(rawBody: string, signature: string) {
  const secret = process.env.OMISE_WEBHOOK_SECRET || "";
  if (!secret || !signature) return true;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handleOmiseEvent(data: any) {
  const eventKey = String(data.key || "");
  const charge = data.data?.object === "charge" ? data.data : data.object === "charge" ? data : null;
  if (!charge) return { ignored: true, reason: "not_charge_event" };

  const bookingId = charge.metadata?.booking_id || charge.description?.match(/AQUATHRILL Booking ([A-Za-z0-9-]+)/)?.[1];
  if (!bookingId) return { ignored: true, reason: "missing_booking_id" };

  const status = String(charge.status || "");
  const completed = status === "successful";
  const failed = ["failed", "expired", "reversed"].includes(status);
  await query(
    "INSERT INTO payment_logs(booking_id,transaction_id,payment_method,amount,status,gateway_response) VALUES($1,$2,'omise',$3,$4,$5::jsonb)",
    [bookingId, charge.id || null, Number(charge.amount || 0) / 100, completed ? "completed" : failed ? "failed" : status || eventKey || "pending", JSON.stringify(data)]
  );
  if (completed) await query("UPDATE bookings SET status='confirmed',payment_method='omise' WHERE booking_id=$1 AND status!='confirmed'", [bookingId]);
  if (failed) await query("UPDATE bookings SET status='cancelled',payment_method='omise' WHERE booking_id=$1 AND status='pending'", [bookingId]);
  return { success: true, booking_id: bookingId, charge_id: charge.id, status };
}

export async function omisePayment(request: NextRequest) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.searchParams.has("go")) {
    return startOmisePayment(request);
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const input = await body(request);
  if (!input.booking_id) return json({ error: "Missing booking_id" }, 400);
  const baseUrl = paymentBaseUrl(request);
  const redirectUrl = `${baseUrl}/api/omise-payment.php?go=1&booking_id=${encodeURIComponent(input.booking_id)}${input.source_type ? `&source_type=${encodeURIComponent(input.source_type)}` : ""}`;
  return json({ success: true, redirect_url: redirectUrl });
}

export async function omiseWebhook(request: NextRequest) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const rawBody = await request.text();
  const signature = request.headers.get("Omise-Signature") || request.headers.get("omise-signature") || "";
  if (!verifyOmiseSignature(rawBody, signature)) return new Response("Invalid signature", { status: 403 });
  const data = JSON.parse(rawBody || "{}");
  await handleOmiseEvent(data);
  return new Response("OK", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function paysolutionsPayment(request: NextRequest) {
  return omisePayment(request);
}

export async function paysolutionsCallback(request: NextRequest) {
  return omiseWebhook(request);
}
