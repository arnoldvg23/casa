// Seccions en l'ordre en què se sol recórrer el súper. Cada producte és
// [icona, nom en català, ...sinònims]: el nom català és el que se suggereix i
// els sinònims només serveixen per reconèixer el que s'escrigui en castellà.
export const CATEGORIES = [
  {
    id: 'fruta', label: 'Fruita i verdura', icon: '🥗', color: '#5f9e3f',
    products: [
      ['🍅', 'Tomàquets', 'Tomates'], ['🍌', 'Plàtans', 'Plátanos'], ['🍎', 'Pomes', 'Manzanas'], ['🍊', 'Taronges', 'Naranjas'],
      ['🍋', 'Llimones', 'Limones'], ['🥔', 'Patates', 'Patatas'], ['🧅', 'Cebes', 'Cebollas'], ['🧄', 'Alls', 'Ajos'],
      ['🥬', 'Enciam', 'Lechuga'], ['🥕', 'Pastanagues', 'Zanahorias'], ['🫑', 'Pebrots', 'Pimientos'], ['🥒', 'Carbassó', 'Calabacín'],
      ['🍆', 'Albergínia', 'Berenjena'], ['🥒', 'Cogombre', 'Pepino'], ['🥑', 'Alvocats', 'Aguacates'], ['🍓', 'Maduixes', 'Fresas'],
      ['🍇', 'Raïm', 'Uvas'], ['🍐', 'Peres', 'Peras'], ['🍑', 'Préssecs', 'Melocotones'], ['🍈', 'Meló', 'Melón'],
      ['🍉', 'Síndria', 'Sandía'], ['🍍', 'Pinya', 'Piña'], ['🥝', 'Kiwis'], ['🍊', 'Mandarines'],
      ['🥬', 'Espinacs', 'Espinacas'], ['🥦', 'Bròquil', 'Brócoli'], ['🥦', 'Coliflor'], ['🍄', 'Xampinyons', 'Champiñones'],
      ['🍄', 'Bolets', 'Setas'], ['🎃', 'Carbassa', 'Calabaza'], ['🥬', 'Porros', 'Puerros'], ['🫛', 'Mongetes verdes', 'Judías verdes'],
      ['🍎', 'Fruita', 'Fruta'], ['🥦', 'Verdura'], ['🥗', 'Amanida', 'Ensalada'], ['🌿', 'Julivert', 'Perejil'], ['🌿', 'Alfàbrega', 'Albahaca'],
      ['🥔', 'Patates per fregir', 'Patatas para freír', 'Patatrs per fregir'], ['🍅', 'Tomàquets per sucar', 'Tomates para untar', 'Tomàquet per pintar'],
    ],
  },
  {
    id: 'carne', label: 'Carn i peix', icon: '🍖', color: '#c2553f',
    products: [
      ['🍗', 'Pollastre', 'Pollo'], ['🍗', 'Pit de pollastre', 'Pechuga de pollo'], ['🥩', 'Vedella', 'Ternera'], ['🥩', 'Porc', 'Cerdo'],
      ['🥩', 'Llom', 'Lomo'], ['🥩', 'Carn picada', 'Carne picada'], ['🍔', 'Hamburgueses', 'Hamburguesas'], ['🌭', 'Salsitxes', 'Salchichas'],
      ['🌭', 'Botifarra'], ['🍖', 'Costelles', 'Costillas'], ['🐇', 'Conill', 'Conejo'], ['🍗', 'Gall dindi', 'Pavo'],
      ['🍖', 'Pernil', 'Jamón'], ['🍖', 'Pernil salat', 'Jamón serrano'], ['🍖', 'Pernil dolç', 'Jamón york'], ['🌭', 'Llonganissa', 'Chorizo'],
      ['🌭', 'Fuet'], ['🍖', 'Salami'], ['🥓', 'Bacó', 'Bacon'], ['🥓', 'Cansalada', 'Panceta'],
      ['🐟', 'Salmó', 'Salmón'], ['🐟', 'Lluç', 'Merluza'], ['🐟', 'Bacallà', 'Bacalao'], ['🐟', 'Tonyina fresca', 'Atún fresco'],
      ['🍤', 'Gambes', 'Gambas'], ['🍤', 'Llagostins', 'Langostinos'], ['🦪', 'Musclos', 'Mejillones'], ['🦑', 'Sípia', 'Sepia'],
      ['🦑', 'Calamars', 'Calamares'], ['🐟', 'Peix', 'Pescado'], ['🥩', 'Carn', 'Carne'],
      ['🧆', 'Mandonguilles', 'Albóndigas'], ['🌯', 'Carn per a fajites', 'Carne para fajitas'],
    ],
  },
  {
    id: 'lacteos', label: 'Lactis i ous', icon: '🥛', color: '#d9a521',
    products: [
      ['🥛', 'Llet', 'Leche'], ['🥚', 'Ous', 'Huevos'], ['🥣', 'Iogurts', 'Yogures'], ['🧀', 'Formatge', 'Queso'],
      ['🧀', 'Formatge ratllat', 'Queso rallado'], ['🧈', 'Mantega', 'Mantequilla'], ['🥛', 'Nata'], ['🥛', 'Quefir', 'Kéfir'],
      ['🍮', 'Natilles', 'Natillas'], ['🍮', 'Flam', 'Flan'], ['🧈', 'Margarina'],
      ['🧀', 'Formatge per untar', 'Queso crema', 'Formatge crema', 'Philadelphia'], ['🧀', 'Mascarpone'],
      ['🥛', 'Nata per muntar', 'Nata para montar', 'Nata per montar'],
    ],
  },
  {
    id: 'panaderia', label: 'Pa i brioixeria', icon: '🥖', color: '#c08a4a',
    products: [
      ['🥖', 'Pa', 'Pan'], ['🍞', 'Pa de motlle', 'Pan de molde'], ['🥖', 'Barra de pa', 'Barra de pan'], ['🍞', 'Torrades', 'Tostadas'],
      ['🍪', 'Galetes', 'Galletas'], ['🧁', 'Magdalenes', 'Magdalenas'], ['🥐', 'Croissants'], ['🥐', 'Brioixeria', 'Bollería'], ['🥣', 'Cereals', 'Cereales'],
      ['🥣', 'Granola'], ['🍪', 'Galetes Maria', 'Galletas María'], ['🦕', 'Galetes Dinosaurus', 'Dinosaurus', 'Dinosauris'],
      ['🍘', 'Tortites', 'Tortitas'], ['🍫', 'Tortites de xocolata', 'Tortitas de chocolate'],
      ['🫓', 'Tortilles per a fajites', 'Tortillas de trigo', 'Fajitas', 'Wraps'],
      ['🍫', 'Crema de cacau', 'Crema de cacao', 'Nocilla', 'Nutella'],
    ],
  },
  {
    id: 'despensa', label: 'Rebost', icon: '🥫', color: '#a0774a',
    products: [
      ['🍚', 'Arròs', 'Arroz'], ['🍝', 'Pasta'], ['🍝', 'Macarrons', 'Macarrones'], ['🍝', 'Espaguetis'],
      ['🍜', 'Fideus', 'Fideos'], ['🌾', 'Farina', 'Harina'], ['🍬', 'Sucre', 'Azúcar'], ['🧂', 'Sal'],
      ['🫒', 'Oli', 'Aceite'], ['🫒', "Oli d'oliva", 'Aceite de oliva'], ['🫙', 'Vinagre'], ['🫘', 'Llenties', 'Lentejas'],
      ['🫘', 'Cigrons', 'Garbanzos'], ['🫘', 'Mongetes', 'Alubias'], ['🥫', 'Tonyina', 'Atún'], ['🐟', 'Sardines', 'Sardinas'],
      ['🥫', 'Tomàquet fregit', 'Tomate frito', 'Tomàquet per fregir'], ['🫙', 'Maionesa', 'Mayonesa'], ['🫙', 'Quètxup', 'Ketchup'], ['🫙', 'Mostassa', 'Mostaza'],
      ['☕', 'Cafè', 'Café'], ['🍵', 'Te', 'Té'], ['🍵', 'Infusions', 'Infusiones'], ['🍫', 'Cacau', 'Cacao'],
      ['🍫', 'Xocolata', 'Chocolate', 'Xocolate', 'Xoco'], ['🍫', 'Xocolata negra', 'Chocolate negro', 'Xocolate negre', 'Xoco negre'], ['🍯', 'Mel', 'Miel'], ['🍯', 'Melmelada', 'Mermelada'], ['🌾', 'Llevat', 'Levadura'],
      ['🌶️', 'Espècies', 'Especias'], ['🌶️', 'Pebre', 'Pimienta'], ['🌿', 'Orenga', 'Orégano'], ['🍲', 'Brou', 'Caldo'],
      ['🫒', 'Olives', 'Aceitunas'], ['🍟', 'Patates fregides', 'Patatas fritas'], ['🥜', 'Fruits secs', 'Frutos secos'],
      ['🌰', 'Ametlles', 'Almendras'], ['🌰', 'Nous', 'Nueces'], ['🥑', 'Guacamole'],
    ],
  },
  {
    id: 'congelados', label: 'Congelats', icon: '🧊', color: '#4a9cc0',
    products: [
      ['🍨', 'Gelat', 'Helado'], ['🍕', 'Pizza'], ['🍕', 'Pizza congelada'], ['🧆', 'Croquetes', 'Croquetas'],
      ['🥦', 'Verdura congelada'], ['🫛', 'Pèsols', 'Guisantes'], ['🥟', 'Empanades', 'Empanadillas'],
      ['🐟', 'Bastonets de lluç', 'Varitas de merluza'], ['🧊', 'Gel', 'Hielo'],
    ],
  },
  {
    id: 'bebidas', label: 'Begudes', icon: '🥤', color: '#4a78c4',
    products: [
      ['💧', 'Aigua', 'Agua'], ['🧃', 'Suc', 'Zumo'], ['🥤', 'Refrescos'], ['🥤', 'Coca-Cola'], ['🥤', 'Coca-Cola Zero'], ['🥤', 'Aquarius'],
      ['🍺', 'Cervesa', 'Cerveza'], ['🍷', 'Vi', 'Vino'], ['🍾', 'Cava'], ['🥤', 'Tònica', 'Tónica'],
    ],
  },
  {
    id: 'limpieza', label: 'Neteja', icon: '🧹', color: '#3aa39b',
    products: [
      ['🧴', 'Detergent', 'Detergente'], ['🧴', 'Suavitzant', 'Suavizante'], ['🍽️', 'Rentaplats', 'Lavavajillas'], ['🧴', 'Lleixiu', 'Lejía'],
      ['🧹', 'Netejaterres', 'Fregasuelos'], ['🧴', 'Netejavidres', 'Limpiacristales'], ['🧴', 'Multiusos'], ['🧽', 'Fregalls', 'Estropajos'],
      ['🧽', 'Baietes', 'Bayetas'], ['🗑️', "Bosses d'escombraries", 'Bolsas de basura'], ['🧻', 'Paper de cuina', 'Papel de cocina'],
      ['🧻', "Paper d'alumini", 'Papel de aluminio'], ['🧻', 'Paper film', 'Papel film'], ['🍽️', 'Pastilles de rentaplats', 'Pastillas lavavajillas'],
    ],
  },
  {
    id: 'higiene', label: 'Higiene', icon: '🧼', color: '#a26ac8',
    products: [
      ['🧻', 'Paper higiènic', 'Papel higiénico'], ['🧴', 'Xampú', 'Champú'], ['🧴', 'Gel de dutxa', 'Gel de ducha'], ['🪥', 'Pasta de dents', 'Pasta de dientes'],
      ['🪥', 'Raspall de dents', 'Cepillo de dientes'], ['🧴', 'Desodorant', 'Desodorante'], ['🌸', 'Compreses', 'Compresas'], ['🌸', 'Tampons', 'Tampones'],
      ['🤧', 'Mocadors', 'Pañuelos'], ['☀️', 'Crema solar'], ['🧴', 'Crema hidratant', 'Crema hidratante'], ['🪒', "Maquinetes d'afaitar", 'Maquinillas'],
      ['🧼', 'Sabó de mans', 'Jabón de manos'], ['☁️', 'Cotó', 'Algodón'], ['🩹', 'Tiretes', 'Tiritas'],
      ['🫧', 'Colutori', 'Colutorio', 'Colotori', 'Colotorio', 'Enjuague bucal'],
    ],
  },
  {
    id: 'otros', label: 'Altres', icon: '🛒', color: '#85807a',
    products: [
      ['🔋', 'Piles', 'Pilas'], ['💡', 'Bombetes', 'Bombillas'], ['🐈', 'Menjar per a gats', 'Comida de gato'],
      ['🐕', 'Menjar per a gossos', 'Comida de perro'], ['🕯️', 'Espelmes', 'Velas'],
    ],
  },
];

