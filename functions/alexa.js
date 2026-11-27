// Skill d'Alexa «Mi casa»: afegeix productes a la llista de la compra parlant.
// Alexa no entén el català, així que la skill parla en castellà, però el que
// es desa a la llista surt en català sempre que el producte sigui al catàleg
// («leche» → «Llet»), igual que si s'hagués escrit a l'app.
//
// La vinculació va amb un codi de 6 xifres que genera l'app (Ajustos →
// Connecta amb Alexa): «Alexa, dile a mi casa que mi código es 482913».

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_PRODUCTS = 8;

const NUMBER_WORDS = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20,
};
const NUMBER_PATTERN = new RegExp(`^(${Object.keys(NUMBER_WORDS).join('|')})\\s+`, 'i');

const speak = (text, { end = true, reprompt } = {}) => ({
  version: '1.0',
  response: {
    outputSpeech: { type: 'PlainText', text },
    ...(reprompt ? { reprompt: { outputSpeech: { type: 'PlainText', text: reprompt } } } : {}),
    shouldEndSession: end,
  },
});

const HELP = 'Puedes decirme, por ejemplo: añade leche y huevos. O pregúntame qué hay en la lista.';
const NOT_LINKED = 'Primero tienes que conectar Alexa con tu casa. En la app Casa, abre los ajustes, '
  + 'pulsa Connecta amb Alexa y dime el código. Por ejemplo: mi código es uno dos tres cuatro cinco seis.';

// Llista en castellà: «leche, huevos y pan».
function joinNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;
}

// «leche, dos litros de aceite y pan» → ['leche', '2 litros de aceite', 'pan']
function splitProducts(text) {
  return text
    .split(/\s*,\s*|\s+(?:y|e)\s+/i)
    .map((part) => part.trim().replace(/^(?:de|del|la|el|los|las|unos|unas)\s+/i, ''))
    .map((part) => part.replace(NUMBER_PATTERN, (_, word) => `${NUMBER_WORDS[word.toLowerCase()]} `))
    .filter(Boolean)
    .slice(0, MAX_PRODUCTS);
}

