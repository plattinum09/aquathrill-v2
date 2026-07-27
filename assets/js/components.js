/**
 * AQUATHRILL — Shared Header & Footer Components
 * แก้ไขไฟล์นี้ไฟล์เดียว มีผลทุกหน้า
 */

(function () {
    // Auto-detect path prefix using the script tag's own src attribute
    const currentScript = document.currentScript;
    const src = currentScript ? currentScript.getAttribute('src') : '';

    // Count how many ../ are in the src path to determine depth
    const matches = src.match(/\.\.\//g);
    const depth = matches ? matches.length : 0;
    const prefix = '../'.repeat(depth);
    const rootPrefix = '/';
    const assetPrefix = '/';

    // ==================== HEADER ====================
    function loadHeader() {
        const headerEl = document.getElementById('site-header');
        if (!headerEl) return;

        headerEl.innerHTML = `
    <nav>
        <div class="container">
            <a href="${rootPrefix}" class="logo"><img src="${assetPrefix}images/logo-topbar.png" alt="AQUATHRILL" style="height:45px;"></a>
            <ul class="nav-links">
                <li><a href="${rootPrefix}" data-i18n="nav.home">หน้าแรก</a></li>
                <li><a href="/services" data-i18n="nav.services">บริการ</a></li>
                <li><a href="/promotions" data-i18n="nav.promotions">โปรโมชั่น</a></li>
                <li><a href="/reviews" data-i18n="nav.reviews">รีวิว</a></li>
                <li><a href="/contact" data-i18n="nav.contact">ติดต่อเรา</a></li>
                <li><a href="/booking" class="btn btn-primary" data-i18n="nav.book">จองเลย</a></li>
            </ul>
            <div class="lang-dropdown">
                <button class="lang-toggle" id="langToggle" onclick="document.getElementById('langMenu').classList.toggle('open')">
                    <img id="langFlag" src="https://flagcdn.com/w20/th.png" alt="" class="lang-flag">
                    <span id="langCurrent">TH</span>
                    <i class="fas fa-chevron-down"></i>
                </button>
                <ul class="lang-menu" id="langMenu">
                    <li><button data-lang="th" class="lang-opt lang-active" onclick="I18n.setLang('th');document.getElementById('langMenu').classList.remove('open')"><img src="https://flagcdn.com/w20/th.png" alt="" class="lang-flag"> ไทย</button></li>
                    <li><button data-lang="en" class="lang-opt" onclick="I18n.setLang('en');document.getElementById('langMenu').classList.remove('open')"><img src="https://flagcdn.com/w20/gb.png" alt="" class="lang-flag"> English</button></li>
                    <li><button data-lang="ru" class="lang-opt" onclick="I18n.setLang('ru');document.getElementById('langMenu').classList.remove('open')"><img src="https://flagcdn.com/w20/ru.png" alt="" class="lang-flag"> Русский</button></li>
                    <li><button data-lang="zh" class="lang-opt" onclick="I18n.setLang('zh');document.getElementById('langMenu').classList.remove('open')"><img src="https://flagcdn.com/w20/cn.png" alt="" class="lang-flag"> 中文</button></li>
                </ul>
            </div>
            <div class="menu-toggle"><i class="fas fa-bars"></i></div>
        </div>
    </nav>`;
    }

    // ==================== FOOTER ====================
    function loadFooter() {
        const footerEl = document.getElementById('site-footer');
        if (!footerEl) return;

        footerEl.innerHTML = `
    <style>
    @media (max-width: 768px) {
        .footer-grid { text-align: left !important; }
        .footer-col-brand,
        .footer-grid > div { align-items: stretch !important; }
        .footer-logo { width: fit-content !important; margin: 0 auto 12px !important; }
        .social-links { justify-content: center !important; }
    }
    </style>
    <footer>
        <div class="container">
            <div class="footer-grid">
                <div class="footer-col-brand">
                    <a href="${rootPrefix}" class="footer-logo"><img src="${assetPrefix}images/logo-footer.png" alt="AQUATHRILL"></a>
                    <p class="footer-desc" data-i18n="footer.desc">บริการ Mini Speedboat self-drive<br>(with captain)</p>
                    <div class="footer-trust-mini">
                        <span><i class="fas fa-shield-halved"></i> T.A.T. 33/11987</span>
                        <span><i class="fas fa-credit-card"></i> Secure Payment</span>
                    </div>
                    <div class="footer-actions">
                        <a href="/booking" class="footer-action primary"><i class="fas fa-calendar-check"></i> จองเลย</a>
                        <a href="https://wa.me/66958192778" target="_blank" class="footer-action whatsapp"><i class="fab fa-whatsapp"></i> WhatsApp</a>
                    </div>
                    <div class="social-links">
                        <a href="https://www.facebook.com/share/1MVoNcx4K6/?mibextid=wwXIfr" target="_blank" title="Facebook"><i class="fab fa-facebook-f"></i></a>
                        <a href="https://www.instagram.com/aquathrill.phuket" target="_blank" title="Instagram"><i class="fab fa-instagram"></i></a>
                        <a href="https://www.tiktok.com/@aquarthrill.phuket" target="_blank" title="TikTok"><i class="fab fa-tiktok"></i></a>
                        <a href="https://line.me/ti/p/YkBSvPn76j" target="_blank" title="LINE"><i class="fab fa-line"></i></a>
                        <a href="https://wa.me/66958192778" target="_blank" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>
                    </div>
                </div>
                <div class="footer-links">
                    <h4 data-i18n="footer.quick_links">ลิงก์ด่วน</h4>
                    <ul>
                        <li><a href="/services" data-i18n="footer.our_services">บริการของเรา</a></li>
                        <li><a href="/promotions" data-i18n="nav.promotions">โปรโมชั่น</a></li>
                        <li><a href="/reviews" data-i18n="footer.reviews_link">รีวิวจากลูกค้า</a></li>
                        <li><a href="/contact" data-i18n="footer.contact_us">ติดต่อเรา</a></li>
                    </ul>
                </div>
                <div class="footer-links">
                    <h4 data-i18n="footer.contact_us">ติดต่อเรา</h4>
                    <ul>
                        <li><a href="https://wa.me/66958192778" target="_blank" style="color:inherit;text-decoration:none;"><i class="fab fa-whatsapp"></i> +66958192778</a></li>
                        <li><a href="https://www.instagram.com/aquathrill.phuket" target="_blank" style="color:inherit;text-decoration:none;"><i class="fab fa-instagram"></i> @aquathrill.phuket</a></li>
                        <li><a href="mailto:aquathrill70@gmail.com" style="color:inherit;text-decoration:none;"><i class="fas fa-envelope"></i> aquathrill70@gmail.com</a></li>
                        <li><a href="https://maps.app.goo.gl/2LK3wsQ9fyx83Kt66?g_st=ic" target="_blank" style="color:inherit;text-decoration:none;"><i class="fas fa-map-marker-alt"></i> <span data-i18n="footer.location">ภูเก็ต</span></a></li>
                    </ul>
                </div>
                <div class="footer-newsletter">
                    <h4 data-i18n="footer.newsletter_title">รับข่าวสารและโปรโมชั่น</h4>
                    <p data-i18n="footer.newsletter_desc">สมัครรับข้อเสนอพิเศษก่อนใคร</p>
                    <div class="newsletter-form">
                        <input type="email" data-i18n-placeholder="footer.newsletter_placeholder" placeholder="อีเมลของคุณ">
                        <button data-i18n="footer.newsletter_btn">สมัคร</button>
                    </div>
                </div>
            </div>
            <div class="footer-bottom">
                <p>T.A.T. Licence: 33/11987 | 70/3 No.1, Ratsada, Mueang Phuket 83000</p>
                <p style="margin-top:8px;"><span data-i18n="footer.copyright">&copy; 2026 AQUATHRILL. สงวนลิขสิทธิ์</span> | <a href="/terms" style="color:rgba(255,255,255,0.6);" data-i18n="footer.terms">เงื่อนไขการให้บริการ</a> | <a href="/privacy-policy" style="color:rgba(255,255,255,0.6);" data-i18n="footer.privacy">นโยบายความเป็นส่วนตัว</a> | <a href="/refund-policy" style="color:rgba(255,255,255,0.6);" data-i18n="footer.refund">นโยบายคืนเงิน</a></p>
            </div>
        </div>
    </footer>`;
    }

    // Load immediately (this script runs before main.js)
    loadHeader();
    loadFooter();

    // Update the flag/label in the header to show current language
    (function() {
        var lang = (window.I18n && window.I18n.getLang) ? window.I18n.getLang() : 'th';
        var flagMap = { th: 'th', en: 'gb', ru: 'ru', zh: 'cn' };
        var labelMap = { th: 'TH', en: 'EN', ru: 'RU', zh: 'ZH' };
        var flagEl = document.getElementById('langFlag');
        var labelEl = document.getElementById('langCurrent');
        if (flagEl) flagEl.src = 'https://flagcdn.com/w20/' + (flagMap[lang] || 'th') + '.png';
        if (labelEl) labelEl.textContent = labelMap[lang] || 'TH';
        // Mark active button
        document.querySelectorAll('.lang-opt').forEach(function(btn) {
            btn.classList.toggle('lang-active', btn.dataset.lang === lang);
        });
    })();
})();
