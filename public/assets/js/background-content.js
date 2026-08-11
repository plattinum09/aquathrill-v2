(function () {
  const API = "/api";
  const TARGET_SELECTOR = "[data-editable-background]";

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

  function escapeCssUrl(url) {
    return String(url || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "");
  }

  function applyEditableBackgrounds(content) {
    if (!content || typeof content !== "object") return;
    document.querySelectorAll(TARGET_SELECTOR).forEach((el) => {
      const key = el.getAttribute("data-editable-background") || "backgrounds.hero_image";
      const imageUrl = getValue(content, key) || content.hero_background || content.hero_bg;
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
      const response = await fetch(`${API}/page-content.php?page=${encodeURIComponent(pageBase())}`, {
        cache: "no-store",
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
  });
})();
