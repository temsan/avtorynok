/* Админка: объявления хранятся в data/db.json репозитория, фото — в photos/. Запись — через GitHub API. */
(function () {
  'use strict';
  const { REPO, ENUMS, BRANDS, CITIES, fmtNum, fmtPrice, fmtDate, esc, title, safeUrl, carPlaceholder, b64encode, b64decode, store, spinFrames, hasSpin, mountSpin } = window.AR;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const API = 'https://api.github.com';
  const R = `/repos/${REPO.owner}/${REPO.repo}`;
  const DB_PATH = 'data/db.json';
  const siteUrl = `https://${REPO.owner}.github.io/${REPO.repo === REPO.owner + '.github.io' ? '' : REPO.repo + '/'}`;

  let token = sessionStorage.getItem('ar:token') || store.get('ar:token', '');
  let branch = 'main';
  let me = null;
  let db = null;
  let inboxItems = [];

  /* ---------- Утилиты ---------- */
  function toast(msg, err = false) {
    const t = $('#toast');
    t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), err ? 7000 : 4000);
  }
  function busy(msg) { const b = $('#busy'); b.textContent = msg || ''; b.hidden = !msg; }

  async function gh(path, { method = 'GET', body, raw } = {}) {
    const r = await fetch(API + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    if (raw) return r;
    if (!r.ok) {
      let m = r.statusText;
      try { m = (await r.json()).message || m; } catch { /* ignore */ }
      const e = new Error(`GitHub: ${m} (${r.status})`); e.status = r.status; throw e;
    }
    return r.status === 204 ? null : r.json();
  }

  const rawUrl = p => `https://raw.githubusercontent.com/${REPO.owner}/${REPO.repo}/${branch}/${p}`;
  const displaySrc = p => (/^https?:/.test(p) ? p : p ? rawUrl(p) : '');

  /* ---------- Работа с репозиторием ---------- */
  async function readJson(path, ref = branch, fallback) {
    try {
      const f = await gh(`${R}/contents/${path}?ref=${encodeURIComponent(ref)}`);
      return JSON.parse(b64decode(f.content));
    } catch (e) {
      if (e.status === 404 && fallback !== undefined) return fallback;
      throw e;
    }
  }
  const readDb = (ref = branch) => readJson(DB_PATH, ref);

  // Одна атомарная правка: читаем свежий JSON, меняем, коммитим вместе с файлами (фото).
  async function mutate(message, fn, files = [], path = DB_PATH) {
    const blobs = [];
    for (const f of files) {
      if (f.delete) blobs.push({ path: f.path, mode: '100644', type: 'blob', sha: null });
      else {
        const b = await gh(`${R}/git/blobs`, { method: 'POST', body: { content: f.base64, encoding: 'base64' } });
        blobs.push({ path: f.path, mode: '100644', type: 'blob', sha: b.sha });
      }
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const ref = await gh(`${R}/git/ref/heads/${branch}`);
      const head = ref.object.sha;
      const commit = await gh(`${R}/git/commits/${head}`);
      const fresh = await readJson(path, head, path === DB_PATH ? undefined : {});
      fn(fresh);
      const dbBlob = await gh(`${R}/git/blobs`, { method: 'POST', body: { content: b64encode(JSON.stringify(fresh, null, 2) + '\n'), encoding: 'base64' } });
      const tree = await gh(`${R}/git/trees`, { method: 'POST', body: { base_tree: commit.tree.sha, tree: [...blobs, { path, mode: '100644', type: 'blob', sha: dbBlob.sha }] } });
      const c = await gh(`${R}/git/commits`, { method: 'POST', body: { message: `${message}\n\nadmin: ${me.as || me.login}`, tree: tree.sha, parents: [head] } });
      try {
        await gh(`${R}/git/refs/heads/${branch}`, { method: 'PATCH', body: { sha: c.sha } });
        if (path === DB_PATH) db = fresh;
        return fresh;
      } catch (e) {
        if (e.status !== 422 || attempt === 2) throw e; // кто-то сохранил одновременно — повторяем
      }
    }
  }

  async function fileToJpegB64(blob, max = 1600) {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const out = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.85));
    const dataUrl = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(out); });
    return dataUrl;
  }

  function newId(l) {
    const slug = `${l.brand}-${l.model}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'car';
    return `${slug}-${l.year || ''}-${Math.random().toString(36).slice(2, 6)}`;
  }

  /* ---------- Обсуждения (GitHub Issues) ---------- */
  async function syncDiscussion(l, before) {
    const want = l.comments !== false;
    if (want && !l.issue) {
      const is = await gh(`${R}/issues`, { method: 'POST', body: {
        title: `Обсуждение: ${title(l)}, ${l.year}`,
        body: `Обсуждение объявления на Авторынке: ${siteUrl}#/car/${l.id}\n\nВопросы продавцу и комментарии пишите ниже. Будьте вежливы.`,
      } });
      return is.number;
    }
    if (l.issue && before && (before.comments !== false) !== want) {
      if (want) await gh(`${R}/issues/${l.issue}/lock`, { method: 'DELETE' }).catch(() => {});
      else await gh(`${R}/issues/${l.issue}/lock`, { method: 'PUT', body: { lock_reason: 'resolved' } }).catch(() => {});
    }
    return l.issue || null;
  }
  async function closeDiscussion(issue) {
    if (!issue) return;
    await gh(`${R}/issues/${issue}`, { method: 'PATCH', body: { state: 'closed', state_reason: 'completed' } }).catch(() => {});
    await gh(`${R}/issues/${issue}/lock`, { method: 'PUT', body: { lock_reason: 'resolved' } }).catch(() => {});
  }

  /* ---------- Вход ---------- */
  $('#repoName').textContent = `${REPO.owner}/${REPO.repo}`;
  $('#repoLink').href = `https://github.com/${REPO.owner}/${REPO.repo}`;

  async function login(as) {
    me = await gh('/user');
    const repo = await gh(R);
    if (!repo.permissions?.push) throw new Error(`У пользователя ${me.login} нет прав записи в ${REPO.owner}/${REPO.repo}`);
    branch = repo.default_branch;
    me.isAdmin = !!repo.permissions.admin;
    me.as = as || sessionStorage.getItem('ar:as') || store.get('ar:as', '') || '';
    $('#who').innerHTML = me.as
      ? `<span class="avatar" style="width:30px;height:30px;font-size:.9rem">${esc(me.as[0].toUpperCase())}</span><span>${esc(me.as)}</span>`
      : `<img src="${esc(me.avatar_url)}&s=56" width="28" height="28" alt=""><span>${esc(me.name || me.login)}</span>`;
    $('#login').hidden = true;
    $('#app').hidden = false;
    await reload();
    loadInbox();
    loadAdmins();
    loadAccounts();
  }

  /* ---------- Логин и пароль: пароль расшифровывает токен GitHub ---------- */
  const ACC_PATH = 'data/admins.json';
  const PBKDF2_ITER = 600000;
  const u8 = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const b64u8 = a => btoa(String.fromCharCode(...a));
  async function pwKey(password, salt, iter) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function sealToken(tok, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await pwKey(password, salt, PBKDF2_ITER), new TextEncoder().encode(tok));
    return { v: 1, kdf: 'PBKDF2-SHA256', iter: PBKDF2_ITER, salt: b64u8(salt), iv: b64u8(iv), ct: b64u8(new Uint8Array(ct)) };
  }
  async function openToken(rec, password) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u8(rec.iv) }, await pwKey(password, u8(rec.salt), rec.iter), u8(rec.ct));
    return new TextDecoder().decode(pt);
  }
  async function fetchAccounts() {
    // свежая копия из API (без кеша Pages); при лимите — с сайта
    try {
      const r = await fetch(`${API}${R}/contents/${ACC_PATH}?ref=${branch}`, { headers: { Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' });
      if (r.ok) return await r.json();
    } catch { /* сеть */ }
    const r = await fetch(`${ACC_PATH}?t=${Date.now()}`, { cache: 'no-store' });
    return r.ok ? r.json() : {};
  }

  $('#pwForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#pwLogin').value.trim().toLowerCase();
    const pass = $('#pwPass').value;
    $('#pwError').textContent = '';
    busy('Проверяю…');
    try {
      const rec = (await fetchAccounts()).accounts?.[name];
      let tok;
      try { if (!rec) throw 0; tok = await openToken(rec, pass); }
      catch { throw new Error('Неверный логин или пароль'); }
      token = tok;
      sessionStorage.setItem('ar:as', name);
      if ($('#pwRemember').checked) store.set('ar:as', name);
      await login(name);
      sessionStorage.setItem('ar:token', token);
      if ($('#pwRemember').checked) store.set('ar:token', token);
    } catch (err) {
      token = '';
      $('#pwError').textContent = err.status === 401 ? 'Ключ доступа этой учётной записи отозван или истёк — владельцу нужно задать его заново.' : err.message;
    } finally { busy(); }
  });

  async function loadAccounts() {
    const acc = (await fetchAccounts()).accounts || {};
    const names = Object.keys(acc).sort();
    $('#accounts').innerHTML = names.length
      ? names.map(n => `<span><span class="avatar" style="width:24px;height:24px;font-size:.75rem">${esc(n[0].toUpperCase())}</span>${esc(n)} <small class="muted">${acc[n].updated ? fmtDate(acc[n].updated) : ''}</small> <button type="button" class="link" data-acc-del="${esc(n)}" aria-label="Удалить ${esc(n)}">✕</button></span>`).join('')
      : '<p class="muted small">Учётных записей пока нет.</p>';
  }
  $('#accForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#accLogin').value.trim().toLowerCase();
    const p1 = $('#accPass').value, p2 = $('#accPass2').value;
    const tok = $('#accToken').value.trim() || token;
    if (!/^[a-z0-9_.-]{2,32}$/.test(name)) return toast('Логин: 2–32 символа, латиница, цифры, _ . -', true);
    if (p1.length < 10) return toast('Пароль должен быть не короче 10 символов', true);
    if (p1 !== p2) return toast('Пароли не совпадают', true);
    busy('Шифрую и сохраняю…');
    try {
      if (tok !== token) { // проверяем, что новый токен рабочий
        const r = await fetch(API + R, { headers: { Authorization: `Bearer ${tok}` } });
        const j = r.ok ? await r.json() : null;
        if (!j?.permissions?.push) throw new Error('Указанный токен не даёт права записи в репозиторий');
      }
      const rec = { ...(await sealToken(tok, p1)), updated: new Date().toISOString() };
      await mutate(`Учётная запись ${name}: задан пароль`, d => { d.accounts ||= {}; d.accounts[name] = rec; }, [], ACC_PATH);
      e.target.reset();
      await loadAccounts();
      toast(`Готово: вход «${name}» с паролем работает.`);
    } catch (err) { toast(err.message, true); } finally { busy(); }
  });
  $('#accounts').addEventListener('click', async e => {
    const b = e.target.closest('[data-acc-del]'); if (!b) return;
    const name = b.dataset.accDel;
    if (!confirm(`Удалить вход «${name}»? Токен GitHub при этом не отзывается — при необходимости отзовите его в настройках GitHub.`)) return;
    busy('Удаляю…');
    try {
      await mutate(`Учётная запись ${name} удалена`, d => { if (d.accounts) delete d.accounts[name]; }, [], ACC_PATH);
      await loadAccounts(); toast('Учётная запись удалена.');
    } catch (err) { toast(err.message, true); } finally { busy(); }
  });

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    token = $('#token').value.trim();
    $('#loginError').textContent = '';
    busy('Проверяю доступ…');
    try {
      ['ar:as'].forEach(k => { sessionStorage.removeItem(k); store.del(k); });
      await login('');
      sessionStorage.setItem('ar:token', token);
      if ($('#remember').checked) store.set('ar:token', token);
    } catch (err) {
      $('#loginError').textContent = err.status === 401 ? 'Токен не подходит или истёк.' : err.message;
    } finally { busy(); }
  });
  $('#logout').addEventListener('click', () => {
    ['ar:token', 'ar:as'].forEach(k => { sessionStorage.removeItem(k); store.del(k); }); location.reload();
  });

  (async () => {
    if (!token) { $('#login').hidden = false; return; }
    busy('Вход…');
    try { await login(); } catch (e) { $('#login').hidden = false; $('#loginError').textContent = e.message; }
    finally { busy(); }
  })();

  /* ---------- Вкладки ---------- */
  $$('[data-tab]').forEach(b => b.addEventListener('click', () => {
    $$('[data-tab]').forEach(x => x.setAttribute('aria-selected', x === b));
    $$('[data-panel]').forEach(p => (p.hidden = p.dataset.panel !== b.dataset.tab));
  }));

  /* ---------- Список объявлений ---------- */
  async function reload() {
    db = await readDb();
    db.settings ||= {};
    $('#globalComments').checked = db.settings.comments !== false;
    $('#defaultComments').checked = db.settings.defaultComments !== false;
    renderRows();
  }

  function renderRows() {
    const q = $('#search').value.toLowerCase();
    const st = $('#statusFilter').value;
    const list = db.listings.filter(l => (!st || l.status === st) && (!q || `${l.brand} ${l.model} ${l.city} ${l.seller} ${l.id}`.toLowerCase().includes(q)));
    $('#rows').innerHTML = list.map(l => `
      <div class="row" data-id="${esc(l.id)}">
        <img src="${esc(displaySrc(l.photos?.[0]) || carPlaceholder(l.id))}" alt="" loading="lazy">
        <div>
          <h3>${esc(title(l))}, ${esc(l.year)}${l.comments !== false && db.settings.comments !== false ? '<span class="pill pill--on">обсуждение</span>' : ''}</h3>
          <p>${fmtPrice(l.price)} · ${fmtNum(l.mileage)} км · ${esc(l.city)} · ${(l.photos || []).length} фото · ${fmtDate(l.updated || l.created)}</p>
        </div>
        <div class="row__ctl">
          <select data-act="status" aria-label="Статус">${Object.entries(ENUMS.status).map(([k, v]) => `<option value="${k}" ${l.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
          <label class="switch" title="Обсуждение у объявления"><input type="checkbox" data-act="comments" ${l.comments !== false ? 'checked' : ''}> 💬</label>
          <a class="btn btn--ghost btn--sm" href="./#/car/${encodeURIComponent(l.id)}" target="_blank" rel="noopener">На сайте</a>
          <button class="btn btn--ghost btn--sm" data-act="edit">Изменить</button>
        </div>
      </div>`).join('') || '<p class="empty">Объявлений нет.</p>';
  }
  $('#search').addEventListener('input', renderRows);
  $('#statusFilter').addEventListener('change', renderRows);

  $('#rows').addEventListener('click', e => {
    const b = e.target.closest('[data-act="edit"]'); if (!b) return;
    openEditor(db.listings.find(l => l.id === b.closest('.row').dataset.id));
  });
  $('#rows').addEventListener('change', async e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const id = el.closest('.row').dataset.id;
    const before = db.listings.find(l => l.id === id);
    busy('Сохраняю…');
    try {
      if (el.dataset.act === 'status') {
        await mutate(`Статус: ${title(before)} → ${ENUMS.status[el.value]}`, d => {
          const l = d.listings.find(x => x.id === id); if (l) { l.status = el.value; l.updated = new Date().toISOString(); }
        });
      } else {
        const on = el.checked;
        const issue = await syncDiscussion({ ...before, comments: on }, before);
        await mutate(`Обсуждение ${on ? 'включено' : 'выключено'}: ${title(before)}`, d => {
          const l = d.listings.find(x => x.id === id); if (l) { l.comments = on; l.issue = issue; }
        });
      }
      renderRows();
      toast('Сохранено. На сайте обновится через 1–2 минуты.');
    } catch (err) { toast(err.message, true); renderRows(); } finally { busy(); }
  });

  /* ---------- Редактор ---------- */
  const ed = $('#editor');
  const ef = $('#editForm');
  const fillSel = (name, items, empty) => (ef.elements[name].innerHTML = (empty ? '<option value="">—</option>' : '') + items.map(v => `<option>${esc(v)}</option>`).join(''));
  fillSel('transmission', ENUMS.transmission, true); fillSel('fuel', ENUMS.fuel, true); fillSel('body', ENUMS.body, true); fillSel('drive', ENUMS.drive, true);
  $('#brandList').innerHTML = BRANDS.map(b => `<option value="${esc(b)}">`).join('');
  $('#cityList').innerHTML = CITIES.map(b => `<option value="${esc(b)}">`).join('');

  let cur = null; // { orig, photos: [{value, src, dataUrl?, external?}], fromIssue }

  function openEditor(l, fromIssue = null) {
    const isNew = !l || !l.id || !db.listings.some(x => x.id === l.id);
    cur = { orig: isNew ? null : l, fromIssue, photos: (l?.photos || []).map(p => ({ value: p, src: displaySrc(p), external: /^https?:/.test(p) })) };
    if (fromIssue) cur.photos.forEach(p => (p.tryImport = true));
    cur.spin = { orig: !isNew && hasSpin(l) ? l.spin : null, frames: null, removed: false };
    renderSpin();
    ef.reset();
    const v = l || { status: 'active', comments: db.settings.defaultComments !== false };
    for (const el of ef.elements) {
      if (!el.name) continue;
      if (el.type === 'checkbox') el.checked = el.name === 'comments' ? v.comments !== false : !!v[el.name];
      else el.value = v[el.name] ?? '';
    }
    if (!v.status) ef.elements.status.value = 'active';
    $('#editTitle').textContent = isNew ? (fromIssue ? `Заявка #${fromIssue.number}` : 'Новое объявление') : `${title(l)}, ${l.year}`;
    $('#deleteBtn').hidden = isNew;
    $('#editError').textContent = '';
    $$('.invalid', ef).forEach(x => x.classList.remove('invalid'));
    renderPhotos();
    ed.showModal();
    ed.scrollTop = 0;
  }
  $('#addBtn').addEventListener('click', () => openEditor(null));
  $$('[data-close]', ed).forEach(b => b.addEventListener('click', () => ed.close()));

  function renderPhotos() {
    $('#photos').innerHTML = cur.photos.map((p, i) => `
      <div class="ph">
        <img src="${esc(p.dataUrl || p.src)}" alt="Фото ${i + 1}" onerror="this.style.opacity=.2">
        ${i === 0 ? '<span class="ph__main">обложка</span>' : ''}${p.dataUrl ? '<span class="ph__new">новое</span>' : ''}
        <div class="ph__ctl">
          <span><button type="button" data-ph="left" data-i="${i}" aria-label="Левее">←</button> <button type="button" data-ph="right" data-i="${i}" aria-label="Правее">→</button></span>
          <button type="button" data-ph="del" data-i="${i}" aria-label="Удалить фото">✕</button>
        </div>
      </div>`).join('') + `<label class="drop" id="drop">+ Добавить фото<br>JPG, PNG, HEIC*<input type="file" id="fileIn" accept="image/*" multiple></label>`;
  }
  $('#photos').addEventListener('click', e => {
    const b = e.target.closest('[data-ph]'); if (!b) return;
    const i = +b.dataset.i, a = cur.photos;
    if (b.dataset.ph === 'del') a.splice(i, 1);
    if (b.dataset.ph === 'left' && i > 0) [a[i - 1], a[i]] = [a[i], a[i - 1]];
    if (b.dataset.ph === 'right' && i < a.length - 1) [a[i + 1], a[i]] = [a[i], a[i + 1]];
    renderPhotos();
  });
  async function addFiles(files) {
    busy('Обрабатываю фото…');
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      try { cur.photos.push({ dataUrl: await fileToJpegB64(f) }); }
      catch { toast(`Не удалось прочитать ${f.name} — сохраните фото как JPG`, true); }
    }
    busy(); renderPhotos();
  }
  $('#photos').addEventListener('change', e => { if (e.target.id === 'fileIn') addFiles([...e.target.files]); });
  ['dragover', 'dragenter'].forEach(t => $('#photos').addEventListener(t, e => { e.preventDefault(); $('#drop')?.classList.add('over'); }));
  $('#photos').addEventListener('dragleave', () => $('#drop')?.classList.remove('over'));
  $('#photos').addEventListener('drop', e => { e.preventDefault(); addFiles([...e.dataTransfer.files]); });
  $('#photoUrl').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const u = safeUrl(e.target.value);
    if (/^https?:/.test(u)) { cur.photos.push({ value: u, src: u, external: true }); e.target.value = ''; renderPhotos(); }
  });

  /* ---------- Обзор 360° ---------- */
  let spinView = null;
  const pad2 = n => String(n).padStart(2, '0');
  const spinRepoFiles = s => (s?.dir && !/^https?:/.test(s.dir) ? spinFrames(s).flat() : []);
  function renderSpin() {
    spinView?.destroy(); spinView = null;
    const sp = cur.spin, box = $('#spinPrev');
    box.replaceWith(box.cloneNode(false)); // чистый элемент без старых обработчиков
    const el = $('#spinPrev');
    let spec = null, info = '';
    if (sp.frames) { spec = { frames: [sp.frames] }; info = `Новый обзор: ${sp.frames.length} кадров — сохранится вместе с объявлением.`; }
    else if (sp.orig && !sp.removed) {
      spec = { ...sp.orig, frames: spinFrames(sp.orig).map(r => r.map(displaySrc)) };
      info = `Обзор: ${sp.orig.cols} кадров${(sp.orig.rows || 1) > 1 ? ` × ${sp.orig.rows} ряда` : ''}.`;
    } else if (sp.removed) info = 'Обзор будет удалён при сохранении.';
    el.hidden = !spec;
    if (spec) spinView = mountSpin(el, spec, { intro: false });
    $('#spinInfo').textContent = info;
    $('#spinDel').hidden = !spec;
  }
  ed.addEventListener('close', () => { spinView?.destroy(); spinView = null; });

  async function videoFrames(file, n, max = 1280) {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = URL.createObjectURL(file);
    try {
      await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('Браузер не может прочитать это видео. Попробуйте MP4 (H.264) или другой браузер.')); });
      const d = v.duration;
      if (!isFinite(d) || d <= 0) throw new Error('Не удалось определить длину видео');
      const k = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
      const c = document.createElement('canvas'); c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
      const ctx = c.getContext('2d'), out = [];
      for (let i = 0; i < n; i++) {
        await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('Видео перематывается слишком медленно')), 8000); v.onseeked = () => { clearTimeout(t); res(); }; v.currentTime = Math.min(d - 0.05, d * i / n); });
        ctx.drawImage(v, 0, 0, c.width, c.height);
        out.push(c.toDataURL('image/jpeg', 0.82));
        busy(`Кадры из видео: ${i + 1} / ${n}`);
      }
      return out;
    } finally { URL.revokeObjectURL(v.src); }
  }
  $('#spinVideo').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    busy('Читаю видео…');
    try { cur.spin.frames = await videoFrames(f, +$('#spinCount').value); renderSpin(); }
    catch (err) { toast(err.message, true); } finally { busy(); }
  });
  $('#spinPhotos').addEventListener('change', async e => {
    const files = [...e.target.files].filter(f => f.type.startsWith('image/'))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })); e.target.value = '';
    if (files.length < 8) { if (files.length) toast('Для обзора нужно хотя бы 8 фото по кругу', true); return; }
    try {
      const out = [];
      for (const [i, f] of files.entries()) { busy(`Обрабатываю кадры: ${i + 1} / ${files.length}`); out.push(await fileToJpegB64(f, 1280)); }
      cur.spin.frames = out; renderSpin();
    } catch { toast('Не удалось прочитать часть фото — сохраните их как JPG', true); } finally { busy(); }
  });
  $('#spinDel').addEventListener('click', () => { cur.spin.frames = null; cur.spin.removed = !!cur.spin.orig; renderSpin(); });

  function readEditor() {
    const d = Object.fromEntries(new FormData(ef));
    const num = k => (d[k] === '' || d[k] == null ? undefined : Number(d[k]));
    const l = {
      brand: d.brand.trim(), model: d.model.trim(), year: num('year'), price: num('price'), mileage: num('mileage'),
      transmission: d.transmission, fuel: d.fuel, body: d.body, engine: num('engine'), power: num('power'),
      drive: d.drive || undefined, wheel: d.wheel || undefined, color: d.color.trim() || undefined, owners: num('owners'),
      condition: d.condition || undefined, vin: d.vin.trim().toUpperCase() || undefined,
      city: d.city.trim(), seller: d.seller.trim(), contact: d.contact.trim(), status: d.status,
      description: d.description.trim(), comments: ef.elements.comments.checked,
    };
    Object.keys(l).forEach(k => l[k] === undefined && delete l[k]);
    return l;
  }

  ef.addEventListener('submit', async e => {
    e.preventDefault();
    const bad = [...ef.elements].filter(el => el.willValidate && !el.checkValidity());
    $$('.invalid', ef).forEach(x => x.classList.remove('invalid'));
    bad.forEach(x => x.classList.add('invalid'));
    if (bad.length) { $('#editError').textContent = 'Заполните обязательные поля'; bad[0].focus(); return; }

    const data = readEditor();
    const orig = cur.orig;
    const id = orig?.id || newId(data);
    const now = new Date().toISOString();
    busy('Сохраняю…');
    try {
      // Фото из заявки пробуем перенести в репозиторий (если источник разрешает CORS)
      for (const p of cur.photos) {
        if (!p.tryImport) continue;
        try { const r = await fetch(p.value); if (r.ok) { p.dataUrl = await fileToJpegB64(await r.blob()); } } catch { /* останется ссылкой */ }
      }
      const files = [];
      const stamp = Date.now().toString(36);
      const photos = cur.photos.map((p, i) => {
        if (p.dataUrl) {
          const path = `photos/${id}/${stamp}-${i}.jpg`;
          files.push({ path, base64: p.dataUrl.split(',')[1] });
          return path;
        }
        return p.value;
      });
      // удалённые фото, лежавшие в репозитории
      (orig?.photos || []).filter(p => !/^https?:/.test(p) && !photos.includes(p)).forEach(p => files.push({ path: p, delete: true }));

      const listing = { id, ...data, photos, created: orig?.created || now, updated: now, issue: orig?.issue || null };
      if (orig?.credits) listing.credits = orig.credits.filter(c => photos.includes(c.file));
      // обзор 360°: новые кадры кладём в свою папку, старые удаляем
      const sp = cur.spin;
      if (sp.frames) {
        const dir = `photos/${id}/360-${stamp}`;
        sp.frames.forEach((d, c) => files.push({ path: `${dir}/0-${pad2(c)}.jpg`, base64: d.split(',')[1] }));
        listing.spin = { dir, cols: sp.frames.length, rows: 1 };
      } else if (sp.orig && !sp.removed) listing.spin = sp.orig;
      if (sp.orig && (sp.frames || sp.removed)) spinRepoFiles(sp.orig).forEach(path => files.push({ path, delete: true }));
      busy('Обсуждение…');
      listing.issue = await syncDiscussion(listing, orig || { comments: true });
      busy(`Публикую${files.length ? ` (${files.filter(f => !f.delete).length} фото)` : ''}…`);
      await mutate(`${orig ? 'Изменено' : 'Добавлено'}: ${title(listing)}, ${listing.year}`, d => {
        const i = d.listings.findIndex(x => x.id === id);
        if (i >= 0) d.listings[i] = listing; else d.listings.unshift(listing);
      }, files);
      if (cur.fromIssue) {
        await gh(`${R}/issues/${cur.fromIssue.number}/comments`, { method: 'POST', body: { body: `✅ Объявление опубликовано: ${siteUrl}#/car/${id}` } });
        await gh(`${R}/issues/${cur.fromIssue.number}`, { method: 'PATCH', body: { state: 'closed', state_reason: 'completed' } });
        loadInbox();
      }
      ed.close();
      renderRows();
      toast('Опубликовано. На сайте появится через 1–2 минуты.');
    } catch (err) {
      $('#editError').textContent = err.message;
    } finally { busy(); }
  });

  $('#deleteBtn').addEventListener('click', async () => {
    const l = cur.orig;
    if (!l || !confirm(`Удалить «${title(l)}, ${l.year}» вместе с фото? Это нельзя отменить.`)) return;
    busy('Удаляю…');
    try {
      const files = [...(l.photos || []).filter(p => !/^https?:/.test(p)), ...spinRepoFiles(l.spin)].map(p => ({ path: p, delete: true }));
      await mutate(`Удалено: ${title(l)}, ${l.year}`, d => { d.listings = d.listings.filter(x => x.id !== l.id); }, files);
      await closeDiscussion(l.issue);
      ed.close(); renderRows(); toast('Объявление удалено.');
    } catch (err) { $('#editError').textContent = err.message; } finally { busy(); }
  });

  /* ---------- Заявки ---------- */
  function parseIssue(is) {
    const body = is.body || '';
    let data = {};
    const m = body.match(/```json\s*([\s\S]*?)```/);
    if (m) { try { data = JSON.parse(m[1]); } catch { /* битый JSON */ } }
    const imgs = new Set((data.photos || []).map(safeUrl).filter(Boolean));
    for (const x of body.matchAll(/!\[[^\]]*]\((https?:[^)\s]+)\)|<img[^>]+src="(https?:[^"]+)"/g)) imgs.add(x[1] || x[2]);
    for (const x of body.matchAll(/https:\/\/github\.com\/user-attachments\/assets\/[\w-]+/g)) imgs.add(x[0]);
    const pick = (k, list) => (list.includes(data[k]) ? data[k] : '');
    return {
      brand: data.brand || '', model: data.model || '', year: data.year, mileage: data.mileage, price: data.price,
      transmission: pick('transmission', ENUMS.transmission), fuel: pick('fuel', ENUMS.fuel), body: pick('body', ENUMS.body),
      engine: data.engine, power: data.power, drive: pick('drive', ENUMS.drive), color: data.color, city: data.city,
      description: data.description || body.replace(/```json[\s\S]*?```/, '').trim(),
      seller: data.seller, contact: data.contact, photos: [...imgs], status: 'active',
      comments: db.settings.defaultComments !== false,
    };
  }

  async function loadInbox() {
    try {
      const list = await gh(`${R}/issues?state=open&per_page=100&sort=created&direction=desc`);
      inboxItems = list.filter(i => !i.pull_request && /^\[Объявление]/.test(i.title));
      $('#inboxCount').textContent = inboxItems.length;
      $('#inbox').innerHTML = inboxItems.map(is => {
        const p = parseIssue(is);
        return `<div class="row" data-n="${is.number}">
          <img src="${esc(p.photos[0] || carPlaceholder(is.number))}" alt="" loading="lazy">
          <div><h3>${esc(is.title.replace(/^\[Объявление]\s*/, ''))}</h3>
            <p>от ${esc(is.user.login)} · ${fmtDate(is.created_at)} · ${p.photos.length} фото · ${esc(p.city || '')}</p></div>
          <div class="row__ctl">
            <a class="btn btn--ghost btn--sm" href="${esc(is.html_url)}" target="_blank" rel="noopener">На GitHub</a>
            <button class="btn btn--ghost btn--sm" data-inbox="reject">Отклонить</button>
            <button class="btn btn--accent btn--sm" data-inbox="open">В редактор</button>
          </div></div>`;
      }).join('') || '<p class="empty">Новых заявок нет.</p>';
    } catch (e) { $('#inbox').innerHTML = `<p class="empty">${esc(e.message)}</p>`; }
  }
  $('#inbox').addEventListener('click', async e => {
    const b = e.target.closest('[data-inbox]'); if (!b) return;
    const is = inboxItems.find(i => i.number === +b.closest('.row').dataset.n);
    if (b.dataset.inbox === 'open') return openEditor(parseIssue(is), is);
    const reason = prompt('Причина отказа (увидит автор заявки):', 'Объявление не соответствует правилам площадки.');
    if (reason == null) return;
    busy('Отклоняю…');
    try {
      await gh(`${R}/issues/${is.number}/comments`, { method: 'POST', body: { body: `❌ Заявка отклонена. ${reason}` } });
      await gh(`${R}/issues/${is.number}`, { method: 'PATCH', body: { state: 'closed', state_reason: 'not_planned' } });
      await loadInbox(); toast('Заявка отклонена.');
    } catch (err) { toast(err.message, true); } finally { busy(); }
  });

  /* ---------- Настройки ---------- */
  async function saveSetting(key, val, label) {
    busy('Сохраняю…');
    try {
      await mutate(label, d => { d.settings ||= {}; d.settings[key] = val; });
      renderRows(); toast('Сохранено. На сайте обновится через 1–2 минуты.');
    } catch (err) { toast(err.message, true); } finally { busy(); }
  }
  $('#globalComments').addEventListener('change', e => saveSetting('comments', e.target.checked, `Обсуждения на сайте ${e.target.checked ? 'включены' : 'выключены'}`));
  $('#defaultComments').addEventListener('change', e => saveSetting('defaultComments', e.target.checked, 'Настройка обсуждений для новых объявлений'));

  async function loadAdmins() {
    try {
      const list = await gh(`${R}/collaborators?per_page=100`);
      $('#admins').innerHTML = list.filter(u => u.permissions?.push).map(u => `<span><img src="${esc(u.avatar_url)}&s=48" width="24" height="24" alt="">${esc(u.login)}</span>`).join('');
    } catch { $('#admins').innerHTML = '<p class="muted small">Список доступен только владельцу репозитория.</p>'; }
    $('#inviteForm').hidden = !me.isAdmin;
  }
  $('#inviteForm').addEventListener('submit', async e => {
    e.preventDefault();
    const login = $('#inviteLogin').value.trim();
    if (!/^[A-Za-z0-9-]{1,39}$/.test(login)) return toast('Некорректный логин GitHub', true);
    busy('Отправляю приглашение…');
    try {
      const r = await gh(`${R}/collaborators/${login}`, { method: 'PUT', body: { permission: 'push' } });
      toast(r ? `Приглашение отправлено ${login}. Ему нужно принять его на GitHub.` : `${login} уже администратор.`);
      $('#inviteLogin').value = '';
      loadAdmins();
    } catch (err) { toast(err.status === 404 ? 'Пользователь не найден или у токена нет права Administration' : err.message, true); } finally { busy(); }
  });
})();
