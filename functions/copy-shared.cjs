// Copia a functions/shared els mòduls de l'app que també fa servir la skill
// d'Alexa (catàleg de productes i hàbits). S'executa sol abans de cada deploy.
const { copyFileSync, mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const target = join(__dirname, 'shared');
mkdirSync(target, { recursive: true });
writeFileSync(join(target, 'package.json'), '{ "type": "module" }\n');
for (const file of ['products.js', 'habits.js']) copyFileSync(join(root, 'js', file), join(target, file));
