import type { NextRequest } from "next/server";
import { readSession } from "./auth";
import { query } from "./db";
import { body, json, publicJson } from "./http";

export async function availability(request:NextRequest){
  if(request.method==="POST"){
    if(!(await readSession(request,"admin")))return json({error:"Unauthorized"},401);const input=await body(request);
    if(!input.boat_type||!input.date||!input.time_slot)return json({error:"Missing required fields: boat_type, date, time_slot"},400);
    await query("INSERT INTO boat_availability(boat_type,slot_date,time_slot,status,total_boats,blocked_boats) VALUES($1,$2::date,$3,$4,$5,$6) ON CONFLICT(boat_type,slot_date,time_slot) DO UPDATE SET status=EXCLUDED.status,total_boats=EXCLUDED.total_boats,blocked_boats=EXCLUDED.blocked_boats",[input.boat_type,input.date,input.time_slot,input.status||"available",input.total_boats??null,Number(input.blocked_boats||0)]);return json({success:true});
  }
  if(request.method!=="GET")return json({error:"Method not allowed"},405);
  const url=new URL(request.url);const now=new Date();const month=Number(url.searchParams.get("month")||now.getMonth()+1);const year=Number(url.searchParams.get("year")||now.getFullYear());const selected=url.searchParams.get("boat")||"all";
  const start=`${year}-${String(month).padStart(2,"0")}-01`;const end=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);
  const boats=(await query<any>(
    selected==="all"
      ? "SELECT id,total_boats FROM boat_types WHERE is_active=1 ORDER BY sort_order,id"
      : "SELECT id,total_boats FROM boat_types WHERE is_active=1 AND id=$1 ORDER BY sort_order,id",
    selected==="all"?[]:[selected]
  )).rows as Array<{id:string;total_boats:number}>;const targets=boats;
  const overrides=(await query<any>(
    selected==="all"
      ? "SELECT boat_type,slot_date::text,time_slot,status,total_boats,blocked_boats FROM boat_availability WHERE slot_date BETWEEN $1::date AND $2::date"
      : "SELECT boat_type,slot_date::text,time_slot,status,total_boats,blocked_boats FROM boat_availability WHERE boat_type=$1 AND slot_date BETWEEN $2::date AND $3::date",
    selected==="all"?[start,end]:[selected,start,end]
  )).rows;
  const counts=(await query<any>(
    selected==="all"
      ? "SELECT boat_type,booking_date::text,time_slot,COUNT(*)::int cnt FROM bookings WHERE booking_date BETWEEN $1::date AND $2::date AND status!='cancelled' GROUP BY boat_type,booking_date,time_slot"
      : "SELECT boat_type,booking_date::text,time_slot,COUNT(*)::int cnt FROM bookings WHERE boat_type=$1 AND booking_date BETWEEN $2::date AND $3::date AND status!='cancelled' GROUP BY boat_type,booking_date,time_slot",
    selected==="all"?[start,end]:[selected,start,end]
  )).rows;
  const overrideMap=new Map(overrides.map((x:any)=>[`${x.slot_date.slice(0,10)}|${x.boat_type}|${x.time_slot}`,x]));const countMap=new Map(counts.map((x:any)=>[`${x.booking_date.slice(0,10)}|${x.boat_type}|${x.time_slot}`,Number(x.cnt)]));
  const details:Record<string,any>={};const calendar:Record<string,string>={};const pastDates:string[]=[];const today=new Date().toISOString().slice(0,10);const days=new Date(year,month,0).getDate();
  for(let day=1;day<=days;day++){const date=`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;details[date]={};let availableSum=0,capacitySum=0;if(date<today)pastDates.push(date);for(const boat of targets){details[date][boat.id]={};for(const slot of ["morning","afternoon"]){const key=`${date}|${boat.id}|${slot}`;const over:any=overrideMap.get(key);const total=Number(over?.total_boats??boat.total_boats??1);const blocked=over?.status==="blocked"?total:Number(over?.blocked_boats||0);const booked=Number(countMap.get(key)||0);const available=Math.max(0,total-booked-blocked);details[date][boat.id][slot]={total,booked,blocked,available};availableSum+=available;capacitySum+=total;}}calendar[date]=!capacitySum||!availableSum?"booked":availableSum<capacitySum?"limited":"available";}
  return publicJson({month,year,calendar,details,pastDates},200,"public, max-age=15, s-maxage=120, stale-while-revalidate=600");
}

function bookingId(prefix="BK",date=new Date().toISOString().slice(0,10)){return `${prefix}-${date.replaceAll("-","")}-${String(Math.floor(Math.random()*999)+1).padStart(3,"0")}`;}
function minOnlineBookingAmount(){return Number(process.env.MIN_ONLINE_BOOKING_AMOUNT||20);}
export async function bookings(request:NextRequest){
  const url=new URL(request.url);const admin=await readSession(request,"admin");
  if(request.method==="GET"){
    const search=url.searchParams.get("search")?.trim()||"";
    if(!admin){if(!/^[A-Za-z0-9-]{6,30}$/.test(search))return json({error:"Unauthorized"},401);const r=await query<any>("SELECT booking_id,boat_type,booking_date,time_slot,guests,total_price,status,payment_method FROM bookings WHERE booking_id=$1 LIMIT 1",[search]);return json({bookings:r.rows});}
    const conditions=["1=1"];const values:any[]=[];for(const [param,column] of [["status","status"],["date_from","booking_date >="],["date_to","booking_date <="],["boat_type","boat_type"]]){const value=url.searchParams.get(param);if(value){values.push(value);const cast=param==="date_from"||param==="date_to"?"::date":"";conditions.push(column.includes(" ")?`${column} $${values.length}${cast}`:`${column}=$${values.length}${cast}`)}}if(search){values.push(`%${search}%`);conditions.push(`(customer_name ILIKE $${values.length} OR customer_phone ILIKE $${values.length} OR booking_id ILIKE $${values.length})`)}const page=Math.max(1,Number(url.searchParams.get("page")||1));const limit=Math.min(100,Math.max(10,Number(url.searchParams.get("limit")||20)));const count=await query<any>(`SELECT COUNT(*)::int total FROM bookings WHERE ${conditions.join(" AND ")}`,values);values.push(limit,(page-1)*limit);const rows=await query<any>(`SELECT * FROM bookings WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT $${values.length-1} OFFSET $${values.length}`,values);const total=Number(count.rows[0].total);return json({bookings:rows.rows,total,page,limit,pages:Math.ceil(total/limit)});
  }
  const input=await body(request);
  if(request.method==="POST"){
    if(input.admin_create&&!admin)return json({error:"Unauthorized"},401);for(const f of ["boat_type","booking_date","time_slot","guests","customer_name","customer_phone"])if(!input[f])return json({error:`Missing field: ${f}`},400);
    const boat=(await query<any>("SELECT total_boats,price FROM boat_types WHERE id=$1 AND is_active=1",[input.boat_type])).rows[0];if(!boat)return json({error:"Invalid or inactive boat type"},400);
    if(!input.skip_availability){const over=(await query<any>("SELECT status,total_boats,blocked_boats FROM boat_availability WHERE boat_type=$1 AND slot_date=$2::date AND time_slot=$3",[input.boat_type,input.booking_date,input.time_slot])).rows[0];if(over?.status==="blocked")return json({error:"This slot is blocked"},409);const booked=Number((await query<any>("SELECT COUNT(*)::int count FROM bookings WHERE boat_type=$1 AND booking_date=$2::date AND time_slot=$3 AND status!='cancelled'",[input.boat_type,input.booking_date,input.time_slot])).rows[0].count);if(Number(over?.total_boats??boat.total_boats)-booked-Number(over?.blocked_boats||0)<=0)return json({error:"No boats available for this slot"},409);}
    const id=bookingId(input.booking_type==="agent"?"AG":"BK",input.admin_create?input.booking_date:undefined);const price=input.admin_create&&input.total_price!=null?Number(input.total_price):Number(boat.price);const minAmount=minOnlineBookingAmount();if(!Number.isFinite(price)||price<minAmount)return json({error:`Invalid booking price: amount must be at least ${minAmount} THB`},400);const status=input.admin_create?(input.status||"confirmed"):"pending";
    await query("INSERT INTO bookings(booking_id,boat_type,booking_date,time_slot,guests,customer_name,customer_phone,customer_email,payment_method,total_price,status,notes,agent_id) VALUES($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",[id,input.boat_type,input.booking_date,input.time_slot,Number(input.guests),input.customer_name,input.customer_phone,input.customer_email||"",input.payment_method||"",price,status,input.notes||"",input.agent_id||null]);return json({success:true,booking_id:id,total_price:price},201);
  }
  if(!admin)return json({error:"Unauthorized"},401);
  if(request.method==="PUT"){if(!["pending","confirmed","cancelled"].includes(input.status))return json({error:"Invalid status"},400);const r=await query("UPDATE bookings SET status=$1,notes=COALESCE($2,notes),payment_method=CASE WHEN $1='confirmed' AND COALESCE(payment_method,'')='' THEN 'bank_transfer' WHEN $1='cancelled' THEN COALESCE(payment_method,'') ELSE payment_method END WHERE id=$3",[input.status,input.notes??null,input.id]);return r.rowCount?json({success:true}):json({error:"Booking not found"},404);}
  if(request.method==="DELETE"){const r=await query("DELETE FROM bookings WHERE id=$1",[input.id]);return r.rowCount?json({success:true,message:"ลบการจองเรียบร้อยแล้ว"}):json({error:"ไม่พบการจอง"},404);}
  return json({error:"Method not allowed"},405);
}

export async function adminBookingStats(request: NextRequest) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (!(await readSession(request, "admin"))) return json({ error: "Unauthorized" }, 401);
  const result = await query<any>(
    `SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE booking_date = CURRENT_DATE)::int AS today,
      COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
      COALESCE(SUM(CASE WHEN status <> 'cancelled' THEN total_price ELSE 0 END), 0)::numeric AS revenue
    FROM bookings`,
    []
  );
  const row = result.rows[0] || {};
  return json({
    total: Number(row.total || 0),
    today: Number(row.today || 0),
    confirmed: Number(row.confirmed || 0),
    revenue: Number(row.revenue || 0),
  });
}
