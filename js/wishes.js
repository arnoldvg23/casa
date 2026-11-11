import { normalize, wordPattern } from './products.js';
import { ICONS, escapeHtml } from './ui.js';

// Llista de coses per a casa que no són menjar (l'IKEA, una tele nova...),
// agrupades per prioritat. L'ordre dins de cada grup el decideix la família
// arrossegant les targetes.
export const PRIORITIES = [
  { id: 'alta', label: 'Prioritat alta', short: 'Alta', color: '#c8463a' },
  { id: 'mitjana', label: 'Prioritat mitjana', short: 'Mitjana', color: '#d9a521' },
  { id: 'baixa', label: 'Prioritat baixa', short: 'Baixa', color: '#6f9a7a' },
];

const DEFAULT_PRIORITY = 'mitjana';
const DEFAULT_ICON = '🏠';
const DRAG_DELAY_MS = 220; // al mòbil cal mantenir premut: un toc normal no ha de moure res

const priorityOf = (wish) => (PRIORITIES.some((p) => p.id === wish.priority) ? wish.priority : DEFAULT_PRIORITY);
const priorityById = (id) => PRIORITIES.find((p) => p.id === id);

// Les targetes antigues sense `order` s'ordenen per data de creació.
export const sortKey = (wish) => wish.order ?? wish.createdAt ?? 0;

export function orderBetween(before, after) {
  if (before !== undefined && after !== undefined) return (before + after) / 2;
  if (before !== undefined) return before + 1;
  if (after !== undefined) return after - 1;
  return Date.now();
}

const HOME_ICONS = [
  ['📺', 'Tele', 'Televisió', 'Televisor', 'Televisión', 'Pantalla'],
  ['🛋️', 'Sofà', 'Sofá', 'Butaca', 'Puf'],
  ['🪑', 'Cadira', 'Silla', 'Tamboret', 'Taburete', 'Taula', 'Mesa', 'Escriptori', 'Escritorio'],
  ['🛏️', 'Llit', 'Cama', 'Matalàs', 'Colchón', 'Coixí', 'Almohada', 'Llençols', 'Sábanas', 'Nòrdic', 'Nórdico', 'Edredó'],
  ['🗄️', 'Armari', 'Armario', 'Calaixera', 'Cómoda', 'Prestatgeria', 'Estantería', 'Moble', 'Mueble', 'Sabater', 'Zapatero'],
  ['💡', 'Llum', 'Luz', 'Làmpada', 'Lámpara', 'Bombeta', 'Bombilla', 'Flexo'],
  ['🪴', 'Planta', 'Test', 'Maceta', 'Jardí', 'Jardín'],
  ['🖼️', 'Quadre', 'Cuadro', 'Marc', 'Marco', 'Mirall', 'Espejo'],
  ['🧺', 'Cistella', 'Cesta', 'Caixa', 'Caja', 'Organitzador', 'Organizador', 'Penjadors', 'Perchas'],
  ['🍳', 'Paella', 'Sartén', 'Olla', 'Cassola', 'Cazuela', 'Ganivets', 'Cuchillos'],
  ['🍽️', 'Vaixella', 'Vajilla', 'Plats', 'Platos', 'Gots', 'Vasos', 'Coberts', 'Cubiertos', 'Copes', 'Copas', 'Tasses', 'Tazas'],
  ['🧊', 'Nevera', 'Frigorífic', 'Frigorífico', 'Congelador'],
  ['🫧', 'Rentadora', 'Lavadora', 'Assecadora', 'Secadora'],
  ['☕', 'Cafetera', 'Microones', 'Microondas', 'Torradora', 'Tostadora', 'Batedora', 'Batidora', 'Forn', 'Horno', 'Robot de cuina', 'Thermomix', 'Freidora'],
  ['🧹', 'Aspiradora', 'Robot aspirador', 'Escombra', 'Escoba', 'Fregona', 'Pal de fregar'],
  ['🛁', 'Tovallola', 'Toalla', 'Cortina de dutxa', 'Cortina de ducha', 'Catifa de bany', 'Alfombrilla'],
  ['🟫', 'Catifa', 'Alfombra'],
  ['🪟', 'Cortina', 'Persiana', 'Estor'],
  ['🎮', 'Consola', 'Play', 'PlayStation', 'Xbox', 'Switch', 'Videojoc', 'Videojuego'],
  ['💻', 'Ordinador', 'Ordenador', 'Portàtil', 'Portátil', 'Tablet', 'iPad', 'Monitor', 'Impressora', 'Impresora'],
  ['🔊', 'Altaveu', 'Altavoz', 'Barra de so', 'Barra de sonido', 'Auriculars', 'Auriculares'],
  ['📶', 'Router', 'Wifi', 'Repetidor'],
  ['🌡️', 'Aire condicionat', 'Aire acondicionado', 'Ventilador', 'Estufa', 'Calefactor', 'Radiador', 'Termo'],
  ['🔧', 'Eines', 'Herramientas', 'Trepant', 'Taladro', 'Martell', 'Martillo', 'Tornavís', 'Destornillador', 'Escala', 'Escalera'],
  ['🚲', 'Bici', 'Bicicleta', 'Patinet', 'Patinete'],
  ['🧳', 'Maleta', 'Motxilla', 'Mochila'],
  ['🎁', 'Regal', 'Regalo'],
];

