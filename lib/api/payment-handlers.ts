import { after, type NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { createHmac, timingSafeEqual } from "node:crypto";
import { query } from "./db";
import { sendBookingEmailsForBookingId } from "./email";
import { body, json } from "./http";

const escape = (value: any) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const OMISE_SOURCE_METHODS = ["promptpay_qr", "mobile_banking", "wechat_pay", "alipay"];
const OMISE_PAYMENT_METHODS = ["omise", "omise_card", ...OMISE_SOURCE_METHODS];
const OMISE_SOURCE_LABELS: Record<string, string> = {
  promptpay_qr: "PromptPay QR",
  mobile_banking: "Mobile Banking",
  wechat_pay: "WeChat Pay",
  alipay: "Alipay",
};
const OMISE_FAILED_STATUSES = ["failed", "expired", "reversed"];

function omiseSecretKey() {
  return process.env.OMISE_SECRET_KEY || process.env.OMISE_SKEY || "";
}

function omiseDefaultSourceType() {
  return process.env.OMISE_DEFAULT_SOURCE_TYPE || "promptpay";
}

function envFlag(name: string, defaultValue = false) {
  const value = String(process.env[name] || "").trim().toLowerCase();
  if (!value) return defaultValue;
  return ["1", "true", "yes", "on", "enabled"].includes(value);
}

function omiseSourceMethodConfig(method: string) {
  const normalized = String(method || "").trim();
  const config: Record<string, { sourceType: string; enabled: boolean; label: string; envName: string }> = {
    promptpay_qr: {
      sourceType: process.env.OMISE_PROMPTPAY_SOURCE_TYPE || "promptpay",
      enabled: envFlag("OMISE_ENABLE_PROMPTPAY", true),
      label: OMISE_SOURCE_LABELS.promptpay_qr,
      envName: "OMISE_ENABLE_PROMPTPAY",
    },
    mobile_banking: {
      sourceType: process.env.OMISE_MOBILE_BANKING_SOURCE_TYPE || "mobile_banking_kbank",
      enabled: envFlag("OMISE_ENABLE_MOBILE_BANKING", true),
      label: OMISE_SOURCE_LABELS.mobile_banking,
      envName: "OMISE_ENABLE_MOBILE_BANKING",
    },
    wechat_pay: {
      sourceType: process.env.OMISE_WECHAT_PAY_SOURCE_TYPE || "wechat_pay",
      enabled: envFlag("OMISE_ENABLE_WECHAT_PAY", false),
      label: OMISE_SOURCE_LABELS.wechat_pay,
      envName: "OMISE_ENABLE_WECHAT_PAY",
    },
    alipay: {
      sourceType: process.env.OMISE_ALIPAY_SOURCE_TYPE || "alipay_cn",
      enabled: envFlag("OMISE_ENABLE_ALIPAY", false),
      label: OMISE_SOURCE_LABELS.alipay,
      envName: "OMISE_ENABLE_ALIPAY",
    },
  };
  return config[normalized] || null;
}

function omiseSourceTypeForMethod(method: string) {
  return omiseSourceMethodConfig(method)?.sourceType || omiseDefaultSourceType();
}

function omisePublicSourceMethods() {
  return Object.fromEntries(
    OMISE_SOURCE_METHODS.map((method) => {
      const config = omiseSourceMethodConfig(method);
      return [
        method,
        {
          enabled: Boolean(config?.enabled),
          label: config?.label || method,
        },
      ];
    })
  );
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

function paymentLang(value: unknown) {
  const lang = String(value || "").trim().toLowerCase();
  return ["th", "en", "ru", "zh"].includes(lang) ? lang : "th";
}

function langQuery(lang: string) {
  return lang && lang !== "th" ? `&lang=${encodeURIComponent(lang)}` : "";
}

function satang(amount: unknown) {
  return Math.round(Number(amount || 0) * 100);
}

async function notifyConfirmedBooking(bookingId: string) {
  after(() => sendBookingEmailsForBookingId(bookingId));
}

function omiseChargeFromEvent(data: any) {
  if (data?.object === "charge") return data;
  if (data?.data?.object === "charge") return data.data;
  if (data?.data?.object?.object === "charge") return data.data.object;
  if (data?.object?.object === "charge") return data.object;
  return null;
}

function omiseChargeState(charge: any) {
  const status = String(charge?.status || "");
  return {
    status,
    completed: status === "successful" || charge?.paid === true,
    failed: OMISE_FAILED_STATUSES.includes(status),
  };
}

function paymentErrorPage(message: string, status = 500) {
  return new Response(
    `<!doctype html><html lang="th"><meta charset="utf-8"><title>Omise Error</title><style>body{margin:0;font-family:sans-serif;background:#0a1628;color:#fff;display:grid;place-items:center;min-height:100vh;padding:24px}.card{max-width:720px;background:#102746;border:1px solid rgba(255,90,120,.35);border-radius:18px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,.35)}h1{color:#ff6b8a;margin-top:0}.msg{white-space:pre-wrap;background:#071426;border-radius:12px;padding:14px;color:#ffd7df}.hint{color:#a9c8df;line-height:1.7}.btn{display:inline-block;margin-top:18px;background:#00b4ff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px}</style><div class="card"><h1>Omise payment error</h1><div class="msg">${escape(message)}</div><p class="hint">ตรวจสอบ OMISE_SECRET_KEY, source type, booking amount และ OMISE_RETURN_BASE_URL ใน .env / Vercel Environment Variables</p><a class="btn" href="/booking">กลับไปหน้าจอง</a></div></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );
}

function omiseSourceErrorMessage(method: string, sourceType: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Omise payment failed";
  if (/source type is not valid/i.test(message)) {
    const label = OMISE_SOURCE_LABELS[method] || method;
    const hints = [
      `${label} ยังไม่พร้อมใช้งานกับบัญชี Omise/API key นี้ หรือ source type ที่ตั้งไว้ไม่ถูกต้อง`,
      "",
      `Source type ที่เว็บส่งตอนนี้: ${sourceType}`,
    ];
    if (method === "alipay") {
      hints.push(
        "",
        "สำหรับ Alipay ให้ตั้งค่าใน .env / Vercel Environment Variables:",
        "OMISE_ENABLE_ALIPAY=true",
        "OMISE_ALIPAY_SOURCE_TYPE=alipay_cn",
        "OMISE_ALIPAY_PLATFORM_TYPE=WEB",
        "",
        "ถ้าตั้งครบแล้วยังขึ้น error เดิม ต้องให้ Omise/Opn เปิดใช้งาน Alipay ให้ merchant account/API key นี้ก่อน"
      );
    }
    return hints.join("\n");
  }
  return message;
}

function omiseQrPage(params: {
  amount: unknown;
  bookingId: string;
  expiresAt?: string;
  lang: string;
  qrUrl: string;
  returnUri: string;
}) {
  const texts = {
    th: { title: "สแกนจ่าย PromptPay", booking: "หมายเลขการจอง", waiting: "กำลังรอการชำระเงิน ระบบจะตรวจสอบให้อัตโนมัติ", note: "หลังชำระเงินสำเร็จ หน้านี้จะพาไปหน้าทำรายการสำเร็จเอง", expires: "QR หมดอายุ:", check: "ตรวจสอบสถานะตอนนี้", back: "กลับหน้าจอง", attach: "แนบสลิปชำระเงิน", attachHint: "อัปโหลดสลิปหลังโอน เพื่อให้แอดมินตรวจสอบได้ทันที", uploading: "กำลังอัปโหลด...", uploadHint: "กำลังส่งสลิป...", uploaded: "แนบสลิปแล้ว", uploadedHint: "ส่งสลิปเรียบร้อยแล้ว", tooLarge: "ไฟล์ใหญ่เกิน 5MB", uploadError: "อัปโหลดสลิปไม่สำเร็จ", paid: "ชำระเงินสำเร็จ กำลังพาไปหน้าสรุปรายการ...", cancelled: "รายการนี้ถูกยกเลิกหรือ QR หมดอายุ กรุณาทำรายการใหม่", checking: "กำลังตรวจสอบสถานะการชำระเงินอัตโนมัติ...", connecting: "กำลังเชื่อมต่อระบบตรวจสอบสถานะ..." },
    en: { title: "Scan to Pay with PromptPay", booking: "Booking number", waiting: "Waiting for payment. We will check automatically.", note: "After payment succeeds, this page will open the result automatically.", expires: "QR expires:", check: "Check status now", back: "Back to booking", attach: "Attach payment slip", attachHint: "Upload your slip after transfer so admin can verify it quickly.", uploading: "Uploading...", uploadHint: "Sending slip...", uploaded: "Slip attached", uploadedHint: "Slip uploaded successfully", tooLarge: "File is larger than 5MB", uploadError: "Could not upload slip", paid: "Payment successful. Opening the result page...", cancelled: "This payment was cancelled or the QR expired. Please try again.", checking: "Checking payment status automatically...", connecting: "Connecting to payment status check..." },
    ru: { title: "Сканируйте PromptPay для оплаты", booking: "Номер бронирования", waiting: "Ожидаем оплату. Система проверит статус автоматически.", note: "После успешной оплаты страница результата откроется автоматически.", expires: "QR истекает:", check: "Проверить статус", back: "Назад к бронированию", attach: "Прикрепить чек оплаты", attachHint: "Загрузите чек после перевода, чтобы администратор быстро проверил оплату.", uploading: "Загрузка...", uploadHint: "Отправляем чек...", uploaded: "Чек прикреплен", uploadedHint: "Чек успешно загружен", tooLarge: "Файл больше 5MB", uploadError: "Не удалось загрузить чек", paid: "Оплата успешна. Открываем страницу результата...", cancelled: "Платеж отменен или QR истек. Попробуйте еще раз.", checking: "Автоматически проверяем статус оплаты...", connecting: "Подключаемся к проверке статуса..." },
    zh: { title: "扫描 PromptPay 付款", booking: "预订编号", waiting: "正在等待付款，系统会自动检查。", note: "付款成功后，本页面会自动跳转到结果页。", expires: "二维码过期时间：", check: "立即检查状态", back: "返回预订", attach: "上传付款凭证", attachHint: "转账后上传凭证，方便管理员立即核对。", uploading: "正在上传...", uploadHint: "正在发送凭证...", uploaded: "凭证已上传", uploadedHint: "付款凭证上传成功", tooLarge: "文件超过 5MB", uploadError: "付款凭证上传失败", paid: "付款成功，正在打开结果页...", cancelled: "此付款已取消或二维码已过期，请重新尝试。", checking: "正在自动检查付款状态...", connecting: "正在连接付款状态检查..." },
  };
  const text = texts[paymentLang(params.lang) as keyof typeof texts] || texts.th;
  const expires = params.expiresAt ? new Date(params.expiresAt) : null;
  const expiresText = expires && !Number.isNaN(expires.getTime())
    ? expires.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" })
    : "";
  const bookingId = JSON.stringify(params.bookingId);
  const returnUri = JSON.stringify(params.returnUri);
  return new Response(
    `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(text.title)} | AQUATHRILL</title><style>body{margin:0;font-family:Kanit,system-ui,sans-serif;background:radial-gradient(circle at top,#12385d,#071426 62%);color:#fff;display:grid;place-items:center;min-height:100vh;padding:24px}.card{width:min(520px,100%);background:linear-gradient(180deg,#102746,#0b1d35);border:1px solid rgba(0,212,255,.25);border-radius:28px;padding:28px;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,.38)}h1{margin:0 0 8px;font-size:1.8rem}.muted{color:#a9c8df;line-height:1.6}.amount{font-size:2.25rem;font-weight:900;color:#00d4ff;margin:12px 0;text-shadow:0 0 24px rgba(0,212,255,.35)}.qr{background:#fff;border-radius:22px;padding:18px;margin:20px auto 14px;width:min(300px,90%);box-shadow:0 18px 45px rgba(0,0,0,.25)}.qr img{display:block;width:100%;height:auto}.status{display:flex;align-items:center;justify-content:center;gap:10px;color:#d7f3ff;margin:14px 0 4px;font-weight:700}.dot{width:10px;height:10px;border-radius:999px;background:#00d4ff;box-shadow:0 0 18px #00d4ff;animation:pulse 1.2s infinite}.btn{display:inline-flex;align-items:center;justify-content:center;margin:10px 6px 0;background:#00b4ff;color:#fff;text-decoration:none;padding:13px 20px;border-radius:14px;font-weight:700;border:0;cursor:pointer;font-family:inherit;font-size:1rem}.btn.secondary{background:#243a5d}.slip-box{margin:0 auto 16px;width:min(340px,94%);background:rgba(0,212,255,.08);border:1px solid rgba(0,212,255,.28);border-radius:18px;padding:12px;box-shadow:0 16px 42px rgba(0,180,255,.16)}.slip-btn{width:100%;min-height:58px;background:linear-gradient(135deg,#19d3ff,#0098d8);color:#fff;box-shadow:0 14px 34px rgba(0,180,255,.34),inset 0 1px 0 rgba(255,255,255,.25);font-size:1.08rem;gap:10px}.slip-btn:hover{transform:translateY(-1px);box-shadow:0 18px 42px rgba(0,180,255,.42),inset 0 1px 0 rgba(255,255,255,.25)}.slip-btn:disabled{opacity:.9;cursor:default;transform:none}.slip-icon{font-size:1.25rem}.slip-note{font-size:.84rem;color:#c8e8f7;margin:9px 0 0;min-height:1.3em;font-weight:600}.slip-note.ok{color:#86efac}.slip-note.err{color:#ff9aae}@keyframes pulse{0%,100%{opacity:.35;transform:scale(.85)}50%{opacity:1;transform:scale(1.15)}}@media(max-width:520px){body{padding:14px}.card{padding:22px 16px;border-radius:24px}.qr,.slip-box{width:min(280px,88%)}}</style><main class="card"><h1>${escape(text.title)}</h1><p class="muted">${escape(text.booking)} ${escape(params.bookingId)}</p><div class="amount">฿${Number(params.amount || 0).toLocaleString("th-TH")}</div><div class="qr"><img src="${escape(params.qrUrl)}" alt="PromptPay QR"></div><div class="slip-box"><input id="slip-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden><button class="btn slip-btn" id="slip-btn" type="button"><span class="slip-icon">⬆</span><span>${escape(text.attach)}</span></button><p class="slip-note" id="slip-note">${escape(text.attachHint)}</p></div><div class="status"><span class="dot"></span><span id="auto-status">${escape(text.waiting)}</span></div><p class="muted">${escape(text.note)}${expiresText ? `<br>${escape(text.expires)} ${escape(expiresText)}` : ""}</p><a class="btn" href="${escape(params.returnUri)}">${escape(text.check)}</a><a class="btn secondary" href="/booking">${escape(text.back)}</a></main><script>(function(){var bookingId=${bookingId};var returnUri=${returnUri};var statusEl=document.getElementById("auto-status");var slipBtn=document.getElementById("slip-btn");var slipFile=document.getElementById("slip-file");var slipNote=document.getElementById("slip-note");var label=${JSON.stringify(text)};var attempts=0;var maxAttempts=180;var checking=false;function setText(t){if(statusEl)statusEl.textContent=t}function setSlip(t,c){if(!slipNote)return;slipNote.textContent=t;slipNote.className="slip-note"+(c?" "+c:"")}if(slipBtn&&slipFile){slipBtn.addEventListener("click",function(){slipFile.click()});slipFile.addEventListener("change",async function(){var file=slipFile.files&&slipFile.files[0];if(!file)return;if(file.size>5*1024*1024){setSlip(label.tooLarge,"err");slipFile.value="";return}var form=new FormData();form.append("booking_id",bookingId);form.append("slip",file);slipBtn.disabled=true;slipBtn.innerHTML='<span class="slip-icon">...</span><span>'+label.uploading+'</span>';setSlip(label.uploadHint,"");try{var res=await fetch("/api/promptpay-slip.php",{method:"POST",body:form,cache:"no-store"});var data=await res.json().catch(function(){return {}});if(!res.ok||!data.success)throw new Error(data.error||label.uploadError);slipBtn.innerHTML='<span class="slip-icon">✓</span><span>'+label.uploaded+'</span>';setSlip(label.uploadedHint,"ok")}catch(e){slipBtn.disabled=false;slipBtn.innerHTML='<span class="slip-icon">⬆</span><span>${escape(text.attach)}</span>';setSlip(e.message||label.uploadError,"err")}})}async function poll(){if(checking)return;checking=true;attempts++;try{var res=await fetch("/api/omise-sync-status.php?booking_id="+encodeURIComponent(bookingId)+"&_="+Date.now(),{cache:"no-store",credentials:"include"});var data=await res.json().catch(function(){return {}});if(data&&data.status==="confirmed"){setText(label.paid);window.location.replace(returnUri);return}if(data&&data.status==="cancelled"){setText(label.cancelled);return}setText(label.checking)}catch(e){setText(label.connecting)}finally{checking=false;if(attempts<maxAttempts)setTimeout(poll,3000)}}setTimeout(poll,2500)})();</script></html>`,
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
  const sourcePayload: Record<string, any> = {
    amount: params.amount,
    currency: "thb",
    type: params.sourceType,
  };
  if (/^alipay/i.test(params.sourceType)) {
    sourcePayload.platform_type = process.env.OMISE_ALIPAY_PLATFORM_TYPE || "WEB";
  }
  const source = await omisePost("/sources", sourcePayload);
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
  const lang = paymentLang(url.searchParams.get("lang"));
  if (!/^[A-Za-z0-9-]{6,30}$/.test(bookingId)) return paymentErrorPage("Missing or invalid booking_id", 400);
  if (!OMISE_SOURCE_METHODS.includes(method)) {
    return paymentErrorPage("ช่องทางชำระเงินนี้ยังไม่รองรับ กรุณากลับไปเลือกวิธีชำระเงินใหม่", 400);
  }
  const sourceConfig = omiseSourceMethodConfig(method);
  if (!sourceConfig?.enabled) {
    return paymentErrorPage(
      `${sourceConfig?.label || "ช่องทางนี้"} ยังไม่ได้เปิดใช้งานกับระบบ Omise ของเว็บไซต์\n\nถ้าบัญชี Omise เปิดช่องทางนี้แล้ว ให้ตั้งค่า ${sourceConfig?.envName || "OMISE_ENABLE_*"}=true ใน .env / Vercel Environment Variables แล้ว redeploy`,
      400
    );
  }

  const booking = (await query<any>(
    "SELECT booking_id,total_price,customer_name,customer_phone,status FROM bookings WHERE booking_id=$1",
    [bookingId]
  )).rows[0];
  if (!booking) return paymentErrorPage("Booking not found", 404);

  const baseUrl = paymentBaseUrl(request);
  const returnUri = `${baseUrl}/booking/payment/result.html?booking_id=${encodeURIComponent(booking.booking_id)}${langQuery(lang)}`;
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
      sourceType: sourceConfig.sourceType,
    });
  } catch (error) {
    return paymentErrorPage(omiseSourceErrorMessage(method, sourceConfig.sourceType, error), 500);
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
      lang,
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
  const charge = omiseChargeFromEvent(data);
  if (!charge) return { ignored: true, reason: "not_charge_event" };

  const bookingId = charge.metadata?.booking_id || charge.description?.match(/AQUATHRILL Booking ([A-Za-z0-9-]+)/)?.[1];
  if (!bookingId) return { ignored: true, reason: "missing_booking_id" };

  const { status, completed, failed } = omiseChargeState(charge);
  const booking = (await query<any>("SELECT payment_method FROM bookings WHERE booking_id=$1 LIMIT 1", [bookingId])).rows[0];
  const paymentMethod = OMISE_PAYMENT_METHODS.includes(String(booking?.payment_method || ""))
    ? String(booking.payment_method)
    : "omise";
  await query(
    "INSERT INTO payment_logs(booking_id,transaction_id,payment_method,amount,status,gateway_response) VALUES($1,$2,$3,$4,$5,$6::jsonb)",
    [bookingId, charge.id || null, paymentMethod, Number(charge.amount || 0) / 100, completed ? "completed" : failed ? "failed" : status || eventKey || "pending", JSON.stringify(data)]
  );
  if (completed) {
    const result = await query("UPDATE bookings SET status='confirmed',payment_method=$2 WHERE booking_id=$1 AND status!='confirmed'", [bookingId, paymentMethod]);
    if (result.rowCount) await notifyConfirmedBooking(bookingId);
  }
  if (failed) await query("UPDATE bookings SET status='cancelled',payment_method=$2 WHERE booking_id=$1 AND status='pending'", [bookingId, paymentMethod]);
  return { success: true, booking_id: bookingId, charge_id: charge.id, status };
}

async function syncOmiseBooking(bookingId: string) {
  const booking = (await query<any>(
    "SELECT booking_id,status,payment_method FROM bookings WHERE booking_id=$1 LIMIT 1",
    [bookingId]
  )).rows[0];
  if (!booking) return { error: "Booking not found", statusCode: 404 };

  if (booking.status === "confirmed") {
    await notifyConfirmedBooking(bookingId);
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
  const { status, completed, failed } = omiseChargeState(charge);
  await query(
    "INSERT INTO payment_logs(booking_id,transaction_id,payment_method,amount,status,gateway_response) VALUES($1,$2,$3,$4,$5,$6::jsonb)",
    [bookingId, charge.id || chargeId, latestLog.payment_method || "omise_card", Number(charge.amount || 0) / 100, completed ? "completed" : failed ? "failed" : status || "pending", JSON.stringify(charge)]
  );
  if (completed) {
    const result = await query("UPDATE bookings SET status='confirmed',payment_method=CASE WHEN COALESCE(payment_method,'')='' THEN $2 ELSE payment_method END WHERE booking_id=$1 AND status!='confirmed'", [bookingId, latestLog.payment_method || "omise"]);
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
    const lang = paymentLang(input.lang);
    if (booking.status === "confirmed") return json({ success: true, redirect_url: `${paymentBaseUrl(request)}/booking/payment/result.html?booking_id=${encodeURIComponent(booking.booking_id)}${langQuery(lang)}` });

    const baseUrl = paymentBaseUrl(request);
    const returnUri = `${baseUrl}/booking/payment/result.html?booking_id=${encodeURIComponent(booking.booking_id)}${langQuery(lang)}`;
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
    source_methods: omisePublicSourceMethods(),
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

export async function promptpaySlip(request: NextRequest) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const form = await request.formData();
  const bookingId = String(form.get("booking_id") || "").trim();
  const file = form.get("slip");
  if (!/^[A-Za-z0-9-]{6,30}$/.test(bookingId)) return json({ error: "Invalid booking_id" }, 400);
  if (!(file instanceof File)) return json({ error: "กรุณาเลือกไฟล์สลิป" }, 400);
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) return json({ error: "รองรับเฉพาะ JPG, PNG, WebP, GIF" }, 400);
  if (file.size > 5 * 1024 * 1024) return json({ error: "ไฟล์ใหญ่เกิน 5MB" }, 400);

  const booking = (await query<any>("SELECT booking_id,total_price,status,notes FROM bookings WHERE booking_id=$1 LIMIT 1", [bookingId])).rows[0];
  if (!booking) return json({ error: "ไม่พบรายการจองนี้" }, 404);
  if (booking.status === "cancelled") return json({ error: "รายการนี้ถูกยกเลิกแล้ว" }, 400);

  const safeName = `${bookingId}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  let slipUrl = "";
  let storage = "vercel_blob";
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    if (process.env.NODE_ENV === "production") return json({ error: "ระบบยังไม่ได้ตั้งค่าอัปโหลดไฟล์" }, 500);
    const [{ mkdir, writeFile }, path] = await Promise.all([import("node:fs/promises"), import("node:path")]);
    const dir = path.join(process.cwd(), "public", "images", "slips");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, safeName), Buffer.from(await file.arrayBuffer()));
    slipUrl = `/images/slips/${safeName}`;
    storage = "local";
  } else {
    const blob = await put(`slips/${safeName}`, file, { access: "public", addRandomSuffix: true });
    slipUrl = blob.url;
  }

  const payload = { type: "promptpay_slip", slip_url: slipUrl, storage, uploaded_at: new Date().toISOString() };
  await query(
    "INSERT INTO payment_logs(booking_id,transaction_id,payment_method,amount,status,gateway_response) VALUES($1,NULL,'promptpay_qr',$2,'slip_uploaded',$3::jsonb)",
    [bookingId, Number(booking.total_price || 0), JSON.stringify(payload)]
  );
  const noteLine = `PromptPay slip: ${slipUrl}`;
  await query(
    "UPDATE bookings SET notes=CASE WHEN COALESCE(notes,'')='' THEN $2 WHEN notes LIKE $3 THEN notes ELSE notes || E'\\n' || $2 END,payment_method=CASE WHEN COALESCE(payment_method,'')='' THEN 'promptpay_qr' ELSE payment_method END WHERE booking_id=$1",
    [bookingId, noteLine, `%${slipUrl}%`]
  );
  return json({ success: true, slip_url: slipUrl });
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
