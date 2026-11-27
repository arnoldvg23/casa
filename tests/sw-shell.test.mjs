// Comprova que el service worker guarda tots els fitxers de l'app: si se
// n'oblida un, la primera obertura sense connexió falla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const sw = readFileSync(new URL('sw.js', root), 'utf8');
const shell = JSON.parse(sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));

test('SHELL inclou tots els mòduls de js/', () => {
  const modules = readdirSync(new URL('js/', root)).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`);
  modules.forEach((file) => assert.ok(shell.includes(file), `${file} no és a SHELL de sw.js`));
});

test('SHELL inclou els fitxers estàtics', () => {
  ['index.html', 'styles.css', 'manifest.webmanifest', 'js/vendor/Sortable.min.js'].forEach((file) => {
    assert.ok(shell.includes(file), `${file} no és a SHELL de sw.js`);
  });
});

test('tots els fitxers de SHELL existeixen', () => {
  shell.filter((f) => f !== './').forEach((file) => {
    assert.doesNotThrow(() => readFileSync(new URL(file, root)), `${file} no existeix`);
  });
});