const ICON_MATCHERS = HOME_ICONS.flatMap(([icon, ...words]) =>
  words.map((word) => ({ icon, length: word.length, pattern: wordPattern(word) })),
);

// Igual que a la compra: mana el que s'anomena primer i, si coincideix, el més llarg.
export function homeIcon(name) {
  const n = normalize(name);
  let best = null;
  for (const m of ICON_MATCHERS) {
    const match = m.pattern.exec(n);
    if (!match) continue;
    if (!best || match.index < best.index || (match.index === best.index && m.length > best.length)) {
      best = { icon: m.icon, index: match.index, length: m.length };
    }
  }
  return best?.icon ?? DEFAULT_ICON;
}

export function mountWishes(root, { store, profile, toast }) {
  let wishes = [];
  let editingId = null;
  let newPriority = DEFAULT_PRIORITY;
  let dragging = false;
  let renderWhenDropped = false;
  let flashId = null;
  let sortables = [];

  root.innerHTML = `
    <section class="stats" id="w-stats" aria-label="Resum de la llista per a casa"></section>
    <div class="composer-wrap">
      <form class="composer" id="w-composer">
        <input id="w-entry" type="text" aria-label="Afegeix a la llista per a casa" placeholder="Afegeix, per exemple tele nova"
          autocomplete="off" autocapitalize="sentences" enterkeyhint="done" maxlength="80">
        <button class="add-btn" type="submit" aria-label="Afegeix">${ICONS.plus}</button>
      </form>
      <div class="chips" id="w-picker" role="radiogroup" aria-label="Prioritat del que afegeixes"></div>
    </div>
    <p class="hint" id="w-hint" hidden>Mantén premuda una targeta i arrossega-la per canviar-ne la prioritat o l'ordre.</p>
    <div id="w-groups"></div>
    <div id="w-done"></div>
    <dialog class="sheet" id="w-editor">
      <form class="sheet-body" method="dialog" id="w-editor-form">
        <div class="sheet-head">
          <span class="item-icon" id="w-editor-icon"></span>
          <h2>Edita</h2>
        </div>
        <label class="field"><span>Nom</span><input name="name" required maxlength="80" autocomplete="off"></label>
        <label class="field"><span>Nota (on comprar-ho, mida, enllaç...)</span><input name="note" maxlength="140" autocomplete="off"></label>
        <fieldset class="segmented">
          <legend>Prioritat</legend>
          ${PRIORITIES.map((p) => `
            <label style="--c:${p.color}"><input type="radio" name="priority" value="${p.id}"><span><i></i>${p.short}</span></label>`).join('')}
        </fieldset>
        <button class="btn" type="submit">Desa</button>
        <button class="btn danger" type="button" id="w-editor-delete">Elimina de la llista</button>
      </form>
    </dialog>`;

  const stats = root.querySelector('#w-stats');
  const entry = root.querySelector('#w-entry');
  const picker = root.querySelector('#w-picker');
  const hint = root.querySelector('#w-hint');
  const groups = root.querySelector('#w-groups');
  const doneSection = root.querySelector('#w-done');
  const editor = root.querySelector('#w-editor');
  const editorForm = root.querySelector('#w-editor-form');

  const pending = () => wishes.filter((w) => !w.done);
  const bought = () => wishes.filter((w) => w.done);
  const findWish = (id) => wishes.find((w) => w.id === id);

  function renderPicker() {
    picker.innerHTML = PRIORITIES.map((p) => `
      <button class="chip${p.id === newPriority ? ' active' : ''}" type="button" role="radio" aria-checked="${p.id === newPriority}"
        data-priority="${p.id}" style="--c:${p.color}"><i class="dot"></i>${p.short}</button>`).join('');
  }

  function cardHtml(wish) {
    const meta = [
      wish.note ? escapeHtml(wish.note) : '',
      wish.addedBy && wish.addedBy !== profile.name ? escapeHtml(wish.addedBy) : '',
    ].filter(Boolean).join(' · ');
    const action = wish.done ? 'Torna a la llista' : 'Marca com a comprat';
    return `
      <li class="item${wish.done ? ' done' : ''}${wish.id === flashId ? ' flash' : ''}" data-id="${escapeHtml(wish.id)}">
        <button class="item-body" type="button" aria-label="Edita ${escapeHtml(wish.name)}">
          <span class="item-icon" style="--c:${priorityById(priorityOf(wish)).color}">${homeIcon(wish.name)}</span>
          <span class="item-text">
            <span class="item-name">${escapeHtml(wish.name)}</span>
            ${meta ? `<span class="item-meta">${meta}</span>` : ''}
          </span>
        </button>
        <button class="check" type="button" aria-pressed="${Boolean(wish.done)}" aria-label="${action}: ${escapeHtml(wish.name)}"><span>${ICONS.check}</span></button>
      </li>`;
  }

  function render() {
    // Si arriba un canvi mentre algú arrossega, redibuixar trencaria el gest.
    if (dragging) {
      renderWhenDropped = true;
      return;
    }
    const toBuy = pending();
    const owned = bought().sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
    const urgent = toBuy.filter((w) => priorityOf(w) === 'alta').length;

    stats.innerHTML = `
      <div class="stat stat-main">
        <span class="stat-label">Per comprar</span>
        <strong>${toBuy.length}</strong>
        ${ICONS.sofa}
      </div>
      <div class="stat">
        <span class="stat-label">Prioritat alta</span>
        <strong>${urgent}</strong>
        <i class="stat-dot" style="--c:${priorityById('alta').color}"></i>
      </div>`;

    hint.hidden = !toBuy.length;

    groups.innerHTML = wishes.length
      ? PRIORITIES.map((p) => {
        const cards = toBuy.filter((w) => priorityOf(w) === p.id).sort((a, b) => sortKey(a) - sortKey(b));
        return `
          <section class="group" style="--c:${p.color}">
            <h2 class="group-title"><i class="dot"></i>${p.label}<span class="count">${cards.length}</span></h2>
            <ul class="list wish-list" data-priority="${p.id}">${cards.map(cardHtml).join('')}</ul>
          </section>`;
      }).join('')
      : `<div class="empty">
          ${ICONS.sofa}
          <strong>Res pendent per a casa</strong>
          <p>Apunteu aquí el que voleu comprar per a casa: coses de l'IKEA, una tele nova...</p>
        </div>`;

    doneSection.innerHTML = owned.length
      ? `<section class="group">
          <div class="group-head">
            <h2 class="group-title">Ja ho tenim</h2>
            <button class="link-btn" type="button" id="w-clear">Neteja</button>
          </div>
          <ul class="list">${owned.map(cardHtml).join('')}</ul>
        </section>`
      : '';

    flashId = null;
    enableDragging();
  }

  function enableDragging() {
    sortables.forEach((s) => s.destroy());
    sortables = [];
    if (!window.Sortable) return; // sense la llibreria es pot canviar la prioritat des de la fitxa
    sortables = [...groups.querySelectorAll('.wish-list')].map((list) => window.Sortable.create(list, {
      group: 'wishes',
      animation: 150,
      delay: DRAG_DELAY_MS,
      delayOnTouchOnly: true,
      touchStartThreshold: 6,
      // El mateix arrossegament en mòbil i ordinador, sense el drag-and-drop natiu.
      forceFallback: true,
      fallbackTolerance: 4,
      filter: '.check',
      preventOnFilter: false,
      ghostClass: 'drag-ghost',
      chosenClass: 'drag-chosen',
      onStart() { dragging = true; },
      onEnd(event) {
        dragging = false;
        const moved = event.from !== event.to || event.oldIndex !== event.newIndex;
        const wish = findWish(event.item.dataset.id);
        if (moved && wish) {
          const keyOf = (el) => (el ? sortKey(findWish(el.dataset.id) ?? {}) : undefined);
          store.update(wish.id, {
            priority: event.to.dataset.priority,
            order: orderBetween(keyOf(event.item.previousElementSibling), keyOf(event.item.nextElementSibling)),
          });
        }
        if (renderWhenDropped || !moved) {
          renderWhenDropped = false;
          render();
        }
      },
    }));
  }

  function addWish(raw) {
    const name = raw.replace(/\s+/g, ' ').trim();
    if (!name) return;
    const display = name.charAt(0).toUpperCase() + name.slice(1);
    const existing = pending().find((w) => normalize(w.name) === normalize(display));
    if (existing) {
      flashId = existing.id;
      toast(`${existing.name} ja era a la llista`);
      render();
      return;
    }
    store.add({
      name: display,
      note: '',
      priority: newPriority,
      order: Date.now(),
      done: false,
      doneAt: null,
      addedBy: profile.name,
      createdAt: Date.now(),
    });
  }

  function openEditor(wish) {
    editingId = wish.id;
    const tile = root.querySelector('#w-editor-icon');
    tile.textContent = homeIcon(wish.name);
    tile.style.setProperty('--c', priorityById(priorityOf(wish)).color);
    editorForm.elements.name.value = wish.name;
    editorForm.elements.note.value = wish.note ?? '';
    editorForm.elements.priority.value = priorityOf(wish);
    editor.showModal();
  }

  function removeWithUndo(removed, message) {
    store.removeMany(removed);
    toast(message, { label: 'Desfés', run: () => store.restoreMany(removed) });
  }

  root.querySelector('#w-composer').addEventListener('submit', (event) => {
    event.preventDefault();
    addWish(entry.value);
    entry.value = '';
    entry.focus();
  });

  picker.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    newPriority = chip.dataset.priority;
    renderPicker();
  });

  const onListClick = (event) => {
    if (event.target.closest('#w-clear')) {
      const owned = bought();
      removeWithUndo(owned, `${owned.length} ${owned.length === 1 ? 'cosa treta' : 'coses tretes'} de la llista`);
      return;
    }
    const wish = findWish(event.target.closest('.item')?.dataset.id);
    if (!wish) return;
    if (event.target.closest('.check')) {
      store.update(wish.id, { done: !wish.done, doneAt: wish.done ? null : Date.now() });
    } else if (event.target.closest('.item-body')) {
      openEditor(wish);
    }
  };
  groups.addEventListener('click', onListClick);
  doneSection.addEventListener('click', onListClick);

  editorForm.addEventListener('submit', () => {
    const wish = findWish(editingId);
    const name = editorForm.elements.name.value.trim();
    if (!wish || !name) return;
    const priority = editorForm.elements.priority.value;
    const patch = { name, note: editorForm.elements.note.value.trim(), priority };
    // Si canvia de grup, va al final del nou grup.
    if (priority !== priorityOf(wish)) patch.order = Date.now();
    store.update(wish.id, patch);
  });

  root.querySelector('#w-editor-delete').addEventListener('click', () => {
    const wish = findWish(editingId);
    editor.close();
    if (wish) removeWithUndo([wish], `${wish.name} eliminat`);
  });

  editor.addEventListener('click', (event) => {
    if (event.target === editor) editor.close();
  });

  renderPicker();
  store.subscribe((list) => {
    wishes = list;
    render();
  });
}
