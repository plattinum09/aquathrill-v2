(function () {
  const defaults = [
    { id: 'maya-bay', names: { th: 'อ่าวมาหยา', en: 'Maya Bay', ru: 'Бухта Майя', zh: '玛雅湾' }, summary: { th: 'อ่าวชื่อดังของหมู่เกาะพีพี โอบล้อมด้วยหน้าผาหินปูนและน้ำทะเลสีฟ้าใส', en: 'A celebrated Phi Phi cove framed by limestone cliffs and clear blue water.' }, description: { th: 'อ่าวมาหยาบนเกาะพีพีเลเป็นหนึ่งในสถานที่ท่องเที่ยวที่มีชื่อเสียงที่สุดในทะเลอันดามัน ชายหาดสีขาวและหน้าผาหินปูนทำให้ทิวทัศน์สวยงามตลอดทั้งปี', en: 'Maya Bay on Phi Phi Leh is one of the Andaman Sea’s most recognizable destinations. Its white sand and limestone cliffs create a remarkable coastal landscape.' }, highlights: { th: ['ชมทิวทัศน์อ่าวและหน้าผาหินปูน', 'เดินเล่นและถ่ายภาพบนชายหาด', 'ปฏิบัติตามกฎการอนุรักษ์ของอุทยาน'], en: ['See the bay and limestone cliffs', 'Walk and photograph the beach', 'Follow the national park conservation rules'] }, images: ['/images/เกาะไข่นอก.webp', '/images/activity-beach.webp', '/images/section-trip-overview.webp'] },
    { id: 'pileh-lagoon', names: { th: 'ปิเละลากูน', en: 'Pileh Lagoon', ru: 'Лагуна Пиле', zh: '皮莱泻湖' }, summary: { th: 'ลากูนสีมรกตกลางหน้าผาหินปูนของเกาะพีพีเล', en: 'Emerald water surrounded by towering cliffs on Phi Phi Leh.' }, description: { th: 'ปิเละลากูนเป็นเวิ้งน้ำที่ซ่อนอยู่ท่ามกลางหน้าผาสูงบนเกาะพีพีเล เหมาะกับการชมวิวและถ่ายภาพจากเรือ', en: 'Pileh Lagoon is a sheltered inlet on Phi Phi Leh, known for its emerald water and dramatic limestone walls.' }, highlights: { th: ['ชมสีน้ำทะเลในลากูน', 'ถ่ายภาพหน้าผาหินปูน', 'เพลิดเพลินกับวิวจากเรือ'], en: ['Admire the lagoon’s emerald water', 'Photograph the limestone cliffs', 'Enjoy the views from the boat'] }, images: ['/images/section-trip-overview.webp', '/images/เกาะไข่นอก.webp', '/images/activity-beach.webp'] },
    { id: 'viking-cave', names: { th: 'ถ้ำไวกิ้ง', en: 'Viking Cave', ru: 'Пещера викингов', zh: '维京洞穴' }, summary: { th: 'จุดชมถ้ำและหน้าผาริมทะเลที่มีเรื่องราวทางประวัติศาสตร์', en: 'A coastal cave and cliffside landmark with a distinctive history.' }, description: { th: 'ถ้ำไวกิ้งเป็นสถานที่สำคัญบนเกาะพีพีเล นักท่องเที่ยวสามารถชมปากถ้ำและหน้าผาจากเรือได้', en: 'Viking Cave is a landmark on Phi Phi Leh. Visitors can view its entrance and coastal cliffs from the boat.' }, highlights: { th: ['ชมปากถ้ำจากเรือ', 'เรียนรู้เรื่องราวของสถานที่', 'ถ่ายภาพแนวหน้าผา'], en: ['View the cave entrance from the boat', 'Learn about the site', 'Photograph the dramatic coast'] }, images: ['/images/เกาะลีเป๊ะ.webp', '/images/section-trip-overview.webp', '/images/เกาะไข่นอก.webp'] },
    { id: 'monkey-bay', names: { th: 'อ่าวลิง', en: 'Monkey Bay', ru: 'Бухта обезьян', zh: '猴子湾' }, summary: { th: 'อ่าวธรรมชาติที่มีลิงอาศัยอยู่ตามแนวชายฝั่ง', en: 'A natural bay where monkeys may be seen along the shore.' }, description: { th: 'อ่าวลิงเป็นจุดแวะชมธรรมชาติบริเวณหมู่เกาะพีพี ควรชมสัตว์ป่าจากระยะปลอดภัยและไม่ให้อาหาร', en: 'Monkey Bay is a scenic stop in the Phi Phi Islands. Watch wildlife from a safe distance and do not feed the animals.' }, highlights: { th: ['ชมธรรมชาติริมชายฝั่ง', 'สังเกตสัตว์ป่าจากระยะปลอดภัย', 'ถ่ายภาพวิวทะเล'], en: ['Explore the natural shoreline', 'Observe wildlife from a safe distance', 'Photograph the sea views'] }, images: ['/images/activity-beach.webp', '/images/เกาะไข่นอก.webp', '/images/section-trip-overview.webp'] }
  ];
  const labels = {
    th: { title: 'สถานที่ท่องเที่ยว', intro: 'สำรวจจุดแวะชมในทริป One Day Trip', more: 'ดูรายละเอียด', back: 'กลับไปดูสถานที่', highlights: 'ไฮไลต์ของสถานที่', book: 'จองเลย', empty: 'ยังไม่มีสถานที่ท่องเที่ยว' },
    en: { title: 'Places to Visit', intro: 'Explore the stops on our One Day Trip', more: 'View details', back: 'Back to places', highlights: 'Highlights', book: 'Book now', empty: 'No destinations available' },
    ru: { title: 'Достопримечательности', intro: 'Откройте для себя остановки однодневного тура', more: 'Подробнее', back: 'Все места', highlights: 'Главное', book: 'Забронировать', empty: 'Места пока не добавлены' },
    zh: { title: '旅游景点', intro: '探索一日游的精彩站点', more: '查看详情', back: '返回景点', highlights: '景点亮点', book: '立即预订', empty: '暂无景点' }
  };
  const lang = window.I18n?.getLang?.() || 'th';
  const text = labels[lang] || labels.th;
  const pick = (value) => typeof value === 'string' ? value : value?.[lang] || value?.en || value?.th || '';
  const safeImage = (url) => typeof url === 'string' && (/^\/images\//.test(url) || /^https:\/\//.test(url)) ? url : '/images/activity-beach.webp';
  const node = (tag, cls, content) => { const el = document.createElement(tag); if (cls) el.className = cls; if (content) el.textContent = content; return el; };
  async function load() {
    const target = document.getElementById('trip-content');
    if (!target) return;
    let items = defaults;
    try {
      const response = await fetch('/api/page-content.php?page=one-day-trip', { cache: 'no-store' });
      if (response.ok) { const data = await response.json(); if (Array.isArray(data.content?.destinations)) items = data.content.destinations; }
    } catch (_) {}
    const detailId = new URLSearchParams(location.search).get('place');
    const chosen = detailId && items.find(item => item.id === detailId);
    if (detailId && chosen) renderDetail(target, chosen);
    else renderList(target, items);
  }
  function renderList(target, items) {
    document.title = 'One Day Trip | AQUATHRILL';
    const intro = node('div', 'trip-intro');
    intro.append(node('p', 'trip-kicker', 'AQUATHRILL · ONE DAY TRIP'), node('h1', '', text.title), node('p', 'trip-lead', text.intro));
    target.append(intro);
    const grid = node('div', 'trip-grid');
    if (!items.length) grid.append(node('p', 'trip-empty', text.empty));
    items.forEach(item => {
      const card = node('article', 'trip-card');
      const img = node('img'); img.src = safeImage(item.images?.[0]); img.alt = pick(item.names); img.loading = 'lazy';
      const body = node('div', 'trip-card-body');
      body.append(node('h2', '', pick(item.names)), node('p', '', pick(item.summary)));
      const link = node('a', 'trip-more', text.more); link.href = '/one-day-trip/details?place=' + encodeURIComponent(item.id); link.setAttribute('aria-label', text.more + ': ' + pick(item.names));
      body.append(link); card.append(img, body); grid.append(card);
    });
    target.append(grid);
  }
  function renderDetail(target, item) {
    document.title = pick(item.names) + ' | One Day Trip | AQUATHRILL';
    const back = node('a', 'trip-back', '← ' + text.back); back.href = '/one-day-trip'; target.append(back);
    const title = node('h1', 'trip-detail-title', pick(item.names)); target.append(title);
    const gallery = node('div', 'trip-gallery');
    (item.images || []).forEach((url, index) => { const img = node('img'); img.src = safeImage(url); img.alt = pick(item.names) + ' ' + (index + 1); img.loading = index ? 'lazy' : 'eager'; gallery.append(img); });
    target.append(gallery);
    const article = node('article', 'trip-article');
    article.append(node('h2', '', pick(item.names)), node('p', '', pick(item.description)));
    const highlights = item.highlights?.[lang] || item.highlights?.en || item.highlights?.th || [];
    if (highlights.length) { article.append(node('h3', '', text.highlights)); const list = node('ul'); highlights.forEach(value => list.append(node('li', '', value))); article.append(list); }
    const book = node('a', 'trip-book', text.book); book.href = '/booking'; article.append(book); target.append(article);
  }
  window.OneDayTripDefaults = defaults;
  load();
})();
