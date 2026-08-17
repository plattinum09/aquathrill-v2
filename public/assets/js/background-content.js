(function () {
  const API = "/api";
  const TARGET_SELECTOR = "[data-editable-background]";
  const VERSION = "20260818";

  function currentScript() {
    return document.currentScript || Array.from(document.scripts).find((script) => (script.src || "").includes("background-content"));
  }

  function pageBase() {
    const script = currentScript();
    const configured = script && script.getAttribute("data-page");
    if (configured) return configured;
    const slug = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
    return slug || "home";
  }

  function getValue(content, key) {
    return String(key || "").split(".").reduce((acc, part) => (acc && acc[part] != null ? acc[part] : undefined), content);
  }

  function firstText(...values) {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  }

  function escapeCssUrl(url) {
    return String(url || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "");
  }

  function applyEditableBackgrounds(content) {
    if (!content || typeof content !== "object") return;
    document.querySelectorAll(TARGET_SELECTOR).forEach((el) => {
      const key = el.getAttribute("data-editable-background") || "backgrounds.hero_image";
      const imageUrl = firstText(
        getValue(content, key),
        getValue(content, "backgrounds.hero_image"),
        getValue(content, "backgrounds.image"),
        getValue(content, "backgrounds.home"),
        content.hero_background,
        content.hero_bg
      );
      if (!imageUrl) return;
      const overlay = el.getAttribute("data-bg-overlay") || "linear-gradient(135deg, rgba(11, 27, 43, 0.78), rgba(14, 165, 233, 0.28))";
      const position = el.getAttribute("data-bg-position") || "center center";
      el.style.backgroundImage = `${overlay}, url("${escapeCssUrl(imageUrl)}")`;
      el.style.backgroundSize = "cover";
      el.style.backgroundPosition = position;
      el.style.backgroundRepeat = "no-repeat";
      el.setAttribute("data-bg-loaded", "true");
    });
  }

  async function loadEditableBackgrounds() {
    try {
      const response = await fetch(`${API}/page-content.php?page=${encodeURIComponent(pageBase())}&_=${Date.now()}&v=${VERSION}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) return;
      const data = await response.json();
      applyEditableBackgrounds(data.content);
    } catch (error) {
      console.warn("[background-content] Unable to load editable backgrounds", error);
    }
  }

  window.applyEditableBackgrounds = applyEditableBackgrounds;
  window.loadEditableBackgrounds = loadEditableBackgrounds;

  document.addEventListener("DOMContentLoaded", () => {
    loadEditableBackgrounds();
    setTimeout(loadEditableBackgrounds, 800);
    setTimeout(loadEditableBackgrounds, 1800);
  });

  window.addEventListener("pageshow", () => {
    loadEditableBackgrounds();
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadEditableBackgrounds();
  });
})();
