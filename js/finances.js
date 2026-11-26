import { ICONS, escapeHtml } from './ui.js';

// Finances personals, amb la mateixa estructura que el full de càlcul de l'Arnau:
// quatre seccions de despeses, una d'ingressos i una d'estalvis. Cada compte
// només veu els seus moviments (users/{uid}/movements, protegit per les regles).
export const SECTIONS = [
  { id: 'menjar', label: 'Menjar', icon: '🛒', color: '#245c43', kind: 'out' },
  { id: 'fixes', label: 'Fixes', icon: '📌', color: '#4f9270', kind: 'out' },
  { id: 'compres', label: 'Compres', icon: '🛍️', color: '#8dc0a0', kind: 'out' },
  { id: 'extres', label: 'Extres', icon: '🎉', color: '#c9a64a', kind: 'out' },
  { id: 'ingressos', label: 'Ingressos', icon: '💼', color: '#2f7d55', kind: 'in' },
  { id: 'estalvis', label: 'Estalvis', icon: '🐷', color: '#4f86a0', kind: 'save' },
];
const EXPENSES = SECTIONS.filter((s) => s.kind === 'out');
const sectionById = (id) => SECTIONS.find((s) => s.id === id);

// Moviments de la primera versió (tipus + categoria) es reparteixen a les seccions noves.
const LEGACY = {
  menjar: 'menjar', restaurants: 'menjar',
  casa: 'fixes', subscripcions: 'fixes', transport: 'fixes', educacio: 'fixes',
  roba: 'compres', regals: 'compres', salut: 'compres',
};
export function sectionOf(movement) {
  if (sectionById(movement.section)) return movement.section;
  if (movement.type === 'in') return 'ingressos';
  return LEGACY[movement.category] ?? 'extres';
}

const MAX_CENTS = 100_000_000; // un milió d'euros per moviment
const LAST_SECTION_KEY = 'casa.finances.seccio';

const money = new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' });
export const formatCents = (cents) => `${cents < 0 ? '−' : ''}${money.format(Math.abs(cents) / 100)}`;

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
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const monthTitle = (date) => capitalize(date.toLocaleDateString('ca-ES', { month: 'long', year: 'numeric' }));
const shortDay = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' });
};
const labelOf = (movement) => movement.name || movement.note || sectionById(sectionOf(movement)).label;

// Com al full: per gastar = ingressos − estalvis; restant = per gastar − despeses.
export function summarize(movements) {
  const totals = Object.fromEntries(SECTIONS.map((s) => [s.id, 0]));
  movements.forEach((m) => { totals[sectionOf(m)] += m.amount; });
  const spent = EXPENSES.reduce((sum, s) => sum + totals[s.id], 0);
  const available = totals.ingressos - totals.estalvis;
  return { totals, spent, available, left: available - spent };
}

// Import gran amb els cèntims més petits, com a la targeta de saldo.
function bigMoney(cents) {
  const text = formatCents(cents);
  const match = text.match(/^(.*?)(,\d{2})(\s*€)$/);
  return match ? `${escapeHtml(match[1])}<small>${match[2]}${match[3]}</small>` : escapeHtml(text);
}

function heroHtml({ totals, spent, available, left }) {
  const used = available > 0 ? Math.round((spent / available) * 100) : (spent ? 100 : 0);
  return `
    <section class="fin-hero${left < 0 ? ' negative' : ''}" aria-label="Resum del mes">
      <span class="fin-hero-label">${ICONS.wallet.replace('<svg', '<svg width="18" height="18"')}Restant</span>
      <strong class="fin-hero-amount">${bigMoney(left)}</strong>
      <span class="fin-hero-sub">de ${formatCents(available)} per gastar<span class="fin-pill">${Math.min(used, 999)}% gastat</span></span>
      <div class="fin-progress${left < 0 ? ' over' : ''}"><i style="width:${Math.min(used, 100)}%"></i></div>
      <div class="fin-hero-row">
        <div><span>Ingressos</span><b>${formatCents(totals.ingressos)}</b></div>
        <div><span>Despeses</span><b>${formatCents(spent)}</b></div>
        <div><span>Estalvis</span><b>${formatCents(totals.estalvis)}</b></div>
      </div>
    </section>`;
}

