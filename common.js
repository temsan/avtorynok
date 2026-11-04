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

  /* ---------- Обзор 360° ----------
     Покадровое вращение: серия снимков по кругу (и, если есть, на нескольких высотах).
     spin = { dir, cols, rows = 1, row = 0, ext = 'jpg' } → кадры `${dir}/${ряд}-${кадр:02}.jpg`
       или { frames: [[url, …], …] } — ряды снизу вверх. */
  function spinFrames(s) {
    if (s.frames) return s.frames;
    return Array.from({ length: s.rows || 1 }, (_, r) =>
      Array.from({ length: s.cols }, (_, c) => `${s.dir}/${r}-${String(c).padStart(2, '0')}.${s.ext || 'jpg'}`));
  }
  const hasSpin = l => !!(l?.spin && (l.spin.frames?.[0]?.length || (l.spin.dir && l.spin.cols)));

  function mountSpin(root, s, { intro = true } = {}) {
    const frames = spinFrames(s), rows = frames.length, cols = frames[0].length;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let bgSet = false, row = Math.min(s.row || 0, rows - 1), pos = 0, vel = 0, raf = 0, auto = false, touched = false, alive = true, drag = null;
    root.classList.add('spin');
    root.tabIndex = 0;
    root.style.touchAction = rows > 1 ? 'none' : 'pan-y';
    root.setAttribute('role', 'img');
    root.setAttribute('aria-label', 'Обзор 360°. Тяните или нажимайте стрелки, чтобы повернуть');
    const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
    root.innerHTML = `<canvas></canvas>
      <div class="spin__load"><i></i><span>0%</span></div>
      <div class="spin__hint">${svg('M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4')}${rows > 1 ? 'Тяните в стороны и вверх-вниз' : 'Тяните, чтобы повернуть'}</div>
      <div class="spin__ctl">
        <button type="button" data-s="play" aria-label="Автовращение" aria-pressed="false">${svg('M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5')}</button>
        <button type="button" data-s="fs" aria-label="На весь экран">${svg('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5')}</button>
      </div>
      ${rows > 1 ? `<div class="spin__rows" aria-hidden="true">${frames.map((_, r) => `<i data-r="${r}"></i>`).reverse().join('')}</div>` : ''}
      <span class="spin__badge">360°</span>`;
    const cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
    const btnPlay = root.querySelector('[data-s=play]'), load = root.querySelector('.spin__load');

    // Загрузка: сначала текущий ряд «через кадр» (быстро получается грубый оборот), потом остальное
    const imgs = frames.map(r => r.map(() => null));
    const rank = c => (c % 4 === 0 ? 0 : c % 2 === 0 ? 1 : 2);
    const rowQueue = r => frames[r].map((_, c) => [r, c]).sort((a, b) => rank(a[1]) - rank(b[1]));
    let queue = [...rowQueue(row), ...frames.flatMap((_, r) => (r === row ? [] : rowQueue(r)))];
    let firstLeft = cols, inflight = 0;
    const loadNext = () => {
      if (!alive) return;
      const it = queue.shift(); if (!it) return;
      const [r, c] = it; inflight++;
      const im = new Image(); im.decoding = 'async';
      const done = ok => {
        inflight--;
        if (ok) imgs[r][c] = im;
        if (r === (s.row || 0) && --firstLeft >= 0) {
          const p = Math.round((1 - firstLeft / cols) * 100);
          load.querySelector('i').style.setProperty('--p', p);
          load.querySelector('span').textContent = p + '%';
          if (!firstLeft) { load.hidden = true; root.classList.add('ready'); if (intro && !touched && !reduce) play(true, 1); }
        }
        if (r === row) draw();
        loadNext();
      };
      im.onload = () => done(true); im.onerror = () => done(false);
      im.src = frames[r][c];
    };
    for (let i = 0; i < 6; i++) loadNext();

    const idx = () => ((Math.round(pos) % cols) + cols) % cols;
    const nearest = (r, c) => {
      for (let d = 0; d <= cols / 2; d++) { const a = imgs[r][(c + d) % cols] || imgs[r][(c - d + cols) % cols]; if (a) return a; }
      return null;
    };
    function draw() {
      if (!root.isConnected) return destroy();
      const c = idx();
      const im = nearest(row, c) || nearest(Math.min(s.row || 0, rows - 1), c);
      if (!im || !cv.width) return;
      if (!bgSet) { // фон блока = цвет угла кадра, чтобы поля вокруг кадра были незаметны
        bgSet = true;
        try { const t = document.createElement('canvas').getContext('2d'); t.drawImage(im, 0, 0, 1, 1, 0, 0, 1, 1); const [r, g, b] = t.getImageData(0, 0, 1, 1).data; root.style.background = `rgb(${r},${g},${b})`; root.classList.toggle('spin--dark', r * .3 + g * .59 + b * .11 < 120); } catch { /* чужой домен */ }
      }
      const k = Math.min(cv.width / im.naturalWidth, cv.height / im.naturalHeight);
      const w = im.naturalWidth * k, h = im.naturalHeight * k;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(im, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
    }
    const resize = () => {
      const b = root.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(b.width * d); cv.height = Math.round(b.height * d); draw();
    };
    const ro = new ResizeObserver(resize); ro.observe(root);

    const setRow = r => {
      r = Math.max(0, Math.min(rows - 1, r)); if (r === row) return;
      row = r;
      queue = [...queue.filter(q => q[0] === r), ...queue.filter(q => q[0] !== r)]; // нужный ряд — вперёд
      root.querySelectorAll('.spin__rows i').forEach(i => i.classList.toggle('on', +i.dataset.r === row));
      draw();
    };
    root.querySelectorAll('.spin__rows i').forEach(i => i.classList.toggle('on', +i.dataset.r === row));
    const hideHint = () => root.classList.add('used');

    function play(on, turns = Infinity) {
      cancelAnimationFrame(raf); auto = on; btnPlay.setAttribute('aria-pressed', on);
      if (!on) return;
      let last = performance.now(), left = turns * cols;
      const tick = now => {
        if (!auto || !alive) return;
        const d = (now - last) * cols / 7000; last = now; // оборот за 7 секунд
        pos += d; left -= d; draw();
        if (left <= 0) { play(false); return; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    function coast() {
      let last = performance.now();
      const tick = now => {
        const dt = now - last; last = now;
        pos += vel * dt; vel *= Math.pow(0.993, dt); draw();
        if (Math.abs(vel) > 0.002 && alive) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    root.addEventListener('pointerdown', e => {
      if (e.button > 0 || e.target.closest('button')) return;
      play(false); cancelAnimationFrame(raf); touched = true; hideHint();
      drag = { x: e.clientX, y: e.clientY, t: performance.now(), dy: 0 }; vel = 0;
      try { root.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      root.classList.add('grab');
    });
    root.addEventListener('pointermove', e => {
      if (!drag) return;
      const ppf = Math.max(2, root.clientWidth * 0.9 / cols); // ширина блока ≈ один оборот
      const now = performance.now(), dt = Math.max(1, now - drag.t), df = (e.clientX - drag.x) / ppf;
      pos -= df; vel = 0.7 * vel + 0.3 * (-df / dt);
      drag.x = e.clientX; drag.t = now;
      if (rows > 1) {
        drag.dy += e.clientY - drag.y; drag.y = e.clientY;
        while (drag.dy > 42) { setRow(row + 1); drag.dy -= 42; }
        while (drag.dy < -42) { setRow(row - 1); drag.dy += 42; }
      }
      draw();
    });
    const up = e => {
      if (!drag) return;
      if (e.type === 'pointercancel' || performance.now() - drag.t > 90) vel = 0;
      drag = null; root.classList.remove('grab');
      if (Math.abs(vel) > 0.004) coast();
    };
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
    root.addEventListener('keydown', e => {
      const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
      if (k && (k[0] || rows > 1)) { e.preventDefault(); play(false); hideHint(); pos += k[0]; setRow(row + k[1]); draw(); }
      if (e.key === 'Escape' && root.classList.contains('spin--full')) toggleFull();
    });
    btnPlay.addEventListener('click', () => { touched = true; hideHint(); play(!auto); });
    function toggleFull() {
      if (document.fullscreenElement === root) return document.exitFullscreen();
      if (root.classList.contains('spin--full')) { root.classList.remove('spin--full'); document.documentElement.classList.remove('spin-lock'); return; }
      const fallback = () => { root.classList.add('spin--full'); document.documentElement.classList.add('spin-lock'); root.focus(); };
      if (root.requestFullscreen) root.requestFullscreen().catch(fallback); else fallback();
    }
    root.querySelector('[data-s=fs]').addEventListener('click', toggleFull);

    function destroy() {
      if (!alive) return;
      alive = false; auto = false; cancelAnimationFrame(raf); ro.disconnect();
      document.documentElement.classList.remove('spin-lock');
    }
    return { destroy };
  }

  window.AR = { REPO, ENUMS, BRANDS, CITIES, SPECS, fmtNum, fmtPrice, fmtDate, esc, plural, title, safeUrl, contactLink, carPlaceholder, b64encode, b64decode, store, commentsOn, loadPublicDb, spinFrames, hasSpin, mountSpin };
})();
