import type { NextRequest } from "next/server";
import { adminAuth } from "@/lib/api/admin-auth";
import { agentAuth } from "@/lib/api/agent-auth";
import { adminBookingStats, availability, bookings } from "@/lib/api/booking-handlers";
import { agentBooking, agentPricing, agentSlip } from "@/lib/api/agent-handlers";
import { gallery, galleryAuth } from "@/lib/api/gallery-handlers";
import { omiseConfig, omisePayment, omiseSyncStatus, omiseWebhook, paysolutionsCallback, paysolutionsPayment } from "@/lib/api/payment-handlers";
import { reviews } from "@/lib/api/review-handlers";
import { agentManage, boatPricing, boatTypes, pageContent, paymentSettings, promotions, upload } from "@/lib/api/core-handlers";
import { errorResponse, json } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

type Context={params:Promise<{endpoint:string}>};
async function dispatch(request:NextRequest,context:Context){
  const endpoint=(await context.params).endpoint.replace(/\.php$/,"");
  try{
    switch(endpoint){
      case "admin-auth":return adminAuth(request);
      case "agent-auth":return agentAuth(request);
      case "boat-types":case "boat-types-v2":return boatTypes(request);
      case "boat-pricing":return boatPricing(request);
      case "availability":return availability(request);
      case "bookings":return bookings(request);
      case "admin-booking-stats":return adminBookingStats(request);
      case "promotions":return promotions(request);
      case "agent-manage":return agentManage(request);
      case "agent-pricing":return agentPricing(request);
      case "agent-slip":return agentSlip(request);
      case "agent-booking":return agentBooking(request);
      case "page-content":return pageContent(request);
      case "payment-settings":return paymentSettings(request);
      case "upload":return upload(request);
      case "gallery":return gallery(request);
      case "gallery-auth":return galleryAuth(request);
      case "omise-payment":return omisePayment(request);
      case "omise-config":return omiseConfig();
      case "omise-sync-status":return omiseSyncStatus(request);
      case "omise-webhook":return omiseWebhook(request);
      case "paysolutions-payment":return paysolutionsPayment(request);
      case "paysolutions-callback":return paysolutionsCallback(request);
      case "google-reviews":return reviews(request);
      default:return json({error:`API endpoint ${endpoint} is not migrated yet`},501);
    }
  }catch(error){return errorResponse(error);}
}
export const GET=dispatch;export const POST=dispatch;export const PUT=dispatch;export const DELETE=dispatch;
export function OPTIONS(){return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,PUT,DELETE,OPTIONS","Access-Control-Allow-Headers":"Content-Type,Authorization"}});}
