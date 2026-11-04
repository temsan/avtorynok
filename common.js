/* Общие константы и утилиты для сайта и админки */
(function () {
  'use strict';

  // Репозиторий определяется по адресу Pages (owner.github.io/repo); иначе — значения по умолчанию.
  const FALLBACK = { owner: 'temsan', repo: 'avtorynok' };
  function detectRepo() {
    const h = location.hostname;
    if (h.endsWith('.github.io')) {
      const owner = h.split('.')[0];
      const seg = location.pathname.split('/').filter(Boolean)[0];
      return { owner, repo: seg && !seg.includes('.') ? seg : `${owner}.github.io` };
    }
    return FALLBACK;
  }
  const REPO = detectRepo();

  const ENUMS = {
    transmission: ['Автомат', 'Механика', 'Робот', 'Вариатор'],
    fuel: ['Бензин', 'Дизель', 'Гибрид', 'Электро', 'Газ/бензин'],
    body: ['Седан', 'Хэтчбек', 'Универсал', 'Кроссовер', 'Внедорожник', 'Лифтбек', 'Минивэн', 'Купе', 'Пикап'],
    drive: ['Передний', 'Задний', 'Полный'],
    status: { active: 'В продаже', sold: 'Продано', hidden: 'Скрыто' },
  };
  const BRANDS = ['Audi', 'BMW', 'Changan', 'Chery', 'Chevrolet', 'Exeed', 'Ford', 'Geely', 'Haval', 'Honda', 'Hyundai', 'Infiniti', 'Kia', 'Land Rover', 'Lada', 'Lexus', 'Mazda', 'Mercedes-Benz', 'Mitsubishi', 'Nissan', 'Opel', 'Porsche', 'Renault', 'Skoda', 'Subaru', 'Suzuki', 'Tank', 'Toyota', 'UAZ', 'Volkswagen', 'Volvo'];
  const CITIES = ['Москва', 'Санкт-Петербург', 'Екатеринбург', 'Казань', 'Новосибирск', 'Нижний Новгород', 'Краснодар', 'Ростов-на-Дону', 'Самара', 'Уфа', 'Челябинск', 'Пермь', 'Воронеж', 'Тюмень', 'Владивосток'];

  // Поля характеристик в порядке показа: [ключ, подпись, форматтер]
  const SPECS = [
    ['year', 'Год выпуска'],
    ['mileage', 'Пробег', v => fmtNum(v) + ' км'],
    ['body', 'Кузов'],
    ['color', 'Цвет'],
    ['engine', 'Двигатель', (v, l) => [v ? String(v).replace('.', ',') + ' л' : '', l.power ? l.power + ' л.с.' : '', l.fuel].filter(Boolean).join(' / ')],
    ['transmission', 'Коробка'],
    ['drive', 'Привод'],
    ['wheel', 'Руль'],
    ['owners', 'Владельцев по ПТС'],
    ['condition', 'Состояние'],
    ['vin', 'VIN'],
    ['city', 'Город'],
  ];

  const fmtNum = n => (Number(n) || 0).toLocaleString('ru-RU');
  const fmtPrice = n => fmtNum(n) + ' ₽';
  const fmtDate = s => {
    const d = new Date(s);
    return isNaN(d) ? '' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
  };
  const title = l => `${l.brand} ${l.model}`.trim();

  // Только http(s) и относительные ссылки — защита от javascript: в данных
  const safeUrl = u => {
    u = String(u || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    if (/^[\w\-./]+$/.test(u) && !u.startsWith('//')) return u;
    return '';
  };

  // Контакт: телефон → tel:, @ник → Telegram
  function contactLink(c) {
    c = String(c || '').trim();
    const tg = c.match(/^@([A-Za-z0-9_]{4,32})$/) || c.match(/t\.me\/([A-Za-z0-9_]{4,32})/);
    if (tg) return { href: 'https://t.me/' + tg[1], text: '@' + tg[1] };
    const digits = c.replace(/[^\d+]/g, '');
    if (digits.replace('+', '').length >= 10) return { href: 'tel:' + digits, text: c };
    return { href: '', text: c };
  }

  function carPlaceholder(seed) {
    const hues = [18, 205, 140, 260, 340, 45];
    const h = hues[Math.abs([...String(seed)].reduce((a, c) => a + c.charCodeAt(0), 0)) % hues.length];
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 260'><rect width='400' height='260' fill='hsl(${h} 30% 88%)'/><path d='M70 170l28-52c6-11 14-16 27-16h130c13 0 22 5 30 14l39 44 26 6c8 2 13 8 13 16v18H70z' fill='hsl(${h} 45% 45%)'/><path d='M120 112h55v40h-74zM190 112h60l32 40h-92z' fill='hsl(${h} 30% 88%)' opacity='.8'/><circle cx='125' cy='192' r='24' fill='%23222'/><circle cx='295' cy='192' r='24' fill='%23222'/><circle cx='125' cy='192' r='9' fill='%23bbb'/><circle cx='295' cy='192' r='9' fill='%23bbb'/></svg>`;
    return 'data:image/svg+xml,' + svg.replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E');
  }

  // UTF-8 ↔ base64 для GitHub Contents API
  const b64encode = str => {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  const b64decode = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };

  // Видно ли обсуждение у объявления: глобальный выключатель И флаг объявления
  const commentsOn = (db, l) => db.settings?.comments !== false && l.comments !== false;

  async function loadPublicDb() {
    const r = await fetch('data/db.json?t=' + Math.floor(Date.now() / 60000), { cache: 'no-cache' });
    if (!r.ok) throw new Error('Не удалось загрузить объявления');
    return r.json();
  }

  window.AR = { REPO, ENUMS, BRANDS, CITIES, SPECS, fmtNum, fmtPrice, fmtDate, esc, plural, title, safeUrl, contactLink, carPlaceholder, b64encode, b64decode, store, commentsOn, loadPublicDb };
})();
