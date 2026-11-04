/* Публичная часть: каталог, страница автомобиля, сравнение, избранное, подача объявления */
(function () {
  'use strict';
  const { REPO, ENUMS, BRANDS, CITIES, SPECS, fmtNum, fmtPrice, fmtDate, esc, plural, title, safeUrl, contactLink, carPlaceholder, store, commentsOn, loadPublicDb } = window.AR;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- Иконки ---------- */
  const IC = {
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    km: '<path d="M4 18a9 9 0 1 1 16 0"/><path d="M12 14l4-5"/>',
    eng: '<path d="M4 10h3l2-3h6v3h3l2 2v5h-2v2h-4l-2-2H9v-2H6l-2-2z"/>',
    box: '<circle cx="6" cy="6" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="12" cy="18" r="2"/><path d="M6 8v8M12 8v8M18 8v4H6"/>',
    drive: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6M4.5 16.5l5-3M19.5 16.5l-5-3"/>',
    fuel: '<path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M3 21h13M15 9h2a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V9l-3-3"/><path d="M7 7h5v4H7z"/>',
    pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    cmp: '<path d="M7 4v16M17 4v16M3 8h8M13 16h8"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
    phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    tg: '<path d="M21 4L3 11l6 2 2 6 3-4 5 4z"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    photo: '<rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l2-3h4l2 3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    body: '<path d="M3 16l2-5 4-1 4-4h6l2 5v5z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  };
  const icon = (k, cls = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" class="${cls}">${IC[k]}</svg>`;

  // Силуэты кузовов (вид сбоку)
  const BODY_SVG = {
    'Седан': 'M3 19L5 14L15 13L23 7L40 7L48 13L60 14L61 19Z',
    'Хэтчбек': 'M3 19L5 13L14 12L22 6L44 6L52 12L56 14L56 19Z',
    'Универсал': 'M3 19L5 13L15 12L22 6L57 6L60 12L61 19Z',
    'Кроссовер': 'M3 19L4 13L14 11L21 5L52 5L58 11L61 13L61 19Z',
    'Внедорожник': 'M3 19L3 12L14 11L18 4L56 4L58 11L61 12L61 19Z',
    'Лифтбек': 'M3 19L5 14L15 13L24 7L38 7L58 13L61 14L61 19Z',
    'Минивэн': 'M3 19L3 13L10 11L20 4L58 4L61 9L61 19Z',
    'Купе': 'M3 19L5 14L18 12L27 7L38 7L52 13L61 15L61 19Z',
    'Пикап': 'M3 19L3 12L14 11L20 5L36 5L37 11L61 11L61 19Z',
  };
  const bodySvg = b => `<svg viewBox="0 0 64 26" aria-hidden="true"><path d="${BODY_SVG[b] || BODY_SVG['Седан']}"/><circle cx="15" cy="19" r="4" fill="var(--surface)"/><circle cx="49" cy="19" r="4" fill="var(--surface)"/></svg>`;

  /* ---------- Кредит ---------- */
  const CREDIT = { down: 0.2, months: 60, rate: 0.199 };
  const monthly = (price, down = CREDIT.down, months = CREDIT.months, rate = CREDIT.rate) => {
    const P = price * (1 - down), r = rate / 12;
    return P <= 0 ? 0 : Math.round(r ? (P * r) / (1 - Math.pow(1 + r, -months)) : P / months);
  };
  const creditNote = `Оценка: взнос ${CREDIT.down * 100}%, ${CREDIT.months} мес., ставка ${String(CREDIT.rate * 100).replace('.', ',')}%`;

  /* ---------- Состояние ---------- */
  let db = { settings: {}, listings: [] };
  let all = [];
  const favs = new Set(store.get('ar:favs', []));
  let cmp = store.get('ar:cmp', []);
  let recent = store.get('ar:recent', []);
  const F = { q: '', brand: '', model: '', pmin: '', pmax: '', ymin: '', ymax: '', km: '', city: '', sold: false, body: new Set(), trans: new Set(), fuel: new Set(), drive: new Set() };
  let preview = null;
  let catalogScroll = 0;

  const isNew = l => Date.now() - new Date(l.created) < 3 * 864e5;
  const photosOf = l => { const p = (l.photos || []).map(safeUrl).filter(Boolean); return p.length ? p : [carPlaceholder(l.id || 'x')]; };
  const byId = id => all.find(l => l.id === id);
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 3000); }

  /* ---------- Загрузка ---------- */
  $('#grid').innerHTML = Array.from({ length: 6 }, () => '<div class="skeleton"></div>').join('');
  loadPublicDb().then(data => {
    db = data;
    all = db.listings.filter(l => l.status !== 'hidden');
    setupCatalog();
    render();
    route();
  }).catch(e => { $('#grid').innerHTML = `<p class="empty">${esc(e.message)}</p>`; });

  /* ---------- Каталог ---------- */
  function setupCatalog() {
    const act = all.filter(l => l.status === 'active');
    const count = (arr, k) => arr.reduce((m, l) => m.set(l[k], (m.get(l[k]) || 0) + 1), new Map());
    const brands = [...count(act, 'brand')].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const opts = list => list.map(v => `<option>${esc(v)}</option>`).join('');
    const brandNames = brands.map(b => b[0]).sort();
    $('#f-brand').insertAdjacentHTML('beforeend', opts(brandNames));
    $('#h-brand').insertAdjacentHTML('beforeend', opts(brandNames));
    $('#f-city').insertAdjacentHTML('beforeend', opts([...new Set(all.map(l => l.city))].sort()));

    // кузова
    const bodies = count(act, 'body');
    $('#bodies').innerHTML = ENUMS.body.filter(b => bodies.has(b)).map(b =>
      `<button type="button" class="body-btn" data-body="${esc(b)}" aria-pressed="false">${bodySvg(b)}${esc(b)}<small>${bodies.get(b)}</small></button>`).join('');
    $('#bodies').addEventListener('click', e => {
      const b = e.target.closest('[data-body]'); if (!b) return;
      toggleSet(F.body, b.dataset.body); render();
    });
    // марки
    $('#brands').innerHTML = brands.map(([b, n]) => `<button type="button" class="brand-chip" data-brand="${esc(b)}" aria-pressed="false">${esc(b)}<small>${n}</small></button>`).join('');
    $('#brands').addEventListener('click', e => {
      const b = e.target.closest('[data-brand]'); if (!b) return;
      setBrand(F.brand === b.dataset.brand ? '' : b.dataset.brand); render();
    });

    const chips = (el, items, set) => {
      el.innerHTML = items.map(v => `<button type="button" class="chip" aria-pressed="false" data-v="${esc(v)}">${esc(v)}</button>`).join('');
      el.addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) { toggleSet(set, b.dataset.v); render(); } });
    };
    chips($('#f-trans'), ENUMS.transmission, F.trans);
    chips($('#f-fuel'), ENUMS.fuel, F.fuel);
    chips($('#f-drive'), ENUMS.drive, F.drive);

    const bind = (sel, key) => $(sel).addEventListener('input', e => { F[key] = e.target.value; render(); });
    [['#f-pmin', 'pmin'], ['#f-pmax', 'pmax'], ['#h-pmax', 'pmax'], ['#f-ymin', 'ymin'], ['#f-ymax', 'ymax'], ['#f-km', 'km'], ['#f-city', 'city'], ['#q', 'q'], ['#f-model', 'model'], ['#h-model', 'model']].forEach(a => bind(...a));
    $('#f-brand').addEventListener('input', e => { setBrand(e.target.value); render(); });
    $('#h-brand').addEventListener('input', e => { setBrand(e.target.value); render(); });
    $('#f-sold').addEventListener('change', e => { F.sold = e.target.checked; render(); });
    $('#sort').addEventListener('change', render);
    $('#finder').addEventListener('submit', e => { e.preventDefault(); $('#bodies').scrollIntoView({ behavior: 'smooth' }); });
    $('#resetFilters').addEventListener('click', resetFilters);
    document.addEventListener('click', e => { if (e.target.closest('[data-reset]')) resetFilters(); });
    $('#filtersToggle').addEventListener('click', () => $('#filters').classList.add('open'));
    $('#filtersApply').addEventListener('click', () => { $('#filters').classList.remove('open'); $('#results').scrollIntoView(); });
    $('#activeFilters').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { removeFilter(b.dataset.rm, b.dataset.v); render(); } });

    const prices = act.map(l => l.price);
    $('#stats').innerHTML = prices.length ? `
      <div><b>${act.length}</b><span>${plural(act.length, 'автомобиль', 'автомобиля', 'автомобилей')} в продаже</span></div>
      <div><b>${brands.length}</b><span>${plural(brands.length, 'марка', 'марки', 'марок')}</span></div>
      <div><b>0 ₽</b><span>комиссия площадки</span></div>` : '';

    setupFeature(act);
    renderRecent();
  }

  function setupFeature(act) {
    const picks = act.filter(l => (l.photos || []).length > 1).sort((a, b) => b.price - a.price).slice(0, 4);
    const el = $('#feature');
    if (!picks.length) { el.hidden = true; return; }
    el.innerHTML = picks.map((l, i) => `<img src="${esc(photosOf(l)[0])}" alt="${esc(title(l))}" class="${i ? '' : 'on'}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}>`).join('') +
      `<div class="hero__dots">${picks.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div><div class="hero__cap"></div>`;
    let i = 0;
    const show = n => {
      i = n % picks.length;
      const l = picks[i];
      $$('img', el).forEach((im, j) => im.classList.toggle('on', j === i));
      $$('.hero__dots i', el).forEach((d, j) => { d.classList.remove('on'); if (j === i) { void d.offsetWidth; d.classList.add('on'); } });
      $('.hero__cap', el).innerHTML = `<div><small>Предложение недели</small><b>${esc(title(l))}, ${l.year}</b></div><span class="price-tag">${fmtPrice(l.price)}</span>`;
      el.href = `#/car/${encodeURIComponent(l.id)}`;
    };
    show(0);
    if (picks.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) setInterval(() => { if (!document.hidden && !$('#view-catalog').hidden) show(i + 1); }, 5000);
  }

  function toggleSet(set, v) { set.has(v) ? set.delete(v) : set.add(v); }
  function setBrand(b) {
    F.brand = b; F.model = '';
    const models = [...new Set(all.filter(l => l.brand === b).map(l => l.model))].sort();
    for (const sel of ['#f-model', '#h-model']) {
      $(sel).innerHTML = `<option value="">${sel === '#h-model' ? 'Все модели' : 'Любая'}</option>` + models.map(m => `<option>${esc(m)}</option>`).join('');
      $(sel).disabled = !b;
    }
  }
  function resetFilters() {
    Object.assign(F, { q: '', brand: '', model: '', pmin: '', pmax: '', ymin: '', ymax: '', km: '', city: '', sold: false });
    ['body', 'trans', 'fuel', 'drive'].forEach(k => F[k].clear());
    setBrand('');
    render();
  }
  const FILTER_LABELS = { pmin: v => `от ${fmtNum(v)} ₽`, pmax: v => `до ${fmtNum(v)} ₽`, ymin: v => `от ${v} г.`, ymax: v => `до ${v} г.`, km: v => `до ${fmtNum(v)} км` };
  function removeFilter(k, v) {
    if (F[k] instanceof Set) F[k].delete(v);
    else if (k === 'brand') setBrand('');
    else if (k === 'sold') F.sold = false;
    else F[k] = '';
  }

  // Синхронизация всех контролов с состоянием F
  function syncControls() {
    const set = (sel, v) => { const el = $(sel); if (el && document.activeElement !== el) el.value = v; };
    set('#f-brand', F.brand); set('#h-brand', F.brand); set('#f-model', F.model); set('#h-model', F.model);
    ['pmin', 'pmax', 'ymin', 'ymax', 'km', 'city'].forEach(k => set('#f-' + k, F[k]));
    set('#h-pmax', F.pmax); set('#q', F.q);
    $('#f-sold').checked = F.sold;
    $$('#bodies [data-body]').forEach(b => b.setAttribute('aria-pressed', F.body.has(b.dataset.body)));
    $$('#brands [data-brand]').forEach(b => b.setAttribute('aria-pressed', F.brand === b.dataset.brand));
    $$('#f-trans .chip').forEach(b => b.setAttribute('aria-pressed', F.trans.has(b.dataset.v)));
    $$('#f-fuel .chip').forEach(b => b.setAttribute('aria-pressed', F.fuel.has(b.dataset.v)));
    $$('#f-drive .chip').forEach(b => b.setAttribute('aria-pressed', F.drive.has(b.dataset.v)));
    const pills = [];
    if (F.brand) pills.push(['brand', F.brand, F.brand]);
    if (F.model) pills.push(['model', F.model, F.model]);
    for (const k of ['body', 'trans', 'fuel', 'drive']) F[k].forEach(v => pills.push([k, v, v]));
    for (const k of Object.keys(FILTER_LABELS)) if (F[k] !== '') pills.push([k, '', FILTER_LABELS[k](F[k])]);
    if (F.city) pills.push(['city', '', F.city]);
    if (F.q) pills.push(['q', '', `«${F.q}»`]);
    if (F.sold) pills.push(['sold', '', 'с проданными']);
    $('#activeFilters').innerHTML = pills.map(([k, v, t]) => `<button type="button" class="af" data-rm="${k}" data-v="${esc(v)}" aria-label="Убрать фильтр ${esc(t)}">${esc(t)}</button>`).join('');
    $('#fCount').hidden = !pills.length; $('#fCount').textContent = pills.length;
  }

  function matches(l) {
    const n = v => (v === '' ? null : Number(v));
    if (!F.sold && l.status === 'sold') return false;
    if (F.q) {
      const hay = `${l.brand} ${l.model} ${l.city} ${l.year} ${l.color || ''} ${l.body}`.toLowerCase();
      if (!F.q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w))) return false;
    }
    if (F.brand && l.brand !== F.brand) return false;
    if (F.model && l.model !== F.model) return false;
    if (F.city && l.city !== F.city) return false;
    if (n(F.pmin) != null && l.price < n(F.pmin)) return false;
    if (n(F.pmax) != null && l.price > n(F.pmax)) return false;
    if (n(F.ymin) != null && l.year < n(F.ymin)) return false;
    if (n(F.ymax) != null && l.year > n(F.ymax)) return false;
    if (n(F.km) != null && l.mileage > n(F.km)) return false;
    for (const [k, f] of [['body', 'body'], ['trans', 'transmission'], ['fuel', 'fuel'], ['drive', 'drive']]) if (F[k].size && !F[k].has(l[f])) return false;
    return true;
  }
  const sorters = {
    new: (a, b) => (b.created || '').localeCompare(a.created || ''),
    cheap: (a, b) => a.price - b.price,
    expensive: (a, b) => b.price - a.price,
    year: (a, b) => b.year - a.year,
    km: (a, b) => a.mileage - b.mileage,
  };

  function card(l) {
    const ph = photosOf(l);
    const sold = l.status === 'sold';
    const fav = favs.has(l.id), inCmp = cmp.includes(l.id);
    const badges = [sold ? '<span class="bdg bdg--sold">Продано</span>' : '', !sold && isNew(l) ? '<span class="bdg bdg--new">Новое</span>' : '', l.owners === 1 ? '<span class="bdg">1 владелец</span>' : ''].join('');
    return `<article class="card${sold ? ' card--sold' : ''}" data-id="${esc(l.id)}">
      <a class="card__link" href="#/car/${encodeURIComponent(l.id)}">
        <div class="card__img" data-photos="${esc(JSON.stringify(ph.slice(0, 5)))}">
          <img src="${esc(ph[0])}" alt="${esc(title(l))}, ${l.year}" loading="lazy">
          <div class="card__badges">${badges}</div>
          ${ph.length > 1 ? `<div class="card__segs">${ph.slice(0, 5).map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div><span class="card__count">${icon('photo')}${ph.length}</span>` : ''}
        </div>
        <div class="card__body">
          <div class="card__top"><h3>${esc(title(l))}</h3><span class="card__year">${l.year}</span></div>
          <p class="card__price num">${fmtPrice(l.price)}</p>
          <p class="card__credit" title="${creditNote}">в кредит от <b class="num">${fmtNum(monthly(l.price))} ₽/мес</b></p>
          <p class="card__specs"><span>${icon('km')}${fmtNum(l.mileage)} км</span><span>${icon('eng')}${l.engine ? String(l.engine).replace('.', ',') + ' л' : esc(l.fuel)}${l.power ? ', ' + l.power + ' л.с.' : ''}</span><span>${icon('box')}${esc(l.transmission)}</span><span>${icon('drive')}${esc(l.drive || '')}</span></p>
          <p class="card__meta"><span>${esc(l.city)}</span><span>${fmtDate(l.created)}</span></p>
        </div>
      </a>
      <div class="card__acts">
        <button type="button" class="card__act${fav ? ' on' : ''}" data-fav="${esc(l.id)}" aria-pressed="${fav}" aria-label="В избранное">${icon('heart')}</button>
        <button type="button" class="card__act${inCmp ? ' on' : ''}" data-cmp="${esc(l.id)}" aria-pressed="${inCmp}" aria-label="Сравнить">${icon('cmp')}</button>
      </div>
    </article>`;
  }

  function render() {
    syncControls();
    const list = all.filter(matches).sort(sorters[$('#sort').value] || sorters.new);
    list.sort((a, b) => (a.status === 'sold') - (b.status === 'sold'));
    $('#grid').innerHTML = list.map(card).join('');
    $('#empty').hidden = list.length > 0;
    const word = plural(list.length, 'предложение', 'предложения', 'предложений');
    $('#count').textContent = `${list.length} ${word}`;
    $('#h-go').textContent = `Показать ${list.length}`;
    $('#filtersApply').textContent = `Показать ${list.length} ${word}`;
    renderFavs();
  }
  function renderFavs() {
    const list = all.filter(l => favs.has(l.id));
    $('#favGrid').innerHTML = list.map(card).join('');
    $('#favEmpty').hidden = list.length > 0;
    $('#favCount').textContent = list.length;
  }

  // Листание фото при наведении
  document.addEventListener('mousemove', e => {
    const box = e.target.closest('.card__img'); if (!box) return;
    const ph = JSON.parse(box.dataset.photos || '[]'); if (ph.length < 2) return;
    const r = box.getBoundingClientRect();
    const i = Math.min(ph.length - 1, Math.floor(((e.clientX - r.left) / r.width) * ph.length));
    if (box._i === i) return;
    box._i = i;
    $('img', box).src = ph[i];
    $$('.card__segs i', box).forEach((s, j) => s.classList.toggle('on', j === i));
  });
  document.addEventListener('mouseout', e => {
    const box = e.target.closest('.card__img'); if (!box || box.contains(e.relatedTarget)) return;
    const ph = JSON.parse(box.dataset.photos || '[]'); if (ph.length < 2 || !box._i) return;
    box._i = 0; $('img', box).src = ph[0];
    $$('.card__segs i', box).forEach((s, j) => s.classList.toggle('on', j === 0));
  });

  /* ---------- Избранное и сравнение ---------- */
  function toggleFav(id) {
    toggleSet(favs, id);
    store.set('ar:favs', [...favs]);
    $$(`[data-fav="${CSS.escape(id)}"]`).forEach(x => { const on = favs.has(id); x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
    renderFavs();
    toast(favs.has(id) ? 'Добавлено в избранное' : 'Удалено из избранного');
  }
  function toggleCmp(id) {
    if (cmp.includes(id)) cmp = cmp.filter(x => x !== id);
    else if (cmp.length >= 3) return toast('Сравнить можно до 3 автомобилей');
    else cmp.push(id);
    store.set('ar:cmp', cmp);
    $$(`[data-cmp="${CSS.escape(id)}"]`).forEach(x => { const on = cmp.includes(id); x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
    renderTray();
    if (location.hash === '#/compare') renderCompare();
  }
  document.addEventListener('click', e => {
    const f = e.target.closest('[data-fav]');
    if (f) { e.preventDefault(); return toggleFav(f.dataset.fav); }
    const c = e.target.closest('[data-cmp]');
    if (c) { e.preventDefault(); return toggleCmp(c.dataset.cmp); }
  });
  function renderTray() {
    const list = cmp.map(byId).filter(Boolean);
    $('#cmpCount').textContent = list.length;
    const tray = $('#cmpTray');
    tray.hidden = !list.length || location.hash === '#/compare' || location.hash === '#/sell';
    tray.innerHTML = `<div class="cmp-tray__cars">${list.map(l => `<img src="${esc(photosOf(l)[0])}" alt="${esc(title(l))}">`).join('')}</div>
      <b>${list.length} из 3</b><a class="btn btn--accent btn--sm" href="#/compare">Сравнить</a>`;
  }
  function renderCompare() {
    const list = cmp.map(byId).filter(Boolean);
    if (!list.length) { $('#compare').innerHTML = '<div class="empty"><p>Добавьте автомобили к сравнению кнопкой ⇄ на карточке.</p><a class="btn btn--accent" href="#/">В каталог</a></div>'; return; }
    const best = (k, dir) => { const v = list.map(l => l[k]).filter(x => x != null); return v.length > 1 ? (dir < 0 ? Math.min(...v) : Math.max(...v)) : null; };
    const bp = best('price', -1), bk = best('mileage', -1), by = best('year', 1), bpw = best('power', 1);
    const cell = (l, k, txt, b) => `<td class="${b != null && l[k] === b ? 'best' : ''}">${txt}</td>`;
    const rows = [
      ['Цена', l => cell(l, 'price', fmtPrice(l.price), bp)],
      ['В кредит', l => `<td>от ${fmtNum(monthly(l.price))} ₽/мес</td>`],
      ['Год', l => cell(l, 'year', l.year, by)],
      ['Пробег', l => cell(l, 'mileage', fmtNum(l.mileage) + ' км', bk)],
      ['Мощность', l => cell(l, 'power', l.power ? l.power + ' л.с.' : '—', bpw)],
      ...SPECS.filter(([k]) => !['year', 'mileage'].includes(k)).map(([k, label, f]) => [label, l => `<td>${esc(l[k] == null || l[k] === '' ? '—' : f ? f(l[k], l) : l[k])}</td>`]),
    ];
    $('#compare').innerHTML = `<div class="cmp-table-wrap"><table class="cmp-table">
      <thead><tr><th></th>${list.map(l => `<td><img src="${esc(photosOf(l)[0])}" alt=""><a href="#/car/${encodeURIComponent(l.id)}">${esc(title(l))}</a><br><button class="link small" data-cmp="${esc(l.id)}">Убрать</button></td>`).join('')}</tr></thead>
      <tbody>${rows.map(([h, f]) => `<tr><th>${h}</th>${list.map(f).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  /* ---------- Недавно просмотренные ---------- */
  function pushRecent(id) {
    recent = [id, ...recent.filter(x => x !== id)].slice(0, 10);
    store.set('ar:recent', recent);
    renderRecent();
  }
  function renderRecent() {
    const list = recent.map(byId).filter(Boolean);
    $('#recentBox').hidden = !list.length;
    $('#recent').innerHTML = list.map(l => `<a class="mini" href="#/car/${encodeURIComponent(l.id)}"><img src="${esc(photosOf(l)[0])}" alt="" loading="lazy"><div><b>${esc(title(l))}</b><span>${fmtPrice(l.price)}</span></div></a>`).join('');
  }
  $('#recentClear').addEventListener('click', () => { recent = []; store.set('ar:recent', []); renderRecent(); });

  /* ---------- Роутинг ---------- */
  function show(view) {
    if (!$('#view-catalog').hidden && view !== 'catalog') catalogScroll = scrollY;
    $$('.view').forEach(v => (v.hidden = v.id !== 'view-' + view));
    $$('.top__nav [data-nav]').forEach(a => a.classList.toggle('current', a.dataset.nav === view));
  }
  function route() {
    const h = location.hash;
    if ($('#lightbox').open) $('#lightbox').close();
    $('#filters').classList.remove('open');
    const car = h.match(/^#\/car\/(.+)$/);
    let restore = false;
    if (car) {
      const id = decodeURIComponent(car[1]);
      const l = id === '__preview' ? preview : byId(id);
      if (!l) { location.replace('#/'); return; }
      show('car'); renderCar(l, id === '__preview');
      if (id !== '__preview') pushRecent(id);
    } else if (h === '#/favs') { show('favs'); document.title = 'Избранное | Авторынок'; }
    else if (h === '#/sell') { show('sell'); document.title = 'Продать автомобиль | Авторынок'; }
    else if (h === '#/compare') { show('compare'); renderCompare(); document.title = 'Сравнение | Авторынок'; }
    else { const was = $('#view-catalog').hidden; show('catalog'); restore = was; document.title = 'Авторынок — объявления о продаже автомобилей'; }
    renderTray();
    window.scrollTo({ top: restore ? catalogScroll : 0, behavior: 'instant' });
  }
  window.addEventListener('hashchange', route);

  /* ---------- Страница автомобиля ---------- */
  function renderCar(l, isPreview) {
    const ph = photosOf(l);
    const c = contactLink(l.contact);
    const sold = l.status === 'sold';
    const fav = favs.has(l.id), inCmp = cmp.includes(l.id);
    const n = ph.length, shown = Math.min(n, 5);
    const mosaicCls = n >= 5 ? '' : ` mosaic--${n}`;
    const tiles = [
      ['cal', 'Год', l.year], ['km', 'Пробег', fmtNum(l.mileage) + ' км'],
      ['eng', 'Двигатель', [l.engine ? String(l.engine).replace('.', ',') + ' л' : '', l.power ? l.power + ' л.с.' : ''].filter(Boolean).join(', ') || l.fuel],
      ['box', 'Коробка', l.transmission], ['drive', 'Привод', l.drive], ['fuel', 'Топливо', l.fuel],
    ].filter(t => t[2]);
    const specs = SPECS.map(([k, label, f]) => {
      const v = l[k]; if (v == null || v === '') return '';
      const text = f ? f(v, l) : v;
      return text ? `<div><dt>${label}</dt><dd>${esc(text)}</dd></div>` : '';
    }).join('');
    const credits = (l.credits || []).length ? `<p class="credits">Фото: ${l.credits.map((cr, i) => `<a href="${esc(safeUrl(cr.source))}" target="_blank" rel="noopener">${i + 1}</a>`).join(', ')} — Wikimedia Commons, ${esc([...new Set(l.credits.map(x => x.license))].join(', '))}</p>` : '';
    const showComments = !isPreview && commentsOn(db, l);
    const contactBtn = (cls = '') => c.href
      ? `<a class="btn btn--accent ${cls}" href="${esc(c.href)}" ${c.href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${icon(c.href.startsWith('tel') ? 'phone' : 'tg')}${c.href.startsWith('tel') ? 'Позвонить' : 'Написать'}</a>` : `<span class="btn btn--ghost ${cls}">${esc(c.text)}</span>`;
    const similar = isPreview ? [] : all.filter(x => x.id !== l.id && x.status === 'active')
      .map(x => [x, (x.body === l.body) * 2 + (x.brand === l.brand) * 2 + (Math.abs(x.price - l.price) / l.price < 0.35)])
      .filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 4).map(x => x[0]);

    $('#view-car').innerHTML = `
      <div class="wrap">
        ${isPreview ? '<p class="preview-note">Предпросмотр — так объявление увидят покупатели. <a href="#/sell">Вернуться к форме</a></p>' : ''}
        <nav class="crumbs" aria-label="Навигация"><a href="#/">Каталог</a><span>›</span><a href="#/" data-crumb-brand="${esc(l.brand)}">${esc(l.brand)}</a><span>›</span><span>${esc(l.model)}</span></nav>
        <div class="car-head">
          <div>
            <h1>${esc(title(l))} <span>${esc(l.year)}</span></h1>
            <p class="car-head__sub">${fmtNum(l.mileage)} км · ${esc(l.body)} · ${esc(l.city)}</p>
          </div>
          ${isPreview ? '' : `<div class="car-head__acts">
            <button class="icon-btn${fav ? ' on' : ''}" data-fav="${esc(l.id)}" aria-pressed="${fav}" title="В избранное">${icon('heart')}</button>
            <button class="icon-btn${inCmp ? ' on' : ''}" data-cmp="${esc(l.id)}" aria-pressed="${inCmp}" title="Сравнить">${icon('cmp')}</button>
            <button class="icon-btn" data-share title="Поделиться">${icon('share')}</button>
          </div>`}
        </div>
        <div class="mosaic-wrap">
          ${sold ? '<span class="bdg bdg--sold car-sold">Продано</span>' : ''}
          <div class="mosaic${mosaicCls}">
            ${ph.slice(0, shown).map((p, i) => `<button type="button" data-lb="${i}" aria-label="Открыть фото ${i + 1}"><img src="${esc(p)}" alt="${esc(title(l))}, фото ${i + 1}" ${i ? 'loading="lazy"' : ''}>${i === shown - 1 && n > shown ? `<span class="mosaic__more">+${n - shown} фото</span>` : ''}</button>`).join('')}
          </div>
          ${n > 1 ? `<button type="button" class="btn btn--sm mosaic__all" data-lb="0">${icon('photo')}Все фото · ${n}</button>` : ''}
        </div>
        ${credits}

        <div class="car-layout">
          <div>
            <div class="tiles">${tiles.map(([k, s, v]) => `<div class="tile">${icon(k)}<div><small>${s}</small><b>${esc(v)}</b></div></div>`).join('')}</div>
            <section class="car-sec"><h2>Описание</h2><div class="desc">${esc(l.description || '').replace(/\n/g, '<br>')}</div></section>
            <section class="car-sec"><h2>Характеристики</h2><dl class="specs">${specs}</dl></section>
            <p class="muted small">Опубликовано ${fmtDate(l.created)}${l.updated && l.updated !== l.created ? ` · обновлено ${fmtDate(l.updated)}` : ''} · № ${esc(l.id)}</p>
            ${showComments ? `<section class="car-sec comments"><h2>Обсуждение</h2><div id="cBody"><p class="muted">Загрузка…</p></div></section>` : ''}
          </div>
          <aside class="aside">
            <div class="panel">
              <p class="panel__price num">${fmtPrice(l.price)}</p>
              <p class="panel__credit">в кредит от <b class="num">${fmtNum(monthly(l.price))} ₽/мес</b></p>
              <div class="panel__cta">${sold ? '<span class="btn btn--ghost">Автомобиль продан</span>' : contactBtn('btn--block')}</div>
              <div class="seller"><span class="avatar">${esc((l.seller || '?').trim()[0] || '?')}</span><div><b>${esc(l.seller || '—')}</b><span>Частное лицо · ${esc(l.city)}</span></div></div>
              ${c.href && !sold ? `<p class="muted small" style="margin:0">${esc(c.text)}</p>` : ''}
            </div>
            <div class="panel calc" id="calc">
              <h3>Кредитный калькулятор</h3>
              <div class="calc__row"><span>Первый взнос</span><b class="num" id="cDownV"></b></div>
              <input type="range" id="cDown" min="0" max="80" step="5" value="${CREDIT.down * 100}" aria-label="Первый взнос, %">
              <div class="calc__row"><span>Срок</span></div>
              <div class="calc__terms" id="cTerms">${[24, 36, 48, 60, 84].map(m => `<button type="button" class="chip" data-m="${m}" aria-pressed="${m === CREDIT.months}">${m / 12} ${plural(m / 12, 'год', 'года', 'лет')}</button>`).join('')}</div>
              <div class="calc__row"><span>Ставка, % годовых</span></div>
              <input type="number" id="cRate" value="${CREDIT.rate * 100}" min="0" max="60" step="0.1" style="margin-bottom:14px">
              <div class="calc__res"><span>Платёж в месяц</span><b class="num" id="cRes"></b></div>
              <small>Расчёт примерный и не является офертой. Условия уточняйте в банке.</small>
            </div>
            <div class="safety">${icon('shield')}<span>Осмотрите машину лично, проверьте VIN и документы. Не переводите предоплату до встречи.</span></div>
          </aside>
        </div>

        ${similar.length ? `<section class="car-sec"><div class="sec-head"><h2>Похожие предложения</h2><a class="link" href="#/">Весь каталог →</a></div><div class="grid">${similar.map(card).join('')}</div></section>` : ''}
      </div>
      <div class="mbar">
        <div class="mbar__price"><b class="num">${fmtPrice(l.price)}</b><span>${esc(title(l))}, ${l.year}</span></div>
        ${isPreview ? '' : `<button class="icon-btn${fav ? ' on' : ''}" data-fav="${esc(l.id)}" aria-label="В избранное">${icon('heart')}</button>`}
        ${sold ? '' : contactBtn()}
      </div>`;

    // калькулятор
    let months = CREDIT.months;
    const calc = () => {
      const d = +$('#cDown').value / 100;
      const rate = Math.max(0, parseFloat(String($('#cRate').value).replace(',', '.')) || 0) / 100;
      $('#cDownV').textContent = `${fmtNum(Math.round(l.price * d))} ₽ · ${Math.round(d * 100)}%`;
      $('#cRes').textContent = fmtNum(monthly(l.price, d, months, rate)) + ' ₽';
    };
    $('#cDown').addEventListener('input', calc);
    $('#cRate').addEventListener('input', calc);
    $('#cTerms').addEventListener('click', e => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      months = +b.dataset.m;
      $$('#cTerms .chip').forEach(x => x.setAttribute('aria-pressed', x === b));
      calc();
    });
    calc();

    $('#view-car').onclick = e => {
      const lb = e.target.closest('[data-lb]'); if (lb) return openLightbox(ph, +lb.dataset.lb, title(l));
      if (e.target.closest('[data-share]')) return share(l);
      const cb = e.target.closest('[data-crumb-brand]'); if (cb) { resetFilters(); setBrand(cb.dataset.crumbBrand); render(); }
    };
    document.title = isPreview ? 'Предпросмотр | Авторынок' : `${title(l)}, ${l.year} — ${fmtPrice(l.price)} | Авторынок`;
    if (showComments) loadComments(l);
  }

  async function share(l) {
    const url = location.href;
    const text = `${title(l)}, ${l.year} — ${fmtPrice(l.price)}`;
    if (navigator.share) { try { await navigator.share({ title: text, url }); } catch { /* отменено */ } return; }
    try { await navigator.clipboard.writeText(url); toast('Ссылка скопирована'); } catch { prompt('Ссылка на объявление:', url); }
  }

  /* ---------- Лайтбокс ---------- */
  function openLightbox(ph, start, name) {
    const lb = $('#lightbox');
    lb.innerHTML = `<div class="lb">
      <div class="lb__top"><span id="lbIdx"></span><span>${esc(name)}</span><button class="lb__close" type="button" aria-label="Закрыть">✕</button></div>
      <div class="lb__stage"><img id="lbImg" alt="">${ph.length > 1 ? '<button class="lb__nav prev" aria-label="Предыдущее">‹</button><button class="lb__nav next" aria-label="Следующее">›</button>' : ''}</div>
      <div class="lb__thumbs">${ph.length > 1 ? ph.map((p, i) => `<button data-i="${i}" aria-label="Фото ${i + 1}"><img src="${esc(p)}" alt=""></button>`).join('') : ''}</div></div>`;
    let i = start;
    const go = n => {
      i = (n + ph.length) % ph.length;
      $('#lbImg').src = ph[i];
      $('#lbIdx').textContent = `${i + 1} / ${ph.length}`;
      $$('.lb__thumbs button', lb).forEach((b, j) => { b.classList.toggle('on', j === i); if (j === i) b.scrollIntoView({ block: 'nearest', inline: 'center' }); });
    };
    lb.onclick = e => {
      if (e.target.closest('.lb__close')) return lb.close();
      if (e.target.closest('.prev')) go(i - 1);
      if (e.target.closest('.next')) go(i + 1);
      const t = e.target.closest('[data-i]'); if (t) go(+t.dataset.i);
    };
    lb.onkeydown = e => { if (e.key === 'ArrowLeft') go(i - 1); if (e.key === 'ArrowRight') go(i + 1); };
    let sx = null;
    const st = $('.lb__stage', lb);
    st.addEventListener('touchstart', e => (sx = e.touches[0].clientX), { passive: true });
    st.addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1)); sx = null; });
    lb.showModal();
    go(start);
  }

  /* ---------- Обсуждение ---------- */
  async function loadComments(l) {
    const box = $('#cBody');
    if (!l.issue) { box.innerHTML = '<p class="muted">Обсуждение скоро откроется.</p>'; return; }
    const issueUrl = `https://github.com/${REPO.owner}/${REPO.repo}/issues/${l.issue}`;
    const btn = `<a class="btn btn--ghost" href="${issueUrl}#new_comment_field" target="_blank" rel="noopener">Написать комментарий</a>
      <p class="muted small">Комментарии публикуются через GitHub — понадобится бесплатный аккаунт.</p>`;
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO.owner}/${REPO.repo}/issues/${l.issue}/comments?per_page=100`, { headers: { Accept: 'application/vnd.github+json' } });
      if (r.status === 403 || r.status === 429) throw new Error('limit');
      if (!r.ok) throw new Error('http');
      const list = await r.json();
      if (!box.isConnected) return;
      const staff = ['OWNER', 'MEMBER', 'COLLABORATOR'];
      box.innerHTML = (list.length ? `<ul class="clist">${list.map(c => `
        <li><img src="${esc(c.user.avatar_url)}&s=72" alt="" width="36" height="36" loading="lazy">
          <div><p class="clist__head"><b>${esc(c.user.login)}</b>${staff.includes(c.author_association) ? '<span class="tag">админ</span>' : ''}<span class="muted">${fmtDate(c.created_at)}</span></p>
          <p>${esc(c.body).replace(/\n/g, '<br>')}</p></div></li>`).join('')}</ul>`
        : '<p class="muted">Пока никто не написал. Задайте вопрос продавцу первым.</p>') + btn;
    } catch (e) {
      if (!box.isConnected) return;
      box.innerHTML = `<p class="muted">${e.message === 'limit' ? 'GitHub временно ограничил загрузку комментариев — откройте обсуждение по ссылке.' : 'Не удалось загрузить комментарии.'}</p>${btn}`;
    }
  }

  /* ---------- Подача объявления ---------- */
  const form = $('#sellForm');
  const opt = (sel, items) => (form.elements[sel].innerHTML = '<option value="">—</option>' + items.map(v => `<option>${esc(v)}</option>`).join(''));
  opt('transmission', ENUMS.transmission); opt('fuel', ENUMS.fuel); opt('body', ENUMS.body);
  $('#brandList').innerHTML = BRANDS.map(b => `<option value="${esc(b)}">`).join('');
  $('#cityList').innerHTML = CITIES.map(b => `<option value="${esc(b)}">`).join('');
  const draft = store.get('ar:draft', {});
  Object.entries(draft).forEach(([k, v]) => { if (form.elements[k]) form.elements[k].value = v; });
  form.addEventListener('input', () => store.set('ar:draft', Object.fromEntries(new FormData(form))));

  function readForm() {
    const d = Object.fromEntries(new FormData(form));
    const num = k => (d[k] === '' ? undefined : Number(d[k]));
    return {
      brand: d.brand.trim(), model: d.model.trim(), year: num('year'), mileage: num('mileage'), price: num('price'),
      transmission: d.transmission, fuel: d.fuel, body: d.body, engine: num('engine'), power: num('power'),
      drive: d.drive, color: d.color.trim(), owners: num('owners'), condition: d.condition,
      city: d.city.trim(), description: d.description.trim(),
      photos: d.photos.split(/\s+/).map(safeUrl).filter(u => /^https?:/.test(u)),
      seller: d.seller.trim(), contact: d.contact.trim(),
    };
  }
  function validate() {
    const bad = [...form.elements].filter(el => el.willValidate && !el.checkValidity());
    $$('.invalid', form).forEach(el => el.classList.remove('invalid'));
    bad.forEach(el => el.classList.add('invalid'));
    $('#formError').textContent = bad.length ? 'Заполните обязательные поля, отмеченные *' : '';
    if (bad.length) bad[0].focus();
    return !bad.length;
  }
  function listingText(l) {
    return [
      `**${title(l)}, ${l.year}** — ${fmtPrice(l.price)}`, '',
      `Пробег: ${fmtNum(l.mileage)} км · ${l.transmission} · ${l.fuel} · ${l.body}`,
      `Город: ${l.city} · Продавец: ${l.seller}, ${l.contact}`, '', l.description, '',
      l.photos.length ? 'Фото:\n' + l.photos.join('\n') : '_Фото можно приложить ниже, перетащив файлы в это поле._', '',
      '<!-- данные для модератора, не удаляйте -->', '```json', JSON.stringify(l, null, 1), '```',
    ].join('\n');
  }
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validate()) return;
    const l = readForm();
    window.open(`https://github.com/${REPO.owner}/${REPO.repo}/issues/new?` + new URLSearchParams({
      title: `[Объявление] ${title(l)}, ${l.year} — ${fmtPrice(l.price)}`, body: listingText(l),
    }), '_blank', 'noopener');
  });
  $('#copyListing').addEventListener('click', async () => {
    if (!validate()) return;
    try { await navigator.clipboard.writeText(listingText(readForm())); toast('Текст объявления скопирован'); }
    catch { $('#formError').textContent = 'Не удалось скопировать — выделите текст вручную.'; }
  });
  $('#previewListing').addEventListener('click', () => {
    preview = { ...readForm(), id: '__preview', created: new Date().toISOString(), status: 'active' };
    location.hash = '#/car/__preview';
  });

  /* ---------- Установка на главный экран (PWA) ---------- */
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  (function installPrompt() {
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (standalone) return;
    const box = $('#install');
    const snoozed = () => Date.now() < store.get('ar:installSnooze', 0);
    const hide = (snoozeDays) => { box.hidden = true; if (snoozeDays) store.set('ar:installSnooze', Date.now() + snoozeDays * 864e5); };
    let deferred = null;

    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();           // показываем свою плашку вместо стандартной мини-панели
      deferred = e;
      if (!snoozed()) setTimeout(() => { if (deferred) box.hidden = false; }, 3000);
    });
    $('#installBtn').addEventListener('click', async () => {
      if (!deferred) return;
      box.hidden = true;
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      if (outcome !== 'accepted') hide(7);
    });
    $('#installClose').addEventListener('click', () => hide(14));
    window.addEventListener('appinstalled', () => { hide(); deferred = null; toast('Авторынок установлен на главный экран'); });

    // iPhone/iPad: установка только вручную через «Поделиться»
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios && !snoozed()) setTimeout(() => {
      box.classList.add('install--ios');
      $('#installHint').textContent = '«Поделиться» ⬆︎ → «На экран „Домой“»';
      box.hidden = false;
    }, 6000);
  })();
})();
