import { normalize } from './products.js';
import { ICONS, escapeHtml } from './ui.js';

// Llista de Nadal: cada membre de la llar té la seva secció. Tothom veu les
// llistes de tothom, però només qui ha afegit un regal el pot canviar (ho
// controlen les regles de Firestore amb l'uid de cada dispositiu).
const GIFT_ICON = '🎁';
// Cada foto es desa dues vegades en JPEG, sense Firebase Storage: una miniatura
// petita dins del regal (la llista sencera la descarrega cada mòbil) i la foto
// gran en un document a part que només es baixa quan s'obre el regal.
const PHOTO_MAX_SIDE = 900;
const PHOTO_MAX_CHARS = 600_000;
const THUMB_MAX_SIDE = 240;
const THUMB_MAX_CHARS = 50_000;

// Accepta «amazon.es/...» sense protocol, però mai res que no sigui una web.
export function cleanLink(raw) {
  const text = raw.trim();
  if (!text) return '';
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

const linkHost = (link) => {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const safeLink = (link) => (link && cleanLink(link) === link ? link : '');
const safePhoto = (photo) => (typeof photo === 'string' && photo.startsWith('data:image/') ? photo : '');

// Accepta un fitxer triat al mòbil o una foto ja desada (data:image/...).
function loadImage(source) {
  return new Promise((resolve, reject) => {
    const url = typeof source === 'string' ? source : URL.createObjectURL(source);
    const done = () => { if (url !== source) URL.revokeObjectURL(url); };
    const img = new Image();
    img.onload = () => { done(); resolve(img); };
    img.onerror = () => { done(); reject(new Error('Imatge no vàlida')); };
    img.src = url;
  });
}

function toJpeg(img, maxSide, maxChars) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // els PNG transparents no queden negres en JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.75, 0.6, 0.45]) {
    const data = canvas.toDataURL('image/jpeg', quality);
    if (data.length <= maxChars) return data;
  }
  throw new Error('Foto massa gran');
}

// Redueix la foto del mòbil (uns quants MB) a una foto d'uns 100 KB i una
// miniatura d'uns 15 KB.
export async function compressPhoto(file) {
  const img = await loadImage(file);
  return { full: toJpeg(img, PHOTO_MAX_SIDE, PHOTO_MAX_CHARS), thumb: toJpeg(img, THUMB_MAX_SIDE, THUMB_MAX_CHARS) };
}

export async function makeThumb(photo) {
  return toJpeg(await loadImage(photo), THUMB_MAX_SIDE, THUMB_MAX_CHARS);
}

