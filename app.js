/* Публичная часть: каталог, карточка объявления, избранное, подача объявления */
(function () {
  'use strict';
  const { REPO, ENUMS, BRANDS, CITIES, SPECS, fmtNum, fmtPrice, fmtDate, esc, plural, title, safeUrl, contactLink, carPlaceholder, store, commentsOn, loadPublicDb } = window.AR;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  let db = { settings: {}, listings: [] };
  let active = [];
  const favs = new Set(store.get('ar:favs', []));
  const F = { q: '', brand: '', pmin: '', pmax: '', ymin: '', ymax: '', km: '', city: '', trans: new Set(), fuel: new Set(), body: new Set() };

  /* ---------- Загрузка ---------- */
  loadPublicDb().then(data => {
    db = data;
    active = db.listings.filter(l => l.status !== 'hidden');
    setupFilters();
    render();
    route();
  }).catch(e => {
    $('#grid').innerHTML = `<p class="empty">${esc(e.message)}</p>`;
  });

  /* ---------- Фильтры ---------- */
  function setupFilters() {
    const brands = [...new Set(active.map(l => l.brand))].sort();
    $('#f-brand').insertAdjacentHTML('beforeend', brands.map(b => `<option>${esc(b)}</option>`).join(''));
    const cities = [...new Set(active.map(l => l.city))].sort();
    $('#f-city').insertAdjacentHTML('beforeend', cities.map(c => `<option>${esc(c)}</option>`).join(''));
    const chips = (el, items, set) => {
      el.innerHTML = items.map(v => `<button type="button" class="chip" aria-pressed="false" data-v="${esc(v)}">${esc(v)}</button>`).join('');
      el.addEventListener('click', e => {
        const b = e.target.closest('.chip'); if (!b) return;
        const v = b.dataset.v;
        set.has(v) ? set.delete(v) : set.add(v);
        b.setAttribute('aria-pressed', set.has(v));
        render();
      });
    };
    chips($('#f-trans'), ENUMS.transmission, F.trans);
    chips($('#f-fuel'), ENUMS.fuel, F.fuel);
    chips($('#f-body'), [...new Set(active.map(l => l.body))].filter(Boolean), F.body);

    const bind = (id, key) => $(id).addEventListener('input', e => { F[key] = e.target.value; render(); });
    bind('#f-brand', 'brand'); bind('#f-city', 'city'); bind('#f-pmin', 'pmin'); bind('#f-pmax', 'pmax');
    bind('#f-ymin', 'ymin'); bind('#f-ymax', 'ymax'); bind('#f-km', 'km');
    $('#sort').addEventListener('change', render);
    $('#q').addEventListener('input', e => { F.q = e.target.value; render(); });
    $('#quickSearch').addEventListener('submit', e => { e.preventDefault(); $('.results').scrollIntoView({ behavior: 'smooth' }); });
    $('#resetFilters').addEventListener('click', () => {
      Object.assign(F, { q: '', brand: '', pmin: '', pmax: '', ymin: '', ymax: '', km: '', city: '' });
      F.trans.clear(); F.fuel.clear(); F.body.clear();
      $$('#filters input, #filters select').forEach(i => (i.value = ''));
      $('#q').value = '';
      $$('.chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
      render();
    });
    $('#filtersToggle').addEventListener('click', () => $('#filters').classList.toggle('open'));

    const prices = active.filter(l => l.status === 'active').map(l => l.price);
    $('#stats').innerHTML = prices.length ? `
      <div><b>${active.filter(l => l.status === 'active').length}</b><span>${plural(prices.length, 'автомобиль', 'автомобиля', 'автомобилей')} в продаже</span></div>
      <div><b>${brands.length}</b><span>${plural(brands.length, 'марка', 'марки', 'марок')}</span></div>
      <div><b>от ${fmtNum(Math.min(...prices))} ₽</b><span>самое доступное</span></div>` : '';
  }

  function matches(l) {
    const n = v => (v === '' ? null : Number(v));
    if (F.q) {
      const hay = `${l.brand} ${l.model} ${l.city} ${l.year} ${l.color || ''} ${l.body}`.toLowerCase();
      if (!F.q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w))) return false;
    }
    if (F.brand && l.brand !== F.brand) return false;
    if (F.city && l.city !== F.city) return false;
    if (n(F.pmin) != null && l.price < n(F.pmin)) return false;
    if (n(F.pmax) != null && l.price > n(F.pmax)) return false;
    if (n(F.ymin) != null && l.year < n(F.ymin)) return false;
    if (n(F.ymax) != null && l.year > n(F.ymax)) return false;
    if (n(F.km) != null && l.mileage > n(F.km)) return false;
    if (F.trans.size && !F.trans.has(l.transmission)) return false;
    if (F.fuel.size && !F.fuel.has(l.fuel)) return false;
    if (F.body.size && !F.body.has(l.body)) return false;
    return true;
  }

  const sorters = {
    new: (a, b) => (b.created || '').localeCompare(a.created || ''),
    cheap: (a, b) => a.price - b.price,
    expensive: (a, b) => b.price - a.price,
    year: (a, b) => b.year - a.year,
    km: (a, b) => a.mileage - b.mileage,
  };

  /* ---------- Карточки ---------- */
  function card(l) {
    const img = safeUrl(l.photos?.[0]) || carPlaceholder(l.id);
    const sold = l.status === 'sold';
    const fav = favs.has(l.id);
    return `<article class="card${sold ? ' card--sold' : ''}">
      <a class="card__link" href="#/car/${esc(l.id)}" aria-label="${esc(title(l))}, ${l.year}">
        <div class="card__img"><img src="${esc(img)}" alt="" loading="lazy">
          ${l.photos?.length > 1 ? `<span class="card__count">📷 ${l.photos.length}</span>` : ''}
          ${sold ? '<span class="card__sold">Продано</span>' : ''}
        </div>
        <div class="card__body">
          <p class="card__price">${fmtPrice(l.price)}</p>
          <h3>${esc(title(l))}, ${l.year}</h3>
          <p class="card__specs">${fmtNum(l.mileage)} км · ${esc(l.engine ? String(l.engine).replace('.', ',') + ' л' : l.fuel)} · ${esc(l.transmission)} · ${esc(l.drive || '')}</p>
          <p class="card__meta"><span>${esc(l.city)}</span><span>${fmtDate(l.created)}</span></p>
        </div>
      </a>
      <button type="button" class="fav${fav ? ' on' : ''}" data-fav="${esc(l.id)}" aria-pressed="${fav}" aria-label="В избранное">${fav ? '♥' : '♡'}</button>
    </article>`;
  }

  function render() {
    const list = active.filter(matches).sort(sorters[$('#sort').value] || sorters.new);
    // проданные — в конец списка
    list.sort((a, b) => (a.status === 'sold') - (b.status === 'sold'));
    $('#grid').innerHTML = list.map(card).join('');
    $('#empty').hidden = list.length > 0;
    $('#count').textContent = `${list.length} ${plural(list.length, 'объявление', 'объявления', 'объявлений')}`;
    renderFavs();
  }

  function renderFavs() {
    const list = active.filter(l => favs.has(l.id));
    $('#favGrid').innerHTML = list.map(card).join('');
    $('#favEmpty').hidden = list.length > 0;
    $('#favCount').textContent = list.length;
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-fav]');
    if (!b) return;
    e.preventDefault();
    const id = b.dataset.fav;
    favs.has(id) ? favs.delete(id) : favs.add(id);
    store.set('ar:favs', [...favs]);
    $$(`[data-fav="${CSS.escape(id)}"]`).forEach(x => {
      const on = favs.has(id);
      x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); x.textContent = on ? '♥' : '♡';
    });
    renderFavs();
  });

  /* ---------- Роутинг ---------- */
  const dlg = $('#detail');
  function show(view) {
    $$('.view').forEach(v => (v.hidden = v.id !== 'view-' + view));
    $$('.top__nav a').forEach(a => a.classList.toggle('current', a.dataset.nav === view));
  }
  function route() {
    const h = location.hash;
    const car = h.match(/^#\/car\/(.+)$/);
    if (car) {
      const l = db.listings.find(x => x.id === decodeURIComponent(car[1]) && x.status !== 'hidden');
      if (!$('#view-catalog').hidden || $$('.view').every(v => v.hidden)) show('catalog');
      if (l) openDetail(l); else { history.replaceState(null, '', '#'); }
      return;
    }
    if (dlg.open) dlg.close();
    if (h === '#/favs') show('favs');
    else if (h === '#/sell') show('sell');
    else show('catalog');
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  $$('[data-nav]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const v = a.dataset.nav;
    location.hash = v === 'catalog' ? '#/' : '#/' + v;
  }));

  /* ---------- Карточка объявления ---------- */
  function openDetail(l, preview = false) {
    const photos = (l.photos || []).map(safeUrl).filter(Boolean);
    if (!photos.length) photos.push(carPlaceholder(l.id || 'x'));
    const c = contactLink(l.contact);
    const specs = SPECS.map(([k, label, f]) => {
      const v = l[k];
      if (v == null || v === '' || (k === 'engine' && !v && !l.fuel)) return '';
      const text = f ? f(v, l) : v;
      return text ? `<dt>${label}</dt><dd>${esc(text)}</dd>` : '';
    }).join('');
    const credits = (l.credits || []).length
      ? `<p class="credits">Фото: ${l.credits.map((cr, i) => `<a href="${esc(safeUrl(cr.source))}" target="_blank" rel="noopener">${i + 1}</a>`).join(', ')} — Wikimedia Commons, ${esc([...new Set(l.credits.map(c => c.license))].join(', '))}</p>` : '';
    const showComments = !preview && commentsOn(db, l);

    dlg.innerHTML = `
      <div class="detail__in">
        <button class="detail__close" type="button" aria-label="Закрыть">✕</button>
        <div class="gallery">
          <div class="gallery__main">
            <img id="gMain" src="${esc(photos[0])}" alt="${esc(title(l))}">
            ${photos.length > 1 ? `<button class="gallery__nav prev" aria-label="Предыдущее фото">‹</button><button class="gallery__nav next" aria-label="Следующее фото">›</button><span class="gallery__idx" id="gIdx">1 / ${photos.length}</span>` : ''}
            ${l.status === 'sold' ? '<span class="card__sold">Продано</span>' : ''}
          </div>
          ${photos.length > 1 ? `<div class="gallery__thumbs">${photos.map((p, i) => `<button data-i="${i}" class="${i ? '' : 'on'}"><img src="${esc(p)}" alt="Фото ${i + 1}"></button>`).join('')}</div>` : ''}
          ${credits}
        </div>
        <div class="detail__info">
          ${preview ? '<p class="preview-note">Предпросмотр — так объявление увидят покупатели</p>' : ''}
          <h2>${esc(title(l))}, ${esc(l.year)}</h2>
          <p class="detail__price">${fmtPrice(l.price)}</p>
          <div class="seller">
            <div><span class="muted">Продавец</span><b>${esc(l.seller || '—')}</b></div>
            ${c.href ? `<a class="btn btn--accent" href="${esc(c.href)}" ${c.href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${c.href.startsWith('tel') ? '📞 ' : '✈️ '}${esc(c.text)}</a>` : `<b>${esc(c.text)}</b>`}
          </div>
          <dl class="specs">${specs}</dl>
          <h3>Описание</h3>
          <div class="desc">${esc(l.description || '').replace(/\n/g, '<br>')}</div>
          <p class="muted small">Опубликовано ${fmtDate(l.created)}${l.updated && l.updated !== l.created ? ` · обновлено ${fmtDate(l.updated)}` : ''} · № ${esc(l.id)}</p>
        </div>
        ${showComments ? `<section class="comments" id="comments"><h3>Обсуждение</h3><div id="cBody"><p class="muted">Загрузка…</p></div></section>` : ''}
      </div>`;

    let idx = 0;
    const go = i => {
      idx = (i + photos.length) % photos.length;
      $('#gMain', dlg).src = photos[idx];
      const gi = $('#gIdx', dlg); if (gi) gi.textContent = `${idx + 1} / ${photos.length}`;
      $$('.gallery__thumbs button', dlg).forEach((b, j) => b.classList.toggle('on', j === idx));
    };
    dlg.onclick = e => {
      if (e.target === dlg || e.target.closest('.detail__close')) return closeDetail();
      if (e.target.closest('.prev')) go(idx - 1);
      if (e.target.closest('.next')) go(idx + 1);
      const t = e.target.closest('.gallery__thumbs button'); if (t) go(+t.dataset.i);
    };
    dlg.onkeydown = e => {
      if (e.key === 'ArrowLeft') go(idx - 1);
      if (e.key === 'ArrowRight') go(idx + 1);
    };
    dlg.oncancel = e => { e.preventDefault(); closeDetail(); };
    let sx = null;
    const main = $('.gallery__main', dlg);
    main.addEventListener('touchstart', e => (sx = e.touches[0].clientX), { passive: true });
    main.addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1)); sx = null; });

    dlg._preview = preview;
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
    document.title = `${title(l)}, ${l.year} — ${fmtPrice(l.price)} | Авторынок`;
    if (showComments) loadComments(l);
  }

  function closeDetail() {
    dlg.close();
    document.title = 'Авторынок — объявления о продаже автомобилей';
    if (!dlg._preview && location.hash.startsWith('#/car/')) history.length > 1 ? history.back() : (location.hash = '#/');
  }

  async function loadComments(l) {
    const box = $('#cBody', dlg);
    if (!l.issue) {
      box.innerHTML = '<p class="muted">Обсуждение скоро откроется.</p>';
      return;
    }
    const issueUrl = `https://github.com/${REPO.owner}/${REPO.repo}/issues/${l.issue}`;
    const btn = `<a class="btn btn--ghost" href="${issueUrl}#new_comment_field" target="_blank" rel="noopener">Написать комментарий</a>
      <p class="muted small">Комментарии публикуются через GitHub — понадобится бесплатный аккаунт.</p>`;
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO.owner}/${REPO.repo}/issues/${l.issue}/comments?per_page=100`, { headers: { Accept: 'application/vnd.github+json' } });
      if (r.status === 403) throw new Error('limit');
      if (!r.ok) throw new Error('http');
      const list = await r.json();
      const staff = ['OWNER', 'MEMBER', 'COLLABORATOR'];
      box.innerHTML = (list.length ? `<ul class="clist">${list.map(c => `
        <li><img src="${esc(c.user.avatar_url)}&s=64" alt="" width="32" height="32">
          <div><p class="clist__head"><b>${esc(c.user.login)}</b>${staff.includes(c.author_association) ? '<span class="tag">админ</span>' : ''}<span class="muted">${fmtDate(c.created_at)}</span></p>
          <p>${esc(c.body).replace(/\n/g, '<br>')}</p></div></li>`).join('')}</ul>`
        : '<p class="muted">Пока никто не написал. Задайте вопрос продавцу первым.</p>') + btn;
    } catch (e) {
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
      drive: d.drive, color: d.color.trim(), city: d.city.trim(), description: d.description.trim(),
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
    const lines = [
      `**${title(l)}, ${l.year}** — ${fmtPrice(l.price)}`, '',
      `Пробег: ${fmtNum(l.mileage)} км · ${l.transmission} · ${l.fuel} · ${l.body}`,
      `Город: ${l.city} · Продавец: ${l.seller}, ${l.contact}`, '', l.description, '',
      l.photos.length ? 'Фото:\n' + l.photos.join('\n') : '_Фото можно приложить ниже, перетащив файлы в это поле._', '',
      '<!-- данные для модератора, не удаляйте -->', '```json', JSON.stringify(l, null, 1), '```',
    ];
    return lines.join('\n');
  }
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validate()) return;
    const l = readForm();
    const url = `https://github.com/${REPO.owner}/${REPO.repo}/issues/new?` + new URLSearchParams({
      title: `[Объявление] ${title(l)}, ${l.year} — ${fmtPrice(l.price)}`,
      body: listingText(l),
    });
    window.open(url, '_blank', 'noopener');
  });
  $('#copyListing').addEventListener('click', async () => {
    if (!validate()) return;
    try { await navigator.clipboard.writeText(listingText(readForm())); $('#formError').textContent = 'Текст скопирован.'; }
    catch { $('#formError').textContent = 'Не удалось скопировать — выделите текст вручную.'; }
  });
  $('#previewListing').addEventListener('click', () => {
    const l = readForm();
    openDetail({ ...l, id: 'preview', created: new Date().toISOString(), status: 'active' }, true);
  });
})();
