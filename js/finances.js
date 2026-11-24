import { ICONS, escapeHtml } from './ui.js';

// Finances personals: cada compte veu i gestiona només els seus moviments.
// Viuen a users/{uid}/movements, fora de la llar, i les regles de Firestore
// només deixen llegir-los i escriure'ls al mateix uid.
export const CATEGORIES = {
  out: [
    { id: 'menjar', label: 'Menjar', icon: '🛒' },
    { id: 'casa', label: 'Casa i factures', icon: '🏠' },
    { id: 'transport', label: 'Transport', icon: '🚗' },
    { id: 'restaurants', label: 'Restaurants', icon: '🍽️' },
    { id: 'oci', label: 'Oci', icon: '🎉' },
    { id: 'roba', label: 'Roba', icon: '👕' },
    { id: 'salut', label: 'Salut', icon: '💊' },
    { id: 'subscripcions', label: 'Subscripcions', icon: '📱' },
    { id: 'educacio', label: 'Educació', icon: '📚' },
    { id: 'regals', label: 'Regals', icon: '🎁' },
    { id: 'altres', label: 'Altres', icon: '📦' },
  ],
  in: [
    { id: 'nomina', label: 'Nòmina', icon: '💼' },
    { id: 'extra', label: 'Extra', icon: '💸' },
    { id: 'regals', label: 'Regals', icon: '🎁' },
    { id: 'devolucions', label: 'Devolucions', icon: '↩️' },
    { id: 'altres', label: 'Altres', icon: '📦' },
  ],
};

const COLORS = { in: '#6f9a7a', out: '#c8463a' };
const MAX_CENTS = 100_000_000; // un milió d'euros per moviment

const money = new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' });
export const formatCents = (cents) => money.format(cents / 100);

// Accepta «12,5», «12.50», «1.234,56» o «1234.5». Retorna cèntims o null.
export function parseAmount(raw) {
  let text = String(raw).trim().replace(/\s|€/g, '');
  if (!text) return null;
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  const decimal = lastComma > lastDot ? ',' : '.';
  const thousands = decimal === ',' ? '.' : ',';
  // Un sol punt seguit de tres xifres (1.234) és de milers, no decimal.
  if (decimal === '.' && lastComma === -1 && /^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '');
  text = text.split(thousands).join('').replace(decimal, '.');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const cents = Math.round(Number(text) * 100);
  return cents > 0 && cents <= MAX_CENTS ? cents : null;
}

const pad = (n) => String(n).padStart(2, '0');
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const monthKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
const monthTitle = (date) => {
  const text = date.toLocaleDateString('ca-ES', { month: 'long', year: 'numeric' });
  return text.charAt(0).toUpperCase() + text.slice(1);
};
const dayTitle = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  const text = new Date(y, m - 1, d).toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const categoryOf = (movement) => {
  const list = CATEGORIES[movement.type] ?? CATEGORIES.out;
  return list.find((c) => c.id === movement.category) ?? list[list.length - 1];
};

export function summarize(movements) {
  let income = 0;
  let spent = 0;
  const byCategory = new Map();
  movements.forEach((m) => {
    if (m.type === 'in') {
      income += m.amount;
      return;
    }
    spent += m.amount;
    const cat = categoryOf(m);
    byCategory.set(cat.id, (byCategory.get(cat.id) ?? 0) + m.amount);
  });
  return { income, spent, balance: income - spent, byCategory };
}

