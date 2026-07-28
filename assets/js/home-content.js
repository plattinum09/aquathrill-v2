(function () {
  const API = "/api";
  const TEXT_SELECTOR = "[data-home-content]";

  function getLang() {
    if (window.I18n && typeof window.I18n.getLang === "function") return window.I18n.getLang();
    const params = new URLSearchParams(window.location.search);
    return params.get("lang") || localStorage.getItem("preferred_lang") || "th";
  }

  function pageKey() {
    const lang = getLang();
    return lang === "th" ? "home" : "home_" + lang;
  }

  function getValue(content, key) {
    return key.split(".").reduce((acc, part) => (acc && acc[part] != null ? acc[part] : undefined), content);
  }

  function applyHomeContent(content) {
    if (!content || typeof content !== "object") return;
    document.querySelectorAll(TEXT_SELECTOR).forEach((el) => {
      const key = el.getAttribute("data-home-content");
      const value = getValue(content, key);
      if (value == null || value === "") return;
      el.innerHTML = String(value);
    });
  }

  async function loadHomeContent() {
    try {
      const response = await fetch(`${API}/page-content.php?page=${encodeURIComponent(pageKey())}`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = await response.json();
      applyHomeContent(data.content);
    } catch (error) {
      console.warn("[home-content] Unable to load saved home content", error);
    }
  }

  window.applyHomeContent = applyHomeContent;
  window.loadHomeContent = loadHomeContent;

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(loadHomeContent, 350);
  });
  document.addEventListener("langchange", () => {
    setTimeout(loadHomeContent, 80);
  });
})();
