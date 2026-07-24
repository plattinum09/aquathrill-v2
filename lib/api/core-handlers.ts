import { put } from "@vercel/blob";
import type { NextRequest } from "next/server";
import { readSession } from "./auth";
import { query } from "./db";
import { body, json } from "./http";

async function admin(request: NextRequest) {
  const session = await readSession(request, "admin");
  return session || null;
}

const parseJson = (value: any, fallback: any) => {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
};

function fallbackBoatImage(id: string) {
  if (id === "12ft") return "/images/12-feet.webp";
  if (id === "14ft") return "/images/14-feet.webp";
  return "/images/boat-default.webp";
}

function normalizeBoatImage(value: unknown, id: string) {
  const image = typeof value === "string" ? value.trim() : "";
  // These paths came from the old writable PHP server. The files are not part of
  // the repository and cannot exist on Vercel's immutable filesystem.
  if (!image || /^\/images\/promotions\/promo-/i.test(image)) return fallbackBoatImage(id);
  return image;
}

export async function boatTypes(request: NextRequest) {
  if (request.method === "GET") {
    const all = new URL(request.url).searchParams.has("all");
    const result = await query<any>(`SELECT * FROM boat_types ${all ? "" : "WHERE is_active=1"} ORDER BY sort_order,id`);
    const types = result.rows.map((row:any) => {
      const images = parseJson(row.images, []).map((image: unknown) => normalizeBoatImage(image, row.id));
      const image = normalizeBoatImage(row.image || images[0], row.id);
      return { ...row, image, price:Number(row.price), total_boats:Number(row.total_boats), max_guests:Number(row.max_guests), max_weight:Number(row.max_weight), images: images.length ? images : [image], features:parseJson(row.features,[]), i18n:parseJson(row.i18n,null) };
    });
    const prices:Record<string,number>={}; const boats:Record<string,any>={};
    for(const row of types){ prices[row.id]=row.price; boats[row.id]={name:row.name,image:row.image||row.images[0]||"",images:row.images,desc:row.description||""}; }
    return json({boat_types:types,prices,boats,_v:"next-1.0"});
  }
  if (!(await admin(request))) return json({error:"Unauthorized"},401);
  const input=await body(request);
  if(request.method==="POST"){
    if(!input.id||!input.name)return json({error:"Missing required fields: id, name"},400);
    const id=String(input.id).toLowerCase().replace(/[^a-z0-9]/g,"");
    try { await query(`INSERT INTO boat_types(id,name,total_boats,max_guests,max_weight,price,description,image,images,features,i18n,book_url,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[id,input.name,Number(input.total_boats||1),Number(input.max_guests||3),Number(input.max_weight||200),Number(input.price||9900),input.description||"",input.image||"",JSON.stringify(input.images||[]),JSON.stringify(input.features||[]),JSON.stringify(input.i18n||{}),input.book_url||"",Number(input.sort_order||0)]); }
    catch(error:any){ if(error.code==="23505")return json({error:"Boat type ID already exists"},409); throw error; }
    return json({success:true,id},201);
  }
  if(request.method==="PUT"){
    if(!input.id)return json({error:"Missing boat type id"},400);
    const fields=["name","total_boats","max_guests","max_weight","price","description","image","book_url","sort_order","is_active","images","features","i18n"];
    const updates:string[]=[]; const values:any[]=[];
    for(const field of fields) if(Object.prototype.hasOwnProperty.call(input,field)){ values.push(["images","features","i18n"].includes(field)?JSON.stringify(input[field]):input[field]); updates.push(`${field}=$${values.length}`); }
    if(!updates.length)return json({error:"No fields to update"},400); values.push(input.id);
    await query(`UPDATE boat_types SET ${updates.join(",")} WHERE id=$${values.length}`,values); return json({success:true,_v:"next-1.0"});
  }
  if(request.method==="DELETE") { if(!input.id)return json({error:"Missing boat type id"},400); await query("DELETE FROM boat_types WHERE id=$1",[input.id]); return json({success:true}); }
  return json({error:"Method not allowed"},405);
}

export async function boatPricing(request: NextRequest){
  if(request.method==="POST"){
    if(!(await admin(request)))return json({error:"Unauthorized"},401); const input=await body(request);
    for(const [id,item] of Object.entries<any>(input.boats||{})){ await query("UPDATE boat_types SET price=COALESCE($1,price),image=COALESCE($2,image),images=COALESCE($3,images) WHERE id=$4",[item.price??null,item.image??null,item.images?JSON.stringify(item.images):null,id]); }
    for(const [id,price] of Object.entries(input.prices||{}))await query("UPDATE boat_types SET price=$1 WHERE id=$2",[price,id]);
  } else if(request.method!=="GET") return json({error:"Method not allowed"},405);
  const result=await query<any>("SELECT * FROM boat_types WHERE is_active=1 ORDER BY sort_order,id"); const prices:Record<string,number>={}; const boats:Record<string,any>={};
  for(const row of result.rows){const parsedImages=parseJson(row.images,[]).map((image:unknown)=>normalizeBoatImage(image,row.id));const image=normalizeBoatImage(row.image||parsedImages[0],row.id);const images=parsedImages.length?parsedImages:[image];prices[row.id]=Number(row.price); boats[row.id]={price:Number(row.price),name:row.name,desc:row.description||"",badge:`2-${row.max_guests} คน / ${row.max_weight}kg`,image,images,bookUrl:row.book_url||`https://wa.me/66958192778?text=${encodeURIComponent("สนใจจอง "+row.name)}`};}
  return json({...(request.method==="POST"?{success:true}:{}),prices,boats});
}

export async function promotions(request:NextRequest){
  const input=request.method==="GET"?{}:await body(request); const url=new URL(request.url);
  if(request.method==="GET"){const all=url.searchParams.has("all"); if(all&&!(await admin(request)))return json({error:"Unauthorized"},401); const r=await query<any>(`SELECT * FROM promotions ${all?"":"WHERE is_active=1"} ORDER BY sort_order,id`); return json({promotions:r.rows});}
  if(!(await admin(request)))return json({error:"Unauthorized"},401);
  if(request.method==="POST"){if(!input.title)return json({error:"Title is required"},400); const r=await query<any>("INSERT INTO promotions(title,subtitle,description,image_url,badge_text,old_price,new_price,link_url,button_text,sort_order,is_active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id",[input.title,input.subtitle||"",input.description||"",input.image_url||"",input.badge_text||"",input.old_price||null,input.new_price||null,input.link_url||"",input.button_text||"จองเลย",Number(input.sort_order||0),Number(input.is_active??1)]);return json({success:true,id:r.rows[0].id},201);}
  if(request.method==="DELETE"){await query("DELETE FROM promotions WHERE id=$1",[input.id]);return json({success:true});}
  if(request.method==="PUT"){const allowed=["title","subtitle","description","image_url","badge_text","old_price","new_price","link_url","button_text","sort_order","is_active"];const values:any[]=[];const fields:string[]=[];for(const f of allowed)if(Object.hasOwn(input,f)){values.push(input[f]===""&&["old_price","new_price"].includes(f)?null:input[f]);fields.push(`${f}=$${values.length}`)}if(!fields.length)return json({error:"No fields to update"},400);values.push(input.id);await query(`UPDATE promotions SET ${fields.join(",")} WHERE id=$${values.length}`,values);return json({success:true});}
  return json({error:"Method not allowed"},405);
}

export async function agentManage(request:NextRequest){if(!(await admin(request)))return json({error:"Unauthorized"},401);if(request.method==="GET"){const status=new URL(request.url).searchParams.get("status");const r=await query<any>(`SELECT id,first_name,last_name,email,phone,company,status,created_at,approved_at FROM agents ${status?"WHERE status=$1":""} ORDER BY created_at DESC`,status?[status]:[]);const c=await query<any>("SELECT status,COUNT(*)::int cnt FROM agents GROUP BY status");return json({agents:r.rows,counts:Object.fromEntries(c.rows.map((x:any)=>[x.status,x.cnt]))});}if(request.method==="PUT"){const input=await body(request);if(!["approved","rejected"].includes(input.status))return json({error:"Status must be approved or rejected"},400);const r=await query("UPDATE agents SET status=$1,approved_at=CASE WHEN $1='approved' THEN NOW() ELSE NULL END WHERE id=$2",[input.status,input.id]);return r.rowCount?json({success:true,message:"อัปเดตสถานะสำเร็จ"}):json({error:"Agent not found"},404);}return json({error:"Method not allowed"},405);}

export async function pageContent(request:NextRequest){const url=new URL(request.url);if(request.method==="GET"){const r=await query<any>("SELECT content FROM page_content WHERE page_key=$1",[url.searchParams.get("page")||"promotions"]);return json({content:r.rows[0]?.content??null});}if(request.method==="POST"){if(!(await admin(request)))return json({error:"Unauthorized"},401);const input=await body(request);await query("INSERT INTO page_content(page_key,content) VALUES($1,$2::jsonb) ON CONFLICT(page_key) DO UPDATE SET content=EXCLUDED.content,updated_at=NOW()",[input.page||"promotions",JSON.stringify(input.content||{})]);return json({success:true});}return json({error:"Method not allowed"},405);}

const defaultPayments={bank_name:"กสิกรไทย (KBank)",account_number:"",account_name:"AQUATHRILL",promptpay_number:"",promptpay_name:"AQUATHRILL",credit_card_enabled:true,bank_transfer_enabled:true,promptpay_enabled:true,payment_note:""};
export async function paymentSettings(request:NextRequest){if(request.method==="GET"){const r=await query<any>("SELECT setting_value FROM site_settings WHERE setting_key='payment_settings'");return json({settings:r.rows[0]?parseJson(r.rows[0].setting_value,defaultPayments):defaultPayments});}if(request.method==="POST"){if(!(await admin(request)))return json({error:"Unauthorized"},401);const input=await body(request);const settings={...defaultPayments,...input,updated_at:new Date().toISOString()};await query("INSERT INTO site_settings(setting_key,setting_value) VALUES('payment_settings',$1) ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_at=NOW()",[JSON.stringify(settings)]);return json({success:true,settings});}return json({error:"Method not allowed"},405);}

export async function upload(request:NextRequest){if(request.method!=="POST")return json({error:"Method not allowed"},405);if(!(await admin(request)))return json({error:"Unauthorized"},401);const form=await request.formData();const file=form.get("image");if(!(file instanceof File))return json({error:"No file uploaded"},400);if(!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type))return json({error:"Invalid file type"},400);if(file.size>5*1024*1024)return json({error:"File too large. Max 5MB"},400);const blob=await put(`images/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"-")}`,file,{access:"public",addRandomSuffix:true});return json({success:true,url:blob.url,filename:blob.pathname});}
