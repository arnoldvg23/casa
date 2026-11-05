import { addPurchase, dueProducts, formatInterval, snoozeUntil } from './habits.js';
import { CATALOG, CATEGORIES, categoryById, categoryFor, iconFor, normalize, parseEntry } from './products.js';
import { ICONS, escapeHtml } from './ui.js';

const ALL = 'tot';

export function mountShopping(root, { store, profile, toast }) {
  let items = [];
  let history = [];
  let flashId = null;
  let editingId = null;
  let filter = ALL;

  root.innerHTML = `
    <section class="stats" id="stats" aria-label="Resum de la compra"></section>
    <div class="composer-wrap">
      <form class="composer" id="composer">
        <input id="entry" type="text" aria-label="Afegeix a la llista" placeholder="Afegeix, per exemple 2 kg tomàquets"
          autocomplete="off" autocapitalize="sentences" enterkeyhint="done" maxlength="80">
        <button class="add-btn" type="submit" aria-label="Afegeix">${ICONS.plus}</button>
        <div class="suggest-list" id="suggestions" hidden></div>
      </form>
      <div class="chips" id="filters" hidden></div>
    </div>
    <section class="due" id="due" aria-label="Potser et falta" hidden></section>
    <div id="list"></div>
    <dialog class="sheet" id="editor">
      <form class="sheet-body" method="dialog" id="editor-form">
        <div class="sheet-head">
          <span class="item-icon" id="editor-icon"></span>
          <h2>Edita el producte</h2>
        </div>
        <label class="field"><span>Nom</span><input name="name" required maxlength="80" autocomplete="off"></label>
        <label class="field"><span>Quantitat</span><input name="qty" maxlength="20" autocomplete="off"></label>
        <label class="field"><span>Secció</span>
          <select name="category">
            ${CATEGORIES.map((c) => `<option value="${c.id}">${c.label}</option>`).join('')}
          </select>
        </label>
        <button class="btn" type="submit">Desa</button>
        <button class="btn danger" type="button" id="editor-delete">Elimina de la llista</button>
      </form>
    </dialog>`;

  const stats = root.querySelector('#stats');
  const entry = root.querySelector('#entry');
  const suggestions = root.querySelector('#suggestions');
  const filters = root.querySelector('#filters');
  const due = root.querySelector('#due');
  const list = root.querySelector('#list');
  const editor = root.querySelector('#editor');
  const editorForm = root.querySelector('#editor-form');

  const pending = () => items.filter((i) => !i.done);
  const bought = () => items.filter((i) => i.done);

  function iconTile(name, categoryId) {
    const { color } = categoryById(categoryId);
    return `<span class="item-icon" style="--c:${color}">${iconFor(name, categoryId)}</span>`;
  }

  function itemHtml(item) {
    const meta = [
      item.qty ? `<b>${escapeHtml(item.qty)}</b>` : '',
      item.addedBy && item.addedBy !== profile.name ? escapeHtml(item.addedBy) : '',
    ].filter(Boolean).join(' · ');
    const action = item.done ? 'Torna a la llista' : 'Marca com a comprat';
    return `
      <li class="item${item.done ? ' done' : ''}${item.id === flashId ? ' flash' : ''}" data-id="${escapeHtml(item.id)}">
        <button class="item-body" type="button" aria-label="Edita ${escapeHtml(item.name)}">
          ${iconTile(item.name, item.category)}
          <span class="item-text">
            <span class="item-name">${escapeHtml(item.name)}</span>
            ${meta ? `<span class="item-meta">${meta}</span>` : ''}
          </span>
        </button>
        <button class="check" type="button" aria-pressed="${Boolean(item.done)}" aria-label="${action}: ${escapeHtml(item.name)}"><span>${ICONS.check}</span></button>
      </li>`;
  }

  function renderStats(toBuy, inBasket) {
    stats.innerHTML = `
      <div class="stat stat-main">
        <span class="stat-label">Per comprar</span>
        <strong>${toBuy}</strong>
        ${ICONS.basket}
      </div>
      <div class="stat">
        <span class="stat-label">Al carro</span>
        <strong>${inBasket}<small> de ${toBuy + inBasket}</small></strong>
        ${ICONS.cart}
      </div>`;
  }

  function renderFilters(present) {
    if (filter !== ALL && !present.some((c) => c.id === filter)) filter = ALL;
    filters.hidden = present.length < 2;
    const chips = [{ id: ALL, label: 'Tot' }, ...present];
    filters.innerHTML = chips
      .map((c) => `<button class="chip${c.id === filter ? ' active' : ''}" type="button" data-filter="${c.id}" aria-pressed="${c.id === filter}">${c.label}</button>`)
      .join('');
  }

  function renderDue(toBuy) {
    const products = filter === ALL ? dueProducts(history, new Set(toBuy.map((i) => normalize(i.name)))) : [];
    due.hidden = !products.length;
    due.innerHTML = `
      <h2 class="group-title">Potser et falta</h2>
      <div class="due-row">
        ${products.map((p) => `
          <article class="due-card" data-name="${escapeHtml(p.name)}">
            <button class="due-dismiss" type="button" aria-label="Ara no: ${escapeHtml(p.name)}">${ICONS.close}</button>
            ${iconTile(p.name, p.category)}
            <span class="item-name">${escapeHtml(p.name)}</span>
            <span class="due-foot">
              <span class="item-meta">${formatInterval(p.interval)}</span>
              <button class="due-add" type="button" aria-label="Afegeix ${escapeHtml(p.name)}">${ICONS.plus}</button>
            </span>
          </article>`).join('')}
      </div>`;
  }

  function render() {
    const toBuy = pending();
    const inBasket = bought().sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
    const present = CATEGORIES.filter((c) => toBuy.some((i) => categoryById(i.category).id === c.id));

    renderStats(toBuy.length, inBasket.length);
    renderFilters(present);
    renderDue(toBuy);

    const groups = present
      .filter((c) => filter === ALL || c.id === filter)
      .map((category) => {
        const rows = toBuy
          .filter((i) => categoryById(i.category).id === category.id)
          .sort((a, b) => a.createdAt - b.createdAt);
        return `
          <section class="group">
            <h2 class="group-title">${category.label}</h2>
            <ul class="list">${rows.map(itemHtml).join('')}</ul>
          </section>`;
      }).join('');

    const basket = inBasket.length
      ? `<section class="group">
          <div class="group-head">
            <h2 class="group-title">Al carro</h2>
            <button class="link-btn" type="button" id="finish">Acaba la compra</button>
          </div>
          <ul class="list">${inBasket.map(itemHtml).join('')}</ul>
        </section>`
      : '';

    const empty = !items.length
      ? `<div class="empty">
          ${ICONS.basket}
          <strong>No falta res</strong>
          <p>El que afegeixis aquí ho veurà tota la família.</p>
          <button class="btn" type="button" id="first-add">Afegeix un producte</button>
        </div>`
      : '';

    list.innerHTML = groups + basket + empty;
    flashId = null;
  }

  function renderSuggestions() {
    // Es busca pel nom: amb «2 kg tom» la quantitat no ha d'afectar el resultat.
    const query = normalize(parseEntry(entry.value).name);
    const onList = new Set(pending().map((i) => normalize(i.name)));
    const seen = new Set();
    const frequent = [...history].sort((a, b) => b.count - a.count || b.lastAt - a.lastAt);
    const habitual = new Set(history.filter((h) => h.count > 1).map((h) => normalize(h.name)));
    const rank = (key) => {
      if (key.startsWith(query)) return 0;
      return key.includes(` ${query}`) ? 1 : 2;
    };

    // Amb el camp buit només es proposa el que ja compreu, no tot el catàleg.
    const matches = (query ? [...frequent, ...CATALOG] : frequent)
      .map((p) => ({ name: p.name, category: p.category, key: normalize(p.name) }))
      .filter(({ key }) => {
        if (seen.has(key) || onList.has(key) || !key.includes(query)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => rank(a.key) - rank(b.key));

    suggestions.innerHTML = matches
      .map((m) => `
        <button class="suggest-row" type="button" data-name="${escapeHtml(m.name)}">
          ${iconTile(m.name, m.category)}
          <span class="item-text">
            <span class="item-name">${escapeHtml(m.name)}</span>
            <span class="item-meta">${habitual.has(m.key) ? 'Habitual · ' : ''}${categoryById(m.category).label}</span>
          </span>
        </button>`)
      .join('');
    suggestions.scrollTop = 0;
    suggestions.hidden = !matches.length;
  }

  function addItem(name, qty) {
    if (!name) return;
    const existing = items.find((i) => normalize(i.name) === normalize(name));

    if (existing) {
      flashId = existing.id;
      if (existing.done) {
        store.update(existing.id, { done: false, doneAt: null, qty: qty || existing.qty });
        toast(`${existing.name} ha tornat a la llista`);
      } else if (qty && qty !== existing.qty) {
        store.update(existing.id, { qty });
        toast(`Quantitat actualitzada: ${existing.name}`);
      } else {
        toast(`${existing.name} ja era a la llista`);
        render();
      }
      return;
    }

    const category = categoryFor(name, history);
    const known = history.find((h) => normalize(h.name) === normalize(name));
    store.add({ name, qty, category, done: false, doneAt: null, addedBy: profile.name, createdAt: Date.now() });
    store.remember({ name, category, dates: addPurchase(known?.dates) });
  }

  function openEditor(item) {
    editingId = item.id;
    const tile = root.querySelector('#editor-icon');
    tile.textContent = iconFor(item.name, item.category);
    tile.style.setProperty('--c', categoryById(item.category).color);
    editorForm.elements.name.value = item.name;
    editorForm.elements.qty.value = item.qty ?? '';
    editorForm.elements.category.value = categoryById(item.category).id;
    editor.showModal();
  }

  function removeWithUndo(removed, message) {
    store.removeMany(removed);
    toast(message, { label: 'Desfés', run: () => store.restoreMany(removed) });
  }

  root.querySelector('#composer').addEventListener('submit', (event) => {
    event.preventDefault();
    const { name, qty } = parseEntry(entry.value);
    addItem(name, qty);
    entry.value = '';
    renderSuggestions();
    entry.focus();
  });

  entry.addEventListener('input', renderSuggestions);
  entry.addEventListener('focus', renderSuggestions);
  entry.addEventListener('blur', () => setTimeout(() => {
    if (document.activeElement !== entry) suggestions.hidden = true;
  }, 150));

  // Evita que el camp perdi el focus, per afegir diversos productes seguits sense tancar el teclat.
  suggestions.addEventListener('mousedown', (event) => event.preventDefault());
  suggestions.addEventListener('click', (event) => {
    const row = event.target.closest('.suggest-row');
    if (!row) return;
    addItem(row.dataset.name, parseEntry(entry.value).qty);
    entry.value = '';
    renderSuggestions();
    entry.focus();
  });

  due.addEventListener('click', (event) => {
    const card = event.target.closest('.due-card');
    if (!card) return;
    if (event.target.closest('.due-add')) addItem(card.dataset.name, '');
    if (event.target.closest('.due-dismiss')) {
      const product = dueProducts(history, new Set()).find((p) => p.name === card.dataset.name);
      store.remember({ name: product.name, category: product.category, snoozedUntil: snoozeUntil(product.interval) }, 0);
    }
  });

  filters.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    filter = chip.dataset.filter;
    render();
  });

  list.addEventListener('click', (event) => {
    if (event.target.closest('#first-add')) {
      entry.focus();
      return;
    }
    if (event.target.closest('#finish')) {
      const done = bought();
      removeWithUndo(done, `Compra acabada: ${done.length} ${done.length === 1 ? 'producte' : 'productes'}`);
      return;
    }

    const item = items.find((i) => i.id === event.target.closest('.item')?.dataset.id);
    if (!item) return;
    if (event.target.closest('.check')) {
      store.update(item.id, { done: !item.done, doneAt: item.done ? null : Date.now() });
    } else if (event.target.closest('.item-body')) {
      openEditor(item);
    }
  });

  editorForm.addEventListener('submit', () => {
    const name = editorForm.elements.name.value.trim();
    const qty = editorForm.elements.qty.value.trim();
    const category = editorForm.elements.category.value;
    const item = items.find((i) => i.id === editingId);
    if (!item || !name) return;
    store.update(item.id, { name, qty, category });
    if (category !== item.category || name !== item.name) store.remember({ name, category }, 0);
  });

  root.querySelector('#editor-delete').addEventListener('click', () => {
    const item = items.find((i) => i.id === editingId);
    editor.close();
    if (item) removeWithUndo([item], `${item.name} eliminat`);
  });

  editor.addEventListener('click', (event) => {
    if (event.target === editor) editor.close();
  });

  store.subscribe((state) => {
    ({ items, history } = state);
    render();
    if (document.activeElement === entry) renderSuggestions();
  });
}