const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export const categoryById = (id) => CATEGORY_BY_ID.get(id) ?? CATEGORY_BY_ID.get('otros');

export function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Un singular deduït no pot ser una partícula: «peres» → «per» feia que
// «patates per fregir» sortís amb icona de pera.
const LINKING_WORDS = new Set(['per', 'de', 'del', 'amb', 'para', 'con', 'les', 'els', 'la', 'el']);

// Reconeix singular i plural a partir de qualsevol de les dues formes,
// també el plural català en -es de les paraules en -a («pomes» → «poma»).
export function wordPattern(word) {
  const n = normalize(word);
  const forms = new Set([n, `${n}s`, `${n}es`]);
  const derived = (form) => { if (!LINKING_WORDS.has(form)) forms.add(form); };
  if (n.endsWith('es')) { derived(n.slice(0, -2)); derived(`${n.slice(0, -2)}a`); }
  if (n.endsWith('s')) derived(n.slice(0, -1));
  if (n.endsWith('a')) derived(`${n.slice(0, -1)}es`);
  const body = [...forms].map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`(?:^|[^a-z0-9])(?:${body})(?:$|[^a-z0-9])`);
}

const MATCHERS = CATEGORIES.flatMap((c) =>
  c.products.flatMap(([icon, ...names]) =>
    names.map((word) => ({ category: c.id, icon, length: word.length, pattern: wordPattern(word) })),
  ),
);

