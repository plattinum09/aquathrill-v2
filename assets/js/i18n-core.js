/**
 * AQUATHRILL — i18n Core Controller
 * Lightweight language state manager (~1.5KB)
 * Loaded via defer — does NOT block rendering
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'aqua-lang';
    var SUPPORTED = ['th', 'en', 'ru', 'zh'];
    var DEFAULT_LANG = 'th';

    // Check for ?lang= URL parameter first (used by admin iframe — does NOT save to localStorage)
    var urlLang = null;
    try {
        var urlParams = new URLSearchParams(window.location.search);
        var paramVal = urlParams.get('lang');
        if (paramVal && SUPPORTED.indexOf(paramVal) !== -1) urlLang = paramVal;
    } catch (e) { /* ignore */ }

    // Determine initial language: URL param > localStorage > default
    var saved = null;
    if (!urlLang) {
        try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) { /* private browsing */ }
    }
    var currentLang = urlLang || (saved && SUPPORTED.indexOf(saved) !== -1 ? saved : DEFAULT_LANG);

    // Set <html lang=""> immediately
    document.documentElement.lang = currentLang;

    // Public API
    window.I18n = {
        /** Get current language code */
        getLang: function () { return currentLang; },

        /** Get supported language list */
        getSupported: function () { return SUPPORTED.slice(); },

        /** Switch language (public site only — saves to localStorage then reloads) */
        setLang: function (code) {
            if (SUPPORTED.indexOf(code) === -1) return;
            try { localStorage.setItem(STORAGE_KEY, code); } catch (e) { /* ignore */ }
            // Navigate with ?lang= so language is detected correctly on reload,
            // even before localStorage is read (and works across all browsers).
            try {
                var url = new URL(window.location.href);
                url.searchParams.set('lang', code);
                window.location.href = url.toString();
            } catch (e) {
                window.location.reload();
            }
        },


        /** Check if current language is the default (Thai) */
        isDefault: function () { return currentLang === DEFAULT_LANG; },

        /** Default language code */
        defaultLang: DEFAULT_LANG
    };
})();
