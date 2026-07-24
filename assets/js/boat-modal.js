/**
 * Shared Boat Detail Modal Component
 * Used by: services/index.html, index.html, promotions/index.html
 *
 * Usage:
 *   1. Include boat-modal.css and this file in your page
 *   2. Add data-boat="12ft" or data-boat="14ft" to any clickable card
 *   3. Call BoatModal.init() after DOM is ready
 *   4. The modal HTML is auto-injected
 *
 * Data is fetched from /api/boat-types-v2.php
 */
(function(){
    // Determine base path (are we in a subfolder?)
    var scripts = document.getElementsByTagName('script');
    var src = scripts[scripts.length - 1].src;
    var basePath = '';
    if(src.indexOf('/assets/') !== -1){
        var loc = window.location.pathname;
        if(loc.indexOf('/services/') !== -1 || loc.indexOf('/promotions/') !== -1 || loc.indexOf('/booking/') !== -1 || loc.indexOf('/contact/') !== -1 || loc.indexOf('/reviews/') !== -1 || loc.indexOf('/gallery/') !== -1 || loc.indexOf('/agent/') !== -1 || loc.indexOf('/service/') !== -1){
            basePath = '../';
        } else {
            basePath = '';
        }
    }
    // Fallback: detect from page location
    var imgBase = (window.location.pathname.split('/').filter(Boolean).length > 1 && window.location.pathname.indexOf('/index.html') === -1) || document.querySelector('link[href*="../assets"]') ? '../' : '';
    // Final fallback: check if ../images exists via a test
    if(document.querySelector('img[src^="../images/"]')) imgBase = '../';
    else if(document.querySelector('img[src^="images/"]')) imgBase = '';

    // Determine if we are in a subfolder for resolving absolute API image paths
    var inSubfolder = (imgBase === '../');

    /**
     * Resolve an image path from the API.
     * API may return absolute paths like "/images/12-feet.webp" or relative paths.
     * For pages in subfolders, absolute paths need "../" prepended (since they are
     * relative to the site root, and subfolder pages are one level deep).
     */
    function resolveImagePath(path) {
        if (!path) return '';
        // If it starts with http:// or https://, leave as-is
        if (path.indexOf('http://') === 0 || path.indexOf('https://') === 0) return path;
        // If it starts with "/" (absolute from site root)
        if (path.charAt(0) === '/') {
            // Strip the leading slash and prepend imgBase
            // e.g. "/images/12-feet.webp" -> "images/12-feet.webp" or "../images/12-feet.webp"
            return imgBase + path.substring(1);
        }
        // Already a relative path like "images/foo.webp"
        return imgBase + path;
    }

    // --- Boat data: fetched from API ---
    var boatData = {};
    var dataReady = false;
    var pendingOpen = null; // If user clicks before data loads, queue it

    function buildFallbackLang(bt) {
        return {
            title: bt.name || '',
            subtitle: '',
            description: bt.description || '',
            desc: bt.description || '',
            specs: [],
            features: [],
            price: bt.price ? ('฿' + Number(bt.price).toLocaleString()) : '',
            priceUnit: '',
            specsLabel: 'Specs',
            featLabel: 'Features',
            bookLabel: 'Book'
        };
    }

    function normalizeLangData(langObj, fallback) {
        if (!langObj) return fallback;
        var out = {};
        out.title = langObj.title || fallback.title;
        out.subtitle = langObj.subtitle || fallback.subtitle || '';
        out.desc = langObj.description || langObj.desc || fallback.desc || '';
        out.specs = langObj.specs || fallback.specs || [];
        out.features = langObj.features || fallback.features || [];
        out.price = langObj.price || fallback.price || '';
        out.priceUnit = langObj.priceUnit || fallback.priceUnit || '';
        out.specsLabel = langObj.specsLabel || fallback.specsLabel || 'Specs';
        out.featLabel = langObj.featLabel || fallback.featLabel || 'Features';
        out.bookLabel = langObj.bookLabel || fallback.bookLabel || 'Book';
        return out;
    }

    function processApiResponse(data) {
        var boats = data.boat_types || data.boatTypes || data || [];
        if (!Array.isArray(boats)) boats = [];

        boats.forEach(function(bt) {
            var i18n = bt.i18n || {};
            var rawImages = (bt.images && bt.images.length) ? bt.images : [bt.image || ''];
            var resolvedImages = rawImages.map(function(img) { return resolveImagePath(img); });

            var fallback = buildFallbackLang(bt);
            var thData = normalizeLangData(i18n.th, fallback);

            boatData[bt.id] = {
                images: resolvedImages,
                bookUrl: '/booking/',
                th: thData,
                en: normalizeLangData(i18n.en, thData),
                ru: normalizeLangData(i18n.ru, thData),
                zh: normalizeLangData(i18n.zh, thData)
            };
        });

        dataReady = true;

        // If a user clicked before data was ready, open now
        if (pendingOpen) {
            var key = pendingOpen;
            pendingOpen = null;
            openBoatModal(key);
        }
    }

    // Fetch boat data from API
    (function fetchBoatData() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/api/boat-types-v2.php?_t=' + Date.now(), true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        processApiResponse(data);
                    } catch(e) {
                        console.error('BoatModal: Failed to parse API response', e);
                    }
                } else {
                    console.error('BoatModal: API request failed with status ' + xhr.status);
                }
            }
        };
        xhr.send();
    })();

    function getLang(){ return (window.I18n && window.I18n.getLang) ? window.I18n.getLang() : 'th'; }
    function pick(item){ var lang = getLang(); return item[lang] || item['th']; }

    // Inject modal HTML if not already present
    if(!document.getElementById('boatOverlay')){
        var modalHTML = '<div class="boat-overlay" id="boatOverlay">'
            +'<div class="boat-modal">'
            +'<button class="boat-close" id="boatClose"><i class="fas fa-times"></i></button>'
            +'<div class="boat-carousel" id="boatCarousel">'
            +'<div class="boat-carousel-track" id="boatTrack"></div>'
            +'<button class="boat-carousel-btn prev" id="boatPrev"><i class="fas fa-chevron-left"></i></button>'
            +'<button class="boat-carousel-btn next" id="boatNext"><i class="fas fa-chevron-right"></i></button>'
            +'<div class="boat-hero-badge"><div class="badge-icon"><i class="fas fa-ship"></i></div><div class="badge-name"><h3 id="boatModalTitle"></h3><p id="boatModalSubtitle"></p></div></div>'
            +'<div class="boat-carousel-dots" id="boatDots"></div>'
            +'</div>'
            +'<div class="boat-body">'
            +'<div class="boat-loading" id="boatLoading" style="display:none;text-align:center;padding:40px 20px;color:rgba(255,255,255,0.6);font-size:0.9rem;"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem;color:#00d4ff;display:block;margin-bottom:12px;"></i>Loading...</div>'
            +'<div id="boatContent">'
            +'<p class="boat-desc" id="boatModalDesc"></p>'
            +'<div class="boat-section-title"><i class="fas fa-cog"></i> <span id="boatSpecsLabel">สเปค</span></div>'
            +'<div class="boat-specs" id="boatModalSpecs"></div>'
            +'<div class="boat-section-title"><i class="fas fa-star"></i> <span id="boatFeatLabel">จุดเด่น</span></div>'
            +'<div class="boat-features" id="boatModalFeats"></div>'
            +'<div class="boat-price-row"><div class="price" id="boatModalPrice"></div><a class="btn-book-modal" id="boatModalBook" href="#"><i class="fas fa-calendar-check"></i> <span id="boatBookLabel">จองเลย</span></a></div>'
            +'</div></div></div></div>';
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Inject CSS if not already present
    if(!document.getElementById('boat-modal-css')){
        var css = document.createElement('style');
        css.id = 'boat-modal-css';
        css.textContent = '.boat-overlay{position:fixed;inset:0;z-index:9999;background:rgba(0,10,30,0.75);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .35s ease;}'
            +'.boat-overlay.active{opacity:1;pointer-events:auto;}'
            +'.boat-modal{background:linear-gradient(145deg,rgba(15,25,50,0.97),rgba(8,14,35,0.98));border:1px solid rgba(0,212,255,0.15);border-radius:20px;width:92%;max-width:600px;max-height:92vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.6),0 0 40px rgba(0,212,255,0.08);transform:translateY(30px) scale(0.95);transition:transform .35s cubic-bezier(.4,0,.2,1);position:relative;}'
            +'.boat-overlay.active .boat-modal{transform:translateY(0) scale(1);}'
            +'.boat-modal::-webkit-scrollbar{width:4px;}.boat-modal::-webkit-scrollbar-thumb{background:rgba(0,212,255,0.3);border-radius:4px;}'
            +'.boat-close{position:sticky;top:14px;float:right;margin-right:14px;z-index:10;background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.15);color:#fff;width:36px;height:36px;border-radius:50%;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;}'
            +'.boat-close:hover{background:rgba(255,80,80,0.25);border-color:rgba(255,80,80,0.4);transform:rotate(90deg);}'
            +'.boat-carousel{position:relative;width:100%;height:220px;overflow:hidden;border-radius:20px 20px 0 0;}'
            +'.boat-carousel-track{display:flex;height:100%;transition:transform .4s cubic-bezier(.4,0,.2,1);}'
            +'.boat-carousel-track img{min-width:100%;width:100%;height:100%;object-fit:cover;flex-shrink:0;}'
            +'.boat-carousel::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(8,14,35,0.85) 0%,rgba(8,14,35,0.2) 40%,transparent 100%);pointer-events:none;}'
            +'.boat-carousel-btn{position:absolute;top:50%;transform:translateY(-50%);z-index:5;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.15);color:#fff;width:34px;height:34px;border-radius:50%;font-size:0.85rem;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);transition:all .2s;}'
            +'.boat-carousel-btn:hover{background:rgba(0,212,255,0.3);border-color:rgba(0,212,255,0.5);}'
            +'.boat-carousel-btn.prev{left:10px;}.boat-carousel-btn.next{right:10px;}'
            +'.boat-carousel-dots{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);z-index:5;display:flex;gap:6px;}'
            +'.boat-carousel-dots span{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.35);cursor:pointer;transition:all .25s;}'
            +'.boat-carousel-dots span.active{background:#00d4ff;width:20px;border-radius:4px;}'
            +'.boat-hero-badge{position:absolute;bottom:16px;left:20px;z-index:6;display:flex;align-items:center;gap:10px;}'
            +'.boat-hero-badge .badge-icon{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#00d4ff,#0099cc);display:flex;align-items:center;justify-content:center;font-size:1.2rem;color:#fff;box-shadow:0 4px 15px rgba(0,212,255,0.3);}'
            +'.boat-hero-badge .badge-name h3{font-size:1.15rem;margin:0;font-weight:600;color:#fff;}'
            +'.boat-hero-badge .badge-name p{font-size:0.75rem;margin:0;opacity:0.6;color:#fff;}'
            +'.boat-body{padding:18px 20px 22px;}'
            +'.boat-desc{color:rgba(255,255,255,0.75);font-size:0.88rem;line-height:1.7;margin-bottom:16px;}'
            +'.boat-specs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;}'
            +'.boat-spec{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:12px 8px;text-align:center;transition:all .25s;}'
            +'.boat-spec:hover{background:rgba(0,212,255,0.08);border-color:rgba(0,212,255,0.2);transform:translateY(-2px);}'
            +'.boat-spec i{font-size:1.2rem;margin-bottom:5px;display:block;color:#00d4ff;}'
            +'.boat-spec .spec-val{font-size:1rem;font-weight:700;color:#fff;display:block;line-height:1.3;}'
            +'.boat-spec .spec-label{font-size:0.7rem;color:rgba(255,255,255,0.5);display:block;margin-top:2px;}'
            +'.boat-section-title{display:flex;align-items:center;gap:8px;color:#fff;font-size:0.85rem;font-weight:600;margin-bottom:10px;}'
            +'.boat-section-title i{color:#00d4ff;font-size:1rem;}'
            +'.boat-features{display:flex;flex-direction:column;gap:8px;margin-bottom:16px;}'
            +'.boat-feat{display:flex;align-items:center;gap:14px;background:rgba(255,255,255,0.03);border-radius:12px;padding:12px 18px;border:1px solid rgba(255,255,255,0.05);transition:all .2s;}'
            +'.boat-feat:hover{background:rgba(0,212,255,0.05);border-color:rgba(0,212,255,0.15);}'
            +'.boat-feat i{font-size:1.1rem;color:#00d4ff;width:24px;text-align:center;flex-shrink:0;}'
            +'.boat-feat span{font-size:0.85rem;color:rgba(255,255,255,0.85);font-weight:500;}'
            +'.boat-price-row{display:flex;align-items:center;justify-content:space-between;margin-top:16px;padding:14px 16px;background:linear-gradient(135deg,rgba(0,212,255,0.08),rgba(0,150,255,0.05));border:1px solid rgba(0,212,255,0.15);border-radius:14px;}'
            +'.boat-price-row .price{font-size:1.3rem;font-weight:700;color:#00d4ff;}'
            +'.boat-price-row .price small{font-size:0.75rem;font-weight:400;opacity:0.7;color:#fff;}'
            +'.boat-price-row .btn-book-modal{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#00d4ff,#0099cc);color:#fff;border:none;padding:10px 22px;border-radius:50px;font-size:0.85rem;font-weight:600;cursor:pointer;text-decoration:none;transition:all .25s;box-shadow:0 4px 15px rgba(0,212,255,0.3);}'
            +'.boat-price-row .btn-book-modal:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,212,255,0.4);}'
            +'@media(max-width:480px){.boat-modal{width:96%;max-height:95vh;border-radius:16px;}.boat-carousel{height:180px;border-radius:16px 16px 0 0;}.boat-specs{grid-template-columns:repeat(3,1fr);gap:6px;}.boat-price-row{flex-direction:row;gap:10px;justify-content:space-between;}.boat-price-row .btn-book-modal{padding:8px 16px;font-size:0.8rem;}}';
        document.head.appendChild(css);
    }

    var overlay = document.getElementById('boatOverlay');
    var track = document.getElementById('boatTrack');
    var dots = document.getElementById('boatDots');
    var boatLoading = document.getElementById('boatLoading');
    var boatContent = document.getElementById('boatContent');
    var currentSlide = 0;
    var totalSlides = 0;
    var autoTimer = null;
    var currentBoatKey = null;

    function goToSlide(i){
        currentSlide = ((i % totalSlides) + totalSlides) % totalSlides;
        track.style.transform = 'translateX(-' + (currentSlide * 100) + '%)';
        var allDots = dots.querySelectorAll('span');
        allDots.forEach(function(d,idx){ d.classList.toggle('active', idx === currentSlide); });
    }

    function startAuto(){ stopAuto(); if(totalSlides > 1) autoTimer = setInterval(function(){ goToSlide(currentSlide + 1); }, 3500); }
    function stopAuto(){ if(autoTimer){ clearInterval(autoTimer); autoTimer = null; } }

    document.getElementById('boatPrev').addEventListener('click', function(e){ e.stopPropagation(); goToSlide(currentSlide - 1); startAuto(); });
    document.getElementById('boatNext').addEventListener('click', function(e){ e.stopPropagation(); goToSlide(currentSlide + 1); startAuto(); });

    function showLoading() {
        boatLoading.style.display = 'block';
        boatContent.style.display = 'none';
        track.innerHTML = '';
        dots.innerHTML = '';
        document.getElementById('boatModalTitle').textContent = '';
        document.getElementById('boatModalSubtitle').textContent = '';
        document.getElementById('boatPrev').style.display = 'none';
        document.getElementById('boatNext').style.display = 'none';
    }

    function hideLoading() {
        boatLoading.style.display = 'none';
        boatContent.style.display = '';
    }

    function renderBoat(key){
        var item = boatData[key];
        if(!item) {
            hideLoading();
            document.getElementById('boatModalTitle').textContent = key.toUpperCase();
            document.getElementById('boatModalDesc').textContent = 'กำลังโหลดข้อมูล... กรุณาปิดแล้วเปิดใหม่';
            return;
        }
        var d = pick(item);
        currentBoatKey = key;
        hideLoading();
        totalSlides = item.images.length;
        track.innerHTML = item.images.map(function(src){ return '<img src="'+src+'" alt="'+d.title+'">'; }).join('');
        dots.innerHTML = item.images.map(function(_,i){ return '<span'+(i===0?' class="active"':'')+' data-i="'+i+'"></span>'; }).join('');
        dots.querySelectorAll('span').forEach(function(dot){ dot.addEventListener('click', function(e){ e.stopPropagation(); goToSlide(parseInt(this.dataset.i)); startAuto(); }); });
        currentSlide = 0;
        track.style.transform = 'translateX(0)';
        document.getElementById('boatPrev').style.display = totalSlides > 1 ? '' : 'none';
        document.getElementById('boatNext').style.display = totalSlides > 1 ? '' : 'none';
        document.getElementById('boatModalTitle').textContent = d.title;
        document.getElementById('boatModalSubtitle').textContent = d.subtitle;
        document.getElementById('boatModalDesc').textContent = d.desc;
        document.getElementById('boatSpecsLabel').textContent = d.specsLabel;
        document.getElementById('boatFeatLabel').textContent = d.featLabel;
        document.getElementById('boatBookLabel').textContent = d.bookLabel;
        var specHtml = '';
        d.specs.forEach(function(s){ specHtml += '<div class="boat-spec"><i class="'+(s.icon||'fas fa-info')+'"></i><span class="spec-val">'+(s.val||s.value||'')+'</span><span class="spec-label">'+(s.label||'')+'</span></div>'; });
        document.getElementById('boatModalSpecs').innerHTML = specHtml;
        var featHtml = '';
        d.features.forEach(function(f){
            if (typeof f === 'string') {
                featHtml += '<div class="boat-feat"><i class="fas fa-check"></i><span>'+f+'</span></div>';
            } else {
                var icon = f.icon || 'fas fa-check';
                var text = f.text || '';
                featHtml += '<div class="boat-feat"><i class="'+icon+'"></i><span>'+text+'</span></div>';
            }
        });
        document.getElementById('boatModalFeats').innerHTML = featHtml;
        var priceText = d.price;
        var lang = getLang();
        if (priceText) {
            var sfx = lang === 'th' ? 'บาท' : 'THB';
            if (priceText.indexOf(sfx) === -1) priceText += ' ' + sfx;
        }
        document.getElementById('boatModalPrice').innerHTML = priceText + ' <small>' + d.priceUnit + '</small>';
        document.getElementById('boatModalBook').href = item.bookUrl;
    }

    function openBoatModal(key) {
        if (!dataReady) {
            // Data not loaded yet: show modal with loading state, queue render
            pendingOpen = key;
            currentBoatKey = key;
            showLoading();
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
            return;
        }
        renderBoat(key);
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        startAuto();
    }

    function closeBoatModal(){
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        stopAuto();
        pendingOpen = null;
    }

    document.getElementById('boatClose').addEventListener('click', closeBoatModal);
    overlay.addEventListener('click', function(e){ if(e.target === overlay) closeBoatModal(); });

    // Bind click events to all [data-boat] cards
    function bindBoatCards(){
        document.querySelectorAll('[data-boat]').forEach(function(card){
            if(card._boatBound) return;
            card._boatBound = true;
            card.addEventListener('click', function(){
                openBoatModal(this.dataset.boat);
            });
        });
    }

    // Bind immediately
    bindBoatCards();

    // Re-bind after dynamic content loads (e.g. homepage JS)
    var observer = new MutationObserver(function(){ bindBoatCards(); });
    observer.observe(document.body, {childList: true, subtree: true});

    // Re-render on language change
    document.addEventListener('langchange', function(){
        if(currentBoatKey && overlay.classList.contains('active')) renderBoat(currentBoatKey);
    });

    // Expose globally
    window.BoatModal = { open: function(key){ openBoatModal(key); } };
})();