// Donut de despeses per secció, amb el total al mig.
function donutHtml({ totals, spent, available, left }) {
  if (!spent) return '';
  const shown = EXPENSES.filter((s) => totals[s.id] > 0);
  const gap = shown.length > 1 ? 3 : 0;
  let start = 0;
  const arcs = shown.map((s) => {
    const share = (totals[s.id] / spent) * 100;
    const length = Math.max(share - gap, 0.5);
    const arc = `<circle r="42" cx="50" cy="50" pathLength="100" stroke="${s.color}" stroke-dasharray="${length} ${100 - length}" stroke-dashoffset="${-start - gap / 2}"></circle>`;
    start += share;
    return arc;
  });
  const pct = (id) => Math.round((totals[id] / spent) * 100);
  const tip = available > 0
    ? (left >= 0
      ? `<div class="fin-tip"><span>🌱</span><div><b>Et queden ${formatCents(left)}</b>Has gastat el ${Math.round((spent / available) * 100)}% del que tenies per gastar.</div></div>`
      : `<div class="fin-tip over"><span>⚠️</span><div><b>T'has passat ${formatCents(-left)}</b>Les despeses superen el que tenies per gastar.</div></div>`)
    : '';
  return `
    <section class="fin-card" aria-label="Despeses per secció">
      <div class="fin-card-head"><h3>Les teves despeses</h3><span>Per secció</span></div>
      <div class="donut-wrap">
        <svg class="donut" viewBox="0 0 100 100" aria-hidden="true"><circle class="track" r="42" cx="50" cy="50"></circle>${arcs.join('')}</svg>
        <div class="donut-center"><b>${formatCents(spent)}</b><span>Total gastat</span></div>
      </div>
      <ul class="legend">
        ${EXPENSES.map((s) => `<li><i class="dot" style="--c:${s.color}"></i>${s.label} <small>${pct(s.id)}%</small><b>${formatCents(totals[s.id])}</b></li>`).join('')}
      </ul>
      ${tip}
    </section>`;
}

// Barres de despeses dels últims sis mesos fins al mes que es mira.
function trendHtml(movements, month) {
  const months = Array.from({ length: 6 }, (_, i) => new Date(month.getFullYear(), month.getMonth() - 5 + i, 1));
  const values = months.map((m) => summarize(movements.filter((x) => x.date?.startsWith(monthKey(m)))).spent);
  const max = Math.max(...values);
  if (!max) return '';
  const bars = months.map((m, i) => {
    const current = i === months.length - 1;
    const label = m.toLocaleDateString('ca-ES', { month: 'short' }).replace('.', '');
    return `
      <button type="button" class="bar${current ? ' current' : ''}" data-month="${monthKey(m)}" aria-label="${monthTitle(m)}: ${formatCents(values[i])}">
        <i style="height:${(values[i] / max) * 100}%"></i>
        <small>${escapeHtml(capitalize(label))}</small>
        ${current ? `<em style="bottom:calc(${(values[i] / max) * 100}% + 26px)">${formatCents(values[i])}</em>` : ''}
      </button>`;
  });
  return `
    <section class="fin-card" aria-label="Evolució de les despeses">
      <div class="fin-card-head"><h3>Evolució</h3><span>Últims 6 mesos</span></div>
      <div class="bars">${bars.join('')}</div>
    </section>`;
}

