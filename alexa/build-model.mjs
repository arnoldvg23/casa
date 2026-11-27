// Genera el model de veu de la skill (castellà) a partir del catàleg de l'app.
// `node alexa/build-model.mjs` → alexa/model.es-ES.json, que s'enganxa a la
// consola d'Alexa (Build → Interaction Model → JSON Editor).
import { writeFileSync } from 'node:fs';
import { CATEGORIES } from '../js/products.js';

// Els exemples ajuden Alexa a reconèixer productes; també accepta els que no hi són.
const samples = [...new Set(CATEGORIES.flatMap((c) => c.products.flatMap(([, catalan, ...spanish]) => (spanish.length ? spanish : [catalan]))))]
  .map((name) => name.toLowerCase())
  .filter((name) => /^[a-záéíóúüñ ]+$/.test(name))
  .slice(0, 400);

const add = ['añade', 'añadir', 'que añada', 'apunta', 'que apunte', 'pon', 'que ponga', 'mete', 'que meta', 'agrega', 'que agregue'];
const addUtterances = [
  ...add.flatMap((verb) => [`${verb} {producto}`, `${verb} {producto} a la lista`, `${verb} {producto} a la lista de la compra`, `${verb} {producto} a la cesta`]),
  'necesitamos {producto}', 'que necesitamos {producto}', 'falta {producto}', 'que falta {producto}', 'faltan {producto}',
  'hay que comprar {producto}', 'que hay que comprar {producto}', 'compra {producto}', 'que compre {producto}',
];

const model = {
  interactionModel: {
    languageModel: {
      invocationName: 'mi casa',
      intents: [
        { name: 'AddItemIntent', slots: [{ name: 'producto', type: 'PRODUCTO' }], samples: addUtterances },
        {
          name: 'ReadListIntent', slots: [],
          samples: ['qué hay en la lista', 'que me diga qué hay en la lista', 'qué falta', 'qué tengo que comprar', 'qué hay que comprar', 'lee la lista', 'que lea la lista', 'dime la lista'],
        },
        {
          name: 'LinkIntent', slots: [{ name: 'codigo', type: 'AMAZON.NUMBER' }],
          samples: ['mi código es {codigo}', 'que mi código es {codigo}', 'el código es {codigo}', 'código {codigo}', 'conectar con el código {codigo}', 'vincular con el código {codigo}'],
        },
        { name: 'UnlinkIntent', slots: [], samples: ['desconecta alexa', 'que se desconecte', 'desvincula mi cuenta', 'olvida mi casa', 'que olvide mi casa'] },
        { name: 'AMAZON.HelpIntent', samples: [] },
        { name: 'AMAZON.StopIntent', samples: [] },
        { name: 'AMAZON.CancelIntent', samples: [] },
        { name: 'AMAZON.NavigateHomeIntent', samples: [] },
        { name: 'AMAZON.FallbackIntent', samples: [] },
      ],
      types: [{ name: 'PRODUCTO', values: samples.map((value) => ({ name: { value } })) }],
    },
  },
};

writeFileSync(new URL('./model.es-ES.json', import.meta.url), `${JSON.stringify(model, null, 2)}\n`);
console.log(`model.es-ES.json: ${samples.length} productes d'exemple, ${addUtterances.length} frases per afegir`);
