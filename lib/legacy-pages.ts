import path from "node:path";

const pageFiles: Record<string, string> = {
  "": "index.html",
  services: "services/index.html",
  promotions: "promotions/index.html",
  reviews: "reviews/index.html",
  contact: "contact/index.html",
  gallery: "gallery/index.html",
  booking: "booking/index.html",
  "booking/payment/result": "booking/payment/result.html",
  terms: "terms/index.html",
  "privacy-policy": "privacy-policy/index.html",
  "refund-policy": "refund-policy/index.html",
  agent: "agent/index.html",
  "agent/login": "agent/login/index.html",
  admin: "admin/index.html",
  "admin/agent-pricing": "admin/agent-pricing.html",
  "admin/availability": "admin/availability.html",
  "admin/boat-pricing": "admin/boat-pricing.html",
  "admin/boat-types": "admin/boat-types.html",
  "admin/bookings": "admin/bookings.html",
  "admin/change-password": "admin/change-password.html",
  "admin/gallery": "admin/gallery.html",
  "admin/background-editor": "admin/background-editor.html",
  "admin/home-editor": "admin/home-editor.html",
  "admin/services-editor": "admin/services-editor.html",
  "admin/payment-settings": "admin/payment-settings.html",
  "admin/promotions-editor": "admin/promotions-editor.html",
  "admin/promotions": "admin/promotions.html",
  "admin/reviews": "admin/reviews.html",
};

export function normalizePageSlug(parts: string[] = []) {
  let slug = parts.join("/").replace(/^\/+|\/+$/g, "");
  if (slug === "index.html") return "";
  if (slug.endsWith("/index.html")) slug = slug.slice(0, -11);
  if (slug.endsWith(".html")) slug = slug.slice(0, -5);
  return slug;
}

export function getLegacyPagePath(parts: string[] = []) {
  const file = pageFiles[normalizePageSlug(parts)];
  return file ? path.join(process.cwd(), "public", "legacy", file) : null;
}

export function getKnownPageSlugs() {
  return Object.keys(pageFiles).map((slug) => slug ? slug.split("/") : []);
}
