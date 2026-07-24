/**
 * Shared reviews data — used by both homepage and reviews page
 * Fetches from Google Places API first, falls back to static data.
 */

// Static fallback data
window.REVIEWS_STATIC = [
    {
        name: { th: 'Ratcharanon Beez', en: 'Ratcharanon Beez', ru: 'Ратчаранон Биз', zh: 'Ratcharanon Beez' },
        avatar: '',
        trip: 'Google Review',
        stars: 5,
        text: {
            th: '"สนุก สดชื่นมากครับ ทะเลสวยมาก น้ำใส เกาะไข่สวยมาก"',
            en: '"So fun and refreshing! Beautiful sea, clear water, Khai Islands are stunning!"',
            ru: '"Очень весело и освежающе! Красивое море, чистая вода, острова Кхай потрясающие!"',
            zh: '"太好玩太清爽了！大海很美，水很清，蛋岛太美了！"'
        },
        date: { th: '4 เดือนที่แล้ว', en: '4 months ago', ru: '4 месяца назад', zh: '4个月前' },
        initColor: 'linear-gradient(135deg,#34d399,#059669)',
        google: true
    },
    {
        name: { th: 'Parkermutsuba Sangjan', en: 'Parkermutsuba Sangjan', ru: 'Паркермутсуба Сангджан', zh: 'Parkermutsuba Sangjan' },
        avatar: '',
        trip: 'Google Review',
        stars: 5,
        text: {
            th: '"ถ้ามีโอกาสแนะนำให้มาลองเลยครับ มินิสปีดโบ๊ทสนุก สบาย สนุกมาก ทะเลสวย บรรยากาศดีมาก ดำน้ำดูปะการังสวย กิจกรรมเยอะ น่าสนใจ ใครมีโอกาสได้มาลองแล้วจะรู้ว่าดีจริง"',
            en: '"If you have a chance, I recommend trying this! The mini speedboat is fun and comfortable. Beautiful sea, great atmosphere, lovely coral snorkeling, lots of activities. You\'ll love it!"',
            ru: '"Если есть возможность — обязательно попробуйте! Мини-спидбот — весело и комфортно. Красивое море, отличная атмосфера, снорклинг с кораллами, много активностей!"',
            zh: '"有机会一定推荐来试试！迷你快艇好玩又舒服。海景美、气氛好、浮潜看珊瑚很美、活动多。来过就知道有多好！"'
        },
        date: { th: '2 เดือนที่แล้ว', en: '2 months ago', ru: '2 месяца назад', zh: '2个月前' },
        initColor: 'linear-gradient(135deg,#60a5fa,#2563eb)',
        google: true
    },
    {
        name: { th: 'มาลา มะม่วง', en: 'Mala Mamuang', ru: 'Мала Мамуанг', zh: '玛拉 芒果' },
        avatar: '',
        trip: 'Google Review',
        stars: 5,
        text: {
            th: '"สนุกมาก คุ้มค่ามากมายค่ะ ทริปสั้นสั้นแต่คุ้มค่า 1 วันจริงๆ น้ำใสมาก ประทับใจมาก"',
            en: '"So much fun and great value! A short trip but totally worth it. Crystal clear water, very impressed!"',
            ru: '"Очень весело и выгодно! Короткая поездка, но стоит каждой минуты. Кристально чистая вода, впечатляет!"',
            zh: '"太好玩了，超值！虽然行程不长但真的值得。水超清，印象深刻！"'
        },
        date: { th: '4 เดือนที่แล้ว', en: '4 months ago', ru: '4 месяца назад', zh: '4个月前' },
        initColor: 'linear-gradient(135deg,#f9a8d4,#ec4899)',
        google: true
    },
    {
        name: { th: 'Greena A', en: 'Greena A', ru: 'Грина А', zh: 'Greena A' },
        avatar: '',
        trip: 'Google Review — Local Guide',
        stars: 5,
        text: {
            th: '"บรรยากาศดีมากค่ะ บริการประทับใจ พนักงานใจดีดูแลดีตลอดทริป ทะเลสวยมาก น้ำใสเห็นปะการัง ขับเรือเองก็สนุกไม่ยากเลย กัปตันคอยดูแลตลอด อาหารบนเกาะก็อร่อย ประทับใจมากค่ะ แนะนำเลย!"',
            en: '"Great atmosphere and impressive service! Staff were so kind and attentive throughout the trip. The sea was beautiful with crystal clear water and visible coral. Driving the boat was fun and not difficult at all — the captain guided us the whole time. Food on the island was delicious too. Highly recommend!"',
            ru: '"Отличная атмосфера и впечатляющий сервис! Персонал добрый и внимательный. Море красивое, вода чистая, кораллы видны. Управлять лодкой весело и несложно — капитан помогал. Еда на острове тоже вкусная. Очень рекомендую!"',
            zh: '"氛围很好，服务很棒！工作人员很热心，全程照顾周到。海太美了，水清澈能看到珊瑚。自己开船很有趣也不难——船长一直在旁边指导。岛上的食物也很好吃。非常推荐！"'
        },
        date: { th: '6 เดือนที่แล้ว', en: '6 months ago', ru: '6 месяцев назад', zh: '6个月前' },
        initColor: 'linear-gradient(135deg,#fbbf24,#d97706)',
        google: true
    },
    {
        name: { th: 'สริจา จ่ามณาจ', en: 'Saricha Jamanaj', ru: 'Сарича Джаманадж', zh: '萨里查' },
        avatar: '',
        trip: 'Google Review',
        stars: 5,
        text: {
            th: '"สนุกมากค่ะ ทะเลสวยมากเลยค่ะ เป็นประสบการณ์ที่ดีมากเลยค่ะ แนะนำให้ลองมาค่ะ"',
            en: '"So much fun! The sea is gorgeous. Such a wonderful experience, highly recommend!"',
            ru: '"Очень весело! Море великолепное. Прекрасный опыт, очень рекомендую!"',
            zh: '"太好玩了！海太美了。非常棒的体验，推荐大家来试试！"'
        },
        date: { th: '4 เดือนที่แล้ว', en: '4 months ago', ru: '4 месяца назад', zh: '4个月前' },
        initColor: 'linear-gradient(135deg,#c084fc,#9333ea)',
        google: true
    },
    {
        name: { th: 'Shawn Wang', en: 'Shawn Wang', ru: 'Шон Ванг', zh: 'Shawn Wang' },
        avatar: '',
        trip: 'Google Review',
        stars: 5,
        text: {
            th: '"สุดยอดไปเลยครับ เรือมินิสปีดโบ๊ท เรือขับได้สนุกมากตัวเรือสะอาด สภาพเรือดี สะดวกสบาย กัปตันดูแลดี ทะเลสวยมาก เกาะสวยมาก อาหารอร่อย สมราคา ประทับใจมากครับ จะมาอีกแน่นอน"',
            en: '"Absolutely amazing! The mini speedboat was so fun to drive, clean and well-maintained. Captain took great care of us. Beautiful sea, stunning islands, delicious food, worth every baht. Very impressed, will definitely come back!"',
            ru: '"Абсолютно потрясающе! Мини-спидбот — невероятно весело, чистый и ухоженный. Капитан отлично заботился. Красивое море, великолепные острова, вкусная еда. Обязательно вернусь!"',
            zh: '"太棒了！迷你快艇开起来太好玩了，船很干净状态好。船长照顾得很好。海太美了，岛太漂亮了，食物好吃，物超所值。一定会再来！"'
        },
        date: { th: '2 เดือนที่แล้ว', en: '2 months ago', ru: '2 месяца назад', zh: '2个月前' },
        initColor: 'linear-gradient(135deg,#38bdf8,#0284c7)',
        google: true
    }
];

