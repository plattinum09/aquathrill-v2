/**
 * AQUATHRILL — i18n Dynamic Loader
 * Fetches locale JSON on demand, caches in memory, replaces [data-i18n] text
 * Loaded via defer — does NOT block rendering
 */
(function () {
    'use strict';

    // Translation cache: { 'en': { flat object }, 'ru': {...} }
    var cache = {};

    // Store original Thai text from HTML so we can restore without fetching th.json
    var originals = {};
    var originalsStored = false;

    // Auto-detect base path from script src
    var scripts = document.getElementsByTagName('script');
    var basePath = '';
    for (var i = 0; i < scripts.length; i++) {
        var src = scripts[i].getAttribute('src') || '';
        if (src.indexOf('i18n-loader') !== -1) {
            basePath = src.replace(/js\/i18n-loader\.js.*$/, '');
            break;
        }
    }

    /**
     * Flatten nested JSON: { nav: { home: "Home" } } → { "nav.home": "Home" }
     */
    function flatten(obj, prefix) {
        var result = {};
        for (var key in obj) {
            if (!obj.hasOwnProperty(key)) continue;
            var path = prefix ? prefix + '.' + key : key;
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                var nested = flatten(obj[key], path);
                for (var nk in nested) {
                    if (nested.hasOwnProperty(nk)) result[nk] = nested[nk];
                }
            } else {
                result[path] = obj[key];
            }
        }
        return result;
    }

    /**
     * Store original Thai content from HTML elements
     */
    function storeOriginals() {
        if (originalsStored) return;
        var els = document.querySelectorAll('[data-i18n]');
        for (var i = 0; i < els.length; i++) {
            var key = els[i].getAttribute('data-i18n');
            originals[key] = els[i].innerHTML;
        }
        // Also store placeholder and title originals
        var phEls = document.querySelectorAll('[data-i18n-placeholder]');
        for (var j = 0; j < phEls.length; j++) {
            var phKey = phEls[j].getAttribute('data-i18n-placeholder');
            originals['__ph__' + phKey] = phEls[j].getAttribute('placeholder') || '';
        }
        var titleEls = document.querySelectorAll('[data-i18n-title]');
        for (var k = 0; k < titleEls.length; k++) {
            var tKey = titleEls[k].getAttribute('data-i18n-title');
            originals['__tt__' + tKey] = titleEls[k].getAttribute('title') || '';
        }
        // Store original page title
        originals['__docTitle__'] = document.title;
        originalsStored = true;
    }

    /**
     * Apply translations to the DOM
     */
    function applyTranslations(translations) {
        // Text content
        var els = document.querySelectorAll('[data-i18n]');
        for (var i = 0; i < els.length; i++) {
            var key = els[i].getAttribute('data-i18n');
            if (translations[key] !== undefined) {
                els[i].innerHTML = translations[key];
            }
        }
        // Placeholders
        var phEls = document.querySelectorAll('[data-i18n-placeholder]');
        for (var j = 0; j < phEls.length; j++) {
            var phKey = phEls[j].getAttribute('data-i18n-placeholder');
            if (translations[phKey] !== undefined) {
                phEls[j].setAttribute('placeholder', translations[phKey]);
            }
        }
        // Title attributes
        var titleEls = document.querySelectorAll('[data-i18n-title]');
        for (var k = 0; k < titleEls.length; k++) {
            var tKey = titleEls[k].getAttribute('data-i18n-title');
            if (translations[tKey] !== undefined) {
                titleEls[k].setAttribute('title', translations[tKey]);
            }
        }
        // Page title
        if (translations['meta.title']) {
            document.title = translations['meta.title'];
        }
    }

    /**
     * Restore original Thai text (from stored originals, no fetch needed)
     */
    function restoreOriginals() {
        var els = document.querySelectorAll('[data-i18n]');
        for (var i = 0; i < els.length; i++) {
            var key = els[i].getAttribute('data-i18n');
            if (originals[key] !== undefined) {
                els[i].innerHTML = originals[key];
            }
        }
        var phEls = document.querySelectorAll('[data-i18n-placeholder]');
        for (var j = 0; j < phEls.length; j++) {
            var phKey = phEls[j].getAttribute('data-i18n-placeholder');
            if (originals['__ph__' + phKey] !== undefined) {
                phEls[j].setAttribute('placeholder', originals['__ph__' + phKey]);
            }
        }
        var titleEls = document.querySelectorAll('[data-i18n-title]');
        for (var k = 0; k < titleEls.length; k++) {
            var tKey = titleEls[k].getAttribute('data-i18n-title');
            if (originals['__tt__' + tKey] !== undefined) {
                titleEls[k].setAttribute('title', originals['__tt__' + tKey]);
            }
        }
        if (originals['__docTitle__']) {
            document.title = originals['__docTitle__'];
        }
    }

    /**
     * Fetch and apply a language
     */
    function loadLang(lang) {
        // Store Thai originals before first translation
        storeOriginals();

        // If Thai, just restore originals
        if (lang === I18n.defaultLang) {
            restoreOriginals();
            updateSwitcherUI(lang);
            document.dispatchEvent(new CustomEvent('langapplied', { detail: { lang: lang } }));
            return;
        }

        // If cached, apply immediately
        if (cache[lang]) {
            applyTranslations(cache[lang]);
            updateSwitcherUI(lang);
            document.dispatchEvent(new CustomEvent('langapplied', { detail: { lang: lang } }));
            return;
        }

        // Fetch JSON (with cache buster to ensure latest translations)
        var version = '20260516'; // Update this when locale files change
        var url = basePath + 'locales/' + lang + '.json?v=' + version;
        fetch(url)
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                cache[lang] = flatten(data, '');
                applyTranslations(cache[lang]);
                updateSwitcherUI(lang);
                document.dispatchEvent(new CustomEvent('langapplied', { detail: { lang: lang } }));
            })
            .catch(function (err) {
                console.warn('[i18n] Failed to load ' + lang + ':', err);
            });
    }

    /**
     * Update active state on language switcher dropdown
     */
    var langLabels = { th: 'TH', en: 'EN', ru: 'RU', zh: '中文' };
    var langFlags = { th: 'th', en: 'gb', ru: 'ru', zh: 'cn' };
    function updateSwitcherUI(lang) {
        // Update toggle label + flag
        var toggleLabel = document.getElementById('langCurrent');
        if (toggleLabel) toggleLabel.textContent = (langLabels[lang] || lang);
        var toggleFlag = document.getElementById('langFlag');
        if (toggleFlag) toggleFlag.src = 'https://flagcdn.com/w20/' + (langFlags[lang] || 'th') + '.png';
        // Update active option
        var btns = document.querySelectorAll('[data-lang]');
        for (var i = 0; i < btns.length; i++) {
            if (btns[i].getAttribute('data-lang') === lang) {
                btns[i].classList.add('lang-active');
            } else {
                btns[i].classList.remove('lang-active');
            }
        }
    }

    // Close dropdown on click outside
    document.addEventListener('click', function (e) {
        var menu = document.getElementById('langMenu');
        var toggle = document.getElementById('langToggle');
        if (menu && toggle && !toggle.contains(e.target) && !menu.contains(e.target)) {
            menu.classList.remove('open');
        }
    });

    /**
     * Public translate function
     */
    window.I18n.t = function (key) {
        var lang = I18n.getLang();
        if (lang === I18n.defaultLang) return originals[key] || key;
        if (cache[lang] && cache[lang][key] !== undefined) return cache[lang][key];
        return originals[key] || key;
    };

    /**
     * Translate dynamically injected content
     */
    window.I18n.translateNew = function () {
        var lang = I18n.getLang();
        if (lang === I18n.defaultLang) return;
        if (cache[lang]) applyTranslations(cache[lang]);
    };

    // Listen for language change events
    document.addEventListener('langchange', function (e) {
        loadLang(e.detail.lang);
    });

    // On DOM ready, apply if non-default language
    function init() {
        storeOriginals();
        var lang = I18n.getLang();
        updateSwitcherUI(lang);
        if (lang !== I18n.defaultLang) {
            loadLang(lang);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