export function mountGifts(root, { store, profile, toast }) {
  const myUid = store.uid;
  let gifts = [];
  let members = [];
  let editingId = null;
  let editorThumb = '';
  // undefined: la foto no ha canviat; '': s'ha tret; text: foto gran nova.
  let editorFull;
  let flashId = null;
  let viewingId = null;
  const migrating = new Set();

  root.innerHTML = `
    <section class="stats" id="g-stats" aria-label="Resum de Nadal"></section>
    <div class="composer-wrap">
      <form class="composer" id="g-composer">
        <input id="g-entry" type="text" aria-label="Afegeix un regal a la teva llista" placeholder="Afegeix un regal, per exemple uns auriculars"
          autocomplete="off" autocapitalize="sentences" enterkeyhint="done" maxlength="80">
        <button class="add-btn" type="submit" aria-label="Afegeix">${ICONS.plus}</button>
      </form>
    </div>
    <div id="g-sections"></div>
    <dialog class="sheet" id="g-editor">
      <form class="sheet-body" method="dialog" id="g-editor-form">
        <h2>Edita el regal</h2>
        <label class="field"><span>Nom</span><input name="name" required maxlength="80" autocomplete="off"></label>
        <label class="field"><span>Enllaç a la web del producte</span><input name="link" type="text" inputmode="url" maxlength="1000"
          autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://..."></label>
        <div class="photo-field">
          <div class="photo-preview" id="g-photo-preview"></div>
          <div class="photo-actions">
            <label class="btn secondary file-btn">
              <input type="file" accept="image/*" id="g-photo-input">
              <span id="g-photo-label">Afegeix una foto</span>
            </label>
            <button class="btn danger" type="button" id="g-photo-remove">Treu la foto</button>
          </div>
        </div>
        <p class="error" id="g-editor-error" role="alert" hidden></p>
        <button class="btn" type="submit">Desa</button>
        <button class="btn danger" type="button" id="g-editor-delete">Elimina de la llista</button>
      </form>
    </dialog>
    <dialog class="sheet" id="g-viewer">
      <div class="sheet-body" id="g-viewer-body"></div>
    </dialog>`;

  const stats = root.querySelector('#g-stats');
  const entry = root.querySelector('#g-entry');
  const sections = root.querySelector('#g-sections');
  const editor = root.querySelector('#g-editor');
  const editorForm = root.querySelector('#g-editor-form');
  const editorError = root.querySelector('#g-editor-error');
  const photoPreview = root.querySelector('#g-photo-preview');
  const photoInput = root.querySelector('#g-photo-input');
  const photoLabel = root.querySelector('#g-photo-label');
  const photoRemove = root.querySelector('#g-photo-remove');
  const viewer = root.querySelector('#g-viewer');
  const viewerBody = root.querySelector('#g-viewer-body');

  const findGift = (id) => gifts.find((g) => g.id === id);
  const mine = () => gifts.filter((g) => g.uid === myUid);
  const byAge = (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0);

  // Una secció per membre: els que s'han apuntat i qualsevol que tingui regals.
  function people() {
    const list = new Map();
    members.forEach((m) => list.set(m.id, m.name));
    gifts.forEach((g) => { if (!list.has(g.uid)) list.set(g.uid, g.addedBy ?? 'Algú'); });
    list.set(myUid, profile.name);
    const others = [...list].filter(([uid]) => uid !== myUid)
      .sort(([, a], [, b]) => a.localeCompare(b, 'ca'));
    return [[myUid, profile.name], ...others];
  }

  // Els regals d'abans de les miniatures només tenen `photo`, la foto gran.
  const thumbOf = (gift) => safePhoto(gift.thumb || gift.photo);

  function thumb(gift) {
    const photo = thumbOf(gift);
    return photo
      ? `<span class="item-icon gift-thumb"><img src="${escapeHtml(photo)}" alt="" loading="lazy"></span>`
      : `<span class="item-icon">${GIFT_ICON}</span>`;
  }

  function cardHtml(gift, own) {
    const link = safeLink(gift.link);
    const meta = [link ? escapeHtml(linkHost(link)) : '', !own || link || thumbOf(gift) ? '' : 'Toca per afegir enllaç o foto']
      .filter(Boolean).join(' · ');
    return `
      <li class="item${gift.id === flashId ? ' flash' : ''}" data-id="${escapeHtml(gift.id)}">
        <button class="item-body" type="button" aria-label="${own ? 'Edita' : 'Mira'} ${escapeHtml(gift.name)}">
          ${thumb(gift)}
          <span class="item-text">
            <span class="item-name">${escapeHtml(gift.name)}</span>
            ${meta ? `<span class="item-meta">${meta}</span>` : ''}
          </span>
        </button>
        ${link ? `<a class="check gift-link" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" aria-label="Obre la web de ${escapeHtml(gift.name)}">${ICONS.link}</a>` : ''}
      </li>`;
  }

  function render() {
    const total = gifts.length;
    stats.innerHTML = `
      <div class="stat stat-main">
        <span class="stat-label">La meva llista</span>
        <strong>${mine().length}</strong>
        ${ICONS.gift}
      </div>
      <div class="stat">
        <span class="stat-label">Regals de tothom</span>
        <strong>${total}</strong>
        ${ICONS.tree}
      </div>`;

    sections.innerHTML = people().map(([uid, name]) => {
      const own = uid === myUid;
      const list = gifts.filter((g) => g.uid === uid).sort(byAge);
      const body = list.length
        ? `<ul class="list">${list.map((g) => cardHtml(g, own)).join('')}</ul>`
        : `<p class="gift-empty">${own ? 'Encara no has afegit cap regal. Escriu-lo a dalt.' : 'Encara no ha afegit cap regal.'}</p>`;
      return `
        <section class="group gift-group${own ? ' own' : ''}">
          <h2 class="group-title">${own ? 'La teva llista' : escapeHtml(name)}<span class="count">${list.length}</span></h2>
          ${body}
        </section>`;
    }).join('');
    flashId = null;
  }

  function addGift(raw) {
    const name = raw.replace(/\s+/g, ' ').trim();
    if (!name) return;
    const display = name.charAt(0).toUpperCase() + name.slice(1);
    const existing = mine().find((g) => normalize(g.name) === normalize(display));
    if (existing) {
      flashId = existing.id;
      toast(`${existing.name} ja era a la teva llista`);
      render();
      return;
    }
    store.add({ name: display, link: '', thumb: '', addedBy: profile.name, createdAt: Date.now() });
  }

  function showPhoto() {
    photoPreview.innerHTML = editorThumb ? `<img src="${escapeHtml(editorThumb)}" alt="Foto del regal">` : `<span>${GIFT_ICON}</span>`;
    photoLabel.textContent = editorThumb ? 'Canvia la foto' : 'Afegeix una foto';
    photoRemove.hidden = !editorThumb;
  }

  function openEditor(gift) {
    editingId = gift.id;
    editorThumb = thumbOf(gift);
    editorFull = undefined;
    editorForm.elements.name.value = gift.name;
    editorForm.elements.link.value = gift.link ?? '';
    editorError.hidden = true;
    showPhoto();
    editor.showModal();
  }

  function openViewer(gift, ownerName) {
    const link = safeLink(gift.link);
    // Primer la miniatura (ja és al mòbil) i, quan arriba, la foto gran.
    const photo = safePhoto(gift.photo) || safePhoto(gift.thumb);
    viewingId = gift.id;
    if (gift.thumb) {
      store.loadPhoto(gift.id).then((full) => {
        const img = viewerBody.querySelector('.gift-photo');
        if (img && viewingId === gift.id && safePhoto(full)) img.src = full;
      });
    }
    viewerBody.innerHTML = `
      ${photo ? `<img class="gift-photo" src="${escapeHtml(photo)}" alt="Foto de ${escapeHtml(gift.name)}">` : ''}
      <h2>${escapeHtml(gift.name)}</h2>
      <p>A la llista de ${escapeHtml(ownerName)}</p>
      ${link ? `<a class="btn" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Obre ${escapeHtml(linkHost(link))}</a>` : ''}
      <button class="btn secondary" type="button" id="g-viewer-close">Tanca</button>`;
    viewer.showModal();
  }

  root.querySelector('#g-composer').addEventListener('submit', (event) => {
    event.preventDefault();
    addGift(entry.value);
    entry.value = '';
    entry.focus();
  });

  sections.addEventListener('click', (event) => {
    if (!event.target.closest('.item-body')) return;
    const gift = findGift(event.target.closest('.item')?.dataset.id);
    if (!gift) return;
    if (gift.uid === myUid) openEditor(gift);
    else openViewer(gift, people().find(([uid]) => uid === gift.uid)?.[1] ?? gift.addedBy);
  });

  editorForm.elements.link.addEventListener('input', () => { editorError.hidden = true; });

  photoInput.addEventListener('change', async () => {
    const file = photoInput.files[0];
    photoInput.value = '';
    if (!file) return;
    photoLabel.textContent = 'Preparant la foto...';
    try {
      ({ thumb: editorThumb, full: editorFull } = await compressPhoto(file));
    } catch (error) {
      console.error(error);
      toast("No s'ha pogut fer servir aquesta foto");
    }
    showPhoto();
  });

  photoRemove.addEventListener('click', () => {
    editorThumb = '';
    editorFull = '';
    showPhoto();
  });

  editorForm.addEventListener('submit', (event) => {
    const gift = findGift(editingId);
    const name = editorForm.elements.name.value.trim();
    const link = cleanLink(editorForm.elements.link.value);
    if (link === null) {
      event.preventDefault();
      editorError.textContent = "L'enllaç ha de ser una adreça web, per exemple https://www.amazon.es/...";
      editorError.hidden = false;
      return;
    }
    if (!gift || !name) return;
    if (editorFull === undefined) store.update(gift.id, { name, link });
    else store.update(gift.id, { name, link, thumb: editorThumb }, editorFull);
  });

  root.querySelector('#g-editor-delete').addEventListener('click', async () => {
    const gift = findGift(editingId);
    editor.close();
    if (!gift) return;
    const undo = await store.remove(gift);
    toast(`${gift.name} eliminat`, { label: 'Desfés', run: undo });
  });

  [editor, viewer].forEach((sheet) => sheet.addEventListener('click', (event) => {
    if (event.target === sheet || event.target.id === 'g-viewer-close') sheet.close();
  }));
  viewer.addEventListener('close', () => { viewingId = null; });

  // Els regals propis d'abans tenen la foto gran dins del regal: es passen al
  // format nou (miniatura + foto a part). Només ho pot fer el mòbil del dueny.
  function migrateOwnPhotos() {
    mine().filter((g) => !g.thumb && safePhoto(g.photo) && !migrating.has(g.id)).forEach((gift) => {
      migrating.add(gift.id);
      makeThumb(gift.photo)
        .then((small) => store.update(gift.id, { thumb: small }, gift.photo))
        .catch((error) => console.error('Miniatura', error));
    });
  }

  store.join(profile.name);
  const unsubscribe = store.subscribe((state) => {
    gifts = state.gifts;
    members = state.members;
    render();
    migrateOwnPhotos();
  });
  return {
    destroy: unsubscribe,
    // El nom nou es veu a la pròpia secció i, a través de members, a la dels altres.
    rename(name) {
      store.join(name);
      render();
    },
  };
}