export const CATALOG = CATEGORIES.flatMap((c) =>
  c.products.map(([icon, name]) => ({ name, icon, category: c.id })),
);

// Mana el que s'anomena primer («suc de taronja» és beguda) i, en cas d'empat,
// el més llarg («tomàquet fregit» és rebost encara que «tomàquet» sigui verdura).
export function detectProduct(name) {
  const n = normalize(name);
  let best = null;
  for (const m of MATCHERS) {
    const match = m.pattern.exec(n);
    if (!match) continue;
    const isBetter = !best || match.index < best.index || (match.index === best.index && m.length > best.length);
    if (isBetter) best = { category: m.category, icon: m.icon, index: match.index, length: m.length };
  }
  return best;
}

// El que la família ja ha corregit a mà pesa més que el diccionari.
export function categoryFor(name, history) {
  const remembered = history.find((h) => normalize(h.name) === normalize(name));
  if (remembered && CATEGORY_BY_ID.has(remembered.category)) return remembered.category;
  return detectProduct(name)?.category ?? 'otros';
}

const iconCache = new Map();

export function iconFor(name, categoryId) {
  const key = `${categoryId}|${name}`;
  if (!iconCache.has(key)) iconCache.set(key, detectProduct(name)?.icon ?? categoryById(categoryId).icon);
  return iconCache.get(key);
}

