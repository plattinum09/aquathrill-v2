import { after, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { query } from "./db";
import { sendBookingNotificationEmailSafe } from "./email";
import { body, json } from "./http";

const escape = (value: any) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const OMISE_PAYMENT_METHODS = ["omise", "omise_card", "promptpay_qr"];

function omiseSecretKey() {
  return process.env.OMISE_SECRET_KEY || process.env.OMISE_SKEY || "";
}

function omiseDefaultSourceType() {
  return process.env.OMISE_DEFAULT_SOURCE_TYPE || "promptpay";
}

function omiseSourceTypeForMethod(method: string) {
  const normalized = String(method || "").trim();
  if (normalized === "promptpay_qr") return process.env.OMISE_PROMPTPAY_SOURCE_TYPE || "promptpay";
  if (normalized === "bill_payment_barcode") return process.env.OMISE_BILL_PAYMENT_SOURCE_TYPE || "";
  if (normalized === "ewallet_others") return process.env.OMISE_EWALLET_SOURCE_TYPE || "truemoney";
  return omiseDefaultSourceType();
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

async function notifyConfirmedBooking(bookingId: string) {
  const booking = (await query<any>(
    "SELECT booking_id,booking_date::text,time_slot,boat_type,customer_name,customer_phone,total_price FROM bookings WHERE booking_id=$1 LIMIT 1",
    [bookingId]
  )).rows[0];
  if (!booking) return;
  after(() => sendBookingNotificationEmailSafe({
    bookingId: String(booking.booking_id),
    bookingDate: String(booking.booking_date).slice(0, 10),
    timeSlot: String(booking.time_slot),
    boatType: String(booking.boat_type),
    customerName: String(booking.customer_name || ""),
    customerPhone: String(booking.customer_phone || ""),
    totalPrice: Number(booking.total_price || 0),
  }));
}

function paymentErrorPage(message: string, status = 500) {
  return new Response(
    `<!doctype html><html lang="th"><meta charset="utf-8"><title>Omise Error</title><style>body{margin:0;font-family:sans-serif;background:#0a1628;color:#fff;display:grid;place-items:center;min-height:100vh;padding:24px}.card{max-width:720px;background:#102746;border:1px solid rgba(255,90,120,.35);border-radius:18px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,.35)}h1{color:#ff6b8a;margin-top:0}.msg{white-space:pre-wrap;background:#071426;border-radius:12px;padding:14px;color:#ffd7df}.hint{color:#a9c8df;line-height:1.7}.btn{display:inline-block;margin-top:18px;background:#00b4ff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px}</style><div class="card"><h1>Omise payment error</h1><div class="msg">${escape(message)}</div><p class="hint">ตรวจสอบ OMISE_SECRET_KEY, source type, booking amount และ OMISE_RETURN_BASE_URL ใน .env / Vercel Environment Variables</p><a class="btn" href="/booking">กลับไปหน้าจอง</a></div></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );
}

function omiseQrPage(params: {
  amount: unknown;
  bookingId: string;
  expiresAt?: string;
  qrUrl: string;
  returnUri: string;
}) {
  const expires = params.expiresAt ? new Date(params.expiresAt) : null;
  const expiresText = expires && !Number.isNaN(expires.getTime())
    ? expires.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" })
    : "";
  return new Response(
    `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ชำระเงิน PromptPay | AQUATHRILL</title><style>body{margin:0;font-family:Kanit,system-ui,sans-serif;background:#071426;color:#fff;display:grid;place-items:center;min-height:100vh;padding:24px}.card{width:min(520px,100%);background:#102746;border:1px solid rgba(0,212,255,.25);border-radius:24px;padding:28px;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,.35)}h1{margin:0 0 8px;font-size:1.8rem}.muted{color:#a9c8df;line-height:1.6}.amount{font-size:2rem;font-weight:800;color:#00d4ff;margin:12px 0}.qr{background:#fff;border-radius:20px;padding:18px;margin:20px auto;width:min(300px,90%)}.qr img{display:block;width:100%;height:auto}.btn{display:inline-flex;align-items:center;justify-content:center;margin:10px 6px 0;background:#00b4ff;color:#fff;text-decoration:none;padding:13px 20px;border-radius:14px;font-weight:700}.btn.secondary{background:#243a5d}</style><main class="card"><h1>สแกนจ่าย PromptPay</h1><p class="muted">หมายเลขการจอง ${escape(params.bookingId)}</p><div class="amount">฿${Number(params.amount || 0).toLocaleString("th-TH")}</div><div class="qr"><img src="${escape(params.qrUrl)}" alt="PromptPay QR"></div><p class="muted">หลังชำระเงินแล้ว ระบบจะอัปเดตสถานะโดยอัตโนมัติ${expiresText ? `<br>QR หมดอายุ: ${escape(expiresText)}` : ""}</p><a class="btn" href="${escape(params.returnUri)}">ตรวจสอบสถานะ</a><a class="btn secondary" href="/booking">กลับหน้าจอง</a></main></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
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

async function omiseGet(path: string) {
  const secret = omiseSecretKey();
  if (!secret) throw new Error("Omise is not configured: missing OMISE_SECRET_KEY");

  const response = await fetch(`https://api.omise.co${path}`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
    },
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

async function createOmiseCardCharge(params: {
  amount: number;
  bookingId: string;
  cardToken: string;
  customerName?: string;
  customerPhone?: string;
  description: string;
  returnUri: string;
}) {
  return omisePost("/charges", {
    amount: params.amount,
    currency: "thb",
    description: params.description,
    return_uri: params.returnUri,
    card: params.cardToken,
    "metadata[booking_id]": params.bookingId,
    "metadata[customer_name]": params.customerName || "",
    "metadata[customer_phone]": params.customerPhone || "",
  });
}

async function startOmisePayment(request: NextRequest) {
  const url = new URL(request.url);
  const bookingId = String(url.searchParams.get("booking_id") || "").trim();
  const method = String(url.searchParams.get("method") || "promptpay_qr").trim();
  if (!/^[A-Za-z0-9-]{6,30}$/.test(bookingId)) return paymentErrorPage("Missing or invalid booking_id", 400);
  if (!["promptpay_qr", "bill_payment_barcode", "ewallet_others"].includes(method)) {
    return paymentErrorPage("ช่องทางชำระเงินนี้ยังไม่รองรับ กรุณากลับไปเลือกวิธีชำระเงินใหม่", 400);
  }
  if (method === "bill_payment_barcode" && !process.env.OMISE_BILL_PAYMENT_SOURCE_TYPE) {
    return paymentErrorPage("Bill Payment / Barcode ถูกยกเลิกจาก Omise แล้ว กรุณาเลือก Credit/Debit Card หรือ PromptPay QR", 400);
  }

  const booking = (await query<any>(
    "SELECT booking_id,total_price,customer_name,customer_phone,status FROM bookings WHERE booking_id=$1",
    [bookingId]
  )).rows[0];
  if (!booking) return paymentErrorPage("Booking not found", 404);

  const baseUrl = paymentBaseUrl(request);
  const returnUri = `${baseUrl}/booking/payment/result.html?booking_id=${encodeURIComponent(booking.booking_id)}`;
  const amount = satang(booking.total_price);
  if (amount <= 0) return paymentErrorPage("Invalid payment amount", 400);

  let charge: any;
  try {
    charge = await createOmiseCharge({
      amount,
      bookingId: booking.booking_id,
      customerName: booking.customer_name || "",
      customerPhone: booking.customer_phone || "",
      description: `AQUATHRILL Booking ${booking.booking_id}`,
      returnUri,
      sourceType: omiseSourceTypeForMethod(method),
    });
  } catch (error) {
    return paymentErrorPage(error instanceof Error ? error.message : "Omise payment failed", 500);
  }

  const completed = charge.status === "successful" || charge.paid === true;
  await query(
    "INSERT INTO payment_logs(booking_id,transaction_id,payment_method,amount,status,gateway_response) VALUES($1,$2,$3,$4,$5,$6::jsonb)",
    [booking.booking_id, charge.id || null, method, booking.total_price, completed ? "completed" : charge.status || "pending", JSON.stringify(charge)]
  );
  if (completed) {
    await query("UPDATE bookings SET status='confirmed',payment_method=$2 WHERE booking_id=$1", [booking.booking_id, method]);
    await notifyConfirmedBooking(booking.booking_id);
  }
  else await query("UPDATE bookings SET payment_method=$2 WHERE booking_id=$1 AND status!='confirmed'", [booking.booking_id, method]);

  const qrUrl =
    charge?.source?.scannable_code?.image?.download_uri ||
    charge?.source?.scannableCode?.image?.downloadUri ||
    charge?.source?.references?.barcode ||
    "";
  if (method === "promptpay_qr" && qrUrl) {
    return omiseQrPage({
      amount: booking.total_price,
      bookingId: booking.booking_id,
      expiresAt: charge?.source?.expires_at || charge?.source?.expiresAt,
      qrUrl,
      returnUri,
    });
  }

  const redirectUrl = charge.authorize_uri || charge.authorizeUri || returnUri;
  return Response.redirect(redirectUrl, 302);
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
  if (completed) {
    const result = await query("UPDATE bookings SET status='confirmed',payment_method='omise' WHERE booking_id=$1 AND status!='confirmed'", [bookingId]);
    if (result.rowCount) await notifyConfirmedBooking(bookingId);
  }
  if (failed) await query("UPDATE bookings SET status='cancelled',payment_method='omise' WHERE booking_id=$1 AND status='pending'", [bookingId]);
  return { success: true, booking_id: bookingId, charge_id: charge.id, status };
}

async function syncOmiseBooking(bookingId: string) {
  const booking = (await query<any>(
    "SELECT booking_id,status,payment_method FROM bookings WHERE booking_id=$1 LIMIT 1",
    [bookingId]
  )).rows[0];
  if (!booking) return { error: "Booking not found", statusCode: 404 };

  if (booking.status === "confirmed") {
    return { success: true, booking_id: bookingId, status: "confirmed", synced: false };
  }

  const paidLog = (await query<any>(
    "SELECT transaction_id,status,payment_method FROM payment_logs WHERE booking_id=$1 AND payment_method=ANY($2) AND status IN ('completed','successful','paid') ORDER BY id DESC LIMIT 1",
    [bookingId, OMISE_PAYMENT_METHODS]
  )).rows[0];
  if (paidLog) {
    const result = await query("UPDATE bookings SET status='confirmed',payment_method=CASE WHEN COALESCE(payment_method,'')='' THEN $2 ELSE payment_method END WHERE booking_id=$1 AND status!='confirmed'", [bookingId, paidLog.payment_method || "omise_card"]);
    if (result.rowCount) await notifyConfirmedBooking(bookingId);
    return { success: true, booking_id: bookingId, status: "confirmed", synced: true, source: "payment_log" };
  }

  const latestLog = (await query<any>(
    "SELECT transaction_id,payment_method FROM payment_logs WHERE booking_id=$1 AND payment_method=ANY($2) AND transaction_id IS NOT NULL ORDER BY id DESC LIMIT 1",
    [bookingId, OMISE_PAYMENT_METHODS]
  )).rows[0];
  const chargeId = latestLog?.transaction_id ? String(latestLog.transaction_id) : "";
  if (!chargeId.startsWith("chrg_")) {
    return { success: true, booking_id: bookingId, status: booking.status || "pending", synced: false };
  }

  const charge = await omiseGet(`/charges/${encodeURIComponent(chargeId)}`);
  const status = String(charge.status || "");
  const completed = status === "successful" || charge.paid === true;
  const failed = ["failed", "expired", "reversed"].includes(status);
  await query(
    "INSERT INTO payment_logs(booking_id,transaction_id,payment_method,amount,status,gateway_response) VALUES($1,$2,$3,$4,$5,$6::jsonb)",
    [bookingId, charge.id || chargeId, latestLog.payment_method || "omise_card", Number(charge.amount || 0) / 100, completed ? "completed" : failed ? "failed" : status || "pending", JSON.stringify(charge)]
  );
  if (completed) {
    const result = await query("UPDATE bookings SET status='confirmed',payment_method=CASE WHEN COALESCE(payment_method,'')='' THEN 'omise_card' ELSE payment_method END WHERE booking_id=$1 AND status!='confirmed'", [bookingId]);
    if (result.rowCount) await notifyConfirmedBooking(bookingId);
    return { success: true, booking_id: bookingId, status: "confirmed", synced: true, source: "omise_charge" };
  }
  if (failed) await query("UPDATE bookings SET status='cancelled' WHERE booking_id=$1 AND status='pending'", [bookingId]);
  return { success: true, booking_id: bookingId, status: failed ? "cancelled" : booking.status || "pending", synced: false, charge_status: status };
}

export async function omisePayment(request: NextRequest) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.searchParams.has("go")) {
    return startOmisePayment(request);
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const input = await body(request);
  if (!input.booking_id) return json({ error: "Missing booking_id" }, 400);
  if (input.omise_token) {
    const booking = (await query<any>("SELECT booking_id,total_price,customer_name,customer_phone,status FROM bookings WHERE booking_id=$1", [input.booking_id])).rows[0];
    if (!booking) return json({ error: "Booking not found" }, 404);
    if (booking.status === "confirmed") return json({ success: true, redirect_url: `${paymentBaseUrl(request)}/booking/payment/result.html?booking_id=${encodeURIComponent(booking.booking_id)}` });

    const baseUrl = paymentBaseUrl(request);
    const returnUri = `${baseUrl}/booking/payment/result.html?booking_id=${encodeURIComponent(booking.booking_id)}`;
    const amount = satang(booking.total_price);
    if (amount <= 0) return json({ error: "Invalid payment amount" }, 400);

    let charge: any;
    try {
      charge = await createOmiseCardCharge({
        amount,
        bookingId: booking.booking_id,
        cardToken: String(input.omise_token),
        customerName: booking.customer_name || "",
        customerPhone: booking.customer_phone || "",
        description: `AQUATHRILL Booking ${booking.booking_id}`,
        returnUri,
      });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Omise card charge failed" }, 500);
    }

    const completed = charge.status === "successful" || charge.paid === true;
    await query(
      "INSERT INTO payment_logs(booking_id,transaction_id,payment_method,amount,status,gateway_response) VALUES($1,$2,'omise_card',$3,$4,$5::jsonb)",
      [booking.booking_id, charge.id || null, booking.total_price, completed ? "completed" : charge.status || "pending", JSON.stringify(charge)]
    );
    if (completed) {
      const result = await query("UPDATE bookings SET status='confirmed',payment_method='omise_card' WHERE booking_id=$1 AND status!='confirmed'", [booking.booking_id]);
      if (result.rowCount) await notifyConfirmedBooking(booking.booking_id);
    }
    else await query("UPDATE bookings SET payment_method='omise_card' WHERE booking_id=$1 AND status!='confirmed'", [booking.booking_id]);

    return json({
      success: true,
      status: completed ? "confirmed" : charge.status || "pending",
      redirect_url: charge.authorize_uri || charge.authorizeUri || returnUri,
    });
  }
  return json({ error: "Credit card token is required" }, 400);
}

export async function omiseConfig() {
  return json({
    public_key: process.env.OMISE_PUBLIC_KEY || process.env.NEXT_PUBLIC_OMISE_PUBLIC_KEY || "",
  });
}

export async function omiseSyncStatus(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = new URL(request.url);
  const input = request.method === "POST" ? await body(request) : {};
  const bookingId = String(input.booking_id || url.searchParams.get("booking_id") || "").trim();
  if (!/^[A-Za-z0-9-]{6,30}$/.test(bookingId)) return json({ error: "Invalid booking_id" }, 400);
  const result = await syncOmiseBooking(bookingId);
  if ("error" in result) return json({ error: result.error }, result.statusCode || 500);
  return json(result);
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