export function mountFinances(root, { store, isAnonymous, openAccount, toast }) {
  let movements = [];
  let month = new Date();
  month.setDate(1);
  let editingId = null;
  const open = new Set(); // seccions desplegades: per defecte totes tancades
  let lastSection = 'menjar';
  try { lastSection = sectionById(localStorage.getItem(LAST_SECTION_KEY))?.id ?? lastSection; } catch { /* sense emmagatzematge */ }

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
    <div id="f-stats"></div>
    <div class="fin-actions">
      <button type="button" class="fin-action primary" id="f-add"><span>${ICONS.plus}</span>Afegeix</button>
      <button type="button" class="fin-action" data-quick="menjar"><span>🛒</span>Menjar</button>
      <button type="button" class="fin-action" data-quick="ingressos"><span>💼</span>Ingrés</button>
      <button type="button" class="fin-action" data-quick="estalvis"><span>🐷</span>Estalvi</button>
    </div>
    <div id="f-chart"></div>
    <div id="f-trend"></div>
    <h3 class="fin-title">Seccions</h3>
    <div class="fin-sections" id="f-sections"></div>
    <dialog class="sheet" id="f-editor">
      <form class="sheet-body" method="dialog" id="f-form" novalidate>
        <h2 id="f-editor-title">Afegeix</h2>
        <fieldset class="section-picker">
          <legend>Secció</legend>
          ${SECTIONS.map((s) => `
            <label style="--c:${s.color}"><input type="radio" name="section" value="${s.id}"><span>${s.icon} ${s.label}</span></label>`).join('')}
        </fieldset>
        <label class="field"><span>Concepte</span><input name="name" maxlength="80" autocomplete="off" placeholder="Mercadona, Gym, Sou..."></label>
        <label class="field"><span>Import (€)</span><input name="amount" inputmode="decimal" autocomplete="off" placeholder="0,00"></label>
        <label class="field"><span>Data</span><input name="date" type="date"></label>
        <p class="error" id="f-error" role="alert" hidden></p>
        <button class="btn" type="submit">Desa</button>
        <button class="btn danger" type="button" id="f-delete">Elimina</button>
      </form>
    </dialog>`;

  const stats = root.querySelector('#f-stats');
  const chart = root.querySelector('#f-chart');
  const trend = root.querySelector('#f-trend');
  const sections = root.querySelector('#f-sections');
  const editor = root.querySelector('#f-editor');
  const form = root.querySelector('#f-form');
  const error = root.querySelector('#f-error');

  const findMovement = (id) => movements.find((m) => m.id === id);
  const inMonth = () => movements.filter((m) => m.date?.startsWith(monthKey(month)));

  function render() {
    root.querySelector('#f-month').textContent = monthTitle(month);
    const current = inMonth();
    const summary = summarize(current);
    const { totals } = summary;

    stats.innerHTML = heroHtml(summary);
    chart.innerHTML = donutHtml(summary);
    trend.innerHTML = trendHtml(movements, month);

    sections.innerHTML = SECTIONS.map((s) => {
      const items = current.filter((m) => sectionOf(m) === s.id)
        .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0));
      return `
        <details class="fin-section" data-section="${s.id}" style="--c:${s.color}"${open.has(s.id) ? ' open' : ''}>
          <summary>
            <span class="item-icon">${s.icon}</span>
            <span class="fin-section-name">${s.label}<small>${items.length ? `${items.length} ${items.length === 1 ? 'moviment' : 'moviments'}` : 'Buit'}</small></span>
            <b>${formatCents(totals[s.id])}</b>
            <span class="fin-chevron">${ICONS.chevron}</span>
          </summary>
          <ul class="fin-rows">
            ${items.map((m) => `
              <li><button type="button" class="fin-row" data-id="${escapeHtml(m.id)}">
                <span class="fin-row-name">${escapeHtml(labelOf(m))}<small>${escapeHtml(shortDay(m.date))}</small></span>
                <span class="fin-row-amount">${formatCents(m.amount)}</span>
              </button></li>`).join('')}
            <li><button type="button" class="link-btn fin-add-here" data-section="${s.id}">+ Afegeix a ${s.label}</button></li>
          </ul>
        </details>`;
    }).join('');
  }

  function openEditor(movement, section) {
    editingId = movement?.id ?? null;
    error.hidden = true;
    root.querySelector('#f-editor-title').textContent = movement ? 'Edita' : 'Afegeix';
    root.querySelector('#f-delete').hidden = !movement;
    form.elements.section.value = movement ? sectionOf(movement) : (section ?? lastSection);
    form.elements.name.value = movement ? labelOf(movement) : '';
    form.elements.amount.value = movement ? (movement.amount / 100).toFixed(2).replace('.', ',') : '';
    // Un moviment nou d'un altre mes es data el dia 1 d'aquell mes.
    const isThisMonth = monthKey(month) === monthKey(new Date());
    form.elements.date.value = movement?.date ?? (isThisMonth ? todayIso() : `${monthKey(month)}-01`);
    editor.showModal();
    if (!movement) form.elements.name.focus();
  }

  root.querySelector('#f-add').addEventListener('click', () => openEditor(null));
  root.querySelectorAll('[data-quick]').forEach((button) => {
    button.addEventListener('click', () => openEditor(null, button.dataset.quick));
  });
  trend.addEventListener('click', (event) => {
    const key = event.target.closest('.bar')?.dataset.month;
    if (!key) return;
    const [y, m] = key.split('-').map(Number);
    month = new Date(y, m - 1, 1);
    render();
  });
  root.querySelector('#f-create-account').addEventListener('click', openAccount);
  root.querySelector('#f-prev').addEventListener('click', () => { month.setMonth(month.getMonth() - 1); render(); });
  root.querySelector('#f-next').addEventListener('click', () => { month.setMonth(month.getMonth() + 1); render(); });

  // Recorda quines seccions estan obertes perquè un canvi no les torni a tancar.
  sections.addEventListener('toggle', (event) => {
    const id = event.target.dataset?.section;
    if (!id) return;
    if (event.target.open) open.add(id);
    else open.delete(id);
  }, true);

  sections.addEventListener('click', (event) => {
    const here = event.target.closest('.fin-add-here');
    if (here) {
      openEditor(null, here.dataset.section);
      return;
    }
    const movement = findMovement(event.target.closest('.fin-row')?.dataset.id);
    if (movement) openEditor(movement);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = form.elements.name.value.replace(/\s+/g, ' ').trim();
    const amount = parseAmount(form.elements.amount.value);
    const fail = (message, field) => {
      error.textContent = message;
      error.hidden = false;
      form.elements[field].focus();
    };
    if (!name) return fail('Escriu el concepte, per exemple Mercadona.', 'name');
    if (!amount) return fail('Escriu un import vàlid, per exemple 12,50.', 'amount');
    const section = form.elements.section.value || lastSection;
    const date = form.elements.date.value || todayIso();
    // `type` i `category` mantenen el format antic: així funciona també amb les regles ja publicades.
    const data = { section, name: capitalize(name), amount, date, type: section === 'ingressos' ? 'in' : 'out', category: section };
    if (editingId) store.update(editingId, data);
    else store.add({ ...data, createdAt: Date.now() });
    lastSection = section;
    try { localStorage.setItem(LAST_SECTION_KEY, section); } catch { /* sense emmagatzematge */ }
    open.add(section); // s'obre la secció on ha anat a parar
    editor.close();
    if (!date.startsWith(monthKey(month))) {
      const [y, m] = date.split('-').map(Number);
      month = new Date(y, m - 1, 1);
    }
    render();
    return undefined;
  });

  root.querySelector('#f-delete').addEventListener('click', () => {
    const movement = findMovement(editingId);
    editor.close();
    if (!movement) return;
    store.remove(movement);
    toast(`${labelOf(movement)} eliminat`, { label: 'Desfés', run: () => store.restore(movement) });
  });

  editor.addEventListener('click', (event) => {
    if (event.target === editor) editor.close();
  });

  render();
  const unsubscribe = store.subscribe((all) => {
    movements = all;
    render();
  });
  return {
    destroy: unsubscribe,
    // Crear el compte no canvia l'uid: només cal amagar l'avís.
    setAnonymous(anonymous) {
      root.querySelector('#f-account').hidden = !anonymous;
    },
  };
}
