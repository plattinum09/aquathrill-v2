(function () {
  const API = "/api";
  const TEXT_SELECTOR = "[data-home-content]";

  function prepareHomeContentTargets(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      if (!el.hasAttribute("data-home-content")) {
        el.setAttribute("data-home-content", el.getAttribute("data-i18n"));
      }
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      if (!el.hasAttribute("data-home-placeholder")) {
        el.setAttribute("data-home-placeholder", el.getAttribute("data-i18n-placeholder"));
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
    return lang === "th" ? "home" : "home_" + lang;
  }

  function storageKey(page = pageKey()) {
    return `aquathrill:page-content:${page}`;
  }

  function readCachedContent() {
    try {
      const raw = localStorage.getItem(storageKey());
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeCachedContent(content) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(content || {}));
    } catch (_) {
      /* localStorage may be disabled; ignore */
    }
  }

  function getValue(content, key) {
    return key.split(".").reduce((acc, part) => (acc && acc[part] != null ? acc[part] : undefined), content);
  }

  function applyHomeContent(content) {
    if (!content || typeof content !== "object") return;
    prepareHomeContentTargets();
    document.querySelectorAll(TEXT_SELECTOR).forEach((el) => {
      const key = el.getAttribute("data-home-content");
      const value = getValue(content, key);
      if (value == null || value === "") return;
      el.innerHTML = String(value);
    });
    document.querySelectorAll("[data-home-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-home-placeholder");
      const value = getValue(content, key);
      if (value == null || value === "") return;
      el.setAttribute("placeholder", String(value));
    });
    document.querySelectorAll("[data-home-image]").forEach((el) => {
      const key = el.getAttribute("data-home-image");
      const value = getValue(content, key);
      if (value == null || value === "") return;
      el.setAttribute("src", String(value));
    });
  }

  async function loadHomeContent() {
    try {
      const response = await fetch(`${API}/page-content.php?page=${encodeURIComponent(pageKey())}&_=${Date.now()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) return;
      const data = await response.json();
      applyHomeContent(data.content);
      if (data.content && typeof data.content === "object") writeCachedContent(data.content);
    } catch (error) {
      console.warn("[home-content] Unable to load saved home content", error);
    }
  }

  window.applyHomeContent = applyHomeContent;
  window.loadHomeContent = loadHomeContent;
  window.prepareHomeContentTargets = prepareHomeContentTargets;

  function initHomeContent() {
    prepareHomeContentTargets();
    applyHomeContent(readCachedContent());
    setTimeout(loadHomeContent, 350);
    setTimeout(loadHomeContent, 900);
    setTimeout(loadHomeContent, 1600);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHomeContent, { once: true });
  } else {
    initHomeContent();
  }
  window.addEventListener("pageshow", () => {
    setTimeout(loadHomeContent, 80);
  });
  document.addEventListener("langchange", () => {
    setTimeout(loadHomeContent, 80);
    setTimeout(loadHomeContent, 550);
  });
})();
