import { ICONS, escapeHtml } from './ui.js';

// Finances personals, amb la mateixa estructura que el full de càlcul de l'Arnau:
// quatre seccions de despeses, una d'ingressos i una d'estalvis. Cada compte
// només veu els seus moviments (users/{uid}/movements, protegit per les regles).
export const SECTIONS = [
  { id: 'menjar', label: 'Menjar', icon: '🛒', color: '#d9a521', kind: 'out' },
  { id: 'fixes', label: 'Fixes', icon: '📌', color: '#7a8fb8', kind: 'out' },
  { id: 'compres', label: 'Compres', icon: '🛍️', color: '#b07ab0', kind: 'out' },
  { id: 'extres', label: 'Extres', icon: '🎉', color: '#c8463a', kind: 'out' },
  { id: 'ingressos', label: 'Ingressos', icon: '💼', color: '#6f9a7a', kind: 'in' },
  { id: 'estalvis', label: 'Estalvis', icon: '🐷', color: '#4f8fa0', kind: 'save' },
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

// Barra del mes: quant s'ha menjat cada secció dels diners per gastar.
function chartHtml({ totals, spent, available, left }) {
  if (!spent && available <= 0) return '';
  const base = Math.max(available, spent);
  const parts = EXPENSES.filter((s) => totals[s.id] > 0)
    .map((s) => `<i style="--c:${s.color};flex-grow:${totals[s.id]}" title="${s.label}"></i>`);
  if (left > 0) parts.push(`<i class="rest" style="flex-grow:${left}" title="Restant"></i>`);
  const used = base ? Math.round((spent / base) * 100) : 0;
  return `
    <section class="fin-chart" aria-label="Repartiment de les despeses">
      <div class="fin-chart-head">
        <span>${available > 0 ? `Has gastat el <b>${Math.min(used, 999)}%</b> del que tenies per gastar` : 'Despeses del mes'}</span>
      </div>
      <div class="stack-bar${left < 0 ? ' over' : ''}">${parts.join('')}</div>
      <ul class="legend">
        ${EXPENSES.map((s) => `<li><i class="dot" style="--c:${s.color}"></i>${s.label}<b>${formatCents(totals[s.id])}</b></li>`).join('')}
      </ul>
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
    <section class="stats fin-stats" id="f-stats" aria-label="Resum del mes"></section>
    <div id="f-chart"></div>
    <button class="btn" type="button" id="f-add">Afegeix</button>
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
    const { totals, spent, available, left } = summary;

    stats.innerHTML = `
      <div class="stat stat-main${left < 0 ? ' negative' : ''}">
        <span class="stat-label">Restant</span>
        <strong>${formatCents(left)}</strong>
        <small>de ${formatCents(available)} per gastar</small>
      </div>
      <div class="stat">
        <span class="stat-label">Ingressos</span>
        <strong class="money-in">${formatCents(totals.ingressos)}</strong>
      </div>
      <div class="stat">
        <span class="stat-label">Despeses</span>
        <strong class="money-out">${formatCents(spent)}</strong>
      </div>
      <div class="stat">
        <span class="stat-label">Estalvis</span>
        <strong class="money-save">${formatCents(totals.estalvis)}</strong>
      </div>
      <div class="stat">
        <span class="stat-label">Per gastar</span>
        <strong>${formatCents(available)}</strong>
      </div>`;

    chart.innerHTML = chartHtml(summary);

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
    const data = { section, name: capitalize(name), amount, date };
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
  store.subscribe((all) => {
    movements = all;
    render();
  });
}
