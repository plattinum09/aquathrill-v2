import { get, put } from "@vercel/blob";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { readSession } from "./auth";
import { body, json, publicJson } from "./http";
import { prisma } from "./prisma";

async function admin(request: NextRequest) {
  return (await readSession(request, "admin")) || null;
}

const parseJson = (value: any, fallback: any) => {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

function fallbackBoatImage(id: string) {
  if (id === "12ft") return "/images/12-feet.webp";
  if (id === "14ft") return "/images/14-feet.webp";
  return "/images/boat-default.webp";
}

function normalizeBoatImage(value: unknown, id: string) {
  const image = typeof value === "string" ? value.trim() : "";
  if (!image || /^\/images\/promotions\/promo-/i.test(image)) return fallbackBoatImage(id);
  return image;
}

let boatTypesTableReady = false;
async function ensureBoatTypesTable() {
  if (boatTypesTableReady) return;
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS boat_types (
      id VARCHAR(20) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      total_boats INT NOT NULL DEFAULT 1,
      max_guests INT NOT NULL DEFAULT 3,
      max_weight INT NOT NULL DEFAULT 200,
      price INT NOT NULL DEFAULT 9900,
      description TEXT,
      image VARCHAR(500),
      images TEXT,
      features TEXT,
      i18n TEXT,
      book_url VARCHAR(500) DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0,
      is_active SMALLINT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await prisma.$executeRaw`ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS description TEXT`;
  await prisma.$executeRaw`ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS image VARCHAR(500)`;
  await prisma.$executeRaw`ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS images TEXT`;
  await prisma.$executeRaw`ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS features TEXT`;
  await prisma.$executeRaw`ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS i18n TEXT`;
  await prisma.$executeRaw`ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS book_url VARCHAR(500) DEFAULT ''`;
  await prisma.$executeRaw`ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0`;
  await prisma.$executeRaw`ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS is_active SMALLINT NOT NULL DEFAULT 1`;
  await prisma.$executeRaw`ALTER TABLE boat_types ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`;
  boatTypesTableReady = true;
}

function boatRow(row: any) {
  const totalBoats = row.totalBoats ?? row.total_boats;
  const maxGuests = row.maxGuests ?? row.max_guests;
  const maxWeight = row.maxWeight ?? row.max_weight;
  const bookUrl = row.bookUrl ?? row.book_url;
  const sortOrder = row.sortOrder ?? row.sort_order;
  const isActive = row.isActive ?? row.is_active;
  const createdAt = row.createdAt ?? row.created_at;
  const images = parseJson(row.images, []).map((image: unknown) => normalizeBoatImage(image, row.id));
  const image = normalizeBoatImage(row.image || images[0], row.id);
  return {
    id: row.id,
    name: row.name,
    total_boats: Number(totalBoats),
    max_guests: Number(maxGuests),
    max_weight: Number(maxWeight),
    price: Number(row.price),
    description: row.description || "",
    image,
    images: images.length ? images : [image],
    features: parseJson(row.features, []),
    i18n: parseJson(row.i18n, null),
    book_url: bookUrl || "",
    sort_order: Number(sortOrder),
    is_active: Number(isActive),
    created_at: createdAt,
  };
}

function promotionRow(row: any) {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle || "",
    description: row.description || "",
    image_url: row.imageUrl || "",
    badge_text: row.badgeText || "",
    old_price: row.oldPrice == null ? null : Number(row.oldPrice),
    new_price: row.newPrice == null ? null : Number(row.newPrice),
    link_url: row.linkUrl || "",
    button_text: row.buttonText,
    sort_order: row.sortOrder,
    is_active: row.isActive,
  };
}

function pageContentSettingKey(page: string) {
  return `page_content:${page}`;
}

let tableReady = false;
async function ensureEditableTables() {
  if (tableReady) return;
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS page_content (
      page_key VARCHAR(50) PRIMARY KEY,
      content JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS site_settings (
      setting_key VARCHAR(100) PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  tableReady = true;
}

async function readPageContent(page: string) {
  try {
    await ensureEditableTables();
    const row = await prisma.pageContent.findUnique({ where: { pageKey: page } });
    if (row) return { content: row.content, updated_at: row.updatedAt, source: "page_content" };
  } catch (error) {
    console.warn("page_content primary read failed; falling back to site_settings", error);
  }
  await ensureEditableTables();
  const fallback = await prisma.siteSetting.findUnique({ where: { settingKey: pageContentSettingKey(page) } });
  if (!fallback) return { content: null, updated_at: null, source: "none" };
  return { content: parseJson(fallback.settingValue, null), updated_at: fallback.updatedAt, source: "site_settings" };
}

async function writePageContent(page: string, content: unknown) {
  const cleanContent = (content ?? {}) as Prisma.InputJsonValue;
  const serialized = JSON.stringify(content ?? {});
  let primaryError: unknown = null;
  try {
    await ensureEditableTables();
    const row = await prisma.pageContent.upsert({
      where: { pageKey: page },
      create: { pageKey: page, content: cleanContent },
      update: { content: cleanContent },
    });
    await prisma.siteSetting.upsert({
      where: { settingKey: pageContentSettingKey(page) },
      create: { settingKey: pageContentSettingKey(page), settingValue: serialized },
      update: { settingValue: serialized },
    });
    return { page: row.pageKey, content: row.content, updated_at: row.updatedAt, source: "page_content" };
  } catch (error) {
    primaryError = error;
    console.warn("page_content primary write failed; falling back to site_settings", error);
  }
  try {
    await ensureEditableTables();
    const row = await prisma.siteSetting.upsert({
      where: { settingKey: pageContentSettingKey(page) },
      create: { settingKey: pageContentSettingKey(page), settingValue: serialized },
      update: { settingValue: serialized },
    });
    return {
      page,
      content: parseJson(row.settingValue, content ?? {}),
      updated_at: row.updatedAt,
      source: "site_settings",
      primary_error: primaryError instanceof Error ? primaryError.message : "primary write failed",
    };
  } catch (fallbackError) {
    console.error("page_content fallback write failed", fallbackError);
    throw primaryError ?? fallbackError;
  }
}

export async function boatTypes(request: NextRequest) {
  await ensureBoatTypesTable();
  if (request.method === "GET") {
    const all = new URL(request.url).searchParams.has("all");
    if (all && !(await admin(request))) return json({ error: "Unauthorized" }, 401);
    const rows = all
      ? await prisma.$queryRawUnsafe<any[]>("SELECT * FROM boat_types ORDER BY sort_order,id")
      : await prisma.$queryRawUnsafe<any[]>("SELECT * FROM boat_types WHERE is_active=1 ORDER BY sort_order,id");
    const types = rows.map(boatRow);
    const prices: Record<string, number> = {};
    const boats: Record<string, any> = {};
    for (const row of types) {
      prices[row.id] = row.price;
      boats[row.id] = { name: row.name, image: row.image || row.images[0] || "", images: row.images, desc: row.description || "" };
    }
    return all ? json({ boat_types: types, prices, boats, _v: "next-prisma-1.0" }) : publicJson({ boat_types: types, prices, boats, _v: "next-prisma-1.0" });
  }
  if (!(await admin(request))) return json({ error: "Unauthorized" }, 401);
  const input = await body(request);
  if (request.method === "POST") {
    if (!input.id || !input.name) return json({ error: "Missing required fields: id, name" }, 400);
    const id = String(input.id).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (id.length < 2 || id.length > 20) return json({ error: "ID must be 2-20 alphanumeric characters" }, 400);
    const existing = await prisma.$queryRawUnsafe<any[]>("SELECT id FROM boat_types WHERE id=$1 LIMIT 1", id);
    if (existing.length) return json({ error: "Boat type ID already exists" }, 409);
    try {
      await prisma.$executeRawUnsafe(
        "INSERT INTO boat_types(id,name,total_boats,max_guests,max_weight,price,description,image,images,features,i18n,book_url,sort_order,is_active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,1)",
        id,
        String(input.name).trim(),
        Number(input.total_boats || 1),
        Number(input.max_guests || 3),
        Number(input.max_weight || 200),
        Number(input.price || 9900),
        String(input.description || "").trim(),
        String(input.image || "").trim(),
        JSON.stringify(input.images || []),
        JSON.stringify(input.features || []),
        JSON.stringify(input.i18n || {}),
        String(input.book_url || "").trim(),
        Number(input.sort_order || 0)
      );
    } catch (error: any) {
      if (error.code === "P2002" || error.code === "23505") return json({ error: "Boat type ID already exists" }, 409);
      throw error;
    }
    return json({ success: true, id }, 201);
  }
  if (request.method === "PUT") {
    if (!input.id) return json({ error: "Missing boat type id" }, 400);
    const oldRows = await prisma.$queryRawUnsafe<any[]>("SELECT * FROM boat_types WHERE id=$1 LIMIT 1", input.id);
    const old = oldRows[0];
    if (!old) return json({ error: "Boat type not found" }, 404);
    const next = {
      name: Object.hasOwn(input, "name") ? String(input.name).trim() : old.name,
      total_boats: Object.hasOwn(input, "total_boats") ? Number(input.total_boats) : Number(old.total_boats),
      max_guests: Object.hasOwn(input, "max_guests") ? Number(input.max_guests) : Number(old.max_guests),
      max_weight: Object.hasOwn(input, "max_weight") ? Number(input.max_weight) : Number(old.max_weight),
      price: Object.hasOwn(input, "price") ? Number(input.price) : Number(old.price),
      description: Object.hasOwn(input, "description") ? String(input.description || "").trim() : old.description,
      image: Object.hasOwn(input, "image") ? String(input.image || "").trim() : old.image,
      images: Object.hasOwn(input, "images") ? JSON.stringify(input.images || []) : old.images,
      features: Object.hasOwn(input, "features") ? JSON.stringify(input.features || []) : old.features,
      i18n: Object.hasOwn(input, "i18n") ? JSON.stringify(input.i18n || {}) : old.i18n,
      book_url: Object.hasOwn(input, "book_url") ? String(input.book_url || "").trim() : old.book_url,
      sort_order: Object.hasOwn(input, "sort_order") ? Number(input.sort_order) : Number(old.sort_order),
      is_active: Object.hasOwn(input, "is_active") ? Number(input.is_active) : Number(old.is_active),
    };
    await prisma.$executeRawUnsafe(
      "UPDATE boat_types SET name=$1,total_boats=$2,max_guests=$3,max_weight=$4,price=$5,description=$6,image=$7,images=$8,features=$9,i18n=$10,book_url=$11,sort_order=$12,is_active=$13 WHERE id=$14",
      next.name,
      next.total_boats,
      next.max_guests,
      next.max_weight,
      next.price,
      next.description,
      next.image,
      next.images,
      next.features,
      next.i18n,
      next.book_url,
      next.sort_order,
      next.is_active,
      input.id
    );
    return json({ success: true, _v: "next-prisma-1.0" });
  }
  if (request.method === "DELETE") {
    if (!input.id) return json({ error: "Missing boat type id" }, 400);
    await prisma.$executeRawUnsafe("UPDATE boat_types SET is_active=0 WHERE id=$1", input.id);
    return json({ success: true });
  }
  return json({ error: "Method not allowed" }, 405);
}

export async function boatPricing(request: NextRequest) {
  await ensureBoatTypesTable();
  if (request.method === "POST") {
    if (!(await admin(request))) return json({ error: "Unauthorized" }, 401);
    const input = await body(request);
    for (const [id, item] of Object.entries<any>(input.boats || {})) {
      if (item.price != null) await prisma.$executeRawUnsafe("UPDATE boat_types SET price=$1 WHERE id=$2", Number(item.price), id);
      if (item.image != null) await prisma.$executeRawUnsafe("UPDATE boat_types SET image=$1 WHERE id=$2", item.image, id);
      if (item.images) await prisma.$executeRawUnsafe("UPDATE boat_types SET images=$1 WHERE id=$2", JSON.stringify(item.images), id);
    }
    for (const [id, price] of Object.entries(input.prices || {})) await prisma.$executeRawUnsafe("UPDATE boat_types SET price=$1 WHERE id=$2", Number(price), id);
  } else if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const rows = await prisma.$queryRawUnsafe<any[]>("SELECT * FROM boat_types WHERE is_active=1 ORDER BY sort_order,id");
  const prices: Record<string, number> = {};
  const boats: Record<string, any> = {};
  for (const row of rows.map(boatRow)) {
    prices[row.id] = row.price;
    boats[row.id] = {
      price: row.price,
      name: row.name,
      desc: row.description || "",
      badge: `2-${row.max_guests} คน / ${row.max_weight}kg`,
      image: row.image,
      images: row.images,
      bookUrl: row.book_url || `https://wa.me/66958192778?text=${encodeURIComponent("สนใจจอง " + row.name)}`,
    };
  }
  return request.method === "GET" ? publicJson({ prices, boats }) : json({ success: true, prices, boats });
}

export async function promotions(request: NextRequest) {
  const input = request.method === "GET" ? {} : await body(request);
  const url = new URL(request.url);
  if (request.method === "GET") {
    const all = url.searchParams.has("all");
    if (all && !(await admin(request))) return json({ error: "Unauthorized" }, 401);
    const rows = await prisma.promotion.findMany({
      where: all ? undefined : { isActive: 1 },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    const payload = { promotions: rows.map(promotionRow) };
    return all ? json(payload) : publicJson(payload);
  }
  if (!(await admin(request))) return json({ error: "Unauthorized" }, 401);
  if (request.method === "POST") {
    if (!input.title) return json({ error: "Title is required" }, 400);
    const row = await prisma.promotion.create({
      data: {
        title: input.title,
        subtitle: input.subtitle || "",
        description: input.description || "",
        imageUrl: input.image_url || "",
        badgeText: input.badge_text || "",
        oldPrice: input.old_price === "" ? null : input.old_price ?? null,
        newPrice: input.new_price === "" ? null : input.new_price ?? null,
        linkUrl: input.link_url || "",
        buttonText: input.button_text || "จองเลย",
        sortOrder: Number(input.sort_order || 0),
        isActive: Number(input.is_active ?? 1),
      },
    });
    return json({ success: true, id: row.id }, 201);
  }
  if (request.method === "DELETE") {
    await prisma.promotion.delete({ where: { id: Number(input.id) } });
    return json({ success: true });
  }
  if (request.method === "PUT") {
    const data: any = {};
    const map: Record<string, string> = {
      title: "title",
      subtitle: "subtitle",
      description: "description",
      image_url: "imageUrl",
      badge_text: "badgeText",
      old_price: "oldPrice",
      new_price: "newPrice",
      link_url: "linkUrl",
      button_text: "buttonText",
      sort_order: "sortOrder",
      is_active: "isActive",
    };
    for (const [incoming, field] of Object.entries(map)) if (Object.hasOwn(input, incoming)) data[field] = input[incoming] === "" && ["old_price", "new_price"].includes(incoming) ? null : input[incoming];
    if (!Object.keys(data).length) return json({ error: "No fields to update" }, 400);
    await prisma.promotion.update({ where: { id: Number(input.id) }, data });
    return json({ success: true });
  }
  return json({ error: "Method not allowed" }, 405);
}

export async function agentManage(request: NextRequest) {
  if (!(await admin(request))) return json({ error: "Unauthorized" }, 401);
  if (request.method === "GET") {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const summary = url.searchParams.get("summary") === "1";
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
    const grouped = await prisma.agent.groupBy({ by: ["status"], _count: { status: true } });
    const counts = Object.fromEntries(grouped.map((x) => [x.status, x._count.status]));
    if (summary) return json({ agents: [], counts });
    const agents = await prisma.agent.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, company: true, status: true, createdAt: true, approvedAt: true },
    });
    return json({
      agents: agents.map((x) => ({ id: x.id, first_name: x.firstName, last_name: x.lastName, email: x.email, phone: x.phone, company: x.company, status: x.status, created_at: x.createdAt, approved_at: x.approvedAt })),
      counts,
    });
  }
  if (request.method === "PUT") {
    const input = await body(request);
    if (!["approved", "rejected"].includes(input.status)) return json({ error: "Status must be approved or rejected" }, 400);
    try {
      await prisma.agent.update({ where: { id: Number(input.id) }, data: { status: input.status, approvedAt: input.status === "approved" ? new Date() : null } });
      return json({ success: true, message: "อัปเดตสถานะสำเร็จ" });
    } catch (error: any) {
      if (error.code === "P2025") return json({ error: "Agent not found" }, 404);
      throw error;
    }
  }
  return json({ error: "Method not allowed" }, 405);
}

export async function pageContent(request: NextRequest) {
  const url = new URL(request.url);
  if (request.method === "GET") {
    const isAdmin = url.searchParams.has("admin");
    if (isAdmin && !(await admin(request))) return json({ error: "Unauthorized" }, 401);
    const page = url.searchParams.get("page") || "promotions";
    const result = await readPageContent(page);
    return json({ page, content: result.content, updated_at: result.updated_at, source: result.source });
  }
  if (request.method === "POST") {
    if (!(await admin(request))) return json({ error: "Unauthorized" }, 401);
    const input = await body(request);
    const page = String(input.page || "promotions");
    const content = input.content ?? {};
    const result = await writePageContent(page, content);
    return json({ success: true, ...result });
  }
  return json({ error: "Method not allowed" }, 405);
}

const defaultPayments = { bank_name: "กสิกรไทย (KBank)", account_number: "", account_name: "AQUATHRILL", promptpay_number: "", promptpay_name: "AQUATHRILL", credit_card_enabled: true, bank_transfer_enabled: true, promptpay_enabled: true, payment_note: "" };
export async function paymentSettings(request: NextRequest) {
  if (request.method === "GET") {
    const row = await prisma.siteSetting.findUnique({ where: { settingKey: "payment_settings" } });
    return json({ settings: row ? parseJson(row.settingValue, defaultPayments) : defaultPayments });
  }
  if (request.method === "POST") {
    if (!(await admin(request))) return json({ error: "Unauthorized" }, 401);
    const input = await body(request);
    const settings = { ...defaultPayments, ...input, updated_at: new Date().toISOString() };
    await prisma.siteSetting.upsert({
      where: { settingKey: "payment_settings" },
      create: { settingKey: "payment_settings", settingValue: JSON.stringify(settings) },
      update: { settingValue: JSON.stringify(settings) },
    });
    return json({ success: true, settings });
  }
  return json({ error: "Method not allowed" }, 405);
}

export async function upload(request: NextRequest) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await admin(request))) return json({ error: "Unauthorized" }, 401);
  const form = await request.formData();
  const file = form.get("image");
  if (!(file instanceof File)) return json({ error: "No file uploaded" }, 400);
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) return json({ error: "Invalid file type" }, 400);
  if (file.size > 5 * 1024 * 1024) return json({ error: "File too large. Max 5MB" }, 400);
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    if (process.env.NODE_ENV === "production") {
      return json({ error: "Missing BLOB_READ_WRITE_TOKEN. Please set Vercel Blob environment variable." }, 500);
    }
    const [{ mkdir, writeFile }, path] = await Promise.all([import("node:fs/promises"), import("node:path")]);
    const dir = path.join(process.cwd(), "public", "images", "uploads");
    await mkdir(dir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, safeName), buffer);
    return json({ success: true, url: `/images/uploads/${safeName}`, filename: safeName, storage: "local" });
  }
  try {
    const blobAccess = process.env.BLOB_ACCESS === "private" ? "private" : "public";
    const blob = await put(`images/${safeName}`, file, { access: blobAccess, addRandomSuffix: true });
    return json({
      success: true,
      url: blobAccess === "private" ? `/api/blob-file.php?path=${encodeURIComponent(blob.pathname)}` : blob.url,
      filename: blob.pathname,
      storage: blobAccess === "private" ? "vercel_blob_private" : "vercel_blob",
    });
  } catch (error: any) {
    const message = String(error?.message || "");
    if (/private store|private access/i.test(message)) {
      try {
        const blob = await put(`images/${safeName}`, file, { access: "private", addRandomSuffix: true });
        return json({
          success: true,
          url: `/api/blob-file.php?path=${encodeURIComponent(blob.pathname)}`,
          filename: blob.pathname,
          storage: "vercel_blob_private",
        });
      } catch (privateError: any) {
        return json({ error: privateError?.message || "Failed to upload to private Vercel Blob" }, 500);
      }
    }
    return json({ error: error?.message || "Failed to upload to Vercel Blob" }, 500);
  }
}

export async function blobFile(request: NextRequest) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const path = new URL(request.url).searchParams.get("path") || "";
  if (!path || path.includes("..") || path.startsWith("/")) return json({ error: "Invalid blob path" }, 400);
  try {
    const result = await get(path, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) return json({ error: "Blob not found" }, 404);
    return new Response(result.stream, {
      status: 200,
      headers: {
        "Content-Type": result.blob.contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "ETag": result.blob.etag,
      },
    });
  } catch (error: any) {
    return json({ error: error?.message || "Failed to read blob" }, 500);
  }
}
