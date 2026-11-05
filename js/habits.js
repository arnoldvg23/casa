import { normalize } from './products.js';

// Detecta cada quant es compra un producte a partir de les dates en què s'ha
// afegit a la llista i proposa els que ja tocaria tornar a comprar.
const DAY = 24 * 60 * 60 * 1000;
const MAX_DATES = 8;
const MIN_PURCHASES = 3; // amb dues compres només hi ha un interval: encara no és un patró
const MIN_INTERVAL_DAYS = 3; // el que es compra gairebé cada dia no cal recordar-ho
const EARLY_FACTOR = 0.85; // avisa una mica abans perquè coincideixi amb la compra de la setmana
const GIVE_UP_FACTOR = 3; // si fa tres intervals que no es compra, ja no és un hàbit

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

export function addPurchase(dates = [], now = Date.now()) {
  const last = dates.at(-1);
  const kept = last && sameDay(last, now) ? dates.slice(0, -1) : dates;
  return [...kept, now].slice(-MAX_DATES);
}

// La mediana evita que una compra puntual fora de ritme falsegi l'interval.
export function intervalDays(dates = []) {
  if (dates.length < MIN_PURCHASES) return null;
  const gaps = dates.slice(1).map((date, index) => (date - dates[index]) / DAY).sort((a, b) => a - b);
  const middle = Math.floor(gaps.length / 2);
  return gaps.length % 2 ? gaps[middle] : (gaps[middle - 1] + gaps[middle]) / 2;
}

export function dueProducts(history, onList, now = Date.now()) {
  return history
    .map((entry) => ({ entry, interval: intervalDays(entry.dates) }))
    .filter(({ entry, interval }) => {
      if (interval === null || interval < MIN_INTERVAL_DAYS) return false;
      if (onList.has(normalize(entry.name)) || (entry.snoozedUntil ?? 0) > now) return false;
      const elapsed = (now - entry.dates.at(-1)) / DAY;
      return elapsed >= interval * EARLY_FACTOR && elapsed <= interval * GIVE_UP_FACTOR;
    })
    .map(({ entry, interval }) => ({
      ...entry,
      interval,
      urgency: (now - entry.dates.at(-1)) / DAY / interval,
    }))
    .sort((a, b) => b.urgency - a.urgency);
}

export const snoozeUntil = (interval, now = Date.now()) => now + interval * DAY;

export function formatInterval(days) {
  const weeks = Math.round(days / 7);
  const months = Math.round(days / 30);
  if (days < 6) return `Cada ${Math.round(days)} dies`;
  if (weeks === 1) return 'Cada setmana';
  if (days < 26) return `Cada ${weeks} setmanes`;
  return months === 1 ? 'Cada mes' : `Cada ${months} mesos`;
}