const UNITS = 'kg|quilos?|kilos?|g|gr|grams?|gramos?|l|litres?|litros?|ml|cl|uds?\\.?|unitats?|unidad(?:es)?|paquets?|paquetes?|packs?|pots?|botes?|ampolles?|botellas?|llaunes?|latas?|safates?|bandejas?|barres?|barras?|bosses?|bolsas?|capses?|caixes?|cajas?|dotzenes?|docenas?|tarros?|briks?';
const LEADING_QTY = new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(${UNITS})?\\s+(?:de\\s+|d['’])?(.+)$`, 'i');
const TRAILING_QTY = /^(.+?)\s+(?:x\s*(\d+)|(\d+)\s*x)$/i;

// «2 kg de tomàquets» → { name: 'Tomàquets', qty: '2 kg' }; «llet x3» → { name: 'Llet', qty: '3' }
export function parseEntry(raw) {
  const text = raw.replace(/\s+/g, ' ').trim();
  let name = text;
  let qty = '';

  const leading = text.match(LEADING_QTY);
  const trailing = text.match(TRAILING_QTY);
  if (leading) {
    qty = [leading[1], leading[2]?.toLowerCase()].filter(Boolean).join(' ');
    name = leading[3];
  } else if (trailing) {
    name = trailing[1];
    qty = trailing[2] ?? trailing[3];
  }

  return { name: name.charAt(0).toUpperCase() + name.slice(1), qty };
}
