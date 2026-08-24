(function () {
  const API = "/api";
  const CONTENT_SELECTOR = "[data-page-content]";
  const IMAGE_SELECTOR = "[data-page-image]";

  function currentScript() {
    return document.currentScript || Array.from(document.scripts).find((script) => (script.src || "").includes("page-content-loader"));
  }

  function pageBase() {
    const script = currentScript();
    const configured = script && script.getAttribute("data-page");
    if (configured) return configured;
    const slug = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
    return slug || "home";
  }

  function preparePageContentTargets(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      if (!el.hasAttribute("data-page-content")) {
        el.setAttribute("data-page-content", el.getAttribute("data-i18n"));
      }
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      if (!el.hasAttribute("data-page-placeholder")) {
        el.setAttribute("data-page-placeholder", el.getAttribute("data-i18n-placeholder"));
      }
    });
  }

  function getLang() {
    if (window.I18n && typeof window.I18n.getLang === "function") return window.I18n.getLang();
    const params = new URLSearchParams(window.location.search);
    return params.get("lang") || localStorage.getItem("preferred_lang") || "th";
  }

  function pageKey() {
    const lang = getLang();
    const base = pageBase();
    return lang === "th" ? base : `${base}_${lang}`;
  }

  function getValue(content, key) {
    return key.split(".").reduce((acc, part) => (acc && acc[part] != null ? acc[part] : undefined), content);
  }

  function containsThaiText(value) {
    return /[\u0E00-\u0E7F]/.test(String(value || ""));
  }

  function shouldSkipI18nContentOverride(el, value) {
    const lang = getLang();
    if (lang === "th" || !el.hasAttribute("data-i18n")) return false;
    if (el.hasAttribute("data-i18n-static")) return true;
    return containsThaiText(value);
  }

  function storageKey(page = pageKey()) {
    return `aquathrill:page-content:${page}`;
  }

  function readCachedContent() {
    try {
      const raw = localStorage.getItem(storageKey());
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeCachedContent(content) {
    try {
      if (content && typeof content === "object") {
        localStorage.setItem(storageKey(), JSON.stringify(content));
      }
    } catch (error) {}
  }

  function applyPageContent(content) {
    if (!content || typeof content !== "object") return;
    if (pageBase() === "services" && content.svc && typeof content.svc === "object") {
      const staleHighlights = [
        "5 จุดแวะสำรวจตลอดเส้นทาง ตั้งแต่แหลมมะพร้าวจนถึงเกาะไข่ใน",
        "5 stops along the route, from Laem Maphrao to Khai Nai Island",
        "5 остановок: от мыса Мапрао до острова Кхай Най",
        "从玛帕劳角到内蛋岛，5个精彩停靠点",
      ];
      const staleDuration = [
        "ทริปครึ่งวัน 3 เกาะ 5 จุด (4 ชม.)",
        "Half-day trip: 3 islands, 5 stops (4 hrs)",
        "Полдня: 3 острова, 5 остановок (4 ч.)",
        "半日游：3个岛屿，5个停靠点（4小时）",
      ];
      if (staleHighlights.includes(content.svc.highlights_sub)) {
        const lang = getLang();
        content.svc.highlights_sub = {
          th: "3 จุดแวะสำรวจ: เกาะไข่นุ้ย เกาะไข่นอก และเกาะไข่ใน",
          en: "3 island stops: Khai Nui, Khai Nok, and Khai Nai",
          ru: "3 остановки: Кхай Нуй, Кхай Нок и Кхай Най",
          zh: "3个岛屿停靠点：小蛋岛、外蛋岛和内蛋岛",
        }[lang] || "3 จุดแวะสำรวจ: เกาะไข่นุ้ย เกาะไข่นอก และเกาะไข่ใน";
      }
      if (staleDuration.includes(content.svc.cond_duration)) {
        const lang = getLang();
        content.svc.cond_duration = {
          th: "ทริปครึ่งวัน 3 จุด (4 ชม.)",
          en: "Half-day trip: 3 stops (4 hrs)",
          ru: "Полдня: 3 остановки (4 ч.)",
          zh: "半日游：3个停靠点（4小时）",
        }[lang] || "ทริปครึ่งวัน 3 จุด (4 ชม.)";
      }
      const stalePierText = String(content.svc.schedule_sub || "") + String(content.svc.departure_point || "") + String(content.svc.cond_pier || "");
      if (stalePierText.includes("Phetphoom")) {
        const lang = getLang();
        content.svc.schedule_sub = {
          th: "ออกจากท่าเรือ Royal Phuket Marina — วันละ 2 รอบ",
          en: "Departs from Royal Phuket Marina — 2 rounds daily",
          ru: "Отправление из Royal Phuket Marina — 2 рейса в день",
          zh: "从 Royal Phuket Marina 出发 — 每天2个场次",
        }[lang] || "ออกจากท่าเรือ Royal Phuket Marina — วันละ 2 รอบ";
        content.svc.departure_point = {
          th: '<i class="fas fa-map-marker-alt" style="color: var(--primary);"></i> ออกจากท่าเรือ <strong>Royal Phuket Marina</strong>',
          en: '<i class="fas fa-map-marker-alt" style="color: var(--primary);"></i> Departure from <strong>Royal Phuket Marina</strong>',
          ru: '<i class="fas fa-map-marker-alt" style="color: var(--primary);"></i> Отправление из <strong>Royal Phuket Marina</strong>',
          zh: '<i class="fas fa-map-marker-alt" style="color: var(--primary);"></i> 从 <strong>Royal Phuket Marina</strong> 出发',
        }[lang] || '<i class="fas fa-map-marker-alt" style="color: var(--primary);"></i> ออกจากท่าเรือ <strong>Royal Phuket Marina</strong>';
        content.svc.cond_pier = {
          th: "ออกจากท่าเรือ Royal Phuket Marina",
          en: "Departs from Royal Phuket Marina",
          ru: "Отправление из Royal Phuket Marina",
          zh: "从 Royal Phuket Marina 出发",
        }[lang] || "ออกจากท่าเรือ Royal Phuket Marina";
      }
      const staleAfternoon = [
        '<strong>รับที่โรงแรม:</strong> 12:30 - 12:45<br><strong>ออกเดินทาง:</strong> 14:00 - 18:00',
        '<strong>Pick Up:</strong> 12:30 - 12:45<br><strong>Departure:</strong> 14:00 - 18:00',
        '<strong>Трансфер:</strong> 12:30 - 12:45<br><strong>Отправление:</strong> 14:00 - 18:00',
        '<strong>接送：</strong> 12:30 - 12:45<br><strong>出发：</strong> 14:00 - 18:00',
      ];
      if (staleAfternoon.includes(content.svc.afternoon_time)) {
        const lang = getLang();
        content.svc.afternoon_time = {
          th: '<strong>รับที่โรงแรม:</strong> 11:45 - 12:00<br><strong>ออกเดินทาง:</strong> 13:00 - 17:00',
          en: '<strong>Pick Up:</strong> 11:45 - 12:00<br><strong>Departure:</strong> 13:00 - 17:00',
          ru: '<strong>Трансфер:</strong> 11:45 - 12:00<br><strong>Отправление:</strong> 13:00 - 17:00',
          zh: '<strong>接送：</strong> 11:45 - 12:00<br><strong>出发：</strong> 13:00 - 17:00',
        }[lang] || '<strong>รับที่โรงแรม:</strong> 11:45 - 12:00<br><strong>ออกเดินทาง:</strong> 13:00 - 17:00';
      }
    }
    preparePageContentTargets();
    document.querySelectorAll(CONTENT_SELECTOR).forEach((el) => {
      const key = el.getAttribute("data-page-content");
      const value = getValue(content, key);
      if (value == null || value === "") return;
      if (shouldSkipI18nContentOverride(el, value)) return;
      el.innerHTML = String(value);
    });
    document.querySelectorAll("[data-page-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-page-placeholder");
      const value = getValue(content, key);
      if (value == null || value === "") return;
      el.setAttribute("placeholder", String(value));
    });
    document.querySelectorAll(IMAGE_SELECTOR).forEach((el) => {
      const key = el.getAttribute("data-page-image");
      const value = getValue(content, key);
      if (value == null || value === "") return;
      el.setAttribute("src", String(value));
    });
  }

  async function loadPageContent() {
    try {
      const response = await fetch(`${API}/page-content.php?page=${encodeURIComponent(pageKey())}&_=${Date.now()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) return;
      const data = await response.json();
      applyPageContent(data.content);
      writeCachedContent(data.content);
    } catch (error) {
      console.warn("[page-content] Unable to load saved page content", error);
    }
  }

  window.applyPageContent = applyPageContent;
  window.loadPageContent = loadPageContent;
  window.preparePageContentTargets = preparePageContentTargets;

  function initPageContent() {
    preparePageContentTargets();
    applyPageContent(readCachedContent());
    setTimeout(loadPageContent, 350);
    setTimeout(loadPageContent, 900);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPageContent, { once: true });
  } else {
    initPageContent();
  }
  window.addEventListener("pageshow", () => {
    setTimeout(loadPageContent, 80);
  });
  document.addEventListener("langchange", () => {
    setTimeout(loadPageContent, 80);
    setTimeout(loadPageContent, 550);
  });
})();