export function mountFinances(root, { store, isAnonymous, openAccount, toast }) {
  let movements = [];
  let month = new Date();
  month.setDate(1);
  let editingId = null;
  let editType = 'out';

  root.innerHTML = `
    <div class="notice" id="f-account" ${isAnonymous ? '' : 'hidden'}>
      <span>Les teves finances només les veus tu. Crea un compte perquè no es perdin si canvies de mòbil.</span>
      <button type="button" id="f-create-account">Crea'l</button>
    </div>
    <div class="month-nav">
      <button class="round-btn" type="button" id="f-prev" aria-label="Mes anterior"><span class="flip">${ICONS.chevron}</span></button>
      <h2 id="f-month"></h2>
      <button class="round-btn" type="button" id="f-next" aria-label="Mes següent">${ICONS.chevron}</button>
    </div>
    <section class="stats fin-stats" id="f-stats" aria-label="Resum del mes"></section>
    <button class="btn" type="button" id="f-add">Afegeix un moviment</button>
    <div id="f-categories"></div>
    <div id="f-list"></div>
    <dialog class="sheet" id="f-editor">
      <form class="sheet-body" method="dialog" id="f-form" novalidate>
        <h2 id="f-editor-title">Nou moviment</h2>
        <fieldset class="segmented two">
          <legend>Tipus</legend>
          <label style="--c:${COLORS.out}"><input type="radio" name="type" value="out"><span><i></i>Despesa</span></label>
          <label style="--c:${COLORS.in}"><input type="radio" name="type" value="in"><span><i></i>Ingrés</span></label>
        </fieldset>
        <label class="field"><span>Import (€)</span><input name="amount" inputmode="decimal" autocomplete="off" placeholder="0,00" required></label>
        <label class="field"><span>Categoria</span><select name="category"></select></label>
        <label class="field"><span>Data</span><input name="date" type="date" required></label>
        <label class="field"><span>Nota (opcional)</span><input name="note" maxlength="140" autocomplete="off"></label>
        <p class="error" id="f-error" role="alert" hidden></p>
        <button class="btn" type="submit">Desa</button>
        <button class="btn danger" type="button" id="f-delete">Elimina el moviment</button>
      </form>
    </dialog>`;

  const stats = root.querySelector('#f-stats');
  const categories = root.querySelector('#f-categories');
  const list = root.querySelector('#f-list');
  const editor = root.querySelector('#f-editor');
  const form = root.querySelector('#f-form');
  const error = root.querySelector('#f-error');

  const findMovement = (id) => movements.find((m) => m.id === id);
  const inMonth = () => movements.filter((m) => m.date?.startsWith(monthKey(month)));

  function render() {
    root.querySelector('#f-month').textContent = monthTitle(month);
    const current = inMonth();
    const { income, spent, balance, byCategory } = summarize(current);

    stats.innerHTML = `
      <div class="stat stat-main">
        <span class="stat-label">Saldo del mes</span>
        <strong>${balance < 0 ? '−' : ''}${formatCents(Math.abs(balance))}</strong>
      </div>
      <div class="stat">
        <span class="stat-label">Ingressos</span>
        <strong class="money-in">${formatCents(income)}</strong>
      </div>
      <div class="stat">
        <span class="stat-label">Despeses</span>
        <strong class="money-out">${formatCents(spent)}</strong>
      </div>`;

    const ranked = [...byCategory].sort((a, b) => b[1] - a[1]);
    categories.innerHTML = ranked.length
      ? `<section class="group">
          <h2 class="group-title">On se'n van els diners</h2>
          <ul class="list cat-list">${ranked.map(([id, cents]) => {
            const cat = CATEGORIES.out.find((c) => c.id === id);
            const share = spent ? Math.round((cents / spent) * 100) : 0;
            return `
              <li class="cat-row">
                <span class="cat-icon">${cat.icon}</span>
                <span class="cat-text">
                  <span class="cat-line"><b>${cat.label}</b><span>${formatCents(cents)}</span></span>
                  <span class="cat-bar"><i style="width:${share}%"></i></span>
                </span>
              </li>`;
          }).join('')}</ul>
        </section>`
      : '';

    if (!current.length) {
      list.innerHTML = `<div class="empty">
          ${ICONS.wallet}
          <strong>Cap moviment aquest mes</strong>
          <p>Apunta aquí els teus ingressos i despeses. Només els veus tu.</p>
        </div>`;
      return;
    }
    const days = new Map();
    current
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .forEach((m) => days.set(m.date, [...(days.get(m.date) ?? []), m]));
    list.innerHTML = [...days].map(([day, items]) => `
      <section class="group">
        <h2 class="group-title">${escapeHtml(dayTitle(day))}</h2>
        <ul class="list">${items.map((m) => {
          const cat = categoryOf(m);
          const sign = m.type === 'in' ? '+' : '−';
          return `
            <li class="item" data-id="${escapeHtml(m.id)}">
              <button class="item-body" type="button" aria-label="Edita ${escapeHtml(cat.label)} ${formatCents(m.amount)}">
                <span class="item-icon" style="--c:${COLORS[m.type] ?? COLORS.out}">${cat.icon}</span>
                <span class="item-text">
                  <span class="item-name">${escapeHtml(m.note || cat.label)}</span>
                  ${m.note ? `<span class="item-meta">${escapeHtml(cat.label)}</span>` : ''}
                </span>
                <span class="amount ${m.type === 'in' ? 'money-in' : 'money-out'}">${sign}${formatCents(m.amount)}</span>
              </button>
            </li>`;
        }).join('')}</ul>
      </section>`).join('');
  }

  function fillCategories(type, selected) {
    form.elements.category.innerHTML = CATEGORIES[type]
      .map((c) => `<option value="${c.id}"${c.id === selected ? ' selected' : ''}>${c.icon} ${c.label}</option>`)
      .join('');
  }

  function openEditor(movement) {
    editingId = movement?.id ?? null;
    editType = movement?.type ?? 'out';
    error.hidden = true;
    root.querySelector('#f-editor-title').textContent = movement ? 'Edita el moviment' : 'Nou moviment';
    root.querySelector('#f-delete').hidden = !movement;
    form.elements.type.value = editType;
    form.elements.amount.value = movement ? (movement.amount / 100).toFixed(2).replace('.', ',') : '';
    fillCategories(editType, movement?.category);
    // Un moviment nou d'un altre mes es data el dia 1 d'aquell mes.
    const isThisMonth = monthKey(month) === monthKey(new Date());
    form.elements.date.value = movement?.date ?? (isThisMonth ? todayIso() : `${monthKey(month)}-01`);
    form.elements.note.value = movement?.note ?? '';
    editor.showModal();
    if (!movement) form.elements.amount.focus();
  }

  root.querySelector('#f-add').addEventListener('click', () => openEditor(null));
  root.querySelector('#f-create-account').addEventListener('click', openAccount);
  root.querySelector('#f-prev').addEventListener('click', () => { month.setMonth(month.getMonth() - 1); render(); });
  root.querySelector('#f-next').addEventListener('click', () => { month.setMonth(month.getMonth() + 1); render(); });

  list.addEventListener('click', (event) => {
    const movement = findMovement(event.target.closest('.item')?.dataset.id);
    if (movement) openEditor(movement);
  });

  form.addEventListener('change', (event) => {
    if (event.target.name !== 'type') return;
    editType = event.target.value;
    fillCategories(editType);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const amount = parseAmount(form.elements.amount.value);
    if (!amount) {
      error.textContent = "Escriu un import vàlid, per exemple 12,50.";
      error.hidden = false;
      form.elements.amount.focus();
      return;
    }
    const date = form.elements.date.value || todayIso();
    const data = {
      type: editType,
      amount,
      category: form.elements.category.value,
      date,
      note: form.elements.note.value.trim(),
    };
    if (editingId) store.update(editingId, data);
    else store.add({ ...data, createdAt: Date.now() });
    editor.close();
    // Si el moviment és d'un altre mes, s'hi va perquè es vegi on ha quedat.
    if (!date.startsWith(monthKey(month))) {
      const [y, m] = date.split('-').map(Number);
      month = new Date(y, m - 1, 1);
      render();
    }
  });

  root.querySelector('#f-delete').addEventListener('click', () => {
    const movement = findMovement(editingId);
    editor.close();
    if (!movement) return;
    store.remove(movement);
    toast('Moviment eliminat', { label: 'Desfés', run: () => store.restore(movement) });
  });

  editor.addEventListener('click', (event) => {
    if (event.target === editor) editor.close();
  });

  render();
  store.subscribe((all) => {
    movements = all;
    render();
  });
}