// Use static data initially
window.REVIEWS_DATA = window.REVIEWS_STATIC;

// Fetch from Google API and update
(function(){
    var GRADIENT_COLORS = [
        'linear-gradient(135deg,#34d399,#059669)',
        'linear-gradient(135deg,#60a5fa,#2563eb)',
        'linear-gradient(135deg,#f9a8d4,#ec4899)',
        'linear-gradient(135deg,#fbbf24,#d97706)',
        'linear-gradient(135deg,#c084fc,#9333ea)',
        'linear-gradient(135deg,#38bdf8,#0284c7)',
        'linear-gradient(135deg,#fb923c,#ea580c)',
        'linear-gradient(135deg,#a78bfa,#7c3aed)'
    ];

    fetch('/api/google-reviews.php')
        .then(function(res){ return res.json(); })
        .then(function(data){
            if (!data.success || !data.reviews || !data.reviews.length) return;

            var apiReviews = data.reviews.map(function(r, i){
                var text = '"' + r.text + '"';
                var isManual = r.source === 'manual';
                var photos = [];
                if (isManual && r.photo) photos.push(r.photo);
                return {
                    name: { th: r.author_name, en: r.author_name, ru: r.author_name, zh: r.author_name },
                    avatar: r.author_photo || '',
                    trip: isManual ? (r.trip || 'Customer Review') : 'Google Review',
                    stars: r.rating,
                    text: { th: text, en: text, ru: text, zh: text },
                    date: { th: r.relative_time || r.created_at || '', en: r.relative_time || r.created_at || '', ru: r.relative_time || r.created_at || '', zh: r.relative_time || r.created_at || '' },
                    initColor: GRADIENT_COLORS[i % GRADIENT_COLORS.length],
                    google: !isManual,
                    photos: photos
                };
            });

            window.REVIEWS_DATA = apiReviews;
            window.REVIEWS_RATING = data.rating || null;
            window.REVIEWS_TOTAL = data.total_reviews || null;
            document.dispatchEvent(new Event('reviewsUpdated'));
        })
        .catch(function(){
            // API failed — keep static data, no action needed
        });
})();