function createSkill({ repo, shared, now = () => Date.now() }) {
  const { CATEGORIES, normalize, categoryFor, parseEntry } = shared.products;
  const { addPurchase } = shared.habits;

  // Qualsevol nom del catàleg (català o castellà) → el nom català.
  const catalan = new Map();
  for (const category of CATEGORIES) {
    for (const [, name, ...synonyms] of category.products) {
      for (const word of [name, ...synonyms]) {
        if (!catalan.has(normalize(word))) catalan.set(normalize(word), name);
      }
    }
  }

  // El que la família ja té a l'historial mana; si no, el catàleg; si no, tal com s'ha dit.
  function productName(spoken, history) {
    const key = normalize(spoken);
    const remembered = history.find((h) => normalize(h.name) === key);
    if (remembered) return remembered.name;
    if (catalan.has(key)) return catalan.get(key);
    return spoken.charAt(0).toUpperCase() + spoken.slice(1);
  }

  async function addProducts(link, text) {
    const [items, history] = await Promise.all([repo.listItems(link.home), repo.listHistory(link.home)]);
    const added = [];
    const already = [];
    for (const raw of splitProducts(text)) {
      const parsed = parseEntry(raw);
      const name = productName(parsed.name, history).slice(0, 80);
      const qty = parsed.qty.slice(0, 40);
      if (!name) continue;
      const existing = items.find((i) => normalize(i.name) === normalize(name));
      if (existing && !existing.done && (!qty || qty === existing.qty)) {
        already.push(existing.name);
        continue;
      }
      if (existing) {
        await repo.updateItem(link.home, existing.id, existing.done
          ? { done: false, doneAt: null, qty: qty || existing.qty || '' }
          : { qty });
        existing.done = false;
      } else {
        const category = categoryFor(name, history);
        const known = history.find((h) => normalize(h.name) === normalize(name));
        const item = {
          name, qty, category, done: false, doneAt: null,
          addedBy: (link.name || 'Alexa').slice(0, 40), uid: link.uid, createdAt: now(),
        };
        await repo.addItem(link.home, item);
        await repo.remember(link.home, { name, category, dates: addPurchase(known?.dates, now()) });
        items.push(item);
      }
      added.push(name);
    }

    if (!added.length && !already.length) return speak('No te he entendido. ¿Qué quieres añadir?', { end: false, reprompt: HELP });
    const parts = [];
    if (added.length) parts.push(`Hecho, he añadido ${joinNames(added)} a la lista.`);
    if (already.length) parts.push(`${joinNames(already)} ya ${already.length > 1 ? 'estaban' : 'estaba'} en la lista.`);
    return speak(parts.join(' '));
  }

  async function readList(link) {
    const pending = (await repo.listItems(link.home)).filter((i) => !i.done);
    if (!pending.length) return speak('La lista de la compra está vacía.');
    const names = pending.slice(0, 15).map((i) => (i.qty ? `${i.qty} de ${i.name}` : i.name));
    const more = pending.length > 15 ? ` y ${pending.length - 15} cosas más` : '';
    return speak(`En la lista hay ${pending.length === 1 ? 'una cosa' : `${pending.length} cosas`}: ${joinNames(names)}${more}.`);
  }

  async function linkWithCode(userId, spokenCode) {
    const code = String(spokenCode ?? '').replace(/\D/g, '');
    if (code.length !== 6) return speak('El código tiene seis cifras. Dímelo otra vez, por ejemplo: mi código es uno dos tres cuatro cinco seis.', { end: false, reprompt: 'Dime el código de seis cifras.' });
    const entry = await repo.takeCode(code);
    if (!entry || entry.expiresAt < now()) {
      return speak('Ese código no existe o ya ha caducado. Genera uno nuevo en la app y vuelve a intentarlo.');
    }
    await repo.setLink(userId, { home: entry.home, uid: entry.uid, name: entry.name, linkedAt: now() });
    return speak(`Listo${entry.name ? `, ${entry.name}` : ''}. Alexa ya está conectada a tu casa. Ahora puedes decirme: añade leche.`);
  }

  return async function handle(body) {
    const request = body?.request ?? {};
    const userId = body?.session?.user?.userId ?? body?.context?.System?.user?.userId;
    if (!userId) return speak('Algo ha fallado. Vuelve a intentarlo.');

    if (request.type === 'SessionEndedRequest') return { version: '1.0', response: {} };
    if (request.type === 'AlexaSkillEvent.SkillDisabled') {
      await repo.deleteLink(userId);
      return { version: '1.0', response: {} };
    }

    const intent = request.type === 'IntentRequest' ? request.intent?.name : null;
    const slot = (name) => request.intent?.slots?.[name]?.value;

    if (intent === 'AMAZON.HelpIntent') return speak(HELP, { end: false, reprompt: HELP });
    if (intent === 'AMAZON.StopIntent' || intent === 'AMAZON.CancelIntent' || intent === 'AMAZON.NavigateHomeIntent') return speak('Hasta luego.');
    if (intent === 'LinkIntent') return linkWithCode(userId, slot('codigo'));

    const link = await repo.getLink(userId);
    if (!link) return speak(NOT_LINKED, { end: false, reprompt: 'Dime el código de seis cifras que sale en la app.' });

    if (intent === 'UnlinkIntent') {
      await repo.deleteLink(userId);
      return speak('He desconectado Alexa de tu casa. Para volver a conectarla, genera un código nuevo en la app.');
    }
    if (intent === 'AddItemIntent') {
      const text = slot('producto');
      if (!text) return speak('¿Qué quieres añadir a la lista?', { end: false, reprompt: HELP });
      return addProducts(link, text);
    }
    if (intent === 'ReadListIntent') return readList(link);
    if (request.type === 'LaunchRequest') return speak('¿Qué quieres añadir a la lista?', { end: false, reprompt: HELP });
    if (intent === 'AMAZON.FallbackIntent') return speak(`No te he entendido. ${HELP}`, { end: false, reprompt: HELP });
    return speak(HELP, { end: false, reprompt: HELP });
  };
}

module.exports = { createSkill, splitProducts, CODE_TTL_MS };
